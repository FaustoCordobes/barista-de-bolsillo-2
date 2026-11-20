/* =====================================================================
 * Barista de Bolsillo — RUEDA DE SABORES + HOJA DE CATA (UI)
 * ---------------------------------------------------------------------
 * - Rueda interactiva en SVG (3 anillos): tocar una categoría o familia
 *   acerca la rueda (zoom); tocar el centro vuelve un nivel.
 * - Ficha de cada sector: descripción, cómo reconocerlo, intensidad 1–15
 *   y botón para sumarlo a la cata.
 * - Buscador, pantalla completa y navegación con teclado.
 * - Hoja de cata debajo: datos del café, sabores detectados, 8 atributos
 *   con gráfico radar, puntaje y notas. Se guarda en "Mis catas" y,
 *   si querés, también en la bitácora.
 * Depende de: FLAVOR_WHEEL (flavors.js), BL (logic.js), app.js, features.js
 * ===================================================================== */

const CATA_ATTRS = ['fragancia', 'aroma', 'acidez', 'dulzor', 'cuerpo', 'amargor', 'retrogusto', 'balance'];
const Wheel = { focus: null, cardId: null, query: '', returnTo: 'screen-brewer', fs: false };
let catas = [];
let cataDraft = null;

function newCataDraft() {
  const attrs = {};
  CATA_ATTRS.forEach(a => { attrs[a] = 5; });
  return { id: null, coffeeName: '', origin: '', method: '', roastDate: '', flavors: [], attrs, rating: 0, notes: '', alsoLog: false };
}

function loadCatas() { catas = (Store.read('catas', []) || []).map(BL.sanitizeCata).filter(Boolean); }
function persistCatas() { return Store.write('catas', catas); }

const fname = (node) => (node ? L(node.name) : '');
const isSelected = (id) => !!(cataDraft && cataDraft.flavors.some(f => f.id === id));

/* ---------------- Abrir la sección ---------------- */
// source: 'home' (inicio) | 'brew' (desde el perfil sensorial del Paso 4)
function openWheel(source) {
  if (!cataDraft) cataDraft = newCataDraft();
  Wheel.returnTo = source === 'brew' ? 'screen-brew' : 'screen-brewer';
  if (source === 'brew' && !cataDraft.id) {
    const v = (id) => (document.getElementById(id) ? document.getElementById(id).value.trim() : '');
    cataDraft.coffeeName = cataDraft.coffeeName || v('sensory-coffee-name');
    cataDraft.origin = cataDraft.origin || v('sensory-origin');
    cataDraft.roastDate = cataDraft.roastDate || isoFromFlexible(v('sensory-roast-date'));
    cataDraft.method = state.brewer || cataDraft.method;
  }
  Wheel.focus = Wheel.focus || FLAVOR_WHEEL.root;
  showScreen('screen-wheel');
  renderWheelScreen();
}

function renderWheelScreen() {
  if (!cataDraft) cataDraft = newCataDraft();
  if (!Wheel.focus) Wheel.focus = FLAVOR_WHEEL.root;
  renderWheel();
  renderFlavorCard();
  renderSearchResults();
  renderCataSheet();
  renderCataList();
  document.getElementById('cata-use-sensory').hidden = Wheel.returnTo !== 'screen-brew';
  syncFsButton();
}

function wheelBack() {
  exitWheelFullscreen();
  showScreen(Wheel.returnTo);
}

/* ---------------- Geometría del SVG ---------------- */
const R_CENTER = 52, R_OUTER = 198;

function polar(r, a) { return [r * Math.sin(a), -r * Math.cos(a)]; }

function arcPath(r0, r1, a0, a1) {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4; // círculo completo
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(r1, a0), [x1, y1] = polar(r1, a1);
  const [x2, y2] = polar(r0, a1), [x3, y3] = polar(r0, a0);
  const f = (n) => n.toFixed(2);
  return `M${f(x0)},${f(y0)}A${r1},${r1} 0 ${large} 1 ${f(x1)},${f(y1)}L${f(x2)},${f(y2)}A${r0},${r0} 0 ${large} 0 ${f(x3)},${f(y3)}Z`;
}

