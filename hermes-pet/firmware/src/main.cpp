// Hermes Pet : un petit animal sur la montre M5Stack StopWatch qui discute
// avec ton agent Hermes, via la passerelle (dossier bridge/).
//
// Commandes :
//   Bouton A, appui court      -> envoie la question toute prête affichée
//   Bouton A, maintenu         -> parle (enregistre tant que tu appuies, 8 s max)
//   Bouton B ou toucher écran  -> question suivante ; sur une réponse : page suivante puis retour
//   Messages tapés sur le téléphone -> s'affichent tout seuls sur la montre

#include <M5Unified.h>
#include <WiFi.h>
#include <WiFiMulti.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <vector>
#include <math.h>

#include "config.h"   // copie de config.example.h avec tes valeurs
#include "root_ca.h"

// ---------------------------------------------------------------------------
// Réglages
// ---------------------------------------------------------------------------
static const uint32_t SAMPLE_RATE   = 16000;           // 16 kHz : suffisant pour la voix
static const uint32_t MAX_REC_MS    = 8000;            // durée max d'un message vocal
static const size_t   CHUNK         = 1600;            // 100 ms par morceau
static const uint32_t POLL_MS       = 4000;            // vérifie les messages du téléphone
static const uint16_t HTTP_TIMEOUT  = 60000;           // Hermes peut réfléchir un moment
static const size_t   PRESET_COUNT  = sizeof(PRESET_QUESTIONS) / sizeof(PRESET_QUESTIONS[0]);

// ---------------------------------------------------------------------------
// État général
// ---------------------------------------------------------------------------
enum class Mode { Idle, Listening, Thinking, Answer, Error };
enum class Mood { Calm, Happy, Think, Listen, Sad };

static M5Canvas canvas(&M5.Display);
static WiFiMulti wifiMulti;
static Mode mode = Mode::Idle;
static size_t presetIndex = 0;
static String bridgeUrl;          // URL choisie : locale ou Tailscale
static String statusLine;         // petit texte d'état sous l'animal
static String question, answer;
static std::vector<String> lines; // réponse découpée en lignes
static std::vector<size_t> pages; // index de la première ligne de chaque page
static size_t page = 0;
static uint32_t lastPoll = 0, modeSince = 0;
static long lastInboxId = -1;     // -1 : pas encore synchronisé

// Requête HTTP lancée dans une tâche à part, pour que l'animal reste animé.
struct Job {
  volatile bool running = false;
  volatile bool done = false;
  bool isAudio = false;
  String text;            // question texte
  uint8_t *audio = nullptr;
  size_t audioLen = 0;
  int code = 0;
  String body;            // réponse brute de la passerelle
} job;

// ---------------------------------------------------------------------------
// Réseau
// ---------------------------------------------------------------------------
// Fait une requête vers la passerelle. Gère http (maison) et https (Tailscale).
static int bridgeRequest(const String &base, const char *method, const String &path,
                         const char *contentType, const uint8_t *data, size_t len,
                         String &out, uint16_t timeoutMs) {
  if (base.isEmpty() || WiFi.status() != WL_CONNECTED) return -1;
  String url = base + path;
  WiFiClient plain;
  WiFiClientSecure secure;
  HTTPClient http;
  bool ok;
  if (url.startsWith("https://")) {
    secure.setCACert(ISRG_ROOT_X1);  // vérifie qu'on parle bien à ton serveur
    ok = http.begin(secure, url);
  } else {
    ok = http.begin(plain, url);
  }
  if (!ok) return -1;
  http.setConnectTimeout(3000);
  http.setTimeout(timeoutMs);
  http.addHeader("X-Pet-Token", PET_TOKEN);
  int code;
  if (strcmp(method, "POST") == 0) {
    http.addHeader("Content-Type", contentType);
    code = http.POST(const_cast<uint8_t *>(data), len);
  } else {
    code = http.GET();
  }
  out = code > 0 ? http.getString() : String();
  http.end();
  return code;
}

