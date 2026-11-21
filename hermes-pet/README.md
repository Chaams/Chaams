# Hermes Pet

Un petit animal sur ta montre **M5Stack StopWatch** qui discute avec ton agent **Hermes** (Nous Research).
Tu peux lui parler de trois façons :

- **Questions toutes prêtes** : tu choisis une question sur la montre et tu l'envoies d'un clic.
- **À la voix** : tu maintiens le bouton, tu parles, il répond.
- **Depuis ton téléphone** : tu tapes un message, la réponse s'affiche sur le téléphone **et** sur la montre.

Ça marche chez toi par le Wi-Fi, et loin de chez toi grâce à Tailscale.

---

## Comment ça marche

```
 Montre M5Stack ──┐
                  ├──►  Passerelle (bridge.py)  ──►  Hermes Agent
 Téléphone ───────┘     sur ton ordinateur            (même ordinateur)
```

Trois morceaux :

| Morceau | Où | Rôle |
|---|---|---|
| **Firmware** (`firmware/`) | dans la montre | Le programme de la montre : il dessine l'animal, enregistre ta voix et envoie tes questions. |
| **Passerelle** (`bridge/`) | sur l'ordinateur Hermes | Un petit serveur qui reçoit les questions, les transmet à Hermes et renvoie les réponses. |
| **Hermes Agent** | sur l'ordinateur Hermes | Ton agent. On utilise son **API officielle**, une porte d'entrée standard pour les programmes. |

**Pourquoi une passerelle au lieu de brancher la montre directement sur Hermes ?**
L'API de Hermes donne accès à tous ses outils, y compris le terminal de ton ordinateur. Sa clé reste donc
sur l'ordinateur. La montre n'a qu'un **jeton d'appareil**, qui sert uniquement à discuter.
Si tu perds la montre, tu changes ce jeton, et personne ne peut piloter ton ordinateur.

> Note : la passerelle n'est pas un « plugin » installé *dans* Hermes. C'est un petit programme à côté,
> qui passe par l'API officielle de Hermes. C'est plus simple et ça ne casse pas quand Hermes est mis à jour.

---

## Étape 0 : ce qu'il te faut

- La montre **M5Stack StopWatch** (référence C152) et un câble **USB-C** qui transporte les données,
  pas seulement la charge.
- L'ordinateur où tourne **Hermes Agent** (Mac ou Linux), avec **Python 3.10 ou plus récent**.
- **VS Code** avec l'extension **PlatformIO IDE** pour installer le firmware sur la montre.
- Pour l'usage à distance : un compte **Tailscale**, gratuit pour un usage personnel.

---

## Étape 1 : activer l'API de Hermes

Hermes peut ouvrir une API compatible OpenAI. Ajoute ces lignes dans `~/.hermes/.env` :

```
API_SERVER_ENABLED=true
API_SERVER_KEY=une-longue-cle-secrete
```

Pour générer une clé solide :

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Puis lance Hermes en mode serveur :

```bash
hermes gateway
```

Tu dois voir : `API server listening on http://127.0.0.1:8642`.

**Concept :** `127.0.0.1` veut dire « seulement cet ordinateur ». Hermes n'est pas joignable depuis le
réseau, c'est voulu. Seule la passerelle, qui tourne sur le même ordinateur, lui parle.

Vérifie que ça marche et note le nom du modèle :

```bash
curl -H "Authorization: Bearer une-longue-cle-secrete" http://127.0.0.1:8642/v1/models
```

---

## Étape 2 : lancer la passerelle

```bash
cd hermes-pet/bridge
cp .env.example .env
```

Ouvre `.env` et remplis :

- `HERMES_API_KEY` : la même valeur que `API_SERVER_KEY` de l'étape 1.
- `HERMES_MODEL` : le nom vu dans `/v1/models`. `hermes-agent` est la valeur par défaut.
- `PET_TOKEN` : un nouveau jeton, différent de la clé Hermes. Génère-le avec la même commande `secrets`.

Puis lance la passerelle :

```bash
python3 bridge.py
```

Pour vérifier qu'elle fonctionne sans montre (elle utilise un faux Hermes) :

```bash
python3 -m unittest test_bridge.py
```

> Sur Mac, une fenêtre peut demander d'autoriser Python à recevoir des connexions : accepte.

---

## Étape 3 : tester depuis ton téléphone

1. Trouve l'adresse locale de ton ordinateur :
   - Mac : `ipconfig getifaddr en0`
   - Linux : `hostname -I`

   Tu obtiens quelque chose comme `192.168.1.50`.
2. Sur ton téléphone, connecté au **même Wi-Fi**, ouvre `http://192.168.1.50:8787/phone`.
3. Entre ton `PET_TOKEN` quand la page le demande, puis écris « Bonjour ! ».

Si Hermes répond, la moitié du projet marche. 🎉

**Concept :** l'**adresse IP locale** (192.168.x.x) est le « numéro de maison » de ton ordinateur sur ton
Wi-Fi. Elle peut changer quand la box redémarre. Pour l'éviter, réserve-la dans les réglages de ta box :
cherche « bail DHCP statique » ou « réservation d'adresse ».

---

## Étape 4 : configurer le firmware

```bash
cd hermes-pet/firmware
cp include/config.example.h include/config.h
```

Ouvre `include/config.h` et remplis :

- tes réseaux Wi-Fi : la maison, et le partage de connexion de ton téléphone pour quand tu sors ;
- `BRIDGE_LOCAL_URL` : `http://192.168.1.50:8787`, avec ton adresse de l'étape 3 ;
- `PET_TOKEN` : le même que dans `bridge/.env` ;
- tes questions toutes prêtes, à ton goût.

