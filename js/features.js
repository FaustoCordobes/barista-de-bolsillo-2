/* =====================================================================
 * Barista de Bolsillo — FUNCIONES v2 (UI)
 * ---------------------------------------------------------------------
 * Se carga DESPUÉS del script principal de index.html y usa su estado
 * global (state, I18N, currentLang, savedRecipes, etc.).
 *
 * Módulos:
 *   1. Almacenamiento (Store) + migraciones + preferencias
 *   2. i18n helpers (t, L, data-i18n)
 *   3. Avisos: toast, lector de pantalla, sonido, vibración, Wake Lock
 *   4. Hojas modales (sheets)
 *   5. Receta dinámica del Paso 4 (dosis, ratio, tueste, helado)
 *   6. Modo "Preparar paso a paso" (temporizador por fases)
 *   7. Cold brew (infusión larga con recordatorio)
 *   8. Diagnóstico de sabor (dial-in)
 *   9. Mi bitácora
 *  10. Aprendé (lecciones + glosario)
 *  11. Recomendador de receta
 *  12. Compartir receta por link
 *  13. Copia de seguridad (exportar / importar)
 *  14. Ajustes nuevos
 *  15. Accesibilidad
 *  16. Arranque
 * ===================================================================== */

/* ===================== 1. ALMACENAMIENTO ===================== */
const Store = {
  KEYS: {
    version: 'baristaSchemaVersion',
    recipes: 'baristaSavedRecipes',   // clave original: se conserva
    log: 'baristaLog',
    lessons: 'baristaLessonsRead',
    prefs: 'baristaPrefs',
    dialin: 'baristaDialIn',
    cold: 'baristaColdBrew',
    catas: 'baristaCatas'      // hojas de cata (rueda de sabores)
  },
  read(key, fallback) {
    try {
      const raw = localStorage.getItem(this.KEYS[key] || key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  write(key, value) {
    try { localStorage.setItem(this.KEYS[key] || key, JSON.stringify(value)); return true; }
    catch (e) { toast(t('storageError')); return false; }
  },
  remove(key) { try { localStorage.removeItem(this.KEYS[key] || key); } catch (e) {} }
};

function runMigrations() {
  const from = Store.read('version', 1);
  if (from >= BL.SCHEMA_VERSION) return;
  const migrated = BL.migrate({ recipes: Store.read('recipes', []), log: Store.read('log', []) }, from);
  Store.write('recipes', migrated.recipes);
  Store.write('log', migrated.log);
  Store.write('version', migrated.version);
}

const DEFAULT_PREFS = { sound: true, volume: 0.6, vibrate: true, wakeLock: true, tempUnit: 'C' };
let prefs = Object.assign({}, DEFAULT_PREFS);
function loadPrefs() { prefs = Object.assign({}, DEFAULT_PREFS, Store.read('prefs', {})); }
function savePrefs() { Store.write('prefs', prefs); }

/* ===================== 2. I18N ===================== */
function mergeI18nExt() {
  ['es', 'en', 'pt'].forEach(lang => {
    const ext = I18N_EXT[lang];
    ['ui', 'brewerNames', 'brewerSubs', 'tips', 'steps', 'time', 'grindInfo'].forEach(section => {
      I18N[lang][section] = I18N[lang][section] || {};
      Object.assign(I18N[lang][section], ext[section] || {});
    });
  });
}

// t("clave", {var}) → texto traducido (cae a español si falta)
function t(key, vars) {
  const ui = (I18N[currentLang] && I18N[currentLang].ui) || {};
  let s = ui[key];
  if (s === undefined) s = I18N.es.ui[key];
  if (s === undefined) return key;
  if (vars) Object.keys(vars).forEach(k => { s = s.split('{' + k + '}').join(vars[k]); });
  return s;
}
// L({es,en,pt}) → texto en el idioma actual
const L = (obj) => (obj ? (obj[currentLang] || obj.es || '') : '');
const esc = BL.escapeHtml;

function applyDataI18n(root) {
  (root || document).querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  (root || document).querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  (root || document).querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}

// Se llama al final de applyTranslations() del script principal
function applyTranslationsExt() {
  document.documentElement.lang = currentLang === 'pt' ? 'pt-BR' : currentLang;
  applyDataI18n();
  renderBrewerSelectOptions();
  renderSettingsExt();
  renderColdBrewBanner();
  const active = document.querySelector('.screen.active');
  if (!active) return;
  if (active.id === 'screen-log') renderLog();
  if (active.id === 'screen-learn') renderLearn();
  if (active.id === 'screen-dialin') renderDialIn();
  if (active.id === 'screen-guided') renderGuided();
  if (active.id === 'screen-wheel') { renderWheelScreen(); syncFsButton(); }
  if (typeof renderAccountButton === 'function') renderAccountButton();
  if (active.id === 'screen-account') renderAccount();
  if (active.id === 'screen-community') { renderCommunityControls(); renderCommunity(); }
}

function renderBrewerSelectOptions() {
  const sel = document.getElementById('saved-brewer-select');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = Object.keys(BDATA.METHODS).map(k => `<option value="${k}">${esc(BREWER_LABELS[k])}</option>`).join('');
  if (prev) sel.value = prev;
}

/* ===================== 3. AVISOS ===================== */
function toast(message, opts) {
  opts = opts || {};
  const root = document.getElementById('toast-root');
  if (!root) return;
  root.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  const span = document.createElement('span');
  span.textContent = message;
  el.appendChild(span);
  if (opts.action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toast-action';
    b.textContent = opts.action.label;
    b.onclick = () => { el.remove(); opts.action.fn(); };
    el.appendChild(b);
  }
  root.appendChild(el);
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.remove(), opts.timeout || (opts.action ? 6000 : 2800));
}

function announce(text) {
  const live = document.getElementById('live-region');
  if (!live) return;
  live.textContent = '';
  setTimeout(() => { live.textContent = text; }, 60);
}

const Feedback = {
  ctx: null,
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {}
  },
  tone(freq, start, dur) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const vol = Math.max(0.0001, prefs.volume * 0.35);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  },
  beep(kind) {
    if (!prefs.sound || !this.ctx || prefs.volume <= 0) return;
    try {
      const now = this.ctx.currentTime + 0.01;
      if (kind === 'done') { this.tone(784, now, 0.18); this.tone(988, now + 0.2, 0.18); this.tone(1319, now + 0.4, 0.4); }
      else { this.tone(880, now, 0.16); this.tone(1175, now + 0.18, 0.22); }
    } catch (e) {}
  },
  vibrate(pattern) {
    if (prefs.vibrate && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
  }
};

// Evento sonoro + vibración + anuncio para lector de pantalla
function notifyEvent(kind, text) {
  Feedback.beep(kind);
  Feedback.vibrate(kind === 'done' ? [200, 100, 200, 100, 300] : [140]);
  if (text) announce(text);
}

const WakeLock = {
  sentinel: null,
  async sync() {
    const need = prefs.wakeLock && (timerRunning || miniTimerRunning || Guided.running);
    if (need && !this.sentinel && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      try {
        this.sentinel = await navigator.wakeLock.request('screen');
        this.sentinel.addEventListener('release', () => { this.sentinel = null; });
      } catch (e) { this.sentinel = null; } // no soportado o denegado: fallback silencioso
    } else if (!need && this.sentinel) {
      try { await this.sentinel.release(); } catch (e) {}
      this.sentinel = null;
    }
  }
};
function syncWakeLock() { WakeLock.sync(); }

/* ===================== 4. HOJAS MODALES ===================== */
let sheetOpener = null;
function openSheet(id) {
  const ov = document.getElementById(id);
  if (!ov) return;
  sheetOpener = document.activeElement;
  ov.classList.add('open');
  ov.setAttribute('aria-hidden', 'false');
  const focusable = ov.querySelector('[data-autofocus]') || ov.querySelector('button, input, select, textarea, [tabindex="0"]');
  setTimeout(() => focusable && focusable.focus(), 30);
}
function closeSheet(id) {
  const ov = document.getElementById(id);
  if (!ov) return;
  ov.classList.remove('open');
  ov.setAttribute('aria-hidden', 'true');
  if (sheetOpener && document.body.contains(sheetOpener)) sheetOpener.focus();
  sheetOpener = null;
}
function closeSheetOutside(event, id) { if (event.target.id === id) closeSheet(id); }

/* ===================== 5. RECETA DINÁMICA (PASO 4) ===================== */
const MIN_DOSE = 1;

function initRecipeForBrew() {
  const m = BDATA.METHODS[state.brewer];
  if (state.ratio == null || state.dose == null) {
    let ratio = BL.baselineRatio(state.brewer, state.intensity);
    if (state.pendingRec && state.pendingRec.method === state.brewer) {
      ratio = state.pendingRec.ratio;
      state.roast = state.pendingRec.roast;
      state.recApplied = true;
      state.recRatio = ratio;
    }
    state.pendingRec = null;
    state.ratio = ratio;
    state.dose = state.brewer === 'expreso' ? m.dose.def : BL.round1(state.ml / ratio);
  }
  recomputeWater();
}

function recomputeWater() {
  state.recipe = BL.computeRecipe({ method: state.brewer, dose: state.dose, ratio: state.ratio, iced: state.iced });
  state.ml = state.recipe.water;
}

function fmtNum(v) { return String(BL.round1(v)); }
function fmtRatio(r) { return '1:' + fmtNum(r); }
function fmtTemp(range) {
  if (!range) return '';
  if (prefs.tempUnit === 'F') return `${BL.cToF(range[0])}–${BL.cToF(range[1])} °F`;
  return `${range[0]}–${range[1]} °C`;
}

function currentPhases() {
  const r = state.recipe;
  const pourWater = r ? r.hotWater : state.ml;
  return BL.buildPhases(state.brewer, pourWater);
}

function fillTemplate(text) {
  const r = state.recipe || { dose: 0, hotWater: 0, ice: 0 };
  const phases = currentPhases();
  const bloom = phases.length && phases[0].target ? phases[0].target : Math.round(r.dose * 3);
  return String(text)
    .split('{coffee}').join(fmtNum(r.dose))
    .split('{water}').join(r.hotWater)
    .split('{bloom}').join(bloom)
    .split('{ice}').join(r.ice);
}

// Pasos o tips del Paso 4, con números que se actualizan al cambiar la dosis
function renderBrewTips() {
  const ui = I18N[currentLang].ui;
  const list = document.getElementById('tips-list');
  list.innerHTML = '';
  const isManualPour = Object.prototype.hasOwnProperty.call(BREWER_STEPS, state.brewer);
  document.getElementById('tips-title').textContent = isManualPour ? ui.tipsTitleSteps : ui.tipsTitleTips;
  let items = (isManualPour ? BREWER_STEPS[state.brewer] : BREWER_TIPS[state.brewer]) || [];
  if (state.iced && state.recipe && state.recipe.ice) items = [t('icedStep')].concat(items);
  items.forEach((item, index) => {
    const li = document.createElement('li');
    const txt = fillTemplate(item);
    li.textContent = isManualPour ? `${ui.pasoWord} ${index + 1}: ${txt}` : txt;
    list.appendChild(li);
  });
}

function updateResultNumbers() {
  const r = state.recipe;
  const ui = I18N[currentLang].ui;
  const isEsp = state.brewer === 'expreso';
  document.getElementById('result-water').textContent = r.hotWater;
  document.getElementById('result-coffee').textContent = fmtNum(r.dose);
  document.getElementById('txt-label-mlagua').textContent = isEsp ? t('labelYield') : (r.ice ? t('labelHotWater') : ui.labelMlAgua);
  document.getElementById('result-ratio').textContent = isEsp
    ? t('ratioEspresso', { r: fmtRatio(r.ratio) })
    : `${ui.proporcionUsadaPre} ${fmtNum(r.ratio)} ${ui.proporcionUsadaPost}`;
  const iceLine = document.getElementById('result-ice');
  if (iceLine) {
    iceLine.hidden = !r.ice;
    iceLine.textContent = r.ice ? t('iceLine', { ice: r.ice, total: r.water }) : '';
  }
  renderBrewTips();
  if (typeof prefillMiniCalculator === 'function') prefillMiniCalculator();
  syncDoseWidget();
}

function renderDoseWidget() {
  const box = document.getElementById('dose-widget');
  if (!box) return;
  const m = BDATA.METHODS[state.brewer];
  const b = BL.ratioBounds(state.brewer);
  const chips = (m.doseChips || []).map(g =>
    `<button type="button" class="chip" data-dose="${g}" aria-pressed="false" onclick="setDose(${g})">${g} g</button>`).join('');
  const roastBtns = ['claro', 'medio', 'oscuro'].map(r =>
    `<button type="button" class="seg-btn" data-roast="${r}" aria-pressed="false" onclick="setRoast('${r}')">${esc(t('roast_' + r))}</button>`).join('');

  let html = `<div class="dw-title">${esc(t('dwTitle'))}</div>`;
  if (!m.lockRatio) {
    html += `
      <div class="dw-row">
        <span class="dw-label" id="dw-dose-label">${esc(t(state.brewer === 'expreso' ? 'dwDoseEsp' : 'dwDose'))}</span>
        <div class="stepper" role="group" aria-labelledby="dw-dose-label">
          <button type="button" class="step-btn" onclick="changeDose(-1)" aria-label="${esc(t('ariaLessCoffee'))}">−</button>
          <output id="dw-dose" aria-live="off">--</output>
          <button type="button" class="step-btn" onclick="changeDose(1)" aria-label="${esc(t('ariaMoreCoffee'))}">+</button>
        </div>
      </div>
      ${chips ? `<div class="chip-row" role="group" aria-label="${esc(t('dwQuickDose'))}">${chips}</div>` : ''}
      <div class="dw-row">
        <span class="dw-label" id="dw-ratio-label">${esc(t(state.brewer === 'expreso' ? 'dwRatioEsp' : 'dwRatio'))}</span>
        <div class="stepper" role="group" aria-labelledby="dw-ratio-label">
          <button type="button" class="step-btn" onclick="changeRatio(-1)" aria-label="${esc(t('ariaLessWater'))}">−</button>
          <output id="dw-ratio">--</output>
          <button type="button" class="step-btn" onclick="changeRatio(1)" aria-label="${esc(t('ariaMoreWater'))}">+</button>
        </div>
      </div>
      <div class="dw-baseline"><span class="badge" id="dw-badge"></span>
        <button type="button" class="link-btn" id="dw-reset" onclick="resetRatio()">${esc(t('dwReset'))}</button></div>
      <div class="dw-hint">${esc(t('dwRange', { min: fmtRatio(b.min), max: fmtRatio(b.max) }))}</div>`;
  } else {
    html += `<div class="dw-note">${esc(t('mokaNote'))}</div>`;
  }
  if (m.variants) {
    html += `<div class="dw-row dw-col"><span class="dw-label">${esc(t('cbVariant'))}</span>
      <div class="seg" role="group">
        <button type="button" class="seg-btn" data-variant="concentrate" aria-pressed="false" onclick="setColdVariant('concentrate')">${esc(t('cbConcentrate'))}</button>
        <button type="button" class="seg-btn" data-variant="rtd" aria-pressed="false" onclick="setColdVariant('rtd')">${esc(t('cbRtd'))}</button>
      </div></div>`;
  }
  if (m.family !== 'coldbrew') {
    html += `<div class="dw-row dw-col"><span class="dw-label">${esc(t('dwRoast'))}</span>
      <div class="seg" role="group" aria-label="${esc(t('dwRoast'))}">${roastBtns}</div></div>`;
  }
  if (m.iced) {
    html += `<label class="switch-row"><input type="checkbox" id="dw-iced" onchange="toggleIced(this.checked)">
      <span>${esc(t('dwIced'))}</span></label>`;
  }
  html += `<div class="dw-info" id="dw-info"></div>
    <button type="button" class="link-btn" onclick="openLesson('${m.family === 'espresso' ? 'ratio' : 'extraccion'}')">${esc(t('dwWhyLink'))}</button>`;
  box.innerHTML = html;
  syncDoseWidget();
}

function syncDoseWidget() {
  const box = document.getElementById('dose-widget');
  if (!box || !state.recipe) return;
  const m = BDATA.METHODS[state.brewer];
  const r = state.recipe;
  const doseOut = document.getElementById('dw-dose');
  if (doseOut) doseOut.textContent = fmtNum(r.dose) + ' g';
  const ratioOut = document.getElementById('dw-ratio');
  if (ratioOut) ratioOut.textContent = fmtRatio(r.ratio);
  box.querySelectorAll('[data-dose]').forEach(c => c.setAttribute('aria-pressed', String(Math.abs(+c.dataset.dose - r.dose) < 0.05)));
  box.querySelectorAll('[data-roast]').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.roast === state.roast)));
  if (m.variants) {
    box.querySelectorAll('[data-variant]').forEach(c => c.setAttribute('aria-pressed', String(m.variants[c.dataset.variant] === r.ratio)));
  }
  const iced = document.getElementById('dw-iced');
  if (iced) iced.checked = !!state.iced;
  const base = BL.baselineRatio(state.brewer, state.intensity);
  const badge = document.getElementById('dw-badge');
  const reset = document.getElementById('dw-reset');
  if (badge) {
    const isBase = Math.abs(r.ratio - base) < 0.01;
    const isRec = state.recApplied && Math.abs(r.ratio - state.recRatio) < 0.01;
    badge.textContent = isRec ? t('badgeRecommended') : (isBase ? t('badgeBaseline') : t('badgeAdjusted'));
    badge.classList.toggle('adjusted', !isBase && !isRec);
    if (reset) reset.hidden = isBase;
  }
  // Temperatura y molienda según tueste
  const adj = BL.roastAdjust(state.brewer, state.roast);
  const info = document.getElementById('dw-info');
  const lines = [];
  if (m.family === 'coldbrew') {
    lines.push('🧊 ' + t('cbInfo', { a: m.steepHours[0], b: m.steepHours[1] }));
  } else if (adj.tempC) {
    lines.push('🌡 ' + t('dwTemp', { t: fmtTemp(adj.tempC) }));
  } else {
    lines.push('🌡 ' + t('mokaTemp'));
  }
  const grindName = GRIND_OPTIONS[adj.grindIdx] || '';
  lines.push('⚙️ ' + t('dwGrind', { g: grindName }) + (adj.grindShift ? ' · ' + t(adj.grindShift < 0 ? 'grindFinerRoast' : 'grindCoarserRoast') : ''));
  if (state.roast !== 'medio' && m.family !== 'coldbrew') lines.push('💡 ' + t('roastWhy_' + state.roast));
  if (m.family === 'espresso') lines.push('⏱ ' + t('espWindow', { a: m.windowSec[0], b: m.windowSec[1] }));
  if (info) info.innerHTML = lines.map(l => `<div>${esc(l)}</div>`).join('');
}