// Choisit la passerelle : d'abord le réseau local, sinon Tailscale.
static void pickBridge() {
  String out;
  if (bridgeRequest(BRIDGE_LOCAL_URL, "GET", "/health", "", nullptr, 0, out, 1500) == 200) {
    bridgeUrl = BRIDGE_LOCAL_URL;
    statusLine = "maison";
  } else if (strlen(BRIDGE_REMOTE_URL) &&
             bridgeRequest(BRIDGE_REMOTE_URL, "GET", "/health", "", nullptr, 0, out, 5000) == 200) {
    bridgeUrl = BRIDGE_REMOTE_URL;
    statusLine = "à distance";
  } else {
    bridgeUrl = "";
    statusLine = "passerelle introuvable";
  }
  Serial.printf("Passerelle : %s\n", bridgeUrl.isEmpty() ? "aucune" : bridgeUrl.c_str());
}

static void jobTask(void *) {
  if (job.isAudio) {
    job.code = bridgeRequest(bridgeUrl, "POST", "/ask-audio", "audio/wav",
                             job.audio, job.audioLen, job.body, HTTP_TIMEOUT);
  } else {
    JsonDocument doc;
    doc["text"] = job.text;
    doc["source"] = "watch";
    String payload;
    serializeJson(doc, payload);
    job.code = bridgeRequest(bridgeUrl, "POST", "/ask", "application/json",
                             (const uint8_t *)payload.c_str(), payload.length(), job.body, HTTP_TIMEOUT);
  }
  job.done = true;
  job.running = false;
  vTaskDelete(nullptr);
}

static void startJob() {
  if (bridgeUrl.isEmpty()) pickBridge();
  job.done = false;
  job.running = true;
  job.body = "";
  xTaskCreatePinnedToCore(jobTask, "hermes", 12288, nullptr, 1, nullptr, 0);
}

// ---------------------------------------------------------------------------
// Texte : découpe la réponse en lignes qui tiennent dans l'écran rond
// ---------------------------------------------------------------------------
static const int TEXT_TOP = 175, TEXT_BOTTOM = 420, LINE_H = 30;

// Largeur disponible à la hauteur y (une corde du cercle, moins une marge).
static int widthAt(int y) {
  float r = M5.Display.width() / 2.0f, dy = fabsf((y + LINE_H / 2) - r);
  if (dy >= r) return 0;
  return (int)(2.0f * sqrtf(r * r - dy * dy)) - 60;
}

static void layoutAnswer(const String &text) {
  lines.clear();
  pages.clear();
  canvas.setFont(&fonts::efontJA_24);
  int y = TEXT_TOP;
  pages.push_back(0);
  String line, word;
  auto flush = [&]() {
    lines.push_back(line);
    line = "";
    y += LINE_H;
    if (y + LINE_H > TEXT_BOTTOM) { y = TEXT_TOP; pages.push_back(lines.size()); }
  };
  String src = text + " ";
  for (size_t i = 0; i < src.length(); i++) {
    char c = src[i];
    if (c == ' ' || c == '\n') {
      String candidate = line.isEmpty() ? word : line + " " + word;
      if (!line.isEmpty() && canvas.textWidth(candidate) > widthAt(y)) {
        flush();
        line = word;
      } else {
        line = candidate;
      }
      word = "";
      if (c == '\n' && !line.isEmpty()) flush();
    } else {
      word += c;
    }
  }
  if (!line.isEmpty()) flush();
  if (!pages.empty() && pages.back() >= lines.size()) pages.pop_back();
  page = 0;
}

