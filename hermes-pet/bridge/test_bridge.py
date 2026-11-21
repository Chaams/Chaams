"""Tests de la passerelle avec un faux Hermes (aucune installation requise).

Lancer :  python3 -m unittest test_bridge.py   (depuis le dossier bridge/)
"""

import json
import os
import threading
import unittest
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = "jeton-de-test-0123456789"
received = {}


class FakeHermes(BaseHTTPRequestHandler):
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        received["auth"] = self.headers.get("Authorization")
        received["session"] = self.headers.get("X-Hermes-Session-Id")
        received["body"] = body
        question = body["messages"][-1]["content"]
        raw = json.dumps({"choices": [{"message": {"content": f"Réponse à : {question}"}}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *args):
        pass


fake = ThreadingHTTPServer(("127.0.0.1", 0), FakeHermes)
threading.Thread(target=fake.serve_forever, daemon=True).start()

os.environ.update(
    HERMES_URL=f"http://127.0.0.1:{fake.server_port}",
    HERMES_API_KEY="cle-hermes",
    PET_TOKEN=TOKEN,
)
import bridge  # noqa: E402  (importé après la configuration)

bridge.Handler.log_message = lambda *a: None
srv = ThreadingHTTPServer(("127.0.0.1", 0), bridge.Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_port}"


def call(path, data=None, token=TOKEN, raw=None):
    headers = {"X-Pet-Token": token} if token else {}
    body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


class BridgeTests(unittest.TestCase):
    def test_health_is_public(self):
        self.assertEqual(call("/health", token=None), (200, {"status": "ok"}))

    def test_rejects_missing_or_wrong_token(self):
        self.assertEqual(call("/ask", {"text": "salut"}, token=None)[0], 401)
        self.assertEqual(call("/ask", {"text": "salut"}, token="mauvais")[0], 401)
        self.assertEqual(call("/inbox", token="mauvais")[0], 401)

    def test_ask_forwards_to_hermes_and_fills_inbox(self):
        code, data = call("/ask", {"text": "Quelle heure est-il ?", "source": "phone"})
        self.assertEqual(code, 200)
        self.assertEqual(data["answer"], "Réponse à : Quelle heure est-il ?")
        # La clé Hermes est envoyée par la passerelle, jamais par la montre.
        self.assertEqual(received["auth"], "Bearer cle-hermes")
        self.assertEqual(received["session"], "hermes-pet")
        self.assertEqual(received["body"]["messages"][0]["role"], "system")
        code, inbox = call(f"/inbox?after={data['id'] - 1}")
        self.assertEqual(code, 200)
        self.assertEqual(inbox["items"][-1]["src"], "phone")
        self.assertEqual(call(f"/inbox?after={data['id']}")[1], {"items": []})

    def test_empty_text_is_rejected(self):
        self.assertEqual(call("/ask", {"text": "  "})[0], 400)

    def test_audio_without_whisper_explains_why(self):
        try:
            import faster_whisper  # noqa: F401
            self.skipTest("faster-whisper installé")
        except ImportError:
            pass
        code, data = call("/ask-audio", raw=b"RIFF....")
        self.assertEqual(code, 501)
        self.assertIn("faster-whisper", data["error"])

    def test_hermes_down_gives_clear_error(self):
        old = bridge.HERMES_URL
        bridge.HERMES_URL = "http://127.0.0.1:1"
        try:
            code, data = call("/ask", {"text": "allo"})
        finally:
            bridge.HERMES_URL = old
        self.assertEqual(code, 502)
        self.assertIn("injoignable", data["error"])


if __name__ == "__main__":
    unittest.main()