function doseStep() {
  const fam = BDATA.METHODS[state.brewer].family;
  return fam === 'espresso' ? 0.5 : fam === 'coldbrew' ? 10 : 1;
}
function setDose(g) {
  const m = BDATA.METHODS[state.brewer];
  const max = m.dose ? m.dose.max : 2000;
  const min = m.dose ? m.dose.min : MIN_DOSE;
  state.dose = BL.round1(BL.clamp(g, min, max));
  recomputeWater();
  updateResultNumbers();
}
function changeDose(dir) { setDose(state.dose + dir * doseStep()); }
function changeRatio(dir) {
  const b = BL.ratioBounds(state.brewer);
  state.ratio = BL.round1(BL.clamp(state.ratio + dir * b.step, b.min, b.max));
  recomputeWater();
  updateResultNumbers();
}
function resetRatio() {
  state.ratio = BL.baselineRatio(state.brewer, state.intensity);
  state.recApplied = false;
  recomputeWater();
  updateResultNumbers();
}
function setRoast(r) { state.roast = r; syncDoseWidget(); }
function toggleIced(on) { state.iced = !!on; recomputeWater(); updateResultNumbers(); }
function setColdVariant(v) {
  state.ratio = BDATA.METHODS.coldbrew.variants[v];
  recomputeWater();
  updateResultNumbers();
}