// Bandas de radio según cuántos niveles se ven
function ringBands(levels) {
  if (levels === 3) return [[R_CENTER, 100], [100, 142], [142, R_OUTER]];
  if (levels === 2) return [[R_CENTER, 116], [116, R_OUTER]];
  return [[R_CENTER, R_OUTER]];
}

function mix(hex, amount) { // aclara un color hacia blanco
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const m = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
function textColorFor(depth) { return depth === 1 ? '#FFFFFF' : '#1C1108'; }
function fillFor(node) { return node.depth === 1 ? node.color : mix(node.color, node.depth === 2 ? 0.35 : 0.62); }

// Elige orientación (tangencial o radial), tamaño y líneas para que el texto entre en el sector
function fitLabel(label, r0, r1, a0, a1, maxFs) {
  const M = maxFs || 12;
  const width = r1 - r0, rm = (r0 + r1) / 2, arcLen = (a1 - a0) * rm;
  const opts = [];
  const words = label.split(' ');
  const lines2 = words.length > 1 ? (() => {
    let best = null;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      const m = Math.max(a.length, b.length);
      if (!best || m < best.m) best = { lines: [a, b], m };
    }
    return best;
  })() : null;
  // Tangencial (a lo largo del arco)
  opts.push({ orient: 't', lines: [label], fs: Math.min(M, width * 0.5, (arcLen * 0.86) / (label.length * 0.56)) });
  if (lines2) opts.push({ orient: 't', lines: lines2.lines, fs: Math.min(M - 1, width * 0.36, (arcLen * 0.86) / (lines2.m * 0.56)) });
  // Radial (del centro hacia afuera)
  opts.push({ orient: 'r', lines: [label], fs: Math.min(M - 1, arcLen * 0.62, (width * 0.9) / (label.length * 0.56)) });
  if (lines2) opts.push({ orient: 'r', lines: lines2.lines, fs: Math.min(M - 2, (arcLen * 0.62) / 2.1, (width * 0.9) / (lines2.m * 0.56)) });
  const best = opts.sort((x, y) => y.fs - x.fs)[0];
  return best.fs >= 4.3 ? best : null;
}

function labelSvg(node, r0, r1, a0, a1) {
  const prefix = node.depth === 3 && isSelected(node.id) ? '● ' : '';
  const levels = 3 - Wheel.focus.depth;   // con zoom, las etiquetas pueden ser más grandes
  const fit = fitLabel(prefix + fname(node), r0, r1, a0, a1, levels === 1 ? 17 : levels === 2 ? 14 : 12);
  if (!fit) return '';
  const m = (a0 + a1) / 2, rm = (r0 + r1) / 2;
  const [x, y] = polar(rm, m);
  let deg = m * 180 / Math.PI;
  let rot;
  if (fit.orient === 't') rot = (deg > 90 && deg < 270) ? deg + 180 : deg;
  else rot = deg > 180 ? deg + 90 : deg - 90;
  const lh = fit.fs * 1.08;
  const startDy = -((fit.lines.length - 1) * lh) / 2;
  const tspans = fit.lines.map((ln, i) => `<tspan x="0" dy="${i === 0 ? startDy.toFixed(2) : lh.toFixed(2)}">${esc(ln)}</tspan>`).join('');
  return `<text transform="translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${rot.toFixed(2)})" font-size="${fit.fs.toFixed(2)}"
    fill="${textColorFor(node.depth)}" text-anchor="middle" dominant-baseline="central" font-weight="${node.depth === 1 ? 700 : 500}">${tspans}</text>`;
}

function matchesQuery(node) {
  if (!Wheel.query) return true;
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = norm(Wheel.query);
  let n = node;
  while (n && n.depth > 0) { if (norm(fname(n)).includes(q)) return true; n = n.parent; }
  // una categoría "coincide" si alguno de sus descendientes coincide
  const anyChild = (x) => x.children.some(c => norm(fname(c)).includes(q) || anyChild(c));
  return anyChild(node);
}