// ---------------------------------------------------------------------------
// Dessin de l'animal
// ---------------------------------------------------------------------------
static void drawPet(int cx, int cy, float s, Mood mood, uint32_t t) {
  const uint16_t body = canvas.color565(255, 196, 92);
  const uint16_t dark = TFT_BLACK;
  // Petit rebond pour qu'il ait l'air vivant.
  int bob = (int)(sinf(t / 400.0f) * 4 * s);
  cy += bob;
  canvas.fillCircle(cx, cy, 70 * s, body);                        // tête
  canvas.fillTriangle(cx - 60 * s, cy - 35 * s, cx - 30 * s, cy - 65 * s,
                      cx - 70 * s, cy - 85 * s, body);            // oreille gauche
  canvas.fillTriangle(cx + 60 * s, cy - 35 * s, cx + 30 * s, cy - 65 * s,
                      cx + 70 * s, cy - 85 * s, body);            // oreille droite

  int ex = 26 * s, ey = cy - 10 * s;
  bool blink = (t % 4000) < 140 && mood == Mood::Calm;
  switch (mood) {
    case Mood::Happy:  // yeux en « ^ ^ »
      for (int side = -1; side <= 1; side += 2) {
        canvas.drawLine(cx + side * ex - 10 * s, ey + 5 * s, cx + side * ex, ey - 6 * s, dark);
        canvas.drawLine(cx + side * ex, ey - 6 * s, cx + side * ex + 10 * s, ey + 5 * s, dark);
      }
      break;
    case Mood::Think:  // regarde en l'air
      canvas.fillCircle(cx - ex + 5 * s, ey - 8 * s, 8 * s, dark);
      canvas.fillCircle(cx + ex + 5 * s, ey - 8 * s, 8 * s, dark);
      break;
    case Mood::Listen:  // grands yeux attentifs
      canvas.fillCircle(cx - ex, ey, 12 * s, dark);
      canvas.fillCircle(cx + ex, ey, 12 * s, dark);
      canvas.fillCircle(cx - ex + 4 * s, ey - 4 * s, 4 * s, TFT_WHITE);
      canvas.fillCircle(cx + ex + 4 * s, ey - 4 * s, 4 * s, TFT_WHITE);
      break;
    case Mood::Sad:
      canvas.fillCircle(cx - ex, ey + 4 * s, 7 * s, dark);
      canvas.fillCircle(cx + ex, ey + 4 * s, 7 * s, dark);
      break;
    default:
      if (blink) {
        canvas.fillRect(cx - ex - 9 * s, ey, 18 * s, 3 * s, dark);
        canvas.fillRect(cx + ex - 9 * s, ey, 18 * s, 3 * s, dark);
      } else {
        canvas.fillCircle(cx - ex, ey, 9 * s, dark);
        canvas.fillCircle(cx + ex, ey, 9 * s, dark);
      }
  }
  // Bouche
  int my = cy + 25 * s;
  if (mood == Mood::Sad) {
    canvas.drawArc(cx, my + 14 * s, 14 * s, 12 * s, 200, 340, dark);
  } else if (mood == Mood::Listen) {
    canvas.fillCircle(cx, my, 7 * s, dark);
  } else {
    canvas.drawArc(cx, my - 8 * s, 14 * s, 12 * s, 20, 160, dark);
  }
  canvas.fillCircle(cx - 48 * s, cy + 12 * s, 8 * s, canvas.color565(255, 140, 120));  // joues
  canvas.fillCircle(cx + 48 * s, cy + 12 * s, 8 * s, canvas.color565(255, 140, 120));
}

static void drawCentered(const String &text, int y, uint16_t color) {
  canvas.setTextColor(color);
  canvas.setTextDatum(top_center);
  canvas.drawString(text, M5.Display.width() / 2, y);
}

static void render() {
  uint32_t t = millis();
  int w = M5.Display.width(), cx = w / 2;
  canvas.fillScreen(TFT_BLACK);  // fond noir : l'AMOLED éteint ces pixels, ça économise la batterie
  canvas.setFont(&fonts::efontJA_24);

  switch (mode) {
    case Mode::Idle:
      drawPet(cx, 175, 1.2f, Mood::Calm, t);
      canvas.setFont(&fonts::efontJA_16);
      drawCentered(statusLine, 300, TFT_DARKGREY);
      canvas.setFont(&fonts::efontJA_24);
      layoutAnswer(PRESET_QUESTIONS[presetIndex]);  // réutilise la découpe pour la question
      for (size_t i = 0; i < lines.size() && i < 2; i++) drawCentered(lines[i], 330 + i * LINE_H, TFT_WHITE);
      break;

    case Mode::Listening: {
      drawPet(cx, 200, 1.3f, Mood::Listen, t);
      float elapsed = (t - modeSince) / (float)MAX_REC_MS;
      canvas.drawArc(cx, w / 2, w / 2 - 4, w / 2 - 12, 270, 270 + 360 * fminf(elapsed, 1.0f), TFT_RED);
      drawCentered("Je t'écoute...", 340, TFT_WHITE);
      break;
    }

    case Mode::Thinking: {
      drawPet(cx, 200, 1.3f, Mood::Think, t);
      int dots = (t / 400) % 4;
      String d = "Je réfléchis";
      for (int i = 0; i < dots; i++) d += ".";
      drawCentered(d, 340, TFT_WHITE);
      break;
    }

    case Mode::Answer: {
      drawPet(cx, 95, 0.75f, Mood::Happy, t);
      size_t start = pages.empty() ? 0 : pages[page];
      size_t end = page + 1 < pages.size() ? pages[page + 1] : lines.size();
      for (size_t i = start; i < end; i++) drawCentered(lines[i], TEXT_TOP + (i - start) * LINE_H, TFT_WHITE);
      if (pages.size() > 1) {
        canvas.setFont(&fonts::efontJA_16);
        drawCentered(String(page + 1) + "/" + String(pages.size()), 425, TFT_DARKGREY);
      }
      break;
    }

    case Mode::Error:
      drawPet(cx, 175, 1.2f, Mood::Sad, t);
      layoutAnswer(answer);
      for (size_t i = 0; i < lines.size() && i < 3; i++) drawCentered(lines[i], 300 + i * LINE_H, TFT_ORANGE);
      break;
  }
  canvas.pushSprite(0, 0);
}

