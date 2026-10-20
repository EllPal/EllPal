// TRIOP · simulateur compact pour le site web : lit tumoral simulé, sonde 6 pétales en CPS, courbe temporelle.
//
//   <script type="module" src="triop-simulateur.js"></script>
//   <triop-simulateur></triop-simulateur>
//
// Attributs : theme="auto|light|dark" (auto = préférence système ; le bouton de la fenêtre mémorise le choix du visiteur),
//             lang="fr|en", header="off" (masque la barre du haut), autoplay="off" (pas de démo automatique).
// Variable CSS : --triop-height (hauteur du contenu en mode large, 600px par défaut), --triop-font (police).
//
// Modèle repris du simulateur de bureau (physique.py, couleurs.py) : tick de 16 ms, bruit de fond bêta 5 CPS,
// gamma 5 CPS compensé (différence de deux tirages de Poisson : moyenne nulle, variance qui croît avec le flux),
// moyenne glissante 3 s par pétale, échelle Direct 8–17 CPS.
// Bêta : portée millimétrique, chaque pétale voit les sources proches de son secteur (directionnalité).
// Gamma : flux large champ en 1 / (d² + h²), identique sur les 6 pétales, retiré par la compensation.

const CFG = {
  tick: 0.016,            // s : pas de discrétisation (t_discr)
  fond: 5.0,              // CPS : bruit de fond bêta (F_fond)
  gammaFond: 5.0,         // CPS : gamma ambiant (gamma_bruit)
  gammaTumeur: 7.0,       // CPS : gamma ajouté sonde centrée sur le nodule
  signalMax: 16.0,        // CPS nets ajoutés au fond, sonde centrée sur le nodule
  moyenne: 3.0,           // s : moyenne glissante (temps_moyennage_beta)
  echelle: [8, 17],       // CPS : échelle de couleurs Direct (direct_min, direct_max)
  champ: [96, 60],        // mm : lit tumoral généré (recadré pour remplir la zone)
  rayonTete: 5.0,         // mm : tête de 1 cm de diamètre
  rayonPetale: 3.0,       // mm : centre de sensibilité de chaque pétale
  parcoursBeta: 1.1,      // mm : atténuation des positons du FDG dans le tissu
  contact: 0.3,           // mm : distance tissu - détecteur
  hauteurGamma: 9.0,      // mm : hauteur équivalente du flux gamma
  historique: 30,         // s : fenêtre de la courbe
  echantillon: 0.1,       // s : pas de la courbe
  vitesseDemo: 9,         // mm/s
};

// Pétales du simulateur (Sonde2D.svg, viewBox 315), affichés tournés de -30° comme dans l'application.
const PETALS = ["M166.379 41.3693V120.025C166.379 129.847 177.009 135.979 185.509 131.066L253.633 91.7448C263.147 86.2512 264.92 73.3927 257.474 65.3132C238.943 45.2416 214.448 30.7707 186.8 24.701C176.29 22.3919 166.379 30.601 166.379 41.3693Z", "M186.8 290.291C214.444 284.221 238.943 269.754 257.47 249.678C264.92 241.599 263.147 228.749 253.633 223.251L185.509 183.925C177.009 179.021 166.379 185.149 166.379 194.966V273.627C166.379 284.395 176.286 292.595 186.8 290.291Z", "M52.4594 107.109C42.959 101.62 30.9351 106.484 27.6566 116.971C23.6635 129.767 21.4883 143.384 21.4883 157.498C21.4883 171.616 23.6635 185.22 27.6566 198.021C30.9351 208.503 42.959 213.372 52.4594 207.878L120.61 168.539C129.106 163.626 129.106 151.357 120.61 146.453L52.4594 107.109Z", "M287.353 116.978C284.07 106.491 272.051 101.631 262.541 107.116L194.391 146.46C185.891 151.364 185.891 163.633 194.391 168.55L262.541 207.889C272.051 213.378 284.07 208.51 287.34 198.028C291.346 185.227 293.512 171.623 293.512 157.505C293.512 143.391 291.346 129.774 287.353 116.978Z", "M61.3669 91.739L129.495 131.069C137.986 135.978 148.621 129.846 148.621 120.024V41.3635C148.621 30.6041 138.705 22.395 128.196 24.6996C100.548 30.7738 76.0441 45.2402 57.5302 65.3118C50.071 73.3914 51.8532 86.2499 61.3669 91.739Z", "M129.491 183.929L61.3669 223.255C51.8532 228.753 50.071 241.603 57.5302 249.682C76.0441 269.758 100.543 284.225 128.196 290.295C138.705 292.599 148.621 284.399 148.621 273.626V194.97C148.621 185.153 138 179.025 129.491 183.929Z"];
const PATH_BEARING = [0, 120, 240, 60, 300, 180];   // cap de chaque tracé après la rotation de -30°
const BEARINGS = [0, 60, 120, 180, 240, 300];        // pétales k = 0..5, sens horaire depuis 12 h

// ---------------------------------------------------------------- couleurs (couleurs.py, COLORS_DIRECT)
const COLORS = ['#800080', '#8792A1', '#84C1B9', '#B2E8A6', '#E9F59D', '#FFF34D'];
const STOPS = COLORS.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)));
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
function colormap(x) {
  const f = clamp(x) * (STOPS.length - 1), i = Math.min(STOPS.length - 2, Math.floor(f)), u = f - i;
  return STOPS[i].map((v, j) => Math.round(v + (STOPS[i + 1][j] - v) * u));
}
const couleurCps = v => colormap((v - CFG.echelle[0]) / (CFG.echelle[1] - CFG.echelle[0]));
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const textOn = c => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 > 0.55 ? '#111216' : '#FFFFFF';

