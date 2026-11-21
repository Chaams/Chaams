# Paraphe — générateur de signatures email gratuit

Site statique (HTML/CSS/JS, aucune dépendance, aucun compte) :

- **10 modèles** originaux (tableaux + styles inline, compatibles Gmail / Outlook / Apple Mail)
- Éditeur en direct : identité, contact, réseaux, photo/logo (URL), couleur, police
- **Copier la signature** (HTML riche), copier le code HTML, télécharger `.html`
- **Kits de marque** : enregistrer un style (couleur, police, entreprise, logo, site, modèle), l'appliquer, l'exporter/importer en JSON
- Données stockées uniquement dans le navigateur (localStorage)

## Lancer en local
Ouvrir `index.html` dans un navigateur.

## Mettre en ligne (gratuit) avec GitHub Pages
1. Fusionner dans `main`.
2. GitHub → *Settings* → *Pages* → *Source* : **GitHub Actions**.
3. Le workflow `.github/workflows/paraphe-pages.yml` publie le dossier `paraphe/`.
   URL : `https://chaams.github.io/Chaams/`

## Ajouter un modèle
Dans `templates.js`, appeler `add(id, nom, catégorie, (p) => \`...html...\`)`.
Toujours passer les valeurs utilisateur par `p.esc()`.
