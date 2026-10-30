'use strict';
/*
 * Mini Hôpital — un jeu de gestion des flux patients dans l'esprit de Mini Metro.
 * Les services sont des stations, les circuits de brancardage sont des lignes,
 * les brancardiers sont les rames. Chaque patient suit un parcours de soins
 * (suite de services) et porte une urgence de tri qui fixe son délai.
 */
(() => {
  // ================================================================
  // Réglages
  // ================================================================
  const DAY = 20;                 // secondes de jeu par journée
  const WEEK = DAY * 7;
  const NODE_R = 17;
  const LINE_W = 7;
  const LINE_GAP = 9;
  const VEH_SPEED = 105;
  const VEH_CAP = 4;
  const OVERFLOW_LIMIT = 30;      // secondes de saturation tolérées
  const MAX_INCIDENTS = 3;
  const DOSE_LIFE = 60;           // durée de vie d'une dose de radiotraceur
  const DOSE_EVERY = 9;
  const MIN_SPACING = 115;
  const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  const TYPES = {
    URG:  { name: 'Urgences', abbr: 'URG', sign: 'URGENCES', shape: 'cross', proc: 0, slots: 0, cap: 8,
            desc: 'Arrivée des urgences. Les patients y sont triés par gravité.' },
    CONS: { name: 'Consultation', abbr: 'CONS', sign: 'CONSULTATIONS', shape: 'diamond', proc: 2.5, slots: 2, cap: 6,
            desc: 'Auscultation, examen clinique, avis spécialisé. Accueille aussi les patients programmés.' },
    IMG:  { name: 'Imagerie', abbr: 'IMG', sign: 'IMAGERIE', shape: 'circle', proc: 3, slots: 2, cap: 6,
            desc: 'Radiographie, scanner, IRM. Souvent l’étape qui pose le diagnostic.' },
    HOSP: { name: 'Hospitalisation', abbr: 'HOSP', sign: 'HOSPITALISATION', shape: 'square', proc: 1.2, slots: 3, cap: 6,
            desc: 'Admission en chambre. Les patients hospitalisés en partent aussi pour leurs examens.' },
    BLOC: { name: 'Bloc opératoire', abbr: 'BLOC', sign: 'BLOC OPÉRATOIRE', shape: 'triangle', proc: 6, slots: 1, cap: 6,
            desc: 'Chirurgie. Toujours suivie d’un passage en salle de réveil.' },
    SSPI: { name: 'Salle de réveil', abbr: 'SSPI', sign: 'SALLE DE RÉVEIL', shape: 'pentagon', proc: 4, slots: 2, cap: 6,
            desc: 'Surveillance post-interventionnelle après le bloc.' },
    ISO:  { name: 'Isolement', abbr: 'ISO', sign: 'ISOLEMENT', shape: 'hexagon', proc: 3, slots: 2, cap: 6,
            desc: 'Chambres à pression négative. Les patients contagieux n’y vont que par le circuit septique.' },
    RPH:  { name: 'Radiopharmacie', abbr: 'RPH', sign: 'RADIOPHARMACIE', shape: 'trefoil', proc: 0, slots: 0, cap: 99,
            desc: 'Prépare les doses de radiotraceur. Elles décroissent : livrez-les vite en médecine nucléaire par le circuit radioprotégé.' },
    MN:   { name: 'Médecine nucléaire', abbr: 'MN', sign: 'MÉD. NUCLÉAIRE', shape: 'star', proc: 3.5, slots: 1, cap: 6,
            desc: 'TEP et scintigraphie. Chaque examen consomme une dose ; le patient en ressort radioactif.' },
    REA:  { name: 'Réanimation', abbr: 'RÉA', sign: 'RÉANIMATION', shape: 'heart', proc: 4, slots: 2, cap: 6,
            desc: 'Défaillances vitales. Une fois stabilisés, les patients montent en hospitalisation.' },
    // Services spécialisés : ils ouvrent pour soulager un service sous tension.
    UNV:  { name: 'Unité neurovasculaire', abbr: 'UNV', sign: 'NEUROVASCULAIRE', shape: 'crescent', proc: 3, slots: 2, cap: 6,
            desc: 'Thrombolyse des AVC. Les AVC y vont plutôt qu’en réanimation.' },
    AMBU: { name: 'Chirurgie ambulatoire', abbr: 'AMBU', sign: 'AMBULATOIRE', shape: 'semicircle', proc: 4, slots: 2, cap: 6,
            desc: 'Opéré le matin, rentré le soir. Prend en charge la chirurgie programmée à la place du bloc et du réveil.' },
    CORO: { name: 'Coronarographie', abbr: 'CORO', sign: 'CORONAROGRAPHIE', shape: 'bolt', proc: 4, slots: 1, cap: 6,
            desc: 'Cardiologie interventionnelle : on y débouche l’artère d’un infarctus, sans passer par le bloc.' },
    // Palier d'ascenseur : point de correspondance entre les niveaux.
    ASC:  { name: 'Palier d’ascenseur', abbr: 'ASC', sign: 'ASCENSEUR', shape: 'lift', proc: 0, slots: 0, cap: 8,
            desc: 'Les patients y attendent une cabine pour changer de niveau. Contagieux et radioactifs voyagent seuls ; la cabine est nettoyée après un contagieux.' },
    MAT:  { name: 'Maternité', abbr: 'MAT', sign: 'MATERNITÉ', shape: 'drop', proc: 4, slots: 2, cap: 6,
            desc: 'Salles de naissance et suites de couches. Envoie aussi ses patientes au bloc et en imagerie.' },
  };

  const TRIAGE = {
    1: { name: 'Urgence vitale', patience: 70, color: 't1' },
    2: { name: 'Urgence', patience: 110, color: 't2' },
    3: { name: 'Semi-urgent', patience: 170, color: 't3' },
    4: { name: 'Programmé', patience: 250, color: 't4' },
  };
  const AGGRAVATION = 0.3;        // un semi-urgent qui a attendu 70 % de son délai passe en urgence
  // Après un soin dans ces services, le patient est stabilisé : il gagne un niveau de tri (jusqu'au semi-urgent).
  const STABILIZE = new Set(['BLOC', 'SSPI', 'REA', 'CORO', 'UNV', 'AMBU', 'ISO', 'MAT']);

  // Parcours de soins par service d'origine.
  //   name  : un nom, ou une liste dont l'un est tiré au hasard (même parcours, autre histoire).
  //   « A|B » : A si le service existe, sinon B.   « A? » : étape sautée si le service n'existe pas.
  //   paths : parcours alternatifs, le premier réalisable est retenu.
  //   then  : diagnostic posé à la fin du parcours connu, qui révèle la suite (vide : sortie).
  const TEMPLATES = {
    URG: [
      { name: ['Polytraumatisé', 'Accident de moto', 'Chute d’échafaudage', 'Défenestration', 'Piéton renversé', 'Accident de ski'],
        tri: 1, path: ['IMG', 'BLOC', 'SSPI', 'REA?', 'HOSP'], w: 2 },
      { name: ['Déficit brutal d’un bras', 'Trouble soudain de la parole', 'Paralysie faciale brutale', 'Céphalée en coup de tonnerre'],
        tri: 1, path: ['IMG'], w: 2, then: [
          { name: ['AVC ischémique', 'Infarctus cérébral', 'Occlusion carotidienne'], path: ['UNV|REA|HOSP', 'HOSP?'], w: 6 },
          { name: ['Hémorragie cérébrale', 'Hématome sous-dural', 'Rupture d’anévrisme'], path: ['BLOC', 'REA?', 'HOSP'], w: 2 },
          { name: ['Accident ischémique transitoire', 'Migraine avec aura', 'Hypoglycémie'], path: [], w: 2 },
        ] },
      { name: ['Douleur abdominale', 'Douleur de la fosse iliaque droite', 'Ventre de bois', 'Vomissements et fièvre', 'Douleur épigastrique'],
        tri: 2, path: ['IMG'], w: 4, then: [
          { name: ['Appendicite', 'Cholécystite', 'Hernie étranglée', 'Abcès appendiculaire'], path: ['BLOC', 'SSPI', 'HOSP'], w: 5 },
          { name: ['Occlusion intestinale', 'Péritonite', 'Volvulus', 'Perforation d’ulcère'], tri: 1, path: ['BLOC', 'SSPI', 'REA?', 'HOSP'], w: 2 },
          { name: ['Colique néphrétique', 'Pyélonéphrite', 'Gastrite aiguë', 'Constipation sévère'], path: ['CONS'], w: 3 },
          { name: ['Pancréatite aiguë', 'Diverticulite'], path: ['HOSP'], w: 2 },
        ] },
      { name: ['Douleur thoracique', 'Oppression thoracique', 'Palpitations', 'Essoufflement brutal'],
        tri: 2, path: ['CONS'], w: 4, then: [
          { name: ['Infarctus du myocarde', 'Syndrome coronarien aigu'], tri: 1, path: ['CORO|REA', 'HOSP'], w: 3 },
          { name: ['Embolie pulmonaire', 'Pneumothorax', 'Péricardite'], path: ['IMG', 'HOSP'], w: 3 },
          { name: ['Dissection aortique'], tri: 1, path: ['IMG', 'BLOC', 'REA?', 'HOSP'], w: 1 },
          { name: ['Douleur pariétale', 'Crise d’angoisse', 'Reflux gastro-œsophagien'], path: [], w: 4 },
        ] },
      { name: ['Chute dans l’escalier', 'Cheville tordue au sport', 'Chute à vélo', 'Douleur de hanche après une chute', 'Traumatisme du poignet'],
        tri: 3, path: ['IMG'], w: 4, then: [
          { name: ['Fracture du col du fémur', 'Fracture déplacée de l’avant-bras', 'Fracture de jambe'], path: ['BLOC', 'SSPI', 'HOSP'], w: 3 },
          { name: ['Fracture du poignet', 'Fracture de côte', 'Fracture du doigt'], path: ['CONS'], w: 5 },
          { name: ['Entorse', 'Contusion', 'Luxation réduite'], path: [], w: 3 },
        ] },
      { name: ['Toux fébrile', 'Fièvre et frissons', 'Toux qui traîne', 'Fièvre au retour de voyage'],
        tri: 3, path: ['IMG'], w: 3, then: [
          { name: ['Tuberculose pulmonaire', 'Légionellose', 'Grippe compliquée', 'Rougeole de l’adulte'], tri: 2, inf: true, path: ['ISO'], w: 3 },
          { name: ['Pneumopathie', 'Pleurésie', 'Bronchiolite du nourrisson'], path: ['HOSP'], w: 5 },
          { name: ['Infection virale bénigne', 'Bronchite aiguë'], path: [], w: 2 },
        ] },
      { name: ['Malaise', 'Perte de connaissance', 'Vertiges', 'Chute de la personne âgée', 'Fatigue intense'],
        tri: 3, path: ['CONS'], w: 3, then: [
          { name: ['Bilan cardiaque', 'Suspicion d’embolie'], path: ['IMG'], w: 3 },
          { name: ['Trouble du rythme', 'Déshydratation sévère', 'Anémie'], path: ['HOSP'], w: 3 },
          { name: ['Malaise vagal', 'Hypotension orthostatique', 'Crise de panique'], path: [], w: 4 },
        ] },
      { name: ['Intoxication médicamenteuse', 'Intoxication au monoxyde de carbone', 'Ivresse aiguë'],
        tri: 2, path: ['CONS'], w: 2, then: [
          { name: ['Surveillance prolongée'], path: ['HOSP'], w: 5 },
          { name: ['Intoxication grave', 'Coma toxique'], tri: 1, path: ['REA|HOSP', 'HOSP?'], w: 2 },
          { name: ['Retour à domicile après avis psychiatrique'], path: [], w: 3 },
        ] },
      { name: ['Plaie de la main', 'Morsure de chien', 'Plaie du cuir chevelu', 'Brûlure de l’avant-bras'],
        tri: 3, path: ['CONS'], w: 3, then: [
          { name: ['Suture simple', 'Pansement'], path: [], w: 6 },
          { name: ['Section de tendon', 'Plaie profonde à explorer'], paths: [['AMBU'], ['BLOC', 'SSPI']], w: 3 },
        ] },
      { name: ['Gastro-entérite à norovirus', 'Diarrhée à Clostridioides', 'Varicelle de l’adulte', 'Gale profuse'],
        tri: 3, inf: true, path: ['ISO'], w: 2 },
      { name: ['Femme en travail', 'Perte des eaux', 'Contractions rapprochées'], tri: 2, path: ['MAT'], w: 2, then: [
        { name: ['Accouchement par voie basse', 'Naissance d’une petite fille', 'Naissance d’un petit garçon', 'Naissance de jumeaux'], path: [], w: 7 },
        { name: ['Césarienne en urgence', 'Souffrance fœtale'], tri: 1, path: ['BLOC', 'SSPI', 'MAT'], w: 3 },
      ] },
    ],
    CONS: [
      { name: ['Mammographie de dépistage', 'IRM du genou', 'Échographie abdominale', 'Scanner des sinus', 'Radio du rachis'],
        tri: 4, path: ['IMG'], w: 4, then: [
          { name: ['Bilan normal', 'Examen rassurant', 'Kyste bénin'], path: [], w: 6 },
          { name: ['Nodule suspect', 'Masse à explorer', 'Lésion osseuse'], path: ['MN', 'CONS'], w: 3 },
          { name: ['Ménisque déchiré', 'Hernie inguinale', 'Calculs biliaires'], paths: [['AMBU'], ['BLOC', 'SSPI']], w: 2 },
        ] },
      { name: ['Chirurgie de la cataracte', 'Arthroscopie du genou', 'Cure de hernie', 'Canal carpien', 'Ablation de la vésicule'],
        tri: 4, paths: [['AMBU'], ['BLOC', 'SSPI']], w: 3 },
      { name: ['Scintigraphie osseuse', 'Scintigraphie thyroïdienne', 'Scintigraphie myocardique'], tri: 4, path: ['MN'], w: 2 },
      { name: ['Coronarographie programmée', 'Pose de stent programmée'], tri: 4, path: ['CORO', 'HOSP'], w: 1 },
    ],
    HOSP: [
      { name: ['Scanner de contrôle', 'IRM cérébrale', 'Échographie de contrôle', 'Radio du thorax'], tri: 3, path: ['IMG', 'HOSP'], w: 4 },
      { name: ['TEP-scanner de bilan', 'Scintigraphie pulmonaire', 'TEP de réévaluation'], tri: 3, path: ['MN', 'HOSP'], w: 3 },
      { name: ['Reprise chirurgicale', 'Lâchage de suture', 'Hématome post-opératoire', 'Abcès de paroi'], tri: 2, path: ['BLOC', 'SSPI', 'HOSP'], w: 2 },
      { name: ['Avis cardiologique', 'Avis dermatologique', 'Consultation d’anesthésie', 'Avis diététique'], tri: 4, path: ['CONS', 'HOSP'], w: 2 },
      { name: ['Détresse respiratoire', 'Choc septique', 'Hémorragie digestive', 'Arrêt cardiaque récupéré'], tri: 1, path: ['REA', 'HOSP'], w: 1 },
      { name: ['BMR détectée', 'Clostridioides en service', 'Grippe nosocomiale', 'Gale en chambre'], tri: 3, inf: true, path: ['ISO'], w: 2 },
    ],
    MAT: [
      { name: ['Échographie de grossesse', 'Monitoring fœtal', 'Échographie du 3e trimestre'], tri: 4, path: ['IMG', 'MAT'], w: 3 },
      { name: ['Césarienne programmée', 'Présentation par le siège'], tri: 3, path: ['BLOC', 'SSPI', 'MAT'], w: 2 },
      { name: ['Hémorragie du post-partum', 'Éclampsie'], tri: 1, path: ['BLOC', 'REA?', 'MAT'], w: 1 },
    ],
  };
  const SPAWN_WEIGHT = { URG: 3, CONS: 1.6, HOSP: 1.2, MAT: 1.2 };

  // Niveaux du bâtiment, du bas vers le haut. Chaque service ouvre à son étage d'affectation,
  // ou au rez-de-chaussée tant que cet étage n'existe pas.
  const FLOORS = {
    '-1': { label: '-1', short: 'S', name: 'Sous-sol', sub: 'Plateau de médecine nucléaire' },
    '0': { label: 'RDC', short: 'R', name: 'Rez-de-chaussée', sub: 'Accueil, urgences et imagerie' },
    '1': { label: '1', short: '1', name: '1er étage', sub: 'Plateau technique' },
    '2': { label: '2', short: '2', name: '2e étage', sub: 'Hospitalisation' },
  };
  const FLOOR_OF = {
    URG: 0, CONS: 0, IMG: 0, ISO: 0, AMBU: 0,
    BLOC: 1, SSPI: 1, REA: 1, CORO: 1,
    HOSP: 2, MAT: 2, UNV: 2,
    RPH: -1, MN: -1,
  };
  const floorName = z => FLOORS[z].name;
  const atFloor = z => (z === 0 ? 'au rez-de-chaussée' : z === -1 ? 'au sous-sol' : `au ${FLOORS[z].name}`);

  // Ascenseurs : une ligne verticale automatique par cage, parcourue par des cabines.
  const LIFT_DIST = 210;          // un étage de cabine, en unités de trajet (environ 2 s)
  const LIFT_CAP = 2;             // brancards par cabine
  const LIFT_COST = 1.5;          // coût d'un étage dans le calcul des plus courts chemins
  const LIFT_CLEAN = 6;           // nettoyage de la cabine après un patient contagieux (s)

  // Ouverture guidée : le rez-de-chaussée la première semaine, puis un niveau par étape.
  const SCHEDULE = [
    { t: 0, types: ['URG', 'IMG', 'HOSP', 'CONS'] },
    { t: 35, types: ['BLOC'] },
    { t: 50, types: ['SSPI'] },
    { t: 85, types: ['ISO'], unlock: 'sep' },
    { t: 135, floor: 1, types: ['REA'] },
    { t: 205, floor: -1, types: ['RPH', 'MN'], unlock: 'rad' },
    { t: 275, floor: 2, types: ['HOSP'], unlock: 'sep' },
  ];
  const EXPAND_FROM = 230, EXPAND_EVERY = 40;
  // Un service spécialisé soulage les services listés dans « relieves ».
  const SPECIALS = [
    { type: 'UNV', after: 280, relieves: ['REA', 'HOSP'], needs: ['IMG'] },
    { type: 'AMBU', after: 240, relieves: ['BLOC', 'SSPI'], needs: ['CONS'] },
    { type: 'CORO', after: 300, relieves: ['BLOC', 'REA'], needs: ['CONS'] },
    { type: 'MAT', after: 335, relieves: [], needs: ['BLOC'] },
  ];
  const SPAWNERS = ['CONS', 'HOSP', 'URG', 'MAT'];

  // Obstacles fixes du bâtiment. Un patio se franchit avec une passerelle ; le reste, jamais.
  // Les noyaux traversent tous les niveaux, les patios aussi sauf le sous-sol, le bunker est enterré.
  const OBSTACLES = {
    patio: { name: 'Patio', label: 'PATIO', crossable: true, floors: [0, 1, 2],
             desc: 'Jardin intérieur au rez-de-chaussée, vide sur patio aux étages. Un circuit le franchit par une passerelle (stock limité).' },
    core: { name: 'Noyau d’ascenseurs', label: 'ASCENSEURS', crossable: false, floors: [-1, 0, 1, 2],
            desc: 'Cages d’ascenseurs et gaines techniques, sur toute la hauteur. Infranchissable ; certaines deviennent des ascenseurs.' },
    bunker: { name: 'Bunker de radiothérapie', label: 'RADIOTHÉRAPIE', crossable: false, floors: [-1],
              desc: 'Au sous-sol, murs de béton de deux mètres. Infranchissable : contournez-le.' },
  };
  const START_BRIDGES = 2;
  const START_MOVES = 1;          // déménagements de service disponibles au départ

  // Qui a le droit d'emprunter quel circuit. Les ascenseurs (« lift ») servent à tous.
  // Un patient radioactif emprunte les circuits standard, mais voyage seul.
  const RIDE = { std: ['std', 'lift'], inf: ['sep', 'lift'], rad: ['std', 'lift'], dose: ['rad', 'lift'] };
  const KIND_LABEL = { std: 'Circuit standard', sep: 'Circuit septique', rad: 'Circuit radioprotégé' };
  const KIND_RULE = {
    std: 'Patients sans précaution particulière. Un patient radioactif y voyage seul sur son brancard.',
    sep: 'Réservé aux patients contagieux : il évite toute contamination croisée.',
    rad: 'Réservé aux doses de radiotraceur, de la radiopharmacie à la médecine nucléaire.',
  };

  const SLOT_DEFS = [
    { kind: 'std', color: 'l1' }, { kind: 'std', color: 'l2' }, { kind: 'std', color: 'l3' },
    { kind: 'std', color: 'l4' }, { kind: 'std', color: 'l5' }, { kind: 'std', color: 'l6' },
    { kind: 'std', color: 'l7' },
    { kind: 'sep', color: 'sep' }, { kind: 'sep', color: 'sep' },
    { kind: 'rad', color: 'rad' }, { kind: 'rad', color: 'rad' },
  ];
  // Circuits standard disponibles selon la taille de l'hôpital : 3, puis +1 tous les 3 services.
  const stdSlotsFor = nodes => clamp(3 + Math.floor((nodes - 4) / 3), 3, 7);

  const UPGRADES = {
    bridge: { title: 'Deux passerelles', desc: 'Franchissez deux patios de plus avec vos circuits.', ok: () => true },
    move: { title: 'Deux déménagements', desc: 'Déplacez deux services, sur le même étage ou à un autre niveau, avec leurs patients.', ok: () => true },
    cabin: { title: 'Cabine supplémentaire', desc: 'Une cabine de plus dans la cage d’ascenseur de votre choix.', ok: () => G.shafts.length > 0 },
    lift: { title: 'Nouvel ascenseur', desc: 'Une autre cage d’ascenseurs est mise en service, à tous les niveaux.',
      ok: () => G.floors.length > 1 && !!nextCore() },
    line_sep: { title: 'Circuit septique de plus', desc: 'Un autre circuit réservé aux patients contagieux.',
      ok: () => G.slots.some(s => s.kind === 'sep' && s.unlocked) && lockedSlot('sep') },
    staff: { title: 'Renfort d’équipe', desc: '+1 poste de soin sur le service de votre choix : il traite un patient de plus à la fois.', ok: () => true },
    room: { title: 'Salle d’attente agrandie', desc: '+4 places d’attente sur un service ou un palier avant saturation.', ok: () => true },
    cart: { title: 'Chariot double', desc: '+2 places pour chaque brancardier d’un circuit.', ok: () => true },
  };
  const TOKEN_LABEL = { staff: 'Renfort', room: 'Salle d’attente', cart: 'Chariot double', cabin: 'Cabine' };
  const TOKEN_HINT = {
    staff: 'Touchez un service de soins pour y affecter le renfort.',
    room: 'Touchez un service ou un palier pour agrandir sa salle d’attente.',
    cart: 'Touchez un circuit (sur le plan ou dans la palette) pour doubler ses chariots.',
    cabin: 'Touchez un palier d’ascenseur pour ajouter une cabine dans sa cage.',
  };

  // ================================================================
  // Outils
  // ================================================================
  const $ = s => document.querySelector(s);
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible */ } },
  };
  function pickWeighted(items, wf) {
    let tot = 0;
    for (const it of items) tot += wf(it);
    let r = Math.random() * tot;
    for (const it of items) { r -= wf(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Couleurs lues dans les jetons CSS (thème clair / sombre).
  const C = {};
  const TOKENS = ['bg', 'floor', 'grid', 'ink', 'muted', 'node', 'accent', 'danger', 'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7',
    'sep', 'rad', 'rad-ink', 't1', 't2', 't3', 't4', 'line-soft', 'room', 'wall', 'sign', 'sign-ink', 'garden', 'garden-ink'];
  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    for (const t of TOKENS) C[t] = cs.getPropertyValue('--' + t).trim() || '#888';
  }
  readColors();

  // ================================================================
  // État
  // ================================================================
  const canvas = $('#game');
  const ctx = canvas.getContext('2d');
  let DPR = 1, CW = 0, CH = 0, HUD_TOP = 60, HUD_BOTTOM = 90;
  const cam = { s: 1, ox: 0, oy: 0, ready: false };
  let G = null;
  let uid = 1;

  function newGame() {
    measure();
    const availH = Math.max(200, CH - HUD_TOP - HUD_BOTTOM);
    const aspect = clamp((CW - 70) / availH, 0.5, 2.3);
    const H = 800, W = Math.round(800 * aspect);
    G = {
      t: 0, score: 0, incidents: 0, lwbs: 0, dosesLost: 0, aggravated: 0, week: 1, nextWeek: WEEK,
      W, H, region: null, obstacles: [], bridges: START_BRIDGES, moves: START_MOVES, moveNode: null, hoverPt: null,
      floors: [0], view: 0, shafts: [], eig: [],
      nodes: [], lines: [], vehicles: [], floaters: [],
      pool: 3, inv: { staff: 0, room: 0, cart: 0, cabin: 0 }, apply: null,
      slots: SLOT_DEFS.map((d, i) => ({ i, kind: d.kind, color: d.color, unlocked: d.kind === 'std' && i < 3, line: null })),
      selSlot: null, speed: 1, paused: false, over: false, modal: false,
      schedIdx: 0, nextExpand: EXPAND_FROM, expansions: 0, spawnT: 4,
      distCache: new Map(), distStamp: 0, routeCache: new Map(), uiVersion: 0, started: false,
    };
    updateRegion();
    G.obstacles = makeObstacles();
    cam.ready = false;
    runSchedule();
    G.uiVersion++;
  }

  function updateRegion() {
    // emprise initiale d'au moins 360 unités de côté, pour loger quatre services même en portrait
    const f0 = Math.min(1, Math.max(0.52, 360 / G.W, 360 / G.H));
    const f = clamp(f0 + G.t / 650, f0, 1);
    const w = G.W * f, h = G.H * f;
    G.region = { x: (G.W - w) / 2, y: (G.H - h) / 2, w, h };
  }

  // ================================================================
  // Obstacles fixes
  // ================================================================
  const obstOn = (o, z) => OBSTACLES[o.kind].floors.includes(z);
  // Le palier d'un ascenseur se trouve juste sous sa cage ; sa pièce est réservée dès le départ.
  const palierSpot = o => ({ x: o.x + o.w / 2, y: o.y + o.h + 52 });
  function palierRoom(o) {
    const p = palierSpot(o);
    return { x: p.x - 46, y: p.y - 40, w: 92, h: 92 };
  }
  // Emprise d'un obstacle, palier compris pour une cage d'ascenseurs.
  function extent(o) {
    if (o.kind !== 'core') return o;
    const r = palierRoom(o);
    const x0 = Math.min(o.x, r.x), x1 = Math.max(o.x + o.w, r.x + r.w);
    return { x: x0, y: o.y, w: x1 - x0, h: r.y + r.h - o.y };
  }

  // Le plan entier est dessiné dès le départ : les obstacles apparaissent quand le bâtiment s'agrandit
  // jusqu'à eux. Un patio et une cage d'ascenseurs se trouvent déjà dans l'emprise initiale.
  function makeObstacles() {
    const out = [];
    const R0 = G.region, cx = G.W / 2, cy = G.H / 2;
    const snap = v => Math.round(v / 20) * 20;
    const inside = (e, R, m) => e.x > R.x + m && e.y > R.y + m && e.x + e.w < R.x + R.w - m && e.y + e.h < R.y + R.h - m;
    const apart = (a, b, gap) => a.x > b.x + b.w + gap || b.x > a.x + a.w + gap || a.y > b.y + b.h + gap || b.y > a.y + a.h + gap;
    const place = (kind, w, h, area, opts = {}) => {
      for (let i = 0; i < 300; i++) {
        const o = { kind, w, h, x: snap(area.x + Math.random() * Math.max(1, area.w - w)), y: snap(area.y + Math.random() * Math.max(1, area.h - h)), seed: Math.random() };
        const e = extent(o);
        if (!inside(e, { x: 0, y: 0, w: G.W, h: G.H }, 30)) continue;
        if (opts.inner && !inside(e, R0, 12)) continue;
        if (opts.outer && inside(o, R0, 0)) continue;
        // deux obstacles qui partagent un niveau restent assez éloignés pour laisser passer un circuit
        const ok = out.every(q => apart(e, extent(q), OBSTACLES[q.kind].floors.some(z => OBSTACLES[kind].floors.includes(z)) ? 110 : 10));
        if (ok) { out.push(o); return o; }
      }
      return null;
    };
    const centre = { x: cx - R0.w * 0.32, y: cy - R0.h * 0.36, w: R0.w * 0.64, h: R0.h * 0.5 };
    place('core', 40, 40, centre, { inner: true });
    place('patio', Math.min(120, snap(R0.w * 0.3)), Math.min(100, snap(R0.h * 0.22)), centre);
    const world = { x: 40, y: 40, w: G.W - 80, h: G.H - 80 };
    place('bunker', 140, 100, world, { outer: true });
    place('patio', 160, 120, world, { outer: true });
    place('patio', 140, 100, world, { outer: true });
    place('core', 60, 40, world, { outer: true });
    place('core', 40, 60, world, { outer: true });
    return out;
  }

  function rectHit(x0, y0, x1, y1, o, pad) {
    return x1 > o.x - pad && x0 < o.x + o.w + pad && y1 > o.y - pad && y0 < o.y + o.h + pad;
  }
  // Intersection segment / rectangle (Liang-Barsky), avec une marge.
  function segHitsRect(a, b, o, pad) {
    const x0 = o.x - pad, y0 = o.y - pad, x1 = o.x + o.w + pad, y1 = o.y + o.h + pad;
    const dx = b.x - a.x, dy = b.y - a.y;
    let t0 = 0, t1 = 1;
    const p = [-dx, dx, -dy, dy], q = [a.x - x0, x1 - a.x, a.y - y0, y1 - a.y];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
      else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }

  // ================================================================
  // Services
  // ================================================================
  function nodeById(id) { return G.nodes.find(n => n.id === id); }
  function hasType(t) { return G.nodes.some(n => n.type === t); }
  function typeCount(t) { return G.nodes.filter(n => n.type === t).length; }

  // Emplacement libre à un niveau (hors obstacles et paliers réservés, pièces espacées). Parmi plusieurs
  // candidats, on retient le plus éloigné des services existants : l'hôpital s'étend vers ses nouvelles ailes.
  function findSpot(z) {
    const R = G.region;
    const cores = G.obstacles.filter(o => o.kind === 'core');
    let best = null, bestD = -1;
    for (let a = 0; a < 400 && (!best || a < 60); a++) {
      const relax = a > 300 ? 0.72 : a > 200 ? 0.85 : 1;
      const x = R.x + 58 + Math.random() * (R.w - 116);
      const y = R.y + 50 + Math.random() * (R.h - 112);
      if (G.obstacles.some(o => obstOn(o, z) && rectHit(x - 44, y - 40, x + 44, y + 50, o, 14))) continue;
      if (cores.some(o => rectHit(x - 44, y - 40, x + 44, y + 50, palierRoom(o), 10))) continue;
      let dmin = Infinity;
      for (const n of G.nodes) if (n.z === z) dmin = Math.min(dmin, Math.hypot(n.x - x, n.y - y));
      if (dmin < MIN_SPACING * relax) continue;
      const score = Math.min(dmin, 260) + Math.random() * 40;
      if (score > bestD) { bestD = score; best = { x, y }; }
    }
    return best;
  }

  function makeNode(type, x, y, z) {
    const T = TYPES[type];
    const node = {
      id: uid++, type, x, y, z, code: roomCode(x, y, z), waiting: [], queue: [], treating: [], doses: [],
      slots: T.slots, cap: T.cap, over: 0, born: G.t, rphT: DOSE_EVERY * 0.5,
    };
    G.nodes.push(node);
    return node;
  }

  // Un service ouvre à son étage d'affectation s'il existe, sinon au rez-de-chaussée.
  function addNode(type) {
    const pref = FLOOR_OF[type] ?? 0;
    const tries = [G.floors.includes(pref) ? pref : 0, ...G.floors];
    for (const z of tries) {
      const spot = findSpot(z);
      if (!spot) continue;
      const node = makeNode(type, spot.x, spot.y, z);
      invalidateNet();
      syncSlots();
      return node;
    }
    return null;
  }

  // Plus l'hôpital compte de services, plus il dispose de circuits ; chacun arrive avec son brancardier.
  function syncSlots() {
    const want = stdSlotsFor(G.nodes.length);
    let have = G.slots.filter(s => s.kind === 'std' && s.unlocked).length;
    while (have < want) {
      unlockSlot('std'); have++; G.pool++;
      if (G.t > 0) toast(`<b>Nouveau circuit</b> et un brancardier : l’hôpital compte ${G.nodes.length} services.`);
    }
  }

  // Repère de local : niveau, axes de la trame structurelle, numéro d'ordre (ex. 1-D5-02).
  const BAY = 80;
  const axisLetter = i => String.fromCharCode(65 + (i % 26));
  function roomCode(x, y, z) {
    const col = Math.floor(x / BAY), row = Math.floor(y / BAY) + 1;
    return `${FLOORS[z].short}-${axisLetter(col)}${row}-${String(G.nodes.length + 1).padStart(2, '0')}`;
  }

  // ================================================================
  // Étages et ascenseurs
  // ================================================================
  // Prochaine cage à mettre en service : la plus proche du centre parmi celles du bâtiment actuel.
  function nextCore() {
    const used = new Set(G.shafts.map(s => s.core));
    const R = G.region;
    return G.obstacles
      .filter(o => o.kind === 'core' && !used.has(o))
      .filter(o => { const e = extent(o); return e.x > R.x && e.y > R.y && e.x + e.w < R.x + R.w && e.y + e.h < R.y + R.h; })
      .sort((a, b) => Math.hypot(a.x - G.W / 2, a.y - G.H / 2) - Math.hypot(b.x - G.W / 2, b.y - G.H / 2))[0] || null;
  }

  function shaftPaliers(sh) {
    return G.floors.slice().sort((a, b) => a - b).map(z => {
      if (!sh.paliers[z]) {
        const p = palierSpot(sh.core);
        const n = makeNode('ASC', p.x, p.y, z);
        n.shaft = sh;
        sh.paliers[z] = n.id;
      }
      return sh.paliers[z];
    });
  }

  // Mise en service d'une cage : un palier à chaque niveau, une ligne verticale automatique, deux cabines.
  function activateShaft(core) {
    if (!core) return null;
    const sh = { core, letter: String.fromCharCode(65 + G.shafts.length), paliers: {}, line: null };
    G.shafts.push(sh);
    const ids = shaftPaliers(sh);
    const l = { id: uid++, slot: -1, kind: 'lift', lift: true, color: 'ink', nodes: ids, loop: false, cart: 0, geom: null, shaft: sh, z: null };
    sh.line = l;
    G.lines.push(l);
    invalidateNet();
    addVehicle(l, true);
    addVehicle(l, true);
    return sh;
  }

  function openFloor(z) {
    if (G.floors.includes(z)) return;
    G.floors.push(z);
    G.floors.sort((a, b) => b - a);
    if (!G.shafts.length) activateShaft(nextCore());
    for (const sh of G.shafts) setLineNodes(sh.line, shaftPaliers(sh), false);
    G.newFloor = { z, t: G.t };
    G.uiVersion++;
  }

  function runSchedule() {
    while (G.schedIdx < SCHEDULE.length && G.t >= SCHEDULE[G.schedIdx].t) {
      const ev = SCHEDULE[G.schedIdx++];
      if (ev.floor !== undefined) {
        openFloor(ev.floor);
        const lifts = G.shafts.map(s => s.letter).join(', ');
        toast(`Ouverture ${ev.floor === -1 ? 'du sous-sol' : `du ${floorName(ev.floor)}`} : <b>${FLOORS[ev.floor].sub}</b>. Ascenseur ${lifts} en service.`);
      }
      for (const t of ev.types) addNode(t);
      if (G.t > 0) {
        toast(`Nouveau service : <b>${ev.types.map(t => TYPES[t].name).join(' + ')}</b>${ev.floor !== undefined ? ' ' + atFloor(ev.floor) : ''}`);
      }
      // chaque circuit spécialisé arrive avec son brancardier formé
      if (ev.unlock === 'sep') {
        unlockSlot('sep'); G.pool++;
        toast('<b>Circuit septique</b> débloqué, avec un brancardier formé.');
      }
      if (ev.unlock === 'rad') {
        unlockSlot('rad'); G.pool++;
        toast('<b>Circuit radioprotégé</b> débloqué, avec un brancardier formé.');
      }
    }
    if (G.t >= G.nextExpand) {
      G.nextExpand += EXPAND_EVERY;
      expand();
    }
  }

  // Charge d'un type de service : secondes de travail en attente rapportées à sa capacité de soin.
  function pressure(type) {
    const T = TYPES[type];
    if (!T.proc) return 0;
    let demand = 0, cap = 0;
    for (const n of G.nodes) {
      if (n.type === type) { demand += n.queue.length + n.treating.length; cap += n.slots / T.proc; }
      for (const e of n.waiting) if (e.kind === 'patient' && wants(e) === type) demand++;
    }
    for (const v of G.vehicles) for (const e of v.cargo) if (e.kind === 'patient' && wants(e) === type) demand++;
    return cap ? demand / cap : 0;
  }

  // Extension de l'hôpital : on ouvre ce qui manque, pas un doublon au hasard.
  //  1. le service le plus sous tension reçoit un service spécialisé qui le soulage, s'il en existe un ;
  //  2. une extension sur trois est un nouveau secteur d'activité, qui amène de nouveaux patients ;
  //  3. sinon, une spécialité pas encore ouverte, ou une seconde unité du service le plus chargé.
  function expand() {
    G.expansions++;
    const dests = [...new Set(G.nodes.map(n => n.type))].filter(t => TYPES[t].proc > 0);
    const ranked = dests.map(t => ({ t, p: pressure(t) })).sort((a, b) => b.p - a.p);
    const top = ranked[0];
    const specials = SPECIALS.filter(s => G.t >= s.after && !hasType(s.type) && s.needs.every(hasType));
    const relief = top && specials.find(s => s.relieves.includes(top.t));
    let type, why;
    if (relief) {
      type = relief.type;
      why = `${TYPES[top.t].name} sous tension : ouverture d’un service spécialisé, <b>${TYPES[type].name}</b>`;
    } else if (G.expansions % 3 === 0) {
      const opts = SPAWNERS.filter(t => hasType(t) && typeCount(t) < 3);
      type = pickWeighted(opts, t => (t === 'URG' ? 0.6 : 1) / typeCount(t));
      why = `L’activité augmente : nouveau secteur, <b>${TYPES[type].name}</b>`;
    } else if (specials.length && (Math.random() < 0.5 || !top || top.p < 2)) {
      type = specials[0].type;
      why = `Le projet médical se diversifie : ouverture de <b>${TYPES[type].name}</b>`;
    } else if (top) {
      type = top.t;
      why = `Forte demande en ${TYPES[type].name.toLowerCase()} : ouverture d’une unité supplémentaire`;
    }
    if (!type) return;
    const node = addNode(type);
    if (node) {
      G.pool++;
      toast(`${why} ${atFloor(node.z)}. Un brancardier rejoint l’équipe.`);
    }
  }

  function unlockSlot(kind) {
    const s = G.slots.find(s => s.kind === kind && !s.unlocked);
    if (s) { s.unlocked = true; G.uiVersion++; }
    return s;
  }
  function lockedSlot(kind) { return G.slots.some(s => s.kind === kind && !s.unlocked); }

  // ================================================================
  // Patients et doses
  // ================================================================
  function wants(e) { return e.kind === 'dose' ? 'MN' : e.path[e.step]; }
  function catOf(e) { return e.kind === 'dose' ? 'dose' : e.inf ? 'inf' : e.rad ? 'rad' : 'std'; }
  function canRide(e, kind) { return RIDE[catOf(e)].includes(kind); }

  function resolvePath(path) {
    const out = [];
    for (const step of path) {
      const optional = step.endsWith('?');
      const opts = step.replace('?', '').split('|');
      const t = opts.find(o => hasType(o));
      if (t) out.push(t);
      else if (!optional) return null;
    }
    return out;
  }
  const pickName = n => (Array.isArray(n) ? n[Math.floor(Math.random() * n.length)] : n);
  function resolveTemplate(tpl) {
    for (const p of tpl.paths || [tpl.path]) {
      const r = resolvePath(p);
      if (r && r.length) return r;
    }
    return null;
  }

  function spawnPatient() {
    const options = [];
    for (const n of G.nodes) {
      const tpls = TEMPLATES[n.type];
      if (!tpls) continue;
      if (n.type === 'HOSP' && G.t < 40) continue;
      for (const tpl of tpls) {
        const path = resolveTemplate(tpl);
        if (path) options.push({ n, tpl, path, w: SPAWN_WEIGHT[n.type] * tpl.w });
      }
    }
    if (!options.length) return;
    const o = pickWeighted(options, x => x.w);
    const tri = TRIAGE[o.tpl.tri];
    const p = {
      id: uid++, kind: 'patient', name: pickName(o.tpl.name), tri: o.tpl.tri, path: o.path, step: 0, then: o.tpl.then || null,
      inf: !!o.tpl.inf, rad: false, patience: tri.patience, maxPatience: tri.patience, born: G.t, qt: 0, aggr: false,
    };
    o.n.waiting.push(p);
  }

  // Le rythme d'arrivée accélère avec le temps et avec le nombre de secteurs qui reçoivent des patients.
  function spawnInterval() {
    const sources = G.nodes.filter(n => TEMPLATES[n.type]).length;
    const base = 5.6 * Math.pow(0.998, G.t) / (1 + 0.1 * Math.max(0, sources - 3));
    return Math.max(0.85, base) * rand(0.7, 1.3);
  }

  // Arrivée d'une entité à destination dans un service.
  function deliver(e, node) {
    if (e.kind === 'dose') { node.doses.push(e); return; }
    e.qt = G.t;
    node.queue.push(e);
  }
  function drop(e, node) {
    if (e.kind === 'patient' && wants(e) === node.type) deliver(e, node);
    else if (e.kind === 'dose' && node.type === 'MN') deliver(e, node);
    else node.waiting.push(e);
  }

  // Diagnostic : à la fin du parcours connu, l'examen révèle la suite (ou la sortie).
  function diagnose(p, node) {
    const options = p.then.map(b => ({ b, path: b.paths ? resolveTemplate(b) : b.path.length ? resolvePath(b.path) : [] })).filter(o => o.path);
    p.then = null;
    if (!options.length) return;
    const { b, path } = pickWeighted(options, o => o.b.w);
    p.name = pickName(b.name);
    p.path = p.path.concat(path);
    if (b.tri && b.tri < p.tri) {
      p.tri = b.tri;
      p.maxPatience = TRIAGE[b.tri].patience;
      p.patience = p.maxPatience * 0.8;
      floater(node.x, node.y - NODE_R - 24, p.name, TRIAGE[b.tri].color, node.z);
    }
    if (b.inf && !p.inf) {
      p.inf = true;
      floater(node.x, node.y - NODE_R - 24, `${p.name} : isolement`, 'sep', node.z);
    } else if (!b.tri) {
      floater(node.x, node.y - NODE_R - 24, p.name, 'muted', node.z);
    }
  }

  function finishStep(p, node) {
    if (node.type === 'MN') p.rad = true;
    p.step++;
    if (p.step >= p.path.length && p.then) diagnose(p, node);
    if (p.step >= p.path.length) {
      G.score++;
      floater(node.x, node.y - NODE_R - 14, '+1', 'ink', node.z);
      return;
    }
    if (STABILIZE.has(node.type) && p.tri < 3) {
      p.tri++;
      p.maxPatience = TRIAGE[p.tri].patience;
      p.patience = p.maxPatience;
    }
    p.patience = Math.max(p.patience, p.maxPatience * 0.6); // un patient pris en charge a de la marge
    if (wants(p) === node.type) deliver(p, node);
    else node.waiting.push(p);
  }

  // ================================================================
  // Réseau : circuits et plus courts chemins
  // ================================================================
  function invalidateNet() {
    G.distCache.clear();
    for (const l of G.lines) buildGeom(l);
    G.uiVersion++;
  }

  function linePairs(l) {
    const ns = l.nodes, pairs = [];
    for (let i = 0; i < ns.length - 1; i++) pairs.push([ns[i], ns[i + 1]]);
    if (l.loop && ns.length > 2) pairs.push([ns[ns.length - 1], ns[0]]);
    return pairs;
  }

  // Coût (en arrêts) depuis chaque service jusqu'au service du type voulu, en n'empruntant que les
  // circuits autorisés pour cette catégorie. Un service encombré coûte plus cher : les patients se
  // répartissent d'eux-mêmes vers l'unité la moins chargée quand il y en a plusieurs.
  function loadPenalty(n) {
    if (!TYPES[n.type].proc) return 0;
    return Math.min(4, (n.queue.length + n.treating.length) / Math.max(1, n.slots) * 0.6);
  }
  function distMap(cat, type) {
    if (G.t - G.distStamp > 1) { G.distCache.clear(); G.distStamp = G.t; }
    const key = cat + '|' + type;
    let m = G.distCache.get(key);
    if (m) return m;
    const kinds = RIDE[cat];
    const rev = new Map();
    const add = (a, b, w) => { if (!rev.has(a)) rev.set(a, []); rev.get(a).push({ u: b, w }); };
    for (const l of G.lines) {
      if (!kinds.includes(l.kind)) continue;
      const w = edgeCost(l);
      for (const [a, b] of linePairs(l)) { add(b, a, w); if (!l.loop) add(a, b, w); }
    }
    m = new Map();
    const open = [];
    for (const n of G.nodes) if (n.type === type) { m.set(n.id, loadPenalty(n)); open.push(n.id); }
    // Dijkstra sur quelques dizaines de services : une recherche linéaire du minimum suffit.
    const done = new Set();
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (m.get(open[i]) < m.get(open[bi])) bi = i;
      const v = open.splice(bi, 1)[0];
      if (done.has(v)) continue;
      done.add(v);
      const d = m.get(v);
      for (const { u, w } of rev.get(v) || []) {
        if (!m.has(u) || d + w < m.get(u)) { m.set(u, d + w); open.push(u); }
      }
    }
    G.distCache.set(key, m);
    return m;
  }
  // Monter : le prochain arrêt est sur un plus court chemin. Rester à bord : il reste presque aussi bon
  // (une petite marge évite de descendre à chaque variation d'encombrement).
  // Un étage d'ascenseur coûte un peu plus qu'un arrêt de brancardier.
  const edgeCost = l => (l.lift ? LIFT_COST : 1);
  function progresses(e, hereId, nextId, aboard, w) {
    const m = distMap(catOf(e), wants(e));
    const dh = m.get(hereId), dn = m.get(nextId);
    if (dh === undefined || dn === undefined) return false;
    return dn + w <= dh + (aboard ? 0.75 : 1e-6) && dn < dh;
  }

  // ---------- Géométrie octilinéaire des circuits ----------
  function segUseKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  // Deux tracés possibles entre deux services : droit puis diagonale, ou diagonale puis droit.
  // On garde celui qui évite les obstacles infranchissables et franchit le moins de patios.
  function cornerFor(A, B, variant) {
    const dx = B.x - A.x, dy = B.y - A.y, adx = Math.abs(dx), ady = Math.abs(dy);
    const sx = Math.sign(dx) || 1, sy = Math.sign(dy) || 1;
    if (variant === 0) return adx > ady ? { x: A.x + sx * (adx - ady), y: A.y } : { x: A.x, y: A.y + sy * (ady - adx) };
    return adx > ady ? { x: B.x - sx * (adx - ady), y: B.y } : { x: B.x, y: B.y - sy * (ady - adx) };
  }
  function routeInfo(a, b) {
    const key = segUseKey(a.id, b.id);
    let r = G.routeCache.get(key);
    if (r) return r;
    const [A, B] = a.id < b.id ? [a, b] : [b, a];
    const evals = [0, 1].map(variant => {
      const Cn = cornerFor(A, B, variant);
      let blocked = false;
      const patios = [];
      for (const o of G.obstacles) {
        if (!obstOn(o, A.z)) continue;
        const hit = segHitsRect(A, Cn, o, 6) || segHitsRect(Cn, B, o, 6);
        if (!hit) continue;
        if (OBSTACLES[o.kind].crossable) patios.push(o); else blocked = true;
      }
      return { variant, blocked, patios };
    });
    const ok = evals.filter(e => !e.blocked).sort((x, y) => x.patios.length - y.patios.length);
    r = ok[0] || { variant: 0, blocked: true, patios: [] };
    G.routeCache.set(key, r);
    return r;
  }
  function bridgesFor(nodes, loop) {
    let n = 0;
    for (let i = 0; i < nodes.length - 1; i++) n += routeInfo(nodeById(nodes[i]), nodeById(nodes[i + 1])).patios.length;
    if (loop && nodes.length > 2) n += routeInfo(nodeById(nodes[nodes.length - 1]), nodeById(nodes[0])).patios.length;
    return n;
  }
  function bridgesUsed(except) {
    let n = 0;
    for (const l of G.lines) if (l !== except && !l.lift) n += bridgesFor(l.nodes, l.loop);
    return n;
  }

  function segPoints(a, b, off) {
    let A = a, B = b, rev = false;
    if (a.id > b.id) { A = b; B = a; rev = true; }
    const Cn = cornerFor(A, B, routeInfo(a, b).variant);
    let pts = [{ x: A.x, y: A.y }, Cn, { x: B.x, y: B.y }];
    pts = pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > 0.5);
    if (pts.length < 2) pts = [{ x: A.x, y: A.y }, { x: B.x + 0.01, y: B.y }];
    pts = offsetPolyline(pts, off);
    if (rev) pts.reverse();
    return pts;
  }

  function offsetPolyline(pts, off) {
    if (!off) return pts.map(p => ({ x: p.x, y: p.y }));
    const nr = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const dx = pts[i + 1].x - pts[i].x, dy = pts[i + 1].y - pts[i].y, L = Math.hypot(dx, dy) || 1;
      nr.push({ x: -dy / L, y: dx / L });
    }
    return pts.map((p, i) => {
      if (i === 0) return { x: p.x + nr[0].x * off, y: p.y + nr[0].y * off };
      if (i === pts.length - 1) { const n = nr[nr.length - 1]; return { x: p.x + n.x * off, y: p.y + n.y * off }; }
      const n1 = nr[i - 1], n2 = nr[i];
      let mx = n1.x + n2.x, my = n1.y + n2.y; const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
      const k = off / Math.max(0.3, mx * n1.x + my * n1.y);
      return { x: p.x + mx * k, y: p.y + my * k };
    });
  }

  function buildGeom(l) {
    if (l.lift) {
      // une cage : chaque palier est à LIFT_DIST du suivant, sur un axe virtuel
      const L = (l.nodes.length - 1) * LIFT_DIST, c = l.shaft.core;
      const x = c.x + c.w / 2, y = c.y + c.h / 2;
      l.geom = { pts: [{ x, y }, { x, y: y + L }], cum: [0, L], nodeDist: l.nodes.map((_, i) => i * LIFT_DIST), segStart: [0], L };
      return;
    }
    const use = new Map();
    for (const ln of G.lines) for (const [a, b] of linePairs(ln)) {
      const k = segUseKey(a, b);
      if (!use.has(k)) use.set(k, []);
      use.get(k).push(ln.slot);
    }
    const pairs = linePairs(l);
    const pts = [], cum = [], nodeDist = [], segStart = [];
    let L = 0, last = null;
    const push = p => { if (last) L += dist(p, last); pts.push(p); cum.push(L); last = p; };
    pairs.forEach(([a, b], k) => {
      const A = nodeById(a), B = nodeById(b);
      const users = (use.get(segUseKey(a, b)) || [l.slot]).slice().sort((x, y) => x - y);
      const off = (users.indexOf(l.slot) - (users.length - 1) / 2) * LINE_GAP;
      const seg = segPoints(A, B, off);
      push(seg[0]);
      nodeDist[k] = L;
      segStart[k] = pts.length - 1;
      for (let j = 1; j < seg.length; j++) push(seg[j]);
    });
    nodeDist[pairs.length] = L;
    l.geom = { pts, cum, nodeDist, segStart, L };
  }

  function pointAt(g, d) {
    const { pts, cum } = g;
    if (pts.length < 2) return { x: pts[0] ? pts[0].x : 0, y: pts[0] ? pts[0].y : 0, a: 0 };
    d = clamp(d, 0, g.L);
    let i = 0;
    while (i < cum.length - 2 && cum[i + 1] < d) i++;
    const seg = cum[i + 1] - cum[i];
    let j = i;
    // les sauts de longueur nulle n'ont pas de direction : on prend le suivant
    while (j < pts.length - 2 && dist(pts[j], pts[j + 1]) < 0.01) j++;
    const t = seg > 0 ? (d - cum[i]) / seg : 0;
    const x = pts[i].x + (pts[i + 1].x - pts[i].x) * t;
    const y = pts[i].y + (pts[i + 1].y - pts[i].y) * t;
    const a = Math.atan2(pts[j + 1].y - pts[j].y, pts[j + 1].x - pts[j].x);
    return { x, y, a };
  }

  // ---------- Création / modification ----------
  function createLine(slot, nodes, loop) {
    const l = { id: uid++, slot: slot.i, kind: slot.kind, color: slot.color, nodes: nodes.slice(), loop: !!loop && nodes.length > 2, cart: 0, geom: null, z: nodeById(nodes[0]).z };
    G.lines.push(l);
    slot.line = l;
    invalidateNet();
    if (G.pool > 0) addVehicle(l);
    else toast('Plus de brancardier disponible : ce circuit attend un renfort.', true);
    return l;
  }

  function setLineNodes(l, nodes, loop) {
    if (nodes.length < 2) { deleteLine(l); return; }
    l.nodes = nodes.slice();
    l.loop = !!loop && nodes.length > 2;
    invalidateNet();
    for (const v of G.vehicles) if (v.line === l) remapVehicle(v);
  }

  function deleteLine(l) {
    for (const v of G.vehicles.filter(v => v.line === l)) removeVehicle(v);
    G.lines = G.lines.filter(x => x !== l);
    const s = G.slots[l.slot];
    if (s) s.line = null;
    invalidateNet();
  }

  // ================================================================
  // Brancardiers
  // ================================================================
  function vehCap(v) { return v.line.lift ? LIFT_CAP : VEH_CAP + v.line.cart; }

  // free : une cabine d'ascenseur, qui ne compte pas dans la réserve de brancardiers.
  function addVehicle(l, free) {
    if (!free && G.pool <= 0) return null;
    if (!free) G.pool--;
    const others = G.vehicles.filter(v => v.line === l).length;
    const n = l.nodes.length;
    const si = others % 2 === 1 && !l.loop ? n - 1 : 0;
    const v = { id: uid++, line: l, free: !!free, cargo: [], si, ti: si, dir: si === 0 ? 1 : -1, pos: l.geom.nodeDist[si], td: 0, state: 'move', wait: 0, clean: 0, x: 0, y: 0, a: 0, z: 0 };
    v.td = v.pos;
    const p0 = pointAt(l.geom, v.pos);
    v.x = p0.x; v.y = p0.y; v.a = p0.a;
    v.z = l.lift ? nodeById(l.nodes[si]).z : l.z;
    G.vehicles.push(v);
    G.uiVersion++;
    return v;
  }

  function removeVehicle(v) {
    const n = nodeById(v.line.nodes[v.ti]) || nodeById(v.line.nodes[v.si]) || nodeById(v.line.nodes[0]);
    for (const e of v.cargo) if (n) drop(e, n);
    v.cargo = [];
    G.vehicles = G.vehicles.filter(x => x !== v);
    if (!v.free) G.pool++;
    G.uiVersion++;
  }

  function remapVehicle(v) {
    // le brancardier reprend au service vers lequel il roulait, ou au plus proche
    const l = v.line;
    let idx = l.nodes.indexOf(v.targetId);
    if (idx < 0) {
      let best = Infinity;
      l.nodes.forEach((id, i) => { const n = nodeById(id); const d = l.lift ? Math.abs(n.z - v.z) : Math.hypot(n.x - v.x, n.y - v.y); if (d < best) { best = d; idx = i; } });
    }
    v.ti = idx; v.si = idx;
    v.pos = l.geom.nodeDist[idx];
    v.td = v.pos;
    v.state = 'move';
    if (!l.loop) {
      if (idx === 0) v.dir = 1;
      else if (idx === l.nodes.length - 1) v.dir = -1;
    } else v.dir = 1;
  }

  function nextStop(v, i) {
    const l = v.line, n = l.nodes.length;
    if (l.loop) return { i: (i + 1) % n, dir: 1 };
    let d = v.dir;
    if (i + d < 0 || i + d >= n) d = -d;
    return { i: i + d, dir: d };
  }

  function arrive(v) {
    const l = v.line;
    v.si = v.ti;
    if (l.loop && v.si === 0) v.pos = 0;
    const node = nodeById(l.nodes[v.si]);
    const nx = nextStop(v, v.si);
    const nextId = l.nodes[nx.i];
    const w = edgeCost(l);
    let moves = 0, clean = false;
    // Descente : arrivé à destination, ou correspondance.
    for (const e of v.cargo.slice()) {
      const out = (e.kind === 'patient' && wants(e) === node.type) || (e.kind === 'dose' && node.type === 'MN');
      if (!out && progresses(e, node.id, nextId, true, w)) continue;
      v.cargo.splice(v.cargo.indexOf(e), 1);
      if (out) deliver(e, node); else node.waiting.push(e);
      if (l.lift && e.inf) clean = true;
      moves++;
    }
    // Montée : priorité à la gravité, puis au temps restant. Un patient radioactif, ou contagieux
    // dans une cabine d'ascenseur, voyage seul. La cabine est nettoyée après un contagieux.
    const solo = e => e.kind === 'patient' && (e.rad || (e.inf && l.lift));
    const cap = vehCap(v);
    if (!clean) {
      const cands = node.waiting.filter(e => canRide(e, l.kind) && progresses(e, node.id, nextId, false, w));
      cands.sort((a, b) => priority(a) - priority(b));
      for (const e of cands) {
        if (v.cargo.length >= cap || v.cargo.some(solo)) break;
        if (solo(e) && v.cargo.length) continue;
        node.waiting.splice(node.waiting.indexOf(e), 1);
        v.cargo.push(e);
        moves++;
      }
    }
    v.state = 'stop';
    v.clean = clean ? LIFT_CLEAN : 0;
    v.wait = (moves ? 0.35 + moves * 0.22 : 0.12) + v.clean; // sans échange, le brancardier ne fait que passer
  }

  function priority(e) {
    if (e.kind === 'dose') return 1.5 + e.life / DOSE_LIFE;
    return e.tri + e.patience / e.maxPatience;
  }

  function depart(v) {
    const l = v.line, n = l.nodes.length;
    const nx = nextStop(v, v.si);
    v.dir = nx.dir;
    v.ti = nx.i;
    v.targetId = l.nodes[nx.i];
    v.td = l.loop && nx.i === 0 && v.si === n - 1 ? l.geom.L : l.geom.nodeDist[nx.i];
    v.state = 'move';
  }

  function updateVehicles(dt) {
    for (const v of G.vehicles) {
      if (v.state === 'stop') {
        v.wait -= dt;
        if (v.wait <= 0) depart(v);
      } else {
        const sgn = v.td >= v.pos ? 1 : -1;
        v.pos += sgn * VEH_SPEED * dt;
        if ((sgn > 0 && v.pos >= v.td) || (sgn < 0 && v.pos <= v.td)) { v.pos = v.td; arrive(v); }
      }
      if (v.clean > 0) v.clean -= dt;
      if (v.line.lift) {
        // une cabine se repère par son niveau ; on la dessine dans sa cage
        const l = v.line, c = l.shaft.core;
        const idx = clamp(Math.round(v.pos / LIFT_DIST), 0, l.nodes.length - 1);
        v.z = nodeById(l.nodes[idx]).z;
        v.zf = nodeById(l.nodes[0]).z + v.pos / LIFT_DIST;
        v.x = c.x + c.w / 2; v.y = c.y + c.h / 2;
        continue;
      }
      const p = pointAt(v.line.geom, v.pos);
      v.x = p.x; v.y = p.y;
      // l'angle suit le sens de marche
      v.a = p.a + ((v.state === 'move' ? (v.td >= v.pos ? 1 : -1) : v.dir) < 0 && !v.line.loop ? Math.PI : 0);
    }
  }

  // ================================================================
  // Soins, délais, saturation
  // ================================================================
  function updateNodes(dt) {
    for (const n of G.nodes) {
      const T = TYPES[n.type];
      if (T.proc > 0) {
        while (n.treating.length < n.slots && n.queue.length) {
          if (n.type === 'MN' && !n.doses.length) break;
          let bi = 0;
          for (let i = 1; i < n.queue.length; i++) {
            const a = n.queue[i], b = n.queue[bi];
            if (a.tri < b.tri || (a.tri === b.tri && a.qt < b.qt)) bi = i;
          }
          const p = n.queue.splice(bi, 1)[0];
          if (n.type === 'MN') n.doses.shift();
          n.treating.push({ p, t: 0, T: T.proc * rand(0.85, 1.15) });
        }
        for (const tr of n.treating) tr.t += dt;
        const done = n.treating.filter(tr => tr.t >= tr.T);
        if (done.length) {
          n.treating = n.treating.filter(tr => tr.t < tr.T);
          for (const tr of done) finishStep(tr.p, n);
        }
      }
      // Radiopharmacie : production de doses.
      // Radiopharmacie : production de doses, à flux tendu.
      if (n.type === 'RPH' && hasType('MN')) {
        n.rphT -= dt;
        if (n.rphT <= 0) {
          n.rphT = DOSE_EVERY;
          if (dosesInSystem() < 1 + G.nodes.filter(m => m.type === 'MN').length) {
            n.waiting.push({ id: uid++, kind: 'dose', life: DOSE_LIFE });
          }
        }
      }
      // Saturation.
      const load = crowd(n);
      if (load > n.cap) n.over += dt;
      else n.over = Math.max(0, n.over - dt * 0.5);
      if (n.over >= OVERFLOW_LIMIT) {
        gameOver(`${TYPES[n.type].name} ${atFloor(n.z)} : salle d’attente saturée trop longtemps.`);
        return;
      }
    }
  }
  function dosesInSystem() {
    let c = 0;
    for (const n of G.nodes) { c += n.doses.length; for (const e of n.waiting) if (e.kind === 'dose') c++; }
    for (const v of G.vehicles) for (const e of v.cargo) if (e.kind === 'dose') c++;
    return c;
  }
  function crowd(n) {
    let c = n.queue.length;
    for (const e of n.waiting) if (e.kind === 'patient') c++;
    return c;
  }

  function updateTimers(dt) {
    const tick = (arr, x, y, z) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const e = arr[i];
        if (e.kind === 'dose') {
          e.life -= dt;
          if (e.life <= 0) { arr.splice(i, 1); G.dosesLost++; floater(x, y - 20, 'Dose périmée', 'muted', z); }
          continue;
        }
        e.patience -= dt;
        // Réévaluation : un semi-urgent qui attend trop s'aggrave et passe en urgence.
        if (e.tri === 3 && !e.aggr && e.patience < e.maxPatience * AGGRAVATION) {
          e.aggr = true; e.tri = 2; G.aggravated++;
          e.maxPatience = TRIAGE[2].patience * 0.6; e.patience = e.maxPatience;
          floater(x, y - 20, 'Aggravation', 't2', z);
        }
        if (e.patience <= 0) {
          arr.splice(i, 1);
          if (e.tri <= 2) {
            G.incidents++;
            G.eig.push({ name: e.name, tri: e.tri, want: TYPES[wants(e)].name, z, t: G.t });
            floater(x, y - 20, 'EIG', 't1', z);
            toast(`<b>Événement indésirable grave</b> ${atFloor(z)} : ${e.name} (${TRIAGE[e.tri].name.toLowerCase()}) n’a pas été pris en charge à temps.`, true);
            if (G.incidents >= MAX_INCIDENTS) gameOver('Trois événements indésirables graves : l’ARS suspend l’activité de vos urgences.');
          } else {
            G.lwbs++;
            floater(x, y - 20, 'Parti sans soins', 'muted', z);
          }
        }
      }
    };
    for (const n of G.nodes) { tick(n.waiting, n.x, n.y, n.z); tick(n.queue, n.x, n.y, n.z); tick(n.doses, n.x, n.y, n.z); }
    for (const v of G.vehicles) tick(v.cargo, v.x, v.y, v.z);
  }

  function floater(x, y, text, color, z) { G.floaters.push({ x, y, text, color, z, t: 0 }); }

  // ================================================================
  // Boucle de simulation
  // ================================================================
  function step(dt) {
    G.t += dt;
    updateRegion();
    runSchedule();
    if (G.t >= 3) {
      G.spawnT -= dt;
      if (G.spawnT <= 0) { spawnPatient(); G.spawnT = spawnInterval(); }
    }
    updateVehicles(dt);
    updateNodes(dt);
    if (G.over) return;
    updateTimers(dt);
    for (const f of G.floaters) f.t += dt;
    G.floaters = G.floaters.filter(f => f.t < 1.6);
    if (!G.over && G.t >= G.nextWeek) endWeek();
  }

  // ================================================================
  // Rendu
  // ================================================================
  function measure() {
    DPR = Math.min(2.5, window.devicePixelRatio || 1);
    CW = canvas.clientWidth; CH = canvas.clientHeight;
    canvas.width = Math.round(CW * DPR); canvas.height = Math.round(CH * DPR);
    const top = $('.hud-top').getBoundingClientRect();
    const bot = $('#hudBottom').getBoundingClientRect();
    HUD_TOP = top.bottom + 8;
    $('#toasts').style.top = (top.bottom + 8) + 'px';
    HUD_BOTTOM = CH - bot.top + 8;
  }

  function updateCamera() {
    const R = G.region, m = 40;
    const side = G.floors.length > 1 ? FLOORBAR_W : 0;
    const availW = CW - 16 - side, availH = Math.max(120, CH - HUD_TOP - HUD_BOTTOM);
    const s = Math.min(availW / (R.w + m * 2), availH / (R.h + m * 2));
    const ox = side + availW / 2 + 8 - (R.x + R.w / 2) * s;
    const oy = HUD_TOP + availH / 2 - (R.y + R.h / 2) * s;
    if (!cam.ready) { cam.s = s; cam.ox = ox; cam.oy = oy; cam.ready = true; return; }
    const k = 0.08;
    cam.s += (s - cam.s) * k; cam.ox += (ox - cam.ox) * k; cam.oy += (oy - cam.oy) * k;
  }
  const FLOORBAR_W = 72;
  const toWorld = (sx, sy) => ({ x: (sx - cam.ox) / cam.s, y: (sy - cam.oy) / cam.s });
  const toScreen = (x, y) => ({ x: x * cam.s + cam.ox, y: y * cam.s + cam.oy });

  function shapePath(c, shape, x, y, r) {
    c.beginPath();
    switch (shape) {
      case 'circle': c.arc(x, y, r, 0, Math.PI * 2); break;
      case 'square': c.rect(x - r * 0.88, y - r * 0.88, r * 1.76, r * 1.76); break;
      case 'triangle': c.moveTo(x, y - r * 1.1); c.lineTo(x + r * 1.05, y + r * 0.75); c.lineTo(x - r * 1.05, y + r * 0.75); c.closePath(); break;
      case 'diamond': c.moveTo(x, y - r * 1.15); c.lineTo(x + r * 1.05, y); c.lineTo(x, y + r * 1.15); c.lineTo(x - r * 1.05, y); c.closePath(); break;
      case 'pentagon': poly(c, x, y, r * 1.05, 5, -Math.PI / 2); break;
      case 'hexagon': poly(c, x, y, r * 1.02, 6, 0); break;
      case 'star': {
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.52 : r * 1.15;
          i ? c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        c.closePath(); break;
      }
      case 'cross': {
        const a = r * 0.42, b = r * 1.05;
        c.moveTo(x - a, y - b); c.lineTo(x + a, y - b); c.lineTo(x + a, y - a); c.lineTo(x + b, y - a); c.lineTo(x + b, y + a);
        c.lineTo(x + a, y + a); c.lineTo(x + a, y + b); c.lineTo(x - a, y + b); c.lineTo(x - a, y + a); c.lineTo(x - b, y + a);
        c.lineTo(x - b, y - a); c.lineTo(x - a, y - a); c.closePath(); break;
      }
      case 'heart': {
        const s = r * 1.05;
        c.moveTo(x, y + s * 0.95);
        c.bezierCurveTo(x - s * 1.4, y + s * 0.05, x - s * 0.85, y - s * 1.15, x, y - s * 0.4);
        c.bezierCurveTo(x + s * 0.85, y - s * 1.15, x + s * 1.4, y + s * 0.05, x, y + s * 0.95);
        c.closePath(); break;
      }
      case 'trefoil': c.arc(x, y, r, 0, Math.PI * 2); break;
      case 'lift':
        c.moveTo(x, y - r * 1.15); c.lineTo(x + r * 0.75, y - r * 0.2); c.lineTo(x - r * 0.75, y - r * 0.2); c.closePath();
        c.moveTo(x, y + r * 1.15); c.lineTo(x - r * 0.75, y + r * 0.2); c.lineTo(x + r * 0.75, y + r * 0.2); c.closePath();
        break;
      case 'crescent':
        c.arc(x, y, r * 1.05, Math.PI * 0.25, Math.PI * 1.75);
        c.arc(x + r * 0.55, y, r * 0.75, Math.PI * 1.62, Math.PI * 0.38, true);
        c.closePath(); break;
      case 'semicircle': c.arc(x, y + r * 0.45, r * 1.15, Math.PI, 0); c.closePath(); break;
      case 'bolt':
        c.moveTo(x + r * 0.2, y - r * 1.15); c.lineTo(x - r * 0.8, y + r * 0.15); c.lineTo(x - r * 0.05, y + r * 0.15);
        c.lineTo(x - r * 0.3, y + r * 1.15); c.lineTo(x + r * 0.85, y - r * 0.2); c.lineTo(x + r * 0.1, y - r * 0.2);
        c.closePath(); break;
      case 'drop':
        c.moveTo(x, y - r * 1.2);
        c.bezierCurveTo(x + r * 0.5, y - r * 0.5, x + r * 1.0, y, x + r * 0.95, y + r * 0.35);
        c.arc(x, y + r * 0.35, r * 0.95, 0, Math.PI);
        c.bezierCurveTo(x - r * 1.0, y, x - r * 0.5, y - r * 0.5, x, y - r * 1.2);
        c.closePath(); break;
      default: c.arc(x, y, r, 0, Math.PI * 2);
    }
  }
  function poly(c, x, y, r, n, a0) {
    for (let i = 0; i < n; i++) {
      const a = a0 + i * Math.PI * 2 / n;
      i ? c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r) : c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    c.closePath();
  }
  function trefoil(c, x, y, r, fg, bg) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = bg; c.fill();
    c.fillStyle = fg;
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + k * Math.PI * 2 / 3;
      c.beginPath(); c.moveTo(x, y);
      c.arc(x, y, r * 0.82, a - Math.PI / 6, a + Math.PI / 6); c.closePath(); c.fill();
    }
    c.beginPath(); c.arc(x, y, r * 0.22, 0, Math.PI * 2); c.fillStyle = bg; c.fill();
    c.beginPath(); c.arc(x, y, r * 0.14, 0, Math.PI * 2); c.fillStyle = fg; c.fill();
  }

  // Un patient est dessiné avec la forme du service qu'il attend, dans la couleur de son tri.
  function drawEntity(c, e, x, y, r, blink) {
    if (e.kind === 'dose') {
      const low = e.life / DOSE_LIFE;
      c.globalAlpha = 0.45 + 0.55 * low;
      trefoil(c, x, y, r * 1.05, C['rad-ink'], C.rad);
      c.globalAlpha = 1;
      return;
    }
    const shape = TYPES[wants(e)].shape;
    const ratio = e.patience / e.maxPatience;
    let alpha = 1;
    if (blink && ratio < 0.3 && !reduceMotion) alpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(G.t * 10));
    c.globalAlpha = alpha;
    if (e.inf || e.rad) {
      c.beginPath(); c.arc(x, y, r * 1.75, 0, Math.PI * 2);
      c.lineWidth = r * 0.55;
      c.strokeStyle = e.inf ? C.sep : C.rad;
      c.setLineDash(e.inf ? [r * 0.7, r * 0.5] : []);
      c.stroke(); c.setLineDash([]);
    }
    shapePath(c, shape, x, y, r);
    c.fillStyle = C[TRIAGE[e.tri].color];
    c.fill();
    c.lineWidth = r * 0.28; c.strokeStyle = C.ink; c.stroke();
    c.globalAlpha = 1;
  }

  function strokeLine(c, pts, color, kind, width, alpha = 1) {
    if (pts.length < 2) return;
    c.globalAlpha = alpha;
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.strokeStyle = C.floor; c.lineWidth = width + 3.5; c.stroke();
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
    if (kind === 'sep') {
      c.setLineDash([7, 7]); c.strokeStyle = C.node; c.lineWidth = width * 0.38; c.lineCap = 'butt'; c.stroke(); c.setLineDash([]);
    } else if (kind === 'rad') {
      c.setLineDash([5, 6]); c.strokeStyle = C['rad-ink']; c.lineWidth = width * 0.55; c.lineCap = 'butt'; c.stroke(); c.setLineDash([]);
    }
    c.globalAlpha = 1;
  }

  function endHandles(l) {
    if (l.loop || l.lift) return [];
    const p = l.geom.pts, out = [];
    if (p.length < 2) return out;
    const mk = (a, b, end) => {
      let dx = a.x - b.x, dy = a.y - b.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
      const tip = { x: a.x + dx * 26, y: a.y + dy * 26 };
      return { end, base: a, tip, dx, dy, line: l };
    };
    // on cherche un point d'appui distinct pour donner la direction
    let j = 1; while (j < p.length - 1 && dist(p[0], p[j]) < 1) j++;
    out.push(mk(p[0], p[j], 'head'));
    let k = p.length - 2; while (k > 0 && dist(p[p.length - 1], p[k]) < 1) k--;
    out.push(mk(p[p.length - 1], p[k], 'tail'));
    return out;
  }

  let colorTick = 0;
  function render() {
    if (++colorTick % 30 === 0) readColors();
    const c = ctx;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.fillStyle = C.bg; c.fillRect(0, 0, CW, CH);
    if (!G) return;
    c.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * cam.ox, DPR * cam.oy);

    // On ne dessine que le niveau affiché.
    const z = G.view;
    const lines = G.lines.filter(l => !l.lift && l.z === z);
    const nodes = G.nodes.filter(n => n.z === z);
    drawPlan(c);
    drawObstacles(c, z);
    for (const n of nodes) drawRoom(c, n);

    // Passerelles : un tablier sous chaque circuit qui franchit un patio.
    for (const l of lines) {
      for (const [a, b] of linePairs(l)) {
        for (const o of routeInfo(nodeById(a), nodeById(b)).patios) {
          c.save();
          c.beginPath(); c.rect(o.x - 4, o.y - 4, o.w + 8, o.h + 8); c.clip();
          const pts = l.geom.pts;
          c.beginPath(); c.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
          c.lineJoin = 'round'; c.lineCap = 'butt';
          c.strokeStyle = C.wall; c.lineWidth = LINE_W + 12; c.stroke();
          c.strokeStyle = C.floor; c.lineWidth = LINE_W + 7; c.stroke();
          c.restore();
        }
      }
    }

    // Circuits : bandes de guidage au sol, bordées de blanc.
    for (const l of lines) {
      const hidden = drag && drag.line === l && (drag.mode === 'extend' || drag.mode === 'insert');
      strokeLine(c, l.geom.pts, C[l.color], l.kind, LINE_W, hidden ? 0.25 : 1);
      if (!hidden) for (const h of endHandles(l)) {
        c.strokeStyle = C[l.color]; c.lineWidth = LINE_W; c.lineCap = 'butt';
        c.beginPath(); c.moveTo(h.base.x, h.base.y); c.lineTo(h.tip.x, h.tip.y); c.stroke();
        c.beginPath(); c.moveTo(h.tip.x - h.dy * 9, h.tip.y + h.dx * 9); c.lineTo(h.tip.x + h.dy * 9, h.tip.y - h.dx * 9); c.stroke();
      }
    }
    drawDragPreview(c);

    // Brancardiers : un brancard vu de dessus, avec son oreiller à l'avant.
    for (const v of G.vehicles) {
      if (v.line.lift || v.z !== z) continue;
      const cap = vehCap(v), cols = Math.ceil(cap / 2);
      const len = Math.max(26, cols * 8 + 12), wid = 15;
      c.save(); c.translate(v.x, v.y); c.rotate(v.a);
      c.fillStyle = C.ink;
      for (const [wx, wy] of [[-len / 2 + 3, -wid / 2 - 1], [len / 2 - 3, -wid / 2 - 1], [-len / 2 + 3, wid / 2 + 1], [len / 2 - 3, wid / 2 + 1]]) {
        c.beginPath(); c.arc(wx, wy, 1.8, 0, Math.PI * 2); c.fill();
      }
      roundRect(c, -len / 2, -wid / 2, len, wid, 3.5);
      c.fillStyle = C.node; c.fill();
      c.lineWidth = 2.6; c.strokeStyle = C[v.line.color]; c.stroke();
      roundRect(c, len / 2 - 7, -wid / 2 + 3, 4.5, wid - 6, 1.5);
      c.fillStyle = C['line-soft']; c.fill();
      v.cargo.forEach((e, i) => {
        const col = Math.floor(i / 2), row = i % 2;
        const ex = -len / 2 + 6 + col * 8, ey = row ? 3.4 : -3.4;
        c.save(); c.translate(ex, ey); c.rotate(-v.a);
        drawEntity(c, e, 0, 0, 2.6, false);
        c.restore();
      });
      c.restore();
    }

    // Services.
    const hover = drag ? drag.hover : null;
    for (const n of nodes) drawNode(c, n, n === hover);
    drawChooser(c);
    drawMoveGhost(c, z);

    // Textes flottants.
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const f of G.floaters) {
      if (f.z !== undefined && f.z !== z) continue;
      c.globalAlpha = 1 - f.t / 1.6;
      c.font = `700 ${f.text.length > 3 ? 11 : 14}px ${getFont('data')}`;
      c.fillStyle = C[f.color] || C.ink;
      c.fillText(f.text, f.x, f.y - f.t * 18);
    }
    c.globalAlpha = 1;
  }

  // Plan d'architecte : dalle, trame structurelle en trait mixte, axes repérés, murs extérieurs.
  function drawPlan(c) {
    const R = G.region;
    c.fillStyle = C.floor;
    c.fillRect(R.x, R.y, R.w, R.h);
    c.save();
    c.beginPath(); c.rect(R.x, R.y, R.w, R.h); c.clip();
    c.strokeStyle = C.grid; c.lineWidth = 1.2; c.setLineDash([14, 5, 2, 5]);
    c.beginPath();
    for (let x = Math.ceil(R.x / BAY) * BAY; x < R.x + R.w; x += BAY) { c.moveTo(x, R.y); c.lineTo(x, R.y + R.h); }
    for (let y = Math.ceil(R.y / BAY) * BAY; y < R.y + R.h; y += BAY) { c.moveTo(R.x, y); c.lineTo(R.x + R.w, y); }
    c.stroke(); c.setLineDash([]);
    c.restore();
    // murs extérieurs : trait épais doublé d'un parement
    c.strokeStyle = C.wall; c.lineWidth = 6; c.lineJoin = 'miter';
    c.strokeRect(R.x, R.y, R.w, R.h);
    c.lineWidth = 1.2;
    c.strokeRect(R.x + 7, R.y + 7, R.w - 14, R.h - 14);
    // repères d'axes dans des bulles, en haut et à gauche
    c.font = `600 9px ${getFont('data')}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 1.2;
    for (let x = Math.ceil(R.x / BAY) * BAY; x < R.x + R.w; x += BAY) {
      bubble(c, x, R.y - 17, axisLetter(Math.round(x / BAY)));
    }
    for (let y = Math.ceil(R.y / BAY) * BAY; y < R.y + R.h; y += BAY) {
      bubble(c, R.x - 17, y, String(Math.round(y / BAY) + 1));
    }
    // cartouche du niveau, en bas à gauche du plan
    const F = FLOORS[G.view];
    c.font = `700 11px ${getFont('data')}`; c.textAlign = 'left'; c.textBaseline = 'bottom';
    c.fillStyle = C.muted;
    c.fillText(`NIVEAU ${F.label} · ${F.name.toUpperCase()} · ${F.sub.toUpperCase()}`, R.x + 16, R.y + R.h - 14);
  }
  function bubble(c, x, y, txt) {
    c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2);
    c.fillStyle = C.bg; c.fill(); c.strokeStyle = C.wall; c.stroke();
    c.fillStyle = C.muted; c.fillText(txt, x, y + 0.5);
  }

  // Obstacles : patio planté, noyau d'ascenseurs (symbole de cabine barrée), bunker en béton.
  function drawObstacles(c, z) {
    const R = G.region;
    c.save();
    c.beginPath(); c.rect(R.x, R.y, R.w, R.h); c.clip();
    for (const o of G.obstacles) {
      if (obstOn(o, z) && rectHit(o.x, o.y, o.x + o.w, o.y + o.h, R, 0)) drawObstacle(c, o, true, z);
    }
    c.restore();
  }

  function drawObstacle(c, o, withLabel, z = 0) {
    const shaft = o.kind === 'core' && G ? G.shafts.find(s => s.core === o) : null;
    if (o.kind === 'patio' && z > 0) {
      // aux étages, le patio est un vide : contour et croix de Saint-André, comme sur un plan
      c.fillStyle = C.bg; c.fillRect(o.x, o.y, o.w, o.h);
      c.strokeStyle = C.wall; c.lineWidth = 1;
      c.beginPath(); c.moveTo(o.x, o.y); c.lineTo(o.x + o.w, o.y + o.h); c.moveTo(o.x + o.w, o.y); c.lineTo(o.x, o.y + o.h); c.stroke();
      c.lineWidth = 1.6; c.strokeRect(o.x, o.y, o.w, o.h);
    } else if (o.kind === 'patio') {
      c.fillStyle = C.garden; c.fillRect(o.x, o.y, o.w, o.h);
      // arbres : positions tirées de la graine de l'obstacle, stables d'une image à l'autre
      let sd = o.seed * 9301;
      const rnd = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
      const trees = Math.round(o.w * o.h / 2600);
      c.strokeStyle = C['garden-ink']; c.lineWidth = 1;
      for (let i = 0; i < trees; i++) {
        const tx = o.x + 14 + rnd() * (o.w - 28), ty = o.y + 14 + rnd() * (o.h - 28), tr = 6 + rnd() * 6;
        c.beginPath(); c.arc(tx, ty, tr, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(tx, ty, 1.2, 0, Math.PI * 2); c.fillStyle = C['garden-ink']; c.fill();
      }
      // façade vitrée : trait double fin
      c.strokeStyle = C.wall; c.lineWidth = 1.2;
      c.strokeRect(o.x, o.y, o.w, o.h); c.strokeRect(o.x + 3, o.y + 3, o.w - 6, o.h - 6);
    } else {
      const thick = o.kind === 'bunker' ? 9 : 4;
      c.fillStyle = C.room; c.fillRect(o.x, o.y, o.w, o.h);
      // poché hachuré des parties pleines
      c.save(); c.beginPath(); c.rect(o.x, o.y, o.w, o.h); c.clip();
      c.strokeStyle = C.wall; c.lineWidth = 1; c.globalAlpha = 0.55;
      c.beginPath();
      for (let k = -o.h; k < o.w; k += 6) { c.moveTo(o.x + k, o.y + o.h); c.lineTo(o.x + k + o.h, o.y); }
      c.stroke(); c.restore();
      c.strokeStyle = C.wall; c.lineWidth = thick;
      c.strokeRect(o.x + thick / 2, o.y + thick / 2, o.w - thick, o.h - thick);
      if (o.kind === 'core') {
        // cabines d'ascenseur : carrés barrés d'une croix
        const n = Math.max(1, Math.round(Math.max(o.w, o.h) / 22)), horiz = o.w >= o.h;
        const cs = Math.min(horiz ? o.w / n : o.w, horiz ? o.h : o.h / n) - 8;
        const cabins = shaft ? G.vehicles.filter(v => v.line === shaft.line) : [];
        for (let i = 0; i < n; i++) {
          const cx = horiz ? o.x + (i + 0.5) * o.w / n : o.x + o.w / 2, cy = horiz ? o.y + o.h / 2 : o.y + (i + 0.5) * o.h / n;
          const cab = cabins[i];
          c.fillStyle = C.floor; c.fillRect(cx - cs / 2, cy - cs / 2, cs, cs);
          c.strokeStyle = C.ink; c.lineWidth = 1;
          c.strokeRect(cx - cs / 2, cy - cs / 2, cs, cs);
          if (!cab) {
            c.beginPath(); c.moveTo(cx - cs / 2, cy - cs / 2); c.lineTo(cx + cs / 2, cy + cs / 2);
            c.moveTo(cx + cs / 2, cy - cs / 2); c.lineTo(cx - cs / 2, cy + cs / 2); c.stroke();
          } else if (Math.abs(cab.zf - z) < 0.35) {
            // cabine à ce niveau : remplie, avec ses brancards ; hachurée pendant le nettoyage
            c.fillStyle = cab.clean > 0 ? C.sep : C.accent; c.fillRect(cx - cs / 2, cy - cs / 2, cs, cs);
            cab.cargo.forEach((e, k) => drawEntity(c, e, cx + (k ? 3 : -3) * (cab.cargo.length > 1 ? 1 : 0), cy, 2.4, false));
          } else {
            // cabine ailleurs : une flèche indique où elle est
            const up = cab.zf > z;
            c.fillStyle = C.muted;
            c.beginPath();
            c.moveTo(cx, cy + (up ? -cs * 0.3 : cs * 0.3)); c.lineTo(cx + cs * 0.3, cy + (up ? cs * 0.2 : -cs * 0.2)); c.lineTo(cx - cs * 0.3, cy + (up ? cs * 0.2 : -cs * 0.2));
            c.closePath(); c.fill();
          }
        }
      }
    }
    if (!withLabel) return;
    const lbl = shaft ? `ASCENSEUR ${shaft.letter}` : o.kind === 'patio' && z > 0 ? 'VIDE SUR PATIO' : OBSTACLES[o.kind].label;
    c.font = `600 8px ${getFont('data')}`; c.textAlign = 'center'; c.textBaseline = 'top';
    const tw = c.measureText(lbl).width + 8;
    const ly = shaft ? o.y - 14 : o.kind === 'core' ? o.y + o.h + 4 : o.y + 6;
    c.fillStyle = C.floor; c.fillRect(o.x + o.w / 2 - tw / 2, ly - 1, tw, 11);
    c.fillStyle = o.kind === 'patio' ? C['garden-ink'] : C.muted;
    c.fillText(lbl, o.x + o.w / 2, ly);
  }

  // Chaque service occupe une pièce, porte en bas avec son débattement.
  const ROOM = { l: 40, r: 40, t: 36, b: 46, door: 22 };
  function drawRoom(c, n) {
    if (n.type === 'ASC') {
      // dégagement entre la cage et le palier
      const o = n.shaft.core, y0 = o.y + o.h, y1 = n.y - ROOM.t;
      c.fillStyle = C.room; c.fillRect(n.x - 12, y0, 24, y1 - y0);
      c.strokeStyle = C.wall; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(n.x - 12, y0); c.lineTo(n.x - 12, y1); c.moveTo(n.x + 12, y0); c.lineTo(n.x + 12, y1); c.stroke();
    }
    const x0 = n.x - ROOM.l, x1 = n.x + ROOM.r, y0 = n.y - ROOM.t, y1 = n.y + ROOM.b;
    c.fillStyle = C.room;
    c.fillRect(x0, y0, x1 - x0, y1 - y0);
    const d0 = n.x - ROOM.door / 2, d1 = n.x + ROOM.door / 2;
    c.strokeStyle = C.wall; c.lineWidth = 2.2; c.lineCap = 'square';
    c.beginPath();
    c.moveTo(d0, y1); c.lineTo(x0, y1); c.lineTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x1, y1); c.lineTo(d1, y1);
    c.stroke();
    // vantail ouvert vers l'intérieur et arc de débattement
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(d0, y1); c.lineTo(d0, y1 - ROOM.door); c.stroke();
    c.setLineDash([2, 2]);
    c.beginPath(); c.arc(d0, y1, ROOM.door, -Math.PI / 2, 0); c.stroke();
    c.setLineDash([]);
    if (n.type === 'ASC') { c.fillStyle = C.room; c.fillRect(n.x - 10.8, y0 - 1.5, 21.6, 3); }
    c.font = `500 7px ${getFont('data')}`; c.textAlign = 'left'; c.textBaseline = 'top';
    c.fillStyle = C.muted;
    c.fillText(n.code, x0 + 4, y0 + 4);
  }

  const fontCache = {};
  function getFont(role = 'ui') {
    if (!fontCache[role]) fontCache[role] = getComputedStyle(document.documentElement).getPropertyValue('--font-' + role).trim() || 'sans-serif';
    return fontCache[role];
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // Panneau de signalétique : pictogramme blanc sur fond bleu, rouge pour les urgences,
  // jaune et noir pour la radiopharmacie.
  function signPanel(c, type, x, y, r) {
    const bg = type === 'URG' ? C.t1 : type === 'RPH' ? C.rad : C.sign;
    roundRect(c, x - r, y - r, r * 2, r * 2, r * 0.3);
    c.fillStyle = bg; c.fill();
    if (type === 'RPH') { trefoil(c, x, y, r * 0.62, C['rad-ink'], C.rad); return; }
    shapePath(c, TYPES[type].shape, x, y, r * 0.55);
    c.fillStyle = C['sign-ink']; c.fill();
  }

  function drawNode(c, n, hovered) {
    const T = TYPES[n.type];
    const age = G.t - n.born;
    const sc = age < 0.5 && !reduceMotion ? 0.4 + 1.2 * age : 1;
    const r = NODE_R * sc;
    // anneau de saturation
    if (n.over > 0) {
      const f = n.over / OVERFLOW_LIMIT;
      c.beginPath(); c.arc(n.x, n.y, r + 13, 0, Math.PI * 2);
      c.fillStyle = C.danger; c.globalAlpha = 0.12 + 0.18 * f; c.fill(); c.globalAlpha = 1;
      c.beginPath(); c.arc(n.x, n.y, r + 13, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
      c.strokeStyle = C.danger; c.lineWidth = 4; c.lineCap = 'round'; c.stroke();
    }
    if (hovered) {
      roundRect(c, n.x - r - 6, n.y - r - 6, (r + 6) * 2, (r + 6) * 2, 8);
      c.strokeStyle = C.ink; c.globalAlpha = 0.3; c.lineWidth = 3; c.stroke(); c.globalAlpha = 1;
    }
    signPanel(c, n.type, n.x, n.y, r);
    // postes de soin : un lit par poste, rempli selon l'avancement du soin
    if (n.slots > 0) {
      const bw = 9, bh = 4.5, gap = 3, tot = n.slots * bw + (n.slots - 1) * gap;
      for (let i = 0; i < n.slots; i++) {
        const bx = n.x - tot / 2 + i * (bw + gap), by = n.y + r + 4;
        c.fillStyle = C.node; c.fillRect(bx, by, bw, bh);
        const tr = n.treating[i];
        if (tr) { c.fillStyle = C.accent; c.fillRect(bx, by, bw * Math.min(1, tr.t / tr.T), bh); }
        c.strokeStyle = C.wall; c.lineWidth = 1; c.strokeRect(bx, by, bw, bh);
      }
    }
    // libellé de signalétique
    c.font = `700 10px ${getFont('sign')}`;
    c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillStyle = C.ink;
    c.fillText(n.type === 'ASC' ? `ASCENSEUR ${n.shaft.letter}` : T.sign, n.x, n.y + r + (n.slots > 0 ? 12 : 5));
    // doses en stock
    if (n.type === 'MN') {
      n.doses.forEach((d, i) => {
        c.globalAlpha = 0.45 + 0.55 * d.life / DOSE_LIFE;
        trefoil(c, n.x - (n.doses.length - 1) * 5 + i * 10, n.y - r - 9, 4, C['rad-ink'], C.rad);
        c.globalAlpha = 1;
      });
    }
    // patients en attente de transport (à droite) et en file de soins (à gauche)
    const per = 5, sp = 10.5;
    n.waiting.slice(0, 15).forEach((e, i) => {
      const col = i % per, row = Math.floor(i / per);
      drawEntity(c, e, n.x + r + 12 + col * sp, n.y - 9 + row * sp, 3.9, true);
    });
    if (n.waiting.length > 15) {
      c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = `600 9px ${getFont('data')}`;
      c.fillText('+' + (n.waiting.length - 15), n.x + r + 12 + per * sp, n.y + 12);
    }
    n.queue.slice(0, 10).forEach((e, i) => {
      const col = i % per, row = Math.floor(i / per);
      drawQueued(c, e, n.x - r - 10 - col * sp * 0.8, n.y - 9 + row * sp);
    });
  }
  // Patient en file de soins : il est arrivé, on montre son urgence par un point.
  function drawQueued(c, e, x, y) {
    const ratio = e.patience / e.maxPatience;
    c.globalAlpha = ratio < 0.3 && !reduceMotion ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(G.t * 10)) : 1;
    c.beginPath(); c.arc(x, y, 3.2, 0, Math.PI * 2);
    c.fillStyle = C[TRIAGE[e.tri].color]; c.fill();
    c.lineWidth = 1; c.strokeStyle = C.ink; c.stroke();
    c.globalAlpha = 1;
  }

  // Déménagement : le service choisi est entouré ; sa pièce suit le pointeur, verte ou rouge selon la place.
  function drawMoveGhost(c, z) {
    if (G.apply !== 'move' || !G.moveNode) return;
    const n = G.moveNode;
    if (n.z === z) {
      c.setLineDash([6, 4]); c.strokeStyle = C.accent; c.lineWidth = 3;
      c.strokeRect(n.x - ROOM.l - 5, n.y - ROOM.t - 5, ROOM.l + ROOM.r + 10, ROOM.t + ROOM.b + 10);
      c.setLineDash([]);
    }
    const p = G.hoverPt;
    if (!p || (n.z === z && dist(p, n) < NODE_R * 2)) return;
    const ok = canPlace(n, p.x, p.y, z).ok;
    c.globalAlpha = 0.85;
    c.fillStyle = ok ? C.room : C.danger;
    c.globalAlpha = ok ? 0.9 : 0.25;
    c.fillRect(p.x - ROOM.l, p.y - ROOM.t, ROOM.l + ROOM.r, ROOM.t + ROOM.b);
    c.globalAlpha = 1;
    c.setLineDash([6, 4]); c.strokeStyle = ok ? C.accent : C.danger; c.lineWidth = 2;
    c.strokeRect(p.x - ROOM.l, p.y - ROOM.t, ROOM.l + ROOM.r, ROOM.t + ROOM.b);
    c.setLineDash([]);
    c.globalAlpha = 0.7; signPanel(c, n.type, p.x, p.y, NODE_R); c.globalAlpha = 1;
  }

  function drawChooser(c) {
    if (!drag || !drag.start) return;
    if (drag.mode === 'new' && drag.downAt && !drag.moved) {
      // anneau qui se remplit pendant l'appui long
      const f = Math.min(1, (performance.now() - drag.downAt) / HOLD_MS), n = drag.start;
      c.beginPath(); c.arc(n.x, n.y, NODE_R + 9, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
      c.strokeStyle = C.accent; c.lineWidth = 3; c.lineCap = 'round'; c.stroke();
      return;
    }
    if (drag.mode !== 'choose') return;
    const n = drag.start, s = 1 / cam.s;
    // anneau de fond : le service reste visible au centre
    c.beginPath(); c.arc(n.x, n.y, drag.R + 20 * s, 0, Math.PI * 2); c.arc(n.x, n.y, NODE_R + 6, 0, Math.PI * 2, true);
    c.fillStyle = C.floor; c.globalAlpha = 0.9; c.fill('evenodd'); c.globalAlpha = 1;
    c.beginPath(); c.arc(n.x, n.y, drag.R + 20 * s, 0, Math.PI * 2);
    c.strokeStyle = C['line-soft']; c.lineWidth = 1.5 * s; c.stroke();
    for (const o of drag.opts) {
      const on = drag.sel === o, r = o.r * (on ? 1.2 : 1);
      if (o.line) {
        c.beginPath(); c.arc(o.x, o.y, r, 0, Math.PI * 2); c.fillStyle = C[o.color]; c.fill();
        if (o.kind !== 'std') {
          c.setLineDash([3 * s, 3 * s]); c.lineWidth = 3 * s; c.strokeStyle = o.kind === 'sep' ? C.floor : C['rad-ink'];
          c.beginPath(); c.arc(o.x, o.y, r * 0.6, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
        }
      } else {
        c.beginPath(); c.arc(o.x, o.y, r, 0, Math.PI * 2); c.fillStyle = C.node; c.fill();
        c.setLineDash([4 * s, 3 * s]); c.lineWidth = 3 * s; c.strokeStyle = C[o.color]; c.stroke(); c.setLineDash([]);
        c.strokeStyle = C.ink; c.lineWidth = 2.4 * s;
        c.beginPath(); c.moveTo(o.x - r * 0.45, o.y); c.lineTo(o.x + r * 0.45, o.y); c.moveTo(o.x, o.y - r * 0.45); c.lineTo(o.x, o.y + r * 0.45); c.stroke();
      }
      if (on) { c.beginPath(); c.arc(o.x, o.y, r + 3.5 * s, 0, Math.PI * 2); c.strokeStyle = C.ink; c.lineWidth = 2.2 * s; c.stroke(); }
    }
    const label = drag.sel ? drag.sel.label.toUpperCase() : 'GLISSEZ VERS UN CIRCUIT';
    c.font = `600 ${10 * s}px ${getFont('data')}`; c.textAlign = 'center'; c.textBaseline = 'bottom';
    const tw = c.measureText(label).width + 12 * s, ty = n.y - drag.R - 24 * s;
    c.fillStyle = C.ink; c.fillRect(n.x - tw / 2, ty - 15 * s, tw, 17 * s);
    c.fillStyle = C.floor; c.fillText(label, n.x, ty);
  }

  function drawDragPreview(c) {
    if (!drag || drag.mode === 'choose' || drag.mode === 'place') return;
    const { nodes, loop, except } = dragNodes(drag);
    const over = nodes.length >= 2 && bridgesUsed(except) + bridgesFor(nodes, loop) > G.bridges;
    const slotColor = over ? C.danger : C[drag.color] || C.ink;
    if (drag.blocked) {
      const from = drag.mode === 'insert' ? nodeById(drag.line.nodes[drag.seg]) : nodeById(drag.list[drag.list.length - 1]);
      c.setLineDash([6, 5]);
      c.strokeStyle = C.danger; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(from.x, from.y); c.lineTo(drag.blocked.x, drag.blocked.y); c.stroke();
      c.setLineDash([]);
      c.font = `700 11px ${getFont('data')}`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillStyle = C.danger;
      c.fillText('PASSAGE IMPOSSIBLE', drag.blocked.x, drag.blocked.y - NODE_R - 10);
    }
    if (drag.mode === 'new' || drag.mode === 'extend') {
      const ids = drag.list;
      const pts = [];
      for (let i = 0; i < ids.length - 1; i++) {
        const seg = segPoints(nodeById(ids[i]), nodeById(ids[i + 1]), 0);
        pts.push(...seg);
      }
      if (drag.loop && ids.length > 2) pts.push(...segPoints(nodeById(ids[ids.length - 1]), nodeById(ids[0]), 0));
      strokeLine(c, pts, slotColor, drag.kind, LINE_W, 0.85);
      if (!drag.loop && drag.pt) {
        const lastN = nodeById(drag.atHead ? ids[0] : ids[ids.length - 1]);
        if (lastN) strokeLine(c, [lastN, drag.pt], slotColor, drag.kind, LINE_W, 0.5);
      }
    } else if (drag.mode === 'insert' && drag.pt) {
      const l = drag.line;
      const tmp = l.nodes.slice();
      if (drag.target) tmp.splice(drag.seg + 1, 0, drag.target.id);
      const pts = [];
      for (let i = 0; i < tmp.length - 1; i++) pts.push(...segPoints(nodeById(tmp[i]), nodeById(tmp[i + 1]), 0));
      if (l.loop) pts.push(...segPoints(nodeById(tmp[tmp.length - 1]), nodeById(tmp[0]), 0));
      strokeLine(c, pts, slotColor, l.kind, LINE_W, 0.85);
      if (!drag.target) {
        const a = nodeById(l.nodes[drag.seg]), b = nodeById(l.nodes[(drag.seg + 1) % l.nodes.length]);
        strokeLine(c, [a, drag.pt, b], slotColor, l.kind, LINE_W * 0.6, 0.5);
      }
    }
  }

  // ================================================================
  // Interaction
  // ================================================================
  let drag = null;

  function nodeAt(p, tolPx = 14) {
    const tol = Math.max(NODE_R + 4, tolPx / cam.s);
    let best = null, bd = Infinity;
    for (const n of G.nodes) { if (n.z !== G.view) continue; const d = dist(n, p); if (d < tol && d < bd) { bd = d; best = n; } }
    return best;
  }
  function handleAt(p) {
    const tol = Math.max(14, 20 / cam.s);
    let best = null, bd = Infinity;
    for (const l of G.lines) if (l.z === G.view) for (const h of endHandles(l)) {
      const d = Math.min(dist(h.tip, p), dist({ x: (h.tip.x + h.base.x) / 2 + h.dx * 4, y: (h.tip.y + h.base.y) / 2 + h.dy * 4 }, p));
      if (d < tol && d < bd) { bd = d; best = h; }
    }
    return best;
  }
  function lineAt(p) {
    const tol = Math.max(9, 14 / cam.s);
    let best = null, bd = Infinity;
    for (const l of G.lines) {
      if (l.lift || l.z !== G.view) continue;
      const g = l.geom;
      for (let i = 0; i < g.pts.length - 1; i++) {
        const d = segDist(p, g.pts[i], g.pts[i + 1]);
        if (d < tol && d < bd) {
          let seg = 0;
          for (let k = 0; k < g.segStart.length; k++) if (g.segStart[k] <= i) seg = k;
          bd = d; best = { line: l, seg };
        }
      }
    }
    return best;
  }
  function segDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0;
    t = clamp(t, 0, 1);
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  function pickSlot() {
    const sel = G.selSlot != null ? G.slots[G.selSlot] : null;
    if (sel && sel.unlocked && !sel.line) return sel;
    return G.slots.find(s => s.kind === 'std' && s.unlocked && !s.line) || null;
  }

  function evtPoint(ev) {
    const r = canvas.getBoundingClientRect();
    return { sx: ev.clientX - r.left, sy: ev.clientY - r.top };
  }

  canvas.addEventListener('pointerdown', ev => {
    if (!G || G.over || G.modal) return;
    closePanels();
    const { sx, sy } = evtPoint(ev);
    const p = toWorld(sx, sy);
    canvas.setPointerCapture(ev.pointerId);

    // déménagement, 2e étape : la pièce suit le doigt et se pose au relâchement
    if (G.apply === 'move' && G.moveNode) { G.hoverPt = p; drag = { mode: 'place', sx, sy }; return; }
    if (G.apply) { applyToken(p); return; }

    const n0 = nodeAt(p, 0);
    const h = handleAt(p);
    const onNodeCore = n0 && dist(n0, p) < NODE_R;
    if (h && !onNodeCore) {
      const list = h.line.nodes.slice();
      if (h.end === 'head') list.reverse();
      drag = { mode: 'extend', line: h.line, list, orig: list.slice(), atHead: false, reversed: h.end === 'head', kind: h.line.kind, color: h.line.color, loop: false, pt: p, sx, sy, moved: false };
      return;
    }
    const n = nodeAt(p);
    if (n) {
      // la pastille sélectionnée désigne un circuit qui se termine ici : on le prolonge
      const sel = G.selSlot != null ? G.slots[G.selSlot] : null;
      if (sel && sel.line && !sel.line.loop) {
        const l = sel.line;
        const ends = [l.nodes[0], l.nodes[l.nodes.length - 1]];
        if (ends.includes(n.id)) {
          const list = l.nodes.slice();
          const reversed = l.nodes[0] === n.id && l.nodes[l.nodes.length - 1] !== n.id;
          if (reversed) list.reverse();
          drag = { mode: 'extend', line: l, list, orig: list.slice(), reversed, kind: l.kind, color: l.color, loop: false, pt: p, sx, sy, moved: false };
          return;
        }
      }
      const slot = pickSlot();
      const d = { mode: 'new', list: [n.id], slot, kind: slot ? slot.kind : 'std', color: slot ? slot.color : 'muted', loop: false, pt: p, sx, sy, moved: false, start: n };
      drag = d;
      // appui long : si des circuits se terminent ici, un sélecteur propose lequel prolonger
      if (lineEndsAt(n).length) {
        d.downAt = performance.now();
        d.holdTimer = setTimeout(() => { if (drag === d && !d.moved) openChooser(d); }, HOLD_MS);
      }
      return;
    }
    const hit = lineAt(p);
    if (hit) {
      drag = { mode: 'insert', line: hit.line, seg: hit.seg, target: null, color: hit.line.color, pt: p, sx, sy, moved: false };
    }
  });

  // ---------- Sélecteur de circuit (appui long sur un service) ----------
  const HOLD_MS = 380;
  function lineEndsAt(n) {
    return G.lines.filter(l => !l.lift && !l.loop && l.z === n.z && (l.nodes[0] === n.id || l.nodes[l.nodes.length - 1] === n.id));
  }
  function openChooser(d) {
    const n = d.start;
    const opts = lineEndsAt(n).map(l => ({ line: l, kind: l.kind, color: l.color, label: `Prolonger · ${KIND_LABEL[l.kind].toLowerCase()}` }));
    const free = pickSlot();
    if (free) opts.push({ slot: free, kind: free.kind, color: free.color, label: `Nouveau ${KIND_LABEL[free.kind].toLowerCase()}` });
    const R = 54 / cam.s, r = 14 / cam.s;
    opts.forEach((o, i) => {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / opts.length);
      o.x = n.x + Math.cos(a) * R; o.y = n.y + Math.sin(a) * R; o.r = r;
    });
    d.mode = 'choose'; d.opts = opts; d.R = R; d.sel = null;
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* vibration indisponible */ } }
  }
  // Le doigt quitte le sélecteur en passant par une pastille : on enchaîne sur le tracé avec ce circuit.
  function chooseMove(d, p, sx, sy) {
    const hov = d.opts.find(o => dist(o, p) < o.r * 1.6);
    if (hov) d.sel = hov;
    if (!d.sel || dist(p, d.start) < d.R + d.sel.r * 1.4) return;
    const n = d.start, o = d.sel;
    if (o.line) {
      const l = o.line, list = l.nodes.slice();
      const reversed = l.nodes[0] === n.id;
      if (reversed) list.reverse();
      drag = { mode: 'extend', line: l, list, orig: list.slice(), reversed, kind: l.kind, color: l.color, loop: false, pt: p, sx, sy, moved: true };
      G.selSlot = l.slot;
    } else {
      G.selSlot = o.slot.i;
      drag = { mode: 'new', list: [n.id], slot: o.slot, kind: o.slot.kind, color: o.slot.color, loop: false, pt: p, sx, sy, moved: true, start: n };
    }
    G.uiVersion++;
  }

  canvas.addEventListener('pointermove', ev => {
    if (G && G.apply === 'move') G.hoverPt = toWorld(evtPoint(ev).sx, evtPoint(ev).sy);
    if (!drag) return;
    const { sx, sy } = evtPoint(ev);
    const p = toWorld(sx, sy);
    drag.pt = p;
    if (drag.mode === 'choose') { chooseMove(drag, p, sx, sy); return; }
    if (drag.mode === 'place') return;
    if (Math.hypot(sx - drag.sx, sy - drag.sy) > 6) drag.moved = true;
    const h = nodeAt(p, 0);
    drag.hover = h;
    if (h !== drag.blocked) drag.blocked = null;
    if (!h) return;
    const blocked = (a, b) => routeInfo(nodeById(a), nodeById(b)).blocked;
    if (drag.mode === 'new' || drag.mode === 'extend') {
      const L = drag.list, len = L.length;
      if (drag.loop) { if (h.id === L[len - 1]) drag.loop = false; return; }
      if (h.id === L[len - 1]) return;
      if (len >= 2 && h.id === L[len - 2]) { L.pop(); return; }
      if (h.id === L[0] && len >= 3) {
        if (blocked(L[len - 1], h.id)) drag.blocked = h; else drag.loop = true;
        return;
      }
      if (L.includes(h.id)) return;
      if (blocked(L[len - 1], h.id)) drag.blocked = h;
      else L.push(h.id);
    } else if (drag.mode === 'insert') {
      const l = drag.line;
      const a = l.nodes[drag.seg], b = l.nodes[(drag.seg + 1) % l.nodes.length];
      if (l.nodes.includes(h.id)) drag.target = null;
      else if (blocked(a, h.id) || blocked(h.id, b)) { drag.target = null; drag.blocked = h; }
      else drag.target = h;
    }
  });

  // Le tracé tient-il dans le stock de passerelles ?
  function bridgesOk(nodes, loop, except) {
    if (bridgesUsed(except) + bridgesFor(nodes, loop) <= G.bridges) return true;
    toast(`Pas assez de passerelles pour franchir ce patio (${G.bridges} au total). Contournez-le, ou libérez une passerelle en modifiant un autre circuit.`, true);
    return false;
  }
  function dragNodes(d) {
    if (d.mode === 'insert') {
      const nodes = d.line.nodes.slice();
      if (d.target) nodes.splice(d.seg + 1, 0, d.target.id);
      return { nodes, loop: d.line.loop, except: d.line };
    }
    const nodes = d.list.slice();
    if (d.reversed) nodes.reverse();
    return { nodes, loop: d.loop, except: d.mode === 'extend' ? d.line : null };
  }

  const endDrag = ev => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.holdTimer) clearTimeout(d.holdTimer);
    if (d.mode === 'place') { if (G.hoverPt) applyMove(G.hoverPt); return; }
    if (d.mode === 'choose') {
      // relâché sur une pastille : elle devient le circuit sélectionné dans la palette
      if (d.sel) { G.selSlot = d.sel.line ? d.sel.line.slot : d.sel.slot.i; G.uiVersion++; }
      return;
    }
    if (d.blocked && d.list && d.list.length < 2) {
      toast(`Passage impossible : un obstacle infranchissable sépare ces services. Passez par un autre service.`, true);
    }
    if (d.mode === 'new') {
      if (d.list.length >= 2) {
        const slot = pickSlot();
        if (!slot) { toast('Tous vos circuits sont utilisés. Prolongez-en un, ou supprimez-en un depuis la palette.', true); return; }
        if (!bridgesOk(d.list, d.loop, null)) return;
        createLine(slot, d.list, d.loop);
        G.selSlot = null;
        G.started = true;
      } else if (!d.moved) {
        showNodeTip(d.start);
      }
    } else if (d.mode === 'extend') {
      let list = d.list.slice();
      if (d.reversed) list.reverse();
      const same = list.length === d.line.nodes.length && list.every((x, i) => x === d.line.nodes[i]) && !d.loop;
      if (!same && bridgesOk(list, d.loop, d.line)) setLineNodes(d.line, list, d.loop);
    } else if (d.mode === 'insert') {
      if (d.target) {
        const nodes = d.line.nodes.slice();
        nodes.splice(d.seg + 1, 0, d.target.id);
        if (bridgesOk(nodes, d.line.loop, d.line)) setLineNodes(d.line, nodes, d.line.loop);
      } else if (!d.moved) {
        openLinePanel(d.line);
      }
    }
    void ev;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { if (drag && drag.holdTimer) clearTimeout(drag.holdTimer); drag = null; });

  function applyToken(p) {
    const tok = G.apply;
    if (tok === 'move') { applyMove(p); return; }
    if (tok === 'cart') {
      const hit = lineAt(p);
      if (hit) applyCart(hit.line);
      else { G.apply = null; G.uiVersion++; }
      return;
    }
    const n = nodeAt(p);
    if (!n) { G.apply = null; G.uiVersion++; return; }
    if (tok === 'cabin') {
      if (n.type !== 'ASC') { toast('Touchez un palier d’ascenseur.', true); return; }
      addVehicle(n.shaft.line, true);
      toast(`Cabine ajoutée : l’ascenseur ${n.shaft.letter} compte ${G.vehicles.filter(v => v.line === n.shaft.line).length} cabines.`);
    } else if (tok === 'staff') {
      if (TYPES[n.type].proc <= 0) { toast('Ce service ne dispense pas de soins : choisissez-en un autre.', true); return; }
      n.slots++;
      toast(`Renfort affecté : <b>${TYPES[n.type].name}</b> passe à ${n.slots} postes de soin.`);
    } else if (tok === 'room') {
      n.cap += 4;
      toast(`Salle d’attente agrandie : <b>${n.type === 'ASC' ? `palier de l’ascenseur ${n.shaft.letter}` : TYPES[n.type].name}</b> accueille ${n.cap} patients.`);
    }
    G.inv[tok]--; G.apply = null; G.uiVersion++;
  }
  // ---------- Déménagement d'un service ----------
  // 1er toucher : le service à déplacer ; 2e toucher : son nouvel emplacement, au niveau affiché.
  function applyMove(p) {
    if (!G.moveNode) {
      const n = nodeAt(p);
      if (!n) { cancelMove(); return; }
      if (n.type === 'ASC') { toast('Un palier d’ascenseur ne se déplace pas : il est fixé à sa cage.', true); return; }
      G.moveNode = n;
      G.uiVersion++;
      return;
    }
    const n = G.moveNode;
    const tap = nodeAt(p, 0);
    if (tap === n) { G.moveNode = null; G.uiVersion++; return; } // retoucher le service le désélectionne
    const res = canPlace(n, p.x, p.y, G.view);
    if (!res.ok) { toast(`Impossible d’installer ${TYPES[n.type].name.toLowerCase()} ici : ${res.why}.`, true); return; }
    const from = n.z;
    moveNode(n, p.x, p.y, G.view);
    G.moves--;
    G.moveNode = null; G.apply = null; G.uiVersion++;
    toast(`<b>${TYPES[n.type].name}</b> a déménagé${from !== n.z ? ' ' + atFloor(n.z) : ''}, avec ses patients.` +
      (from !== n.z ? ' Ses circuits sont restés à l’ancien étage : reliez-le de nouveau.' : ''));
  }
  function cancelMove() { G.apply = null; G.moveNode = null; G.hoverPt = null; G.uiVersion++; }

  function canPlace(n, x, y, z) {
    const R = G.region;
    if (x < R.x + 50 || x > R.x + R.w - 50 || y < R.y + 44 || y > R.y + R.h - 54) return { ok: false, why: 'c’est hors du bâtiment' };
    if (G.obstacles.some(o => obstOn(o, z) && rectHit(x - 44, y - 40, x + 44, y + 50, o, 10))) return { ok: false, why: 'un obstacle occupe la place' };
    if (G.obstacles.some(o => o.kind === 'core' && rectHit(x - 44, y - 40, x + 44, y + 50, palierRoom(o), 6))) return { ok: false, why: 'la place est réservée à un palier d’ascenseur' };
    if (G.nodes.some(m => m !== n && m.z === z && Math.hypot(m.x - x, m.y - y) < MIN_SPACING * 0.8)) return { ok: false, why: 'c’est trop près d’un autre service' };
    if (z !== n.z) return { ok: true };
    // même étage : les circuits suivent la pièce, à condition de rester praticables
    const ox = n.x, oy = n.y;
    n.x = x; n.y = y; G.routeCache.clear();
    let why = null;
    for (const l of G.lines) {
      if (l.lift || !l.nodes.includes(n.id)) continue;
      for (const [a, b] of linePairs(l)) if ((a === n.id || b === n.id) && routeInfo(nodeById(a), nodeById(b)).blocked) why = 'un de ses circuits traverserait un obstacle';
    }
    if (!why && bridgesUsed(null) > G.bridges) why = 'ses circuits demanderaient plus de passerelles';
    n.x = ox; n.y = oy; G.routeCache.clear();
    return why ? { ok: false, why } : { ok: true };
  }

  // Retirer un service d'un circuit. Ses voisins se rejoignent ; si un obstacle les sépare,
  // le circuit est coupé à cet endroit (on garde la plus longue partie, ou on ouvre la boucle).
  function removeNodeFromLine(l, id) {
    const i = l.nodes.indexOf(id);
    if (i < 0) return;
    let nodes = l.nodes.filter(x => x !== id), loop = l.loop && nodes.length > 2;
    const interior = l.loop || (i > 0 && i < l.nodes.length - 1);
    if (interior && nodes.length >= 2) {
      const a = nodes[(i - 1 + nodes.length) % nodes.length], b = nodes[i % nodes.length];
      const r = routeInfo(nodeById(a), nodeById(b));
      if (r.blocked || (r.patios.length && bridgesUsed(l) + bridgesFor(nodes, loop) > G.bridges)) {
        if (l.loop) { const k = nodes.indexOf(b); nodes = nodes.slice(k).concat(nodes.slice(0, k)); loop = false; }
        else { const left = nodes.slice(0, i), right = nodes.slice(i); nodes = left.length >= right.length ? left : right; }
      }
    }
    setLineNodes(l, nodes, loop);
  }

  function moveNode(n, x, y, z) {
    if (z !== n.z) {
      for (const l of G.lines.slice()) if (!l.lift && l.nodes.includes(n.id)) removeNodeFromLine(l, n.id);
    }
    n.x = x; n.y = y; n.z = z;
    n.code = roomCode(x, y, z);
    n.born = G.t;
    G.routeCache.clear();
    invalidateNet();
    for (const v of G.vehicles) if (!v.line.lift && v.line.nodes.includes(n.id)) remapVehicle(v);
    floater(x, y - NODE_R - 16, 'Déménagé', 'accent', z);
  }

  function applyCart(l) {
    l.cart += 2;
    G.inv.cart--; G.apply = null; G.uiVersion++;
    toast(`Chariots doublés sur le ${KIND_LABEL[l.kind].toLowerCase()} : ${VEH_CAP + l.cart} places par brancardier.`);
  }

  // ================================================================
  // Interface (DOM)
  // ================================================================
  const el = {
    score: $('#score'), clock: $('#clock'), day: $('#dayName'), strikes: $('#strikes'), palette: $('#palette'),
    pool: $('#poolN'), bridges: $('#bridgesN'), floorbar: $('#floorbar'), moves: $('#movesN'), moveBtn: $('#moveBtn'), inv: $('#inv'), hint: $('#hint'), toasts: $('#toasts'),
    lp: $('#linePanel'), nt: $('#nodeTip'), tension: $('#tension'), tensionLabel: $('#tensionLabel'),
  };

  function toast(html, bad) {
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.innerHTML = `<span class="ts">${G ? clockText() : ''}</span><span>${html}</span>`;
    t.addEventListener('click', () => t.remove());
    el.toasts.appendChild(t);
    while (el.toasts.children.length > 2) el.toasts.firstChild.remove();
    setTimeout(() => t.remove(), bad ? 4500 : 5500);
  }

  function clockText() { return clockAt(G.t); }
  function clockAt(t) {
    const mins = Math.floor(((t % DAY) / DAY * 24 * 60) / 10) * 10;
    return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  }

  // Niveau de tension : normal, tension (un service déborde), plan blanc (saturation avancée).
  const TENSION = ['Activité normale', 'Tension', 'Plan blanc'];
  let tensionLevel = 0;
  function updateTension() {
    let lvl = 0;
    for (const n of G.nodes) {
      if (n.over > OVERFLOW_LIMIT * 0.35) { lvl = 2; break; }
      if (n.over > 0 || crowd(n) > n.cap * 0.8) lvl = 1;
    }
    if (lvl === tensionLevel) return;
    if (lvl === 2) toast('<b>Déclenchement du plan blanc</b> : un service est saturé, désengorgez-le au plus vite.', true);
    tensionLevel = lvl;
    el.tension.dataset.level = lvl;
    el.tensionLabel.textContent = TENSION[lvl];
  }

  let lastUi = -1;
  function hudTick() {
    if (!G) return;
    el.score.textContent = G.score;
    const dayIdx = Math.floor(G.t / DAY) % 7;
    el.day.textContent = `${DAYS[dayIdx]} · S${G.week}`;
    el.clock.textContent = clockText();
    updateTension();
    if (el.strikes.children.length !== MAX_INCIDENTS) el.strikes.innerHTML = '<i></i>'.repeat(MAX_INCIDENTS);
    [...el.strikes.children].forEach((x, i) => x.classList.toggle('on', i < G.incidents));
    updateHint();
    updateFloorbar();
    if (lastUi === G.uiVersion) return;
    lastUi = G.uiVersion;
    renderPalette();
    el.pool.textContent = G.pool;
    el.bridges.textContent = `${Math.max(0, G.bridges - bridgesUsed(null))}/${G.bridges}`;
    el.moves.textContent = G.moves;
    el.moveBtn.disabled = G.moves <= 0;
    el.moveBtn.classList.toggle('active', G.apply === 'move');
    renderInventory();
    if (!el.lp.hidden && lpLine) fillLinePanel(lpLine);
  }

  function renderPalette() {
    el.palette.innerHTML = '';
    for (const s of G.slots) {
      if (!s.unlocked) continue;
      const b = document.createElement('button');
      b.className = `slot ${s.kind}` + (s.line ? ' used' : '') + (G.selSlot === s.i ? ' sel' : '');
      b.style.setProperty('--c', `var(--${s.color})`);
      const nv = s.line ? G.vehicles.filter(v => v.line === s.line).length : 0;
      const away = s.line && s.line.z !== G.view;
      if (away) b.classList.add('away');
      b.innerHTML = `<span class="dot"></span>` + (s.line ? `<span class="n">${nv}</span>` : '') +
        (s.line && G.floors.length > 1 ? `<span class="fl">${FLOORS[s.line.z].label}</span>` : '');
      b.setAttribute('aria-label', `${KIND_LABEL[s.kind]}${s.line ? `, ${nv} brancardier(s)` : ', libre'}`);
      b.title = s.line ? `${KIND_LABEL[s.kind]} : gérer` : `${KIND_LABEL[s.kind]} : sélectionner pour tracer`;
      b.addEventListener('click', () => {
        if (G.apply === 'cart' && s.line) { applyCart(s.line); return; }
        if (s.line) { if (s.line.z !== G.view) setView(s.line.z); G.selSlot = s.i; G.uiVersion++; openLinePanel(s.line, b); }
        else { G.selSlot = G.selSlot === s.i ? null : s.i; G.uiVersion++; closePanels(); }
      });
      el.palette.appendChild(b);
    }
  }

  function renderInventory() {
    el.inv.innerHTML = '';
    for (const k of Object.keys(G.inv)) {
      if (!G.inv[k]) continue;
      const b = document.createElement('button');
      b.className = 'chip' + (G.apply === k ? ' active' : '');
      b.textContent = `${TOKEN_LABEL[k]} ×${G.inv[k]}`;
      b.addEventListener('click', () => { G.apply = G.apply === k ? null : k; G.uiVersion++; closePanels(); });
      el.inv.appendChild(b);
    }
  }

  // ---------- Coupe du bâtiment ----------
  function setView(z) {
    if (!G.floors.includes(z) || z === G.view) return;
    G.view = z;
    drag = null;
    closePanels();
    G.uiVersion++;
  }
  function stepView(d) {
    const order = G.floors.slice().sort((a, b) => a - b);
    const i = order.indexOf(G.view) + d;
    if (i >= 0 && i < order.length) setView(order[i]);
  }
  function floorState(z) {
    let alert = 0, waiting = 0;
    for (const n of G.nodes) {
      if (n.z !== z) continue;
      if (n.over > 0) alert = 2;
      const c = crowd(n);
      waiting += c;
      if (alert < 1 && (c > n.cap * 0.8 || [...n.waiting, ...n.queue].some(e => e.kind === 'patient' && e.tri === 1))) alert = 1;
    }
    return { alert, waiting };
  }
  let floorbarKey = '';
  function updateFloorbar() {
    const bar = el.floorbar;
    bar.hidden = G.floors.length < 2;
    if (bar.hidden) return;
    const key = G.floors.join(',');
    if (key !== floorbarKey) {
      floorbarKey = key;
      bar.innerHTML = '<span class="lbl">Niveaux</span>';
      for (const z of G.floors) {
        const b = document.createElement('button');
        b.className = 'fbtn';
        b.dataset.z = z;
        b.title = `${FLOORS[z].name} · ${FLOORS[z].sub}`;
        b.setAttribute('aria-label', `${FLOORS[z].name}, ${FLOORS[z].sub}`);
        b.innerHTML = `<span class="cabs"></span><b>${FLOORS[z].label}</b><small></small>`;
        b.addEventListener('click', () => setView(z));
        bar.appendChild(b);
      }
    }
    for (const b of bar.querySelectorAll('.fbtn')) {
      const z = +b.dataset.z, st = floorState(z);
      b.classList.toggle('on', z === G.view);
      b.classList.toggle('new', !!G.newFloor && G.newFloor.z === z && G.t - G.newFloor.t < 12 && z !== G.view);
      b.dataset.alert = st.alert;
      b.querySelector('small').textContent = st.waiting;
      const cabs = G.vehicles.filter(v => v.line.lift && Math.abs(v.zf - z) < 0.5).length;
      const box = b.querySelector('.cabs');
      if (box.children.length !== cabs) box.innerHTML = '<i></i>'.repeat(cabs);
    }
  }

  let hintKey = '';
  function updateHint() {
    let key = '', html = '';
    if (G.apply === 'move') {
      key = 'move' + (G.moveNode ? G.moveNode.id : '');
      html = (G.moveNode
        ? `Touchez le nouvel emplacement de ${TYPES[G.moveNode.type].name.toLowerCase()}${G.floors.length > 1 ? ', à cet étage ou à un autre (colonne Niveaux)' : ''}.`
        : 'Touchez le service à déménager. Ses patients le suivent.') + '<button id="cancelApply">Annuler</button>';
    }
    else if (G.apply) { key = 'apply' + G.apply; html = `${TOKEN_HINT[G.apply]}<button id="cancelApply">Annuler</button>`; }
    else if (!G.lines.length) { key = 'first'; html = 'Glissez d’un service à un autre pour tracer votre premier circuit de brancardage.'; }
    else if (G.floors.length > 1 && G.floors.some(f => G.nodes.filter(n => n.z === f).length > 1 && !G.lines.some(l => !l.lift && l.z === f))) {
      const f = G.floors.find(f => G.nodes.filter(n => n.z === f).length > 1 && !G.lines.some(l => !l.lift && l.z === f));
      key = 'floor' + f + G.view;
      html = f === G.view
        ? 'Reliez les services de ce niveau au palier d’ascenseur : c’est là que les patients changent d’étage.'
        : `${FLOORS[f].name} : aucun circuit. Touchez « ${FLOORS[f].label} » dans la colonne Niveaux, puis reliez ses services au palier d’ascenseur.`;
    }
    else if (hasType('ISO') && !G.lines.some(l => l.kind === 'sep')) { key = 'sep'; html = 'Les patients contagieux ne voyagent que sur le circuit septique. Touchez la pastille verte en pointillé, puis tracez des Urgences vers l’Isolement.'; }
    else if (hasType('MN') && !G.lines.some(l => l.kind === 'rad')) { key = 'rad'; html = 'Touchez la pastille jaune, puis reliez la Radiopharmacie à la Médecine nucléaire : les doses et les patients injectés ne passent que par ce circuit.'; }
    else if (G.lines.length === 1 && G.t < 40) { key = 'second'; html = 'Chaque patient porte la forme du service où il doit aller. Reliez tous les services pour que les brancardiers les y conduisent.'; }
    else if (G.selSlot != null && G.slots[G.selSlot] && !G.slots[G.selSlot].line) { key = 'sel' + G.selSlot; html = `${KIND_LABEL[G.slots[G.selSlot].kind]} sélectionné : glissez d’un service à l’autre pour le tracer.`; }
    if (key === hintKey) return;
    hintKey = key;
    el.hint.innerHTML = html;
    const b = $('#cancelApply');
    if (b) b.addEventListener('click', () => cancelMove());
  }

  // ---------- Panneau de circuit ----------
  let lpLine = null;
  function openLinePanel(l, anchor) {
    lpLine = l;
    fillLinePanel(l);
    el.lp.hidden = false;
    const r = el.lp.getBoundingClientRect();
    let x, y;
    if (anchor) {
      const a = anchor.getBoundingClientRect();
      x = a.left + a.width / 2 - r.width / 2; y = a.top - r.height - 10;
    } else {
      const s = toScreen(drag && drag.pt ? drag.pt.x : nodeById(l.nodes[0]).x, nodeById(l.nodes[0]).y);
      x = s.x - r.width / 2; y = s.y - r.height - 20;
    }
    el.lp.style.left = clamp(x, 8, CW - r.width - 8) + 'px';
    el.lp.style.top = clamp(y, 8, CH - r.height - 8) + 'px';
    $('#lpDelete').classList.remove('armed');
    $('#lpDelete').textContent = 'Supprimer le circuit';
  }
  function fillLinePanel(l) {
    if (!G.lines.includes(l)) { el.lp.hidden = true; lpLine = null; return; }
    $('#lpSwatch').style.setProperty('--c', `var(--${l.color})`);
    $('#lpTitle').textContent = KIND_LABEL[l.kind];
    $('#lpRule').textContent = `${KIND_RULE[l.kind]} ${l.nodes.length} services${l.loop ? ', en boucle' : ''}.`;
    $('#lpVeh').textContent = G.vehicles.filter(v => v.line === l).length;
    $('#lpCap').textContent = `${VEH_CAP + l.cart} places par brancardier · ${G.pool} brancardier(s) en réserve.`;
  }
  $('#lpClose').addEventListener('click', () => { el.lp.hidden = true; });
  $('#moveBtn').addEventListener('click', () => {
    if (!G || G.moves <= 0) return;
    if (G.apply === 'move') cancelMove();
    else { G.apply = 'move'; G.moveNode = null; closePanels(); G.uiVersion++; }
  });
  $('#lpPlus').addEventListener('click', () => {
    if (!lpLine) return;
    if (G.pool <= 0) { toast('Aucun brancardier en réserve. Retirez-en un d’un autre circuit, ou attendez la fin de semaine.', true); return; }
    addVehicle(lpLine);
  });
  $('#lpMinus').addEventListener('click', () => {
    if (!lpLine) return;
    const vs = G.vehicles.filter(v => v.line === lpLine);
    if (!vs.length) return;
    vs.sort((a, b) => a.cargo.length - b.cargo.length);
    removeVehicle(vs[0]);
  });
  $('#lpDelete').addEventListener('click', ev => {
    const b = ev.currentTarget;
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Confirmer la suppression'; return; }
    if (lpLine) deleteLine(lpLine);
    el.lp.hidden = true; lpLine = null; G.selSlot = null;
  });

  // ---------- Fiche d'un service ----------
  let ntNode = null;
  function showNodeTip(n) {
    ntNode = n;
    fillNodeTip();
    el.nt.hidden = false;
    const r = el.nt.getBoundingClientRect();
    const s = toScreen(n.x, n.y);
    let x = s.x + 24, y = s.y - r.height / 2;
    if (x + r.width > CW - 8) x = s.x - r.width - 24;
    el.nt.style.left = clamp(x, 8, CW - r.width - 8) + 'px';
    el.nt.style.top = clamp(y, HUD_TOP - 8, CH - r.height - 8) + 'px';
  }
  function fillNodeTip() {
    const n = ntNode; if (!n) return;
    const T = TYPES[n.type];
    $('#ntTitle').textContent = n.type === 'ASC' ? `Ascenseur ${n.shaft.letter}` : T.name;
    $('#ntCode').textContent = n.code;
    $('#ntDesc').textContent = T.desc;
    const occ = $('#ntOcc');
    const ratio = n.type === 'RPH' ? 0 : crowd(n) / n.cap;
    occ.hidden = n.type === 'RPH';
    occ.firstElementChild.style.width = Math.min(100, ratio * 100) + '%';
    occ.className = 'occ' + (ratio > 1 ? ' crit' : ratio > 0.75 ? ' warn' : '');
    const rows = [];
    if (n.type !== 'RPH') rows.push(['Taux d’occupation', Math.round(ratio * 100) + ' %']);
    if (n.type === 'ASC') {
      const cabs = G.vehicles.filter(v => v.line === n.shaft.line);
      rows.push(['Cabines', `${cabs.length} × ${LIFT_CAP} brancards`]);
      rows.push(['Niveaux desservis', n.shaft.line.nodes.map(id => FLOORS[nodeById(id).z].label).join(' · '), 'txt']);
      if (cabs.some(v => v.clean > 0)) rows.push(['Bionettoyage', 'en cours', 'txt']);
    }
    if (n.slots) rows.push(['Postes de soin', `${n.treating.length} / ${n.slots}`]);
    if (T.proc) rows.push(['File de soins', n.queue.length]);
    rows.push(['Attente brancardier', n.waiting.filter(e => e.kind === 'patient').length]);
    if (n.type !== 'RPH') rows.push(['Capacité avant saturation', n.cap]);
    if (n.type === 'MN') rows.push(['Doses en stock', n.doses.length]);
    if (n.type === 'RPH') rows.push(['Doses prêtes', n.waiting.filter(e => e.kind === 'dose').length]);
    const urgent = [...n.waiting, ...n.queue].filter(e => e.kind === 'patient').sort((a, b) => a.tri - b.tri)[0];
    if (urgent) rows.push(['Plus urgent', `${urgent.name}`, 'txt']);
    $('#ntKv').innerHTML = rows.map(([k, v, cls]) => `<span>${k}</span><b class="${cls || ''}">${v}</b>`).join('');
  }
  $('#ntClose').addEventListener('click', () => { el.nt.hidden = true; ntNode = null; });
  setInterval(() => { if (!el.nt.hidden) fillNodeTip(); }, 400);

  function closePanels() { el.lp.hidden = true; el.nt.hidden = true; ntNode = null; }

  // ---------- Fin de semaine ----------
  function endWeek() {
    G.nextWeek += WEEK;
    G.pool++;
    G.uiVersion++;
    const keys = Object.keys(UPGRADES).filter(k => UPGRADES[k].ok());
    const picks = [];
    while (picks.length < 2 && keys.length) picks.push(keys.splice(Math.floor(Math.random() * keys.length), 1)[0]);
    $('#weekTitle').textContent = `Fin de la semaine ${G.week}`;
    $('#weekRef').textContent = `Semaine ${G.week} · ${G.score} patients`;
    const box = $('#choices');
    box.innerHTML = '';
    for (const k of picks) {
      const b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = `<strong>${UPGRADES[k].title}</strong><span>${UPGRADES[k].desc}</span>`;
      b.addEventListener('click', () => {
        if (k === 'lift') {
          const sh = activateShaft(nextCore());
          if (sh) toast(`<b>Ascenseur ${sh.letter}</b> en service à tous les niveaux. Reliez ses paliers à vos circuits.`);
        } else if (k === 'move') { G.moves += 2; toast('Deux déménagements de plus : touchez le compteur en bas de l’écran pour déplacer un service.'); }
        else if (k === 'bridge') { G.bridges += 2; toast('Deux passerelles de plus : vos circuits peuvent franchir davantage de patios.'); }
        else if (k === 'line_sep') unlockSlot('sep');
        else if (k === 'line_rad') unlockSlot('rad');
        else { G.inv[k]++; toast(`${TOKEN_LABEL[k]} en réserve : touchez-la en bas de l’écran pour l’utiliser.`); }
        G.week++;
        G.uiVersion++;
        closeModal('#weekModal');
      });
      box.appendChild(b);
    }
    openModal('#weekModal');
  }

  function openModal(sel) { $(sel).hidden = false; if (G) G.modal = true; closePanels(); drag = null; }
  function closeModal(sel) {
    $(sel).hidden = true;
    if (G) G.modal = ['#startModal', '#weekModal', '#overModal', '#helpModal'].some(s => !$(s).hidden);
  }

  // ---------- Fin de partie ----------
  function gameOver(reason) {
    if (G.over) return;
    G.over = true;
    const best = Math.max(G.score, +(store.get('miniHopital.best') || 0));
    store.set('miniHopital.best', String(best));
    $('#overReason').textContent = reason;
    const days = Math.floor(G.t / DAY);
    $('#overRef').innerHTML = `${DAYS[days % 7]} ${clockText()}<br>Semaine ${G.week}`;
    $('#endStats').innerHTML = [
      ['Patients pris en charge', G.score], ['Durée de la garde', `${days} j`],
      ['Événements indésirables graves', G.incidents, G.incidents > 0], ['Partis sans soins', G.lwbs, G.lwbs > 0],
      ['Doses de radiotraceur périmées', G.dosesLost, G.dosesLost > 0], ['Services ouverts', G.nodes.length],
    ].map(([k, v, bad]) => `<tr class="${bad ? 'bad' : ''}"><th>${k}</th><td>${v}</td></tr>`).join('') +
      G.eig.map(x => `<tr class="bad"><th>EIG · ${x.name}, en attente de ${x.want.toLowerCase()} ${atFloor(x.z)}</th><td>${clockAt(x.t)}</td></tr>`).join('');
    $('#bestScore2').textContent = `Record : ${best} patients`;
    openModal('#overModal');
  }

  // ---------- Contrôles ----------
  function setSpeed(s) {
    if (!G) return;
    if (s === 0) G.paused = !G.paused;
    else { G.paused = false; G.speed = s; }
    $('#btnPause').classList.toggle('on', G.paused);
    $('#btnPlay').classList.toggle('on', !G.paused && G.speed === 1);
    $('#btnFast').classList.toggle('on', !G.paused && G.speed === 2);
  }
  $('#btnPause').addEventListener('click', () => setSpeed(0));
  $('#btnPlay').addEventListener('click', () => setSpeed(1));
  $('#btnFast').addEventListener('click', () => setSpeed(2));
  $('#btnHelp').addEventListener('click', () => openModal('#helpModal'));
  $('#btnHelpClose').addEventListener('click', () => closeModal('#helpModal'));
  $('#btnLegend').addEventListener('click', () => openModal('#helpModal'));
  $('#btnStart').addEventListener('click', () => { closeModal('#startModal'); });
  $('#btnRestart').addEventListener('click', () => { closeModal('#overModal'); newGame(); setSpeed(1); });
  window.addEventListener('keydown', ev => {
    if (ev.target && ev.target.tagName === 'INPUT') return;
    if (ev.code === 'Space') { ev.preventDefault(); setSpeed(0); }
    else if (ev.key === '1') setSpeed(1);
    else if (ev.key === '2') setSpeed(2);
    else if (G && (ev.key === 'ArrowUp' || ev.key === 'PageUp')) { ev.preventDefault(); stepView(1); }
    else if (G && (ev.key === 'ArrowDown' || ev.key === 'PageDown')) { ev.preventDefault(); stepView(-1); }
    else if (ev.key === 'Escape') { if (G) { cancelMove(); G.selSlot = null; } drag = null; closePanels(); }
  });

  // ---------- Légende ----------
  function iconCanvas(draw) {
    const cv = document.createElement('canvas');
    const d = Math.min(3, window.devicePixelRatio || 1);
    cv.width = 28 * d; cv.height = 28 * d;
    const c = cv.getContext('2d');
    c.scale(d, d);
    draw(c);
    return cv;
  }
  function legendItem(box, draw, title, text) {
    const div = document.createElement('div');
    div.appendChild(iconCanvas(draw));
    const t = document.createElement('span');
    t.innerHTML = `<b>${title}</b><small>${text}</small>`;
    div.appendChild(t);
    box.appendChild(div);
  }
  function nodeIcon(type) {
    return c => {
      signPanel(c, type, 14, 14, 12);
    };
  }
  function buildLegend() {
    readColors();
    const sv = $('#legendServices'); sv.innerHTML = '';
    for (const k of Object.keys(TYPES)) legendItem(sv, nodeIcon(k), TYPES[k].name, TYPES[k].desc);
    const pv = $('#legendPatients'); pv.innerHTML = '';
    for (const k of [1, 2, 3, 4]) {
      legendItem(pv, c => { shapePath(c, 'circle', 14, 14, 7); c.fillStyle = C[TRIAGE[k].color]; c.fill(); c.lineWidth = 2; c.strokeStyle = C.ink; c.stroke(); },
        TRIAGE[k].name, `Délai avant dégradation : ${TRIAGE[k].patience} s.` + (k <= 2 ? ' Dépassé, c’est un événement indésirable grave (EIG).' : k === 3 ? ' S’il attend trop, il s’aggrave et passe en urgence.' : ' Dépassé, le patient part sans soins.'));
    }
    legendItem(pv, c => { drawEntity(c, { kind: 'patient', tri: 2, inf: true, rad: false, path: ['ISO'], step: 0, patience: 1, maxPatience: 1 }, 14, 14, 5, false); },
      'Patient contagieux', 'Anneau vert pointillé. Il ne voyage que sur le circuit septique. Dans l’ascenseur, il monte seul et la cabine est nettoyée après lui.');
    legendItem(pv, c => { drawEntity(c, { kind: 'patient', tri: 3, inf: false, rad: true, path: ['HOSP'], step: 0, patience: 1, maxPatience: 1 }, 14, 14, 5, false); },
      'Patient radioactif', 'Anneau jaune. Après une TEP ou une scintigraphie, il voyage seul : sur son brancard comme dans l’ascenseur.');
    legendItem(pv, c => trefoil(c, 14, 14, 8, C['rad-ink'], C.rad), 'Dose de radiotraceur', `Décroît en ${DOSE_LIFE} s. Sans dose, la médecine nucléaire est à l’arrêt.`);
    legendItem(pv, c => { shapePath(c, 'triangle', 14, 14, 7); c.fillStyle = C.t4; c.fill(); c.lineWidth = 2; c.strokeStyle = C.ink; c.stroke(); },
      'Forme = prochaine étape', 'Un triangle va au bloc, un cercle en imagerie… Couleur = niveau de tri.');
    legendItem(pv, c => { shapePath(c, 'circle', 14, 14, 7); c.fillStyle = C.t3; c.fill(); c.lineWidth = 2; c.strokeStyle = C.ink; c.stroke(); c.font = `700 12px ${getFont('data')}`; c.fillStyle = C.ink; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 14, 14.5); },
      'Diagnostic', 'Beaucoup de patients ne connaissent que leur premier examen. Le résultat révèle la suite : bloc, coronarographie, isolement… ou retour à domicile.');
    legendItem(pv, c => { shapePath(c, 'circle', 14, 14, 7); c.fillStyle = C.t2; c.fill(); c.lineWidth = 2; c.strokeStyle = C.ink; c.stroke(); },
      'Aggravation', 'Un semi-urgent qui attend trop passe en urgence, avec un délai plus court.');
    legendItem(pv, c => { shapePath(c, 'circle', 14, 14, 7); c.fillStyle = C.t3; c.fill(); c.lineWidth = 2; c.strokeStyle = C.ink; c.stroke(); },
      'Stabilisation', 'Après un soin au bloc, en réanimation, en coronarographie… le patient gagne un niveau de tri : son transfert en chambre est moins pressant.');
    legendItem(pv, c => { for (const [x, y] of [[8, 9], [20, 9], [14, 20]]) { shapePath(c, 'circle', x, y, 4); c.fillStyle = C.t3; c.fill(); c.lineWidth = 1.5; c.strokeStyle = C.ink; c.stroke(); } },
      'Répartition', 'Quand plusieurs unités font la même chose, les patients visent la moins encombrée.');
    const ov = $('#legendObstacles'); ov.innerHTML = '';
    const mini = { patio: { w: 24, h: 18 }, core: { w: 12, h: 20 }, bunker: { w: 24, h: 18 } };
    for (const k of Object.keys(OBSTACLES)) {
      const m = mini[k];
      legendItem(ov, c => drawObstacle(c, { kind: k, x: 14 - m.w / 2, y: 14 - m.h / 2, w: m.w, h: m.h, seed: 0.4 }, false), OBSTACLES[k].name, OBSTACLES[k].desc);
    }
    legendItem(ov, c => { c.fillStyle = C.garden; c.fillRect(6, 4, 16, 20); c.strokeStyle = C.wall; c.lineWidth = 9; c.beginPath(); c.moveTo(2, 14); c.lineTo(26, 14); c.stroke(); c.strokeStyle = C.floor; c.lineWidth = 7; c.stroke(); c.strokeStyle = C.l1; c.lineWidth = 4; c.stroke(); },
      'Passerelle', 'Chaque franchissement de patio consomme une passerelle. Le compteur est en bas de l’écran.');
    const lv = $('#legendLines'); lv.innerHTML = '';
    for (const [kind, col] of [['std', 'l1'], ['sep', 'sep'], ['rad', 'rad']]) {
      legendItem(lv, c => strokeLine(c, [{ x: 3, y: 20 }, { x: 11, y: 20 }, { x: 25, y: 8 }], C[col], kind, 6), KIND_LABEL[kind], KIND_RULE[kind]);
    }
    legendItem(lv, nodeIcon('ASC'), 'Ascenseur',
      `Une ligne verticale automatique : ses cabines (${LIFT_CAP} brancards chacune) relient les paliers de tous les niveaux. Les circuits d’un étage s’arrêtent au palier ; le patient y change de niveau. Un circuit reste sur son étage.`);
  }
  function buildRules() {
    readColors();
    const ul = $('#rulesList'); ul.innerHTML = '';
    const add = (draw, html) => { const li = document.createElement('li'); li.appendChild(iconCanvas(draw)); const s = document.createElement('span'); s.innerHTML = html; li.appendChild(s); ul.appendChild(li); };
    add(c => strokeLine(c, [{ x: 3, y: 22 }, { x: 10, y: 22 }, { x: 25, y: 7 }], C.l1, 'std', 6),
      '<b>Tracez des circuits</b> en glissant d’un service à l’autre. Un brancardier y fait la navette.');
    add(c => { shapePath(c, 'triangle', 14, 15, 8); c.fillStyle = C.t1; c.fill(); c.lineWidth = 2; c.strokeStyle = C.ink; c.stroke(); },
      '<b>Chaque patient montre sa prochaine étape</b> par la forme du service, et sa gravité par la couleur. Souvent, c’est l’examen qui révèle la suite du parcours.');
    add(c => { drawEntity(c, { kind: 'patient', tri: 2, inf: true, rad: false, path: ['ISO'], step: 0, patience: 1, maxPatience: 1 }, 14, 14, 5, false); },
      '<b>Patients contagieux et radioactifs</b> exigent des circuits dédiés : septique et radioprotégé.');
    add(nodeIcon('ASC'),
      '<b>L’hôpital grandit en hauteur.</b> Les ascenseurs relient les niveaux, choisis dans la colonne Niveaux. Les obstacles ne bougent pas : les patios se franchissent par passerelle, le reste se contourne.');
    add(c => { c.beginPath(); c.arc(14, 14, 10, -Math.PI / 2, Math.PI); c.strokeStyle = C.danger; c.lineWidth = 4; c.stroke(); },
      '<b>Un service saturé trop longtemps</b> ou trois événements indésirables graves mettent fin à la garde.');
  }

  // ================================================================
  // Démarrage
  // ================================================================
  function onResize() {
    measure();
    if (G) cam.ready = cam.ready && true;
  }
  window.addEventListener('resize', onResize);
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const re = () => { readColors(); buildLegend(); buildRules(); };
    if (mq.addEventListener) mq.addEventListener('change', re);
  }

  let last = performance.now();
  function frame(now) {
    const raw = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G && !G.paused && !G.over && !G.modal) {
      for (let i = 0; i < G.speed; i++) { step(raw); if (G.over) break; }
    }
    if (G) updateCamera();
    render();
    hudTick();
    requestAnimationFrame(frame);
  }

  buildRules();
  buildLegend();
  const best = +(store.get('miniHopital.best') || 0);
  if (best) $('#bestScore').textContent = `Record : ${best} patients`;
  newGame();
  G.modal = true;
  requestAnimationFrame(frame);

  // Accès de débogage depuis la console.
  window.miniHopital = { get state() { return G; }, step, spawnPatient, addVehicle, routeInfo: (a, b) => routeInfo(a, b), canPlace: (n, x, y, z) => canPlace(n, x, y, z), createLine: (ids, kind = 'std') => {
    const slot = G.slots.find(s => s.kind === kind && s.unlocked && !s.line);
    return slot ? createLine(slot, ids, false) : null;
  } };
})();