// ---------------------------------------------------------------- aléatoire
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function poisson(lambda) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return k - 1;
}

// ---------------------------------------------------------------- lit tumoral (mm, y vers le bas)
function litTumoral(seed = 11) {
  const R = rng(seed), gauss = () => Math.sqrt(-2 * Math.log(R() + 1e-12)) * Math.cos(2 * Math.PI * R());
  const C = [48, 30], base = 17;
  const paroi = a => base * (1 + 0.12 * Math.sin(2 * a + 0.6) + 0.07 * Math.sin(3 * a + 1.9) + 0.05 * Math.sin(5 * a + 0.3));
  const at = (a, f) => [C[0] + Math.cos(a) * paroi(a) * f, C[1] + Math.sin(a) * paroi(a) * f];
  const sources = [];
  const amas = (c, r, n, w) => { for (let i = 0; i < n; i++) { const rr = r * Math.sqrt(R()), a = R() * 2 * Math.PI;
    sources.push({ x: c[0] + rr * Math.cos(a), y: c[1] + rr * Math.sin(a), w: w * (0.7 + 0.6 * R()) }); } };
  const nodule = at(-0.7, 0.9);
  amas(nodule, 3.6, 150, 1);                                         // résidu sur la paroi
  for (let i = 0; i < 110; i++) {                                    // infiltration le long de la marge (renforcée)
    const p = at(-0.45 + R() * 1.0, 0.88 + 0.2 * R());
    sources.push({ x: p[0] + gauss() * 0.9, y: p[1] + gauss() * 0.9, w: 1.3 * (0.7 + 0.6 * R()) });
  }
  const foyer1 = [C[0] - 7, C[1] + 6], foyer2 = at(2.55, 0.95);
  amas(foyer1, 3.0, 110, 0.8);                                       // micro-foyers (activité renforcée : lisibles sur les 6 pétales)
  amas(foyer2, 3.2, 120, 0.8);
  // cellules saines : grille jitterée, plus clairsemée au fond de la cavité
  const cellules = [];
  for (let y = 1; y < CFG.champ[1]; y += 2.3) for (let x = 1; x < CFG.champ[0]; x += 2.3) {
    const px = x + (R() - 0.5) * 1.8, py = y + (R() - 0.5) * 1.8, a = Math.atan2(py - C[1], px - C[0]);
    const dedans = Math.hypot(px - C[0], py - C[1]) < paroi(a);
    if (!dedans || R() < 0.55) cellules.push({ x: px, y: py, a: (dedans ? 0.14 : 0.22) + 0.12 * R(), r: 0.8 + 0.5 * R() });
  }
  return { C, paroi, at, sources, cellules, nodule, foyer1, foyer2, infiltration: at(0.05, 0.98) };
}

// ---------------------------------------------------------------- modèle de détection
const OFFSETS = BEARINGS.map(b => { const a = b * Math.PI / 180; return [Math.sin(a) * CFG.rayonPetale, -Math.cos(a) * CFG.rayonPetale]; });

function fluxBruts(lit, p) {
  const beta = [0, 0, 0, 0, 0, 0]; let gamma = 0;
  const h2 = CFG.contact * CFG.contact, hg2 = CFG.hauteurGamma * CFG.hauteurGamma;
  for (const s of lit.sources) {
    const dx = s.x - p[0], dy = s.y - p[1], d2 = dx * dx + dy * dy;
    gamma += s.w / (d2 + hg2);
    if (d2 > 144) continue;                                           // au-delà de 12 mm : plus aucun bêta
    for (let k = 0; k < 6; k++) {
      const ex = dx - OFFSETS[k][0], ey = dy - OFFSETS[k][1];
      beta[k] += s.w * Math.exp(-Math.sqrt(ex * ex + ey * ey + h2) / CFG.parcoursBeta);
    }
  }
  return { beta, gamma };
}

class Detecteur {
  constructor(lit) {
    this.lit = lit;
    const ref = fluxBruts(lit, lit.nodule);
    this.kBeta = CFG.signalMax / Math.max(...ref.beta);
    this.kGamma = CFG.gammaTumeur / ref.gamma;
    this.n = Math.round(CFG.moyenne / CFG.tick);
    this.ring = BEARINGS.map(() => new Int16Array(this.n));
    this.sums = [0, 0, 0, 0, 0, 0]; this.idx = 0; this.rempli = 0;
    this.lambda = [CFG.fond, CFG.fond, CFG.fond, CFG.fond, CFG.fond, CFG.fond]; this.G = CFG.gammaFond;
  }
  viser(p, contact) {
    if (!contact) { this.lambda.fill(CFG.fond); this.G = CFG.gammaFond; return; }
    const f = fluxBruts(this.lit, p);
    for (let k = 0; k < 6; k++) this.lambda[k] = CFG.fond + this.kBeta * f.beta[k];
    this.G = CFG.gammaFond + this.kGamma * f.gamma;
  }
  pas() {
    const dt = CFG.tick, g = this.G * dt;
    for (let k = 0; k < 6; k++) {
      const n = poisson(this.lambda[k] * dt) + poisson(g) - poisson(g);
      this.sums[k] += n - this.ring[k][this.idx]; this.ring[k][this.idx] = n;
    }
    this.idx = (this.idx + 1) % this.n; this.rempli = Math.min(this.n, this.rempli + 1);
  }
  valeurs() { const t = Math.max(1, this.rempli) * CFG.tick; return this.sums.map(s => Math.max(0, s / t)); }
}