function renderWheel() {
  const host = document.getElementById('wheel-svg-host');
  const focus = Wheel.focus;
  const levels = 3 - focus.depth;
  const bands = ringBands(levels);
  const parts = [];
  const labels = [];

  function draw(node, a0, a1) {
    let a = a0;
    node.children.forEach(ch => {
      const span = (a1 - a0) * (ch.weight / node.weight);
      const band = bands[ch.depth - focus.depth - 1];
      const sel = ch.depth === 3 && isSelected(ch.id);
      const cls = ['seg', 'd' + ch.depth, sel ? 'sel' : '', Wheel.cardId === ch.id ? 'active' : '', matchesQuery(ch) ? '' : 'dim'].join(' ');
      const state = sel ? ' · ' + t('segSelected') : '';
      parts.push(`<path class="${cls}" d="${arcPath(band[0], band[1], a, a + span)}" fill="${fillFor(ch)}"
        data-node="${ch.id}" tabindex="0" role="button" aria-label="${esc(fname(ch) + state)}"></path>`);
      labels.push(labelSvg(ch, band[0], band[1], a, a + span));
      if (ch.children.length) draw(ch, a, a + span);
      a += span;
    });
  }
  draw(focus, 0, Math.PI * 2);

  const centerTitle = focus.depth === 0 ? t('wheelCenterRoot') : fname(focus);
  const centerFill = focus.depth === 0 ? 'var(--paper)' : fillFor(focus);
  const centerInk = focus.depth === 1 ? '#FFFFFF' : '#1C1108';
  // Título del centro: una o dos líneas
  let titleLines = [centerTitle];
  if (centerTitle.length > 12 && centerTitle.includes(' ')) {
    const w = centerTitle.split(' ');
    let best = null;
    for (let i = 1; i < w.length; i++) {
      const a = w.slice(0, i).join(' '), b = w.slice(i).join(' ');
      const m = Math.max(a.length, b.length);
      if (!best || m < best.m) best = { lines: [a, b], m };
    }
    titleLines = best.lines;
  }
  const titleFs = Math.min(13, 84 / (Math.max(...titleLines.map(x => x.length)) * 0.56));
  const backTxt = focus.depth === 0 ? t('wheelCenterHint') : t('wheelCenterBack');
  const center = `<g class="wheel-center" data-center="1" tabindex="0" role="button" aria-label="${esc(focus.depth === 0 ? centerTitle : t('wheelCenterBack') + ': ' + centerTitle)}">
      <circle r="${R_CENTER - 2}" fill="${centerFill}"></circle>
      <text text-anchor="middle" fill="${centerInk}" font-weight="700" font-size="${titleFs.toFixed(1)}" font-family="Fraunces, serif">
        ${titleLines.map((ln, i) => `<tspan x="0" y="${(i - (titleLines.length - 1) / 2) * titleFs * 1.1 - 4}">${esc(ln)}</tspan>`).join('')}
      </text>
      <text text-anchor="middle" y="${14 + (titleLines.length - 1) * 6}" fill="${centerInk}" font-size="9" font-weight="600" opacity="0.9">${esc(backTxt)}</text>
    </g>`;

  host.innerHTML = `<svg class="wheel-svg zoom-anim" viewBox="-201 -201 402 402" role="group" aria-label="${esc(t('ariaWheel'))}">
      <g class="segs">${parts.join('')}</g>
      <g class="labels" aria-hidden="true">${labels.join('')}</g>
      ${center}
    </svg>`;
  const crumb = document.getElementById('wheel-crumb');
  const path = [];
  let n = focus;
  while (n && n.depth > 0) { path.unshift(n); n = n.parent; }
  crumb.innerHTML = [`<button type="button" class="crumb" onclick="wheelZoomTo('root')">${esc(t('wheelCenterRoot'))}</button>`]
    .concat(path.map(p => `<button type="button" class="crumb" onclick="wheelZoomTo('${p.id}')">${esc(fname(p))}</button>`)).join('<span aria-hidden="true">›</span>');
  const count = cataDraft.flavors.length;
  document.getElementById('wheel-count').textContent = count === 1 ? t('wheelFlavorCount1') : count ? t('wheelFlavorCount', { n: count }) : t('wheelHint');
}

