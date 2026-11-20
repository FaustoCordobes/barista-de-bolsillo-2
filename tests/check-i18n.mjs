// Verifica que los 3 idiomas (ES/EN/PT) tengan exactamente las mismas claves
// y que toda clave usada en el código exista. Uso: node tests/check-i18n.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const appJs = readFileSync(join(root, 'js/app.js'), 'utf8');
const features = readFileSync(join(root, 'js/features.js'), 'utf8') + '\n' + readFileSync(join(root, 'js/wheel.js'), 'utf8');

const ctx = vm.createContext({});
// I18N original (script principal js/app.js)
const start = appJs.indexOf('const I18N = {');
const end = appJs.indexOf('let currentLang', start);
vm.runInContext(appJs.slice(start, end) + '\nthis.__I18N = I18N;', ctx);
vm.runInContext(readFileSync(join(root, 'js/data.js'), 'utf8') + '\nthis.__BDATA = BDATA;', ctx);
vm.runInContext(readFileSync(join(root, 'js/i18n-ext.js'), 'utf8') + '\nthis.__EXT = I18N_EXT;', ctx);
const I18N = ctx.__I18N, EXT = ctx.__EXT, BDATA = ctx.__BDATA;

// Fusión igual que en la app
for (const lang of ['es', 'en', 'pt']) {
  for (const section of ['ui', 'brewerNames', 'brewerSubs', 'tips', 'steps', 'time', 'grindInfo']) {
    I18N[lang][section] = Object.assign({}, I18N[lang][section] || {}, EXT[lang][section] || {});
  }
}

const problems = [];
const LANGS = ['es', 'en', 'pt'];

// 1) Mismas claves en los 3 idiomas, sección por sección
for (const section of ['ui', 'brewerNames', 'brewerSubs', 'steps', 'time', 'grindInfo']) {
  const all = new Set(LANGS.flatMap(l => Object.keys(I18N[l][section] || {})));
  for (const key of all) for (const l of LANGS) {
    if (!(key in (I18N[l][section] || {}))) problems.push(`[${l}] falta ${section}.${key}`);
  }
}
// Mismo número de pasos por método en cada idioma
for (const m of Object.keys(I18N.es.steps)) {
  const n = I18N.es.steps[m].length;
  for (const l of LANGS) if (I18N[l].steps[m] && I18N[l].steps[m].length !== n) problems.push(`[${l}] steps.${m} tiene ${I18N[l].steps[m].length} pasos (es: ${n})`);
}

// 2) Todo método tiene nombre, descripción, tiempo y pasos o tips
for (const m of Object.keys(BDATA.METHODS)) for (const l of LANGS) {
  if (!I18N[l].brewerNames[m]) problems.push(`[${l}] falta brewerNames.${m}`);
  if (!I18N[l].brewerSubs[m]) problems.push(`[${l}] falta brewerSubs.${m}`);
  if (!I18N[l].time[m]) problems.push(`[${l}] falta time.${m}`);
  if (!I18N[l].grindInfo[m]) problems.push(`[${l}] falta grindInfo.${m}`);
  if (!I18N[l].steps[m] && !I18N[l].tips[m]) problems.push(`[${l}] ${m} no tiene ni pasos ni tips`);
}

