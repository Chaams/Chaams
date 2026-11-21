# Notes de session

## 2026-11-19 — Hygiène du contexte
- Décision : consignes d'hygiène du contexte enregistrées dans `CLAUDE.md` (chargé automatiquement à chaque session).
- Prochaines étapes : aucune ; ajouter ici le résumé de chaque tâche terminée.

## 2026-11-21 — Modes de réponse
- Décision : 11 commandes créées dans `.claude/commands/` (/plain, /pro, /founder, /coach, /skeptic, /teacher, /five, /tight, /longform, /sell, /calm). Usage : `/tight ta question`.
- Prochaines étapes : ajuster les consignes d'un mode en éditant son fichier `.md` si le style ne convient pas.

## 2026-11-21 — Modes de réponse (suite)
- Décision : 11 commandes de plus (/dig, /gut, /devil, /firstprinciples, /longgame, /worstcase, /bestcase, /tradeoffs, /reframe, /zoomout, /zoomin). Total : 22 modes dans `.claude/commands/`.

## 2026-11-21 — Modes créatifs
- Décision : 11 commandes de plus (/remix, /twist, /mashup, /wild, /safe, /name, /openers, /story, /metaphor, /series, /hook). Total : 33 modes dans `.claude/commands/`.

## 2026-11-21 — Modes d'apprentissage
- Décision : 11 commandes de plus (/teachme, /quiz, /sumup, /gaps, /sources, /debate, /history, /projection, /jargon, /kidsafe, /oneline). Total : 44 modes.
- Renommages pour éviter les conflits : /recap → /sumup (commande intégrée de Claude Code), /forecast → /projection (déjà pris par l'extension sales).
- Prochaine étape : renommer /name, en conflit avec une commande intégrée.

## 2026-11-21 — Modes de format
- Décision : 11 commandes de plus (/outline, /checklist, /template, /table, /matrix, /timeline, /bullets, /json, /form, /script, /brief). Aucun conflit de nom détecté. Total : 55 modes.

## 2026-11-21 — Modes de code
- Décision : 11 commandes de plus (/code, /fixit, /refactor, /comment, /testit, /explainit, /optimize, /convert, /schema, /api, /secure). Total : 66 modes.
- Renommage : /debug → /fixit (commande intégrée de Claude Code).

## 2026-11-21 — Modes d'analyse et de décision
- Décision : 11 commandes de plus (/comparer, /proscons, /decide, /priority, /root, /data, /pattern, /assumption, /factcheck, /counter, /essentials). Total : 77 modes.
- Renommages : /verify → /factcheck et /simplify → /essentials (commandes intégrées de Claude Code).

## 2026-11-21 — Modes d'action et de finition
- Décision : 11 commandes de plus (/improve, /automate, /reusable, /habit, /frame, /gridit, /reverse, /roleplay, /pushback, /finalcheck, /allin). Aucun conflit de nom détecté. Total : 88 modes.
- /alin (liste d'origine) créé sous le nom /allin (« all in »), probablement une coquille. /gridit fait une grille 2x2, pour le distinguer de /matrix (grille options × critères).

## 2026-11-21 — Hermes Pet (montre M5Stack StopWatch + Hermes Agent)
- Décision : projet dans `hermes-pet/`. Une passerelle Python (`bridge/`, bibliothèque standard uniquement) entre la montre/le téléphone et l'API OpenAI-compatible de Hermes (`hermes gateway`, 127.0.0.1:8642). La clé Hermes reste sur l'ordinateur ; la montre n'a qu'un `PET_TOKEN`.
- Trois modes : questions prêtes (bouton A court), voix (bouton A maintenu → WAV → faster-whisper local), téléphone (page `/phone`, la montre interroge `/inbox` toutes les 4 s).
- À distance : Tailscale Funnel (l'ESP32 ne peut pas exécuter Tailscale). La montre essaie l'URL locale, puis l'URL Funnel en HTTPS vérifié (ISRG Root X1).
- Vérifié : 6 tests de la passerelle OK ; le firmware compile (PlatformIO, carte esp32s3box, M5Unified 0.2.29). Rien n'a encore été testé sur une vraie montre (l'utilisateur ne l'a pas encore).
- Prochaines étapes : test sur l'appareil à la réception, synthèse vocale de la réponse, service launchd/systemd pour la passerelle.