function wheelZoomTo(id) {
  Wheel.focus = id === 'root' ? FLAVOR_WHEEL.root : (FLAVOR_WHEEL.byId[id] || FLAVOR_WHEEL.root);
  if (Wheel.focus.depth === 3) Wheel.focus = Wheel.focus.parent;
  renderWheel();
}
function wheelZoomOut() {
  if (Wheel.focus.depth === 0) return;
  Wheel.focus = Wheel.focus.parent;
  renderWheel();
}

// Con teclado, después de redibujar se devuelve el foco a la rueda (el SVG se reemplaza)
function refocusWheel(nodeId) {
  const host = document.getElementById('wheel-svg-host');
  const target = (nodeId && host.querySelector(`[data-node="${nodeId}"]`)) ||
    host.querySelector(`.seg.d${Wheel.focus.depth + 1}`) || host.querySelector('[data-center]');
  if (target) target.focus();
}

function onWheelActivate(target, fromKeyboard) {
  if (!target) return;
  const centerEl = target.closest('[data-center]');
  if (centerEl) { wheelZoomOut(); if (fromKeyboard) refocusWheel(); return; }
  const seg = target.closest('[data-node]');
  if (!seg) return;
  const node = FLAVOR_WHEEL.byId[seg.dataset.node];
  if (!node) return;
  Wheel.cardId = node.id;
  if (node.depth < 3) Wheel.focus = node;   // acercar
  renderWheel();
  renderFlavorCard();
  if (fromKeyboard) refocusWheel(node.depth === 3 ? node.id : null);
}

/* ---------------- Ficha del sabor ---------------- */
function renderFlavorCard() {
  const box = document.getElementById('flavor-card');
  const node = Wheel.cardId ? FLAVOR_WHEEL.byId[Wheel.cardId] : null;
  if (!node) {
    box.innerHTML = `<p class="muted">${esc(t('cardPick'))}</p>`;
    return;
  }
  const path = [];
  let n = node.parent;
  while (n && n.depth > 0) { path.unshift(n); n = n.parent; }
  const crumbs = path.map(p => `<button type="button" class="link-btn inline" onclick="openFlavorCard('${p.id}')">${esc(fname(p))}</button>`).join(' › ');
  let body = '';
  if (node.depth < 3) {
    body = `<p class="fc-desc">${esc(L(node.desc))}</p>
      <div class="fc-sub">${esc(t('cardExplore'))}</div>
      <div class="chip-row wrap">${node.children.map(c => `<button type="button" class="chip ink${isSelected(c.id) ? ' on' : ''}" onclick="openFlavorCard('${c.id}')">
        <span class="dot" style="background:${fillFor(c)}"></span>${isSelected(c.id) ? '✓ ' : ''}${esc(fname(c))}</button>`).join('')}</div>`;
  } else {
    const sel = cataDraft.flavors.find(f => f.id === node.id);
    const intensity = sel ? sel.intensity : (Wheel.pendingIntensity || 8);
    body = `<p class="fc-desc">${esc(L(node.parent.desc))}</p>
      <div class="fc-sub">${esc(t('cardHowTo'))}</div>
      <p class="fc-tip">👃 ${esc(L(node.tip))}</p>
      <label class="fc-range" for="fc-intensity"><span id="fc-intensity-label">${esc(t('cardIntensity', { n: intensity }))}</span>
        <input type="range" id="fc-intensity" min="1" max="15" step="1" value="${intensity}" oninput="setCardIntensity(this.value)"></label>
      <div class="fc-scale" aria-hidden="true"><span>${esc(t('cardSubtle'))}</span><span>${esc(t('cardStrong'))}</span></div>
      ${sel
        ? `<div class="btn-row"><span class="fc-in">✓ ${esc(t('cardInCata'))}</span>
             <button type="button" class="go-free-btn small" onclick="toggleFlavor('${node.id}')">${esc(t('cardRemove'))}</button></div>`
        : `<button type="button" class="next-btn enabled" onclick="toggleFlavor('${node.id}')">${esc(t('cardAdd'))}</button>`}`;
  }
  box.innerHTML = `<div class="fc-head"><span class="fc-dot" style="background:${fillFor(node)}"></span>
      <div><div class="fc-path">${crumbs || esc(t('wheelCenterRoot'))}</div><h3 class="fc-title">${esc(fname(node))}</h3></div></div>${body}`;
}

