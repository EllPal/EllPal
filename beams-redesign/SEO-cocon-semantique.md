# Beams · TRIOP — Passe SEO et cocon sémantique

Document de travail pour la refonte de beams.bio. Il accompagne les maquettes (Proposition 3).

Les mots-clés sont classés par **priorité qualitative**. Les volumes de recherche, la difficulté et la concurrence restent à mesurer avec un outil dédié (Google Keyword Planner, Semrush ou Ahrefs) avant de figer les choix. Aucun chiffre de volume n'est inventé ici.

---

## 1. Objectifs et publics

| Public | Ce qu'il cherche | Pages qui répondent |
|---|---|---|
| Chirurgiens oncologues, neurochirurgiens | Comprendre la détection peropératoire, les marges, l'intérêt clinique | Technologie, Marges chirurgicales, Indications |
| Centres hospitaliers, CHU, investigateurs | Participer aux essais cliniques | Clinique, Contact (partenariat) |
| Industriels, investisseurs | Maturité, équipe, distinctions | Entreprise, Équipe, Actualités |
| Presse | Logos, communiqués, contacts | Média, Actualités |
| Candidats | Postes, culture, équipe | Recrutement, Équipe |
| Patients et proches (secondaire) | Comprendre « marges », « R0 », « récidive » | Glossaire, Marges chirurgicales |

**Règle réglementaire.** TRIOP est un dispositif en investigation clinique. Les contenus doivent rester informatifs et scientifiques : aucune promesse de résultat, aucune allégation de performance non démontrée. La mention « Dispositif en cours d'investigation clinique » doit figurer sur les pages produit. La publicité pour les dispositifs médicaux est encadrée en France : faites valider les contenus par la personne en charge des affaires réglementaires.

---

## 2. Champs sémantiques (clusters)

### A. Le problème : marges et récidive
- **Principal** : marges chirurgicales cancer · marge d'exérèse
- **Secondaires** : résection R0 · R1 · R2 · classification R UICC · résidu tumoral · marges positives · récidive locale · reprise chirurgicale · réintervention après tumorectomie · exérèse complète
- **Longue traîne** : « que veut dire R0 en chirurgie » · « marge positive après opération cancer » · « taux de reprise chirurgie conservatrice du sein »

### B. La solution : détection peropératoire radioguidée
- **Principal** : sonde peropératoire · détection peropératoire des tumeurs
- **Secondaires** : chirurgie radioguidée · sonde bêta · détection de positons · radiotraceur · 18F-FDG · scintillateur · détection en temps réel · aspirateur chirurgical · chirurgie guidée
- **Longue traîne** : « sonde bêta vs sonde gamma » · « comment détecter les cellules tumorales pendant l'opération » · « détection des résidus tumoraux en temps réel »

### C. Les indications (8 cibles)
| Cible | Mots-clés associés |
|---|---|
| Tumeurs cérébrales | exérèse des gliomes · glioblastome étendue de résection · neurochirurgie oncologique |
| Tumeurs du foie | résection hépatique · métastases hépatiques · carcinome hépatocellulaire chirurgie |
| ORL – cavité buccale antérieure | cancer de la cavité buccale marges · carcinome épidermoïde de la langue chirurgie |
| Pancréas | duodénopancréatectomie marges · adénocarcinome pancréatique R1 |
| Sein | chirurgie conservatrice du sein · tumorectomie reprise de marges |
| Voies biliaires périhilaires | cholangiocarcinome périhilaire · tumeur de Klatskin résection |
| Sarcome superficiel | sarcome des tissus mous marges · exérèse sarcome |
| Vulve | cancer de la vulve chirurgie · vulvectomie marges |

### D. Marque et entreprise
Beams · TRIOP · sonde TRIOP · Beams medtech · spin-off CNRS · IJCLab · Paris-Saclay · deeptech santé · medtech oncologie France

### E. Conversion
partenariat clinique · essai clinique sonde peropératoire · investir medtech oncologie · emploi physicien medtech · ingénieur instrumentation nucléaire

---

## 3. Architecture du cocon

Chaque **page mère** porte un champ sémantique et ne lie que vers ses **pages filles**, ses **pages sœurs** directes et le niveau supérieur. Les liens transversaux entre cocons passent par les pages mères.