// Acciones del Paso 4 según el método
function renderBrewExtras() {
  const isCold = state.brewer === 'coldbrew';
  const g = document.getElementById('btn-guided');
  const c = document.getElementById('btn-coldbrew-start');
  if (g) g.hidden = isCold;
  if (c) c.hidden = !isCold;
  renderColdBrewBanner();
}

// Carga una receta (bitácora o Mi café ideal) directo en el Paso 4
function loadRecipeIntoFlow(opts) {
  if (!BDATA.METHODS[opts.method]) return;
  state.brewer = opts.method;
  state.size = 'única';
  state.intensity = null;
  state.groundOrBean = 'molido';
  state.iced = false;
  state.roast = opts.roast || 'medio';
  state.recApplied = false;
  const dose = opts.dose > 0 ? opts.dose : null;
  if (opts.method === 'expreso') {
    state.dose = dose || BDATA.METHODS.expreso.dose.def;
    state.ratio = opts.water > 0 && dose ? BL.round1(opts.water / dose) : BL.baselineRatio('expreso');
  } else if (dose && opts.water > 0) {
    state.dose = dose;
    state.ratio = BL.round1(opts.water / dose);
  } else if (dose && opts.ratio) {
    state.dose = dose;
    state.ratio = opts.ratio;
  } else {
    state.ratio = null; state.dose = null;
    state.ml = BDATA.FIXED_ML[opts.method] || 300;
  }
  renderBrewScreen();
  if (opts.coffeeName) document.getElementById('sensory-coffee-name').value = opts.coffeeName;
  if (opts.origin) document.getElementById('sensory-origin').value = opts.origin;
  showScreen('screen-brew');
}

/* ===================== 6. MODO PASO A PASO ===================== */
const POUR_KEYS = ['bloom', 'pour1', 'pour2', 'pour3', 'pourAll', 'pourMain', 'pourBloom', 'fill', 'extraction', 'preinfusion', 'flow'];
const WAIT_KEYS = ['steep', 'rest', 'drawdown', 'drain', 'heat'];
const Guided = { phases: [], baseMs: 0, anchor: 0, running: false, interval: null, lastIndex: 0, done: false, method: null, unit: 'ml' };

function guidedElapsedSec() {
  return (Guided.baseMs + (Guided.running ? Date.now() - Guided.anchor : 0)) / 1000;
}

function startGuidedFromBrew() {
  if (!state.brewer || !state.recipe) return;
  Guided.method = state.brewer;
  Guided.phases = currentPhases();
  Guided.unit = state.brewer === 'expreso' ? 'g' : 'ml';
  guidedReset(true);
  showScreen('screen-guided');
  renderGuided();
}

