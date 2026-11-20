/* =====================================================================
 * Barista de Bolsillo — DATOS EDITABLES
 * ---------------------------------------------------------------------
 * Todo el conocimiento cafetero vive acá, separado de la lógica y la UI.
 * Los valores son PUNTOS DE PARTIDA (baseline), no verdades absolutas:
 * la app siempre deja ajustarlos.
 *
 * Índices de molienda (grind): 0 Muy fina · 1 Fina · 2 Media-fina ·
 *                              3 Media · 4 Media-gruesa · 5 Gruesa
 *
 * Fases (phases): { key, dur (segundos), to (fracción ACUMULADA del agua total) }
 *   - "key" se traduce con phase_<key>_name / phase_<key>_hint en i18n-ext.js
 *   - Si el método tiene noWater:true, no se muestra objetivo de agua.
 * ===================================================================== */
const BDATA = (function () {

  const METHODS = {
    prensa: {
      family: 'immersion', grind: 5, tempC: [92, 96],
      ratio: { min: 12, max: 18, step: 0.5 },          // el default sale de la intensidad elegida
      doseChips: [15, 20, 25, 30],
      phases: [
        { key: 'pourAll', dur: 30, to: 1 },
        { key: 'steep', dur: 210, to: 1 },
        { key: 'press', dur: 20, to: 1 }
      ]
    },
    expreso: {
      family: 'espresso', grind: 1, tempC: [90, 94],
      // En espresso el "ratio" es dosis : rendimiento (g de café molido : g de bebida)
      ratio: { def: 2, min: 1.5, max: 3, step: 0.1 },
      dose: { def: 18, min: 7, max: 24 },
      doseChips: [14, 16, 18, 20],
      windowSec: [25, 30],
      phases: [
        { key: 'preinfusion', dur: 6, to: 0.05 },
        { key: 'extraction', dur: 22, to: 1 }
      ]
    },
    moka: {
      family: 'moka', grind: 2, tempC: null, lockRatio: true, noWater: true,
      // La moka se guía por el volumen de su cámara: no hay ratio libre.
      ratio: { def: 10, min: 10, max: 10, step: 0 },
      phases: [
        { key: 'heat', dur: 180 },
        { key: 'flow', dur: 60 },
        { key: 'remove', dur: 10 }
      ]
    },
    filtro: {
      family: 'percolation', grind: 3, tempC: [92, 96],
      ratio: { min: 14, max: 18, step: 0.5 },
      doseChips: [12, 18, 24, 30],
      phases: [
        { key: 'bloom', dur: 30, to: 0.15 },
        { key: 'pourMain', dur: 90, to: 1 },
        { key: 'drawdown', dur: 90, to: 1 }
      ]
    },
    v60: {
      family: 'percolation', grind: 2, tempC: [92, 96], iced: true,
      ratio: { def: 15, min: 14, max: 17, step: 0.5 },
      doseChips: [12, 15, 18, 20],
      phases: [
        { key: 'bloom', dur: 30, to: 0.2 },     // 0:00–0:30
        { key: 'pour1', dur: 45, to: 0.6 },     // 0:30–1:15
        { key: 'pour2', dur: 75, to: 1 },       // 1:15–2:30
        { key: 'drawdown', dur: 30, to: 1 }     // 2:30–3:00
      ]
    },
    chemex: {
      family: 'percolation', grind: 4, tempC: [93, 96], iced: true,
      ratio: { def: 16, min: 15, max: 17, step: 0.5 },
      doseChips: [20, 25, 30, 40],
      phases: [
        { key: 'bloom', dur: 45, to: 0.16 },
        { key: 'pour1', dur: 45, to: 0.5 },
        { key: 'pour2', dur: 60, to: 1 },
        { key: 'drawdown', dur: 90, to: 1 }
      ]
    },
    aeropress: {
      family: 'immersion', grind: 3, tempC: [85, 92],
      ratio: { def: 14, min: 11, max: 16, step: 0.5 },
      doseChips: [12, 15, 17, 20],
      phases: [
        { key: 'pourBloom', dur: 10, to: 0.24 },
        { key: 'stir', dur: 10, to: 0.24 },
        { key: 'rest', dur: 20, to: 0.24 },
        { key: 'fill', dur: 15, to: 1 },
        { key: 'steep', dur: 25, to: 1 },
        { key: 'flipPress', dur: 30, to: 1 }
      ]
    },
    kalita: {
      family: 'percolation', grind: 3, tempC: [92, 96], iced: true,
      ratio: { def: 15, min: 14, max: 17, step: 0.5 },
      doseChips: [15, 18, 20, 25],
      phases: [
        { key: 'bloom', dur: 40, to: 0.17 },
        { key: 'pour1', dur: 30, to: 0.45 },
        { key: 'pour2', dur: 30, to: 0.7 },
        { key: 'pour3', dur: 30, to: 1 },
        { key: 'drawdown', dur: 80, to: 1 }
      ]
    },
    clever: {
      family: 'immersion', grind: 3, tempC: [92, 96],
      ratio: { def: 16, min: 14, max: 17, step: 0.5 },
      doseChips: [12, 15, 18, 22],
      phases: [
        { key: 'pourAll', dur: 15, to: 1 },
        { key: 'steep', dur: 105, to: 1 },
        { key: 'stir', dur: 10, to: 1 },
        { key: 'drain', dur: 60, to: 1 }
      ]
    },
    coldbrew: {
      family: 'coldbrew', grind: 5, tempC: null,
      // concentrado ≈ 1:5 (se diluye 1:1) · listo para tomar ≈ 1:8
      ratio: { def: 8, min: 4, max: 12, step: 0.5 },
      variants: { concentrate: 5, rtd: 8 },
      doseChips: [50, 60, 100, 125],
      steepHours: [12, 18]
    }
  };

  // Volumen base (ml) de los métodos con receta fija. Para espresso es el RENDIMIENTO en g.
  const FIXED_ML = { expreso: 36, moka: 150, v60: 225, chemex: 480, aeropress: 210, kalita: 300, clever: 240, coldbrew: 500 };

  // Ajuste por nivel de tueste (sobre la base del método)
  // tempDelta: °C · grindShift: -1 = un punto más fina, +1 = más gruesa
  const ROAST_ADJUST = {
    claro:  { tempDelta: +2, grindShift: -1 },
    medio:  { tempDelta: 0,  grindShift: 0 },
    oscuro: { tempDelta: -4, grindShift: +1 }
  };

  // Ventanas de frescura en días desde el tueste (orientativas, configurables)
  // [hasta acá "en reposo", hasta acá "en su mejor momento"] → después "declinando"
  const FRESHNESS = {
    espresso:    [7, 35],
    percolation: [4, 30],
    immersion:   [3, 30],
    moka:        [5, 30],
    coldbrew:    [3, 45]
  };

  // Recomendador: recipeRecommendations[origen][tueste] = { method, ratio, grind, tempC }
  const RECIPE_RECOMMENDATIONS = {
    etiopia:   { claro: { method: 'v60', ratio: 16, grind: 2, tempC: 95 },
                 medio: { method: 'chemex', ratio: 16, grind: 4, tempC: 94 },
                 oscuro: { method: 'aeropress', ratio: 14, grind: 3, tempC: 88 } },
    kenia:     { claro: { method: 'v60', ratio: 16, grind: 2, tempC: 95 },
                 medio: { method: 'kalita', ratio: 15, grind: 3, tempC: 94 },
                 oscuro: { method: 'prensa', ratio: 15, grind: 5, tempC: 92 } },
    colombia:  { claro: { method: 'kalita', ratio: 16, grind: 3, tempC: 94 },
                 medio: { method: 'v60', ratio: 15, grind: 2, tempC: 93 },
                 oscuro: { method: 'moka', ratio: 10, grind: 2, tempC: null } },
    brasil:    { claro: { method: 'aeropress', ratio: 14, grind: 3, tempC: 92 },
                 medio: { method: 'prensa', ratio: 15, grind: 5, tempC: 93 },
                 oscuro: { method: 'expreso', ratio: 2, grind: 1, tempC: 90 } },
    guatemala: { claro: { method: 'chemex', ratio: 16, grind: 4, tempC: 95 },
                 medio: { method: 'aeropress', ratio: 14, grind: 3, tempC: 90 },
                 oscuro: { method: 'expreso', ratio: 2, grind: 1, tempC: 91 } },
    peru:      { claro: { method: 'v60', ratio: 16, grind: 2, tempC: 94 },
                 medio: { method: 'clever', ratio: 16, grind: 3, tempC: 93 },
                 oscuro: { method: 'prensa', ratio: 14, grind: 5, tempC: 91 } },
    blend:     { claro: { method: 'kalita', ratio: 16, grind: 3, tempC: 94 },
                 medio: { method: 'filtro', ratio: 16, grind: 3, tempC: 93 },
                 oscuro: { method: 'moka', ratio: 10, grind: 2, tempC: null } }
  };

  // Lección sugerida para cada tipo de ajuste del diagnóstico
  const LESSON_FOR = {
    grind: 'molienda', time: 'extraccion', yield: 'ratio', dose: 'extraccion',
    prep: 'canalizacion', heat: 'extraccion', pour: 'bloom', temp: 'agua'
  };

  /* -------- Micro-academia: lecciones cortas (ES / EN / PT) --------
   * Formato del contenido: párrafos separados por línea en blanco,
   * **negrita** y líneas que empiezan con "- " para listas.          */
  const LESSONS = [
    { id: 'grano', icon: '🍒', min: 2,
      title: { es: 'Anatomía del grano: de la cereza a la taza', en: 'Bean anatomy: from cherry to cup', pt: 'Anatomia do grão: da cereja à xícara' },
      content: {
        es: 'El café es la **semilla de un fruto**: la cereza del cafeto. Cada cereza suele tener dos semillas enfrentadas, cubiertas por pulpa, mucílago (una capa azucarada y pegajosa) y un pergamino fino.\n\nDespués de la cosecha, el fruto se **procesa** para sacar la semilla. El proceso cambia muchísimo el sabor:\n\n- **Lavado:** se quita la pulpa y se fermenta en agua. Taza limpia, acidez brillante.\n- **Natural:** la cereza se seca entera al sol. Más dulzor, cuerpo y notas a fruta madura.\n- **Honey:** se seca con parte del mucílago. Un punto medio entre los dos.\n\nEl grano verde viaja hasta un tostador, que lo transforma con calor: ahí aparecen los aromas y los azúcares se caramelizan. Un **tueste claro** conserva más el carácter del origen (frutas, flores); uno **oscuro** suma notas tostadas, chocolate y amargor.\n\nPor eso dos cafés de la misma variedad pueden saber completamente distinto: el origen, el proceso y el tueste son la "receta" previa a tu receta.',
        en: 'Coffee is the **seed of a fruit**: the coffee cherry. Each cherry usually holds two seeds facing each other, wrapped in pulp, mucilage (a sticky, sugary layer) and a thin parchment.\n\nAfter harvest, the fruit is **processed** to remove the seed. Processing changes flavor a lot:\n\n- **Washed:** pulp is removed and the seeds ferment in water. Clean cup, bright acidity.\n- **Natural:** the whole cherry dries in the sun. More sweetness, body and ripe-fruit notes.\n- **Honey:** dried with part of the mucilage. A middle ground between both.\n\nGreen coffee travels to a roaster, where heat transforms it: aromas develop and sugars caramelize. A **light roast** keeps more of the origin character (fruit, flowers); a **dark roast** adds toasty notes, chocolate and bitterness.\n\nThat is why two coffees of the same variety can taste completely different: origin, process and roast are the "recipe" before your recipe.',
        pt: 'O café é a **semente de um fruto**: a cereja do cafeeiro. Cada cereja costuma ter duas sementes frente a frente, cobertas por polpa, mucilagem (uma camada açucarada e pegajosa) e um pergaminho fino.\n\nDepois da colheita, o fruto é **processado** para tirar a semente. O processo muda muito o sabor:\n\n- **Lavado:** tira-se a polpa e fermenta-se na água. Xícara limpa, acidez brilhante.\n- **Natural:** a cereja seca inteira ao sol. Mais doçura, corpo e notas de fruta madura.\n- **Honey:** seca com parte da mucilagem. Um meio-termo entre os dois.\n\nO grão verde vai até o torrador, que o transforma com calor: surgem os aromas e os açúcares caramelizam. Uma **torra clara** preserva mais o caráter da origem (frutas, flores); uma **escura** soma notas tostadas, chocolate e amargor.\n\nPor isso dois cafés da mesma variedade podem ter sabores completamente diferentes: origem, processo e torra são a "receita" antes da sua receita.'
      } },
    { id: 'molienda', icon: '⚙️', min: 2,
      title: { es: 'La molienda: el ajuste más importante', en: 'Grind: the most important setting', pt: 'A moagem: o ajuste mais importante' },
      content: {
        es: 'Moler el café es **abrirle la puerta al agua**. Cuanto más fino, más superficie de contacto y más rápido se extraen los sabores.\n\nPor eso cada método pide una molienda distinta: el espresso dura 25-30 segundos y necesita una molienda **fina**; la prensa francesa infusiona 4 minutos y pide una **gruesa**. Si usás molienda de espresso en una prensa, el café se sobreextrae y queda amargo y barroso.\n\nLa regla de oro para ajustar:\n\n- **Sabe ácido o agrio, y salió rápido →** molé más fino.\n- **Sabe amargo, seco, y tardó de más →** molé más grueso.\n\nCambiá **una sola cosa por vez**. Si tocás la molienda y la dosis al mismo tiempo, no vas a saber qué mejoró tu café.\n\nTambién importa la **parejura**: un molino de muelas (fresas) da partículas más uniformes que uno de cuchillas. Si tenés molino de cuchillas, molé en pulsos cortos y sacudí entre pulso y pulso.\n\nY molé justo antes de preparar: el café molido pierde aroma en minutos.',
        en: 'Grinding coffee **opens the door to water**. The finer the grind, the more contact surface and the faster flavors extract.\n\nThat is why each method needs a different grind: espresso lasts 25-30 seconds and needs a **fine** grind; a French press steeps for 4 minutes and needs a **coarse** one. Use espresso grind in a press and it over-extracts: bitter and muddy.\n\nThe golden rule for adjusting:\n\n- **Tastes sour and ran fast →** grind finer.\n- **Tastes bitter, dry, and took too long →** grind coarser.\n\nChange **one thing at a time**. If you change grind and dose together, you will not know what improved your coffee.\n\n**Evenness** matters too: a burr grinder gives more uniform particles than a blade grinder. With a blade grinder, use short pulses and shake between them.\n\nAnd grind right before brewing: ground coffee loses aroma within minutes.',
        pt: 'Moer o café é **abrir a porta para a água**. Quanto mais fino, mais superfície de contato e mais rápido os sabores são extraídos.\n\nPor isso cada método pede uma moagem diferente: o espresso dura 25-30 segundos e precisa de moagem **fina**; a prensa francesa fica 4 minutos em infusão e pede uma **grossa**. Se você usar moagem de espresso na prensa, o café sobre-extrai e fica amargo e barrento.\n\nA regra de ouro para ajustar:\n\n- **Está ácido ou azedo, e saiu rápido →** moa mais fino.\n- **Está amargo, seco, e demorou demais →** moa mais grosso.\n\nMude **uma coisa por vez**. Se mexer na moagem e na dose ao mesmo tempo, não vai saber o que melhorou seu café.\n\nA **uniformidade** também importa: um moedor de mós dá partículas mais parelhas que um de lâminas. Se o seu é de lâminas, moa em pulsos curtos e sacuda entre eles.\n\nE moa logo antes de preparar: o café moído perde aroma em minutos.'
      } },
    { id: 'ratio', icon: '⚖️', min: 2,
      title: { es: 'El ratio café-agua: por qué 1:16 es un buen punto de partida', en: 'Coffee-to-water ratio: why 1:16 is a good starting point', pt: 'A proporção café-água: por que 1:16 é um bom ponto de partida' },
      content: {
        es: 'El **ratio** dice cuánta agua usás por cada gramo de café. "1:16" significa 1 g de café cada 16 g (o ml) de agua: para 15 g de café, 240 ml.\n\n¿Por qué 1:16? Porque en filtrados es una zona donde la mayoría de los cafés quedan **equilibrados**: ni aguados ni pesados. Es un punto de partida, no una ley.\n\n- **1:13 a 1:15:** más intenso y con más cuerpo.\n- **1:16 a 1:17:** clásico de filtrado, limpio y balanceado.\n- **1:18 o más:** liviano, tipo té.\n\nEn **espresso** se habla distinto: dosis contra **rendimiento** (gramos de bebida en la taza). 18 g de café que dan 36 g de bebida es un ratio 1:2.\n\nOjo con una confusión común: el ratio controla sobre todo la **fuerza** (qué tan concentrado está), no la **extracción** (qué sabores sacaste). Si tu café está agrio, cambiar el ratio no lo arregla: eso se corrige con molienda o tiempo.\n\nPesá con balanza si podés. Una cucharada de café puede variar ±30% según el tueste y la molienda.',
        en: 'The **ratio** tells you how much water you use for each gram of coffee. "1:16" means 1 g of coffee per 16 g (or ml) of water: for 15 g of coffee, 240 ml.\n\nWhy 1:16? Because for filter coffee it is a range where most coffees taste **balanced**: neither watery nor heavy. It is a starting point, not a law.\n\n- **1:13 to 1:15:** more intense, more body.\n- **1:16 to 1:17:** classic filter, clean and balanced.\n- **1:18 or more:** light, tea-like.\n\n**Espresso** is described differently: dose versus **yield** (grams of drink in the cup). 18 g of coffee giving 36 g of drink is a 1:2 ratio.\n\nWatch out for a common mix-up: ratio mainly controls **strength** (how concentrated it is), not **extraction** (which flavors you pulled out). If your coffee is sour, changing the ratio will not fix it: that is fixed with grind or time.\n\nUse a scale if you can. A spoonful of coffee can vary ±30% depending on roast and grind.',
        pt: 'A **proporção** diz quanta água você usa para cada grama de café. "1:16" significa 1 g de café a cada 16 g (ou ml) de água: para 15 g de café, 240 ml.\n\nPor que 1:16? Porque nos filtrados é uma faixa em que a maioria dos cafés fica **equilibrada**: nem aguada nem pesada. É um ponto de partida, não uma lei.\n\n- **1:13 a 1:15:** mais intenso e encorpado.\n- **1:16 a 1:17:** clássico de filtrado, limpo e equilibrado.\n- **1:18 ou mais:** leve, tipo chá.\n\nNo **espresso** se fala diferente: dose contra **rendimento** (gramas de bebida na xícara). 18 g de café que dão 36 g de bebida é uma proporção 1:2.\n\nCuidado com uma confusão comum: a proporção controla sobretudo a **força** (o quão concentrado está), não a **extração** (quais sabores você tirou). Se o café está azedo, mudar a proporção não resolve: isso se corrige com moagem ou tempo.\n\nUse balança se puder. Uma colher de café pode variar ±30% conforme a torra e a moagem.'
      } },
    { id: 'frescura', icon: '📅', min: 2,
      title: { es: 'La frescura del café: la fecha de tueste lo es todo', en: 'Coffee freshness: roast date is everything', pt: 'O frescor do café: a data de torra é tudo' },
      content: {
        es: 'El café tostado es un producto fresco. Después del tueste libera **CO₂** durante días y, al mismo tiempo, empieza a perder aromas por oxidación.\n\nPor eso buscá siempre la **fecha de tueste** en el paquete (no la de vencimiento, que puede ser de un año y no dice nada).\n\nUna guía orientativa, que cambia según el café y el tostador:\n\n- **Los primeros días:** el café está "en reposo". Tiene tanto gas que el agua se extrae despareja; en espresso sale con mucha espuma y sabor punzante.\n- **Entre una y cuatro semanas:** suele estar en su mejor momento.\n- **Después del mes:** empieza a declinar; pierde dulzor y aparecen notas planas o a cartón.\n\nEl espresso suele pedir más días de reposo que el filtrado.\n\nPara conservarlo: bolsa con válvula bien cerrada o frasco hermético, lejos de la luz, el calor y la humedad. **No lo guardes en la heladera**: absorbe olores y se condensa humedad cada vez que lo sacás.\n\nY comprá en grano: molido, la frescura se va en horas.',
        en: 'Roasted coffee is a fresh product. After roasting it releases **CO₂** for days and, at the same time, starts losing aroma through oxidation.\n\nSo always look for the **roast date** on the bag (not the expiry date, which can be a year away and tells you nothing).\n\nA rough guide, which varies by coffee and roaster:\n\n- **The first few days:** the coffee is "resting". It holds so much gas that water extracts unevenly; espresso comes out very foamy and sharp.\n- **Between one and four weeks:** usually at its best.\n- **After a month:** it starts to decline, losing sweetness and showing flat or papery notes.\n\nEspresso usually needs more resting days than filter.\n\nTo store it: a well-sealed valve bag or airtight jar, away from light, heat and moisture. **Do not keep it in the fridge**: it absorbs odors and moisture condenses every time you take it out.\n\nAnd buy whole bean: once ground, freshness fades within hours.',
        pt: 'O café torrado é um produto fresco. Depois da torra ele libera **CO₂** por dias e, ao mesmo tempo, começa a perder aromas por oxidação.\n\nPor isso procure sempre a **data de torra** na embalagem (não a de validade, que pode ser de um ano e não diz nada).\n\nUm guia orientativo, que muda conforme o café e o torrador:\n\n- **Os primeiros dias:** o café está "em descanso". Tem tanto gás que a água extrai de forma desigual; no espresso sai com muita espuma e sabor agressivo.\n- **Entre uma e quatro semanas:** costuma estar no seu melhor momento.\n- **Depois de um mês:** começa a declinar; perde doçura e aparecem notas planas ou de papelão.\n\nO espresso costuma pedir mais dias de descanso que o filtrado.\n\nPara conservar: embalagem com válvula bem fechada ou pote hermético, longe da luz, do calor e da umidade. **Não guarde na geladeira**: absorve cheiros e condensa umidade cada vez que você tira.\n\nE compre em grão: moído, o frescor vai embora em horas.'
      } },
    { id: 'bloom', icon: '🌸', min: 2,
      title: { es: '¿Qué es el bloom y por qué se hace?', en: 'What is the bloom and why do it?', pt: 'O que é o bloom e por que fazer?' },
      content: {
        es: 'Cuando mojás café recién molido, lo ves **inflarse y burbujear**. Eso es el CO₂ que quedó atrapado después del tueste escapando. A ese momento se lo llama **bloom** o preinfusión.\n\n¿Para qué sirve? El gas empuja el agua hacia afuera. Si vertés todo de golpe, el agua no llega bien a todas las partículas y la extracción queda despareja.\n\nCómo hacerlo:\n\n- Verté **el doble o el triple del peso del café** en agua (para 15 g, entre 30 y 45 ml).\n- Asegurate de mojar todo: podés dar un pequeño giro al cono o revolver suave.\n- Esperá **30 a 45 segundos**, hasta que deje de burbujear con fuerza.\n- Recién ahí seguí con el resto de los vertidos.\n\nUn bloom muy activo indica un café **fresco**. Si casi no se infla, puede ser un café viejo o un tueste muy oscuro (que ya liberó mucho gas).\n\nEn métodos de inmersión, como la prensa, el bloom es opcional, pero revolver al principio cumple una función parecida.',
        en: 'When you wet freshly ground coffee, you see it **swell and bubble**. That is the CO₂ trapped after roasting escaping. This moment is called the **bloom** or pre-infusion.\n\nWhy does it matter? The gas pushes water away. If you pour everything at once, water does not reach every particle well and extraction becomes uneven.\n\nHow to do it:\n\n- Pour **two to three times the coffee weight** in water (for 15 g, between 30 and 45 ml).\n- Make sure everything gets wet: give the cone a gentle swirl or stir softly.\n- Wait **30 to 45 seconds**, until the strong bubbling stops.\n- Only then continue with the rest of the pours.\n\nA very active bloom means **fresh** coffee. If it barely swells, it may be old coffee or a very dark roast (which already released much of its gas).\n\nIn immersion methods like the French press the bloom is optional, but stirring at the start does a similar job.',
        pt: 'Quando você molha café recém-moído, ele **incha e borbulha**. É o CO₂ que ficou preso depois da torra escapando. Esse momento se chama **bloom** ou pré-infusão.\n\nPara que serve? O gás empurra a água para fora. Se você despeja tudo de uma vez, a água não chega bem a todas as partículas e a extração fica desigual.\n\nComo fazer:\n\n- Despeje **o dobro ou o triplo do peso do café** em água (para 15 g, entre 30 e 45 ml).\n- Garanta que tudo fique molhado: gire de leve o cone ou mexa suavemente.\n- Espere **30 a 45 segundos**, até parar de borbulhar com força.\n- Só então siga com o resto dos despejos.\n\nUm bloom muito ativo indica café **fresco**. Se quase não incha, pode ser café velho ou uma torra muito escura (que já liberou muito gás).\n\nNos métodos de imersão, como a prensa, o bloom é opcional, mas mexer no início cumpre uma função parecida.'
      } },
    { id: 'extraccion', icon: '🧪', min: 3,
      title: { es: 'Extracción vs. fuerza: la diferencia clave', en: 'Extraction vs. strength: the key difference', pt: 'Extração vs. força: a diferença-chave' },
      content: {
        es: 'Son dos ideas que se confunden todo el tiempo, y entenderlas te ahorra semanas de prueba y error.\n\n**Extracción** es *cuánto* del café disolviste en el agua. Los sabores salen en orden: primero los ácidos, después los dulces y al final los amargos y secos.\n\n- **Subextraído:** agrio, salado, delgado, final corto. Faltó extraer.\n- **Sobreextraído:** amargo, áspero, seco en la lengua. Te pasaste.\n- **Bien extraído:** dulce, equilibrado, con un final largo y agradable.\n\nLa extracción se controla con **molienda, tiempo, temperatura y agitación**.\n\n**Fuerza** es *qué tan concentrada* está la bebida: cuánto café disuelto hay por cada sorbo. Un café puede estar perfectamente extraído y aun así sentirse aguado, o demasiado intenso.\n\nLa fuerza se controla con el **ratio** (cuánto café para cuánta agua).\n\nEl método para ajustar: primero arreglá la **extracción** (que no esté agrio ni amargo) y después la **fuerza** (que no esté aguado ni pesado). Y siempre, un cambio por vez.',
        en: 'These two ideas get mixed up all the time, and understanding them saves you weeks of trial and error.\n\n**Extraction** is *how much* of the coffee you dissolved into the water. Flavors come out in order: first acids, then sweetness, and finally bitter and drying compounds.\n\n- **Under-extracted:** sour, salty, thin, short finish. Not enough was extracted.\n- **Over-extracted:** bitter, harsh, drying on the tongue. You went too far.\n- **Well extracted:** sweet, balanced, with a long pleasant finish.\n\nExtraction is controlled with **grind, time, temperature and agitation**.\n\n**Strength** is *how concentrated* the drink is: how much dissolved coffee there is in each sip. A coffee can be perfectly extracted and still feel watery, or too intense.\n\nStrength is controlled with the **ratio** (how much coffee for how much water).\n\nThe method: first fix **extraction** (not sour, not bitter), then **strength** (not watery, not heavy). And always one change at a time.',
        pt: 'São duas ideias que se confundem o tempo todo, e entendê-las poupa semanas de tentativa e erro.\n\n**Extração** é *quanto* do café você dissolveu na água. Os sabores saem em ordem: primeiro os ácidos, depois os doces e por último os amargos e secos.\n\n- **Subextraído:** azedo, salgado, ralo, final curto. Faltou extrair.\n- **Sobre-extraído:** amargo, áspero, seco na língua. Passou do ponto.\n- **Bem extraído:** doce, equilibrado, com final longo e agradável.\n\nA extração se controla com **moagem, tempo, temperatura e agitação**.\n\n**Força** é *o quão concentrada* está a bebida: quanto café dissolvido há em cada gole. Um café pode estar perfeitamente extraído e mesmo assim parecer aguado, ou intenso demais.\n\nA força se controla com a **proporção** (quanto café para quanta água).\n\nO método: primeiro acerte a **extração** (nem azedo nem amargo) e depois a **força** (nem aguado nem pesado). E sempre uma mudança por vez.'
      } },
    { id: 'agua', icon: '💧', min: 2,
      title: { es: 'El agua: el 98% de tu taza', en: 'Water: 98% of your cup', pt: 'A água: 98% da sua xícara' },
      content: {
        es: 'Un café filtrado es casi todo agua, así que su calidad se nota más de lo que parece.\n\n**Qué buscar:**\n\n- **Sin cloro ni olores:** el cloro de la canilla tapa los aromas. Un filtro de jarra ya ayuda muchísimo.\n- **Ni muy dura ni destilada:** los minerales (calcio y magnesio) ayudan a extraer sabores. El agua destilada da un café plano; el agua muy dura, uno apagado y con sarro en tu cafetera.\n- Un **agua mineral de baja mineralización** suele andar bien. Mirá la etiqueta: buscá residuo seco bajo a moderado.\n\n**Temperatura:** para la mayoría de los métodos, entre **90 y 96 °C**. Si no tenés termómetro, dejá reposar el agua unos 30 a 60 segundos después del hervor. Los tuestes claros agradecen agua más caliente; los oscuros, un poco menos, porque se extraen más fácil.\n\nEn el **cold brew** el agua es fría y el tiempo reemplaza al calor: por eso tarda 12 a 18 horas.\n\nEsto es una guía general: la dureza del agua cambia mucho según la ciudad.',
        en: 'Filter coffee is almost all water, so its quality shows more than you would think.\n\n**What to look for:**\n\n- **No chlorine or odors:** tap-water chlorine masks aromas. A pitcher filter already helps a lot.\n- **Neither very hard nor distilled:** minerals (calcium and magnesium) help extract flavor. Distilled water makes flat coffee; very hard water makes it dull and scales your machine.\n- A **low-mineral bottled water** usually works well. Check the label for low to moderate dry residue.\n\n**Temperature:** for most methods, between **90 and 96 °C**. Without a thermometer, let the water rest 30 to 60 seconds after boiling. Light roasts like hotter water; dark roasts a little less, because they extract more easily.\n\nIn **cold brew** the water is cold and time replaces heat: that is why it takes 12 to 18 hours.\n\nThis is a general guide: water hardness varies a lot from city to city.',
        pt: 'Um café filtrado é quase todo água, então a qualidade dela aparece mais do que parece.\n\n**O que buscar:**\n\n- **Sem cloro nem cheiros:** o cloro da torneira esconde os aromas. Um filtro de jarra já ajuda muito.\n- **Nem muito dura nem destilada:** os minerais (cálcio e magnésio) ajudam a extrair sabores. Água destilada dá um café sem graça; água muito dura, um café apagado e com calcário na cafeteira.\n- Uma **água mineral de baixa mineralização** costuma funcionar bem. Olhe o rótulo: procure resíduo seco baixo a moderado.\n\n**Temperatura:** para a maioria dos métodos, entre **90 e 96 °C**. Sem termômetro, deixe a água descansar uns 30 a 60 segundos depois da fervura. Torras claras gostam de água mais quente; as escuras, um pouco menos, porque extraem com mais facilidade.\n\nNo **cold brew** a água é fria e o tempo substitui o calor: por isso leva de 12 a 18 horas.\n\nIsto é um guia geral: a dureza da água muda muito de cidade para cidade.'
      } },
    { id: 'canalizacion', icon: '🌊', min: 2,
      title: { es: 'Canalización: cuando el café sabe ácido y amargo a la vez', en: 'Channeling: when coffee tastes sour and bitter at once', pt: 'Canalização: quando o café fica ácido e amargo ao mesmo tempo' },
      content: {
        es: 'A veces un café es **agrio y amargo al mismo tiempo**. Eso parece imposible, pero tiene explicación: el agua no pasó pareja por todo el café.\n\nEl agua es perezosa: busca el camino más fácil. Si en el lecho de café hay una grieta, un hueco o una zona menos compacta, el agua corre por ahí (**canaliza**). Esa zona se **sobreextrae** (amargo) mientras el resto queda **subextraído** (agrio).\n\nPor eso, cuando aparecen los dos sabores juntos, **no toques la molienda primero**: revisá la preparación.\n\n- **Espresso:** distribuí bien el café en el filtro (podés usar una aguja o WDT para romper grumos), tampá parejo y sin inclinar, y revisá que el portafiltro esté limpio y seco.\n- **V60, Kalita y Chemex:** verté en el centro y en espiral suave, sin golpear contra el papel, y no dejes que el lecho quede inclinado o con un pozo.\n- **Inmersión:** suele venir de una molienda muy despareja, con mucho polvo fino. Un molino de muelas o tamizar los finos ayuda.\n\nUna pista visual: en espresso, si el chorro sale de un costado o con manchas claras, probablemente hubo canalización.',
        en: 'Sometimes a coffee is **sour and bitter at the same time**. It sounds impossible, but there is an explanation: water did not flow evenly through all the coffee.\n\nWater is lazy: it takes the easiest path. If the coffee bed has a crack, a gap or a looser area, water rushes through it (**channels**). That area **over-extracts** (bitter) while the rest stays **under-extracted** (sour).\n\nSo when both flavors show up together, **do not touch the grind first**: check your prep.\n\n- **Espresso:** distribute the coffee well in the basket (a needle tool or WDT breaks clumps), tamp evenly without tilting, and make sure the portafilter is clean and dry.\n- **V60, Kalita and Chemex:** pour in the center in a gentle spiral, without blasting the paper, and do not leave the bed tilted or with a crater.\n- **Immersion:** usually comes from a very uneven grind with lots of fines. A burr grinder or sifting the fines helps.\n\nA visual clue: in espresso, if the stream comes from one side or shows pale spots, there was probably channeling.',
        pt: 'Às vezes um café fica **azedo e amargo ao mesmo tempo**. Parece impossível, mas tem explicação: a água não passou por igual por todo o café.\n\nA água é preguiçosa: busca o caminho mais fácil. Se no leito de café há uma rachadura, um buraco ou uma área menos compacta, a água corre por ali (**canaliza**). Essa área **sobre-extrai** (amargo) enquanto o resto fica **subextraído** (azedo).\n\nPor isso, quando aparecem os dois sabores juntos, **não mexa na moagem primeiro**: revise o preparo.\n\n- **Espresso:** distribua bem o café no filtro (uma agulha ou WDT desfaz grumos), compacte por igual sem inclinar e confira se o porta-filtro está limpo e seco.\n- **V60, Kalita e Chemex:** despeje no centro em espiral suave, sem bater no papel, e não deixe o leito inclinado ou com um buraco.\n- **Imersão:** costuma vir de uma moagem muito desigual, com muito pó fino. Um moedor de mós ou peneirar os finos ajuda.\n\nUma pista visual: no espresso, se o fluxo sai de um lado ou com manchas claras, provavelmente houve canalização.'
      } }
  ];

  /* -------- Glosario -------- */
  const GLOSSARY = [
    { term: { es: 'Bloom', en: 'Bloom', pt: 'Bloom' }, lesson: 'bloom',
      def: { es: 'Primer vertido corto que libera el CO₂ del café antes del resto del agua.', en: 'Short first pour that releases CO₂ from the coffee before the rest of the water.', pt: 'Primeiro despejo curto que libera o CO₂ do café antes do resto da água.' } },
    { term: { es: 'Canalización', en: 'Channeling', pt: 'Canalização' }, lesson: 'canalizacion',
      def: { es: 'Cuando el agua encuentra un camino fácil y no pasa pareja por todo el café.', en: 'When water finds an easy path and does not flow evenly through all the coffee.', pt: 'Quando a água encontra um caminho fácil e não passa por igual por todo o café.' } },
    { term: { es: 'Dosis', en: 'Dose', pt: 'Dose' }, lesson: 'ratio',
      def: { es: 'Gramos de café molido que usás en una preparación.', en: 'Grams of ground coffee used in one brew.', pt: 'Gramas de café moído usados num preparo.' } },
    { term: { es: 'Rendimiento', en: 'Yield', pt: 'Rendimento' }, lesson: 'ratio',
      def: { es: 'En espresso, gramos de bebida que caen en la taza.', en: 'In espresso, grams of drink that end up in the cup.', pt: 'No espresso, gramas de bebida que caem na xícara.' } },
    { term: { es: 'Ratio', en: 'Ratio', pt: 'Proporção' }, lesson: 'ratio',
      def: { es: 'Relación entre café y agua. 1:16 = 1 g de café cada 16 g de agua.', en: 'Coffee-to-water relationship. 1:16 = 1 g of coffee per 16 g of water.', pt: 'Relação entre café e água. 1:16 = 1 g de café para 16 g de água.' } },
    { term: { es: 'Extracción', en: 'Extraction', pt: 'Extração' }, lesson: 'extraccion',
      def: { es: 'Cuánto del café se disuelve en el agua. Define si sabe agrio, dulce o amargo.', en: 'How much of the coffee dissolves into the water. It decides whether it tastes sour, sweet or bitter.', pt: 'Quanto do café se dissolve na água. Define se fica azedo, doce ou amargo.' } },
    { term: { es: 'Subextracción', en: 'Under-extraction', pt: 'Subextração' }, lesson: 'extraccion',
      def: { es: 'Extraer poco: café agrio, delgado, con final corto.', en: 'Extracting too little: sour, thin coffee with a short finish.', pt: 'Extrair pouco: café azedo, ralo, com final curto.' } },
    { term: { es: 'Sobreextracción', en: 'Over-extraction', pt: 'Sobre-extração' }, lesson: 'extraccion',
      def: { es: 'Extraer de más: café amargo, áspero y que seca la boca.', en: 'Extracting too much: bitter, harsh coffee that dries the mouth.', pt: 'Extrair demais: café amargo, áspero e que seca a boca.' } },
    { term: { es: 'Fuerza', en: 'Strength', pt: 'Força' }, lesson: 'extraccion',
      def: { es: 'Qué tan concentrada está la bebida. Se ajusta con el ratio.', en: 'How concentrated the drink is. Adjusted with the ratio.', pt: 'O quão concentrada está a bebida. Ajusta-se com a proporção.' } },
    { term: { es: 'Finos', en: 'Fines', pt: 'Finos' }, lesson: 'molienda',
      def: { es: 'Polvo muy fino que genera el molino. En exceso, amarga y tapa el filtro.', en: 'Very fine dust produced by the grinder. Too much makes coffee bitter and clogs the filter.', pt: 'Pó muito fino gerado pelo moedor. Em excesso, amarga e entope o filtro.' } },
    { term: { es: 'Drawdown', en: 'Drawdown', pt: 'Drawdown' }, lesson: 'molienda',
      def: { es: 'Último tramo de un filtrado, cuando el agua termina de bajar por el café.', en: 'Final stage of a pour-over, when the water finishes draining through the coffee.', pt: 'Trecho final de um filtrado, quando a água termina de descer pelo café.' } },
    { term: { es: 'Puck', en: 'Puck', pt: 'Puck' }, lesson: 'canalizacion',
      def: { es: 'La pastilla de café compactado en el portafiltro del espresso.', en: 'The disc of compacted coffee in the espresso portafilter.', pt: 'A pastilha de café compactado no porta-filtro do espresso.' } },
    { term: { es: 'WDT', en: 'WDT', pt: 'WDT' }, lesson: 'canalizacion',
      def: { es: 'Técnica de revolver el café en el filtro con agujas finas para romper grumos.', en: 'Stirring the coffee in the basket with thin needles to break clumps.', pt: 'Técnica de mexer o café no filtro com agulhas finas para desfazer grumos.' } },
    { term: { es: 'Desgasificación', en: 'Degassing', pt: 'Desgaseificação' }, lesson: 'frescura',
      def: { es: 'Liberación de CO₂ del café en los días posteriores al tueste.', en: 'Release of CO₂ from coffee in the days after roasting.', pt: 'Liberação de CO₂ do café nos dias após a torra.' } },
    { term: { es: 'Proceso lavado / natural', en: 'Washed / natural process', pt: 'Processo lavado / natural' }, lesson: 'grano',
      def: { es: 'Formas de sacar la semilla de la cereza. Cambian mucho el sabor.', en: 'Ways of removing the seed from the cherry. They change flavor a lot.', pt: 'Formas de tirar a semente da cereja. Mudam muito o sabor.' } }
  ];

  return { METHODS, FIXED_ML, ROAST_ADJUST, FRESHNESS, RECIPE_RECOMMENDATIONS, LESSON_FOR, LESSONS, GLOSSARY };
})();
