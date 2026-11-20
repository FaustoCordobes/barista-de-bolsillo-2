/* =====================================================================
 * Barista de Bolsillo — LÓGICA PURA (sin DOM)
 * ---------------------------------------------------------------------
 * Funciones deterministas y testeables: cálculos de receta, fases,
 * frescura, motor de diagnóstico (dial-in), validación de datos,
 * migraciones de almacenamiento y links para compartir.
 * Tests: node tests/logic.test.mjs
 * Depende de: BDATA (js/data.js)
 * ===================================================================== */
const BL = (function () {
  const D = BDATA;
  const SCHEMA_VERSION = 2;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const round1 = (v) => Math.round(v * 10) / 10;
  const isNum = (v) => typeof v === 'number' && isFinite(v);

  function fmtClock(totalSec) {
    const s = Math.max(0, Math.round(totalSec || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------------- Recetas ---------------- */

  // Ratio base del método (replica la lógica original de la app)
  function baselineRatio(methodKey, intensity) {
    const m = D.METHODS[methodKey];
    if (m && m.ratio && m.ratio.def !== undefined) return m.ratio.def;
    if (intensity === 'suave') return 18;
    if (intensity === 'fuerte') return 13;
    return 16;
  }

  function ratioBounds(methodKey) {
    const m = D.METHODS[methodKey];
    const r = (m && m.ratio) || {};
    return { min: r.min ?? 10, max: r.max ?? 20, step: r.step ?? 0.5 };
  }

  // Calcula todos los números a partir de dosis + ratio (+ versión helada)
  function computeRecipe({ method, dose, ratio, iced }) {
    const total = dose * ratio;             // agua total (o rendimiento en espresso)
    const out = { dose: round1(dose), ratio: round1(ratio), water: Math.round(total) };
    const m = D.METHODS[method] || {};
    if (iced && m.iced) {
      // Método japonés: 60% agua caliente sobre el café, 40% hielo en la jarra
      out.hotWater = Math.round(total * 0.6);
      out.ice = out.water - out.hotWater;
    } else {
      out.hotWater = out.water;
      out.ice = 0;
    }
    return out;
  }

  // Genera las fases con tiempos absolutos y agua objetivo acumulada
  function buildPhases(methodKey, pourWater) {
    const m = D.METHODS[methodKey];
    if (!m || !m.phases) return [];
    let t = 0;
    return m.phases.map((p, i) => {
      const ph = {
        index: i, key: p.key, start: t, dur: p.dur, end: t + p.dur,
        target: (m.noWater || p.to === undefined) ? null : Math.round(p.to * pourWater)
      };
      t += p.dur;
      return ph;
    });
  }

  function totalDuration(phases) {
    return phases.length ? phases[phases.length - 1].end : 0;
  }

  // Índice de la fase activa (phases.length si ya terminó)
  function phaseAt(phases, elapsedSec) {
    for (let i = 0; i < phases.length; i++) {
      if (elapsedSec < phases[i].end) return i;
    }
    return phases.length;
  }

  // Puntos de vertido (para guardar en "Mi café ideal"): fin de cada fase que cambia el agua
  function phasesToPoints(phases) {
    const pts = [];
    let last = -1;
    phases.forEach(p => {
      if (p.target !== null && p.target !== last) {
        pts.push({ min: Math.floor(p.end / 60), sec: p.end % 60, ml: p.target });
        last = p.target;
      }
    });
    return pts;
  }

  function roastAdjust(methodKey, roast) {
    const m = D.METHODS[methodKey] || {};
    const adj = D.ROAST_ADJUST[roast] || D.ROAST_ADJUST.medio;
    const grindIdx = clamp((m.grind ?? 3) + adj.grindShift, 0, 5);
    const tempC = m.tempC ? [clamp(m.tempC[0] + adj.tempDelta, 80, 100), clamp(m.tempC[1] + adj.tempDelta, 80, 100)] : null;
    return { grindIdx, tempC, grindShift: adj.grindShift, tempDelta: adj.tempDelta };
  }

  const cToF = (c) => Math.round(c * 9 / 5 + 32);

  /* ---------------- Fechas y frescura ---------------- */

  // Acepta "2026-07-12", "12/07/2026", "12-07-2026", "12/07/26"
  function parseDateFlexible(str) {
    if (!str) return null;
    const s = String(str).trim();
    let y, mo, d;
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; }
    else {
      m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})$/);
      if (!m) return null;
      d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000;
    }
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const date = new Date(y, mo - 1, d);
    if (date.getMonth() !== mo - 1) return null;
    return date;
  }

  function daysBetween(a, b) {
    const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((ub - ua) / 86400000);
  }

  // → { status: 'resting'|'peak'|'declining'|'future', days } o null
  function freshness(roastDateStr, methodKey, today) {
    const rd = parseDateFlexible(roastDateStr);
    if (!rd) return null;
    const days = daysBetween(rd, today || new Date());
    if (days < 0) return { status: 'future', days };
    const fam = (D.METHODS[methodKey] || {}).family || 'percolation';
    const win = D.FRESHNESS[fam] || D.FRESHNESS.percolation;
    if (days < win[0]) return { status: 'resting', days, window: win };
    if (days <= win[1]) return { status: 'peak', days, window: win };
    return { status: 'declining', days, window: win };
  }

  /* ---------------- Motor de diagnóstico (dial-in) ----------------
   * Determinista, sin IA. Devuelve UNA recomendación (una variable por vez).
   * input = {
   *   method: 'v60',
   *   tags: ['sour'|'bitter'|'weak'|'strong'|'astringent'|'sourBitter'|'balanced'],
   *   espresso: { dose, yieldG, time, earlyDrops } (opcional),
   *   history: [{ variable, direction, step }]   // ajustes previos de esta sesión
   * }
   * salida = { variable, direction, step, amount, unit, converging, lesson, note, verdict }
   */

  const BASE_AMOUNT = {
    grind: { amount: 1, unit: 'point' },
    time: { amount: 30, unit: 's' },
    yield: { amount: 2, unit: 'g' },
    dose: { amount: 1, unit: 'g' }
  };

  function convergeStep(history, variable, direction) {
    const prev = (history || []).filter(h => h.variable === variable);
    if (!prev.length) return 1;
    const last = prev[prev.length - 1];
    if (last.direction === direction) return last.step || 1;
    // El usuario cruzó el punto óptimo (p. ej. de ácido a amargo): paso a la mitad
    return Math.max(0.25, (last.step || 1) / 2);
  }

  function espressoVerdict(esp) {
    const out = { ratio: null, verdict: null, reason: null };
    if (!esp) return out;
    if (isNum(esp.dose) && esp.dose > 0 && isNum(esp.yieldG) && esp.yieldG > 0) out.ratio = round1(esp.yieldG / esp.dose);
    const win = D.METHODS.expreso.windowSec;
    if (esp.earlyDrops) { out.verdict = 'finer'; out.reason = 'early'; return out; }
    if (!isNum(esp.time) || esp.time <= 0) return out;
    if (esp.time < win[0]) { out.verdict = 'finer'; out.reason = 'fast'; }
    else if (esp.time > win[1]) { out.verdict = 'coarser'; out.reason = 'slow'; }
    else { out.verdict = 'window'; out.reason = 'window'; }
    return out;
  }

  function diagnose(input) {
    const method = input.method;
    const m = D.METHODS[method] || { family: 'percolation' };
    const fam = m.family;
    const tags = new Set(input.tags || []);
    const history = input.history || [];
    const immersionLike = fam === 'immersion' || fam === 'coldbrew';

    const make = (variable, direction, extra) => {
      const step = convergeStep(history, variable, direction);
      const base = BASE_AMOUNT[variable];
      let amount = null, unit = null;
      if (base) {
        unit = base.unit;
        let a = base.amount;
        if (variable === 'time' && fam === 'coldbrew') { a = 2; unit = 'h'; }
        if (variable === 'dose' && fam === 'coldbrew') { a = 10; }
        amount = Math.round(a * step * 100) / 100;
      }
      return Object.assign({
        variable, direction, step, amount, unit,
        converging: step < 1,
        lesson: D.LESSON_FOR[variable] || null,
        family: fam
      }, extra || {});
    };

    // 1) Espresso avanzado: el tiempo de flujo manda sobre la molienda
    let insideWindow = false;
    let verdict = null;
    if (fam === 'espresso' && input.espresso) {
      verdict = espressoVerdict(input.espresso);
      if (verdict.verdict === 'finer') return make('grind', 'finer', { verdict });
      if (verdict.verdict === 'coarser') return make('grind', 'coarser', { verdict });
      insideWindow = verdict.verdict === 'window';
    }

    const sour = tags.has('sour'), bitter = tags.has('bitter');
    const weak = tags.has('weak'), strong = tags.has('strong');
    const strengthLater = (sour || bitter) && (weak || strong);
    const note = strengthLater ? 'strengthLater' : null;

    if (tags.has('balanced') && !sour && !bitter && !weak && !strong && !tags.has('astringent') && !tags.has('sourBitter')) {
      return { variable: 'done', direction: 'none', step: 0, amount: null, unit: null, converging: false, lesson: null, verdict };
    }

    // 2) Ácido y amargo a la vez → canalización / distribución, antes de tocar la molienda
    if (tags.has('sourBitter') || (sour && bitter)) {
      return make('prep', immersionLike ? 'evenness' : 'distribution', { verdict });
    }

    // 3) Ácido → subextracción
    if (sour) {
      if (fam === 'espresso') return insideWindow ? make('yield', 'up', { verdict, note }) : make('grind', 'finer', { verdict, note });
      if (immersionLike) return make('time', 'longer', { verdict, note });
      return make('grind', 'finer', { verdict, note }); // percolación y moka
    }

    // 4) Amargo → sobreextracción
    if (bitter) {
      if (fam === 'espresso') return insideWindow ? make('yield', 'down', { verdict, note }) : make('grind', 'coarser', { verdict, note });
      if (fam === 'moka') return make('heat', 'lower', { verdict, note });
      if (immersionLike) return make('time', 'shorter', { verdict, note });
      return make('grind', 'coarser', { verdict, note });
    }

    // 5) Astringente / seco
    if (tags.has('astringent')) {
      if (fam === 'percolation') return make('pour', 'gentler', { verdict });
      return make('grind', 'coarser', { verdict });
    }

    // 6) Fuerza (no es un problema de extracción)
    if (weak) return fam === 'espresso' ? make('yield', 'down', { verdict }) : make('dose', 'up', { verdict });
    if (strong) return fam === 'espresso' ? make('yield', 'up', { verdict }) : make('dose', 'down', { verdict });

    if (insideWindow) {
      return { variable: 'done', direction: 'none', step: 0, amount: null, unit: null, converging: false, lesson: null, verdict };
    }
    return { variable: 'none', direction: 'none', step: 0, amount: null, unit: null, converging: false, lesson: null, verdict };
  }

  /* ---------------- Validación / sanitización ---------------- */

  const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max || 200) : '');
  const num = (v, min, max, fb) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return isNum(n) ? clamp(n, min, max) : fb;
  };

  function sanitizeRecipe(r) {
    if (!r || typeof r !== 'object') return null;
    if (!D.METHODS[r.brewer]) return null;
    const grams = num(r.grams, 0, 2000, 0);
    const points = Array.isArray(r.points) ? r.points.slice(0, 30).map(p => ({
      min: Math.round(num(p && p.min, 0, 999, 0)),
      sec: Math.round(num(p && p.sec, 0, 59, 0)),
      ml: Math.round(num(p && p.ml, 0, 20000, 0))
    })) : [];
    const out = {
      id: isNum(r.id) ? r.id : Date.now() + Math.floor(Math.random() * 1000),
      brewer: r.brewer, grind: str(r.grind, 40), grams, points
    };
    ['timeText', 'coffeeName', 'origin', 'roastDate', 'aroma', 'fragancia', 'notas', 'personalNote', 'roast'].forEach(k => {
      const v = str(r[k], k === 'personalNote' ? 600 : 200);
      if (v) out[k] = v;
    });
    if (isNum(r.ratio)) out.ratio = round1(clamp(r.ratio, 1, 30));
    if (typeof r.publicId === 'string' && /^[0-9a-f-]{36}$/.test(r.publicId)) out.publicId = r.publicId;
    if (r.sensory && typeof r.sensory === 'object') {
      out.sensory = {};
      ['acidez', 'cuerpo', 'dulzura'].forEach(k => { out.sensory[k] = Math.round(num(r.sensory[k], 0, 5, 0)); });
    }
    return out;
  }

  const TAG_KEYS = ['sour', 'bitter', 'weak', 'strong', 'astringent', 'sourBitter', 'balanced'];

  function sanitizeLogEntry(e) {
    if (!e || typeof e !== 'object') return null;
    if (!D.METHODS[e.method]) return null;
    const date = typeof e.date === 'string' && !isNaN(Date.parse(e.date)) ? e.date : new Date().toISOString();
    const out = {
      id: isNum(e.id) ? e.id : Date.now() + Math.floor(Math.random() * 1000),
      date, method: e.method,
      coffeeName: str(e.coffeeName, 120), origin: str(e.origin, 120), roastDate: str(e.roastDate, 20),
      dose: round1(num(e.dose, 0, 2000, 0)), water: Math.round(num(e.water, 0, 20000, 0)),
      timeSec: Math.round(num(e.timeSec, 0, 86400 * 2, 0)),
      grindIdx: Math.round(num(e.grindIdx, -1, 5, -1)),
      clicks: str(String(e.clicks == null ? '' : e.clicks), 12),
      rating: Math.round(num(e.rating, 0, 5, 0)),
      notes: str(e.notes, 800),
      tags: Array.isArray(e.tags) ? e.tags.filter(t => TAG_KEYS.includes(t)).slice(0, 7) : []
    };
    out.ratio = out.dose > 0 ? round1(out.water / out.dose) : 0;
    return out;
  }

  const CATA_ATTRS = ['fragancia', 'aroma', 'acidez', 'dulzor', 'cuerpo', 'amargor', 'retrogusto', 'balance'];

  // Hoja de cata (rueda de sabores). Los ids de sabores se validan por formato:
  // la UI ignora los que no existan en FLAVOR_WHEEL.
  function sanitizeCata(c) {
    if (!c || typeof c !== 'object') return null;
    const flavors = [];
    (Array.isArray(c.flavors) ? c.flavors : []).forEach(f => {
      if (!f || typeof f.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(f.id)) return;
      if (flavors.some(x => x.id === f.id) || flavors.length >= 60) return;
      flavors.push({ id: f.id, intensity: Math.round(num(f.intensity, 1, 15, 8)) });
    });
    const attrs = {};
    CATA_ATTRS.forEach(a => { attrs[a] = Math.round(num(c.attrs && c.attrs[a], 0, 10, 5) * 2) / 2; });
    return {
      id: isNum(c.id) ? c.id : Date.now() + Math.floor(Math.random() * 1000),
      date: typeof c.date === 'string' && !isNaN(Date.parse(c.date)) ? c.date : new Date().toISOString(),
      coffeeName: str(c.coffeeName, 120), origin: str(c.origin, 120), roastDate: str(c.roastDate, 20),
      method: D.METHODS[c.method] ? c.method : '',
      flavors, attrs,
      rating: Math.round(num(c.rating, 0, 5, 0)),
      notes: str(c.notes, 800)
    };
  }

  /* ---------------- Sincronización con la nube (local primero) ----------------
   * Cada colección (recetas, bitácora, catas) se compara contra la nube y contra
   * una "foto" de la última sincronización (last: clave → {h: hash, u: updated_at}).
   * Así se detecta qué cambió acá, qué cambió en otro dispositivo y qué se borró,
   * sin tener que marcar cada edición en el código de la app.
   * local:  { clave: data }             (ya sanitizado)
   * remote: { clave: { data, deleted, updated_at } }
   * Devuelve las acciones a ejecutar; no toca nada por sí misma.            */
  function stableStringify(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
    return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stableStringify(v[k])).join(',') + '}';
  }
  function hashData(v) {
    const str = stableStringify(v);
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + ':' + str.length;
  }

  function planSync(local, remote, last) {
    const plan = { push: [], pushDelete: [], pull: [], removeLocal: [], keep: {} };
    const keys = new Set([...Object.keys(local), ...Object.keys(remote), ...Object.keys(last)]);
    keys.forEach(key => {
      const l = local[key], r = remote[key], s = last[key];
      const lh = l !== undefined ? hashData(l) : null;
      if (l !== undefined && !r) { plan.push.push(key); return; }
      if (l === undefined && r && !r.deleted) {
        if (s && s.u === r.updated_at) plan.pushDelete.push(key);   // lo borraste acá
        else plan.pull.push(key);                                    // nuevo o cambiado en otro dispositivo
        return;
      }
      if (l === undefined) return;                                   // borrado en ambos lados
      if (r.deleted) {
        if (!s || lh !== s.h) plan.push.push(key);                   // lo editaste acá: se recupera
        else plan.removeLocal.push(key);                             // se borró en otro dispositivo
        return;
      }
      if (!s) {                                                      // primera vez que se cruzan
        if (lh === hashData(r.data)) plan.keep[key] = { h: lh, u: r.updated_at };
        else plan.pull.push(key);
        return;
      }
      const localChanged = lh !== s.h, remoteChanged = r.updated_at !== s.u;
      if (localChanged) plan.push.push(key);                         // si cambió en los dos, gana este dispositivo
      else if (remoteChanged) plan.pull.push(key);
      else plan.keep[key] = s;
    });
    return plan;
  }

  /* ---------------- Migraciones de almacenamiento ----------------
   * v1: solo existían 'baristaSavedRecipes', 'baristaLang', 'baristaTheme'.
   * v2: se agregan bitácora, lecciones, preferencias, dial-in, cold brew.
   *     Las recetas viejas se conservan; solo se reparan campos faltantes.  */
  function migrate(data, fromVersion) {
    const out = Object.assign({}, data);
    let v = fromVersion || 1;
    if (v < 2) {
      out.recipes = (Array.isArray(out.recipes) ? out.recipes : [])
        .filter(r => r && typeof r === 'object')
        .map(r => Object.assign({}, r, {
          id: isNum(r.id) ? r.id : Date.now() + Math.floor(Math.random() * 100000),
          points: Array.isArray(r.points) ? r.points : [],
          grams: isNum(r.grams) ? r.grams : (parseFloat(r.grams) || 0)
        }));
      out.log = Array.isArray(out.log) ? out.log : [];
      v = 2;
    }
    out.version = v;
    return out;
  }

  function validateBackup(json) {
    if (!json || typeof json !== 'object') return { ok: false, error: 'format' };
    if (json.app !== 'barista-de-bolsillo') return { ok: false, error: 'app' };
    if (!isNum(json.schema) || json.schema > SCHEMA_VERSION) return { ok: false, error: 'schema' };
    const d = json.data || {};
    const migrated = migrate({ recipes: d.recipes, log: d.log }, json.schema);
    const recipes = migrated.recipes.map(sanitizeRecipe).filter(Boolean);
    const log = migrated.log.map(sanitizeLogEntry).filter(Boolean);
    const lessonsRead = Array.isArray(d.lessonsRead) ? d.lessonsRead.filter(id => D.LESSONS.some(l => l.id === id)) : [];
    const catas = (Array.isArray(d.catas) ? d.catas : []).map(sanitizeCata).filter(Boolean);
    return { ok: true, data: { recipes, log, lessonsRead, catas } };
  }

  /* ---------------- Compartir receta por link (sin backend) ---------------- */

  function b64urlEncode(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64urlDecode(code) {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function encodeShare(recipe) {
    const o = {
      v: 1, b: recipe.brewer, g: recipe.grind || '', gr: recipe.grams,
      p: (recipe.points || []).map(p => [p.min, p.sec, p.ml])
    };
    if (recipe.coffeeName) o.n = recipe.coffeeName;
    if (recipe.origin) o.o = recipe.origin;
    if (recipe.ratio) o.r = recipe.ratio;
    if (recipe.roast) o.t = recipe.roast;
    return b64urlEncode(JSON.stringify(o));
  }

  function decodeShare(code) {
    try {
      if (!code || code.length > 3000) return null;
      const o = JSON.parse(b64urlDecode(code));
      if (!o || o.v !== 1) return null;
      return sanitizeRecipe({
        id: Date.now(), brewer: o.b, grind: o.g, grams: o.gr,
        points: Array.isArray(o.p) ? o.p.map(a => ({ min: a[0], sec: a[1], ml: a[2] })) : [],
        coffeeName: o.n, origin: o.o, ratio: o.r, roast: o.t
      });
    } catch (e) {
      return null;
    }
  }

  /* ---------------- Estadísticas de la bitácora ---------------- */

  function averageByMethod(log) {
    const acc = {};
    (log || []).forEach(e => {
      if (!e.rating) return;
      acc[e.method] = acc[e.method] || { method: e.method, sum: 0, count: 0 };
      acc[e.method].sum += e.rating; acc[e.method].count += 1;
    });
    return Object.values(acc)
      .map(a => ({ method: a.method, avg: round1(a.sum / a.count), count: a.count }))
      .sort((a, b) => b.avg - a.avg || b.count - a.count);
  }

  function bestByCoffee(log) {
    const best = {};
    (log || []).forEach(e => {
      const name = (e.coffeeName || '').trim();
      if (!name || !e.rating) return;
      const k = name.toLowerCase();
      const cur = best[k];
      if (!cur || e.rating > cur.rating || (e.rating === cur.rating && e.date > cur.date)) best[k] = e;
    });
    return Object.values(best).sort((a, b) => b.rating - a.rating);
  }

  return {
    SCHEMA_VERSION, clamp, round1, fmtClock, escapeHtml,
    baselineRatio, ratioBounds, computeRecipe, buildPhases, totalDuration, phaseAt, phasesToPoints,
    roastAdjust, cToF, parseDateFlexible, freshness,
    convergeStep, espressoVerdict, diagnose,
    sanitizeRecipe, sanitizeLogEntry, sanitizeCata, CATA_ATTRS, migrate, validateBackup,
    encodeShare, decodeShare, averageByMethod, bestByCoffee,
    stableStringify, hashData, planSync
  };
})();