function guidedToggle() {
  if (Guided.running) guidedPause();
  else guidedPlay();
}
function guidedPlay() {
  Feedback.unlock();
  if (Guided.done) guidedReset(true);
  Guided.running = true;
  Guided.anchor = Date.now();
  clearInterval(Guided.interval);
  Guided.interval = setInterval(guidedTick, 200);
  syncWakeLock();
  announce(t('gStarted', { phase: t('phase_' + Guided.phases[BL.phaseAt(Guided.phases, guidedElapsedSec())].key + '_name') }));
  renderGuided();
}
function guidedPause() {
  if (Guided.running) Guided.baseMs += Date.now() - Guided.anchor;
  Guided.running = false;
  clearInterval(Guided.interval);
  syncWakeLock();
  renderGuided();
}
function guidedReset(silent) {
  Guided.running = false;
  clearInterval(Guided.interval);
  Guided.baseMs = 0;
  Guided.lastIndex = 0;
  Guided.done = false;
  syncWakeLock();
  if (!silent) renderGuided();
}
function guidedJump(sec) {
  Guided.baseMs = Math.max(0, sec * 1000);
  Guided.anchor = Date.now();
  Guided.done = false;
  guidedTick();
}
function guidedSkip() {
  const idx = BL.phaseAt(Guided.phases, guidedElapsedSec());
  if (idx < Guided.phases.length - 1) guidedJump(Guided.phases[idx + 1].start);
  else guidedFinish();
}
function guidedPrev() {
  const el = guidedElapsedSec();
  const idx = Math.min(BL.phaseAt(Guided.phases, el), Guided.phases.length - 1);
  const ph = Guided.phases[idx];
  if (el - ph.start > 2 || idx === 0) guidedJump(ph.start);
  else guidedJump(Guided.phases[idx - 1].start);
}
function guidedTick() {
  const el = guidedElapsedSec();
  const total = BL.totalDuration(Guided.phases);
  if (el >= total) { guidedFinish(); return; }
  const idx = BL.phaseAt(Guided.phases, el);
  if (idx !== Guided.lastIndex) {
    Guided.lastIndex = idx;
    const ph = Guided.phases[idx];
    const name = t('phase_' + ph.key + '_name');
    notifyEvent('phase', ph.target != null ? t('gPhaseAnnounce', { phase: name, target: ph.target + ' ' + Guided.unit }) : name);
    const card = document.getElementById('guided-card');
    if (card) { card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash'); }
  }
  renderGuided();
}
function guidedFinish() {
  if (Guided.running) Guided.baseMs += Date.now() - Guided.anchor;
  Guided.running = false;
  clearInterval(Guided.interval);
  Guided.baseMs = BL.totalDuration(Guided.phases) * 1000;
  Guided.lastIndex = Guided.phases.length;
  if (!Guided.done) { Guided.done = true; notifyEvent('done', t('gDone')); }
  syncWakeLock();
  renderGuided();
}

function phaseType(key) {
  if (key === 'bloom' || key === 'pourBloom' || key === 'preinfusion') return 'bloom';
  if (POUR_KEYS.includes(key)) return 'pour';
  if (WAIT_KEYS.includes(key)) return 'wait';
  return 'action';
}

function renderGuided() {
  const phases = Guided.phases;
  if (!phases.length) return;
  const el = guidedElapsedSec();
  const total = BL.totalDuration(phases);
  const idx = Math.min(BL.phaseAt(phases, el), phases.length - 1);
  const ph = phases[idx];
  const r = state.recipe || {};
  const vars = { target: ph.target != null ? ph.target : '', coffee: fmtNum(r.dose || 0), unit: Guided.unit };

  document.getElementById('guided-tag').textContent = BREWER_LABELS[Guided.method] + ' · ' + fmtNum(r.dose || 0) + ' g · ' + (r.hotWater || 0) + ' ' + Guided.unit;
  const card = document.getElementById('guided-card');
  card.dataset.type = Guided.done ? 'done' : phaseType(ph.key);
  document.getElementById('guided-count').textContent = Guided.done ? t('gAllDone') : t('gPhaseOf', { n: idx + 1, total: phases.length });
  document.getElementById('guided-name').textContent = Guided.done ? t('gDoneTitle') : t('phase_' + ph.key + '_name');
  document.getElementById('guided-hint').textContent = Guided.done ? t('gDoneHint') : t('phase_' + ph.key + '_hint', vars);
  const tgt = document.getElementById('guided-target');
  tgt.hidden = Guided.done || ph.target == null;
  if (ph.target != null) {
    document.getElementById('guided-target-val').textContent = ph.target;
    document.getElementById('guided-target-unit').textContent = Guided.unit;
    document.getElementById('guided-target-label').textContent = Guided.unit === 'g' ? t('gTargetYield') : t('gTargetWater');
  }
  document.getElementById('guided-phase-time').textContent = Guided.done ? BL.fmtClock(total) : BL.fmtClock(Math.ceil(ph.end - el));
  document.getElementById('guided-phase-time-label').textContent = Guided.done ? t('gTotalTime') : t('gPhaseLeft');
  const pct = Math.min(100, (el / total) * 100);
  const bar = document.getElementById('guided-progress-bar');
  bar.style.width = pct + '%';
  bar.parentElement.setAttribute('aria-valuenow', String(Math.round(pct)));
  document.getElementById('guided-elapsed').textContent = BL.fmtClock(el) + ' / ' + BL.fmtClock(total);

  const next = phases[idx + 1];
  const nextEl = document.getElementById('guided-next');
  nextEl.hidden = Guided.done || !next;
  if (next) {
    nextEl.textContent = t('gNext', { phase: t('phase_' + next.key + '_name'), at: BL.fmtClock(next.start) }) +
      (next.target != null && next.target !== ph.target ? ' → ' + next.target + ' ' + Guided.unit : '');
  }
  const play = document.getElementById('guided-play');
  play.textContent = Guided.running ? '⏸ ' + t('timerPauseLabel') : (el > 0 && !Guided.done ? '▶ ' + t('gResume') : '▶ ' + t('gStart'));
  play.setAttribute('aria-pressed', String(Guided.running));

  const list = document.getElementById('guided-steps');
  list.innerHTML = phases.map((p, i) => {
    const cls = Guided.done || i < idx ? 'done' : i === idx ? 'current' : '';
    return `<li class="${cls}"><button type="button" onclick="guidedJump(${p.start})" ${i === idx && !Guided.done ? 'aria-current="step"' : ''}>
      <span class="gs-time">${BL.fmtClock(p.start)}</span>
      <span class="gs-name">${esc(t('phase_' + p.key + '_name'))}</span>
      <span class="gs-target">${p.target != null ? p.target + ' ' + Guided.unit : ''}</span></button></li>`;
  }).join('');
  document.getElementById('guided-done').hidden = !Guided.done;
  const bloomLink = document.getElementById('guided-lesson');
  bloomLink.hidden = !(ph.key === 'bloom' && !Guided.done);
}

function exitGuided() {
  guidedPause();
  showScreen('screen-brew');
}

// Pasa las fases al cronograma editable del Paso 5
function guidedToSchedule() {
  guidedPause();
  customPoints = BL.phasesToPoints(Guided.phases);
  setTimerMode('up');
  renderCustomPoints();
  goToFreeScreen();
}

/* ===================== 7. COLD BREW ===================== */
function startColdBrew() {
  Feedback.unlock();
  const m = BDATA.METHODS.coldbrew;
  const now = Date.now();
  const cb = {
    startedAt: now,
    readyAt: now + m.steepHours[0] * 3600000,
    lateAt: now + m.steepHours[1] * 3600000,
    dose: state.recipe.dose, water: state.recipe.water, ratio: state.recipe.ratio, notified: false
  };
  Store.write('cold', cb);
  if ('Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch (e) {}
  }
  toast(t('cbStarted', { time: fmtHour(cb.readyAt) }));
  renderColdBrewBanner();
}

function fmtHour(ms) {
  const d = new Date(ms);
  const loc = currentLang === 'en' ? 'en-US' : currentLang === 'pt' ? 'pt-BR' : 'es-AR';
  return d.toLocaleString(loc, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtDuration(ms) {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

function renderColdBrewBanner() {
  const cb = Store.read('cold', null);
  ['coldbrew-banner', 'coldbrew-status'].forEach(id => {
    const box = document.getElementById(id);
    if (!box) return;
    if (!cb) { box.hidden = true; box.innerHTML = ''; return; }
    if (id === 'coldbrew-status' && state.brewer !== 'coldbrew') { box.hidden = true; return; }
    const now = Date.now();
    let status;
    if (now < cb.readyAt) status = t('cbSteeping', { left: fmtDuration(cb.readyAt - now), time: fmtHour(cb.readyAt) });
    else if (now < cb.lateAt) status = t('cbReady', { late: fmtHour(cb.lateAt) });
    else status = t('cbLate');
    box.hidden = false;
    box.innerHTML = `<div class="cb-title">🧊 ${esc(t('cbBannerTitle'))} · ${fmtNum(cb.dose)} g / ${cb.water} ml</div>
      <div class="cb-status">${esc(status)}</div>
      <div class="cb-actions"><button type="button" class="go-free-btn small" onclick="finishColdBrew()">${esc(t('cbFinish'))}</button></div>`;
  });
}

function checkColdBrew() {
  const cb = Store.read('cold', null);
  if (!cb) return;
  if (!cb.notified && Date.now() >= cb.readyAt) {
    cb.notified = true;
    Store.write('cold', cb);
    notifyEvent('done', t('cbReadyNotify'));
    toast(t('cbReadyNotify'));
    showSystemNotification(t('cbReadyNotify'));
  }
  renderColdBrewBanner();
}

function showSystemNotification(body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, icon: './icon-192.png', badge: './icon-192.png' };
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification('Barista de Bolsillo', opts)).catch(() => {
      try { new Notification('Barista de Bolsillo', opts); } catch (e) {}
    });
  } else {
    try { new Notification('Barista de Bolsillo', opts); } catch (e) {}
  }
}

function finishColdBrew() {
  const cb = Store.read('cold', null);
  Store.remove('cold');
  renderColdBrewBanner();
  if (cb) {
    toast(t('cbFinished'), {
      action: { label: t('logThis'), fn: () => openLogForm({ method: 'coldbrew', dose: cb.dose, water: cb.water, timeSec: Math.round((Date.now() - cb.startedAt) / 1000) }) }
    });
  }
}

/* ===================== 8. DIAGNÓSTICO DE SABOR ===================== */
const TASTE_TAGS = ['sour', 'bitter', 'weak', 'strong', 'astringent', 'sourBitter', 'balanced'];
const DX_ICONS = { grind: '⚙️', time: '⏱', yield: '⚖️', dose: '⚖️', prep: '🧹', heat: '🔥', pour: '🫖', done: '🎯' };
const Dial = { method: null, tags: new Set(), pad: null, returnTo: 'screen-brew', result: null, timeSec: 0 };

function openDialIn(source) {
  Dial.method = state.brewer || 'v60';
  Dial.tags = new Set();
  Dial.pad = null;
  Dial.result = null;
  Dial.returnTo = source === 'guided' ? 'screen-guided' : 'screen-brew';
  Dial.timeSec = source === 'guided' ? Math.round(guidedElapsedSec()) : 0;
  const esp = document.getElementById('esp-panel');
  if (Dial.method === 'expreso' && state.recipe) {
    document.getElementById('esp-dose').value = fmtNum(state.recipe.dose);
    document.getElementById('esp-yield').value = state.recipe.water;
    document.getElementById('esp-time').value = Dial.timeSec || '';
    document.getElementById('esp-early').checked = false;
  }
  if (esp) esp.hidden = Dial.method !== 'expreso';
  showScreen('screen-dialin');
  renderDialIn();
}

function dialHistory() {
  const all = Store.read('dialin', {});
  return Array.isArray(all[Dial.method]) ? all[Dial.method] : [];
}
function setDialHistory(list) {
  const all = Store.read('dialin', {});
  all[Dial.method] = list.slice(-12);
  Store.write('dialin', all);
}

function toggleTaste(tag) {
  if (Dial.tags.has(tag)) Dial.tags.delete(tag);
  else {
    if (tag === 'balanced') Dial.tags.clear();
    else Dial.tags.delete('balanced');
    if (tag === 'sour' || tag === 'bitter') Dial.tags.delete('sourBitter');
    if (tag === 'sourBitter') { Dial.tags.delete('sour'); Dial.tags.delete('bitter'); }
    if (tag === 'weak') Dial.tags.delete('strong');
    if (tag === 'strong') Dial.tags.delete('weak');
    Dial.tags.add(tag);
  }
  Dial.pad = null;
  Dial.result = null;
  renderDialIn();
}

// Grilla de 2 ejes: x = ácido (-1) ↔ amargo (+1), y = débil (-1) ↔ fuerte (+1)
function setPad(x, y, fromKeyboard) {
  x = BL.clamp(x, -1, 1); y = BL.clamp(y, -1, 1);
  Dial.pad = { x, y };
  Dial.tags = new Set();
  if (x < -0.33) Dial.tags.add('sour');
  if (x > 0.33) Dial.tags.add('bitter');
  if (y > 0.33) Dial.tags.add('strong');
  if (y < -0.33) Dial.tags.add('weak');
  if (!Dial.tags.size) Dial.tags.add('balanced');
  Dial.result = null;
  renderDialIn();
  if (fromKeyboard) announce(Array.from(Dial.tags).map(tg => t('taste_' + tg)).join(', '));
}

function onPadPointer(ev) {
  const pad = document.getElementById('taste-pad');
  const rect = pad.getBoundingClientRect();
  const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
  setPad(x, y);
}
function onPadKey(ev) {
  const p = Dial.pad || { x: 0, y: 0 };
  const step = 0.34;
  const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
  if (map[ev.key]) {
    ev.preventDefault();
    setPad(p.x + map[ev.key][0], p.y + map[ev.key][1], true);
  }
}

function readEspressoInputs() {
  if (Dial.method !== 'expreso') return null;
  const v = (id) => parseFloat(document.getElementById(id).value);
  const out = { dose: v('esp-dose'), yieldG: v('esp-yield'), time: v('esp-time'), earlyDrops: document.getElementById('esp-early').checked };
  return (isFinite(out.time) && out.time > 0) || out.earlyDrops ? out : null;
}

function renderEspressoVerdict() {
  const box = document.getElementById('esp-verdict');
  if (!box) return;
  const esp = readEspressoInputs();
  const ratioRaw = parseFloat(document.getElementById('esp-yield').value) / parseFloat(document.getElementById('esp-dose').value);
  if (!esp) {
    box.textContent = isFinite(ratioRaw) && ratioRaw > 0 ? t('espRatioOnly', { r: fmtRatio(ratioRaw) }) : '';
    box.dataset.v = '';
    return;
  }
  const v = BL.espressoVerdict(esp);
  const win = BDATA.METHODS.expreso.windowSec;
  box.dataset.v = v.verdict || '';
  box.textContent = (v.ratio ? fmtRatio(v.ratio) + ' · ' : '') + t('espVerdict_' + v.reason, { a: win[0], b: win[1] });
}

function renderDialIn() {
  if (!Dial.method) return;
  document.getElementById('dialin-tag').textContent = BREWER_LABELS[Dial.method];
  document.querySelectorAll('#taste-chips [data-tag]').forEach(c => c.setAttribute('aria-pressed', String(Dial.tags.has(c.dataset.tag))));
  const marker = document.getElementById('pad-marker');
  if (Dial.pad) {
    marker.hidden = false;
    marker.style.left = ((Dial.pad.x + 1) / 2 * 100) + '%';
    marker.style.top = ((1 - (Dial.pad.y + 1) / 2) * 100) + '%';
  } else marker.hidden = true;
  const pad = document.getElementById('taste-pad');
  pad.setAttribute('aria-valuetext', Dial.tags.size ? Array.from(Dial.tags).map(tg => t('taste_' + tg)).join(', ') : t('padEmpty'));
  renderEspressoVerdict();
  renderDialResult();
  renderDialHistory();
}

function showRecommendation() {
  const input = { method: Dial.method, tags: Array.from(Dial.tags), espresso: readEspressoInputs(), history: dialHistory() };
  const res = BL.diagnose(input);
  if (res.variable === 'none') { toast(t('dxPickSomething')); return; }
  Dial.result = res;
  renderDialResult();
  const card = document.getElementById('dialin-result');
  if (card) {
    card.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    announce(document.getElementById('dx-title') ? document.getElementById('dx-title').textContent : '');
  }
}

function fmtAmount(res) {
  if (res.amount == null) return '';
  if (res.unit === 'point') return t(res.amount >= 1 ? 'amtPoint1' : res.amount >= 0.5 ? 'amtPointHalf' : 'amtPointQuarter');
  if (res.unit === 'h') return fmtNum(res.amount) + ' h';
  if (res.unit === 's') return Math.round(res.amount) + ' s';
  return fmtNum(res.amount) + ' g';
}

function renderDialResult() {
  const box = document.getElementById('dialin-result');
  const res = Dial.result;
  if (!res) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  if (res.variable === 'done') {
    box.innerHTML = `<div class="dx-card ok">
      <div class="dx-icon" aria-hidden="true">🎯</div>
      <div class="dx-title" id="dx-title">${esc(t('dxDoneTitle'))}</div>
      <p class="dx-why">${esc(t('dxDoneText'))}</p>
      <button type="button" class="next-btn enabled" onclick="addToIdealCoffee()">${esc(t('btnAddIdeal'))}</button>
      <button type="button" class="go-free-btn" onclick="logFromDialIn()">📓 ${esc(t('logThis'))}</button>
    </div>`;
    return;
  }
  const key = res.variable + '_' + res.direction;
  const notes = [];
  if (res.converging) notes.push(t('dxConverging'));
  if (res.note === 'strengthLater') notes.push(t('dxStrengthLater'));
  if (res.verdict && res.verdict.reason && res.variable === 'grind' && Dial.method === 'expreso') {
    notes.unshift(t('espVerdict_' + res.verdict.reason, { a: BDATA.METHODS.expreso.windowSec[0], b: BDATA.METHODS.expreso.windowSec[1] }));
  }
  if (res.variable === 'grind' && (res.direction === 'finer') && BDATA.METHODS[Dial.method].tempC) notes.push(t('dxTempCheckLow'));
  if (res.variable === 'grind' && (res.direction === 'coarser') && BDATA.METHODS[Dial.method].tempC) notes.push(t('dxTempCheckHigh'));
  box.innerHTML = `<div class="dx-card">
    <div class="dx-kicker">${esc(t('dxKicker'))}</div>
    <div class="dx-icon" aria-hidden="true">${DX_ICONS[res.variable] || '☕'}</div>
    <div class="dx-title" id="dx-title">${esc(t('dx_' + key, { amount: fmtAmount(res) }))}</div>
    <p class="dx-why">${esc(t('dxw_' + key))}</p>
    ${notes.map(n => `<p class="dx-note">${esc(n)}</p>`).join('')}
    ${res.lesson ? `<button type="button" class="link-btn" onclick="openLesson('${res.lesson}')">📚 ${esc(t('dxLearnMore'))}: ${esc(lessonTitle(res.lesson))} →</button>` : ''}
    <button type="button" class="next-btn enabled" onclick="acceptRecommendation()">${esc(t('dxAccept'))}</button>
    <button type="button" class="go-free-btn" onclick="logFromDialIn()">📓 ${esc(t('dxSaveLog'))}</button>
  </div>`;
}

function acceptRecommendation() {
  const res = Dial.result;
  if (!res) return;
  const hist = dialHistory();
  hist.push({ variable: res.variable, direction: res.direction, step: res.step, at: Date.now() });
  setDialHistory(hist);
  // Aplicar automáticamente los ajustes numéricos a la receta actual
  if (state.brewer === Dial.method && state.recipe && res.amount != null) {
    if (res.variable === 'dose' && Dial.method !== 'expreso') {
      const water = state.recipe.water;
      const newDose = Math.max(1, state.dose + (res.direction === 'up' ? res.amount : -res.amount));
      state.dose = BL.round1(newDose);
      state.ratio = BL.round1(water / newDose);
      recomputeWater();
    } else if (res.variable === 'yield') {
      const y = Math.max(state.dose, state.recipe.water + (res.direction === 'up' ? res.amount : -res.amount));
      state.ratio = BL.round1(y / state.dose);
      recomputeWater();
    }
  }
  toast(t('dxAccepted'));
  if (state.brewer) {
    refreshBrewScreenTexts();
    showScreen('screen-brew');
  } else {
    renderDialIn();
  }
}

function renderDialHistory() {
  const box = document.getElementById('dialin-history');
  const hist = dialHistory();
  if (!hist.length) { box.hidden = true; return; }
  box.hidden = false;
  box.innerHTML = `<div class="free-card-title">${esc(t('dxHistoryTitle'))}</div>
    <ol class="dx-history">${hist.map(h => `<li>${DX_ICONS[h.variable] || ''} ${esc(t('dxh_' + h.variable + '_' + h.direction))}${h.step < 1 ? ' · ' + esc(t('dxSmaller', { n: h.step === 0.5 ? '½' : '¼' })) : ''}</li>`).join('')}</ol>
    <button type="button" class="link-btn" onclick="resetDialHistory()">${esc(t('dxResetHistory'))}</button>`;
}
function resetDialHistory() { setDialHistory([]); renderDialIn(); toast(t('dxHistoryCleared')); }

function logFromDialIn() {
  const r = state.recipe || {};
  const res = Dial.result;
  const note = res && res.variable !== 'done' ? t('dxLogNote', { tip: t('dx_' + res.variable + '_' + res.direction, { amount: fmtAmount(res) }) }) : '';
  const esp = readEspressoInputs();
  openLogForm({
    method: Dial.method,
    dose: esp && esp.dose ? esp.dose : r.dose,
    water: esp && esp.yieldG ? esp.yieldG : r.water,
    timeSec: esp && esp.time ? esp.time : Dial.timeSec,
    tags: Array.from(Dial.tags),
    notes: note,
    rating: Dial.tags.has('balanced') ? 5 : 0
  });
}

/* ===================== 9. MI BITÁCORA ===================== */
let brewLog = [];
let logFilter = 'all';
let logForm = { grindIdx: -1, rating: 0, tags: new Set() };

function loadLog() { brewLog = (Store.read('log', []) || []).map(BL.sanitizeLogEntry).filter(Boolean); }
function persistLog() { return Store.write("log", brewLog); }

function goToLog() { renderLog(); showScreen('screen-log'); }

function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }
function fmtDate(iso) {
  const loc = currentLang === 'en' ? 'en-US' : currentLang === 'pt' ? 'pt-BR' : 'es-AR';
  try { return new Date(iso).toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return iso; }
}