function openFlavorCard(id) {
  const node = FLAVOR_WHEEL.byId[id];
  if (!node) return;
  Wheel.cardId = id;
  Wheel.focus = node.depth < 3 ? node : node.parent;
  renderWheel();
  renderFlavorCard();
}

function setCardIntensity(v) {
  const n = Math.round(+v) || 8;
  Wheel.pendingIntensity = n;
  const sel = cataDraft.flavors.find(f => f.id === Wheel.cardId);
  if (sel) { sel.intensity = n; renderCataFlavors(); }
  document.getElementById('fc-intensity-label').textContent = t('cardIntensity', { n });
}

function toggleFlavor(id) {
  const i = cataDraft.flavors.findIndex(f => f.id === id);
  if (i >= 0) cataDraft.flavors.splice(i, 1);
  else {
    cataDraft.flavors.push({ id, intensity: Wheel.pendingIntensity || 8 });
    announce(t('cataAdded', { name: fname(FLAVOR_WHEEL.byId[id]) }));
  }
  Wheel.pendingIntensity = null;
  renderWheel();
  renderFlavorCard();
  renderCataFlavors();
}

/* ---------------- Buscador ---------------- */
function onWheelSearch(value) {
  Wheel.query = value.trim();
  renderWheel();
  renderSearchResults();
}
function renderSearchResults() {
  const box = document.getElementById('wheel-results');
  if (!Wheel.query) { box.innerHTML = ''; box.hidden = true; return; }
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = norm(Wheel.query);
  const hits = Object.values(FLAVOR_WHEEL.byId).filter(n => norm(fname(n)).includes(q)).slice(0, 10);
  box.hidden = false;
  box.innerHTML = hits.length ? hits.map(n => {
    const p = [];
    let x = n.parent;
    while (x && x.depth > 0) { p.unshift(fname(x)); x = x.parent; }
    return `<button type="button" class="result-row" onclick="openFlavorCard('${n.id}')">
      <span class="dot" style="background:${fillFor(n)}"></span><b>${esc(fname(n))}</b>${p.length ? `<span class="muted small"> · ${esc(p.join(' › '))}</span>` : ''}</button>`;
  }).join('') : `<p class="muted">${esc(t('wheelNoResults'))}</p>`;
}

/* ---------------- Pantalla completa ---------------- */
function toggleWheelFullscreen() {
  const stage = document.getElementById('wheel-stage');
  if (Wheel.fs) { exitWheelFullscreen(); return; }
  Wheel.fs = true;
  if (stage.requestFullscreen && document.fullscreenEnabled) {
    stage.requestFullscreen().catch(() => stage.classList.add('fs-fallback'));
  } else {
    stage.classList.add('fs-fallback');
  }
  syncFsButton();
}
function exitWheelFullscreen() {
  const stage = document.getElementById('wheel-stage');
  if (!stage) return;
  Wheel.fs = false;
  stage.classList.remove('fs-fallback');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  syncFsButton();
}
function syncFsButton() {
  const b = document.getElementById('wheel-fs-btn');
  if (!b) return;
  b.textContent = Wheel.fs ? '✕ ' + t('wheelExitFullscreen') : '⛶ ' + t('wheelFullscreen');
  b.setAttribute('aria-pressed', String(Wheel.fs));
}
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement && Wheel.fs) { Wheel.fs = false; syncFsButton(); }
});

