# Site Beams — export statique (Proposition 3)

Ce dossier contient un site en HTML/CSS/JS, sans dépendance, prêt à déposer sur n'importe quel hébergement statique : Netlify, Vercel, OVH, GitHub Pages, ou le serveur de votre choix.

## Pages

| Fichier | Page |
|---|---|
| `index.html` | Accueil |
| `equipe.html` | Équipe |
| `actualites.html` | Actualités |
| `media.html` | Kit média |
| `contact.html` | Contact et recrutement |

Toutes les pages sont reliées entre elles : menu, pied de page et boutons.

## Structure

```
assets/css/      une feuille de style par page
assets/js/       beams.js (interactions) · triop-simulateur.js (simulateur TRIOP)
assets/logos/    logos SVG et PNG
assets/img/      visuel de la sonde
assets/docs/     guidelines de marque (PDF)
```

## Interactions

- **Survol** : lumière qui suit le curseur sur les cartes, léger décalage du hero, scintillateurs qui s'illuminent (CSS).
- **États interactifs** : les onglets du contact, les filtres des actualités et la copie des couleurs sont pré-rendus dans la page. `beams.js` les échange au clic.
- **Simulateur** : composant web autonome (`<triop-simulateur>`), chargé uniquement sur l'accueil.
- **Mouvement réduit** : les animations respectent la préférence système « réduire les animations ».

## À brancher avant la mise en ligne

- **Formulaire de contact** : il n'envoie rien pour l'instant. Branchez un service (Formspree, Netlify Forms, ou votre back-office) et un vrai `<form action>`.
- **Contenus entre crochets** à remplacer : photos de l'équipe, e-mails, adresse, documents de presse, articles à confirmer.
- **Données structurées (JSON-LD)**, `sitemap.xml`, `robots.txt`, balises `canonical` et `hreflang` : voir `SEO-cocon-semantique.md`.
- **Polices** : Jost est chargée depuis Google Fonts. Pour l'héberger vous-même, téléchargez-la et remplacez le lien dans le `<head>` de chaque page.

## Regénérer l'export

Depuis `export/tools/` :

```
npm install
node build.mjs
```

Le script relit les maquettes de `beams-redesign/project/` et réécrit `export/site/`.