function freshnessBadge(roastDate, method) {
  const f = BL.freshness(roastDate, method);
  if (!f) return '';
  return `<span class="fresh-badge fresh-${f.status}">${esc(t('fresh_' + f.status, { d: Math.abs(f.days) }))}</span>`;
}

function renderLog() {
  // Estadísticas
  const stats = document.getElementById('log-stats');
  const avg = BL.averageByMethod(brewLog);
  const best = BL.bestByCoffee(brewLog).slice(0, 3);
  if (!brewLog.length) { stats.hidden = true; }
  else {
    stats.hidden = false;
    stats.innerHTML = `
      <div class="free-card-title">${esc(t('logProgressTitle'))}</div>
      ${avg.length ? `<ul class="bars">${avg.map(a => `
        <li><span class="bar-label">${esc(BREWER_LABELS[a.method])}</span>
          <span class="bar-track" aria-hidden="true"><span class="bar-fill" style="width:${(a.avg / 5) * 100}%"></span></span>
          <span class="bar-val">${a.avg} ★ <small>(${a.count})</small></span></li>`).join('')}</ul>`
        : `<p class="muted">${esc(t('logNoRatings'))}</p>`}
      ${best.length ? `<div class="free-card-title small">${esc(t('logBestTitle'))}</div>
        <ul class="best-list">${best.map(e => `<li><b>${esc(e.coffeeName)}</b> · ${esc(BREWER_LABELS[e.method])} · ${fmtNum(e.dose)} g / ${e.water} ${e.method === 'expreso' ? 'g' : 'ml'} · ${stars(e.rating)}
          <button type="button" class="link-btn inline" onclick="repeatLogEntry(${e.id})">${esc(t('logRepeat'))}</button></li>`).join('')}</ul>` : ''}`;
  }

  // Filtros por método usados
  const used = Array.from(new Set(brewLog.map(e => e.method)));
  if (logFilter !== 'all' && !used.includes(logFilter)) logFilter = 'all';
  const filters = document.getElementById('log-filters');
  filters.hidden = used.length < 2;
  filters.innerHTML = ['all'].concat(used).map(k =>
    `<button type="button" class="chip" aria-pressed="${logFilter === k}" onclick="setLogFilter('${k}')">${esc(k === 'all' ? t('logAll') : BREWER_LABELS[k])}</button>`).join('');

  // Lista
  const list = document.getElementById('log-list');
  const items = brewLog.filter(e => logFilter === 'all' || e.method === logFilter).sort((a, b) => (b.date > a.date ? 1 : -1));
  document.getElementById('log-empty').hidden = brewLog.length > 0;
  list.innerHTML = items.map(e => {
    const unit = e.method === 'expreso' ? 'g' : 'ml';
    const params = [
      e.dose ? fmtNum(e.dose) + ' g' : '', e.water ? e.water + ' ' + unit : '', e.ratio ? fmtRatio(e.ratio) : '',
      e.timeSec ? '⏱ ' + BL.fmtClock(e.timeSec) : '',
      e.grindIdx >= 0 ? '⚙️ ' + (GRIND_OPTIONS[e.grindIdx] || '') + (e.clicks ? ` (${e.clicks} ${t('clicksShort')})` : '') : (e.clicks ? `⚙️ ${e.clicks} ${t('clicksShort')}` : '')
    ].filter(Boolean).join(' · ');
    return `<article class="log-entry">
      <div class="log-head">
        <div><div class="log-method">${esc(BREWER_LABELS[e.method])}${e.coffeeName ? ` <span class="log-coffee">· ${esc(e.coffeeName)}</span>` : ''}</div>
          <div class="log-date">${fmtDate(e.date)}${e.origin ? ' · 📍 ' + esc(e.origin) : ''}</div></div>
        <div class="log-stars" aria-label="${esc(t('ariaRating', { n: e.rating }))}">${e.rating ? stars(e.rating) : ''}</div>
      </div>
      ${params ? `<div class="log-params">${esc(params)}</div>` : ''}
      ${e.roastDate ? `<div class="log-params">🔥 ${esc(fmtDate(BL.parseDateFlexible(e.roastDate) || e.roastDate))} ${freshnessBadge(e.roastDate, e.method)}</div>` : ''}
      ${e.tags.length ? `<div class="tag-row">${e.tags.map(tg => `<span class="tag">${esc(t('taste_' + tg))}</span>`).join('')}</div>` : ''}
      ${e.notes ? `<p class="log-notes">${esc(e.notes)}</p>` : ''}
      <div class="log-actions">
        <button type="button" class="mini-btn" onclick="repeatLogEntry(${e.id})">↻ ${esc(t('logRepeat'))}</button>
        <button type="button" class="mini-btn" onclick="diagnoseLogEntry(${e.id})">🩺 ${esc(t('logDiagnose'))}</button>
        <button type="button" class="mini-btn danger" onclick="armDelete(this, () => deleteLogEntry(${e.id}))" aria-label="${esc(t('ariaDelete'))}">✕</button>
      </div>
    </article>`;
  }).join('');
}

