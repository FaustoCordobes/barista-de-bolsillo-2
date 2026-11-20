# ☕ Barista de Bolsillo — v2

PWA para preparar café de especialidad: recetas por método, temporizador paso a paso,
diagnóstico de sabor (dial-in), bitácora, mini-academia. HTML + CSS + JavaScript puro,
**sin build ni dependencias**. Se publica tal cual en Vercel (sitio estático).

## Estructura

```
index.html            Markup + estilos (tokens de color por tema). Sin JS inline salvo el anti-parpadeo de tema/idioma.
manifest.json         Manifest de la PWA (instalable)
sw.js                 Service worker: offline + estrategia de caché (ver comentarios del archivo)
icon-*.png            Íconos de la PWA (192, 512 y maskable)
img/                  Ilustraciones de los métodos (antes estaban en base64 dentro del HTML)
js/data.js            DATOS EDITABLES: métodos, fases, ratios, tueste, frescura, recomendador, lecciones, glosario
js/flavors.js         DATOS EDITABLES: rueda de sabores (9 categorías → 21 familias → 93 sabores, ES/EN/PT)
js/i18n-ext.js        Textos nuevos en ES / EN / PT
js/logic.js           Lógica pura y testeable: cálculos, fases, motor de diagnóstico, validación, migraciones, compartir
js/app.js             Flujo original de 5 pasos (el script que estaba dentro de index.html), adaptado
js/wheel.js           Rueda de sabores interactiva (SVG) + hoja de cata + Mis catas
js/features.js        UI nueva: receta dinámica, paso a paso, cold brew, dial-in, bitácora, Aprendé, recomendador, backup
tests/logic.test.mjs  48 tests unitarios (cálculos, escalado, fases, motor de reglas, migraciones, compartir)
tests/check-i18n.mjs  Verifica que los 3 idiomas estén completos y que no falte ninguna clave usada
```

Orden de carga (todos `defer`): `data.js → flavors.js → i18n-ext.js → logic.js → app.js → wheel.js → features.js`.

## Probar localmente

```bash
python3 -m http.server 8080      # o: npx serve .
# abrir http://localhost:8080
node tests/logic.test.mjs         # tests de lógica
node tests/check-i18n.mjs         # traducciones completas
```

> El service worker solo funciona en `localhost` o HTTPS.

## Qué hay de nuevo

| Función | Dónde |
|---|---|
| Receta dinámica: dosis (stepper + chips), ratio dentro de un rango, tueste claro/medio/oscuro (temperatura y molienda), versión helada | Paso 4 |
| **Preparar paso a paso**: fases con agua objetivo acumulada, cuenta regresiva por fase, barra de progreso, ⏮ ⏯ ⏭, aviso de la próxima fase, destello + sonido + vibración al cambiar de fase | Paso 4 → ▶ |
| Cronómetros precisos (por reloj, no se desfasan en segundo plano), Wake Lock, aviso en cada punto del cronograma | Todos los cronómetros |
| **¿Cómo te salió?**: grilla de 2 ejes + botones rápidos, motor de reglas determinista, una sola recomendación con magnitud concreta, búsqueda convergente (paso a la mitad al cruzar), espresso avanzado (dosis/rendimiento/tiempo) | Paso 4, final del paso a paso, bitácora |
| **Mi bitácora**: fecha, método, café, dosis, agua, ratio, tiempo, molienda visual + clics del molino, estrellas, sabor, notas; filtros, promedio por método, mejor receta por café, repetir, diagnosticar, borrar con deshacer | Inicio |
| **Aprendé**: 8 lecciones + glosario con búsqueda, progreso de lectura, enlazadas desde el diagnóstico y los pasos | Inicio |
| **Recomendame una receta**: origen × tueste → método, ratio, molienda y temperatura | Inicio |
| Nuevos métodos: Kalita Wave, Clever Dripper, Cold brew (con recordatorio de 12–18 h) | Paso 1 |
| Frescura del café según fecha de tueste (en reposo / mejor momento / declinando, distinta para espresso y filtro) | Perfil sensorial, bitácora, recetas |
| Compartir receta por link (sin backend) | Mi café ideal → ↗ |
| Usar una receta guardada en 2 toques | Mi café ideal → ▶ |
| **Rueda de sabores y cata** (v2.1): rueda interactiva de 3 anillos con zoom, ficha de cada sabor (qué es, cómo reconocerlo, intensidad 1–15), buscador, pantalla completa y teclado; hoja de cata con 8 atributos, gráfico radar, puntaje y notas; Mis catas (editar, borrar con deshacer); opción de guardarla también en la bitácora | Inicio (debajo de Mi café ideal) y Paso 4 → Perfil sensorial |
| Exportar / importar copia de seguridad (JSON validado, incluye catas) | ⚙️ Ajustes |
| Sonido (volumen), vibración, pantalla encendida, °C/°F | ⚙️ Ajustes |

## Bugs corregidos de la versión anterior

