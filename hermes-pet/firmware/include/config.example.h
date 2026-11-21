// Copie ce fichier en config.h (même dossier) puis remplis les valeurs.
// config.h est ignoré par Git : il contient ton mot de passe Wi-Fi et ton jeton.
#pragma once

// --- Wi-Fi : la montre essaie chaque réseau dans l'ordre -------------------
// Le premier : ta maison. Le second : le partage de connexion de ton téléphone,
// pour quand tu es dehors.
#define WIFI_1_SSID     "MaBox"
#define WIFI_1_PASSWORD "motdepasse-maison"
#define WIFI_2_SSID     "MonTelephone"
#define WIFI_2_PASSWORD "motdepasse-partage"

// --- Où joindre la passerelle ---------------------------------------------
// 1) À la maison : l'adresse locale de l'ordinateur Hermes (voir README, étape 3).
#define BRIDGE_LOCAL_URL  "http://192.168.1.50:8787"
// 2) Loin de chez toi : l'adresse Tailscale Funnel (voir README, étape 6).
//    Laisse "" tant que tu ne l'as pas configurée.
#define BRIDGE_REMOTE_URL ""   // ex. "https://mon-ordi.mon-reseau.ts.net"

// --- Jeton d'appareil : la même valeur que PET_TOKEN dans bridge/.env -------
#define PET_TOKEN "remplace-moi-par-un-jeton-aleatoire"

// --- Questions toutes prêtes (touche du bas pour changer) ------------------
static const char *PRESET_QUESTIONS[] = {
  "Qu'est-ce que j'ai de prévu aujourd'hui ?",
  "Résume mes notes d'hier.",
  "Donne-moi une idée pour avancer sur mon projet.",
  "Raconte-moi quelque chose d'intéressant.",
  "Comment vas-tu ?",
};
