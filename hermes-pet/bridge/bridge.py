#!/usr/bin/env python3
"""Passerelle Hermes Pet.

Petit serveur qui tourne sur l'ordinateur où vit Hermes Agent. Il fait le lien
entre la montre M5Stack StopWatch (ou ton téléphone) et l'API de Hermes.

Pourquoi une passerelle plutôt que brancher la montre directement sur Hermes ?
L'API de Hermes donne accès à tous ses outils, y compris le terminal. Sa clé
reste donc ici, sur l'ordinateur. La montre n'a qu'un « jeton d'appareil » qui
permet seulement de discuter : si tu perds la montre, tu changes ce jeton et
personne ne peut piloter ton ordinateur.

Dépendances : uniquement la bibliothèque standard de Python.
Option voix : `pip install faster-whisper` pour transcrire l'audio en local.
"""

import hmac
import json
import os
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load_env(path: Path) -> None:
    """Charge un fichier .env simple (CLE=valeur) sans écraser l'environnement."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env(HERE / ".env")

HERMES_URL = os.environ.get("HERMES_URL", "http://127.0.0.1:8642").rstrip("/")
HERMES_KEY = os.environ.get("HERMES_API_KEY", "")
HERMES_MODEL = os.environ.get("HERMES_MODEL", "hermes-agent")
PET_TOKEN = os.environ.get("PET_TOKEN", "")
HOST = os.environ.get("BRIDGE_HOST", "0.0.0.0")
PORT = int(os.environ.get("BRIDGE_PORT", "8787"))
SESSION_ID = os.environ.get("HERMES_SESSION_ID", "hermes-pet")
WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base")
LANGUAGE = os.environ.get("PET_LANGUAGE", "fr")
MAX_BODY = 2 * 1024 * 1024  # 2 Mo : ~60 s d'audio 16 kHz mono, largement assez

SYSTEM_PROMPT = os.environ.get(
    "PET_SYSTEM_PROMPT",
    "Tu réponds via un petit animal de compagnie affiché sur une montre ronde. "
    "Réponds en français, en 1 à 3 phrases courtes (moins de 300 caractères), "
    "sans Markdown, sans listes ni emojis.",
)

# File d'attente des messages à afficher sur la montre (mode téléphone).
_inbox: list[dict] = []
_inbox_lock = threading.Lock()
_next_id = 1


def push_inbox(question: str, answer: str, source: str) -> dict:
    global _next_id
    with _inbox_lock:
        item = {"id": _next_id, "q": question, "a": answer, "src": source, "t": int(time.time())}
        _next_id += 1
        _inbox.append(item)
        del _inbox[:-20]  # on ne garde que les 20 derniers
        return item


def ask_hermes(text: str) -> str:
    """Envoie une question à Hermes (API compatible OpenAI) et renvoie la réponse."""
    payload = {
        "model": HERMES_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": text},
        ],
        "stream": False,
    }
    req = urllib.request.Request(
        f"{HERMES_URL}/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {HERMES_KEY}",
            # Garde le fil de la conversation côté Hermes.
            "X-Hermes-Session-Id": SESSION_ID,
        },
        method="POST",
    )
    # Hermes peut utiliser des outils avant de répondre : on lui laisse du temps.
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return (data["choices"][0]["message"].get("content") or "").strip()


_whisper = None
_whisper_lock = threading.Lock()


def transcribe(wav_bytes: bytes) -> str:
    """Transcrit un fichier WAV en texte avec faster-whisper (local, hors ligne)."""
    global _whisper
    try:
        from faster_whisper import WhisperModel  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "Mode voix indisponible : installe faster-whisper (pip install faster-whisper)"
        ) from exc
    with _whisper_lock:
        if _whisper is None:
            _whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8")
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            tmp.write(wav_bytes)
            tmp.flush()
            segments, _ = _whisper.transcribe(tmp.name, language=LANGUAGE)
            return " ".join(s.text.strip() for s in segments).strip()


PHONE_PAGE = (HERE / "phone.html").read_text(encoding="utf-8")


class Handler(BaseHTTPRequestHandler):
    server_version = "HermesPet/1.0"

    # --- utilitaires ---------------------------------------------------------
    def _send(self, code: int, body, content_type="application/json") -> None:
        raw = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def _authorized(self) -> bool:
        token = self.headers.get("X-Pet-Token", "")
        # Comparaison à temps constant pour ne rien laisser deviner du jeton.
        return bool(PET_TOKEN) and hmac.compare_digest(token, PET_TOKEN)

    def _body(self) -> bytes:
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_BODY:
            raise ValueError("requête trop grosse")
        return self.rfile.read(length)

    def log_message(self, fmt, *args):  # journal plus lisible, sans en-têtes
        sys.stderr.write(f"[{time.strftime('%H:%M:%S')}] {self.address_string()} {fmt % args}\n")

    # --- routes --------------------------------------------------------------
    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/health":
            return self._send(200, {"status": "ok"})
        if path in ("/", "/phone"):
            return self._send(200, PHONE_PAGE.encode("utf-8"), "text/html")
        if not self._authorized():
            return self._send(401, {"error": "jeton invalide"})
        if path == "/inbox":
            # La montre demande les messages plus récents que ?after=<id>.
            after = 0
            if "after=" in self.path:
                try:
                    after = int(self.path.split("after=", 1)[1].split("&", 1)[0])
                except ValueError:
                    after = 0
            with _inbox_lock:
                items = [i for i in _inbox if i["id"] > after]
            return self._send(200, {"items": items})
        return self._send(404, {"error": "introuvable"})

    def do_POST(self):
        if not self._authorized():
            return self._send(401, {"error": "jeton invalide"})
        try:
            body = self._body()
        except ValueError as exc:
            return self._send(413, {"error": str(exc)})

        try:
            if self.path == "/ask":
                # Question texte : touches de la montre ou téléphone.
                data = json.loads(body.decode("utf-8") or "{}")
                text = str(data.get("text", "")).strip()[:2000]
                source = str(data.get("source", "watch"))[:16]
                if not text:
                    return self._send(400, {"error": "texte vide"})
                answer = ask_hermes(text)
                item = push_inbox(text, answer, source)
                return self._send(200, {"question": text, "answer": answer, "id": item["id"]})

            if self.path == "/ask-audio":
                # Question vocale : la montre envoie un WAV 16 kHz mono.
                text = transcribe(body)
                if not text:
                    return self._send(422, {"error": "je n'ai rien entendu"})
                answer = ask_hermes(text)
                item = push_inbox(text, answer, "voice")
                return self._send(200, {"question": text, "answer": answer, "id": item["id"]})
        except urllib.error.HTTPError as exc:
            return self._send(502, {"error": f"Hermes a répondu {exc.code}"})
        except (urllib.error.URLError, TimeoutError):
            return self._send(502, {"error": "Hermes injoignable (hermes gateway lancé ?)"})
        except RuntimeError as exc:
            return self._send(501, {"error": str(exc)})
        except (json.JSONDecodeError, KeyError, IndexError):
            return self._send(400, {"error": "requête ou réponse illisible"})

        return self._send(404, {"error": "introuvable"})


def main() -> None:
    if not PET_TOKEN or len(PET_TOKEN) < 16:
        sys.exit("PET_TOKEN manquant ou trop court (16 caractères minimum) : voir .env.example")
    if not HERMES_KEY:
        sys.exit("HERMES_API_KEY manquant : mets la même valeur que API_SERVER_KEY de Hermes")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Passerelle Hermes Pet sur http://{HOST}:{PORT}  ->  Hermes {HERMES_URL}")
    print(f"Page téléphone : http://<ip-de-cet-ordinateur>:{PORT}/phone")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt.")


if __name__ == "__main__":
    main()
