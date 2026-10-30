# Mini Hôpital

Un jeu de gestion des flux patients dans l’esprit de *Mini Metro* et *Mini Motorways*, transposé à l’hôpital.
Les services sont des stations, les circuits de brancardage sont des lignes et les brancardiers font la navette.

Pour jouer, ouvrez `index.html` dans un navigateur. Il n’y a rien à installer ni à compiler.

## Principe

- **Services** : Urgences, Consultation (auscultation), Imagerie, Bloc opératoire, Salle de réveil (SSPI), Hospitalisation, Réanimation, Isolement, Médecine nucléaire et Radiopharmacie ouvrent pendant la première semaine. Viennent ensuite des services spécialisés (voir *Extension de l’hôpital*).
- **Patients** : chaque patient suit un parcours de soins (par exemple *Polytraumatisé* : Imagerie, Bloc, SSPI, Réanimation, Hospitalisation). Il affiche la forme du service de sa prochaine étape, et sa couleur indique son niveau de tri.
- **Des histoires variées** : chaque motif d’arrivée et chaque diagnostic a plusieurs noms possibles (*Chute à vélo*, *Cheville tordue au sport*… puis *Fracture du col du fémur*, *Entorse*…). Le parcours reste le même, et la partie raconte une histoire différente à chaque fois.
- **Diagnostic** : beaucoup de patients ne connaissent que leur premier examen. Une *Douleur abdominale* passe en imagerie, qui révèle une appendicite (bloc), une occlusion (bloc puis réanimation, en urgence vitale) ou une colique néphrétique (consultation). Une *Toux fébrile* peut se révéler être une tuberculose : le patient devient contagieux en imagerie et doit rejoindre l’isolement par le circuit septique.
- **Aggravation** : un patient semi-urgent qui a attendu 70 % de son délai passe en urgence, avec un délai plus court.
- **Stabilisation** : après un soin au bloc, en salle de réveil, en réanimation, en coronarographie, en neurovasculaire, en ambulatoire, en isolement ou en maternité, le patient gagne un niveau de tri (jusqu’au semi-urgent). Son transfert en chambre est moins pressant.
- **Répartition** : quand plusieurs unités font la même chose, les patients visent la moins encombrée (le plus court chemin tient compte de la file d’attente de chaque unité).
- **Tri** : urgence vitale, urgence, semi-urgent, programmé. Chacun a un délai. Les urgences vitales montent en premier dans les brancards et passent en premier dans les files de soins. Si une urgence vitale ou une urgence dépasse son délai, c’est un événement indésirable grave (EIG). Au-delà, un patient semi-urgent ou programmé part sans soins.
- **Soins** : chaque service a des postes de soin (les petits lits sous le panneau) et une durée de prise en charge. La file de soins est à gauche du service, l’attente de brancardier à droite.
- **Circuit septique** : les patients contagieux (tuberculose, norovirus, BMR) ont un anneau vert en pointillé. Ils ne voyagent que sur ce circuit, ce qui évite toute contamination croisée.
- **Circuit radioprotégé** : il dessert la médecine nucléaire, au sous-sol. La Radiopharmacie produit des doses de radiotraceur qui décroissent en 60 s (une toutes les 6 s, deux en circulation par médecine nucléaire). Elles ne voyagent que par ce circuit, et sans dose aucune TEP ni scintigraphie n’est possible. Les patients qui vont en médecine nucléaire (les étoiles) peuvent emprunter ce circuit comme les circuits standard. Un patient qui vient de passer son examen devient radioactif (anneau jaune) : il emprunte ces deux circuits, mais **voyage seul**, sur son brancard comme dans l’ascenseur.
- **Patient sans itinéraire** : si un patient attend sans qu’aucun circuit ne mène à sa prochaine étape, la barre d’aide le signale (service de départ, étage, service à relier).
- **Fin de semaine** : vous recevez un brancardier, et vous choisissez une ressource parmi deux (passerelles, déménagements, renfort d’équipe, salle d’attente agrandie, chariot double, cabine ou ascenseur, circuit septique de plus).
- **Déménagement** : une ressource comme les passerelles (1 au départ, 2 de plus en fin de semaine). Elle déplace un service avec ses patients :
  - **sur le même étage**, ses circuits suivent la pièce, à condition de ne traverser aucun obstacle et de ne pas demander plus de passerelles ;
  - **vers un autre étage**, le service quitte ses circuits : ses voisins se rejoignent, ou le circuit est coupé si un obstacle les sépare.

  Un aperçu vert ou rouge montre si l’emplacement convient. Les paliers d’ascenseur ne se déplacent pas.