```
/                                  Accueil — « sonde peropératoire de détection des résidus tumoraux »
├── /technologie/                  MÈRE — « détection peropératoire radioguidée »
│   ├── /technologie/sonde-triop/            « sonde TRIOP »
│   ├── /technologie/detection-beta/         « sonde bêta peropératoire », « chirurgie radioguidée »
│   ├── /technologie/scintillateurs/         « scintillateur », « détection directionnelle »
│   ├── /technologie/radiotraceurs/          « radiotraceur », « 18F-FDG chirurgie »
│   └── /technologie/demonstration/          simulateur interactif
├── /marges-chirurgicales/         MÈRE — « marges chirurgicales cancer »
│   ├── /marges-chirurgicales/resection-r0-r1-r2/    « résection R0 »
│   ├── /marges-chirurgicales/recidive-locale/       « récidive locale après chirurgie »
│   └── /marges-chirurgicales/reprise-chirurgicale/  « reprise chirurgicale marges »
├── /indications/                  MÈRE — « détection peropératoire par type de cancer »
│   ├── /indications/tumeurs-cerebrales/
│   ├── /indications/tumeurs-du-foie/
│   ├── /indications/cavite-buccale/
│   ├── /indications/pancreas/
│   ├── /indications/sein/
│   ├── /indications/voies-biliaires-perihilaires/
│   ├── /indications/sarcome-superficiel/
│   └── /indications/vulve/
├── /clinique/                     Essais et validation (préclinique, vétérinaire, humain)
├── /glossaire/                    R0, marge d'exérèse, positon, scintillateur, radiotraceur…
└── /entreprise/                   MÈRE marque
    ├── /equipe/
    ├── /actualites/  →  /actualites/{article}/
    ├── /media/
    ├── /recrutement/
    └── /contact/
```

**Version anglaise** : la même arborescence sous `/en/`, avec des balises `hreflang` réciproques (`fr`, `en`, `x-default`).

**Migration** : il faut des redirections 301 des anciennes URL Wix `/post/…` vers `/actualites/…` et de `/about` vers `/entreprise/` ou `/equipe/`, pour conserver les positions acquises.

---

## 4. Fiches de pages prioritaires

| URL | H1 | Balise title (≤ 60 car.) | Meta description (≤ 155 car.) |
|---|---|---|---|
| `/` | Sonde peropératoire de détection des résidus tumoraux — Retirer toute la tumeur. Rien de plus. | TRIOP, sonde peropératoire de détection tumorale \| Beams | Beams développe TRIOP, une sonde qui détecte en temps réel les résidus tumoraux grâce aux particules bêta, pour viser une résection R0. |
| `/technologie/` | La détection peropératoire radioguidée | Détection peropératoire radioguidée : la technologie TRIOP | Radiotraceur, particules bêta, six scintillateurs et aspiration : comment TRIOP signale le tissu tumoral au contact, pendant l'opération. |
| `/technologie/detection-beta/` | Pourquoi détecter les particules bêta ? | Sonde bêta peropératoire : principe et intérêt \| Beams | Portée millimétrique, compensation du gamma ambiant, directionnalité : le principe de la détection bêta en chirurgie oncologique. |
| `/marges-chirurgicales/` | Marges chirurgicales : tout se joue à la marge | Marges chirurgicales en cancérologie : enjeux et chiffres | Marges positives, résidu tumoral, récidive locale, reprise chirurgicale : ce que disent les données, cancer par cancer. |
| `/marges-chirurgicales/resection-r0-r1-r2/` | Résection R0, R1, R2 : définitions | Résection R0, R1, R2 : la classification R expliquée | Définition de la classification R de l'UICC, différence entre résidu microscopique et macroscopique, et impact pronostique. |
| `/indications/` | Huit cibles, un même principe | Indications de la sonde TRIOP par type de cancer | Tumeurs cérébrales, foie, cavité buccale, pancréas, sein, voies biliaires, sarcome, vulve : les cibles étudiées pour TRIOP. |
| `/indications/sein/` | Chirurgie conservatrice du sein et marges | Chirurgie conservatrice du sein : marges et reprise | Près d'une patiente sur quatre est réopérée pour reprise de marges : l'enjeu de la détection peropératoire en sénologie. |
| `/equipe/` | Les personnes derrière TRIOP | Équipe et fondateurs de Beams \| Beams | Physique des particules, neurochirurgie, ingénierie : les fondateurs et l'équipe de la spin-off du CNRS qui développe TRIOP. |
| `/actualites/` | Les nouvelles de Beams | Actualités : distinctions, presse et essais de TRIOP | Distinctions, articles de presse, événements et avancées cliniques de Beams et de la sonde TRIOP. |
| `/media/` | Tout pour parler de Beams | Kit média : logos, guidelines et presse \| Beams | Logos Beams en SVG et PNG, guidelines de marque, couleurs et documents de presse à télécharger. |
| `/contact/` | Parlons de TRIOP. Ou rejoignez-nous. | Contact, partenariats et recrutement \| Beams | Centres hospitaliers, industriels, investisseurs, candidats : contactez Beams pour un partenariat ou pour rejoindre l'équipe. |