// ---------------------------------------------------------------- charte (theme.py) : clair et sombre de l'application
const THEMES = {
  light: {
    center: '#ECEDEF',
    tissu: { bg: '#F7F7F9', grid: 'rgba(69,72,80,.06)', cell: [69, 72, 80], cavA: 'rgba(119,58,237,.05)', cavB: 'rgba(119,58,237,.015)',
      wall: 'rgba(69,72,80,.24)', ombre: 'rgba(69,72,80,.10)', tumeur: [119, 58, 237], tumeurA: [.13, .12], label: 'rgba(69,72,80,.62)',
      ring: '#42444C', head: 'rgba(255,255,255,.72)', dot: '#42444C', haloA: .28 },
    graph: { grid: 'rgba(69,72,80,.08)', axis: '#92939A', fill0: 'rgba(55,191,239,.55)', fill1: 'rgba(55,191,239,.04)', line: '#37BFEF', ref: 'rgba(69,72,80,.32)' },
  },
  dark: {
    center: '#2B2B2B',
    tissu: { bg: '#191919', grid: 'rgba(255,255,255,.04)', cell: [205, 208, 218], cavA: 'rgba(175,125,255,.08)', cavB: 'rgba(175,125,255,.025)',
      wall: 'rgba(255,255,255,.15)', ombre: 'rgba(0,0,0,.4)', tumeur: [175, 125, 255], tumeurA: [.15, .14], label: 'rgba(205,208,218,.55)',
      ring: 'rgba(236,236,240,.85)', head: 'rgba(24,24,24,.55)', dot: '#ECECF0', haloA: .22 },
    graph: { grid: 'rgba(255,255,255,.07)', axis: '#B0B0B9', fill0: 'rgba(55,191,239,.36)', fill1: 'rgba(55,191,239,.02)', line: '#37BFEF', ref: 'rgba(255,255,255,.28)' },
  },
};

const TEXTES = {
  fr: { sim: 'Simulation illustrative', bed: 'Lit tumoral', hint: 'Survolez le lit tumoral : la sonde suit la souris', hintTouch: 'Touchez le lit tumoral pour déplacer la sonde',
    graph: 'Graphe', unit: 'coups / s', petals: 'Vue pétales', avg: 'Six détecteurs · coups par seconde', average: 'Moyenne', max: 'Max', now: 'maintenant',
    demo: 'Démo', live: 'Au contact', lifted: 'Sonde levée', toLight: 'Passer en mode clair', toDark: 'Passer en mode sombre', canvas: 'Lit tumoral simulé : survolez-le pour déplacer la sonde' },
  en: { sim: 'Illustrative simulation', bed: 'Tumor bed', hint: 'Hover the tumor bed: the probe follows the mouse', hintTouch: 'Touch the tumor bed to move the probe',
    graph: 'Graph', unit: 'counts / s', petals: 'Petals view', avg: 'Six detectors · counts per second', average: 'Average', max: 'Max', now: 'now',
    demo: 'Demo', live: 'In contact', lifted: 'Probe lifted', toLight: 'Switch to light mode', toDark: 'Switch to dark mode', canvas: 'Simulated tumor bed: hover it to move the probe' },
};

const LOGO = `<svg class="logo" viewBox="0 0 269 100" aria-label="BEAMS" role="img"><path fill="#37BFEF" d="M55.2672 42.7476L0 37.3216L55.2672 33.5366C58.1369 33.5366 60.1407 36.6991 59.1728 39.6982C58.5841 41.5278 57.0218 42.7476 55.2672 42.7476Z"/><g fill="currentColor"><path d="M103.448 30.5313H136.509L133.458 40H112.759L110.489 47.0481H129.689L126.774 56.0956H107.574L104.761 64.835H126.055L122.823 74.8758H89.161L103.442 30.5313H103.448Z"/><path d="M156.371 67.5574H142.368L138.066 74.8758H125.472L154.758 30.5313H168.213L168.932 74.8758H156.015L156.377 67.5574H156.371ZM156.898 57.9692L157.628 42.0245L148.136 57.9692H156.903H156.898Z"/><path d="M186.999 30.5313H203.222L200.788 57.5165L215.691 30.5313H231.908L217.627 74.8758H207.524L218.414 41.0563L199.735 74.8758H190.588L193.712 41.0563L182.822 74.8758H172.718L186.999 30.5313Z"/><path d="M228.065 60.2075L240.065 59.3901C239.634 61.509 239.634 63.1185 240.059 64.2314C240.749 66.0233 242.278 66.9224 244.638 66.9224C246.398 66.9224 247.904 66.4634 249.155 65.5454C250.406 64.6275 251.221 63.5649 251.612 62.3515C251.979 61.2009 251.861 60.176 251.244 59.2644C250.627 58.359 248.798 57.4976 245.753 56.6929C240.778 55.3411 237.495 53.5492 235.916 51.3109C234.314 49.0726 234.07 46.2182 235.185 42.7476C235.921 40.4715 237.206 38.315 239.051 36.2905C240.891 34.266 243.195 32.669 245.957 31.5121C248.719 30.3552 252.178 29.7705 256.332 29.7705C261.432 29.7705 264.981 30.8268 266.985 32.933C268.983 35.0393 269.498 38.3904 268.525 42.9928L256.655 43.7472C256.989 41.7479 256.808 40.2955 256.112 39.3901C255.415 38.4848 254.193 38.0258 252.449 38.0258C251.017 38.0258 249.829 38.3653 248.883 39.038C247.938 39.7171 247.31 40.5344 246.998 41.5027C246.772 42.2069 246.868 42.8419 247.281 43.4077C247.672 43.9925 248.878 44.5395 250.893 45.0424C255.868 46.3313 259.31 47.6391 261.217 48.9594C263.125 50.2798 264.296 51.9208 264.726 53.8761C265.157 55.8315 264.987 58.0195 264.206 60.4401C263.289 63.282 261.738 65.9038 259.547 68.3056C257.357 70.7073 254.793 72.5244 251.855 73.763C248.912 75.0016 245.51 75.624 241.644 75.624C234.851 75.624 230.618 74.1716 228.942 71.2669C227.261 68.3621 226.972 64.6715 228.07 60.1949L228.065 60.2075Z"/><path d="M84.2592 0H54.6106L54.4747 0.414964H54.4351L49.205 16.1836H58.9916L60.7407 10.6885H80.8064C87.361 10.6885 91.0629 15.7246 89.0591 21.9176C87.0554 28.1107 80.0989 33.1468 73.5442 33.1468L70.0915 43.8353C76.6461 43.8353 80.3479 48.8714 78.3442 55.0644C76.3404 61.2575 69.3839 66.2936 62.8293 66.2936H33.458L22.7544 99.9874H32.541L39.5881 76.9758H59.3709C72.1575 76.9758 85.7422 67.1424 89.6478 55.0582C91.7874 48.4439 90.5931 42.5024 86.9761 38.4847C93.1911 34.4609 98.2288 28.5256 100.368 21.9113C104.274 9.83338 97.0458 0 84.2592 0Z"/></g></svg>`;
const ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.55 1.55M17.15 17.15l1.55 1.55M5.3 18.7l1.55-1.55M17.15 6.85l1.55-1.55"/></svg>';
const ICON_MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6Z"/></svg>';