function setLogFilter(k) { logFilter = k; renderLog(); }

function repeatLogEntry(id) {
  const e = brewLog.find(x => x.id === id);
  if (!e) return;
  loadRecipeIntoFlow({ method: e.method, dose: e.dose, water: e.water, coffeeName: e.coffeeName, origin: e.origin });
}
function diagnoseLogEntry(id) {
  const e = brewLog.find(x => x.id === id);
  if (!e) return;
  loadRecipeIntoFlow({ method: e.method, dose: e.dose, water: e.water, coffeeName: e.coffeeName, origin: e.origin });
  openDialIn('brew');
  e.tags.forEach(tg => Dial.tags.add(tg));
  if (e.method === 'expreso' && e.timeSec) document.getElementById('esp-time').value = e.timeSec;
  renderDialIn();
}

// Borrado en dos toques + deshacer
function armDelete(btn, onConfirm) {
  if (btn.dataset.armed === '1') {
    btn.dataset.armed = '';
    onConfirm();
    return;
  }
  btn.dataset.armed = '1';
  btn.dataset.label = btn.textContent;
  btn.textContent = t('confirmDelete');
  btn.classList.add('armed');
  setTimeout(() => {
    if (!document.body.contains(btn)) return;
    btn.dataset.armed = '';
    btn.textContent = btn.dataset.label;
    btn.classList.remove('armed');
  }, 3500);
}

function deleteLogEntry(id) {
  const idx = brewLog.findIndex(x => x.id === id);
  if (idx < 0) return;
  const [removed] = brewLog.splice(idx, 1);
  persistLog();
  renderLog();
  toast(t('deleted'), { action: { label: t('undo'), fn: () => { brewLog.splice(idx, 0, removed); persistLog(); renderLog(); } } });
}

function openLogForm(prefill) {
  prefill = prefill || {};
  const method = prefill.method || state.brewer || 'v60';
  const f = (id) => document.getElementById(id);
  renderLogMethodOptions();
  f('lf-method').value = method;
  f('lf-coffee').value = prefill.coffeeName || '';
  f('lf-origin').value = prefill.origin || '';
  f('lf-roast').value = /^\d{4}-\d{2}-\d{2}$/.test(prefill.roastDate || '') ? prefill.roastDate : isoFromFlexible(prefill.roastDate);
  f('lf-dose').value = prefill.dose ? fmtNum(prefill.dose) : '';
  f('lf-water').value = prefill.water || '';
  const ts = Math.round(prefill.timeSec || 0);
  f('lf-min').value = ts ? Math.floor(ts / 60) : '';
  f('lf-sec').value = ts ? ts % 60 : '';
  f('lf-clicks').value = prefill.clicks || '';
  f('lf-notes').value = prefill.notes || '';
  logForm = {
    grindIdx: prefill.grindIdx !== undefined ? prefill.grindIdx : BL.roastAdjust(method, state.roast || 'medio').grindIdx,
    rating: prefill.rating || 0,
    tags: new Set(prefill.tags || [])
  };
  syncLogForm();
  openSheet('sheet-log');
}