- **PWA rota:** el HTML pedía `manifest.json`, `sw.js` e `icon-192.png`, que no estaban en el repo.
- **Inglés / portugués:** "Sobre este café", "Nombre", "Origen" y "Fecha de tueste" se mostraban como `undefined`.
- **Espresso:** calculaba 3,8 g de café. Ahora 18 g → 36 g en taza (1:2).
- **Moka:** calculaba 9,4 g para 150 ml. Ahora ~1:10, guiada por la cámara. Además estaba marcada como molienda "muy fina", más fina que el espresso.
- **Cronómetro:** contaba ticks de `setInterval` y se atrasaba con el celular bloqueado.
- **Seguridad:** el texto del usuario se insertaba con `innerHTML` sin escapar (XSS).
- **Modo claro:** quedaban colores fijos de los temas oscuros, con contraste insuficiente.
- **Cambiar de idioma** borraba lo que habías escrito en el perfil sensorial.
- **Pasos de V60 / Chemex / AeroPress:** tenían los gramos escritos a mano y no se escalaban.
- **Recetas:** se borraban sin confirmación y no se podía deshacer.
- **Etiquetas fijas en español:** "En / seg →" del cronograma y el selector de cafetera de "Mi café ideal" no se traducían.
- **Teclado:** las opciones de tamaño, intensidad y molienda no se podían usar.

## Datos guardados y migración

Todo queda en `localStorage`, sin cuentas. Claves:

| Clave | Contenido |
|---|---|
| `baristaSavedRecipes` | Mi café ideal (la **misma clave de antes**: no se pierde nada) |
| `baristaLog` | Bitácora |
| `baristaLessonsRead` | Lecciones leídas |
| `baristaPrefs` | Ajustes |
| `baristaDialIn` | Historial de ajustes por método |
| `baristaColdBrew` | Infusión en curso |
| `baristaCatas` | Hojas de cata (rueda de sabores) |
| `baristaSchemaVersion` | Versión del esquema (2) |

`BL.migrate()` (en `js/logic.js`) pasa los datos de v1 a v2 sin borrar nada. Para un cambio futuro: subí `SCHEMA_VERSION` y agregá un bloque `if (v < 3) {...}`.

## Cómo extender

**Agregar un método** (ej. "Origami"):
1. `js/data.js` → `METHODS.origami = { family, grind, tempC, ratio, doseChips, phases }` y `FIXED_ML.origami`.
2. `js/i18n-ext.js` → en los 3 idiomas: `brewerNames`, `brewerSubs`, `grindInfo`, `steps` (o `tips`), `time`. Si usa una fase nueva: `phase_<key>_name` y `phase_<key>_hint`.
3. `index.html` → una tarjeta `<button class="brewer-card" data-brewer="origami" onclick="selectBrewer('origami')">`.
4. `js/app.js` → agregalo a `FIXED_RECIPE_BREWERS`, salvo que quieras que pase por la pantalla de taza e intensidad.
5. `node tests/check-i18n.mjs` te avisa si falta algo.

**Agregar una regla de diagnóstico:** editá `diagnose()` en `js/logic.js` (cada regla devuelve `make(variable, dirección)`). Agregá los textos `dx_`, `dxw_` y `dxh_<variable>_<dirección>` en los 3 idiomas y un caso en la tabla de `tests/logic.test.mjs`.

**Agregar un idioma:** sumá el bloque completo en el `I18N` de `js/app.js` y en `I18N_EXT` (`js/i18n-ext.js`). Después agregá el botón en Ajustes y el código en `check-i18n.mjs`.

**Agregar un sabor a la rueda:** en `js/flavors.js`, sumá `['id', 'Nombre ES', 'Name EN', 'Nome PT', 'tip ES', 'tip EN', 'tip PT']` dentro de la familia que corresponda. El ancho de cada sector se calcula solo.

**Agregar una lección:** un objeto más en `LESSONS` (`js/data.js`), con `title` y `content` en ES / EN / PT.

## Publicar en Vercel

Subí **todos** los archivos y carpetas (no solo `index.html`). Cuando cambies JS o CSS, subí `VERSION` en `sw.js` para que los usuarios reciban la versión nueva. El HTML ya usa network-first, así que llega igual con conexión.

## Calidad (medido en local, Chromium, 360 px)

- Lighthouse mobile. Original: Performance 86, Accesibilidad 100, Buenas prácticas 93. **v2: 87 / 100 / 96** (primer contenido visible 3,0 s → 2,1 s). Se midió con un servidor local sin compresión; en Vercel, con gzip/brotli, debería dar mejor.
- axe-core (WCAG 2 A/AA): 0 violaciones en las pantallas principales, tanto en tema oscuro como claro.
- Recorrido E2E automatizado: 82/82 checks (flujos, migración, XSS, offline, idiomas, teclado) + 43/43 de la rueda y la hoja de cata.
- Tests unitarios: 51/51.

## Pendiente / ideas para la próxima fase

- QR para compartir recetas (hoy es solo link; un QR necesita una librería de ~10 KB).
- Unidades oz / fl oz (hoy solo °C/°F).
- Bebidas con leche (latte, cappuccino, flat white).
- Calculadora de agua (dureza / mineralización).
- Calibración del molino: convertir categorías de molienda a clics (hoy los clics se registran a mano).
- Fase 5 (requiere backend): cuentas, sincronización, recetas de la comunidad y notificaciones push reales para cold brew. Hoy el aviso funciona solo con la app abierta.
- Simulador de "escanear bolsa": lo dejé afuera a propósito. Mostrar datos inventados como si se hubieran leído de la etiqueta confunde al usuario. Conviene hacerlo con OCR real.