- **Fin de partie** : un service saturé trop longtemps (anneau rouge), ou trois EIG.
- **Rapport de fin de garde** : il montre comment l’hôpital a été sollicité, avec les durées en heures d’horloge du jeu (une journée de 24 h dure 20 s) :
  - quatre chiffres clés : patients pris en charge sur le nombre d’arrivées, séjour moyen, pic de charge, service le plus sollicité ;
  - la courbe des patients en attente au fil de la garde, avec en repères les ouvertures d’étage, le plan blanc et les EIG (triangles), et une infobulle détaillant la gravité à chaque instant ;
  - les passages par service, et l’attente cumulée par service en heures-patients, où le goulot d’étranglement ressort en couleur ;
  - la gravité à l’arrivée, en barre segmentée ;
  - une synthèse qui liste chaque EIG (patient, service attendu, étage, heure), et un tableau de données pour chaque graphique.

  La gravité y suit une rampe d’une seule teinte, plus foncée pour l’urgence vitale (vérifiée pour les daltoniens). Les couleurs de tri du plan, trop proches entre orange et jaune, ne servent pas dans les graphiques. Le bandeau affiche le niveau de tension : activité normale, tension, puis plan blanc.

## Étages et ascenseurs

L’hôpital compte jusqu’à quatre niveaux, chacun avec son plan. Chaque service ouvre à son étage d’affectation, ou au rez-de-chaussée si cet étage n’existe pas encore :

| Niveau | Rôle | Services |
| --- | --- | --- |
| 2 | Hospitalisation | Hospitalisation, Maternité, Unité neurovasculaire |
| 1 | Plateau technique | Bloc, Salle de réveil, Réanimation, Coronarographie |
| RDC | Accueil, urgences et imagerie | Urgences, Consultations, Imagerie, Isolement, Ambulatoire |
| -1 | Plateau de médecine nucléaire | Médecine nucléaire, Radiopharmacie (et le bunker de radiothérapie) |

- **Ouverture** : le rez-de-chaussée seul pendant la première semaine, puis le 1er étage (vers 2 min 15, avec la Réanimation), le sous-sol (vers 3 min 25) et le 2e étage (vers 4 min 35). Le bloc et la salle de réveil ouverts la première semaine restent au rez-de-chaussée ; les suivants montent au 1er.
- **Vue** : on voit un niveau à la fois. La colonne *Niveaux*, à gauche, affiche chaque étage avec le nombre de patients en attente, un voyant orange (tension) ou rouge clignotant (saturation), et les cabines présentes. Les flèches haut et bas du clavier changent aussi d’étage.
- **Ascenseurs** : les cages d’ascenseurs du plan deviennent de vrais ascenseurs. Chaque cage a un palier à chaque niveau, et deux cabines au départ qui font la navette automatiquement, comme une ligne verticale. Les circuits restent sur leur étage et s’arrêtent au palier, où les patients changent de niveau. Le palier a une salle d’attente qui peut saturer.
- **Une seule règle de plus** : un patient contagieux ou radioactif monte seul dans la cabine, et la cabine est nettoyée pendant 6 s après un contagieux.
- **Ressources de fin de semaine** : cabine supplémentaire (à poser sur un palier) et nouvel ascenseur (une autre cage mise en service à tous les niveaux).
- **Calcul des trajets** : un étage d’ascenseur coûte 1,5 arrêt dans le calcul des plus courts chemins. Les patients préfèrent donc une unité du même étage quand il y en a une.

## Extension de l’hôpital

Après la première semaine, l’hôpital s’agrandit toutes les 40 s, selon la tension mesurée (patients en attente rapportés à la capacité de soin de chaque type de service) :

1. si le service le plus sous tension peut être soulagé par un service spécialisé, celui-ci ouvre :
   - l’**Unité neurovasculaire** prend les AVC à la place de la réanimation ;
   - la **Chirurgie ambulatoire** prend la chirurgie programmée à la place du bloc et de la salle de réveil ;
   - la **Coronarographie** prend les infarctus.