/* ---------------- Hoja de cata ---------------- */
function renderCataSheet() {
  const d = cataDraft;
  const set = (id, v) => { const el = document.getElementById(id); if (el && el.value !== v) el.value = v; };
  // métodos
  const sel = document.getElementById('cata-method');
  sel.innerHTML = `<option value="">${esc(t('cataNoMethod'))}</option>` +
    Object.keys(BDATA.METHODS).map(k => `<option value="${k}">${esc(BREWER_LABELS[k])}</option>`).join('');
  sel.value = d.method || '';
  set('cata-coffee', d.coffeeName);
  set('cata-origin', d.origin);
  set('cata-roast', d.roastDate);
  set('cata-notes', d.notes);
  document.getElementById('cata-also-log').checked = !!d.alsoLog;
  document.getElementById('cata-fresh').innerHTML = d.roastDate ? freshnessBadge(d.roastDate, d.method || 'v60') : '';
  document.getElementById('cata-editing').hidden = !d.id;
  if (d.id) {
    const orig = catas.find(c => c.id === d.id);
    document.getElementById('cata-editing').textContent = t('cataEditing', { date: orig ? fmtDate(orig.date) : '' });
  }
  document.getElementById('cata-save').textContent = d.id ? t('cataUpdate') : t('cataSave');
  // atributos
  document.getElementById('cata-attrs').innerHTML = CATA_ATTRS.map(a => `
    <div class="attr-row">
      <label for="attr-${a}">${esc(t('attr_' + a))}</label>
      <input type="range" id="attr-${a}" min="0" max="10" step="0.5" value="${d.attrs[a]}" oninput="setCataAttr('${a}', this.value)">
      <output id="attr-${a}-v">${fmtNum(d.attrs[a])}</output>
    </div>`).join('');
  renderCataFlavors();
  renderCataStars();
  renderRadar();
}

function renderCataFlavors() {
  const box = document.getElementById('cata-flavors');
  if (!cataDraft.flavors.length) {
    box.innerHTML = `<p class="muted">${esc(t('cataFlavorsEmpty'))}</p>`;
    return;
  }
  box.innerHTML = cataDraft.flavors.map(f => {
    const node = FLAVOR_WHEEL.byId[f.id];
    if (!node) return '';
    return `<span class="flavor-chip" style="--c:${fillFor(node)}">
      <button type="button" class="fchip-name" onclick="openFlavorCard('${f.id}')">${esc(fname(node))} <small>${f.intensity}/15</small></button>
      <button type="button" class="fchip-x" onclick="toggleFlavor('${f.id}')" aria-label="${esc(t('ariaRemoveFlavor', { name: fname(node) }))}">✕</button></span>`;
  }).join('');
}

function setCataField(key, value) {
  cataDraft[key] = value;
  if (key === 'roastDate' || key === 'method') {
    document.getElementById('cata-fresh').innerHTML = cataDraft.roastDate ? freshnessBadge(cataDraft.roastDate, cataDraft.method || 'v60') : '';
  }
}
function setCataAttr(a, v) {
  cataDraft.attrs[a] = BL.clamp(parseFloat(v) || 0, 0, 10);
  document.getElementById(`attr-${a}-v`).textContent = fmtNum(cataDraft.attrs[a]);
  renderRadar();
}

function renderCataStars() {
  document.querySelectorAll('#cata-stars [data-star]').forEach(b => {
    const n = +b.dataset.star;
    b.textContent = n <= cataDraft.rating ? '★' : '☆';
    b.setAttribute('aria-checked', String(n === cataDraft.rating));
    b.setAttribute('aria-label', t('ariaStars', { n }));
  });
}
function setCataRating(n) { cataDraft.rating = cataDraft.rating === n ? 0 : n; renderCataStars(); }
function onCataStarsKey(ev) {
  if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') { ev.preventDefault(); cataDraft.rating = Math.min(5, cataDraft.rating + 1); }
  else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') { ev.preventDefault(); cataDraft.rating = Math.max(0, cataDraft.rating - 1); }
  else return;
  renderCataStars();
  const b = document.querySelector(`#cata-stars [data-star="${Math.max(1, cataDraft.rating)}"]`);
  if (b) b.focus();
}