Les 7 autres pages d'indication suivent le même modèle :
- **H1** : « [Cancer] : marges et détection peropératoire » ;
- **contenu** : enjeu des marges pour ce cancer, données sourcées, place possible de TRIOP (sans allégation), lien vers `/technologie/detection-beta/` et vers `/marges-chirurgicales/resection-r0-r1-r2/`.

---

## 5. Maillage interne

1. **Accueil** : un lien vers chaque page mère (Technologie, Marges, Indications, Clinique, Entreprise), et uniquement vers elles.
2. **Pages mères** : un lien vers chacune de leurs filles, plus un bloc « Pour aller plus loin » vers une autre page mère, choisie pour sa proximité de sujet.
3. **Pages filles** : un lien vers leur mère, vers les deux sœurs les plus proches, et au plus un lien vers une fille d'un autre cocon, s'il est très pertinent (exemple : `/indications/sein/` → `/marges-chirurgicales/reprise-chirurgicale/`).
4. **Ancres** : elles décrivent la page cible (« résection R0 », « sonde bêta peropératoire »). Jamais « en savoir plus » seul.
5. **Articles d'actualité** : chacun lie vers 1 ou 2 pages du cocon concerné (exemple : un article sur un essai clinique → `/clinique/` et l'indication étudiée).
6. **Glossaire** : chaque terme technique est lié à sa définition à sa première occurrence dans une page.

---

## 6. Ce qui est déjà appliqué dans les maquettes

- **Balises `<title>` et meta description** réécrites pour l'accueil, l'équipe, le contact, les actualités et le kit média.
- **H1 de l'accueil** : il porte maintenant le mot-clé principal (« Sonde peropératoire de détection des résidus tumoraux »), visible au-dessus du slogan.
- **Hiérarchie des titres** : la phrase de « Le constat » devient un H2, et « R0, R1, R2 : ce que dit la marge » un H3.
- **Texte d'introduction** du hero : il contient « chirurgie oncologique » et « résection complète ».
- **Étiquette de section** « Chirurgie radioguidée par détection β » sur la section technologie.
- **Section « Le constat » enrichie** :
  - définitions R0/R1/R2 ;
  - quatre chiffres sourcés (marges positives, reprise après chirurgie du sein, cavité buccale, sarcomes) ;
  - les sources sont liées.
