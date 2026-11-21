# Session Handover — 2026-11-21 (fin de session)
<!-- Tag: modes-de-reponse, hermes-pet -->
<!-- Remplace HANDOVER-2026-11-21-0639.md, qui ne couvrait que les 33 premiers modes. -->

## Session Summary
L'utilisateur a fait créer 88 commandes Claude Code de « modes de réponse », livrées par lots de 11, puis a lancé
**Hermes Pet** : un firmware pour la montre M5Stack StopWatch et une passerelle qui lui permettent de discuter
avec son agent Hermes (Nous Research). Tout est fusionné dans `main` (PR #3 à #10, plus la PR de ce handover).

## What Was Done
- **88 commandes** dans `.claude/commands/`, une par fichier, présentées dans `MODES.md` avec un tableau par catégorie.
- **Renommages pour éviter les conflits** : `/name` → `/jarvis`, `/recap` → `/sumup`, `/forecast` → `/projection`,
  `/debug` → `/fixit`, `/verify` → `/factcheck`, `/simplify` → `/essentials`, `/alin` → `/allin` (coquille).
- **Hermes Pet** (`hermes-pet/`) :
  - `bridge/bridge.py` : passerelle Python (bibliothèque standard uniquement) entre la montre ou le téléphone
    et l'API compatible OpenAI de Hermes (`hermes gateway`, `127.0.0.1:8642`).
  - `bridge/phone.html` : page `/phone` pour écrire depuis le téléphone.
  - `bridge/test_bridge.py` : 6 tests avec un faux Hermes, tous réussis.
  - `firmware/` : PlatformIO + M5Unified. Le firmware compile (35,8 % de la flash, 15,1 % de la RAM).
  - `README.md` : guide pas à pas en français, avec les notions expliquées.
- `NOTES.md` est tenu à jour après chaque lot.

## Key Decisions Made
- **Decision** : vérifier chaque nom de commande avant de la créer.
  - **Context** : `/name`, `/recap`, `/debug`, `/verify` et `/simplify` sont des commandes intégrées de Claude Code ;
    `/forecast` est pris par l'extension de vente.
  - **Rationale** : la commande intégrée prend le dessus, et la nôtre devient inutilisable. Pour tester un nom,
    appeler l'outil Skill avec ce nom : la réponse « Unknown skill » veut dire qu'il est libre.
    Attention : si le nom correspond à une compétence existante, elle se lance (c'est arrivé avec `/forecast`).
- **Decision** : rendre différents les modes qui se ressemblent.
  - **Rationale** : `/counter` donne une seule objection courte, alors que `/devil` défend tout le camp opposé.
    `/comparer` reste neutre, `/tradeoffs` recommande, `/decide` tranche. `/gridit` est une grille 2×2,
    alors que `/matrix` croise options et critères. `/kidsafe` vise les 8 à 10 ans, `/five` les 5 ans.
- **Decision** : la liste des modes va dans `MODES.md`, pas dans `README.md`.
  - **Context** : `Chaams/Chaams` est le repo de profil GitHub, et son `README.md` s'affiche publiquement sur le profil.
  - **Rationale** : ne pas modifier la page publique sans demande explicite. Un `README.md` placé dans
    `.claude/commands/` serait lui-même devenu une commande `/README`.
- **Decision** : Hermes Pet passe par une passerelle, pas par un vrai plugin Hermes.
  - **Rationale** : l'API de Hermes donne un accès complet à ses outils, terminal compris. La clé reste donc sur
    l'ordinateur, et la montre n'a qu'un `PET_TOKEN`. On s'appuie sur l'API officielle, plus stable que les
    détails internes des plugins, qui n'ont pas pu être vérifiés.
- **Decision** : pour l'usage à distance, Tailscale **Funnel**.
  - **Rationale** : un ESP32 ne peut pas exécuter Tailscale. Funnel expose la passerelle en HTTPS public.
    La montre essaie d'abord l'adresse locale, puis l'adresse Funnel, et vérifie le certificat avec ISRG Root X1
    (`firmware/include/root_ca.h`, valable jusqu'en 2035). Seul le jeton protège l'accès : c'est le compromis assumé.
- **Decision** : trois façons de parler, comme l'utilisateur l'a demandé.
  - Bouton A court : question toute prête. Bouton A maintenu : voix, enregistrée en WAV 16 kHz puis transcrite
    en local par faster-whisper (optionnel). Téléphone : la montre interroge `/inbox` toutes les 4 secondes.
- **Decision** : les requêtes HTTP de la montre tournent dans une tâche FreeRTOS séparée.
  - **Rationale** : l'animal reste animé pendant que Hermes réfléchit.

## Pitfalls & Gotchas
- Pour le firmware, PlatformIO utilise la carte `esp32s3box` (celle de la recette officielle M5Stack) avec
  arduino-esp32 2.x. Dans cette version, `HTTPClient::setTimeout` prend un `uint16_t` : 65 secondes au maximum,
  le délai est donc réglé à 60 secondes.
- Le micro et le haut-parleur partagent la même puce audio (ES8311). Il faut appeler `M5.Speaker.end()` avant
  `M5.Mic.begin()`, et l'inverse après.
- Les accents passent par les polices `fonts::efontJA_16/24`. C'est à vérifier sur l'écran réel.
- Pour récupérer une information sur une page web, l'agent web-fetch n'obtient rien de Facebook (connexion
  obligatoire) : il faut demander à l'utilisateur de coller la légende ou des captures.
- Chaque fusion de PR oblige à recréer la branche depuis `origin/main` avant le lot suivant.
- `merge_pull_request` exige le SHA complet de 40 caractères dans `expectedHeadSha`.
- La session a été très longue : penser à proposer `/clear` plus tôt.

## Open Questions
- Les modes n° 34 à 44 manquent dans la liste de l'utilisateur, qui passe du n° 33 au n° 45.
- L'utilisateur n'a pas encore la montre : rien n'a été testé sur l'appareil.
- Le nom exact du modèle à envoyer à Hermes est réglé par défaut sur `hermes-agent`. L'utilisateur doit le
  vérifier avec `/v1/models`.

## Next Steps
1. L'utilisateur fait les étapes 1 à 3 de `hermes-pet/README.md` : API Hermes, passerelle, test depuis le téléphone.
2. À la réception de la montre : connecter l'ordinateur de l'utilisateur (Remote Control), flasher le firmware,
   puis vérifier le dessin, les accents, le micro, les boutons et le toucher.
3. Ensuite : synthèse vocale des réponses, service `launchd`/`systemd` pour la passerelle, délai plus long si
   Hermes utilise beaucoup d'outils.
4. Si l'utilisateur envoie les modes n° 34 à 44 : vérifier les noms, les créer, mettre à jour `MODES.md`.

## Important Files
| File | Role |
|------|------|
| `.claude/commands/*.md` | Les 88 commandes de modes |
| `MODES.md` | Liste des modes par catégorie, plus le tableau des renommages |
| `NOTES.md` | Journal des décisions, demandé par `CLAUDE.md` |
| `hermes-pet/README.md` | Guide d'installation de Hermes Pet, étape par étape |
| `hermes-pet/bridge/bridge.py` | Passerelle entre la montre ou le téléphone et Hermes |
| `hermes-pet/bridge/test_bridge.py` | Tests de la passerelle avec un faux Hermes |
| `hermes-pet/firmware/src/main.cpp` | Firmware de la montre |
| `hermes-pet/firmware/include/config.example.h` | Modèle de configuration (Wi-Fi, URL, jeton, questions) |
| `README.md` | Page de profil GitHub publique : ne pas y toucher sans demande |

## Session Context
- **Branch** : `ccr-686e554b-eo1bra`, recréée depuis `main` avant chaque lot
- **PR fusionnées** : #3 à #10