// ---------------------------------------------------------------- composant
const CSS = `
:host { display: block; --triop-height: 600px; }
* { box-sizing: border-box; }
.win { --page: #F5F5F6; --card: #FFFFFF; --text: #454850; --strong: #303338; --muted: #92939A; --line: #E5E8E8; --btn: #E6E6ED; --btn-hover: #D8D8E2;
  --shadow: 0 1px 2px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.05);
  container-type: inline-size; position: relative; overflow: hidden; border-radius: 14px; background: var(--page); color: var(--text);
  font-family: var(--triop-font, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif); font-size: 13px;
  border: 1px solid var(--line); transition: background-color .25s, color .25s; }
.win[data-theme="dark"] { --page: #181818; --card: #1E1E1E; --text: #E4E4EA; --strong: #ECECF0; --muted: #B0B0B9; --line: #2C2C2C; --btn: #343434; --btn-hover: #3A3A3F;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 2px 10px rgba(0,0,0,.25); }
.topbar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 52px; padding: 0 16px; background: var(--card);
  box-shadow: 0 1px 0 var(--line); position: relative; z-index: 1; }
:host([header="off"]) .topbar { display: none; }
.logo { height: 30px; width: auto; color: #42444C; }
.win[data-theme="dark"] .logo { color: #ECECF0; opacity: .82; }
.clock { font-size: 22px; font-weight: 600; color: var(--strong); font-variant-numeric: tabular-nums; letter-spacing: .01em; }
.right { justify-self: end; display: flex; align-items: center; gap: 12px; }
.tag { font-size: 11px; color: var(--muted); white-space: nowrap; }
.theme { width: 34px; height: 30px; display: grid; place-items: center; border: 0; border-radius: 6px; background: var(--btn); color: var(--text); cursor: pointer; transition: background-color .15s; }
.theme:hover { background: var(--btn-hover); }
.theme:focus-visible { outline: 2px solid #37BFEF; outline-offset: 2px; }
.theme svg { width: 17px; height: 17px; }
.content { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 14px; padding: 14px; height: var(--triop-height); }
.col { display: grid; grid-template-rows: minmax(0, 1fr) 210px; gap: 14px; min-height: 0; }
.card { background: var(--card); border-radius: 8px; box-shadow: var(--shadow); min-height: 0; transition: background-color .25s; }
.title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .02em; color: var(--text); }
.sub { font-size: 11px; color: var(--muted); }
.bed { display: flex; flex-direction: column; padding: 12px 12px 12px; }
.bedhead { display: flex; justify-content: space-between; align-items: center; padding: 0 2px 10px; }
.state em { font-style: normal; }
.state { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--muted); }
.state i { width: 8px; height: 8px; border-radius: 50%; background: #96979D; }
.state.on i { background: #27AE60; animation: pulse 1.6s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(39,174,96,.5); } 70%, 100% { box-shadow: 0 0 0 6px rgba(39,174,96,0); } }
.stage { position: relative; flex: 1; min-height: 0; border-radius: 6px; overflow: hidden; cursor: none; touch-action: none; }
.stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.hint { position: absolute; left: 12px; bottom: 10px; font-size: 11.5px; color: var(--muted); pointer-events: none; transition: opacity .4s; }
.graph { display: flex; flex-direction: column; padding: 12px 14px 10px; }
.ghead { display: flex; justify-content: space-between; align-items: flex-start; }
.ghead .gt { font-size: 13px; color: var(--text); }
.big { text-align: center; line-height: 1.05; }
.big strong { display: block; font-size: 22px; font-weight: 700; color: var(--strong); font-variant-numeric: tabular-nums; }
.big small { font-size: 10.5px; color: var(--text); }
.plot { position: relative; flex: 1; min-height: 0; margin-top: 4px; }
.plot canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.petals { display: flex; flex-direction: column; padding: 18px 20px 16px; }
.petals .sub { margin-top: 6px; }
.pv { flex: 1; display: grid; grid-template-columns: 52px 1fr; align-items: center; gap: 10px; min-height: 0; padding: 12px 0; }
.legend { display: grid; grid-template-columns: 18px auto; grid-template-rows: auto 1fr; column-gap: 6px; height: min(100%, 300px); align-self: center; }
.legend .u { grid-column: 1 / 3; font-size: 10.5px; font-weight: 600; color: var(--text); padding-bottom: 6px; padding-left: 2px; }
.legend .bands { display: flex; flex-direction: column-reverse; }
.legend .bands b { flex: 1; }
.legend .ticks { display: flex; flex-direction: column; justify-content: space-between; font-size: 10.5px; color: var(--text); font-variant-numeric: tabular-nums; }
.pv svg { width: 100%; max-height: 100%; aspect-ratio: 1; overflow: visible; }
.pv svg text { font-size: 27px; font-weight: 700; font-variant-numeric: tabular-nums; }
.stats { display: flex; justify-content: center; gap: 28px; padding-top: 12px; border-top: 1px solid var(--line); font-size: 12px; color: var(--text); }
.stats b { font-weight: 400; margin-left: 6px; font-variant-numeric: tabular-nums; }
@container (max-width: 800px) {
  .content { grid-template-columns: 1fr; height: auto; }
  .col { display: contents; }
  .bed { order: 1; } .stage { flex: none; aspect-ratio: 16 / 11; }
  .petals { order: 2; } .pv { flex: none; grid-template-columns: 48px minmax(0, 300px); justify-content: center; }
  .legend { height: 220px; }
  .graph { order: 3; height: 210px; }
  .tag { display: none; }
}
@container (max-width: 420px) {
  .topbar { grid-template-columns: auto 1fr auto; gap: 10px; } .clock { font-size: 17px; justify-self: center; }
  .logo { height: 24px; } .content { padding: 10px; gap: 10px; }
}`;

