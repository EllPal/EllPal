# Mini Hôpital

Un jeu de gestion des flux patients dans l’esprit de *Mini Metro* et *Mini Motorways*, transposé à l’hôpital.
Les services sont des stations, les circuits de brancardage sont des lignes et les brancardiers font la navette.

Pour jouer, ouvrez `index.html` dans un navigateur. Il n’y a rien à installer ni à compiler.

## Principe

- **Services** : Urgences, Consultation (auscultation), Imagerie, Bloc opératoire, Salle de réveil (SSPI), Hospitalisation, Réanimation, Isolement, Médecine nucléaire et Radiopharmacie ouvrent pendant la première semaine. Viennent ensuite des services spécialisés (voir *Extension de l’hôpital*).
- **Patients** : chaque patient suit un parcours de soins (par exemple *Polytraumatisé* : Imagerie, Bloc, SSPI, Réanimation, Hospitalisation). Il affiche la forme du service de sa prochaine étape, et sa couleur indique son niveau de tri.
- **Diagnostic** : beaucoup de patients ne connaissent que leur premier examen. Une *Douleur abdominale* passe en imagerie, qui révèle une appendicite (bloc), une occlusion (bloc puis réanimation, en urgence vitale) ou une colique néphrétique (consultation). Une *Toux fébrile* peut se révéler être une tuberculose : le patient devient contagieux en imagerie et doit rejoindre l’isolement par le circuit septique.
- **Aggravation** : un patient semi-urgent qui a attendu 70 % de son délai passe en urgence, avec un délai plus court.
- **Répartition** : quand plusieurs unités font la même chose, les patients visent la moins encombrée (le plus court chemin tient compte de la file d’attente de chaque unité).
- **Tri** : urgence vitale, urgence, semi-urgent, programmé. Chacun a un délai. Les urgences vitales montent en premier dans les brancards et passent en premier dans les files de soins. Si une urgence vitale ou une urgence dépasse son délai, c’est un événement indésirable grave (EIG). Au-delà, un patient semi-urgent ou programmé part sans soins.
- **Soins** : chaque service a des postes de soin (les petits lits sous le panneau) et une durée de prise en charge. La file de soins est à gauche du service, l’attente de brancardier à droite.
- **Circuit septique** : les patients contagieux (tuberculose, norovirus, BMR) ont un anneau vert en pointillé. Ils ne voyagent que sur ce circuit, ce qui évite toute contamination croisée.
- **Circuit radioprotégé** : la Radiopharmacie produit des doses de radiotraceur qui décroissent en 60 s. Elles doivent rejoindre la Médecine nucléaire par ce circuit. Sans dose, aucune TEP ni scintigraphie n’est possible. Un patient qui vient de passer son examen devient radioactif (anneau jaune) et ne repart que par ce circuit.
- **Fin de semaine** : vous recevez un brancardier, et vous choisissez une ressource parmi deux (passerelles, renfort d’équipe, salle d’attente agrandie, chariot double, second circuit septique ou radioprotégé).
- **Fin de partie** : un service saturé trop longtemps (anneau rouge), ou trois EIG. Le bandeau affiche le niveau de tension : activité normale, tension, puis plan blanc.

## Extension de l’hôpital

Après la première semaine, l’hôpital s’agrandit toutes les 40 s, selon la tension mesurée (patients en attente rapportés à la capacité de soin de chaque type de service) :

1. si le service le plus sous tension peut être soulagé par un service spécialisé, celui-ci ouvre :
   - l’**Unité neurovasculaire** prend les AVC à la place de la réanimation ;
   - la **Chirurgie ambulatoire** prend la chirurgie programmée à la place du bloc et de la salle de réveil ;
   - la **Coronarographie** prend les infarctus.
2. une extension sur trois est un nouveau secteur qui amène des patients (Consultations, Hospitalisation, Urgences, **Maternité** et ses propres parcours) ;
3. sinon, ouvre une spécialité pas encore présente, ou une unité supplémentaire du service le plus chargé.

