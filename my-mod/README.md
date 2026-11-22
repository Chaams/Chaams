# my-mod

Mod de départ pour Claude Code. Il montre les trois briques de base d'un mod :

- **Commande `/my-mod`** : répond « Bonjour depuis my-mod ! » et affiche un toast.
- **Ligne de statut** : après chaque appel à l'outil Bash, affiche la commande lancée, précédée de ✓ si elle a réussi ou de ✗ si elle a échoué.
- **Hook sur les appels d'outils** : sert de modèle pour bloquer, réécrire ou observer un appel.

## Utilisation

```sh
claude plugin validate ./my-mod
claude --plugin-dir ./my-mod
```

Le code se trouve dans `hooks/register.ts`. Aucune configuration n'est nécessaire.
