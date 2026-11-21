# Les 88 modes de réponse

Des commandes Claude Code qui orientent le style, l'angle ou le format d'une réponse.
Chacune est un fichier `.md` dans `.claude/commands/` : pour la modifier, édite son fichier.

**Utilisation :** tape la commande suivie de ta question, par exemple `/tight c'est quoi une API ?`.

**Combinaisons :** les modes se cumulent dans le chat, par exemple `/worstcase /checklist` ou `/devil /calm`.

## Style de réponse

| Commande | Effet |
|---|---|
| `/plain` | Réponse en langage courant et naturel |
| `/pro` | Réponse de spécialiste chevronné |
| `/founder` | Réponse d'un fondateur d'entreprise expérimenté |
| `/coach` | Réponse d'un mentor bienveillant |
| `/skeptic` | Pose des questions avant de s'engager |
| `/teacher` | Explication patiente et claire |
| `/five` | Explique comme à un enfant de cinq ans |
| `/tight` | Réponse la plus courte possible |
| `/longform` | Réponse complète et détaillée |
| `/sell` | Texte de vente convaincant |
| `/calm` | Ton mesuré et posé |

## Angles de réflexion

| Commande | Effet |
|---|---|
| `/dig` | Analyse en profondeur, sans rien sauter |
| `/gut` | Ton instinct, pas seulement ta logique |
| `/devil` | Argumente le côté opposé |
| `/firstprinciples` | Reconstruit l'idée à partir de zéro |
| `/longgame` | Pense à cinq ans |
| `/worstcase` | Imagine ce qui pourrait mal se passer |
| `/bestcase` | Imagine ce qui pourrait bien se passer |
| `/tradeoffs` | Met en balance coûts et avantages |
| `/reframe` | Regarde la situation sous un nouvel angle |
| `/zoomout` | Prend du recul pour la vue d'ensemble |
| `/zoomin` | Plonge dans les moindres détails |

## Créativité

| Commande | Effet |
|---|---|
| `/remix` | Réimagine le sujet de zéro |
| `/twist` | Ajoute un angle inattendu |
| `/mashup` | Combine deux idées sans rapport |
| `/wild` | La version la plus audacieuse |
| `/safe` | La version la plus prudente |
| `/jarvis` | Brainstorm de noms ou de titres |
| `/openers` | Dix accroches différentes |
| `/story` | Transforme le sujet en récit |
| `/metaphor` | Explique via une analogie |
| `/series` | Crée une série de contenus |
| `/hook` | Une première ligne percutante |

## Apprentissage

| Commande | Effet |
|---|---|
| `/teachme` | Explication patiente, étape par étape |
| `/quiz` | Transforme le sujet en questions d'entraînement |
| `/sumup` | Résume le sujet couvert |
| `/gaps` | Trouve ce qu'il me manque |
| `/sources` | Oriente vers des approfondissements |
| `/debate` | Débat des deux côtés du sujet |
| `/history` | Explique l'origine du sujet |
| `/projection` | Projette l'évolution future du sujet |
| `/jargon` | Traduit les termes techniques |
| `/kidsafe` | Explication pour un enfant curieux |
| `/oneline` | Explique en une seule phrase |

## Format

| Commande | Effet |
|---|---|
| `/outline` | Organise selon un plan propre |
| `/checklist` | Transforme en liste de contrôle pratique |
| `/template` | Crée un modèle réutilisable |
| `/table` | Transforme en tableau |
| `/matrix` | Grille de décision des options |
| `/timeline` | Frise chronologique |
| `/bullets` | Points clés |
| `/json` | Structure la réponse en JSON |
| `/form` | Transforme en formulaire à remplir |
| `/script` | Formate en script exécutable |
| `/brief` | Rédige comme un brief exécutif |

## Code

| Commande | Effet |
|---|---|
| `/code` | Écrit un code propre et fonctionnel |
| `/fixit` | Trouve ce qui casse dans le code |
| `/refactor` | Nettoie le code sans changer son comportement |
| `/comment` | Ajoute des commentaires au code |
| `/testit` | Écrit des tests pour les cas limites |
| `/explainit` | Explique ce que fait réellement le code |
| `/optimize` | Rend le code plus rapide ou plus léger |
| `/convert` | Traduit dans un autre langage ou une autre langue |
| `/schema` | Conçoit la structure des données |
| `/api` | Esquisse le design d'un point d'accès |
| `/secure` | Vérifie les failles de sécurité |

## Analyse et décision

| Commande | Effet |
|---|---|
| `/comparer` | Pèse plusieurs options côte à côte |
| `/proscons` | Liste des avantages et inconvénients |
| `/decide` | Recommande une option et la défend |
| `/priority` | Classe par ordre d'importance |
| `/root` | Trouve la cause réelle |
| `/data` | Extrait le signal des données |
| `/pattern` | Repère la tendance cachée |
| `/assumption` | Explicite les suppositions implicites |
| `/factcheck` | Vérifie un fait avant de l'utiliser |
| `/counter` | Donne un contre-argument |
| `/essentials` | Réduit le sujet à l'essentiel |

## Action et finition

| Commande | Effet |
|---|---|
| `/improve` | Affine quelque chose qui existe déjà |
| `/automate` | Rend la tâche répétable |
| `/reusable` | Construit quelque chose de réutilisable |
| `/habit` | Transforme en pratique quotidienne |
| `/frame` | Construit une structure d'ensemble |
| `/gridit` | Grille 2x2 des options |
| `/reverse` | Travaille à rebours depuis le résultat |
| `/roleplay` | Simule un scénario réaliste |
| `/pushback` | Me challenge avant que je m'engage |
| `/finalcheck` | Dernier passage avant l'envoi |
| `/allin` | Ma réponse la plus complète et la plus pertinente |

## Noms changés pour éviter les conflits

Ces noms de la liste d'origine étaient déjà pris par Claude Code ou par une extension :

| Nom d'origine | Nouveau nom | Raison |
|---|---|---|
| `/name` | `/jarvis` | commande intégrée de Claude Code |
| `/recap` | `/sumup` | commande intégrée de Claude Code |
| `/forecast` | `/projection` | déjà utilisé par l'extension de vente |
| `/debug` | `/fixit` | commande intégrée de Claude Code |
| `/verify` | `/factcheck` | commande intégrée de Claude Code |
| `/simplify` | `/essentials` | commande intégrée de Claude Code |
| `/alin` | `/allin` | coquille probable (« all in ») |

Avant d'ajouter un mode, vérifie que son nom n'est pas déjà pris (`/help` liste les commandes existantes).