Les nouveaux services se placent loin des existants, vers les nouvelles ailes. Chaque ouverture apporte un brancardier.

**Circuits** : leur nombre suit la taille de l’hôpital. On démarre avec 3 circuits standard, puis on en gagne un tous les 3 services (jusqu’à 7), chacun avec son brancardier.

## Obstacles

Le plan comporte des obstacles fixes, que l’agrandissement du bâtiment découvre peu à peu :

- **Patio** : un circuit peut le franchir par une passerelle. On en a 2 au départ, et chaque franchissement en consomme une. Le compteur est en bas de l’écran.
- **Noyau d’ascenseurs** et **bunker de radiothérapie** : infranchissables. Un tracé bloqué s’affiche en pointillé rouge. Il faut passer par un autre service.

Entre deux services, le tracé choisit entre « droit puis diagonale » et « diagonale puis droit » celui qui évite les obstacles et franchit le moins de patios.

## Direction artistique

Le jeu emprunte trois registres d’un vrai hôpital :

- **Le plan d’architecte** : dalle, murs extérieurs doublés, trame structurelle en trait mixte avec axes repérés (A, B, C… / 1, 2, 3…), et une pièce par service avec sa porte, son débattement et son code de local (ex. `D5-02`).
- **La signalétique** : chaque service est un panneau à pictogramme blanc sur fond bleu (rouge pour les urgences, jaune et noir pour la radiopharmacie). Les circuits sont des bandes de guidage au sol, et les brancardiers des brancards vus de dessus. Les postes de soin sont dessinés comme des lits.
- **Le logiciel de régulation** : un bandeau façon dossier patient informatisé, avec un tracé ECG qui s’accélère avec la tension. Les notifications sont horodatées comme un journal, et les écrans prennent la forme de documents (fiche de prise de garde, commission des moyens, rapport de fin de garde, protocole).

## Commandes

| Action | Geste |
| --- | --- |
| Tracer un circuit | Glisser d’un service à l’autre (on peut en enchaîner plusieurs) |
| Prolonger ou raccourcir | Tirer l’extrémité en T, ou sélectionner le circuit dans la palette puis glisser depuis son terminus |
| Faire passer un circuit par un service | Glisser un tronçon sur le service |
| Boucler | Revenir sur le premier service |
| Choisir le type de circuit | Toucher une pastille libre dans la palette |
| Gérer brancardiers ou supprimer un circuit | Toucher une pastille utilisée |
| Voir l’activité d’un service | Toucher le service |
| Pause, vitesse | Espace, 1, 2 |

## Organisation du code

- `index.html` : la page, l’interface et les jetons de couleur (thèmes clair et sombre).
- `game.js` : tout le jeu. Les données d’équilibrage sont en tête de fichier : `TYPES` (services), `TRIAGE`, `TEMPLATES` (parcours de soins et diagnostics), `SCHEDULE` (ouvertures guidées), `SPECIALS` (services spécialisés et ce qu’ils soulagent), `OBSTACLES` et `UPGRADES`.

Les brancardiers choisissent leurs passagers par plus court chemin. Pour chaque catégorie de patient (standard, contagieux, radioactif, dose) et chaque type de service, un algorithme de Dijkstra calcule le coût en arrêts jusqu’au service voulu, en n’empruntant que les circuits autorisés. Le coût de départ de chaque unité augmente avec sa file d’attente. Ces distances sont recalculées chaque seconde. Un patient monte si l’arrêt suivant est sur un plus court chemin. Une petite marge lui évite de descendre à chaque variation d’encombrement.

## Pistes

- Étages : relier deux niveaux par les noyaux d’ascenseurs.
- Bionettoyage : après un patient contagieux, un service est indisponible quelques secondes.
- Fenêtres horaires du bloc programmé, et pics d’arrivées aux urgences (soirée, week-end).
- Brancardiers spécialisés : couché, assis, transport d’O₂.
- Laboratoire et pneumatiques pour les prélèvements, sur le modèle des doses.
- Plans d’hôpitaux réels et défis quotidiens.