function isoFromFlexible(s) {
  const d = BL.parseDateFlexible(s);
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function openLogFormFromBrew() {
  const r = state.recipe || {};
  const v = (id) => (document.getElementById(id) ? document.getElementById(id).value.trim() : '');
  const notes = [v('sensory-notas'), v('sensory-personal')].filter(Boolean).join(' · ');
  openLogForm({
    method: state.brewer, dose: r.dose, water: r.water,
    coffeeName: v('sensory-coffee-name'), origin: v('sensory-origin'), roastDate: v('sensory-roast-date'),
    notes, timeSec: Guided.method === state.brewer && Guided.done ? BL.totalDuration(Guided.phases) : 0
  });
}

function renderLogMethodOptions() {
  const sel = document.getElementById('lf-method');
  sel.innerHTML = Object.keys(BDATA.METHODS).map(k => `<option value="${k}">${esc(BREWER_LABELS[k])}</option>`).join('');
}

function syncLogForm() {
  document.querySelectorAll('#lf-grind [data-g]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.g === logForm.grindIdx)));
  document.querySelectorAll('#lf-grind [data-g]').forEach(b => { b.querySelector('.g-name').textContent = GRIND_OPTIONS[+b.dataset.g]; });
  document.querySelectorAll('#lf-stars [data-star]').forEach(b => {
    const n = +b.dataset.star;
    b.textContent = n <= logForm.rating ? '★' : '☆';
    b.setAttribute('aria-checked', String(n === logForm.rating));
    b.setAttribute('aria-label', t('ariaStars', { n }));
  });
  document.querySelectorAll('#lf-tags [data-tag]').forEach(b => b.setAttribute('aria-pressed', String(logForm.tags.has(b.dataset.tag))));
  const dose = parseFloat(document.getElementById('lf-dose').value);
  const water = parseFloat(document.getElementById('lf-water').value);
  document.getElementById('lf-ratio').textContent = dose > 0 && water > 0 ? t('lfRatioIs', { r: fmtRatio(water / dose) }) : '';
  const method = document.getElementById('lf-method').value;
  document.getElementById('lf-water-label').textContent = method === 'expreso' ? t('lfYield') : t('lfWater');
  document.getElementById('lf-fresh').innerHTML = freshnessBadge(document.getElementById('lf-roast').value, method);
}

function setLogGrind(i) { logForm.grindIdx = logForm.grindIdx === i ? -1 : i; syncLogForm(); }
function setLogRating(n) { logForm.rating = logForm.rating === n ? 0 : n; syncLogForm(); }
function toggleLogTag(tag) {
  if (logForm.tags.has(tag)) logForm.tags.delete(tag); else logForm.tags.add(tag);
  syncLogForm();
}
function onStarsKey(ev) {
  if (ev.key === 'ArrowRight' || ev.key === 'ArrowUp') { ev.preventDefault(); logForm.rating = Math.min(5, logForm.rating + 1); }
  else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowDown') { ev.preventDefault(); logForm.rating = Math.max(0, logForm.rating - 1); }
  else return;
  syncLogForm();
  const btn = document.querySelector(`#lf-stars [data-star="${Math.max(1, logForm.rating)}"]`);
  if (btn) btn.focus();
}

function saveLogEntry() {
  const v = (id) => document.getElementById(id).value;
  const min = parseInt(v('lf-min'), 10) || 0, sec = parseInt(v('lf-sec'), 10) || 0;
  const entry = BL.sanitizeLogEntry({
    id: Date.now(), date: new Date().toISOString(), method: v('lf-method'),
    coffeeName: v('lf-coffee'), origin: v('lf-origin'), roastDate: v('lf-roast'),
    dose: parseFloat(v('lf-dose')) || 0, water: parseFloat(v('lf-water')) || 0,
    timeSec: min * 60 + sec, grindIdx: logForm.grindIdx, clicks: v('lf-clicks'),
    rating: logForm.rating, notes: v('lf-notes'), tags: Array.from(logForm.tags)
  });
  if (!entry) return;
  brewLog.push(entry);
  if (persistLog() === false) return;
  closeSheet('sheet-log');
  toast(t('logSaved'), { action: { label: t('logSee'), fn: goToLog } });
  if (document.querySelector('.screen.active').id === 'screen-log') renderLog();
}

/* ===================== 10. APRENDÉ ===================== */
let lessonsRead = new Set();
function loadLessonsRead() { lessonsRead = new Set((Store.read('lessons', []) || []).filter(id => BDATA.LESSONS.some(l => l.id === id))); }
function persistLessons() { Store.write('lessons', Array.from(lessonsRead)); }
function lessonTitle(id) { const l = BDATA.LESSONS.find(x => x.id === id); return l ? L(l.title) : ''; }

function goToLearn() { renderLearn(); showScreen('screen-learn'); }

function renderLearn() {
  const total = BDATA.LESSONS.length;
  const read = BDATA.LESSONS.filter(l => lessonsRead.has(l.id)).length;
  document.getElementById('learn-progress-text').textContent = t('learnProgress', { n: read, total });
  const bar = document.getElementById('learn-progress-bar');
  bar.style.width = (read / total * 100) + '%';
  bar.parentElement.setAttribute('aria-valuenow', String(read));
  bar.parentElement.setAttribute('aria-valuemax', String(total));
  document.getElementById('lesson-list').innerHTML = BDATA.LESSONS.map(l => {
    const done = lessonsRead.has(l.id);
    return `<button type="button" class="lesson-card${done ? ' read' : ''}" onclick="openLesson('${l.id}')">
      <span class="lesson-icon" aria-hidden="true">${l.icon}</span>
      <span class="lesson-text"><span class="lesson-title">${esc(L(l.title))}</span>
      <span class="lesson-meta">${esc(t('lessonMinutes', { n: l.min }))}${done ? ' · ✓ ' + esc(t('lessonRead')) : ''}</span></span>
      <span class="lesson-bar" aria-hidden="true"><span style="width:${done ? 100 : 0}%"></span></span>
    </button>`;
  }).join('');
  renderGlossary();
}

function renderGlossary() {
  const q = (document.getElementById('glossary-search').value || '').trim().toLowerCase();
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const nq = norm(q);
  const items = BDATA.GLOSSARY.filter(g => !nq || norm(L(g.term)).includes(nq) || norm(L(g.def)).includes(nq));
  const list = document.getElementById('glossary-list');
  list.innerHTML = items.length ? items.map(g => `<div class="gloss-item">
      <dt>${esc(L(g.term))}</dt>
      <dd>${esc(L(g.def))} ${g.lesson ? `<button type="button" class="link-btn inline" onclick="openLesson('${g.lesson}')">${esc(t('glossaryMore'))}</button>` : ''}</dd>
    </div>`).join('') : `<p class="muted">${esc(t('glossaryEmpty'))}</p>`;
}

// Markdown mínimo y seguro: escapa todo y después aplica **negrita**, *cursiva* y listas "- "
function miniMarkdown(text) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  return String(text).split(/\n\n+/).map(block => {
    const lines = block.split('\n');
    if (lines.every(l => l.startsWith('- '))) return '<ul>' + lines.map(l => '<li>' + inline(l.slice(2)) + '</li>').join('') + '</ul>';
    return '<p>' + inline(block) + '</p>';
  }).join('');
}

let openLessonId = null;
function openLesson(id) {
  const l = BDATA.LESSONS.find(x => x.id === id);
  if (!l) return;
  openLessonId = id;
  document.getElementById('lesson-sheet-icon').textContent = l.icon;
  document.getElementById('lesson-sheet-title').textContent = L(l.title);
  document.getElementById('lesson-sheet-body').innerHTML = miniMarkdown(L(l.content));
  syncLessonButton();
  openSheet('sheet-lesson');
  document.getElementById('lesson-sheet-body').scrollTop = 0;
}
function syncLessonButton() {
  const btn = document.getElementById('lesson-read-btn');
  const done = lessonsRead.has(openLessonId);
  btn.textContent = done ? t('lessonUnmark') : t('lessonMark');
  btn.classList.toggle('enabled', true);
}
function toggleLessonRead() {
  if (lessonsRead.has(openLessonId)) lessonsRead.delete(openLessonId);
  else { lessonsRead.add(openLessonId); closeSheet('sheet-lesson'); toast(t('lessonDoneToast')); }
  persistLessons();
  syncLessonButton();
  if (document.querySelector('.screen.active').id === 'screen-learn') renderLearn();
}

/* ===================== 11. RECOMENDADOR ===================== */
const Rec = { origin: null, roast: null };
function openRecommender() {
  Rec.origin = null; Rec.roast = null;
  renderRecommender();
  openSheet('sheet-rec');
}
function setRecOrigin(o) { Rec.origin = o; renderRecommender(); }
function setRecRoast(r) { Rec.roast = r; renderRecommender(); }
function renderRecommender() {
  document.querySelectorAll('#rec-origins [data-origin]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.origin === Rec.origin)));
  document.querySelectorAll('#rec-roasts [data-roast]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.roast === Rec.roast)));
  const box = document.getElementById('rec-result');
  const btn = document.getElementById('rec-apply');
  if (!Rec.origin || !Rec.roast) {
    box.innerHTML = `<p class="muted">${esc(t('recPick'))}</p>`;
    btn.classList.remove('enabled');
    btn.disabled = true;
    return;
  }
  const r = BDATA.RECIPE_RECOMMENDATIONS[Rec.origin][Rec.roast];
  const ratioTxt = r.method === 'expreso' ? t('recRatioEsp', { r: fmtRatio(r.ratio) }) : (r.method === 'moka' ? t('recRatioMoka') : fmtRatio(r.ratio));
  const tempTxt = r.tempC ? (prefs.tempUnit === 'F' ? BL.cToF(r.tempC) + ' °F' : r.tempC + ' °C') : '';
  box.innerHTML = `<div class="rec-card">
    <p>${esc(t('recSentence', {
      origin: t('origin_' + Rec.origin), roast: t('roastLower_' + Rec.roast),
      method: BREWER_LABELS[r.method], ratio: ratioTxt, grind: (GRIND_OPTIONS[r.grind] || '').toLowerCase()
    }))}${tempTxt ? ' ' + esc(t('recTemp', { t: tempTxt })) : ''}</p>
    <p class="muted">${esc(t('originWhy_' + Rec.origin))}</p>
    <p class="muted small">${esc(t('recBaseline'))}</p></div>`;
  btn.classList.add('enabled');
  btn.disabled = false;
}
function applyRecommendation() {
  if (!Rec.origin || !Rec.roast) return;
  const r = BDATA.RECIPE_RECOMMENDATIONS[Rec.origin][Rec.roast];
  closeSheet('sheet-rec');
  selectBrewer(r.method);
  state.pendingRec = { method: r.method, ratio: r.ratio, roast: Rec.roast };
  toast(t('recApplied', { method: BREWER_LABELS[r.method] }));
}

/* ===================== 12. COMPARTIR ===================== */
function shareRecipe(id) {
  const recipe = savedRecipes.find(r => r.id === id);
  if (!recipe) return;
  // Receta publicada en la Comunidad → link corto; si no, la receta va codificada en el link
  const url = recipe.publicId && typeof publicRecipeUrl === 'function' && cloudConfigured()
    ? publicRecipeUrl(recipe.publicId)
    : location.origin + location.pathname + '#r=' + BL.encodeShare(recipe);
  shareUrl(url, 'Barista de Bolsillo · ' + (recipe.coffeeName || BREWER_LABELS[recipe.brewer]));
}

function shareUrl(url, title) {
  if (navigator.share) {
    navigator.share({ title, text: t('shareText'), url }).catch(() => {});
    return;
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => toast(t('shareCopied'))).catch(() => window.prompt(t('shareManual'), url));
  } else {
    window.prompt(t('shareManual'), url);
  }
}

let incomingRecipe = null;
function checkShareHash() {
  const h = location.hash || '';
  if (!h.startsWith('#r=')) return;
  incomingRecipe = BL.decodeShare(h.slice(3));
  try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
  if (!incomingRecipe) { toast(t('shareInvalid')); return; }
  presentIncomingRecipe(incomingRecipe);
}

// Muestra la hoja "Te compartieron una receta" (link codificado o receta pública de la Comunidad)
function presentIncomingRecipe(r, author) {
  incomingRecipe = r;
  const pts = (r.points || []).map(p => `${BL.fmtClock(p.min * 60 + p.sec)} → ${p.ml} ml`).join(' · ');
  document.getElementById('import-summary').innerHTML = `
    <div class="saved-recipe-brewer">${esc(r.coffeeName || BREWER_LABELS[r.brewer])}</div>
    ${author ? `<div class="muted small">${esc(t('communityBy', { name: '@' + author }))}</div>` : ''}
    <div class="muted">${esc(BREWER_LABELS[r.brewer])} · ${esc(r.grind)} · ${fmtNum(r.grams)} g${r.ratio ? ' · ' + fmtRatio(r.ratio) : ''}</div>
    ${pts ? `<div class="muted small">${esc(pts)}</div>` : ''}
    ${r.origin ? `<div class="muted small">📍 ${esc(r.origin)}</div>` : ''}`;
  openSheet('sheet-import');
}
function acceptIncomingRecipe() {
  if (!incomingRecipe) return;
  incomingRecipe.id = Date.now();
  savedRecipes.push(incomingRecipe);
  persistSavedRecipes();
  incomingRecipe = null;
  closeSheet('sheet-import');
  goToSavedScreen();
  toast(t('shareImported'));
}

/* ===================== 13. COPIA DE SEGURIDAD ===================== */
function exportBackup() {
  const payload = {
    app: 'barista-de-bolsillo', schema: BL.SCHEMA_VERSION, exportedAt: new Date().toISOString(),
    data: { recipes: savedRecipes, log: brewLog, lessonsRead: Array.from(lessonsRead), catas }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'barista-de-bolsillo-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  toast(t('backupExported'));
}

function importBackup(input) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast(t('backupInvalid')); return; }
  const reader = new FileReader();
  reader.onload = () => {
    let json;
    try { json = JSON.parse(reader.result); } catch (e) { toast(t('backupInvalid')); return; }
    const res = BL.validateBackup(json);
    if (!res.ok) { toast(t('backupInvalid')); return; }
    const recIds = new Set(savedRecipes.map(r => r.id));
    const newRecipes = res.data.recipes.filter(r => !recIds.has(r.id));
    const logIds = new Set(brewLog.map(e => e.id));
    const newLog = res.data.log.filter(e => !logIds.has(e.id));
    savedRecipes.push(...newRecipes);
    brewLog.push(...newLog);
    res.data.lessonsRead.forEach(id => lessonsRead.add(id));
    const cataIds = new Set(catas.map(c => c.id));
    catas.push(...res.data.catas.filter(c => !cataIds.has(c.id)));
    persistSavedRecipes(); persistLog(); persistLessons(); persistCatas();
    renderSavedRecipes();
    toast(t('backupImported', { r: newRecipes.length, l: newLog.length }));
  };
  reader.readAsText(file);
}

/* ===================== 14. AJUSTES ===================== */
function renderSettingsExt() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v; };
  set('pref-sound', prefs.sound);
  set('pref-vibrate', prefs.vibrate);
  set('pref-wakelock', prefs.wakeLock);
  const vol = document.getElementById('pref-volume');
  if (vol) { vol.value = Math.round(prefs.volume * 100); vol.disabled = !prefs.sound; }
  document.querySelectorAll('[data-temp-unit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.tempUnit === prefs.tempUnit)));
  const wl = document.getElementById('pref-wakelock-note');
  if (wl) wl.hidden = 'wakeLock' in navigator;
}
function setPref(key, value) {
  prefs[key] = value;
  savePrefs();
  renderSettingsExt();
  if (key === 'wakeLock') syncWakeLock();
  if (key === 'tempUnit' && state.recipe && document.getElementById('screen-brew').classList.contains('active')) syncDoseWidget();
}
function testSound() { Feedback.unlock(); Feedback.beep('phase'); Feedback.vibrate([140]); }

