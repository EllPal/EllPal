// Export statique des maquettes V3 : chaque artboard .dc.html devient une page HTML/CSS autonome.
// Le gabarit ({{trous}}, <sc-for>, <sc-if>) est rendu ici, à la construction ; les états interactifs
// (onglets, filtres, copie) sont pré-rendus et échangés par assets/js/beams.js.
//
//   node build.mjs   →   ../site/

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const SRC = path.join(ROOT, 'project');
const OUT = path.join(ROOT, 'export', 'site');

const PAGES = [
  { src: 'V3-Accueil.dc.html', out: 'index.html', css: 'accueil.css' },
  { src: 'V3-Equipe.dc.html', out: 'equipe.html', css: 'equipe.css' },
  { src: 'V3-Actualites.dc.html', out: 'actualites.html', css: 'actualites.css', region: doc => doc.querySelector('[role="tablist"]').closest('section') },
  { src: 'V3-Media.dc.html', out: 'media.html', css: 'media.css', region: doc => doc.querySelector('button[aria-label^="Copier"]').parentElement, copyKey: 'copied' },
  { src: 'V3-Contact.dc.html', out: 'contact.html', css: 'contact.css', region: doc => doc.querySelector('[role="tablist"]').closest('.gborder') }
];

const LINKS = {
  'V3-Accueil.dc.html': 'index.html',
  'V3-Equipe.dc.html': 'equipe.html',
  'V3-Actualites.dc.html': 'actualites.html',
  'V3-Media.dc.html': 'media.html',
  'V3-Contact.dc.html': 'contact.html'
};

const BLOBS = {
  'eb7fe07021c52a4bf73c9e3d424dfde1': ['assets/js/triop-simulateur.js', 'assets/triop-simulateur.js'],
  'd6e535a89271700d9ed7dec846ed3df3': ['assets/img/sonde-aspiration.png', 'assets/sonde-aspiration.png'],
  '3dc8dad975c27dc37c26a4fa2240fa87': ['assets/docs/Beams-BrandGuidelines.pdf', 'assets/Beams-BrandGuidelines.pdf'],
  'd0e3f30a38d0e8f1a4182c42c6960ad4': ['assets/logos/beams-logo-couleur.svg', 'assets/logos/beams-logo-couleur.svg'],
  '47a25e0354b2fd9de7fb10aa8a7645a5': ['assets/logos/beams-logo-couleur.png', 'assets/logos/beams-logo-couleur.png'],
  '3c443250d420b0ecc3b903e729743f71': ['assets/logos/beams-logo-couleur-negatif.svg', 'assets/logos/beams-logo-couleur-negatif.svg'],
  'f9507ca1db9f01f4ebad57c738eb5231': ['assets/logos/beams-logo-couleur-negatif.png', 'assets/logos/beams-logo-couleur-negatif.png'],
  'eecd5c4831d4da799911629a6de5562b': ['assets/logos/beams-logo-gris.svg', 'assets/logos/beams-logo-gris.svg'],
  'ce3add772ff08d21b7f0258ad4acf3c1': ['assets/logos/beams-logo-gris.png', 'assets/logos/beams-logo-gris.png'],
  'da5f86bb3ac9f23be983da383f17bdd8': ['assets/logos/beams-logo-blanc.svg', 'assets/logos/beams-logo-blanc.svg'],
  '3ce4ffc7376dd6de5f2b360ac1e02c32': ['assets/logos/beams-logo-blanc.png', 'assets/logos/beams-logo-blanc.png'],
  'd3a88f41f568cfb88a1ab6c21354a061': ['assets/logos/beams-symbole-couleur.svg', 'assets/logos/beams-symbole-couleur.svg'],
  '8c612b8cbd62c37521800163331f5ef9': ['assets/logos/beams-symbole-couleur.png', 'assets/logos/beams-symbole-couleur.png'],
  '33a650c615ac95445061376ead51937c': ['assets/logos/beams-symbole-blanc.svg', 'assets/logos/beams-symbole-blanc.svg'],
  'ff96835d5e7fa936531bf0a7869f3b78': ['assets/logos/beams-symbole-blanc.png', 'assets/logos/beams-symbole-blanc.png']
};

// ---------------------------------------------------------------- logique des artboards

class DCLogic {
  constructor(props) { this.props = props || {}; this.state = {}; }
  setState(s) { this.state = Object.assign({}, this.state, typeof s === 'function' ? s(this.state) : s); }
  forceUpdate() {}
}

