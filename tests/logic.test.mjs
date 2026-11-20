// Tests de la lógica pura de Barista de Bolsillo (sin dependencias).
// Uso: node tests/logic.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ctx = vm.createContext({ TextEncoder, TextDecoder, btoa, atob, Date, Math, JSON, console });
vm.runInContext(readFileSync(join(root, 'js/data.js'), 'utf8'), ctx, { filename: 'data.js' });
vm.runInContext(readFileSync(join(root, 'js/logic.js'), 'utf8'), ctx, { filename: 'logic.js' });
const BL = vm.runInContext('BL', ctx);
const BDATA = vm.runInContext('BDATA', ctx);

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n    ' + e.message); }
}
// vm devuelve objetos de otro "realm": los normalizamos para comparar
const plain = (v) => JSON.parse(JSON.stringify(v));

console.log('\nCálculos de receta');
test('V60 15 g × 1:15 = 225 ml', () => {
  const r = BL.computeRecipe({ method: 'v60', dose: 15, ratio: 15 });
  assert.equal(r.water, 225); assert.equal(r.ice, 0);
});
test('Escalado: 18 g × 1:15 = 270 ml', () => {
  assert.equal(BL.computeRecipe({ method: 'v60', dose: 18, ratio: 15 }).water, 270);
});
test('Versión helada: 60% caliente + 40% hielo', () => {
  const r = BL.computeRecipe({ method: 'v60', dose: 20, ratio: 15, iced: true });
  assert.equal(r.water, 300); assert.equal(r.hotWater, 180); assert.equal(r.ice, 120);
});
test('Helado ignorado en métodos sin soporte (prensa)', () => {
  assert.equal(BL.computeRecipe({ method: 'prensa', dose: 20, ratio: 15, iced: true }).ice, 0);
});
test('Espresso 18 g a 1:2 = 36 g de rendimiento', () => {
  assert.equal(BL.computeRecipe({ method: 'expreso', dose: 18, ratio: 2 }).water, 36);
});
test('Ratio base replica la app original', () => {
  assert.equal(BL.baselineRatio('v60'), 15);
  assert.equal(BL.baselineRatio('chemex'), 16);
  assert.equal(BL.baselineRatio('aeropress'), 14);
  assert.equal(BL.baselineRatio('prensa', 'suave'), 18);
  assert.equal(BL.baselineRatio('prensa', 'medio'), 16);
  assert.equal(BL.baselineRatio('filtro', 'fuerte'), 13);
});

console.log('\nFases del temporizador');
test('V60: fases 0:00-0:30 bloom, 0:30-1:15, 1:15-2:30, fin 3:00', () => {
  const ph = BL.buildPhases('v60', 225);
  assert.deepEqual(plain(ph.map(p => [p.key, p.start, p.end, p.target])), [
    ['bloom', 0, 30, 45], ['pour1', 30, 75, 135], ['pour2', 75, 150, 225], ['drawdown', 150, 180, 225]
  ]);
  assert.equal(BL.totalDuration(ph), 180);
});
test('phaseAt devuelve la fase correcta y "terminado" al final', () => {
  const ph = BL.buildPhases('v60', 225);
  assert.equal(BL.phaseAt(ph, 0), 0);
  assert.equal(BL.phaseAt(ph, 29.9), 0);
  assert.equal(BL.phaseAt(ph, 30), 1);
  assert.equal(BL.phaseAt(ph, 179), 3);
  assert.equal(BL.phaseAt(ph, 180), 4);
});
test('Moka no tiene objetivo de agua', () => {
  assert.ok(BL.buildPhases('moka', 150).every(p => p.target === null));
});
test('Puntos de vertido sin repetidos', () => {
  assert.deepEqual(plain(BL.phasesToPoints(BL.buildPhases('v60', 225))), [
    { min: 0, sec: 30, ml: 45 }, { min: 1, sec: 15, ml: 135 }, { min: 2, sec: 30, ml: 225 }
  ]);
});
test('Todos los métodos con fases tienen la última fase al 100% del agua', () => {
  Object.entries(BDATA.METHODS).forEach(([k, m]) => {
    if (!m.phases || m.noWater) return;
    const last = m.phases.filter(p => p.to !== undefined).pop();
    assert.equal(last.to, 1, k);
  });
});