/* ===================== 15. ACCESIBILIDAD ===================== */
const CLICKABLE_DIVS = '.size-option, .intensity-option, .choice-option, .sensory-dot, #logo-home-btn';

function enhanceA11y(root) {
  (root || document).querySelectorAll(CLICKABLE_DIVS).forEach(el => {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  });
  document.querySelectorAll('.sensory-dots').forEach(group => {
    const attr = group.dataset.attr;
    group.setAttribute('role', 'group');
    const label = document.getElementById('txt-sensory-' + attr);
    group.querySelectorAll('.sensory-dot').forEach(dot => {
      dot.setAttribute('aria-label', (label ? label.textContent : attr) + ' ' + dot.dataset.value + '/5');
    });
  });
  const logo = document.getElementById('logo-home-btn');
  if (logo) logo.setAttribute('aria-label', t('ariaHome'));
  syncPressedStates();
}

// Mantiene aria-pressed sincronizado con las clases visuales del script original
function syncPressedStates() {
  document.querySelectorAll('.size-option, .intensity-option, .choice-option').forEach(el => {
    el.setAttribute('aria-pressed', String(el.classList.contains('selected')));
  });
  document.querySelectorAll('.sensory-dot').forEach(el => el.setAttribute('aria-pressed', String(el.classList.contains('filled'))));
}

function onGlobalKeydown(ev) {
  const el = ev.target;
  // Solo elementos HTML: los sectores SVG de la rueda tienen su propio manejo (js/wheel.js)
  if ((ev.key === 'Enter' || ev.key === ' ') && el instanceof HTMLElement && el.matches('[role="button"]:not(button)')) {
    ev.preventDefault();
    el.click();
  }
  if (ev.key === 'Escape') {
    if (typeof Wheel === 'object' && Wheel.fs) { exitWheelFullscreen(); return; }
    const open = document.querySelector('.sheet-overlay.open');
    if (open) { closeSheet(open.id); return; }
    if (document.getElementById('settings-overlay').classList.contains('open')) closeSettings();
  }
}

/* ===================== 16. ARRANQUE ===================== */
function onVisibility() {
  if (document.visibilityState !== 'visible') return;
  // Al volver a primer plano, los cronómetros se recalculan desde el reloj (no se desfasan)
  if (timerRunning && typeof syncTimerFromClock === 'function') syncTimerFromClock();
  if (miniTimerRunning && typeof updateMiniTimerDisplay === 'function') updateMiniTimerDisplay();
  if (Guided.running) guidedTick();
  checkColdBrew();
  syncWakeLock();
}

function bootV2() {
  mergeI18nExt();
  runMigrations();
  loadPrefs();
  loadSavedRecipes();
  loadLog();
  loadLessonsRead();
  loadCatas();
  applyTranslations();
  applyTheme(currentTheme);
  document.documentElement.classList.remove('i18n-pending');
  enhanceA11y();
  checkColdBrew();
  setInterval(checkColdBrew, 30000);
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('keydown', onGlobalKeydown);
  document.addEventListener('click', () => requestAnimationFrame(syncPressedStates));
  window.addEventListener('hashchange', checkShareHash); // link abierto con la app ya cargada
  checkShareHash();
  if (typeof initCloud === 'function') initCloud();   // cuentas y comunidad (js/cloud.js)
}

bootV2();