// Gráfico radar de los 8 atributos (SVG nativo)
function radarSvg(attrs, size) {
  const R = 70, n = CATA_ATTRS.length;
  const pt = (i, v) => polar(R * v / 10, (Math.PI * 2 * i) / n);
  const rings = [2.5, 5, 7.5, 10].map(v => `<polygon points="${CATA_ATTRS.map((_, i) => pt(i, v).map(x => x.toFixed(1)).join(',')).join(' ')}" class="radar-grid"/>`).join('');
  const axes = CATA_ATTRS.map((_, i) => { const [x, y] = pt(i, 10); return `<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="radar-grid"/>`; }).join('');
  const shape = CATA_ATTRS.map((a, i) => pt(i, attrs[a] || 0).map(x => x.toFixed(1)).join(',')).join(' ');
  const labels = size === 'mini' ? '' : CATA_ATTRS.map((a, i) => {
    const [x, y] = polar(R + 16, (Math.PI * 2 * i) / n);
    return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" class="radar-label">${esc(t('attr_' + a))}</text>`;
  }).join('');
  const vb = size === 'mini' ? '-74 -74 148 148' : '-112 -100 224 200';
  return `<svg viewBox="${vb}" class="radar ${size || ''}" role="img" aria-label="${esc(t('cataRadar') + ': ' + CATA_ATTRS.map(a => t('attr_' + a) + ' ' + fmtNum(attrs[a] || 0)).join(', '))}">
    ${rings}${axes}<polygon points="${shape}" class="radar-shape"/>${labels}</svg>`;
}
function renderRadar() { document.getElementById('cata-radar').innerHTML = radarSvg(cataDraft.attrs); }

function cataFlavorNames(c) {
  return c.flavors.map(f => FLAVOR_WHEEL.byId[f.id]).filter(Boolean).map(fname);
}

function saveCata() {
  const d = cataDraft;
  if (!d.flavors.length && !d.coffeeName.trim()) { toast(t('cataNeedSomething')); return; }
  const prev = d.id ? catas.find(c => c.id === d.id) : null;
  const entry = BL.sanitizeCata(Object.assign({}, d, { id: d.id || Date.now(), date: prev ? prev.date : new Date().toISOString() }));
  if (!entry) return;
  if (prev) catas[catas.indexOf(prev)] = entry; else catas.push(entry);
  if (persistCatas() === false) return;
  // También en la bitácora (opcional)
  if (d.alsoLog && BDATA.METHODS[d.method]) {
    const flavorTxt = cataFlavorNames(entry).join(', ');
    const logEntry = BL.sanitizeLogEntry({
      id: Date.now() + 1, date: entry.date, method: d.method, coffeeName: d.coffeeName, origin: d.origin,
      roastDate: d.roastDate, rating: d.rating,
      notes: [flavorTxt, d.notes].filter(Boolean).join(' · '), tags: []
    });
    if (logEntry) { brewLog.push(logEntry); persistLog(); }
  } else if (d.alsoLog) {
    toast(t('cataLogNeedsMethod'));
  }
  cataDraft = newCataDraft();
  Wheel.cardId = null;
  renderWheelScreen();
  toast(prev ? t('cataUpdated') : t('cataSaved'));
  const list = document.getElementById('cata-list');
  if (list && list.firstElementChild) list.firstElementChild.focus && list.scrollIntoView({ block: 'nearest' });
}

function newCata() {
  cataDraft = newCataDraft();
  Wheel.cardId = null;
  renderWheelScreen();
  document.getElementById('cata-coffee').focus();
}