- **FAQ de 6 questions** (balises `<details>` natives, accessibles), prête pour des données structurées `FAQPage`.
- **Ancres de liens internes** descriptives (« Toutes les actualités », « Toute l'équipe », « Kit média »).

---

## 7. Données structurées (JSON-LD)

À placer dans le `<head>` du site en production. Les maquettes ne les contiennent pas.

**Organisation** (toutes les pages)
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Beams",
  "url": "https://www.beams.bio/",
  "logo": "https://www.beams.bio/media/beams-logo-couleur.svg",
  "description": "Medtech issue du CNRS (IJCLab, Université Paris-Saclay) qui développe TRIOP, une sonde peropératoire de détection des résidus tumoraux.",
  "foundingDate": "2021",
  "founder": [
    {"@type": "Person", "name": "Virginie Simon"},
    {"@type": "Person", "name": "Estelle Villedieu de Torcy"},
    {"@type": "Person", "name": "Stéphane Palfi"},
    {"@type": "Person", "name": "Laurent Ménard"}
  ],
  "sameAs": ["https://fr.linkedin.com/company/beams-bio"]
}
```

**Dispositif** (page Technologie et page Sonde TRIOP). Google n'affiche pas de résultat enrichi pour le type `MedicalDevice` : il sert surtout à décrire le produit aux moteurs. Validez le balisage avec le validateur de schema.org.
```json
{
  "@context": "https://schema.org",
  "@type": "MedicalDevice",
  "name": "TRIOP",
  "manufacturer": {"@type": "Organization", "name": "Beams"},
  "description": "Sonde chirurgicale associant un détecteur de particules bêta et un aspirateur, en cours d'investigation clinique.",
  "relevantSpecialty": "Oncologic"
}
```

**FAQ** (accueil) : un `FAQPage` avec les 6 questions et réponses de la section FAQ. Le texte doit être strictement identique à celui affiché.

**Articles** (actualités) : un `NewsArticle` par article, avec `headline`, `datePublished`, `image`, `author` et `publisher`.

**Personnes** (équipe) : un `Person` par membre, avec `jobTitle`, `worksFor` et `sameAs` (LinkedIn).

---

## 8. Technique

- **Rendu** : le contenu doit être en HTML rendu côté serveur ou statique. Les sections animées et le simulateur ne doivent pas masquer le texte aux robots.
- **Performance** (Core Web Vitals) :
  - charger le simulateur en différé, à l'arrivée de la section à l'écran ;
  - réserver la hauteur des blocs animés pour éviter les décalages de mise en page (CLS) ;
  - images en AVIF/WebP ;
  - polices Jost en `font-display: swap`.

  Les animations respectent déjà `prefers-reduced-motion`.
- **Indexation** : `sitemap.xml`, `robots.txt`, une balise `canonical` par page, `hreflang` fr/en, redirections 301 depuis les anciennes URL.
- **Images** : nom de fichier et texte `alt` descriptifs (exemple : `sonde-triop-embout-aspiration.webp` → « Embout de la sonde TRIOP, détection et aspiration »).
- **Accessibilité** : elle sert aussi le SEO. Contrastes AA, une seule balise H1 par page, des liens explicites.

---

## 9. Plan éditorial (contenus piliers)

| # | Contenu | Cocon | Mot-clé visé |
|---|---|---|---|
| 1 | Résection R0, R1, R2 : la classification R expliquée | Marges | résection R0 |
| 2 | Marges positives : les chiffres, cancer par cancer | Marges | marges positives cancer |
| 3 | Sonde gamma ou sonde bêta : quelle différence en chirurgie radioguidée ? | Technologie | sonde bêta peropératoire |
| 4 | Comment fonctionne un scintillateur ? | Technologie | scintillateur détection |
| 5 | Chirurgie conservatrice du sein : pourquoi tant de reprises ? | Indications | reprise chirurgicale sein |
| 6 | Glioblastome : l'étendue de la résection et ses enjeux | Indications | glioblastome résection |
| 7 | Du laboratoire au bloc : l'histoire de TRIOP | Entreprise | TRIOP Beams |
| 8 | Essais cliniques TRIOP : où en sommes-nous ? | Clinique | essai clinique sonde peropératoire |

---

## 10. Sources des chiffres utilisés sur le site

1. Orosco R.K. et al., *Positive Surgical Margins in the 10 Most Common Solid Cancers*, Scientific Reports, 2018 — https://www.nature.com/articles/s41598-018-23403-5
2. McCahill L.E. et al., JAMA 2012;307:467-75 (re-excision après chirurgie conservatrice du sein) — https://mdedge.com/hematology-oncology/article/47273/oncology/re-excision-rates-after-breast-conserving-surgery-vary
3. Méta-analyse, marges et survie dans les cancers de la cavité buccale, 2025 — https://pubmed.ncbi.nlm.nih.gov/40400374/
4. Sarcomes des tissus mous, systèmes de classification des marges et récidive — https://www.cancernetwork.com/view/soft-tissue-sarcoma-margin-classifying-systems-can-differ-determining-recurrence-risk
5. Classification R (résidu tumoral) — https://radiopaedia.org/articles/residual-tumour-classification

Les chiffres doivent être relus par l'équipe médicale avant publication. Les définitions d'une marge positive varient selon l'organe et le référentiel (0 mm ou 1 mm).