class TriopSimulateur extends HTMLElement {
  static get observedAttributes() { return ['theme', 'lang']; }

  attributeChangedCallback() { if (this.root) { this.appliquerTheme(); this.appliquerTextes(); } }

  connectedCallback() {
    if (this.root) { this.demarrer(); return; }
    this.root = this.attachShadow({ mode: 'open' });
    const bands = Array.from({ length: 8 }, (_, i) => `<b style="background:${rgba(colormap((i + .5) / 8), 1)}"></b>`).join('');
    this.root.innerHTML = `<style>${CSS}</style>
<div class="win" part="window">
  <div class="topbar">${LOGO}<span class="clock">--:--:--</span>
    <div class="right"><span class="tag" data-t="sim"></span><button class="theme" type="button"></button></div></div>
  <div class="content">
    <div class="col">
      <section class="card bed"><div class="bedhead"><span class="title" data-t="bed"></span><span class="state"><i></i><em></em></span></div>
        <div class="stage"><canvas class="tissu" role="img"></canvas><div class="hint"></div></div></section>
      <section class="card graph"><div class="ghead"><span class="gt" data-t="graph"></span>
        <div class="big"><strong>0.00</strong><small data-t="unit"></small></div></div>
        <div class="plot"><canvas aria-hidden="true"></canvas></div></section>
    </div>
    <section class="card petals"><span class="title" data-t="petals"></span><span class="sub" data-t="avg"></span>
      <div class="pv"><div class="legend"><span class="u">cps</span><div class="bands">${bands}</div>
        <div class="ticks"><span>${CFG.echelle[1]}</span><span>${(CFG.echelle[0] + CFG.echelle[1]) / 2}</span><span>${CFG.echelle[0]}</span></div></div>
        <svg viewBox="0 0 315 315" role="img"></svg></div>
      <div class="stats"><span><span data-t="average"></span><b class="avg">0.00</b></span><span><span data-t="max"></span><b class="max">0.00</b></span></div></section>
  </div>
</div>`;
    const $ = s => this.root.querySelector(s);
    this.win = $('.win'); this.cvTissu = $('canvas.tissu'); this.cvCourbe = $('.plot canvas');
    this.hint = $('.hint'); this.etat = $('.state'); this.etatText = $('.state em'); this.bouton = $('.theme'); this.horloge = $('.clock');
    this.bigEl = $('.big strong'); this.avgEl = $('.stats .avg'); this.maxEl = $('.stats .max');
    this.construirePetales($('.pv svg'));

    this.lit = litTumoral();
    this.det = new Detecteur(this.lit);
    this.pos = [...this.lit.C]; this.cible = [...this.lit.C];
    this.mode = 'demo'; this.contact = false; this.inactif = 0;
    this.reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.tactile = matchMedia('(hover: none)').matches;
    this.parcours = this.construireParcours();
    this.histo = new Float32Array(Math.round(CFG.historique / CFG.echantillon));
    for (let i = 0; i < this.histo.length; i++) {                     // préchauffage : courbe déjà remplie de bruit de fond
      for (let j = 0; j < Math.round(CFG.echantillon / CFG.tick); j++) this.det.pas();
      this.histo[i] = this.moyenne(this.det.valeurs());
    }
    this.acc = 0; this.accEch = 0; this.tDemo = 0;

    // thème : attribut theme="light|dark|auto" (auto par défaut), choix du visiteur mémorisé par le bouton
    this.mq = matchMedia('(prefers-color-scheme: dark)');
    this.mq.addEventListener('change', () => this.appliquerTheme());
    this.bouton.addEventListener('click', () => {
      this.choix = this.themeCourant() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('triop-simulateur-theme', this.choix); } catch (e) { /* stockage indisponible */ }
      this.appliquerTheme();
      this.dispatchEvent(new CustomEvent('themechange', { detail: { theme: this.choix }, bubbles: true, composed: true }));
    });
    try { this.choix = localStorage.getItem('triop-simulateur-theme'); } catch (e) { this.choix = null; }