> La montre ne se connecte qu'au Wi-Fi **2,4 GHz**, comme tous les ESP32. Si ta box sépare
> les réseaux 2,4 GHz et 5 GHz, choisis le 2,4 GHz.

---

## Étape 5 : installer le firmware sur la montre

1. Ouvre le dossier `hermes-pet/firmware` dans VS Code. PlatformIO détecte le projet tout seul.
2. Branche la montre en USB-C.
3. Clique sur **→ Upload** dans la barre du bas, ou lance `pio run -t upload`.
   La première fois, PlatformIO télécharge les outils, ce qui prend quelques minutes.
4. Ouvre le **Serial Monitor** (icône 🔌) pour voir le journal de la montre : adresse Wi-Fi et passerelle trouvée.

Si l'envoi échoue, mets la montre en mode téléchargement : maintiens le bouton de démarrage en la
branchant. Le schéma est sur la [documentation M5Stack](https://docs.m5stack.com/en/core/StopWatch).

**Concept :** le **firmware** est le programme permanent de la montre. L'installer s'appelle
« flasher ». Tu peux le refaire autant de fois que tu veux.

### Utiliser la montre

| Action | Effet |
|---|---|
| **Bouton A**, appui court | Envoie la question toute prête affichée |
| **Bouton A**, maintenu | Enregistre ta voix tant que tu appuies (8 s max) |
| **Bouton B** ou toucher l'écran | Question suivante. Sur une réponse : page suivante, puis retour |
| Message tapé sur le téléphone | S'affiche tout seul sur la montre en quelques secondes |

---

## Étape 6 : utiliser la montre loin de chez toi (Tailscale)

À la maison, la montre parle à `192.168.1.50`. Dehors, cette adresse n'existe plus : il faut un chemin
par Internet.

**Concept :** **Tailscale** crée un réseau privé entre tes appareils, où qu'ils soient. Une montre ESP32
ne peut pas installer Tailscale. On utilise donc **Tailscale Funnel**, qui donne à ta passerelle une
adresse **HTTPS** joignable depuis Internet, du type `https://mon-ordi.mon-reseau.ts.net`.

1. Installe Tailscale sur l'ordinateur Hermes et connecte-toi.
2. Lance :

   ```bash
   tailscale funnel --bg 8787
   ```

   La première fois, Tailscale affiche un lien pour activer Funnel dans ta console d'administration.
   Ouvre-le et accepte.
3. Tailscale affiche ton adresse publique. Copie-la dans `BRIDGE_REMOTE_URL` de `config.h`, puis
   réinstalle le firmware (étape 5).

**Ensuite, tout est automatique.** Au démarrage et à chaque changement de Wi-Fi, la montre essaie
d'abord l'adresse de la maison. Si elle ne répond pas, elle passe par l'adresse Tailscale.
Dehors, active le partage de connexion de ton téléphone : la montre s'y connecte toute seule.
La page téléphone marche aussi à distance : `https://mon-ordi.mon-reseau.ts.net/phone`.

> ⚠️ **Sécurité** : avec Funnel, ta passerelle est joignable depuis Internet, protégée par `PET_TOKEN`.
> Hermes lui-même reste fermé, sur `127.0.0.1`. Garde un jeton long et aléatoire, ne le partage pas, et
> change-le si tu perds la montre. Pour tout couper : `tailscale funnel --bg off`, ou `tailscale funnel reset`
> selon ta version.
>
> La montre vérifie le certificat HTTPS avec l'autorité Let's Encrypt (`include/root_ca.h`), celle que
> Tailscale utilise. Elle sait ainsi qu'elle parle bien à ton serveur.

---

## Étape 7 : activer la voix

La montre enregistre ta voix et l'envoie à la passerelle, qui la transforme en texte **sur ton
ordinateur**, sans service en ligne, avec Whisper :

```bash
pip install faster-whisper
python3 bridge.py
```

La première question vocale télécharge le modèle, ce qui prend environ une minute, puis tout reste
en local. Pour régler le compromis vitesse/précision, change `WHISPER_MODEL` dans `.env` :
`tiny`, `base` ou `small`.

Tant que faster-whisper n'est pas installé, la montre affiche « Mode voix indisponible ». Les questions
toutes prêtes et le téléphone fonctionnent quand même.

---

## Dépannage

| Message sur la montre | Cause probable | Solution |
|---|---|---|
| « pas de Wi-Fi » | Mauvais nom ou mot de passe, ou réseau 5 GHz | Vérifie `config.h` et utilise un réseau 2,4 GHz |
| « passerelle introuvable » | `bridge.py` n'est pas lancé, mauvaise IP, ou pare-feu | Ouvre `http://IP:8787/health` sur ton téléphone |
| « Jeton refusé » | `PET_TOKEN` différent entre la montre et `.env` | Mets la même valeur aux deux endroits |
| « Hermes injoignable » | `hermes gateway` n'est pas lancé | Relance-le (étape 1) |
| « Hermes a répondu 401 » | Mauvaise clé Hermes | `HERMES_API_KEY` doit être égal à `API_SERVER_KEY` |
| Réponse tronquée ou trop longue | Hermes est trop bavard | Ajuste `PET_SYSTEM_PROMPT` dans `.env` |

---

## Limites connues

- Le firmware **compile**, mais il n'a **pas encore été testé sur une vraie montre** : le dessin,
  le micro et les boutons sont à vérifier à la réception.
- La montre attend la réponse 60 secondes au maximum. Si Hermes utilise beaucoup d'outils, ça peut
  ne pas suffire.
- L'animal **affiche** la réponse mais ne la **prononce** pas encore : la synthèse vocale serait une
  bonne prochaine étape.
- La passerelle doit rester lancée. Pour qu'elle démarre toute seule avec l'ordinateur, il faut en faire
  un service : `launchd` sur Mac, `systemd` sur Linux.
