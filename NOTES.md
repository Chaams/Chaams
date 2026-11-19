# Notes de session

## 2026-11-19 — Hygiène du contexte
- Décision : consignes d'hygiène du contexte enregistrées dans `CLAUDE.md` (chargé automatiquement à chaque session).
- Prochaines étapes : aucune ; ajouter ici le résumé de chaque tâche terminée.

## 2026-11-19 — Installation de mg-styles-15 (guide ouerfelli-raed.com/guide-mg-styles-15)
- Repo cloné (léger, sans videos/ ni docs/) dans ~/mg-styles-15 du conteneur cloud (éphémère, rien sur la machine locale).
- npm install OK ; venv Python en 3.12 (matplotlib 3.9.1 ne s'installe pas en 3.13).
- Lancer le rendu avec MG_CHROME=/usr/bin/google-chrome.
- Polices : Fredoka installée (google/fonts) ; Resource Han Rounded remplacée par WenQuanYi Zen Hei (substitut, téléchargement des releases GitHub bloqué par le proxy).
- Test OK : audio.py de la démo 01-flat-vector + 3 images (2 s, 5 s, 8 s).
- Prochaine étape : choisir un style dans prompts/ et envoyer son prompt ; rendu MP4 complet = render.mjs sans --stills.
- Polices (suite) : 43/44 installées et testées dans Chrome. 30 viennent de Google Fonts (dépôt git) ; les polices chinoises Alibaba PuHuiTi, HarmonyOS Sans SC, Douyin Sans, Alimama ShuHeiTi et Fusion Pixel viennent de paquets npm non officiels (@fontpkg, sans script, métadonnées vérifiées). Fusion Pixel est une version de 2022, pas exactement la variante attendue. Resource Han Rounded reste un substitut (WenQuanYi Zen Hei). Versions figées créées pour 03-isometric, 07-liquid, 08-morph ; Mr Dafoe pour 10-synthwave.
- Pas installé : Blender (style 3D uniquement).