2. une extension sur trois est un nouveau secteur qui amène des patients (Consultations, Hospitalisation, Urgences, **Maternité** et ses propres parcours) ;
3. sinon, ouvre une spécialité pas encore présente, ou une unité supplémentaire du service le plus chargé.

Les nouveaux services se placent à leur étage d’affectation, loin des existants, vers les nouvelles ailes. Chaque ouverture apporte un brancardier.

**Circuits** : leur nombre suit la taille de l’hôpital. On démarre avec 3 circuits standard, puis on en gagne un tous les 3 services (jusqu’à 7), chacun avec son brancardier.

## Obstacles

Le plan comporte des obstacles fixes, que l’agrandissement du bâtiment découvre peu à peu :

- **Patio** : jardin au rez-de-chaussée, vide sur patio aux étages, absent du sous-sol. Un circuit peut le franchir par une passerelle. On en a 2 au départ, et chaque franchissement en consomme une. Le compteur est en bas de l’écran.
- **Noyau d’ascenseurs** : présent à tous les niveaux et infranchissable. Certains deviennent des ascenseurs, avec un palier réservé juste en dessous.
- **Bunker de radiothérapie** : au sous-sol, infranchissable.

Un tracé bloqué s’affiche en pointillé rouge, et il faut passer par un autre service.

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
| Choisir le circuit à prolonger | Maintenir l’appui sur un service ou sur des extrémités en T superposées : un sélecteur circulaire affiche tous les circuits qui s’y terminent et un « + » pour un nouveau circuit. Glisser vers une pastille, puis continuer vers le service à relier (relâcher sur la pastille la sélectionne seulement) |
| Déménager un service | Toucher le compteur *Déménager*, puis le service, puis faire glisser sa pièce au nouvel emplacement, au besoin après avoir changé d’étage |
| Faire passer un circuit par un service | Glisser un tronçon sur le service |
| Boucler | Revenir sur le premier service |
| Choisir le type de circuit | Toucher une pastille libre dans la palette |
| Ajouter un brancardier | Faire glisser un brancard depuis la case *Réserve* et le déposer sur un circuit, à l’endroit où il doit démarrer (le circuit visé s’illumine) |
| Déplacer ou retirer un brancardier | Attraper un brancard en route : le déposer ailleurs sur son circuit ou sur un autre (ses patients descendent au service vers lequel il roulait), ou hors circuit pour le remettre en réserve. Un simple toucher ouvre la fiche de son circuit |
| Gérer brancardiers ou supprimer un circuit | Toucher une pastille utilisée |
| Voir l’activité d’un service | Toucher le service |
| Changer d’étage | Toucher un niveau dans la colonne de gauche, ou flèches haut et bas |
| Pause, vitesse | Espace, 1, 2 |

## Organisation du code

- `index.html` : la page, l’interface et les jetons de couleur (thèmes clair et sombre).
- `game.js` : tout le jeu. Les données d’équilibrage sont en tête de fichier : `TYPES` (services), `TRIAGE`, `STABILIZE`, `TEMPLATES` (parcours de soins, noms et diagnostics), `FLOORS` et `FLOOR_OF` (étages), les constantes `LIFT_*` (ascenseurs), `SCHEDULE` (ouvertures guidées), `SPECIALS` (services spécialisés et ce qu’ils soulagent), `OBSTACLES` et `UPGRADES`.

Les brancardiers choisissent leurs passagers par plus court chemin. Pour chaque catégorie de patient (standard, contagieux, radioactif, dose) et chaque type de service, un algorithme de Dijkstra calcule le coût en arrêts jusqu’au service voulu, en n’empruntant que les circuits autorisés. Le coût de départ de chaque unité augmente avec sa file d’attente. Ces distances sont recalculées chaque seconde. Un patient monte si l’arrêt suivant est sur un plus court chemin. Une petite marge lui évite de descendre à chaque variation d’encombrement.

## Pistes

- Bionettoyage : après un patient contagieux, un service est indisponible quelques secondes.
- Fenêtres horaires du bloc programmé, et pics d’arrivées aux urgences (soirée, week-end).
- Brancardiers spécialisés : couché, assis, transport d’O₂.
- Laboratoire et pneumatiques pour les prélèvements, sur le modèle des doses.
- Plans d’hôpitaux réels et défis quotidiens.
