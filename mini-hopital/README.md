# Mini Hôpital

Un jeu de gestion des flux patients dans l’esprit de *Mini Metro* et *Mini Motorways*, transposé à l’hôpital.
Les services sont des stations, les circuits de brancardage sont des lignes et les brancardiers font la navette.

Pour jouer, ouvrez `index.html` dans un navigateur. Il n’y a rien à installer ni à compiler.

## Principe

- **Services** : Urgences, Consultation (auscultation), Imagerie, Bloc opératoire, Salle de réveil (SSPI), Hospitalisation, Réanimation, Isolement, Médecine nucléaire et Radiopharmacie. Ils ouvrent au fil de la garde, et le bâtiment s’agrandit.
- **Patients** : chaque patient suit un parcours de soins (par exemple *Polytraumatisé* : Imagerie, Bloc, SSPI, Réanimation). Il affiche la forme du service de sa prochaine étape, et sa couleur indique son niveau de tri.
- **Tri** : urgence vitale, urgence, semi-urgent, programmé. Chacun a un délai. Les urgences vitales montent en premier dans les brancards et passent en premier dans les files de soins. Si une urgence vitale ou une urgence dépasse son délai, c’est un incident grave. Au-delà, un patient semi-urgent ou programmé part sans soins.
- **Soins** : chaque service a des postes de soin (les arcs autour de l’icône) et une durée de prise en charge. La file de soins est à gauche du service, l’attente de brancardier à droite.
- **Circuit septique** : les patients contagieux (tuberculose, norovirus, BMR) ont un anneau vert en pointillé. Ils ne voyagent que sur ce circuit, ce qui évite toute contamination croisée.
- **Circuit radioprotégé** : la Radiopharmacie produit des doses de radiotraceur qui décroissent en 60 s. Elles doivent rejoindre la Médecine nucléaire par ce circuit. Sans dose, aucune TEP ni scintigraphie n’est possible. Un patient qui vient de passer son examen devient radioactif (anneau jaune) et ne repart que par ce circuit.
- **Fin de semaine** : vous recevez un brancardier, et vous choisissez une ressource parmi deux (nouveau circuit, renfort d’équipe, salle d’attente agrandie, chariot double…).
- **Fin de partie** : un service saturé trop longtemps (anneau rouge), ou trois incidents graves.

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
- `game.js` : tout le jeu. Les données d’équilibrage sont en tête de fichier : `TYPES` (services), `TRIAGE`, `TEMPLATES` (parcours de soins), `SCHEDULE` (ouvertures) et `UPGRADES`.

Les brancardiers choisissent leurs passagers par plus court chemin. Pour chaque catégorie de patient (standard, contagieux, radioactif, dose), un parcours en largeur calcule la distance en arrêts jusqu’au service voulu, en n’empruntant que les circuits autorisés. Un patient monte si l’arrêt suivant le rapproche de sa destination.

## Pistes

- Étages et ascenseurs, sur le modèle des tunnels de Mini Metro.
- Bionettoyage : après un patient contagieux, un service est indisponible quelques secondes.
- Fenêtres horaires du bloc programmé, et pics d’arrivées aux urgences (soirée, week-end).
- Brancardiers spécialisés : couché, assis, transport d’O₂.
- Laboratoire et pneumatiques pour les prélèvements, sur le modèle des doses.
- Plans d’hôpitaux réels et défis quotidiens.