static void setMode(Mode m) {
  mode = m;
  modeSince = millis();
}

static void showError(const String &msg) {
  answer = msg;
  setMode(Mode::Error);
  M5.Speaker.tone(300, 150);
}

// ---------------------------------------------------------------------------
// Voix : enregistre tant que le bouton A est maintenu, puis fabrique un WAV
// ---------------------------------------------------------------------------
static void writeWavHeader(uint8_t *h, uint32_t dataLen) {
  auto u32 = [&](int o, uint32_t v) { memcpy(h + o, &v, 4); };
  auto u16 = [&](int o, uint16_t v) { memcpy(h + o, &v, 2); };
  memcpy(h, "RIFF", 4);  u32(4, 36 + dataLen);
  memcpy(h + 8, "WAVEfmt ", 8);
  u32(16, 16); u16(20, 1); u16(22, 1);          // PCM, mono
  u32(24, SAMPLE_RATE); u32(28, SAMPLE_RATE * 2);
  u16(32, 2); u16(34, 16);                      // 16 bits
  memcpy(h + 36, "data", 4); u32(40, dataLen);
}

static void recordVoice() {
  const size_t maxSamples = SAMPLE_RATE * MAX_REC_MS / 1000;
  if (!job.audio) job.audio = (uint8_t *)ps_malloc(44 + maxSamples * 2);  // en PSRAM
  if (!job.audio) { showError("Mémoire insuffisante"); return; }
  int16_t *samples = (int16_t *)(job.audio + 44);

  // Le micro et le haut-parleur partagent la même puce audio : un seul à la fois.
  M5.Speaker.end();
  M5.Mic.begin();
  setMode(Mode::Listening);
  size_t n = 0;
  while (n + CHUNK <= maxSamples) {
    M5.Mic.record(samples + n, CHUNK, SAMPLE_RATE);
    while (M5.Mic.isRecording()) delay(1);
    n += CHUNK;
    M5.update();
    render();
    if (!M5.BtnA.isPressed()) break;
  }
  M5.Mic.end();
  M5.Speaker.begin();

  if (n < SAMPLE_RATE / 2) {  // moins d'une demi-seconde : appui trop court
    setMode(Mode::Idle);
    return;
  }
  writeWavHeader(job.audio, n * 2);
  job.isAudio = true;
  job.audioLen = 44 + n * 2;
  setMode(Mode::Thinking);
  startJob();
}

static void askText(const String &text) {
  job.isAudio = false;
  job.text = text;
  setMode(Mode::Thinking);
  startJob();
}

