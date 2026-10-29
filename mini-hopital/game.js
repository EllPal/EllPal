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
    URG:  { name: 'Urgences', abbr: 'URG', shape: 'cross', proc: 0, slots: 0, cap: 8,
            desc: 'Arrivée des urgences. Les patients y sont triés par gravité.' },
    CONS: { name: 'Consultation', abbr: 'CONS', shape: 'diamond', proc: 2.5, slots: 2, cap: 6,
            desc: 'Auscultation, examen clinique, avis spécialisé. Accueille aussi les patients programmés.' },
    IMG:  { name: 'Imagerie', abbr: 'IMG', shape: 'circle', proc: 3, slots: 2, cap: 6,
            desc: 'Radiographie, scanner, IRM.' },
    HOSP: { name: 'Hospitalisation', abbr: 'HOSP', shape: 'square', proc: 1.2, slots: 3, cap: 6,
            desc: 'Admission en chambre. Les patients hospitalisés en partent aussi pour leurs examens.' },
    BLOC: { name: 'Bloc opératoire', abbr: 'BLOC', shape: 'triangle', proc: 6, slots: 1, cap: 6,
            desc: 'Chirurgie. Toujours suivie d’un passage en salle de réveil.' },
    SSPI: { name: 'Salle de réveil', abbr: 'SSPI', shape: 'pentagon', proc: 4, slots: 2, cap: 6,
            desc: 'Surveillance post-interventionnelle après le bloc.' },
    ISO:  { name: 'Isolement', abbr: 'ISO', shape: 'hexagon', proc: 3, slots: 2, cap: 6,
            desc: 'Chambres à pression négative. Les patients contagieux n’y vont que par le circuit septique.' },
    RPH:  { name: 'Radiopharmacie', abbr: 'RPH', shape: 'trefoil', proc: 0, slots: 0, cap: 99,
            desc: 'Prépare les doses de radiotraceur. Elles décroissent : livrez-les vite en médecine nucléaire par le circuit radioprotégé.' },
    MN:   { name: 'Médecine nucléaire', abbr: 'MN', shape: 'star', proc: 3.5, slots: 1, cap: 6,
            desc: 'TEP et scintigraphie. Chaque examen consomme une dose ; le patient en ressort radioactif.' },
    REA:  { name: 'Réanimation', abbr: 'RÉA', shape: 'heart', proc: 2.5, slots: 2, cap: 6,
            desc: 'Admission des urgences vitales.' },
  };

  const TRIAGE = {
    1: { name: 'Urgence vitale', patience: 70, color: 't1' },
    2: { name: 'Urgence', patience: 110, color: 't2' },
    3: { name: 'Semi-urgent', patience: 170, color: 't3' },
    4: { name: 'Programmé', patience: 250, color: 't4' },
  };

  // Parcours de soins par service d'origine. « A|B » : A si le service existe, sinon B.
  const TEMPLATES = {
    URG: [
      { name: 'Polytraumatisé', tri: 1, path: ['IMG', 'BLOC', 'SSPI', 'REA|HOSP'], w: 2 },
      { name: 'AVC', tri: 1, path: ['IMG', 'REA|HOSP'], w: 2 },
      { name: 'Appendicite', tri: 2, path: ['IMG', 'BLOC', 'SSPI', 'HOSP'], w: 3 },
      { name: 'Douleur thoracique', tri: 2, path: ['CONS', 'IMG', 'HOSP'], w: 3 },
      { name: 'Fracture du poignet', tri: 3, path: ['IMG', 'CONS'], w: 4 },
      { name: 'Malaise', tri: 3, path: ['CONS'], w: 3 },
      { name: 'Suspicion de tuberculose', tri: 2, inf: true, path: ['IMG', 'ISO'], w: 2 },
      { name: 'Gastro-entérite à norovirus', tri: 3, inf: true, path: ['ISO'], w: 2 },
    ],
    CONS: [
      { name: 'Bilan radiologique', tri: 4, path: ['IMG'], w: 4 },
      { name: 'Chirurgie ambulatoire', tri: 4, path: ['BLOC', 'SSPI'], w: 2 },
      { name: 'Bilan d’extension', tri: 4, path: ['IMG', 'MN'], w: 2 },
      { name: 'Scintigraphie osseuse', tri: 4, path: ['MN'], w: 2 },
    ],
    HOSP: [
      { name: 'Scanner de contrôle', tri: 3, path: ['IMG', 'HOSP'], w: 4 },
      { name: 'TEP en cours d’hospitalisation', tri: 3, path: ['MN', 'HOSP'], w: 3 },
      { name: 'Reprise chirurgicale', tri: 2, path: ['BLOC', 'SSPI', 'HOSP'], w: 2 },
      { name: 'Avis spécialisé', tri: 4, path: ['CONS', 'HOSP'], w: 2 },
      { name: 'Détresse respiratoire', tri: 1, path: ['REA'], w: 1 },
      { name: 'BMR détectée', tri: 3, inf: true, path: ['ISO'], w: 2 },
    ],
  };
  const SPAWN_WEIGHT = { URG: 3, CONS: 1.6, HOSP: 1.2 };

  // Ouverture des services au fil de la garde.
  const SCHEDULE = [
    { t: 0, types: ['URG', 'IMG', 'HOSP', 'CONS'] },
    { t: 35, types: ['BLOC'] },
    { t: 50, types: ['SSPI'] },
    { t: 85, types: ['ISO'], unlock: 'sep' },
    { t: 130, types: ['RPH', 'MN'], unlock: 'rad' },
    { t: 175, types: ['REA'] },
  ];
  const EXTRA_EVERY = 38;
  const EXTRA_WEIGHT = { IMG: 3, CONS: 2, HOSP: 2, BLOC: 1.5, SSPI: 1.2, URG: 1, ISO: 0.8, MN: 0.6, REA: 0.8 };

  // Qui a le droit d'emprunter quel circuit.
  const RIDE = { std: ['std'], inf: ['sep'], rad: ['rad'], dose: ['rad'] };
  const KIND_LABEL = { std: 'Circuit standard', sep: 'Circuit septique', rad: 'Circuit radioprotégé' };
  const KIND_RULE = {
    std: 'Patients sans précaution particulière.',
    sep: 'Réservé aux patients contagieux : il évite toute contamination croisée.',
    rad: 'Réservé aux doses de radiotraceur et aux patients injectés, radioactifs.',
  };

  const SLOT_DEFS = [
    { kind: 'std', color: 'l1' }, { kind: 'std', color: 'l2' }, { kind: 'std', color: 'l3' },
    { kind: 'std', color: 'l4' }, { kind: 'std', color: 'l5' }, { kind: 'std', color: 'l6' },
    { kind: 'std', color: 'l7' },
    { kind: 'sep', color: 'sep' }, { kind: 'sep', color: 'sep' },
    { kind: 'rad', color: 'rad' }, { kind: 'rad', color: 'rad' },
  ];

  const UPGRADES = {
    line: { title: 'Nouveau circuit', desc: 'Un circuit standard de plus à tracer.', ok: () => lockedSlot('std') },
    line_sep: { title: 'Second circuit septique', desc: 'Un deuxième circuit réservé aux patients contagieux.',
      ok: () => G.slots.some(s => s.kind === 'sep' && s.unlocked) && lockedSlot('sep') },
    line_rad: { title: 'Second circuit radioprotégé', desc: 'Un deuxième circuit pour les doses et patients radioactifs.',
      ok: () => G.slots.some(s => s.kind === 'rad' && s.unlocked) && lockedSlot('rad') },
    staff: { title: 'Renfort d’équipe', desc: '+1 poste de soin sur le service de votre choix : il traite deux patients à la fois.', ok: () => true },
    room: { title: 'Salle d’attente agrandie', desc: '+4 places d’attente sur un service avant saturation.', ok: () => true },
    cart: { title: 'Chariot double', desc: '+2 places pour chaque brancardier d’un circuit.', ok: () => true },
  };
  const TOKEN_LABEL = { staff: 'Renfort', room: 'Salle d’attente', cart: 'Chariot double' };
  const TOKEN_HINT = {
    staff: 'Touchez un service de soins pour y affecter le renfort.',
    room: 'Touchez un service pour agrandir sa salle d’attente.',
    cart: 'Touchez un circuit (sur le plan ou dans la palette) pour doubler ses chariots.',
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
    'sep', 'rad', 'rad-ink', 't1', 't2', 't3', 't4', 'line-soft'];
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
    const aspect = clamp(CW / availH, 0.5, 2.3);
    const H = 800, W = Math.round(800 * aspect);
    G = {
      t: 0, score: 0, incidents: 0, lwbs: 0, dosesLost: 0, week: 1, nextWeek: WEEK,
      W, H, region: null,
      nodes: [], lines: [], vehicles: [], floaters: [],
      pool: 3, inv: { staff: 0, room: 0, cart: 0 }, apply: null,
      slots: SLOT_DEFS.map((d, i) => ({ i, kind: d.kind, color: d.color, unlocked: d.kind === 'std' && i < 3, line: null })),
      selSlot: null, speed: 1, paused: false, over: false, modal: false,
      schedIdx: 0, nextExtra: 210, spawnT: 4, distCache: new Map(), uiVersion: 0, started: false,
    };
    updateRegion();
    cam.ready = false;
    runSchedule();
    G.uiVersion++;
  }

  function updateRegion() {
    const f = clamp(0.52 + G.t / 650, 0.52, 1);
    const w = G.W * f, h = G.H * f;
    G.region = { x: (G.W - w) / 2, y: (G.H - h) / 2, w, h };
  }

  // ================================================================
  // Services
  // ================================================================
  function nodeById(id) { return G.nodes.find(n => n.id === id); }
  function hasType(t) { return G.nodes.some(n => n.type === t); }

  function addNode(type) {
    const R = G.region;
    for (let a = 0; a < 500; a++) {
      const relax = a > 300 ? 0.75 : a > 150 ? 0.88 : 1;
      const x = R.x + 55 + Math.random() * (R.w - 110);
      const y = R.y + 55 + Math.random() * (R.h - 110);
      let ok = true;
      for (const n of G.nodes) if (Math.hypot(n.x - x, n.y - y) < MIN_SPACING * relax) { ok = false; break; }
      if (!ok) continue;
      const T = TYPES[type];
      const node = {
        id: uid++, type, x, y, waiting: [], queue: [], treating: [], doses: [],
        slots: T.slots, cap: T.cap, over: 0, born: G.t, rphT: DOSE_EVERY * 0.5,
      };
      G.nodes.push(node);
      invalidateNet();
      return node;
    }
    return null;
  }

  function runSchedule() {
    while (G.schedIdx < SCHEDULE.length && G.t >= SCHEDULE[G.schedIdx].t) {
      const ev = SCHEDULE[G.schedIdx++];
      for (const t of ev.types) addNode(t);
      if (G.t > 0) {
        toast(`Nouveau service : <b>${ev.types.map(t => TYPES[t].name).join(' + ')}</b>`);
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
    if (G.t >= G.nextExtra) {
      G.nextExtra += EXTRA_EVERY;
      const types = Object.keys(EXTRA_WEIGHT).filter(t => hasType(t));
      const t = pickWeighted(types, k => EXTRA_WEIGHT[k]);
      if (addNode(t)) toast(`Ouverture d’un service supplémentaire : <b>${TYPES[t].name}</b>`);
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
      const opts = step.split('|');
      const t = opts.find(o => hasType(o));
      if (!t) return null;
      out.push(t);
    }
    return out;
  }

  function spawnPatient() {
    const options = [];
    for (const n of G.nodes) {
      const tpls = TEMPLATES[n.type];
      if (!tpls) continue;
      if (n.type === 'HOSP' && G.t < 40) continue;
      for (const tpl of tpls) {
        const path = resolvePath(tpl.path);
        if (path) options.push({ n, tpl, path, w: SPAWN_WEIGHT[n.type] * tpl.w });
      }
    }
    if (!options.length) return;
    const o = pickWeighted(options, x => x.w);
    const tri = TRIAGE[o.tpl.tri];
    const p = {
      id: uid++, kind: 'patient', name: o.tpl.name, tri: o.tpl.tri, path: o.path, step: 0,
      inf: !!o.tpl.inf, rad: false, patience: tri.patience, maxPatience: tri.patience, born: G.t, qt: 0,
    };
    o.n.waiting.push(p);
  }

  function spawnInterval() {
    return Math.max(0.9, 5.2 * Math.pow(0.9975, G.t)) * rand(0.7, 1.3);
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

  function finishStep(p, node) {
    if (node.type === 'MN') p.rad = true;
    p.step++;
    if (p.step >= p.path.length) {
      G.score++;
      floater(node.x, node.y - NODE_R - 14, '+1', 'ink');
      return;
    }
    p.patience = Math.max(p.patience, p.maxPatience * 0.6); // un patient pris en charge est stabilisé
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

  // Distance (en arrêts) de chaque service au plus proche service du type voulu,
  // en n'empruntant que les circuits autorisés pour cette catégorie.
  function distMap(cat, type) {
    const key = cat + '|' + type;
    let m = G.distCache.get(key);
    if (m) return m;
    const kinds = RIDE[cat];
    const rev = new Map();
    const add = (a, b) => { if (!rev.has(a)) rev.set(a, []); rev.get(a).push(b); };
    for (const l of G.lines) {
      if (!kinds.includes(l.kind)) continue;
      for (const [a, b] of linePairs(l)) { add(b, a); if (!l.loop) add(a, b); }
    }
    m = new Map();
    const q = [];
    for (const n of G.nodes) if (n.type === type) { m.set(n.id, 0); q.push(n.id); }
    for (let qi = 0; qi < q.length; qi++) {
      const v = q[qi], d = m.get(v);
      for (const u of rev.get(v) || []) if (!m.has(u)) { m.set(u, d + 1); q.push(u); }
    }
    G.distCache.set(key, m);
    return m;
  }
  function progresses(e, hereId, nextId) {
    const m = distMap(catOf(e), wants(e));
    const dh = m.get(hereId), dn = m.get(nextId);
    return dh !== undefined && dn !== undefined && dn === dh - 1;
  }

  // ---------- Géométrie octilinéaire des circuits ----------
  function segUseKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  function segPoints(a, b, off) {
    let A = a, B = b, rev = false;
    if (a.id > b.id) { A = b; B = a; rev = true; }
    const dx = B.x - A.x, dy = B.y - A.y, adx = Math.abs(dx), ady = Math.abs(dy);
    const sx = Math.sign(dx) || 1, sy = Math.sign(dy) || 1;
    const Cn = adx > ady ? { x: A.x + sx * (adx - ady), y: A.y } : { x: A.x, y: A.y + sy * (ady - adx) };
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
    const l = { id: uid++, slot: slot.i, kind: slot.kind, color: slot.color, nodes: nodes.slice(), loop: !!loop && nodes.length > 2, cart: 0, geom: null };
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
  function vehCap(v) { return VEH_CAP + v.line.cart; }

  function addVehicle(l) {
    if (G.pool <= 0) return null;
    G.pool--;
    const others = G.vehicles.filter(v => v.line === l).length;
    const n = l.nodes.length;
    const si = others % 2 === 1 && !l.loop ? n - 1 : 0;
    const v = { id: uid++, line: l, cargo: [], si, ti: si, dir: si === 0 ? 1 : -1, pos: l.geom.nodeDist[si], td: 0, state: 'move', wait: 0, x: 0, y: 0, a: 0 };
    v.td = v.pos;
    G.vehicles.push(v);
    G.uiVersion++;
    return v;
  }

  function removeVehicle(v) {
    const n = nodeById(v.line.nodes[v.ti]) || nodeById(v.line.nodes[v.si]) || nodeById(v.line.nodes[0]);
    for (const e of v.cargo) if (n) drop(e, n);
    v.cargo = [];
    G.vehicles = G.vehicles.filter(x => x !== v);
    G.pool++;
    G.uiVersion++;
  }

  function remapVehicle(v) {
    // le brancardier reprend au service vers lequel il roulait, ou au plus proche
    const l = v.line;
    let idx = l.nodes.indexOf(v.targetId);
    if (idx < 0) {
      let best = Infinity;
      l.nodes.forEach((id, i) => { const n = nodeById(id); const d = Math.hypot(n.x - v.x, n.y - v.y); if (d < best) { best = d; idx = i; } });
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
    let moves = 0;
    // Descente : arrivé à destination, ou correspondance.
    for (const e of v.cargo.slice()) {
      if ((e.kind === 'patient' && wants(e) === node.type) || (e.kind === 'dose' && node.type === 'MN')) {
        v.cargo.splice(v.cargo.indexOf(e), 1); deliver(e, node); moves++;
      } else if (!progresses(e, node.id, nextId)) {
        v.cargo.splice(v.cargo.indexOf(e), 1); node.waiting.push(e); moves++;
      }
    }
    // Montée : priorité à la gravité, puis au temps restant.
    const cap = vehCap(v);
    const cands = node.waiting.filter(e => canRide(e, l.kind) && progresses(e, node.id, nextId));
    cands.sort((a, b) => priority(a) - priority(b));
    for (const e of cands) {
      if (v.cargo.length >= cap) break;
      node.waiting.splice(node.waiting.indexOf(e), 1);
      v.cargo.push(e);
      moves++;
    }
    v.state = 'stop';
    v.wait = 0.4 + moves * 0.22;
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
        gameOver(`${TYPES[n.type].name} : salle d’attente saturée trop longtemps.`);
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
    const tick = (arr, x, y) => {
      for (let i = arr.length - 1; i >= 0; i--) {
        const e = arr[i];
        if (e.kind === 'dose') {
          e.life -= dt;
          if (e.life <= 0) { arr.splice(i, 1); G.dosesLost++; floater(x, y - 20, 'Dose périmée', 'muted'); }
          continue;
        }
        e.patience -= dt;
        if (e.patience <= 0) {
          arr.splice(i, 1);
          if (e.tri <= 2) {
            G.incidents++;
            floater(x, y - 20, 'Incident grave', 't1');
            toast(`<b>Incident grave</b> : ${e.name} (${TRIAGE[e.tri].name.toLowerCase()}) n’a pas été pris en charge à temps.`, true);
            if (G.incidents >= MAX_INCIDENTS) gameOver('Trois incidents graves : l’ARS ferme vos urgences.');
          } else {
            G.lwbs++;
            floater(x, y - 20, 'Parti sans soins', 'muted');
          }
        }
      }
    };
    for (const n of G.nodes) { tick(n.waiting, n.x, n.y); tick(n.queue, n.x, n.y); tick(n.doses, n.x, n.y); }
    for (const v of G.vehicles) tick(v.cargo, v.x, v.y);
  }

  function floater(x, y, text, color) { G.floaters.push({ x, y, text, color, t: 0 }); }

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
    HUD_BOTTOM = CH - bot.top + 8;
  }

  function updateCamera() {
    const R = G.region, m = 40;
    const availW = CW - 16, availH = Math.max(120, CH - HUD_TOP - HUD_BOTTOM);
    const s = Math.min(availW / (R.w + m * 2), availH / (R.h + m * 2));
    const ox = CW / 2 - (R.x + R.w / 2) * s;
    const oy = HUD_TOP + availH / 2 - (R.y + R.h / 2) * s;
    if (!cam.ready) { cam.s = s; cam.ox = ox; cam.oy = oy; cam.ready = true; return; }
    const k = 0.08;
    cam.s += (s - cam.s) * k; cam.ox += (ox - cam.ox) * k; cam.oy += (oy - cam.oy) * k;
  }
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
    c.strokeStyle = color; c.lineWidth = width; c.stroke();
    if (kind === 'sep') {
      c.setLineDash([7, 7]); c.strokeStyle = C.node; c.lineWidth = width * 0.38; c.lineCap = 'butt'; c.stroke(); c.setLineDash([]);
    } else if (kind === 'rad') {
      c.setLineDash([5, 6]); c.strokeStyle = C['rad-ink']; c.lineWidth = width * 0.55; c.lineCap = 'butt'; c.stroke(); c.setLineDash([]);
    }
    c.globalAlpha = 1;
  }

  function endHandles(l) {
    if (l.loop) return [];
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

    // Emprise du bâtiment et carrelage.
    const R = G.region;
    c.fillStyle = C.floor;
    roundRect(c, R.x, R.y, R.w, R.h, 18); c.fill();
    c.save(); roundRect(c, R.x, R.y, R.w, R.h, 18); c.clip();
    c.strokeStyle = C.grid; c.lineWidth = 1 / cam.s;
    c.beginPath();
    for (let x = Math.floor(R.x / 40) * 40; x < R.x + R.w; x += 40) { c.moveTo(x, R.y); c.lineTo(x, R.y + R.h); }
    for (let y = Math.floor(R.y / 40) * 40; y < R.y + R.h; y += 40) { c.moveTo(R.x, y); c.lineTo(R.x + R.w, y); }
    c.stroke(); c.restore();

    // Circuits.
    for (const l of G.lines) {
      const hidden = drag && drag.line === l && (drag.mode === 'extend' || drag.mode === 'insert');
      strokeLine(c, l.geom.pts, C[l.color], l.kind, LINE_W, hidden ? 0.25 : 1);
      if (!hidden) for (const h of endHandles(l)) {
        c.strokeStyle = C[l.color]; c.lineWidth = LINE_W; c.lineCap = 'butt';
        c.beginPath(); c.moveTo(h.base.x, h.base.y); c.lineTo(h.tip.x, h.tip.y); c.stroke();
        c.beginPath(); c.moveTo(h.tip.x - h.dy * 9, h.tip.y + h.dx * 9); c.lineTo(h.tip.x + h.dy * 9, h.tip.y - h.dx * 9); c.stroke();
      }
    }
    drawDragPreview(c);

    // Brancardiers.
    for (const v of G.vehicles) {
      const cap = vehCap(v), cols = Math.ceil(cap / 2);
      const len = Math.max(24, cols * 8 + 8), wid = 15;
      c.save(); c.translate(v.x, v.y); c.rotate(v.a);
      c.fillStyle = C[v.line.color];
      roundRect(c, -len / 2, -wid / 2, len, wid, 4); c.fill();
      c.lineWidth = 1.5; c.strokeStyle = C.ink; c.stroke();
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
    for (const n of G.nodes) drawNode(c, n, n === hover);

    // Textes flottants.
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const f of G.floaters) {
      c.globalAlpha = 1 - f.t / 1.6;
      c.font = `700 ${f.text.length > 3 ? 11 : 14}px ${getFont()}`;
      c.fillStyle = C[f.color] || C.ink;
      c.fillText(f.text, f.x, f.y - f.t * 18);
    }
    c.globalAlpha = 1;
  }
  let fontCache = null;
  function getFont() {
    if (!fontCache) fontCache = getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() || 'sans-serif';
    return fontCache;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  function drawNode(c, n, hovered) {
    const T = TYPES[n.type];
    const age = G.t - n.born;
    const sc = age < 0.5 && !reduceMotion ? 0.4 + 1.2 * age : 1;
    const r = NODE_R * sc;
    // anneau de saturation
    if (n.over > 0) {
      const f = n.over / OVERFLOW_LIMIT;
      c.beginPath(); c.arc(n.x, n.y, r + 12, 0, Math.PI * 2);
      c.fillStyle = C.danger; c.globalAlpha = 0.12 + 0.18 * f; c.fill(); c.globalAlpha = 1;
      c.beginPath(); c.arc(n.x, n.y, r + 12, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
      c.strokeStyle = C.danger; c.lineWidth = 4; c.lineCap = 'round'; c.stroke();
    }
    if (hovered) {
      c.beginPath(); c.arc(n.x, n.y, r + 7, 0, Math.PI * 2); c.strokeStyle = C.ink; c.globalAlpha = 0.25; c.lineWidth = 3; c.stroke(); c.globalAlpha = 1;
    }
    if (n.type === 'RPH') {
      shapePath(c, 'circle', n.x, n.y, r);
      c.fillStyle = C.node; c.fill(); c.lineWidth = 4; c.strokeStyle = C.ink; c.stroke();
      trefoil(c, n.x, n.y, r * 0.62, C.ink, C.node);
    } else {
      shapePath(c, T.shape, n.x, n.y, r);
      c.fillStyle = C.node; c.fill();
      c.lineWidth = 4; c.lineJoin = 'round'; c.strokeStyle = C.ink; c.stroke();
    }
    // postes de soin : un arc par poste, rempli selon l'avancement
    if (n.slots > 0) {
      const gap = 0.18, span = (Math.PI * 2) / n.slots;
      for (let i = 0; i < n.slots; i++) {
        const a0 = -Math.PI / 2 + i * span + gap / 2, a1 = a0 + span - gap;
        c.beginPath(); c.arc(n.x, n.y, r + 5, a0, a1);
        c.strokeStyle = C['line-soft']; c.lineWidth = 2.5; c.lineCap = 'butt'; c.stroke();
        const tr = n.treating[i];
        if (tr) {
          c.beginPath(); c.arc(n.x, n.y, r + 5, a0, a0 + (a1 - a0) * Math.min(1, tr.t / tr.T));
          c.strokeStyle = C.accent; c.lineWidth = 3; c.stroke();
        }
      }
    }
    // libellé
    c.font = `700 9px ${getFont()}`;
    c.textAlign = 'center'; c.textBaseline = 'top';
    c.fillStyle = C.muted;
    c.fillText(T.abbr, n.x, n.y + r + 9);
    // doses en stock
    if (n.type === 'MN') {
      n.doses.forEach((d, i) => {
        c.globalAlpha = 0.45 + 0.55 * d.life / DOSE_LIFE;
        trefoil(c, n.x - (n.doses.length - 1) * 5 + i * 10, n.y - r - 12, 4, C['rad-ink'], C.rad);
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
      c.fillStyle = C.ink; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = `700 9px ${getFont()}`;
      c.fillText('+' + (n.waiting.length - 15), n.x + r + 12 + per * sp, n.y + 12);
    }
    n.queue.slice(0, 10).forEach((e, i) => {
      const col = i % per, row = Math.floor(i / per);
      drawQueued(c, e, n.x - r - 12 - col * sp, n.y - 9 + row * sp);
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

  function drawDragPreview(c) {
    if (!drag) return;
    const slotColor = C[drag.color] || C.ink;
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
    for (const n of G.nodes) { const d = dist(n, p); if (d < tol && d < bd) { bd = d; best = n; } }
    return best;
  }
  function handleAt(p) {
    const tol = Math.max(14, 20 / cam.s);
    let best = null, bd = Infinity;
    for (const l of G.lines) for (const h of endHandles(l)) {
      const d = Math.min(dist(h.tip, p), dist({ x: (h.tip.x + h.base.x) / 2 + h.dx * 4, y: (h.tip.y + h.base.y) / 2 + h.dy * 4 }, p));
      if (d < tol && d < bd) { bd = d; best = h; }
    }
    return best;
  }
  function lineAt(p) {
    const tol = Math.max(9, 14 / cam.s);
    let best = null, bd = Infinity;
    for (const l of G.lines) {
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
      drag = { mode: 'new', list: [n.id], slot, kind: slot ? slot.kind : 'std', color: slot ? slot.color : 'muted', loop: false, pt: p, sx, sy, moved: false, start: n };
      return;
    }
    const hit = lineAt(p);
    if (hit) {
      drag = { mode: 'insert', line: hit.line, seg: hit.seg, target: null, color: hit.line.color, pt: p, sx, sy, moved: false };
    }
  });

  canvas.addEventListener('pointermove', ev => {
    if (!drag) return;
    const { sx, sy } = evtPoint(ev);
    const p = toWorld(sx, sy);
    drag.pt = p;
    if (Math.hypot(sx - drag.sx, sy - drag.sy) > 6) drag.moved = true;
    const h = nodeAt(p, 0);
    drag.hover = h;
    if (!h) return;
    if (drag.mode === 'new' || drag.mode === 'extend') {
      const L = drag.list, len = L.length;
      if (drag.loop) { if (h.id === L[len - 1]) drag.loop = false; return; }
      if (h.id === L[len - 1]) return;
      if (len >= 2 && h.id === L[len - 2]) { L.pop(); return; }
      if (h.id === L[0] && len >= 3) { drag.loop = true; return; }
      if (!L.includes(h.id)) L.push(h.id);
    } else if (drag.mode === 'insert') {
      drag.target = drag.line.nodes.includes(h.id) ? null : h;
    }
  });

  const endDrag = ev => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.mode === 'new') {
      if (d.list.length >= 2) {
        const slot = pickSlot();
        if (!slot) { toast('Tous vos circuits sont utilisés. Prolongez-en un, ou supprimez-en un depuis la palette.', true); return; }
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
      if (!same) setLineNodes(d.line, list, d.loop);
    } else if (d.mode === 'insert') {
      if (d.target) {
        const nodes = d.line.nodes.slice();
        nodes.splice(d.seg + 1, 0, d.target.id);
        setLineNodes(d.line, nodes, d.line.loop);
      } else if (!d.moved) {
        openLinePanel(d.line);
      }
    }
    void ev;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', () => { drag = null; });

  function applyToken(p) {
    const tok = G.apply;
    if (tok === 'cart') {
      const hit = lineAt(p);
      if (hit) applyCart(hit.line);
      else { G.apply = null; G.uiVersion++; }
      return;
    }
    const n = nodeAt(p);
    if (!n) { G.apply = null; G.uiVersion++; return; }
    if (tok === 'staff') {
      if (TYPES[n.type].proc <= 0) { toast('Ce service ne dispense pas de soins : choisissez-en un autre.', true); return; }
      n.slots++;
      toast(`Renfort affecté : <b>${TYPES[n.type].name}</b> passe à ${n.slots} postes de soin.`);
    } else if (tok === 'room') {
      n.cap += 4;
      toast(`Salle d’attente agrandie : <b>${TYPES[n.type].name}</b> accueille ${n.cap} patients.`);
    }
    G.inv[tok]--; G.apply = null; G.uiVersion++;
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
    pool: $('#poolN'), inv: $('#inv'), hint: $('#hint'), toasts: $('#toasts'),
    lp: $('#linePanel'), nt: $('#nodeTip'),
  };

  function toast(html, bad) {
    const t = document.createElement('div');
    t.className = 'toast' + (bad ? ' bad' : '');
    t.innerHTML = html;
    t.addEventListener('click', () => t.remove());
    el.toasts.appendChild(t);
    while (el.toasts.children.length > 2) el.toasts.firstChild.remove();
    setTimeout(() => t.remove(), bad ? 4500 : 5500);
  }

  let lastUi = -1;
  function hudTick() {
    if (!G) return;
    el.score.textContent = G.score;
    const dayIdx = Math.floor(G.t / DAY) % 7;
    const frac = (G.t % DAY) / DAY;
    const mins = Math.floor((frac * 24 * 60) / 10) * 10;
    el.day.textContent = `${DAYS[dayIdx]} · S${G.week}`;
    el.clock.textContent = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    if (el.strikes.children.length !== MAX_INCIDENTS) el.strikes.innerHTML = '<i></i>'.repeat(MAX_INCIDENTS);
    [...el.strikes.children].forEach((x, i) => x.classList.toggle('on', i < G.incidents));
    updateHint();
    if (lastUi === G.uiVersion) return;
    lastUi = G.uiVersion;
    renderPalette();
    el.pool.textContent = G.pool;
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
      b.innerHTML = `<span class="dot"></span>` + (s.line ? `<span class="n">${nv}</span>` : '');
      b.setAttribute('aria-label', `${KIND_LABEL[s.kind]}${s.line ? `, ${nv} brancardier(s)` : ', libre'}`);
      b.title = s.line ? `${KIND_LABEL[s.kind]} : gérer` : `${KIND_LABEL[s.kind]} : sélectionner pour tracer`;
      b.addEventListener('click', () => {
        if (G.apply === 'cart' && s.line) { applyCart(s.line); return; }
        if (s.line) { G.selSlot = s.i; G.uiVersion++; openLinePanel(s.line, b); }
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

  let hintKey = '';
  function updateHint() {
    let key = '', html = '';
    if (G.apply) { key = 'apply' + G.apply; html = `${TOKEN_HINT[G.apply]}<button id="cancelApply">Annuler</button>`; }
    else if (!G.lines.length) { key = 'first'; html = 'Glissez d’un service à un autre pour tracer votre premier circuit de brancardage.'; }
    else if (hasType('ISO') && !G.lines.some(l => l.kind === 'sep')) { key = 'sep'; html = 'Les patients contagieux ne voyagent que sur le circuit septique. Touchez la pastille verte en pointillé, puis tracez des Urgences vers l’Isolement.'; }
    else if (hasType('MN') && !G.lines.some(l => l.kind === 'rad')) { key = 'rad'; html = 'Touchez la pastille jaune, puis reliez la Radiopharmacie à la Médecine nucléaire : les doses et les patients injectés ne passent que par ce circuit.'; }
    else if (G.lines.length === 1 && G.t < 40) { key = 'second'; html = 'Chaque patient porte la forme du service où il doit aller. Reliez tous les services pour que les brancardiers les y conduisent.'; }
    else if (G.selSlot != null && G.slots[G.selSlot] && !G.slots[G.selSlot].line) { key = 'sel' + G.selSlot; html = `${KIND_LABEL[G.slots[G.selSlot].kind]} sélectionné : glissez d’un service à l’autre pour le tracer.`; }
    if (key === hintKey) return;
    hintKey = key;
    el.hint.innerHTML = html;
    const b = $('#cancelApply');
    if (b) b.addEventListener('click', () => { G.apply = null; G.uiVersion++; });
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
    $('#ntTitle').textContent = T.name;
    $('#ntDesc').textContent = T.desc;
    const rows = [];
    if (n.slots) rows.push(['Postes de soin', `${n.treating.length} / ${n.slots}`]);
    if (T.proc) rows.push(['File de soins', n.queue.length]);
    rows.push(['Attente brancardier', n.waiting.filter(e => e.kind === 'patient').length]);
    if (n.type !== 'RPH') rows.push(['Capacité avant saturation', n.cap]);
    if (n.type === 'MN') rows.push(['Doses en stock', n.doses.length]);
    if (n.type === 'RPH') rows.push(['Doses prêtes', n.waiting.filter(e => e.kind === 'dose').length]);
    const urgent = [...n.waiting, ...n.queue].filter(e => e.kind === 'patient').sort((a, b) => a.tri - b.tri)[0];
    if (urgent) rows.push(['Plus urgent', `${urgent.name}`]);
    $('#ntKv').innerHTML = rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
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
    const box = $('#choices');
    box.innerHTML = '';
    for (const k of picks) {
      const b = document.createElement('button');
      b.className = 'choice';
      b.innerHTML = `<strong>${UPGRADES[k].title}</strong><span>${UPGRADES[k].desc}</span>`;
      b.addEventListener('click', () => {
        if (k === 'line') unlockSlot('std');
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
    $('#endStats').innerHTML = [
      [G.score, 'patients soignés'], [days, days > 1 ? 'jours de garde' : 'jour de garde'],
      [G.incidents, 'incidents graves'], [G.lwbs, 'partis sans soins'], [G.dosesLost, 'doses périmées'],
    ].map(([v, k]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
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
    else if (ev.key === 'Escape') { if (G) { G.apply = null; G.selSlot = null; G.uiVersion++; } drag = null; closePanels(); }
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
      if (type === 'RPH') {
        shapePath(c, 'circle', 14, 14, 10); c.fillStyle = C.node; c.fill(); c.lineWidth = 2.5; c.strokeStyle = C.ink; c.stroke();
        trefoil(c, 14, 14, 6, C.ink, C.node); return;
      }
      shapePath(c, TYPES[type].shape, 14, 14, 9); c.fillStyle = C.node; c.fill(); c.lineWidth = 2.5; c.lineJoin = 'round'; c.strokeStyle = C.ink; c.stroke();
    };
  }
  function buildLegend() {
    readColors();
    const sv = $('#legendServices'); sv.innerHTML = '';
    for (const k of Object.keys(TYPES)) legendItem(sv, nodeIcon(k), TYPES[k].name, TYPES[k].desc);
    const pv = $('#legendPatients'); pv.innerHTML = '';
    for (const k of [1, 2, 3, 4]) {
      legendItem(pv, c => { shapePath(c, 'circle', 14, 14, 7); c.fillStyle = C[TRIAGE[k].color]; c.fill(); c.lineWidth = 2; c.strokeStyle = C.ink; c.stroke(); },
        TRIAGE[k].name, `Délai avant dégradation : ${TRIAGE[k].patience} s.` + (k <= 2 ? ' Dépassé, c’est un incident grave.' : ' Dépassé, le patient part sans soins.'));
    }
    legendItem(pv, c => { drawEntity(c, { kind: 'patient', tri: 2, inf: true, rad: false, path: ['ISO'], step: 0, patience: 1, maxPatience: 1 }, 14, 14, 5, false); },
      'Patient contagieux', 'Anneau vert pointillé. Il ne voyage que sur le circuit septique.');
    legendItem(pv, c => { drawEntity(c, { kind: 'patient', tri: 3, inf: false, rad: true, path: ['HOSP'], step: 0, patience: 1, maxPatience: 1 }, 14, 14, 5, false); },
      'Patient radioactif', 'Anneau jaune. Après une TEP ou une scintigraphie, il rentre par le circuit radioprotégé.');
    legendItem(pv, c => trefoil(c, 14, 14, 8, C['rad-ink'], C.rad), 'Dose de radiotraceur', `Décroît en ${DOSE_LIFE} s. Sans dose, la médecine nucléaire est à l’arrêt.`);
    legendItem(pv, c => { shapePath(c, 'triangle', 14, 14, 7); c.fillStyle = C.t4; c.fill(); c.lineWidth = 2; c.strokeStyle = C.ink; c.stroke(); },
      'Forme = prochaine étape', 'Un triangle va au bloc, un cercle en imagerie… Couleur = niveau de tri.');
    const lv = $('#legendLines'); lv.innerHTML = '';
    for (const [kind, col] of [['std', 'l1'], ['sep', 'sep'], ['rad', 'rad']]) {
      legendItem(lv, c => strokeLine(c, [{ x: 3, y: 20 }, { x: 11, y: 20 }, { x: 25, y: 8 }], C[col], kind, 6), KIND_LABEL[kind], KIND_RULE[kind]);
    }
  }
  function buildRules() {
    readColors();
    const ul = $('#rulesList'); ul.innerHTML = '';
    const add = (draw, html) => { const li = document.createElement('li'); li.appendChild(iconCanvas(draw)); const s = document.createElement('span'); s.innerHTML = html; li.appendChild(s); ul.appendChild(li); };
    add(c => strokeLine(c, [{ x: 3, y: 22 }, { x: 10, y: 22 }, { x: 25, y: 7 }], C.l1, 'std', 6),
      '<b>Tracez des circuits</b> en glissant d’un service à l’autre. Un brancardier y fait la navette.');
    add(c => { shapePath(c, 'triangle', 14, 15, 8); c.fillStyle = C.t1; c.fill(); c.lineWidth = 2; c.strokeStyle = C.ink; c.stroke(); },
      '<b>Chaque patient montre sa prochaine étape</b> par la forme du service, et sa gravité par la couleur. Les urgences vitales passent en premier.');
    add(c => { drawEntity(c, { kind: 'patient', tri: 2, inf: true, rad: false, path: ['ISO'], step: 0, patience: 1, maxPatience: 1 }, 14, 14, 5, false); },
      '<b>Patients contagieux et radioactifs</b> exigent des circuits dédiés : septique et radioprotégé.');
    add(c => { c.beginPath(); c.arc(14, 14, 10, -Math.PI / 2, Math.PI); c.strokeStyle = C.danger; c.lineWidth = 4; c.stroke(); },
      '<b>Un service saturé trop longtemps</b> ou trois incidents graves mettent fin à la garde.');
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
  window.miniHopital = { get state() { return G; }, step, spawnPatient, addVehicle, createLine: (ids, kind = 'std') => {
    const slot = G.slots.find(s => s.kind === kind && s.unlocked && !s.line);
    return slot ? createLine(slot, ids, false) : null;
  } };
})();