// 3) Claves usadas en el código (literales + familias dinámicas)
const used = new Set();
for (const src of [html, appJs, features]) {
  for (const m of src.matchAll(/\bt\('([A-Za-z0-9_]+)'\s*[,)]/g)) used.add(m[1]);
  for (const m of src.matchAll(/data-i18n(?:-ph|-aria)?="([A-Za-z0-9_]+)"/g)) used.add(m[1]);
}
// Literales dentro de ternarios: t(cond ? 'a' : 'b')
for (const m of features.matchAll(/\bt\(([^()]*\?[^()]*)\)/g)) for (const k of m[1].split('?').slice(1).join('?').matchAll(/'([A-Za-z][A-Za-z0-9_]+)'/g)) used.add(k[1]);
const phaseKeys = new Set(Object.values(BDATA.METHODS).flatMap(m => (m.phases || []).map(p => p.key)));
phaseKeys.forEach(k => { used.add(`phase_${k}_name`); used.add(`phase_${k}_hint`); });
['claro', 'medio', 'oscuro'].forEach(r => { used.add('roast_' + r); used.add('roastWhy_' + r); used.add('roastLower_' + r); });
['sour', 'bitter', 'weak', 'strong', 'astringent', 'sourBitter', 'balanced'].forEach(x => used.add('taste_' + x));
['grind_finer', 'grind_coarser', 'time_longer', 'time_shorter', 'yield_up', 'yield_down', 'dose_up', 'dose_down',
 'prep_distribution', 'prep_evenness', 'heat_lower', 'pour_gentler'].forEach(k => ['dx_', 'dxw_', 'dxh_'].forEach(p => used.add(p + k)));
['resting', 'peak', 'declining', 'future'].forEach(s => used.add('fresh_' + s));
['early', 'fast', 'slow', 'window'].forEach(s => used.add('espVerdict_' + s));
Object.keys(BDATA.RECIPE_RECOMMENDATIONS).forEach(o => { used.add('origin_' + o); used.add('originWhy_' + o); });
['amtPoint1', 'amtPointHalf', 'amtPointQuarter'].forEach(k => used.add(k));

for (const key of used) for (const l of LANGS) {
  if (!(key in I18N[l].ui)) problems.push(`[${l}] clave usada pero no definida: ui.${key}`);
}

// 4) Contenido de lecciones y glosario en los 3 idiomas
for (const lesson of BDATA.LESSONS) for (const l of LANGS) {
  if (!lesson.title[l] || !lesson.content[l]) problems.push(`[${l}] lección ${lesson.id} incompleta`);
}
for (const g of BDATA.GLOSSARY) for (const l of LANGS) {
  if (!g.term[l] || !g.def[l]) problems.push(`[${l}] glosario ${g.term.es} incompleto`);
}

// 5) Rueda de sabores: ids únicos y textos en los 3 idiomas
vm.runInContext(readFileSync(join(root, 'js/flavors.js'), 'utf8') + '\nthis.__RAW = FLAVOR_WHEEL_RAW; this.__FW = FLAVOR_WHEEL;', ctx);
const RAW = ctx.__RAW, FW = ctx.__FW;
const ids = [];
RAW.forEach(c => { ids.push(c.id); c.children.forEach(f => { ids.push(f.id); f.children.forEach(l => ids.push(l[0])); }); });
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) problems.push('rueda: ids repetidos ' + dupes.join(', '));
for (const n of Object.values(FW.byId)) for (const l of LANGS) {
  if (!n.name[l]) problems.push(`[${l}] rueda: falta nombre de ${n.id}`);
  if (n.depth < 3 && !n.desc[l]) problems.push(`[${l}] rueda: falta descripción de ${n.id}`);
  if (n.depth === 3 && !n.tip[l]) problems.push(`[${l}] rueda: falta "cómo reconocerlo" de ${n.id}`);
}
['fragancia', 'aroma', 'acidez', 'dulzor', 'cuerpo', 'amargor', 'retrogusto', 'balance'].forEach(a => {
  for (const l of LANGS) if (!I18N[l].ui['attr_' + a]) problems.push(`[${l}] falta ui.attr_${a}`);
});

if (problems.length) {
  console.log(`✗ ${problems.length} problema(s) de traducción:\n  ` + problems.join('\n  '));
  process.exit(1);
}
console.log(`✓ i18n OK: ${used.size} claves usadas, ${Object.keys(I18N.es.ui).length} claves de UI por idioma, rueda con ${FW.leaves.length} sabores, 3 idiomas completos.`);