console.log('\nTueste y frescura');
test('Tueste claro: 1 punto más fino y +2 °C', () => {
  const a = BL.roastAdjust('v60', 'claro');
  assert.equal(a.grindIdx, 1); assert.deepEqual(plain(a.tempC), [94, 98]);
});
test('Tueste oscuro: más grueso y -4 °C', () => {
  const a = BL.roastAdjust('v60', 'oscuro');
  assert.equal(a.grindIdx, 3); assert.deepEqual(plain(a.tempC), [88, 92]);
});
test('Parseo de fechas (formatos AR e ISO)', () => {
  assert.equal(BL.parseDateFlexible('12/07/2026').getMonth(), 6);
  assert.equal(BL.parseDateFlexible('2026-07-12').getDate(), 12);
  assert.equal(BL.parseDateFlexible('31/02/2026'), null);
  assert.equal(BL.parseDateFlexible('cualquier cosa'), null);
});
test('Frescura: filtro en reposo / mejor momento / declinando', () => {
  const today = new Date(2026, 9, 29);
  assert.equal(BL.freshness('27/10/2026', 'v60', today).status, 'resting');
  assert.equal(BL.freshness('15/10/2026', 'v60', today).status, 'peak');
  assert.equal(BL.freshness('01/08/2026', 'v60', today).status, 'declining');
});
test('Frescura: el espresso pide más reposo que el filtro', () => {
  const today = new Date(2026, 9, 29);
  assert.equal(BL.freshness('24/10/2026', 'v60', today).status, 'peak');
  assert.equal(BL.freshness('24/10/2026', 'expreso', today).status, 'resting');
});