    const stage = $('.stage');
    const mm = e => { const r = this.cvTissu.getBoundingClientRect(); return this.versMm(e.clientX - r.left, e.clientY - r.top); };
    stage.addEventListener('pointermove', e => { if (e.pointerType === 'touch' && !this.touche) return;
      this.cible = mm(e); this.mode = 'main'; this.contact = true; this.inactif = 0; });
    stage.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') { this.mode = 'main'; this.contact = true; this.cible = mm(e); } });
    stage.addEventListener('pointerleave', e => { if (e.pointerType !== 'touch') { this.contact = false; this.inactif = 0; } });
    stage.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') { this.touche = true; stage.setPointerCapture(e.pointerId);
      this.cible = mm(e); this.mode = 'main'; this.contact = true; this.inactif = 0; } });
    const fin = e => { if (e.pointerType === 'touch') { this.touche = false; this.contact = false; this.inactif = 0; } };
    stage.addEventListener('pointerup', fin); stage.addEventListener('pointercancel', fin);

    this.ro = new ResizeObserver(() => this.redimensionner()); this.ro.observe(this.cvTissu); this.ro.observe(this.cvCourbe);
    this.io = new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; if (this.visible) this.demarrer(); });
    this.io.observe(this);
    this.visible = true;
    this.appliquerTextes();
    this.appliquerTheme();
    this.redimensionner();
    this.demarrer();
  }

  disconnectedCallback() { cancelAnimationFrame(this.raf); this.raf = null; }

  themeCourant() {
    const attr = this.getAttribute('theme');
    if (this.choix === 'light' || this.choix === 'dark') return this.choix;
    if (attr === 'light' || attr === 'dark') return attr;
    return this.mq.matches ? 'dark' : 'light';
  }
  appliquerTheme() {
    const t = this.themeCourant();
    if (this.win.dataset.theme === t && this.pal) return;
    this.win.dataset.theme = t; this.pal = THEMES[t];
    this.root.querySelector('.pv svg circle').setAttribute('fill', this.pal.center);
    this.bouton.innerHTML = t === 'dark' ? ICON_SUN : ICON_MOON;
    this.bouton.setAttribute('aria-label', this.t(t === 'dark' ? 'toLight' : 'toDark')); this.bouton.title = this.bouton.getAttribute('aria-label');
    if (this.s) this.fond = this.dessinerFond(this.cvTissu.width, this.cvTissu.height);
  }
  t(cle) { return (TEXTES[this.getAttribute('lang') === 'en' ? 'en' : 'fr'])[cle]; }
  appliquerTextes() {
    this.root.querySelectorAll('[data-t]').forEach(e => { e.textContent = this.t(e.dataset.t); });
    this.hint.textContent = this.t(this.tactile ? 'hintTouch' : 'hint');
    this.cvTissu.setAttribute('aria-label', this.t('canvas'));
    this.etatCle = null;
    if (this.s) this.fond = this.dessinerFond(this.cvTissu.width, this.cvTissu.height);
    if (this.pal) { const t = this.themeCourant(); this.bouton.setAttribute('aria-label', this.t(t === 'dark' ? 'toLight' : 'toDark')); this.bouton.title = this.bouton.getAttribute('aria-label'); }
  }

  demarrer() {
    if (this.raf || !this.lit) return;
    this.last = performance.now();
    const boucle = now => {
      if (!this.visible || document.hidden) { this.raf = null; return; }
      this.raf = requestAnimationFrame(boucle);
      this.etape(Math.min(0.25, (now - this.last) / 1000)); this.last = now;
    };
    this.raf = requestAnimationFrame(boucle);
    if (!this.visHandler) { this.visHandler = () => { if (!document.hidden) this.demarrer(); }; document.addEventListener('visibilitychange', this.visHandler); }
  }

  // ------------------------------------------------------------ géométrie
  redimensionner() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const cv of [this.cvTissu, this.cvCourbe]) {
      const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    }
    this.dpr = dpr;
    const W = this.cvTissu.width, H = this.cvTissu.height;
    this.s = Math.max(W / CFG.champ[0], H / CFG.champ[1]);              // px / mm : le champ couvre la zone
    const vw = W / this.s, vh = H / this.s;                             // recadrage centré sur la cavité, borné au champ
    this.ox = clamp(this.lit.C[0] - vw / 2, 0, CFG.champ[0] - vw);
    this.oy = clamp(this.lit.C[1] - vh / 2, 0, CFG.champ[1] - vh);
    this.fond = this.dessinerFond(W, H);
  }
  versPx(p) { return [(p[0] - this.ox) * this.s, (p[1] - this.oy) * this.s]; }
  versMm(x, y) { return [x * this.dpr / this.s + this.ox, y * this.dpr / this.s + this.oy]; }
  police(px, poids = 400) { const f = getComputedStyle(this.win).fontFamily || 'sans-serif'; return `${poids} ${px * this.dpr}px ${f}`; }

  dessinerFond(W, H) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), s = this.s, d = this.dpr, lit = this.lit, P = p => this.versPx(p), T = this.pal.tissu;
    g.fillStyle = T.bg; g.fillRect(0, 0, W, H);
    g.strokeStyle = T.grid; g.lineWidth = 1;                                                   // grille 5 mm
    for (let x = 0; x <= CFG.champ[0]; x += 5) { const X = Math.round((x - this.ox) * s) + .5; g.beginPath(); g.moveTo(X, 0); g.lineTo(X, H); g.stroke(); }
    for (let y = 0; y <= CFG.champ[1]; y += 5) { const Y = Math.round((y - this.oy) * s) + .5; g.beginPath(); g.moveTo(0, Y); g.lineTo(W, Y); g.stroke(); }
    const contour = new Path2D();                                                              // cavité de résection
    for (let i = 0; i <= 160; i++) { const a = i / 160 * 2 * Math.PI, [x, y] = P(lit.at(a, 1)); i ? contour.lineTo(x, y) : contour.moveTo(x, y); }
    contour.closePath();
    const [cx, cy] = P(lit.C), rg = g.createRadialGradient(cx, cy, 0, cx, cy, 20 * s);
    rg.addColorStop(0, T.cavA); rg.addColorStop(1, T.cavB);
    g.fillStyle = rg; g.fill(contour);
    g.save(); g.clip(contour); g.shadowColor = T.ombre; g.shadowBlur = 1.2 * s; g.lineWidth = .7 * s; g.strokeStyle = T.ombre; g.stroke(contour); g.restore();
    g.lineWidth = Math.max(1, .25 * s); g.strokeStyle = T.wall; g.stroke(contour);
    const rc = clamp(.2 * s, .9 * d, 2 * d) / 1.4;
    for (const c of lit.cellules) { const [x, y] = P([c.x, c.y]); g.fillStyle = rgba(T.cell, c.a); g.beginPath(); g.arc(x, y, rc * (.7 + .4 * c.r), 0, 7); g.fill(); }
    // cellules tumorales résiduelles : à peine plus marquées que le tissu sain (l'œil les distingue mal)
    for (const t of lit.sources) { const [x, y] = P([t.x, t.y]); g.fillStyle = rgba(T.tumeur, T.tumeurA[0] + T.tumeurA[1] * t.w); g.beginPath(); g.arc(x, y, rc, 0, 7); g.fill(); }
    const bx = W - 14 * d - 10 * s, by = 30 * d;                                           // barre d'échelle 1 cm
    g.fillStyle = T.label; g.fillRect(bx, by, 10 * s, Math.max(1, d * 1.5));
    g.font = this.police(10.5, 400); g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('1 cm', bx + 5 * s, by - 4 * d);
    return cv;
  }

  construirePetales(svg) {
    const NS = 'http://www.w3.org/2000/svg', el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); p.appendChild(e); return e; };
    const g = el('g', { transform: 'rotate(-30 157.5 157.5)' }, svg);
    this.paths = PETALS.map(d => el('path', { d }, g));
    el('circle', { cx: 157.5, cy: 157.5, r: 21, fill: '#ECEDEF' }, svg);
    this.textes = BEARINGS.map(b => { const a = b * Math.PI / 180;
      return el('text', { x: 157.5 + 88 * Math.sin(a), y: 157.5 - 88 * Math.cos(a) + 9.5, 'text-anchor': 'middle' }, svg); });
  }

  // ------------------------------------------------------------ démo automatique : visite les résidus
  construireParcours() {
    const L = this.lit, pts = [[L.C, .6], [L.foyer1, 3.4], [L.nodule, 4.2], [L.infiltration, 2.6], [L.foyer2, 3.4]];
    const segs = []; let t = 0;
    pts.forEach(([p, hold], i) => { const q = pts[(i + 1) % pts.length][0], dur = Math.hypot(q[0] - p[0], q[1] - p[1]) / CFG.vitesseDemo;
      segs.push({ p, q, t0: t, hold, dur }); t += hold + dur; });
    return { segs, total: t };
  }
  pointDemo(t) {
    const { segs, total } = this.parcours; t %= total;
    for (const s of segs) {
      if (t < s.t0 + s.hold) return [...s.p];
      if (t < s.t0 + s.hold + s.dur) { const u = (t - s.t0 - s.hold) / s.dur, e = u * u * (3 - 2 * u);
        const n = [-(s.q[1] - s.p[1]), s.q[0] - s.p[0]], b = Math.sin(Math.PI * u) * .12;     // légère courbure
        return [s.p[0] + (s.q[0] - s.p[0]) * e + n[0] * b, s.p[1] + (s.q[1] - s.p[1]) * e + n[1] * b]; }
    }
    return [...segs[0].p];
  }

  // ------------------------------------------------------------ boucle
  moyenne(v) { return v.reduce((a, b) => a + b, 0) / v.length; }

  etape(dt) {
    const autoplay = this.getAttribute('autoplay') !== 'off';
    if (this.mode === 'main' && !this.contact) { this.inactif += dt; if (this.inactif > 3 && autoplay) { this.mode = 'demo'; this.tDemo = 0; } }
    if (this.mode === 'demo') {
      if (autoplay) { this.tDemo += this.reduit ? 0 : dt; this.cible = this.reduit ? [...this.lit.nodule] : this.pointDemo(this.tDemo); this.contact = true; }
      else this.contact = false;
    }
    const k = 1 - Math.exp(-dt / 0.06);
    this.pos[0] += (this.cible[0] - this.pos[0]) * k; this.pos[1] += (this.cible[1] - this.pos[1]) * k;
    this.det.viser(this.pos, this.contact);
    this.acc += dt;
    while (this.acc >= CFG.tick) {
      this.det.pas(); this.acc -= CFG.tick; this.accEch += CFG.tick;
      if (this.accEch >= CFG.echantillon) { this.accEch -= CFG.echantillon; this.histo.copyWithin(0, 1); this.histo[this.histo.length - 1] = this.moyenne(this.det.valeurs()); }
    }
    const v = this.det.valeurs();
    this.majPanneau(v);
    this.dessinerTissu(v);
    this.dessinerCourbe();
  }

  majPanneau(v) {
    PATH_BEARING.forEach((b, i) => this.paths[i].setAttribute('fill', rgba(couleurCps(v[BEARINGS.indexOf(b)]), 1)));
    this.textes.forEach((t, k) => { t.textContent = v[k].toFixed(1); t.setAttribute('fill', textOn(couleurCps(v[k]))); });
    const moy = this.moyenne(v);
    this.bigEl.textContent = moy.toFixed(2); this.avgEl.textContent = moy.toFixed(2); this.maxEl.textContent = Math.max(...v).toFixed(2);
    const now = new Date(), hh = now.toTimeString().slice(0, 8);
    if (this.horloge.textContent !== hh) this.horloge.textContent = hh;
    const demo = this.mode === 'demo' && this.getAttribute('autoplay') !== 'off';
    const cle = demo ? 'demo' : this.contact ? 'live' : 'lifted';
    if (this.etatCle !== cle) { this.etatCle = cle; this.etatText.textContent = this.t(cle); this.etat.classList.toggle('on', cle !== 'lifted'); }
    this.hint.style.opacity = this.mode === 'main' && this.contact ? 0 : 1;
  }

  dessinerTissu(v) {
    const g = this.cvTissu.getContext('2d'), s = this.s, d = this.dpr, [x, y] = this.versPx(this.pos), R = CFG.rayonTete * s, T = this.pal.tissu;
    if (!this.fond) return;
    g.drawImage(this.fond, 0, 0);
    const alpha = this.contact ? 1 : .45, moy = couleurCps(this.moyenne(v));
    const halo = g.createRadialGradient(x, y, R * .6, x, y, R * 2.2);                        // halo : portée de détection bêta
    halo.addColorStop(0, rgba(moy, T.haloA * alpha)); halo.addColorStop(1, rgba(moy, 0));
    g.fillStyle = halo; g.beginPath(); g.arc(x, y, R * 2.2, 0, 7); g.fill();
    g.globalAlpha = alpha;
    g.fillStyle = T.head; g.beginPath(); g.arc(x, y, R, 0, 7); g.fill();
    if (!this.petalPaths) this.petalPaths = PETALS.map(p => new Path2D(p));
    g.save();                                                                                  // tête : les 6 pétales de Sonde2D.svg, comme la vue pétales
    g.translate(x, y); g.scale(R / 157.5, R / 157.5); g.rotate(-30 * Math.PI / 180); g.translate(-157.5, -157.5);
    PATH_BEARING.forEach((b, i) => { g.fillStyle = rgba(couleurCps(v[BEARINGS.indexOf(b)]), .95); g.fill(this.petalPaths[i]); });
    g.restore();
    g.fillStyle = this.pal.center; g.beginPath(); g.arc(x, y, R * 21 / 157.5, 0, 7); g.fill();
    g.lineWidth = 1.25 * d; g.strokeStyle = T.ring; g.beginPath(); g.arc(x, y, R, 0, 7); g.stroke();
    g.beginPath(); g.moveTo(x, y - R); g.lineTo(x, y - R - 7 * d); g.stroke();                       // repère 12 h
    g.fillStyle = T.dot; g.beginPath(); g.arc(x, y, 2.2 * d, 0, 7); g.fill();
    g.globalAlpha = 1;
  }

  dessinerCourbe() {
    const cv = this.cvCourbe, g = cv.getContext('2d'), d = this.dpr, W = cv.width, H = cv.height, P = this.pal.graph;
    if (W < 4 || H < 4) return;
    const h = this.histo, n = h.length, L = 34 * d, B = 18 * d, T = 8 * d, R = 6 * d, Wp = W - L - R, Hp = H - B - T;
    let pic = 0; for (const v of h) pic = Math.max(pic, v);
    const ymax = Math.max(10, pic * 1.15), Y = v => T + Hp * (1 - v / ymax), X = i => L + Wp * i / (n - 1);
    g.clearRect(0, 0, W, H);
    g.font = this.police(10.5); g.fillStyle = P.axis; g.textAlign = 'right'; g.textBaseline = 'middle';
    g.strokeStyle = P.grid; g.lineWidth = 1;
    for (let i = 0; i <= 5; i++) { const v = ymax * i / 5, y = Math.round(Y(v)) + .5; g.beginPath(); g.moveTo(L, y); g.lineTo(L + Wp, y); g.stroke(); g.fillText(v.toFixed(1), L - 6 * d, y); }
    g.textBaseline = 'bottom';
    for (let i = 0; i <= 3; i++) { const x = L + Wp * i / 3, xr = Math.round(x) + .5;            // pas de durée affichée sur l'axe
      g.beginPath(); g.moveTo(xr, T); g.lineTo(xr, T + Hp); g.stroke(); }
    g.textAlign = 'right'; g.fillText(this.t('now'), L + Wp, H);
    g.setLineDash([3 * d, 4 * d]); g.strokeStyle = P.ref;                                       // niveau du bruit de fond
    const yf = Math.round(Y(CFG.fond)) + .5; g.beginPath(); g.moveTo(L, yf); g.lineTo(L + Wp, yf); g.stroke(); g.setLineDash([]);
    const path = new Path2D(); for (let i = 0; i < n; i++) i ? path.lineTo(X(i), Y(h[i])) : path.moveTo(X(i), Y(h[i]));
    const area = new Path2D(path); area.lineTo(X(n - 1), Y(0)); area.lineTo(X(0), Y(0)); area.closePath();
    const grad = g.createLinearGradient(0, T, 0, T + Hp); grad.addColorStop(0, P.fill0); grad.addColorStop(1, P.fill1);
    g.fillStyle = grad; g.fill(area);
    g.strokeStyle = P.line; g.lineWidth = 1.4 * d; g.lineJoin = 'round'; g.stroke(path);
    g.fillStyle = P.line; g.beginPath(); g.arc(X(n - 1), Y(h[n - 1]), 2.6 * d, 0, 7); g.fill();
  }
}

if (!customElements.get('triop-simulateur')) customElements.define('triop-simulateur', TriopSimulateur);