// ---------------------------------------------------------------------------
// Résultat d'une requête
// ---------------------------------------------------------------------------
static void handleJobResult() {
  job.done = false;
  JsonDocument doc;
  bool parsed = !deserializeJson(doc, job.body);
  if (job.code == 200 && parsed) {
    question = doc["question"].as<String>();
    answer = doc["answer"].as<String>();
    if (doc["id"].is<long>()) lastInboxId = max(lastInboxId, doc["id"].as<long>());
    layoutAnswer(answer.isEmpty() ? String("(pas de réponse)") : answer);
    setMode(Mode::Answer);
    M5.Speaker.tone(1400, 60);
    return;
  }
  if (job.code < 0) {
    bridgeUrl = "";  // on recherchera la passerelle au prochain essai
    showError("Passerelle injoignable");
  } else if (job.code == 401) {
    showError("Jeton refusé : vérifie PET_TOKEN");
  } else if (parsed && doc["error"].is<const char *>()) {
    showError(doc["error"].as<String>());
  } else {
    showError("Erreur " + String(job.code));
  }
}

// Messages envoyés depuis le téléphone : on les affiche sur la montre.
static void pollInbox() {
  if (bridgeUrl.isEmpty() || job.running) return;
  String out;
  String path = "/inbox?after=" + String(lastInboxId < 0 ? 0 : lastInboxId);
  int code = bridgeRequest(bridgeUrl, "GET", path, "", nullptr, 0, out, 3000);
  if (code < 0) { bridgeUrl = ""; return; }
  if (code != 200) return;
  JsonDocument doc;
  if (deserializeJson(doc, out)) return;
  bool firstSync = lastInboxId < 0;
  for (JsonObject item : doc["items"].as<JsonArray>()) {
    long id = item["id"];
    lastInboxId = max(lastInboxId, id);
    // Au démarrage on ignore l'historique ; ensuite on montre ce qui vient du téléphone.
    if (!firstSync && String(item["src"].as<const char *>()) == "phone") {
      question = item["q"].as<String>();
      answer = item["a"].as<String>();
      layoutAnswer(answer);
      setMode(Mode::Answer);
      M5.Speaker.tone(1400, 60);
    }
  }
  if (lastInboxId < 0) lastInboxId = 0;
}

// ---------------------------------------------------------------------------
void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);
  Serial.begin(115200);
  M5.Display.setBrightness(120);
  M5.BtnA.setHoldThresh(400);

  canvas.setPsram(true);
  canvas.setColorDepth(16);
  canvas.createSprite(M5.Display.width(), M5.Display.height());

  statusLine = "connexion Wi-Fi...";
  render();
  WiFi.mode(WIFI_STA);
  wifiMulti.addAP(WIFI_1_SSID, WIFI_1_PASSWORD);
  if (strlen(WIFI_2_SSID)) wifiMulti.addAP(WIFI_2_SSID, WIFI_2_PASSWORD);
  if (wifiMulti.run(15000) == WL_CONNECTED) {
    Serial.printf("Wi-Fi : %s (%s)\n", WiFi.SSID().c_str(), WiFi.localIP().toString().c_str());
    pickBridge();
  } else {
    statusLine = "pas de Wi-Fi";
  }
}

void loop() {
  M5.update();
  uint32_t now = millis();
  auto touch = M5.Touch.getDetail();
  bool next = M5.BtnB.wasClicked() || touch.wasClicked();

  // Reconnexion automatique (par exemple en passant de la maison au téléphone).
  if (WiFi.status() != WL_CONNECTED && !job.running) {
    statusLine = "pas de Wi-Fi";
    if (wifiMulti.run(5000) == WL_CONNECTED) pickBridge();
  }

  if (job.done) handleJobResult();

  switch (mode) {
    case Mode::Idle:
      if (M5.BtnA.wasHold()) {
        recordVoice();
      } else if (M5.BtnA.wasClicked()) {
        askText(PRESET_QUESTIONS[presetIndex]);
      } else if (next) {
        presetIndex = (presetIndex + 1) % PRESET_COUNT;
      } else if (now - lastPoll > POLL_MS) {
        lastPoll = now;
        if (bridgeUrl.isEmpty() && WiFi.status() == WL_CONNECTED) pickBridge();
        pollInbox();
      }
      break;

    case Mode::Answer:
      if (next) {
        if (page + 1 < pages.size()) page++;
        else setMode(Mode::Idle);
      } else if (M5.BtnA.wasClicked() || now - modeSince > 120000) {
        setMode(Mode::Idle);
      }
      break;

    case Mode::Error:
      if (next || M5.BtnA.wasClicked() || now - modeSince > 8000) setMode(Mode::Idle);
      break;

    default:
      break;
  }

  render();
  delay(30);
}