console.log('\nMotor de diagnóstico (tabla de casos)');
const cases = [
  // [descripción, input, variable esperada, dirección esperada]
  ['V60 ácido → más fino', { method: 'v60', tags: ['sour'] }, 'grind', 'finer'],
  ['V60 amargo → más grueso', { method: 'v60', tags: ['bitter'] }, 'grind', 'coarser'],
  ['V60 ácido+amargo → distribución', { method: 'v60', tags: ['sour', 'bitter'] }, 'prep', 'distribution'],
  ['Botón "ácido y amargo a la vez"', { method: 'expreso', tags: ['sourBitter'] }, 'prep', 'distribution'],
  ['Prensa ácido+amargo → parejura de molienda', { method: 'prensa', tags: ['sourBitter'] }, 'prep', 'evenness'],
  ['V60 aguado → subir dosis (fuerza)', { method: 'v60', tags: ['weak'] }, 'dose', 'up'],
  ['V60 muy fuerte → bajar dosis', { method: 'v60', tags: ['strong'] }, 'dose', 'down'],
  ['Prensa ácida → más tiempo', { method: 'prensa', tags: ['sour'] }, 'time', 'longer'],
  ['Prensa amarga → menos tiempo', { method: 'prensa', tags: ['bitter'] }, 'time', 'shorter'],
  ['Moka amarga → bajar el fuego', { method: 'moka', tags: ['bitter'] }, 'heat', 'lower'],
  ['V60 astringente → vertido más suave', { method: 'v60', tags: ['astringent'] }, 'pour', 'gentler'],
  ['Equilibrado → listo', { method: 'v60', tags: ['balanced'] }, 'done', 'none'],
  ['Sin selección → nada', { method: 'v60', tags: [] }, 'none', 'none'],
  ['Espresso: gotas tempranas → más fino', { method: 'expreso', tags: [], espresso: { dose: 18, yieldG: 36, time: 28, earlyDrops: true } }, 'grind', 'finer'],
  ['Espresso 18 s → más fino', { method: 'expreso', tags: ['bitter'], espresso: { dose: 18, yieldG: 36, time: 18 } }, 'grind', 'finer'],
  ['Espresso 40 s → más grueso', { method: 'expreso', tags: [], espresso: { dose: 18, yieldG: 36, time: 40 } }, 'grind', 'coarser'],
  ['Espresso en ventana + ácido → más rendimiento', { method: 'expreso', tags: ['sour'], espresso: { dose: 18, yieldG: 36, time: 27 } }, 'yield', 'up'],
  ['Espresso en ventana sin quejas → listo', { method: 'expreso', tags: [], espresso: { dose: 18, yieldG: 36, time: 27 } }, 'done', 'none'],
  ['Espresso aguado → menos rendimiento', { method: 'expreso', tags: ['weak'] }, 'yield', 'down'],
  ['Cold brew ácido → +2 h', { method: 'coldbrew', tags: ['sour'] }, 'time', 'longer'],
];
cases.forEach(([name, input, variable, direction]) => {
  test(name, () => {
    const r = BL.diagnose(input);
    assert.equal(r.variable, variable); assert.equal(r.direction, direction);
  });
});
test('Ácido + aguado: primero extracción, con nota de fuerza para después', () => {
  const r = BL.diagnose({ method: 'v60', tags: ['sour', 'weak'] });
  assert.equal(r.variable, 'grind'); assert.equal(r.note, 'strengthLater');
});
test('Magnitud concreta: cold brew +2 h, prensa +30 s', () => {
  assert.equal(BL.diagnose({ method: 'coldbrew', tags: ['sour'] }).amount, 2);
  assert.equal(BL.diagnose({ method: 'coldbrew', tags: ['sour'] }).unit, 'h');
  assert.equal(BL.diagnose({ method: 'prensa', tags: ['sour'] }).amount, 30);
});

console.log('\nBúsqueda convergente');
test('Cruzar de ácido a amargo reduce el paso a la mitad', () => {
  const r = BL.diagnose({ method: 'v60', tags: ['bitter'], history: [{ variable: 'grind', direction: 'finer', step: 1 }] });
  assert.equal(r.direction, 'coarser'); assert.equal(r.step, 0.5); assert.equal(r.converging, true);
});
test('Seguir en la misma dirección mantiene el paso', () => {
  const r = BL.diagnose({ method: 'v60', tags: ['sour'], history: [{ variable: 'grind', direction: 'finer', step: 0.5 }] });
  assert.equal(r.step, 0.5);
});
test('El paso nunca baja de 1/4', () => {
  const h = [{ variable: 'grind', direction: 'finer', step: 0.25 }];
  assert.equal(BL.diagnose({ method: 'v60', tags: ['bitter'], history: h }).step, 0.25);
});