// Lleva las notas elegidas al perfil sensorial del Paso 4
function useCataInSensory() {
  const names = cataFlavorNames(cataDraft);
  const notas = document.getElementById('sensory-notas');
  if (notas) notas.value = names.join(', ');
  const nameEl = document.getElementById('sensory-coffee-name');
  if (nameEl && cataDraft.coffeeName) nameEl.value = cataDraft.coffeeName;
  const originEl = document.getElementById('sensory-origin');
  if (originEl && cataDraft.origin) originEl.value = cataDraft.origin;
  const map = { acidez: 'acidez', cuerpo: 'cuerpo', dulzor: 'dulzura' };
  Object.keys(map).forEach(a => {
    const v = Math.round(cataDraft.attrs[a] / 2); // 0–10 → 0–5
    if (typeof sensoryRatings === 'object') { sensoryRatings[map[a]] = v; renderSensoryDots(map[a]); }
  });
  toast(t('cataUsed'));
  wheelBack();
  const panel = document.getElementById('sensory-panel');
  if (panel && panel.style.display !== 'block') toggleSensoryAccordion();
}

/* ---------------- Mis catas ---------------- */
function renderCataList() {
  const box = document.getElementById('cata-list');
  const items = catas.slice().sort((a, b) => (b.date > a.date ? 1 : -1));
  document.getElementById('cata-list-empty').hidden = items.length > 0;
  box.innerHTML = items.map(c => {
    const flavors = c.flavors.map(f => FLAVOR_WHEEL.byId[f.id]).filter(Boolean);
    return `<article class="log-entry cata-entry">
      <div class="cata-entry-main">
        <div class="cata-entry-text">
          <div class="log-method">${esc(c.coffeeName || t('cataUnnamed'))}${c.method && BREWER_LABELS[c.method] ? ` <span class="log-coffee">· ${esc(BREWER_LABELS[c.method])}</span>` : ''}</div>
          <div class="log-date">${fmtDate(c.date)}${c.origin ? ' · 📍 ' + esc(c.origin) : ''}</div>
          ${c.rating ? `<div class="log-stars" aria-label="${esc(t('ariaRating', { n: c.rating }))}">${stars(c.rating)}</div>` : ''}
        </div>
        <div class="cata-mini" aria-hidden="true">${radarSvg(c.attrs, 'mini')}</div>
      </div>
      ${flavors.length ? `<div class="tag-row">${flavors.map(n => `<span class="tag flavor-tag" style="--c:${fillFor(n)}">${esc(fname(n))}</span>`).join('')}</div>` : ''}
      ${c.notes ? `<p class="log-notes">${esc(c.notes)}</p>` : ''}
      <div class="log-actions">
        <button type="button" class="mini-btn" onclick="editCata(${c.id})">✎ ${esc(t('cataLoad'))}</button>
        <button type="button" class="mini-btn danger" onclick="armDelete(this, () => deleteCata(${c.id}))" aria-label="${esc(t('ariaDelete'))}">✕</button>
      </div>
    </article>`;
  }).join('');
}

function editCata(id) {
  const c = catas.find(x => x.id === id);
  if (!c) return;
  cataDraft = Object.assign(newCataDraft(), JSON.parse(JSON.stringify(c)), { alsoLog: false });
  Wheel.cardId = null;
  renderWheelScreen();
  document.getElementById('cata-sheet').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function deleteCata(id) {
  const idx = catas.findIndex(c => c.id === id);
  if (idx < 0) return;
  const [removed] = catas.splice(idx, 1);
  persistCatas();
  if (cataDraft && cataDraft.id === id) cataDraft = newCataDraft();
  renderWheelScreen();
  toast(t('deleted'), { action: { label: t('undo'), fn: () => { catas.splice(idx, 0, removed); persistCatas(); renderWheelScreen(); } } });
}

/* ---------------- Eventos de la rueda (clic + teclado) ---------------- */
document.addEventListener('click', (ev) => {
  const host = document.getElementById('wheel-svg-host');
  if (host && host.contains(ev.target)) onWheelActivate(ev.target);
});
document.addEventListener('keydown', (ev) => {
  const host = document.getElementById('wheel-svg-host');
  if (!host || !host.contains(ev.target)) return;
  if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onWheelActivate(ev.target, true); }
  if (ev.key === 'Backspace' || ev.key === 'Escape') {
    if (Wheel.focus.depth === 0) return;   // Escape en la raíz: lo maneja el cierre de pantalla completa
    ev.preventDefault(); ev.stopPropagation(); wheelZoomOut(); refocusWheel();
  }
});