function loadComponent(code) {
  const ctx = vm.createContext({
    DCLogic, Math, JSON, console,
    navigator: { clipboard: { writeText() {} } },
    setTimeout: () => 0, clearTimeout: () => {}
  });
  vm.runInContext(code + '\n;this.__C = Component;', ctx);
  return ctx.__C;
}

// ---------------------------------------------------------------- moteur de gabarit

const HOLE = /\{\{\s*([^}]+?)\s*\}\}/g;

function lookup(scope, expr) {
  if (expr === 'true') return true;
  if (expr === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(expr)) return Number(expr);
  return expr.split('.').reduce((o, k) => (o == null ? undefined : o[k]), scope);
}

function interpolate(text, scope) {
  return text.replace(HOLE, (_, e) => { const v = lookup(scope, e); return v == null ? '' : String(v); });
}

function fixUrl(v) {
  if (typeof v !== 'string') return v;
  v = v.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => (BLOBS[id] ? BLOBS[id][0] : m));
  if (LINKS[v]) return LINKS[v];
  return v;
}

function render(node, scope, ctx, out) {
  const doc = out.ownerDocument || out;
  if (node.nodeType === 3) { out.appendChild(doc.createTextNode(interpolate(node.nodeValue, scope))); return; }
  if (node.nodeType === 8) return;
  if (node.nodeType !== 1) return;
  const kids = n => (n.content ? n.content.childNodes : n.childNodes);

  if (node.hasAttribute('data-sc-for')) {
    const listExpr = node.getAttribute('list').match(/\{\{\s*([^}]+?)\s*\}\}/)[1];
    const list = lookup(scope, listExpr) || [];
    const as = node.getAttribute('as');
    list.forEach((item, i) => {
      const s = Object.assign({}, scope, { [as]: item, $index: i });
      for (const k of kids(node)) render(k, s, ctx, out);
    });
    return;
  }
  if (node.hasAttribute('data-sc-if')) {
    const e = node.getAttribute('value').match(/\{\{\s*([^}]+?)\s*\}\}/)[1];
    if (lookup(scope, e)) for (const k of kids(node)) render(k, scope, ctx, out);
    return;
  }

  const el = node.namespaceURI === 'http://www.w3.org/2000/svg'
    ? doc.createElementNS(node.namespaceURI, node.localName)
    : doc.createElement(node.localName);
  for (const a of Array.from(node.attributes)) {
    const name = a.name;
    if (name.startsWith('hint-') || name === 'key') continue;
    const whole = a.value.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
    if (/^on[a-z]+$/i.test(name)) {
      if (!whole) continue;
      const fn = lookup(scope, whole[1]);
      if (typeof fn !== 'function') continue;
      if (name.toLowerCase() === 'onclick') {
        const captured = ctx.capture(fn);
        if (captured) el.setAttribute('data-set-state', JSON.stringify(captured));
      } else if (name.toLowerCase() === 'onmousemove') {
        el.setAttribute('data-on-mousemove', whole[1].split('.').pop());
      }
      continue;
    }
    let v;
    if (whole) {
      v = lookup(scope, whole[1]);
      if (v == null || v === false) continue;
      v = String(v);
    } else v = interpolate(a.value, scope);
    if (name === 'href' || name === 'src') v = fixUrl(v);
    else if (name === 'style') v = v.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => (BLOBS[id] ? BLOBS[id][0] : m));
    el.setAttribute(name, v);
  }
  for (const k of kids(node)) render(k, scope, ctx, el);
  out.appendChild(el);
}

// ---------------------------------------------------------------- pages

function prepareSource(html) {
  return html
    .replace(/<sc-for\b/g, '<template data-sc-for').replace(/<\/sc-for>/g, '</template>')
    .replace(/<sc-if\b/g, '<template data-sc-if').replace(/<\/sc-if>/g, '</template>');
}

const stableKey = s => JSON.stringify(Object.keys(s).sort().reduce((o, k) => { o[k] = s[k]; return o; }, {}));