console.log('\nDatos, migraciones y compartir');
test('Migración v1 → v2 conserva recetas viejas y repara campos', () => {
  const v1 = { recipes: [{ id: 1, brewer: 'v60', grind: 'Media-fina', grams: '15', points: null }, null] };
  const out = BL.migrate(v1, 1);
  assert.equal(out.version, 2); assert.equal(out.recipes.length, 1);
  assert.equal(out.recipes[0].grams, 15); assert.deepEqual(plain(out.recipes[0].points), []);
  assert.deepEqual(plain(out.log), []);
});
test('Sanitización descarta métodos desconocidos y recorta texto', () => {
  assert.equal(BL.sanitizeRecipe({ brewer: 'hack', grams: 15 }), null);
  const r = BL.sanitizeRecipe({ brewer: 'v60', grams: 15, coffeeName: 'x'.repeat(500), points: [{ min: 0, sec: 99, ml: 50 }] });
  assert.equal(r.coffeeName.length, 200); assert.equal(r.points[0].sec, 59);
});
test('Backup: rechaza archivos de otra app y acepta los propios', () => {
  assert.equal(BL.validateBackup({ app: 'otra' }).ok, false);
  const ok = BL.validateBackup({ app: 'barista-de-bolsillo', schema: 2, data: {
    recipes: [{ id: 1, brewer: 'chemex', grams: 30, points: [] }],
    log: [{ id: 2, method: 'v60', dose: 15, water: 225, rating: 4, tags: ['sour', 'xss'] }],
    lessonsRead: ['bloom', 'inexistente'] } });
  assert.equal(ok.ok, true); assert.equal(ok.data.recipes.length, 1);
  assert.equal(ok.data.log[0].ratio, 15); assert.deepEqual(plain(ok.data.log[0].tags), ['sour']);
  assert.deepEqual(plain(ok.data.lessonsRead), ['bloom']);
});
test('Compartir: ida y vuelta con acentos y emojis', () => {
  const rec = { brewer: 'v60', grind: 'Media-fina', grams: 15, points: [{ min: 0, sec: 30, ml: 45 }], coffeeName: 'Finca Ñandú ☕', ratio: 15 };
  const back = BL.decodeShare(BL.encodeShare(rec));
  assert.equal(back.coffeeName, 'Finca Ñandú ☕'); assert.equal(back.points[0].ml, 45); assert.equal(back.ratio, 15);
});
test('Compartir: código basura no rompe nada', () => {
  assert.equal(BL.decodeShare('%%%nope'), null);
  assert.equal(BL.decodeShare(''), null);
});
test('Escape de HTML (anti-XSS)', () => {
  assert.equal(BL.escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});
test('Promedio por método y mejor receta por café', () => {
  const log = [
    { method: 'v60', rating: 4, coffeeName: 'Huila', date: '2026-10-01' },
    { method: 'v60', rating: 2, coffeeName: 'huila', date: '2026-10-02' },
    { method: 'chemex', rating: 5, coffeeName: '', date: '2026-10-03' }
  ];
  const avg = plain(BL.averageByMethod(log));
  assert.deepEqual(avg[0], { method: 'chemex', avg: 5, count: 1 });
  assert.equal(avg[1].avg, 3);
  const best = BL.bestByCoffee(log);
  assert.equal(best.length, 1); assert.equal(best[0].rating, 4);
});

console.log('\nHoja de cata (rueda de sabores)');
test('Cata: sanitiza sabores, intensidad y atributos', () => {
  const c = BL.sanitizeCata({ coffeeName: 'Huila', method: 'v60',
    flavors: [{ id: 'frutilla', intensity: 20 }, { id: 'frutilla', intensity: 3 }, { id: '<script>', intensity: 5 }, { id: 'caramelo' }],
    attrs: { acidez: 12, dulzor: 7.3 }, rating: 9 });
  assert.deepEqual(plain(c.flavors), [{ id: 'frutilla', intensity: 15 }, { id: 'caramelo', intensity: 8 }]);
  assert.equal(c.attrs.acidez, 10); assert.equal(c.attrs.dulzor, 7.5); assert.equal(c.attrs.cuerpo, 5);
  assert.equal(c.rating, 5); assert.equal(c.method, 'v60');
});
test('Cata: método desconocido queda vacío', () => {
  assert.equal(BL.sanitizeCata({ method: 'hack' }).method, '');
});
test('Backup incluye las catas', () => {
  const r = BL.validateBackup({ app: 'barista-de-bolsillo', schema: 2, data: { recipes: [], log: [], catas: [{ id: 5, flavors: [{ id: 'miel', intensity: 6 }] }, 'basura'] } });
  assert.equal(r.data.catas.length, 1); assert.equal(r.data.catas[0].flavors[0].id, 'miel');
});

console.log(`\n${passed} OK · ${failed} fallaron\n`);
process.exit(failed ? 1 : 0);