function renderPage(template, Component, state) {
  const comp = new Component({});
  comp.state = Object.assign({}, comp.state, state);
  const ctx = {
    capture(fn) {
      const before = comp.state;
      let captured = null;
      const orig = comp.setState;
      comp.setState = s => { captured = Object.assign({}, captured || {}, typeof s === 'function' ? s(comp.state) : s); };
      try { fn({}); } catch (e) { /* gestionnaire dépendant du DOM : ignoré */ }
      comp.setState = orig;
      comp.state = before;
      return captured;
    }
  };
  const vals = comp.renderVals();
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const body = dom.window.document.body;
  render(template, vals, ctx, body);
  return { dom, initial: comp.state };
}

function copyAssets() {
  for (const [, [dest, src]] of Object.entries(BLOBS)) {
    const to = path.join(OUT, dest);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, src), to);
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets', 'css'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'assets', 'js'), { recursive: true });
copyAssets();
fs.copyFileSync(path.join(ROOT, 'export', 'tools', 'beams.js'), path.join(OUT, 'assets', 'js', 'beams.js'));

for (const page of PAGES) {
  const raw = fs.readFileSync(path.join(SRC, page.src), 'utf8');
  const srcDom = new JSDOM(prepareSource(raw));
  const sdoc = srcDom.window.document;
  const title = sdoc.querySelector('title').textContent;
  const desc = sdoc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
  const headScripts = Array.from(sdoc.querySelectorAll('head script[src]')).map(s => s.getAttribute('src')).filter(s => s.startsWith('/_blob/'));
  const xdc = sdoc.querySelector('x-dc');
  const helmet = xdc.querySelector('helmet');
  const fontLinks = Array.from(helmet.querySelectorAll('link')).map(l => l.outerHTML);
  const css = Array.from(helmet.querySelectorAll('style')).map(s => s.textContent).join('\n');
  helmet.remove();
  const logic = sdoc.querySelector('script[type="text/x-dc"]').textContent;
  const Component = loadComponent(logic);
  const rootTemplate = Array.from(xdc.children).find(c => c.localName !== 'helmet');

  // Rendu initial + exploration des états atteignables (onglets, filtres, copie).
  const first = renderPage(rootTemplate, Component, {});
  const variants = {};
  if (page.region) {
    const seen = new Set();
    const queue = [first.initial];
    while (queue.length) {
      const st = queue.shift();
      const k = stableKey(st);
      if (seen.has(k)) continue;
      seen.add(k);
      const r = renderPage(rootTemplate, Component, st);
      const region = page.region(r.dom.window.document);
      region.setAttribute('data-region', 'main');
      variants[k] = region.outerHTML;
      r.dom.window.document.querySelectorAll('[data-set-state]').forEach(el => {
        queue.push(Object.assign({}, st, JSON.parse(el.getAttribute('data-set-state'))));
      });
    }
    page.region(first.dom.window.document).setAttribute('data-region', 'main');
  }

  // Liens : sections de l'accueil depuis les autres pages, liens externes dans un nouvel onglet.
  const fdoc = first.dom.window.document;
  fdoc.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href');
    const label = a.textContent.trim();
    if (href === 'index.html' && page.out !== 'index.html') {
      if (label === 'Technologie') a.setAttribute('href', 'index.html#plateforme');
      else if (label === 'Démonstration') a.setAttribute('href', 'index.html#produit');
    }
    if (/^https?:\/\//.test(href) && !href.includes('fonts.googleapis')) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    }
  });
  const bodyHtml = fdoc.body.innerHTML;
  fs.writeFileSync(path.join(OUT, 'assets', 'css', page.css), css.trim() + '\n');

  const scripts = headScripts.map(s => `<script src="${fixUrl(s)}"></script>`).join('\n');
  const stateJson = page.region
    ? `<script type="application/json" id="beams-state">${JSON.stringify({ initial: first.initial, copyKey: page.copyKey || null, variants }).replace(/</g, '\\u003c')}</script>\n`
    : '';

  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${desc.replace(/"/g, '&quot;')}">
<meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
<meta property="og:description" content="${desc.replace(/"/g, '&quot;')}">
<meta name="theme-color" content="#0B0C0F">
<link rel="icon" type="image/svg+xml" href="assets/logos/beams-symbole-couleur.svg">
${fontLinks.join('\n')}
<link rel="stylesheet" href="assets/css/${page.css}">
${scripts}
</head>
<body>
${bodyHtml}
${stateJson}<script src="assets/js/beams.js" defer></script>
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, page.out), html);
  console.log(`${page.out.padEnd(16)} ${(html.length / 1024).toFixed(0)} Ko${page.region ? ` · ${Object.keys(variants).length} états` : ''}`);
}
