/* =====================================================================
 * Barista de Bolsillo — SCRIPT PRINCIPAL (flujo original de 5 pasos)
 * ---------------------------------------------------------------------
 * Antes vivía dentro de index.html. Ahora se carga con `defer` para no
 * bloquear el primer render. Orden de carga (todos con defer):
 *   data.js → i18n-ext.js → logic.js → app.js → features.js
 * ===================================================================== */
  // Estado global de la app: se va completando en cada paso
  const state = {
    brewer: null,   // clave de BDATA.METHODS: 'prensa' | 'expreso' | 'v60' | ...
    size: null,
    ml: null,       // agua total en ml (en espresso: rendimiento en g)
    intensity: null,
    groundOrBean: null,
    grindNotified: false,
    // v2: receta dinámica del Paso 4
    dose: null,     // g de café
    ratio: null,    // 1:x (en espresso: dosis:rendimiento)
    roast: 'medio', // 'claro' | 'medio' | 'oscuro'
    iced: false,    // versión helada (método japonés)
    recipe: null,   // resultado de BL.computeRecipe
    pendingRec: null,
    recApplied: false
  };

  // --- Traducciones (ES/EN/PT) ---
  const I18N = {
    "es": {
      "ui": {
        "eyebrow": "Barista de bolsillo",
        "h1": "¿Con qué cafetera vas a preparar hoy?",
        "subtitle": "Elegí tu método. A partir de ahí ajustamos todo: proporción, molienda y tiempo.",
        "step1Label": "PASO 1 · Método de preparación",
        "footnote": "Vas a poder cambiar de método más adelante.",
        "goFreeHome": "O saltar directo a la calculadora y cronómetro libres →",
        "step2Label": "PASO 2 · Taza e intensidad",
        "questionSize": "¿Qué tamaño de café querés?",
        "questionIntensity": "¿Con qué intensidad?",
        "intensitySuave": "Suave",
        "intensityMedio": "Medio",
        "intensityFuerte": "Fuerte",
        "continueBtn": "Continuar",
        "step3Label": "PASO 3 · Molienda",
        "questionGrind": "¿El café ya está molido, o en grano?",
        "choiceMolido": "Ya está molido",
        "choiceGrano": "Está en grano",
        "backChangeCafetera": "← Cambiar cafetera",
        "backChangeSizeIntensity": "← Cambiar taza / intensidad",
        "grindRecommended": "Molienda recomendada: ",
        "step4Label": "PASO 4 · Tu café, calculado",
        "labelMlAgua": "ml de agua",
        "labelGCafe": "g de café",
        "timeLabel": "Tiempo estimado de extracción",
        "tipsTitleTips": "Tips para esta cafetera",
        "tipsTitleSteps": "Pasos de preparación",
        "pasoWord": "Paso",
        "cafeWord": "Café",
        "intensidadWord": "intensidad",
        "tuWord": "Tu",
        "btnGoFreeStep4": "Abrir calculadora y cronómetro libres →",
        "btnResetApp": "↺ Empezar de nuevo",
        "step5Label": "PASO 5 · Espacio libre",
        "calcTitle": "Calculadora de proporción",
        "ratioPre": "Proporción: 1 g de café cada",
        "ratioPost": "ml de agua",
        "labelAguaCalc": "Agua",
        "labelCafeCalc": "Café",
        "timerTitle": "Cronómetro",
        "modeUp": "Cronómetro ↑",
        "modeDown": "Cuenta regresiva ↓",
        "metaLabel": "Meta:",
        "minLabel": "min",
        "segLabel": "seg",
        "btnFijar": "Fijar",
        "timerStart": "Iniciar",
        "timerPause": "Pausar",
        "timerReset": "Reiniciar",
        "scheduleTitle": "Cronograma de vertido (opcional)",
        "scheduleDesc": "Armá tus propios puntos: a qué tiempo (con el cronómetro ↑) tenés que llegar a cuántos ML de agua. Se van a ir marcando solos mientras el cronómetro corre.",
        "btnAddPoint": "+ Agregar punto",
        "savedLabel": "★ MI CAFÉ IDEAL",
        "saveRecipeTitle": "Guardar una receta",
        "labelCafetera": "Cafetera",
        "labelMolienda": "Molienda",
        "labelCafeForm": "Café",
        "pointsDesc": "Puntos de vertido: podés agregar uno o varios, como en Chemex y V60 (a qué minuto:segundo llegar a cuántos ML).",
        "btnSaveRecipe": "Guardar receta",
        "myRecipesTitle": "Mis recetas guardadas",
        "savedRecipesEmpty": "Todavía no guardaste ninguna receta.",
        "alertCompleteFields": "Completá los gramos de café y agregá al menos un punto de tiempo con su ML.",
        "settingsTitle": "Configuración",
        "closeBtn": "Cerrar",
        "backVolver": "← Volver",
        "backVolverMolienda": "← Volver a molienda",
        "backVolverInicio": "← Volver al inicio",
        "proximoPunto": "Próximo: a los {t} → llegar a {ml} ml",
        "ultimoPunto": "Último punto ({ml} ml) ya alcanzado.",
        "primerPunto": "Primer punto: a los {t} → llegar a {ml} ml",
        "proporcionUsadaPre": "Proporción usada: 1 g de café cada",
        "proporcionUsadaPost": "ml de agua",
        "sensoryTitle": "Perfil sensorial (opcional)",
        "sensoryAcidez": "Acidez",
        "sensoryCuerpo": "Cuerpo",
        "sensoryDulzura": "Dulzura / Balance",
        "sensoryAroma": "Aroma",
        "sensoryFragancia": "Fragancia",
        "sensoryNotas": "Notas de cata",
        "sensoryPersonal": "Nota personal (opcional)",
        "placeholderAroma": "ej: Chocolate, jazmín",
        "placeholderFragancia": "ej: Floral, cítrico",
        "placeholderNotas": "ej: Frutos rojos, caramelo, nuez",
        "placeholderPersonal": "Escribí lo que quieras recordar de este café...",
        "btnAddIdeal": "★ Añadir a mi café ideal",
        "savedConfirm": "¡Guardado en Mi café ideal! ✓",
        "accordionCalcTitle": "Calculadora y cronómetro libres",
        "openFullCalc": "Abrir versión completa (con cronograma) →",
        "themeLabel": "Tema",
        "themeLight": "Modo claro",
        "themeDark": "Modo oscuro",
        "theme_standard": "Estándar",
        "theme_latte": "Latte",
        "theme_mocha": "Mocha",
        "coffeeInfoTitle": "Sobre este café",
        "coffeeNameLabel": "Nombre del café",
        "coffeeOrigin": "Lugar de origen",
        "coffeeRoastDate": "Fecha de tueste",
        "placeholderCoffeeName": "ej: Finca La Esperanza",
        "placeholderOrigin": "ej: Huila, Colombia",
        "placeholderRoastDate": "ej: 12/07/2026"
      },
      "brewerNames": {
        "prensa": "Prensa francesa",
        "expreso": "Expreso hogareño",
        "moka": "Moka italiana",
        "filtro": "Filtro / jarra",
        "v60": "V60",
        "chemex": "Chemex",
        "aeropress": "AeroPress",
        "saved": "Mi café ideal"
      },
      "brewerSubs": {
        "prensa": "Inmersión, malla metálica, cuerpo pesado.",
        "expreso": "Presión, portafiltro, extracción corta.",
        "moka": "Vapor a presión, fuego directo, cuerpo intenso.",
        "filtro": "Goteo, como las de oficina, por lotes.",
        "v60": "Filtro cónico, vertido manual en espiral.",
        "chemex": "Jarra con filtro grueso, taza limpia.",
        "aeropress": "Método invertido, presión suave con émbolo.",
        "saved": "Tus recetas guardadas, a mano."
      },
      "sizeNames": {
        "chico": "Chico",
        "mediano": "Mediano",
        "grande": "Grande"
      },
      "grindOptions": [
        "Muy fina",
        "Fina",
        "Media-fina",
        "Media",
        "Media-gruesa",
        "Gruesa"
      ],
      "grindInfo": {
        "moka": {
          "level": "Muy fina",
          "texture": "Como <b>sal fina de mesa</b> o azúcar impalpable: se siente casi como polvo entre los dedos, pero no tan fino como harina."
        },
        "expreso": {
          "level": "Fina",
          "texture": "Como <b>sal fina</b>, un poquito más gruesa que la de la moka: al tocarla notás granitos chiquitos pero definidos."
        },
        "filtro": {
          "level": "Media",
          "texture": "Como <b>arena de playa</b> o azúcar común de mesa: se nota suelta entre los dedos, ni polvo ni grumos grandes."
        },
        "prensa": {
          "level": "Gruesa",
          "texture": "Como <b>pan rallado grueso</b> o sal marina en grano: partículas grandes y bien visibles a simple vista."
        },
        "v60": {
          "level": "Media-fina",
          "texture": "Como <b>arena fina de playa</b> o azúcar refinada."
        },
        "chemex": {
          "level": "Media-gruesa",
          "texture": "Como <b>sal marina gruesa</b>."
        },
        "aeropress": {
          "level": "Media",
          "texture": "Como <b>sal marina fina</b> o arena común."
        }
      },
      "tips": {
        "prensa": [
          "Calentá el agua a unos 92-96°C (rompió el hervor, dejala 30 seg de reposo).",
          "Verté toda el agua de una vez y remové suavemente con una cuchara.",
          "Colocá el émbolo apenas apoyado arriba (sin presionar) durante la espera.",
          "Presioná lento y parejo recién al final del tiempo de extracción.",
          "Servite todo el café enseguida: si se queda en la prensa, sigue extrayendo."
        ],
        "expreso": [
          "Precalentá el portafiltro y la taza para que no baje la temperatura de golpe.",
          "Nivelá el café y tampá parejo y firme, sin inclinar la prensa.",
          "Buscá una caída en \"cola de ratón\": ni chorro fino, ni goteo lento.",
          "Si sale muy rápido, la molienda está gruesa; si tarda de más, muy fina."
        ],
        "moka": [
          "Cargá agua caliente (no fría) en la base: acelera y pareja la extracción.",
          "Llená el embudo de café sin tampar, solo nivelá con el dedo.",
          "Fuego medio-bajo y con la tapa abierta para controlar cuándo sube.",
          "Retirala del fuego apenas empiece a borbotear con fuerza."
        ],
        "filtro": [
          "Enjuagá el filtro de papel con agua caliente antes de cargar el café.",
          "Hacé una pre-infusión: mojá el café y esperá 30 seg a que \"florezca\".",
          "Verté el agua en círculos lentos, del centro hacia afuera, sin tocar el borde.",
          "Usá agua recién fuera del hervor (unos 92-96°C), no hirviendo a full."
        ]
      },
      "steps": {
        "v60": [
          "Colocá el filtro de papel y enjuagalo con agua caliente para sacarle el gusto a papel y precalentar. Descartá esa agua.",
          "Agregá los 15 g de café molido y nivelá suavemente.",
          "Preinfusión: verté unos 45 ml de agua caliente (~92°C) y dejá reposar 30 segundos.",
          "Verté el resto del agua en círculos lentos de adentro hacia afuera, sin tocar el filtro, hasta llegar a 225 ml.",
          "Dejá que filtre por completo."
        ],
        "chemex": [
          "Colocá el filtro de papel (triple capa hacia el pico vertedor) y enjuagalo bien con agua caliente. Descartá esa agua.",
          "Agregá los 30 g de café y nivelá.",
          "Preinfusión: mojá el café con 70-80 ml de agua en vertido circular. Esperá 45 segundos.",
          "Verté el agua en espiral, en 2 o 3 tandas, hasta llegar a 480 ml.",
          "Cuando el goteo sea muy lento, retirá el filtro y serví."
        ],
        "aeropress": [
          "Método invertido: apoyá el émbolo sobre la mesa, con el cilindro encajado en la marca número 4.",
          "Agregá los 15 g de café dentro.",
          "Verté unos 50 ml de agua caliente, revolvé 10 segundos y dejá reposar 20 segundos.",
          "Completá con agua hasta unos 210 ml.",
          "Enjuagá el filtro de papel en la tapa, enroscala en la AeroPress, dala vuelta con firmeza sobre tu taza y presioná despacio unos 30 segundos hasta un leve silbido de aire."
        ]
      },
      "time": {
        "prensa": "4 min",
        "expreso": "25-30 seg",
        "moka": "4-5 min",
        "filtro": "3-4 min",
        "v60": "2:30 - 3:00 min",
        "chemex": "3:30 - 4:30 min",
        "aeropress": "1:30 - 2:00 min"
      },
      "waterTip": "💡 Usá agua mineral o filtrada: el 98% de la taza es agua. Evitá el agua hirviendo a borbotones — dejala reposar 1 minuto tras el hervor."
    },
    "en": {
      "ui": {
        "eyebrow": "Pocket Barista",
        "h1": "Which coffee maker are you using today?",
        "subtitle": "Pick your method. From there we'll adjust everything: ratio, grind, and time.",
        "step1Label": "STEP 1 · Brewing method",
        "footnote": "You'll be able to change methods later.",
        "goFreeHome": "Or skip straight to the free calculator and timer →",
        "step2Label": "STEP 2 · Cup size and strength",
        "questionSize": "What size coffee do you want?",
        "questionIntensity": "How strong?",
        "intensitySuave": "Mild",
        "intensityMedio": "Medium",
        "intensityFuerte": "Strong",
        "continueBtn": "Continue",
        "step3Label": "STEP 3 · Grind",
        "questionGrind": "Is the coffee already ground, or whole bean?",
        "choiceMolido": "Already ground",
        "choiceGrano": "Whole bean",
        "backChangeCafetera": "← Change brewer",
        "backChangeSizeIntensity": "← Change cup / strength",
        "grindRecommended": "Recommended grind: ",
        "step4Label": "STEP 4 · Your coffee, calculated",
        "labelMlAgua": "ml of water",
        "labelGCafe": "g of coffee",
        "timeLabel": "Estimated brew time",
        "tipsTitleTips": "Tips for this brewer",
        "tipsTitleSteps": "Brewing steps",
        "pasoWord": "Step",
        "cafeWord": "Coffee",
        "intensidadWord": "strength",
        "tuWord": "Your",
        "btnGoFreeStep4": "Open free calculator and timer →",
        "btnResetApp": "↺ Start over",
        "step5Label": "STEP 5 · Free space",
        "calcTitle": "Ratio calculator",
        "ratioPre": "Ratio: 1 g of coffee per",
        "ratioPost": "ml of water",
        "labelAguaCalc": "Water",
        "labelCafeCalc": "Coffee",
        "timerTitle": "Timer",
        "modeUp": "Stopwatch ↑",
        "modeDown": "Countdown ↓",
        "metaLabel": "Target:",
        "minLabel": "min",
        "segLabel": "sec",
        "btnFijar": "Set",
        "timerStart": "Start",
        "timerPause": "Pause",
        "timerReset": "Reset",
        "scheduleTitle": "Pour schedule (optional)",
        "scheduleDesc": "Build your own checkpoints: at what time (with the stopwatch ↑) you should reach how many ML of water. They'll highlight automatically as the timer runs.",
        "btnAddPoint": "+ Add point",
        "savedLabel": "★ MY IDEAL COFFEE",
        "saveRecipeTitle": "Save a recipe",
        "labelCafetera": "Brewer",
        "labelMolienda": "Grind",
        "labelCafeForm": "Coffee",
        "pointsDesc": "Pour points: you can add one or several, like in Chemex and V60 (at what minute:second to reach how many ML).",
        "btnSaveRecipe": "Save recipe",
        "myRecipesTitle": "My saved recipes",
        "savedRecipesEmpty": "You haven't saved any recipe yet.",
        "alertCompleteFields": "Fill in the coffee grams and add at least one time point with its ML.",
        "settingsTitle": "Settings",
        "closeBtn": "Close",
        "backVolver": "← Back",
        "backVolverMolienda": "← Back to grind",
        "backVolverInicio": "← Back to home",
        "proximoPunto": "Next: at {t} → reach {ml} ml",
        "ultimoPunto": "Last point ({ml} ml) already reached.",
        "primerPunto": "First point: at {t} → reach {ml} ml",
        "proporcionUsadaPre": "Ratio used: 1 g of coffee per",
        "proporcionUsadaPost": "ml of water",
        "sensoryTitle": "Sensory profile (optional)",
        "sensoryAcidez": "Acidity",
        "sensoryCuerpo": "Body",
        "sensoryDulzura": "Sweetness / Balance",
        "sensoryAroma": "Aroma",
        "sensoryFragancia": "Fragrance",
        "sensoryNotas": "Tasting notes",
        "sensoryPersonal": "Personal note (optional)",
        "placeholderAroma": "e.g: Chocolate, jasmine",
        "placeholderFragancia": "e.g: Floral, citrus",
        "placeholderNotas": "e.g: Red berries, caramel, walnut",
        "placeholderPersonal": "Write anything you want to remember about this coffee...",
        "btnAddIdeal": "★ Add to my ideal coffee",
        "savedConfirm": "Saved to My ideal coffee! ✓",
        "accordionCalcTitle": "Free calculator and timer",
        "openFullCalc": "Open full version (with pour schedule) →",
        "themeLabel": "Theme",
        "themeLight": "Light mode",
        "themeDark": "Dark mode",
        "theme_standard": "Standard",
        "theme_latte": "Latte",
        "theme_mocha": "Mocha"
      },
      "brewerNames": {
        "prensa": "French press",
        "expreso": "Home espresso",
        "moka": "Moka pot",
        "filtro": "Drip / carafe",
        "v60": "V60",
        "chemex": "Chemex",
        "aeropress": "AeroPress",
        "saved": "My ideal coffee"
      },
      "brewerSubs": {
        "prensa": "Immersion, metal mesh, heavy body.",
        "expreso": "Pressure, portafilter, short extraction.",
        "moka": "Pressurized steam, direct heat, intense body.",
        "filtro": "Drip, like office ones, by batch.",
        "v60": "Conical filter, manual spiral pour.",
        "chemex": "Carafe with thick filter, clean cup.",
        "aeropress": "Inverted method, gentle plunger pressure.",
        "saved": "Your saved recipes, at hand."
      },
      "sizeNames": {
        "chico": "Small",
        "mediano": "Medium",
        "grande": "Large"
      },
      "grindOptions": [
        "Very fine",
        "Fine",
        "Medium-fine",
        "Medium",
        "Medium-coarse",
        "Coarse"
      ],
      "grindInfo": {
        "moka": {
          "level": "Very fine",
          "texture": "Like <b>fine table salt</b> or powdered sugar: it feels almost like dust between your fingers, but not as fine as flour."
        },
        "expreso": {
          "level": "Fine",
          "texture": "Like <b>fine salt</b>, slightly coarser than moka grind: you can feel small but defined grains."
        },
        "filtro": {
          "level": "Medium",
          "texture": "Like <b>beach sand</b> or regular table sugar: loose between your fingers, neither dust nor big clumps."
        },
        "prensa": {
          "level": "Coarse",
          "texture": "Like <b>coarse breadcrumbs</b> or sea salt grains: large, clearly visible particles."
        },
        "v60": {
          "level": "Medium-fine",
          "texture": "Like <b>fine beach sand</b> or refined sugar."
        },
        "chemex": {
          "level": "Medium-coarse",
          "texture": "Like <b>coarse sea salt</b>."
        },
        "aeropress": {
          "level": "Medium",
          "texture": "Like <b>fine sea salt</b> or common sand."
        }
      },
      "tips": {
        "prensa": [
          "Heat the water to about 92-96°C (just off the boil, let it rest 30 sec).",
          "Pour all the water at once and stir gently with a spoon.",
          "Rest the plunger lightly on top (without pressing) while it steeps.",
          "Press slowly and evenly only at the end of the steep time.",
          "Serve all the coffee right away: if it stays in the press, it keeps extracting."
        ],
        "expreso": [
          "Preheat the portafilter and cup so the temperature doesn't drop suddenly.",
          "Level the coffee and tamp evenly and firmly, without tilting the tamper.",
          "Look for a \"mouse tail\" flow: neither a thin stream nor a slow drip.",
          "If it runs too fast, the grind is too coarse; if it takes too long, too fine."
        ],
        "moka": [
          "Fill the base with hot (not cold) water: speeds up and evens out extraction.",
          "Fill the funnel with coffee without tamping, just level it with your finger.",
          "Medium-low heat with the lid open to watch when it rises.",
          "Take it off the heat as soon as it starts bubbling strongly."
        ],
        "filtro": [
          "Rinse the paper filter with hot water before adding the coffee.",
          "Do a pre-infusion: wet the coffee and wait 30 sec for it to \"bloom\".",
          "Pour the water in slow circles, from the center outward, without touching the edge.",
          "Use water just off the boil (about 92-96°C), not at a full rolling boil."
        ]
      },
      "steps": {
        "v60": [
          "Place the paper filter and rinse it with hot water to remove the papery taste and preheat. Discard that water.",
          "Add the 15 g of ground coffee and level it gently.",
          "Pre-infusion: pour about 45 ml of hot water (~92°C) and let it rest 30 seconds.",
          "Pour the rest of the water in slow circles from the center outward, without touching the filter, up to 225 ml.",
          "Let it drain completely."
        ],
        "chemex": [
          "Place the paper filter (triple layer facing the spout) and rinse it well with hot water. Discard that water.",
          "Add the 30 g of coffee and level it.",
          "Pre-infusion: wet the coffee with 70-80 ml of water in a circular pour. Wait 45 seconds.",
          "Pour the water in a spiral, in 2 or 3 batches, up to 480 ml.",
          "When the drip gets very slow, remove the filter and serve."
        ],
        "aeropress": [
          "Inverted method: rest the plunger on the table, with the chamber locked at the number 4 mark.",
          "Add the 15 g of coffee inside.",
          "Pour about 50 ml of hot water, stir for 10 seconds and let it rest 20 seconds.",
          "Fill with water up to about 210 ml.",
          "Rinse the paper filter in the cap, screw it onto the AeroPress, flip it firmly onto your cup and press slowly for about 30 seconds until a light hiss of air."
        ]
      },
      "time": {
        "prensa": "4 min",
        "expreso": "25-30 sec",
        "moka": "4-5 min",
        "filtro": "3-4 min",
        "v60": "2:30 - 3:00 min",
        "chemex": "3:30 - 4:30 min",
        "aeropress": "1:30 - 2:00 min"
      },
      "waterTip": "💡 Use mineral or filtered water: 98% of the cup is water. Avoid water at a rolling boil — let it rest 1 minute after boiling."
    },
    "pt": {
      "ui": {
        "eyebrow": "Barista de Bolso",
        "h1": "Com qual cafeteira você vai preparar hoje?",
        "subtitle": "Escolha seu método. A partir daí ajustamos tudo: proporção, moagem e tempo.",
        "step1Label": "PASSO 1 · Método de preparo",
        "footnote": "Você vai poder trocar de método mais adiante.",
        "goFreeHome": "Ou vá direto para a calculadora e cronômetro livres →",
        "step2Label": "PASSO 2 · Tamanho e intensidade",
        "questionSize": "Qual tamanho de café você quer?",
        "questionIntensity": "Com qual intensidade?",
        "intensitySuave": "Suave",
        "intensityMedio": "Médio",
        "intensityFuerte": "Forte",
        "continueBtn": "Continuar",
        "step3Label": "PASSO 3 · Moagem",
        "questionGrind": "O café já está moído, ou em grão?",
        "choiceMolido": "Já está moído",
        "choiceGrano": "Está em grão",
        "backChangeCafetera": "← Trocar cafeteira",
        "backChangeSizeIntensity": "← Trocar xícara / intensidade",
        "grindRecommended": "Moagem recomendada: ",
        "step4Label": "PASSO 4 · Seu café, calculado",
        "labelMlAgua": "ml de água",
        "labelGCafe": "g de café",
        "timeLabel": "Tempo estimado de extração",
        "tipsTitleTips": "Dicas para esta cafeteira",
        "tipsTitleSteps": "Passo a passo do preparo",
        "pasoWord": "Passo",
        "cafeWord": "Café",
        "intensidadWord": "intensidade",
        "tuWord": "Seu",
        "btnGoFreeStep4": "Abrir calculadora e cronômetro livres →",
        "btnResetApp": "↺ Começar de novo",
        "step5Label": "PASSO 5 · Espaço livre",
        "calcTitle": "Calculadora de proporção",
        "ratioPre": "Proporção: 1 g de café a cada",
        "ratioPost": "ml de água",
        "labelAguaCalc": "Água",
        "labelCafeCalc": "Café",
        "timerTitle": "Cronômetro",
        "modeUp": "Cronômetro ↑",
        "modeDown": "Contagem regressiva ↓",
        "metaLabel": "Meta:",
        "minLabel": "min",
        "segLabel": "seg",
        "btnFijar": "Definir",
        "timerStart": "Iniciar",
        "timerPause": "Pausar",
        "timerReset": "Reiniciar",
        "scheduleTitle": "Cronograma de despejo (opcional)",
        "scheduleDesc": "Monte seus próprios pontos: em que tempo (com o cronômetro ↑) você precisa chegar a quantos ML de água. Eles vão se marcar sozinhos enquanto o cronômetro roda.",
        "btnAddPoint": "+ Adicionar ponto",
        "savedLabel": "★ MEU CAFÉ IDEAL",
        "saveRecipeTitle": "Salvar uma receita",
        "labelCafetera": "Cafeteira",
        "labelMolienda": "Moagem",
        "labelCafeForm": "Café",
        "pointsDesc": "Pontos de despejo: você pode adicionar um ou vários, como no Chemex e V60 (em qual minuto:segundo chegar a quantos ML).",
        "btnSaveRecipe": "Salvar receita",
        "myRecipesTitle": "Minhas receitas salvas",
        "savedRecipesEmpty": "Você ainda não salvou nenhuma receita.",
        "alertCompleteFields": "Preencha os gramas de café e adicione ao menos um ponto de tempo com seu ML.",
        "settingsTitle": "Configurações",
        "closeBtn": "Fechar",
        "backVolver": "← Voltar",
        "backVolverMolienda": "← Voltar para moagem",
        "backVolverInicio": "← Voltar ao início",
        "proximoPunto": "Próximo: aos {t} → chegar a {ml} ml",
        "ultimoPunto": "Último ponto ({ml} ml) já alcançado.",
        "primerPunto": "Primeiro ponto: aos {t} → chegar a {ml} ml",
        "proporcionUsadaPre": "Proporção usada: 1 g de café a cada",
        "proporcionUsadaPost": "ml de água",
        "sensoryTitle": "Perfil sensorial (opcional)",
        "sensoryAcidez": "Acidez",
        "sensoryCuerpo": "Corpo",
        "sensoryDulzura": "Doçura / Equilíbrio",
        "sensoryAroma": "Aroma",
        "sensoryFragancia": "Fragrância",
        "sensoryNotas": "Notas de prova",
        "sensoryPersonal": "Nota pessoal (opcional)",
        "placeholderAroma": "ex: Chocolate, jasmim",
        "placeholderFragancia": "ex: Floral, cítrico",
        "placeholderNotas": "ex: Frutas vermelhas, caramelo, noz",
        "placeholderPersonal": "Escreva o que quiser lembrar deste café...",
        "btnAddIdeal": "★ Adicionar ao meu café ideal",
        "savedConfirm": "Salvo em Meu café ideal! ✓",
        "accordionCalcTitle": "Calculadora e cronômetro livres",
        "openFullCalc": "Abrir versão completa (com cronograma) →",
        "themeLabel": "Tema",
        "themeLight": "Modo claro",
        "themeDark": "Modo escuro",
        "theme_standard": "Padrão",
        "theme_latte": "Latte",
        "theme_mocha": "Mocha"
      },
      "brewerNames": {
        "prensa": "Prensa francesa",
        "expreso": "Espresso doméstico",
        "moka": "Moka italiana",
        "filtro": "Filtro / jarra",
        "v60": "V60",
        "chemex": "Chemex",
        "aeropress": "AeroPress",
        "saved": "Meu café ideal"
      },
      "brewerSubs": {
        "prensa": "Imersão, tela metálica, corpo pesado.",
        "expreso": "Pressão, porta-filtro, extração curta.",
        "moka": "Vapor sob pressão, fogo direto, corpo intenso.",
        "filtro": "Gotejamento, como as de escritório, por lote.",
        "v60": "Filtro cônico, despejo manual em espiral.",
        "chemex": "Jarra com filtro grosso, xícara limpa.",
        "aeropress": "Método invertido, pressão suave com êmbolo.",
        "saved": "Suas receitas salvas, à mão."
      },
      "sizeNames": {
        "chico": "Pequeno",
        "mediano": "Médio",
        "grande": "Grande"
      },
      "grindOptions": [
        "Muito fina",
        "Fina",
        "Média-fina",
        "Média",
        "Média-grossa",
        "Grossa"
      ],
      "grindInfo": {
        "moka": {
          "level": "Muito fina",
          "texture": "Como <b>sal fino de mesa</b> ou açúcar impalpável: quase como pó entre os dedos, mas não tão fino quanto farinha."
        },
        "expreso": {
          "level": "Fina",
          "texture": "Como <b>sal fino</b>, um pouco mais grossa que a da moka: dá pra sentir grãozinhos pequenos, mas definidos."
        },
        "filtro": {
          "level": "Média",
          "texture": "Como <b>areia de praia</b> ou açúcar comum de mesa: solta entre os dedos, nem pó nem grumos grandes."
        },
        "prensa": {
          "level": "Grossa",
          "texture": "Como <b>farinha de rosca grossa</b> ou sal marinho em grão: partículas grandes e bem visíveis."
        },
        "v60": {
          "level": "Média-fina",
          "texture": "Como <b>areia fina de praia</b> ou açúcar refinado."
        },
        "chemex": {
          "level": "Média-grossa",
          "texture": "Como <b>sal marinho grosso</b>."
        },
        "aeropress": {
          "level": "Média",
          "texture": "Como <b>sal marinho fino</b> ou areia comum."
        }
      },
      "tips": {
        "prensa": [
          "Aqueça a água a uns 92-96°C (assim que ferver, deixe descansar 30 seg).",
          "Despeje toda a água de uma vez e mexa suavemente com uma colher.",
          "Coloque o êmbolo só apoiado em cima (sem pressionar) durante a espera.",
          "Pressione devagar e de forma uniforme só no final do tempo de extração.",
          "Sirva todo o café na hora: se ficar na prensa, continua extraindo."
        ],
        "expreso": [
          "Preaqueça o porta-filtro e a xícara para a temperatura não cair de repente.",
          "Nivele o café e prense de forma uniforme e firme, sem inclinar.",
          "Procure uma queda em \"rabo de rato\": nem jato fino, nem gotejamento lento.",
          "Se sair rápido demais, a moagem está grossa; se demorar muito, está fina demais."
        ],
        "moka": [
          "Coloque água quente (não fria) na base: acelera e uniformiza a extração.",
          "Encha o funil de café sem prensar, só nivele com o dedo.",
          "Fogo médio-baixo com a tampa aberta para controlar quando sobe.",
          "Retire do fogo assim que começar a borbulhar com força."
        ],
        "filtro": [
          "Enxágue o filtro de papel com água quente antes de colocar o café.",
          "Faça uma pré-infusão: molhe o café e espere 30 seg para ele \"florescer\".",
          "Despeje a água em círculos lentos, do centro para fora, sem tocar a borda.",
          "Use água recém saída do ponto de fervura (uns 92-96°C), não fervendo com força."
        ]
      },
      "steps": {
        "v60": [
          "Coloque o filtro de papel e enxágue com água quente para tirar o gosto de papel e preaquecer. Descarte essa água.",
          "Adicione os 15 g de café moído e nivele suavemente.",
          "Pré-infusão: despeje uns 45 ml de água quente (~92°C) e deixe descansar 30 segundos.",
          "Despeje o resto da água em círculos lentos de dentro para fora, sem tocar o filtro, até chegar a 225 ml.",
          "Deixe filtrar por completo."
        ],
        "chemex": [
          "Coloque o filtro de papel (tripla camada voltada para o bico) e enxágue bem com água quente. Descarte essa água.",
          "Adicione os 30 g de café e nivele.",
          "Pré-infusão: molhe o café com 70-80 ml de água em despejo circular. Espere 45 segundos.",
          "Despeje a água em espiral, em 2 ou 3 etapas, até chegar a 480 ml.",
          "Quando o gotejamento ficar bem lento, retire o filtro e sirva."
        ],
        "aeropress": [
          "Método invertido: apoie o êmbolo na mesa, com o cilindro encaixado na marca número 4.",
          "Adicione os 15 g de café dentro.",
          "Despeje uns 50 ml de água quente, mexa por 10 segundos e deixe descansar 20 segundos.",
          "Complete com água até uns 210 ml.",
          "Enxágue o filtro de papel na tampa, rosqueie na AeroPress, vire com firmeza sobre sua xícara e pressione devagar por uns 30 segundos até ouvir um leve assobio de ar."
        ]
      },
      "time": {
        "prensa": "4 min",
        "expreso": "25-30 seg",
        "moka": "4-5 min",
        "filtro": "3-4 min",
        "v60": "2:30 - 3:00 min",
        "chemex": "3:30 - 4:30 min",
        "aeropress": "1:30 - 2:00 min"
      },
      "waterTip": "💡 Use água mineral ou filtrada: 98% da xícara é água. Evite água fervendo com força — deixe descansar 1 minuto após ferver."
    }
  };
  
  let currentLang = localStorage.getItem('baristaLang') || 'es';

  // ML por tamaño, según cafetera (valores típicos por método)
  const BREWER_SIZES = {
    prensa:  { chico: 250, mediano: 350, grande: 500 },
    expreso: { chico: 25,  mediano: 50,  grande: 75  },
    moka:    { chico: 60,  mediano: 150, grande: 300 },
    filtro:  { chico: 200, mediano: 300, grande: 450 }
  };

  let BREWER_LABELS = I18N[currentLang].brewerNames;
  let BREWER_SUBS = I18N[currentLang].brewerSubs;
  let SIZE_NAMES = I18N[currentLang].sizeNames;
  let GRIND_OPTIONS = I18N[currentLang].grindOptions;

  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
  }

  // Guía de molienda según cafetera
  let GRIND_INFO = I18N[currentLang].grindInfo;

  // Cafeteras con receta base fija (sin selección de tamaño ni intensidad)
  const FIXED_RECIPE_BREWERS = ['expreso', 'moka', 'v60', 'chemex', 'aeropress', 'kalita', 'clever', 'coldbrew'];

  // Volumen base de los métodos con receta fija (se escala después con la dosis en el Paso 4).
  // Espresso: 36 g de rendimiento (18 g de café a 1:2). Ver js/data.js
  const FIXED_ML = BDATA.FIXED_ML;

  function resetRecipeState(){
    state.dose = null; state.ratio = null; state.recipe = null;
    state.roast = 'medio'; state.iced = false; state.recApplied = false;
  }

  function selectBrewer(brewer){
    state.brewer = brewer;
    state.size = null; state.ml = null; state.intensity = null;
    state.groundOrBean = null;
    resetRecipeState();

    if(FIXED_RECIPE_BREWERS.includes(brewer)){
      // sin pantalla de tamaño/intensidad: van directo a molienda con volumen fijo
      state.size = 'única';
      state.ml = FIXED_ML[brewer];
      state.intensity = null;
      prepareGrindScreen();
    } else {
      renderSizeScreen();
      showScreen('screen-size');
    }
  }

  function prepareGrindScreen(){
    document.getElementById('brewer-tag-grind').textContent = BREWER_LABELS[state.brewer];
    document.getElementById('grind-back-btn').textContent =
      FIXED_RECIPE_BREWERS.includes(state.brewer)
        ? I18N[currentLang].ui.backChangeCafetera
        : I18N[currentLang].ui.backChangeSizeIntensity;
    document.querySelectorAll('.choice-option').forEach(o => o.classList.remove('selected'));
    document.getElementById('grind-guide').style.display = 'none';
    document.getElementById('grind-next-btn').classList.remove('enabled');
    state.groundOrBean = null;
    showScreen('screen-grind');
  }

  function goBackFromGrind(){
    if(FIXED_RECIPE_BREWERS.includes(state.brewer)){
      showScreen('screen-brewer');
    } else {
      showScreen('screen-size');
    }
  }

  function goToGrindStep(){
    if(!state.size || !state.intensity) return;
    prepareGrindScreen();
  }

  function selectGroundOrBean(choice){
    state.groundOrBean = choice;
    document.querySelectorAll('.choice-option').forEach(o => {
      o.classList.toggle('selected', o.dataset.choice === choice);
    });

    const guide = document.getElementById('grind-guide');
    if(choice === 'grano'){
      const info = GRIND_INFO[state.brewer];
      document.getElementById('grind-level-tag').textContent = I18N[currentLang].ui.grindRecommended + info.level;
      document.getElementById('grind-name').textContent = info.level;
      document.getElementById('grind-texture').innerHTML = info.texture;
      guide.style.display = 'block';
    } else {
      guide.style.display = 'none';
    }
    document.getElementById('grind-next-btn').classList.add('enabled');
  }

  function goToBrewStep(){
    if(!state.groundOrBean) return;
    renderBrewScreen();
    showScreen('screen-brew');
  }

  // --- Datos para el Paso 4 ---
  let BREWER_TIPS = I18N[currentLang].tips;

  // Pasos detallados para métodos de vertido manual (en vez de tips sueltos)
  let BREWER_STEPS = I18N[currentLang].steps;

  // Cafeteras que muestran el tip de agua mineral/filtrada
  const WATER_TIP_BREWERS = ['v60', 'chemex', 'aeropress', 'kalita', 'clever', 'coldbrew'];

  let BREWER_TIME = I18N[currentLang].time;
  let WATER_TIP_TEXT = I18N[currentLang].waterTip;

  function getRatio(){
    // v2: si el usuario ajustó la receta en el Paso 4, manda ese ratio.
    if(state.ratio != null) return state.ratio;
    // Si no, el ratio base del método (prensa/filtro dependen de la intensidad). Ver js/logic.js
    return BL.baselineRatio(state.brewer, state.intensity);
  }

  // Render completo del Paso 4 (al entrar desde el flujo)
  function renderBrewScreen(){
    initRecipeForBrew();          // dosis / ratio iniciales (js/features.js)
    resetSensoryPanel();
    refreshBrewScreenTexts();
  }

  // Re-render de textos y números SIN borrar lo que el usuario escribió (p. ej. al cambiar de idioma)
  function refreshBrewScreenTexts(){
    if(!state.brewer) return;
    if(!state.recipe) initRecipeForBrew();
    document.getElementById('result-brewer-tag').textContent = BREWER_LABELS[state.brewer];
    const ui = I18N[currentLang].ui;
    document.getElementById('result-title').textContent =
      state.intensity
        ? `${ui.cafeWord} ${SIZE_NAMES[state.size]} · ${ui.intensidadWord} ${{suave: ui.intensitySuave, medio: ui.intensityMedio, fuerte: ui.intensityFuerte}[state.intensity]}`
        : `${ui.tuWord} ${BREWER_LABELS[state.brewer].toLowerCase()}`;

    document.getElementById('result-time').textContent = BREWER_TIME[state.brewer];

    document.getElementById('water-tip-card').style.display =
      WATER_TIP_BREWERS.includes(state.brewer) ? 'flex' : 'none';
    document.getElementById('txt-water-tip').textContent = WATER_TIP_TEXT;

    renderDoseWidget();      // js/features.js
    updateResultNumbers();   // números, pasos con cantidades y mini calculadora
    renderBrewExtras();
  }

  function resetApp(){
    state.brewer = null; state.size = null; state.ml = null;
    state.intensity = null; state.groundOrBean = null;
    resetRecipeState();
    showScreen('screen-brewer');
  }

  // --- Panel sensorial (Paso 4) ---
  let sensoryRatings = { acidez: 0, cuerpo: 0, dulzura: 0 };

  function resetSensoryPanel(){
    sensoryRatings = { acidez: 0, cuerpo: 0, dulzura: 0 };
    ['acidez', 'cuerpo', 'dulzura'].forEach(attr => renderSensoryDots(attr));
    const aroma = document.getElementById('sensory-aroma');
    const fragancia = document.getElementById('sensory-fragancia');
    const notas = document.getElementById('sensory-notas');
    const personal = document.getElementById('sensory-personal');
    const coffeeName = document.getElementById('sensory-coffee-name');
    const origin = document.getElementById('sensory-origin');
    const roastDate = document.getElementById('sensory-roast-date');
    if(aroma) aroma.value = '';
    if(fragancia) fragancia.value = '';
    if(notas) notas.value = '';
    if(personal) personal.value = '';
    if(coffeeName) coffeeName.value = '';
    if(origin) origin.value = '';
    if(roastDate) roastDate.value = '';
    const btn = document.getElementById('btn-add-ideal');
    if(btn) btn.textContent = I18N[currentLang].ui.btnAddIdeal;

    // los dos acordeones arrancan cerrados cada vez que se entra al Paso 4
    document.getElementById('sensory-panel').style.display = 'none';
    document.getElementById('sensory-chevron').textContent = 'v';
    document.getElementById('btn-toggle-sensory').setAttribute('aria-expanded', 'false');
    document.getElementById('calc-panel').style.display = 'none';
    document.getElementById('calc-chevron').textContent = 'v';
    document.getElementById('btn-toggle-calc').setAttribute('aria-expanded', 'false');
    const fresh = document.getElementById('sensory-fresh');
    if(fresh) fresh.innerHTML = '';
    resetMiniTimer();
    prefillMiniCalculator();
  }

  function toggleSensoryAccordion(){
    const panel = document.getElementById('sensory-panel');
    const chevron = document.getElementById('sensory-chevron');
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    chevron.textContent = isOpen ? 'v' : '^';
    document.getElementById('btn-toggle-sensory').setAttribute('aria-expanded', String(!isOpen));
  }

  function toggleCalcAccordion(){
    const panel = document.getElementById('calc-panel');
    const chevron = document.getElementById('calc-chevron');
    const isOpen = panel.style.display === 'block';
    if(!isOpen) prefillMiniCalculator();
    panel.style.display = isOpen ? 'none' : 'block';
    chevron.textContent = isOpen ? 'v' : '^';
    document.getElementById('btn-toggle-calc').setAttribute('aria-expanded', String(!isOpen));
  }

  // Indicador de frescura al escribir la fecha de tueste en el perfil sensorial
  function onSensoryRoastInput(){
    const el = document.getElementById('sensory-fresh');
    if(el) el.innerHTML = freshnessBadge(document.getElementById('sensory-roast-date').value, state.brewer);
  }

  // --- Mini calculadora dentro del acordeón del Paso 4 ---
  function prefillMiniCalculator(){
    if(state.ml){
      const ratio = getRatio();
      document.getElementById('mini-ratio').value = ratio;
      document.getElementById('mini-water').value = state.ml;
      document.getElementById('mini-coffee').value = (state.ml / ratio).toFixed(1);
    }
  }

  function onMiniWaterInput(){
    const ratio = parseFloat(document.getElementById('mini-ratio').value) || 16;
    const water = parseFloat(document.getElementById('mini-water').value) || 0;
    document.getElementById('mini-coffee').value = (water / ratio).toFixed(1);
  }

  function onMiniCoffeeInput(){
    const ratio = parseFloat(document.getElementById('mini-ratio').value) || 16;
    const coffee = parseFloat(document.getElementById('mini-coffee').value) || 0;
    document.getElementById('mini-water').value = (coffee * ratio).toFixed(0);
  }

  function onMiniRatioInput(){
    onMiniWaterInput();
  }

  // --- Mini cronómetro dentro del acordeón del Paso 4 (independiente del de la pantalla libre) ---
  // v2: basado en timestamps (Date.now) en vez de contar ticks → no se desfasa
  // si la pestaña queda en segundo plano o se bloquea el celular.
  let miniTimerRunning = false;
  let miniTimerInterval = null;
  let miniElapsedSeconds = 0;
  let miniBaseMs = 0;     // tiempo acumulado antes de la última pausa
  let miniAnchor = 0;     // momento en que se apretó "Iniciar"

  function updateMiniTimerDisplay(){
    miniElapsedSeconds = Math.floor((miniBaseMs + (miniTimerRunning ? Date.now() - miniAnchor : 0)) / 1000);
    document.getElementById('mini-timer-display').textContent = formatTime(miniElapsedSeconds);
  }

  function toggleMiniTimer(){
    if(miniTimerRunning){
      pauseMiniTimerInternal();
    } else {
      Feedback.unlock();
      miniTimerRunning = true;
      miniAnchor = Date.now();
      document.getElementById('mini-timer-start-btn').textContent = I18N[currentLang].ui.timerPause;
      clearInterval(miniTimerInterval);
      miniTimerInterval = setInterval(updateMiniTimerDisplay, 250);
      syncWakeLock();
    }
  }

  function pauseMiniTimerInternal(){
    if(miniTimerRunning) miniBaseMs += Date.now() - miniAnchor;
    miniTimerRunning = false;
    clearInterval(miniTimerInterval);
    document.getElementById('mini-timer-start-btn').textContent = I18N[currentLang].ui.timerStart;
    if(typeof syncWakeLock === 'function') syncWakeLock();
  }

  function resetMiniTimer(){
    pauseMiniTimerInternal();
    miniBaseMs = 0;
    updateMiniTimerDisplay();
  }

  function setSensoryRating(attr, value){
    sensoryRatings[attr] = (sensoryRatings[attr] === value) ? 0 : value;
    renderSensoryDots(attr);
  }

  function renderSensoryDots(attr){
    const container = document.querySelector('.sensory-dots[data-attr="' + attr + '"]');
    if(!container) return;
    const value = sensoryRatings[attr];
    container.querySelectorAll('.sensory-dot').forEach(dot => {
      dot.classList.toggle('filled', parseInt(dot.dataset.value) <= value);
    });
  }

  function addToIdealCoffee(){
    if(!state.brewer) return;
    if(!state.recipe) initRecipeForBrew();
    const r = state.recipe;
    const adj = BL.roastAdjust(state.brewer, state.roast);
    const grindLevel = GRIND_OPTIONS[adj.grindIdx] || (GRIND_INFO[state.brewer] ? GRIND_INFO[state.brewer].level : '');
    // v2: se guardan los puntos de vertido reales de la receta (cronograma de fases)
    const phasePoints = BL.phasesToPoints(currentPhases());

    const recipe = {
      id: Date.now(),
      brewer: state.brewer,
      grind: grindLevel,
      grams: r.dose,
      ratio: r.ratio,
      roast: state.roast,
      points: phasePoints.length ? phasePoints : [{ min: 0, sec: 0, ml: r.water }],
      timeText: BREWER_TIME[state.brewer],
      coffeeName: document.getElementById('sensory-coffee-name').value.trim(),
      origin: document.getElementById('sensory-origin').value.trim(),
      roastDate: document.getElementById('sensory-roast-date').value.trim(),
      sensory: { ...sensoryRatings },
      aroma: document.getElementById('sensory-aroma').value.trim(),
      fragancia: document.getElementById('sensory-fragancia').value.trim(),
      notas: document.getElementById('sensory-notas').value.trim(),
      personalNote: document.getElementById('sensory-personal').value.trim()
    };

    savedRecipes.push(recipe);
    persistSavedRecipes();

    const btn = document.getElementById('btn-add-ideal');
    btn.textContent = I18N[currentLang].ui.savedConfirm;
    setTimeout(() => { btn.textContent = I18N[currentLang].ui.btnAddIdeal; }, 1800);
    // v2: ofrecer registrarla también en la bitácora con puntaje y notas
    toast(I18N[currentLang].ui.savedConfirm, { action: { label: t('logThis'), fn: openLogFormFromBrew } });
  }

  // --- PASO 5: Calculadora libre (bidireccional) ---
  function onWaterInput(){
    const ratio = parseFloat(document.getElementById('free-ratio').value) || 16;
    const water = parseFloat(document.getElementById('free-water').value) || 0;
    document.getElementById('free-coffee').value = (water / ratio).toFixed(1);
  }

  function onCoffeeInput(){
    const ratio = parseFloat(document.getElementById('free-ratio').value) || 16;
    const coffee = parseFloat(document.getElementById('free-coffee').value) || 0;
    document.getElementById('free-water').value = (coffee * ratio).toFixed(0);
  }

  function onRatioInput(){
    // al cambiar la proporción, recalcula el café en base al agua actual
    onWaterInput();
  }

  function prefillFreeCalculator(){
    if(state.ml){
      const ratio = getRatio();
      document.getElementById('free-ratio').value = ratio;
      document.getElementById('free-water').value = state.ml;
      document.getElementById('free-coffee').value = (state.ml / ratio).toFixed(1);
    }
  }

  function goToFreeScreen(){
    prefillFreeCalculator();
    showScreen('screen-free');
  }

  function goBackFromFree(){
    if(state.brewer){
      showScreen('screen-brew');
    } else {
      showScreen('screen-brewer');
    }
  }

  // --- PASO 5: Cronómetro (cuenta arriba o cuenta regresiva) ---
  let timerMode = 'up';
  let timerRunning = false;
  let timerInterval = null;
  let elapsedSeconds = 0;       // usado en modo 'up'
  let countdownTarget = 240;    // segundos, usado en modo 'down'
  let remainingSeconds = 240;
  // v2: el tiempo se calcula desde el reloj, no sumando ticks
  let timerBaseMs = 0;
  let timerAnchor = 0;
  let lastCustomReached = 0;    // para avisar (sonido/vibración) al llegar a cada punto

  function formatTime(totalSeconds){
    const s = Math.max(0, Math.round(totalSeconds));
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = (s % 60).toString().padStart(2, '0');
    return mm + ':' + ss;
  }

  function setTimerMode(mode){
    pauseTimerInternal();
    timerMode = mode;
    document.getElementById('mode-up-btn').classList.toggle('active', mode === 'up');
    document.getElementById('mode-down-btn').classList.toggle('active', mode === 'down');
    document.getElementById('countdown-set').style.display = mode === 'down' ? 'flex' : 'none';
    resetTimer();
  }

  function applyCountdownTarget(){
    const min = parseInt(document.getElementById('countdown-min').value) || 0;
    const sec = parseInt(document.getElementById('countdown-sec').value) || 0;
    countdownTarget = min * 60 + sec;
    timerBaseMs = 0;
    if(timerRunning) timerAnchor = Date.now();
    remainingSeconds = countdownTarget;
    updateTimerDisplay();
  }

  function updateTimerDisplay(){
    const display = document.getElementById('timer-display');
    if(timerMode === 'up'){
      display.textContent = formatTime(elapsedSeconds);
      display.classList.remove('done');
    } else {
      display.textContent = formatTime(remainingSeconds);
      display.classList.toggle('done', remainingSeconds <= 0);
    }
    updateCustomPointStatus();
  }

  function toggleTimer(){
    if(timerRunning){
      pauseTimerInternal();
    } else {
      startTimerInternal();
    }
  }

  function timerElapsedMs(){
    return timerBaseMs + (timerRunning ? Date.now() - timerAnchor : 0);
  }

  // Recalcula el estado del cronómetro desde el reloj (también al volver a primer plano)
  function syncTimerFromClock(){
    const s = Math.floor(timerElapsedMs() / 1000);
    if(timerMode === 'up'){
      elapsedSeconds = s;
    } else {
      remainingSeconds = Math.max(0, countdownTarget - s);
      if(remainingSeconds <= 0 && timerRunning){
        pauseTimerInternal();
        updateTimerDisplay();
        notifyEvent('done', t('countdownDone'));
        return;
      }
    }
    updateTimerDisplay();
    checkCustomPointAlerts();
  }

  function startTimerInternal(){
    if(timerMode === 'down' && remainingSeconds <= 0){ timerBaseMs = 0; remainingSeconds = countdownTarget; }
    Feedback.unlock();
    timerRunning = true;
    timerAnchor = Date.now();
    document.getElementById('timer-start-btn').textContent = I18N[currentLang].ui.timerPause;
    clearInterval(timerInterval);
    timerInterval = setInterval(syncTimerFromClock, 250);
    syncWakeLock();
  }

  function pauseTimerInternal(){
    if(timerRunning) timerBaseMs += Date.now() - timerAnchor;
    timerRunning = false;
    clearInterval(timerInterval);
    document.getElementById('timer-start-btn').textContent = I18N[currentLang].ui.timerStart;
    if(typeof syncWakeLock === 'function') syncWakeLock();
  }

  function resetTimer(){
    pauseTimerInternal();
    timerBaseMs = 0;
    elapsedSeconds = 0;
    lastCustomReached = 0;
    remainingSeconds = countdownTarget;
    updateTimerDisplay();
  }

  // Sonido + vibración cada vez que el cronómetro ↑ llega a un punto del cronograma
  function checkCustomPointAlerts(){
    if(timerMode !== 'up' || !customPoints.length) return;
    const reachedPoints = customPoints.filter(p => pointSeconds(p) <= elapsedSeconds);
    if(timerRunning && reachedPoints.length > lastCustomReached){
      const last = reachedPoints.sort((a, b) => pointSeconds(b) - pointSeconds(a))[0];
      notifyEvent('phase', t('pointReached', { ml: last.ml }));
    }
    lastCustomReached = reachedPoints.length;
  }

  // --- PASO 5: Cronograma de vertido personalizado (puntos de tiempo + ML) ---
  let customPoints = []; // [{ min, sec, ml }]

  function addCustomPoint(){
    customPoints.push({ min: 0, sec: 30, ml: 0 });
    renderCustomPoints();
  }

  function removeCustomPoint(index){
    customPoints.splice(index, 1);
    renderCustomPoints();
    updateCustomPointStatus();
  }

  function updateCustomPoint(index, field, value){
    const num = parseFloat(value) || 0;
    customPoints[index][field] = num;
    updateCustomPointStatus();
  }

  function pointSeconds(point){
    return (point.min * 60) + point.sec;
  }

  function renderCustomPoints(){
    const list = document.getElementById('custom-points-list');
    list.innerHTML = '';
    customPoints.forEach((point, index) => {
      const row = document.createElement('div');
      row.className = 'custom-point-row';
      row.dataset.index = index;
      row.innerHTML = `
        <span class="cp-label">${t('cpAt')}</span>
        <input type="number" inputmode="numeric" class="cp-min" min="0" value="${point.min}" aria-label="${t('ariaPointMin', {n: index + 1})}" oninput="updateCustomPoint(${index}, 'min', this.value)">
        <span class="cp-label">min</span>
        <input type="number" inputmode="numeric" class="cp-sec" min="0" max="59" value="${point.sec}" aria-label="${t('ariaPointSec', {n: index + 1})}" oninput="updateCustomPoint(${index}, 'sec', this.value)">
        <span class="cp-label">${t('cpSecArrow')}</span>
        <input type="number" inputmode="numeric" class="cp-ml" min="0" value="${point.ml}" aria-label="${t('ariaPointMl', {n: index + 1})}" oninput="updateCustomPoint(${index}, 'ml', this.value)">
        <span class="cp-label">ml</span>
        <button type="button" class="cp-remove" onclick="removeCustomPoint(${index})" aria-label="${t('ariaRemovePoint', {n: index + 1})}">✕</button>
      `;
      list.appendChild(row);
    });
    updateCustomPointStatus();
  }

  function updateCustomPointStatus(){
    const statusBox = document.getElementById('custom-point-status');
    const rows = document.querySelectorAll('.custom-point-row');

    if(customPoints.length === 0 || timerMode !== 'up'){
      statusBox.style.display = 'none';
      rows.forEach(r => r.classList.remove('active', 'done'));
      return;
    }

    // ordenar los puntos por tiempo, de menor a mayor
    const sorted = customPoints
      .map((p, originalIndex) => ({ ...p, originalIndex, seconds: pointSeconds(p) }))
      .sort((a, b) => a.seconds - b.seconds);

    let current = null;
    let next = null;
    for(let i = 0; i < sorted.length; i++){
      if(sorted[i].seconds <= elapsedSeconds){
        current = sorted[i];
      } else {
        next = sorted[i];
        break;
      }
    }

    rows.forEach(row => {
      const idx = parseInt(row.dataset.index);
      const point = customPoints[idx];
      const seconds = pointSeconds(point);
      row.classList.toggle('done', seconds <= elapsedSeconds && (!current || current.originalIndex !== idx));
      row.classList.toggle('active', !!current && current.originalIndex === idx);
    });

    statusBox.style.display = 'block';
    const ui = I18N[currentLang].ui;
    if(next){
      statusBox.textContent = ui.proximoPunto.replace('{t}', formatTime(next.seconds)).replace('{ml}', next.ml);
    } else if(current){
      statusBox.textContent = ui.ultimoPunto.replace('{ml}', current.ml);
    } else {
      statusBox.textContent = ui.primerPunto.replace('{t}', formatTime(sorted[0].seconds)).replace('{ml}', sorted[0].ml);
    }
  }

  // --- MI CAFÉ IDEAL: recetas guardadas (persisten en el navegador con localStorage) ---
  let savedRecipes = [];

  function loadSavedRecipes(){
    try {
      const raw = localStorage.getItem('baristaSavedRecipes');
      savedRecipes = raw ? JSON.parse(raw) : [];
    } catch(e){
      savedRecipes = [];
    }
  }

  function persistSavedRecipes(){
    try {
      localStorage.setItem('baristaSavedRecipes', JSON.stringify(savedRecipes));
    } catch(e){
      console.log('No se pudo guardar en localStorage:', e);
    }
  }

  function goToSavedScreen(){
    formTimePoints = [];
    renderFormPoints();
    renderSavedRecipes();
    showScreen('screen-saved');
  }

  // Puntos de tiempo/ml del formulario que se está armando (antes de guardar)
  let formTimePoints = [];

  function addFormPoint(){
    formTimePoints.push({ min: 0, sec: 30, ml: 0 });
    renderFormPoints();
  }

  function removeFormPoint(index){
    formTimePoints.splice(index, 1);
    renderFormPoints();
  }

  function updateFormPoint(index, field, value){
    formTimePoints[index][field] = parseFloat(value) || 0;
  }

  function renderFormPoints(){
    const list = document.getElementById('saved-time-points-list');
    list.innerHTML = '';
    formTimePoints.forEach((point, index) => {
      const row = document.createElement('div');
      row.className = 'custom-point-row';
      row.innerHTML = `
        <span class="cp-label">${t('cpAt')}</span>
        <input type="number" inputmode="numeric" class="cp-min" min="0" value="${point.min}" aria-label="${t('ariaPointMin', {n: index + 1})}" oninput="updateFormPoint(${index}, 'min', this.value)">
        <span class="cp-label">min</span>
        <input type="number" inputmode="numeric" class="cp-sec" min="0" max="59" value="${point.sec}" aria-label="${t('ariaPointSec', {n: index + 1})}" oninput="updateFormPoint(${index}, 'sec', this.value)">
        <span class="cp-label">${t('cpSecArrow')}</span>
        <input type="number" inputmode="numeric" class="cp-ml" min="0" value="${point.ml}" aria-label="${t('ariaPointMl', {n: index + 1})}" oninput="updateFormPoint(${index}, 'ml', this.value)">
        <span class="cp-label">ml</span>
        <button type="button" class="cp-remove" onclick="removeFormPoint(${index})" aria-label="${t('ariaRemovePoint', {n: index + 1})}">✕</button>
      `;
      list.appendChild(row);
    });
  }

  function saveNewRecipe(){
    const brewer = document.getElementById('saved-brewer-select').value;
    const grind = document.getElementById('saved-grind-select').value;
    const grams = parseFloat(document.getElementById('saved-grams').value) || 0;

    if(!grams || formTimePoints.length === 0){
      toast(I18N[currentLang].ui.alertCompleteFields);
      return;
    }

    const points = formTimePoints.map(p => ({ min: p.min, sec: p.sec, ml: p.ml }));
    savedRecipes.push({ id: Date.now(), brewer, grind, grams, points });
    persistSavedRecipes();
    renderSavedRecipes();

    document.getElementById('saved-grams').value = '';
    formTimePoints = [];
    renderFormPoints();
  }

  function deleteSavedRecipe(id){
    const idx = savedRecipes.findIndex(r => r.id === id);
    if(idx < 0) return;
    const [removed] = savedRecipes.splice(idx, 1);
    persistSavedRecipes();
    renderSavedRecipes();
    toast(t('deleted'), { action: { label: t('undo'), fn: () => {
      savedRecipes.splice(idx, 0, removed); persistSavedRecipes(); renderSavedRecipes();
    } } });
  }

  // v2: usar una receta guardada carga el método y la dosis directo en el Paso 4 (2 toques)
  function useSavedRecipe(id){
    const r = savedRecipes.find(x => x.id === id);
    if(!r) return;
    const maxMl = (r.points || []).reduce((m, p) => Math.max(m, p.ml || 0), 0);
    loadRecipeIntoFlow({ method: r.brewer, dose: r.grams, water: maxMl, ratio: r.ratio, roast: r.roast,
                         coffeeName: r.coffeeName, origin: r.origin });
  }

  function renderSavedRecipes(){
    const list = document.getElementById('saved-recipes-list');
    const emptyMsg = document.getElementById('saved-recipes-empty');
    list.innerHTML = '';

    if(savedRecipes.length === 0){
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    // v2: todo el texto del usuario se escapa (evita inyección de HTML, clave al importar recetas compartidas)
    const e = BL.escapeHtml;
    savedRecipes.forEach(recipe => {
      const row = document.createElement('div');
      row.className = 'saved-recipe-row';
      const ui = I18N[currentLang].ui;
      const pointsText = (recipe.points || [])
        .slice()
        .sort((a, b) => (a.min * 60 + a.sec) - (b.min * 60 + b.sec))
        .map(p => `${formatTime(p.min * 60 + p.sec)} → ${p.ml} ml`)
        .join(' · ');

      let extraLines = '';
      if(recipe.origin){
        extraLines += `<div class="saved-recipe-details" style="margin-top:4px;">📍 ${e(ui.coffeeOrigin)}: ${e(recipe.origin)}</div>`;
      }
      if(recipe.roastDate){
        extraLines += `<div class="saved-recipe-details" style="margin-top:2px;">🔥 ${e(ui.coffeeRoastDate)}: ${e(recipe.roastDate)} ${freshnessBadge(recipe.roastDate, recipe.brewer)}</div>`;
      }
      if(recipe.timeText){
        extraLines += `<div class="saved-recipe-details" style="margin-top:4px;">⏱ ${e(recipe.timeText)}</div>`;
      }
      if(recipe.sensory && (recipe.sensory.acidez || recipe.sensory.cuerpo || recipe.sensory.dulzura)){
        extraLines += `<div class="saved-recipe-details" style="margin-top:4px;">${e(ui.sensoryAcidez)} ${+recipe.sensory.acidez || 0}/5 · ${e(ui.sensoryCuerpo)} ${+recipe.sensory.cuerpo || 0}/5 · ${e(ui.sensoryDulzura)} ${+recipe.sensory.dulzura || 0}/5</div>`;
      }
      if(recipe.aroma){
        extraLines += `<div class="saved-recipe-details" style="margin-top:4px;">${e(ui.sensoryAroma)}: ${e(recipe.aroma)}</div>`;
      }
      if(recipe.fragancia){
        extraLines += `<div class="saved-recipe-details" style="margin-top:2px;">${e(ui.sensoryFragancia)}: ${e(recipe.fragancia)}</div>`;
      }
      if(recipe.notas){
        extraLines += `<div class="saved-recipe-details" style="margin-top:2px;">${e(ui.sensoryNotas)}: ${e(recipe.notas)}</div>`;
      }
      if(recipe.personalNote){
        extraLines += `<div class="saved-recipe-details" style="margin-top:2px; font-style:italic;">"${e(recipe.personalNote)}"</div>`;
      }

      const brewerName = e(BREWER_LABELS[recipe.brewer] || recipe.brewer);
      const titleLine = recipe.coffeeName
        ? `${e(recipe.coffeeName)} <span class="saved-recipe-sub">· ${brewerName}</span>`
        : brewerName;
      const id = Number(recipe.id) || 0;
      const ratioTxt = recipe.ratio ? ` · 1:${recipe.ratio}` : '';

      row.innerHTML = `
        <div class="saved-recipe-main">
          <div class="saved-recipe-brewer">${titleLine}</div>
          <div class="saved-recipe-details">${e(recipe.grind)} · ${e(recipe.grams)} g${ratioTxt}</div>
          <div class="saved-recipe-details" style="margin-top:4px;">${e(pointsText)}</div>
          ${extraLines}
          <div class="saved-recipe-actions">
            <button type="button" class="mini-btn" onclick="useSavedRecipe(${id})">▶ ${e(t('useRecipe'))}</button>
            <button type="button" class="mini-btn" onclick="shareRecipe(${id})">↗ ${e(t('shareRecipe'))}</button>
            ${typeof cloudPublishButton === 'function' ? cloudPublishButton(recipe) : ''}
          </div>
        </div>
        <button type="button" class="saved-recipe-remove" onclick="armDelete(this, () => deleteSavedRecipe(${id}))" aria-label="${e(t('ariaDelete'))}">✕</button>
      `;
      list.appendChild(row);
    });
  }

  // --- Sistema de traducción / idioma ---
  const I18N_ID_MAP = {
    'txt-eyebrow':'eyebrow', 'txt-h1':'h1', 'txt-subtitle':'subtitle',
    'txt-step1-label':'step1Label', 'txt-footnote':'footnote', 'btn-gofree-home':'goFreeHome',
    'txt-step2-label':'step2Label', 'txt-question-size':'questionSize', 'txt-question-intensity':'questionIntensity',
    'txt-intensity-suave':'intensitySuave', 'txt-intensity-medio':'intensityMedio', 'txt-intensity-fuerte':'intensityFuerte',
    'size-next-btn':'continueBtn', 'btn-back-size':'backChangeCafetera',
    'txt-step3-label':'step3Label', 'txt-question-grind':'questionGrind',
    'txt-choice-molido':'choiceMolido', 'txt-choice-grano':'choiceGrano', 'grind-next-btn':'continueBtn',
    'txt-step4-label':'step4Label', 'txt-label-mlagua':'labelMlAgua', 'txt-label-gcafe':'labelGCafe',
    'txt-time-label':'timeLabel', 'btn-reset-app':'btnResetApp',
    'txt-accordion-calc':'accordionCalcTitle',
    'txt-ratio-pre-mini':'ratioPre', 'txt-ratio-post-mini':'ratioPost',
    'txt-label-agua-calc-mini':'labelAguaCalc', 'txt-label-cafe-calc-mini':'labelCafeCalc',
    'txt-open-full-calc':'openFullCalc',
    'btn-back-brew':'backVolverMolienda',
    'txt-step5-label':'step5Label', 'btn-back-free':'backVolver',
    'txt-calc-title':'calcTitle', 'txt-ratio-pre':'ratioPre', 'txt-ratio-post':'ratioPost',
    'txt-label-agua-calc':'labelAguaCalc', 'txt-label-cafe-calc':'labelCafeCalc',
    'txt-timer-title':'timerTitle', 'mode-up-btn':'modeUp', 'mode-down-btn':'modeDown',
    'txt-meta-label':'metaLabel', 'txt-min-label1':'minLabel', 'txt-seg-label1':'segLabel',
    'btn-fijar':'btnFijar', 'btn-timer-reset':'timerReset',
    'txt-schedule-title':'scheduleTitle', 'txt-schedule-desc':'scheduleDesc', 'btn-add-custom-point':'btnAddPoint',
    'btn-back-saved':'backVolverInicio', 'txt-saved-label':'savedLabel', 'txt-save-recipe-title':'saveRecipeTitle',
    'txt-label-cafetera':'labelCafetera', 'txt-label-molienda':'labelMolienda', 'txt-label-cafe-form':'labelCafeForm',
    'txt-points-desc':'pointsDesc', 'btn-add-form-point':'btnAddPoint', 'btn-save-recipe':'btnSaveRecipe',
    'txt-my-recipes-title':'myRecipesTitle', 'saved-recipes-empty':'savedRecipesEmpty',
    'txt-settings-title':'settingsTitle', 'btn-settings-close':'closeBtn',
    'txt-sensory-title':'sensoryTitle', 'txt-sensory-acidez':'sensoryAcidez',
    'txt-sensory-cuerpo':'sensoryCuerpo', 'txt-sensory-dulzura':'sensoryDulzura',
    'txt-sensory-aroma':'sensoryAroma', 'txt-sensory-fragancia':'sensoryFragancia',
    'txt-sensory-notas':'sensoryNotas', 'txt-sensory-personal':'sensoryPersonal',
    'txt-theme-label':'themeLabel',
    'txt-coffee-info-title':'coffeeInfoTitle', 'txt-coffee-name':'coffeeNameLabel',
    'txt-coffee-origin':'coffeeOrigin', 'txt-coffee-roast-date':'coffeeRoastDate'
  };

  const I18N_PLACEHOLDER_MAP = {
    'sensory-aroma':'placeholderAroma', 'sensory-fragancia':'placeholderFragancia',
    'sensory-notas':'placeholderNotas', 'sensory-personal':'placeholderPersonal',
    'sensory-coffee-name':'placeholderCoffeeName', 'sensory-origin':'placeholderOrigin',
    'sensory-roast-date':'placeholderRoastDate'
  };

  const BREWER_KEYS_ALL = ['prensa','expreso','moka','filtro','v60','chemex','aeropress','saved'];

  function updateLangButtons(){
    ['es','pt','en'].forEach(l => {
      const btn = document.getElementById('lang-' + l);
      if(btn) btn.classList.toggle('active', l === currentLang);
    });
  }

  // --- Sistema de temas de color ---
  let currentTheme = localStorage.getItem('baristaTheme') || 'standard';

  function applyTheme(theme){
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('baristaTheme', theme); } catch(e){}
    updateThemeUI();
  }

  function toggleLightDark(){
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  }

  function setTheme(theme){
    applyTheme(theme);
  }

  function updateThemeUI(){
    const ui = I18N[currentLang].ui;
    const icon = document.getElementById('theme-toggle-icon');
    const label = document.getElementById('txt-theme-toggle-label');
    if(currentTheme === 'dark'){
      icon.textContent = '🌙';
      label.textContent = ui.themeDark;
    } else {
      icon.textContent = '☀️';
      label.textContent = ui.themeLight;
    }
    document.querySelectorAll('.theme-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.theme === currentTheme);
      sw.title = ui['theme_' + sw.dataset.theme] || '';
    });
  }

  function openSettings(){
    document.getElementById('settings-overlay').classList.add('open');
    updateLangButtons();
  }

  function closeSettings(){
    document.getElementById('settings-overlay').classList.remove('open');
  }

  function closeSettingsOutside(event){
    if(event.target.id === 'settings-overlay') closeSettings();
  }

  function applyTranslations(){
    const ui = I18N[currentLang].ui;

    Object.keys(I18N_ID_MAP).forEach(id => {
      const el = document.getElementById(id);
      if(el) el.textContent = ui[I18N_ID_MAP[id]];
    });

    document.getElementById('txt-water-tip').textContent = WATER_TIP_TEXT;

    Object.keys(I18N_PLACEHOLDER_MAP).forEach(id => {
      const el = document.getElementById(id);
      if(el) el.placeholder = ui[I18N_PLACEHOLDER_MAP[id]];
    });

    const addIdealBtn = document.getElementById('btn-add-ideal');
    if(addIdealBtn) addIdealBtn.textContent = ui.btnAddIdeal;

    BREWER_KEYS_ALL.forEach(b => {
      const nameEl = document.getElementById('bname-' + b);
      const subEl = document.getElementById('bsub-' + b);
      if(nameEl) nameEl.textContent = BREWER_LABELS[b];
      if(subEl) subEl.textContent = BREWER_SUBS[b];
    });

    const grindSelect = document.getElementById('saved-grind-select');
    if(grindSelect){
      const prevIndex = grindSelect.selectedIndex >= 0 ? grindSelect.selectedIndex : 0;
      grindSelect.innerHTML = GRIND_OPTIONS.map(o => '<option>' + o + '</option>').join('');
      grindSelect.selectedIndex = prevIndex;
    }

    updateLangButtons();
    updateThemeUI();

    // Re-renderizar pantallas dinámicas si ya hay una cafetera elegida
    if(state.brewer){
      if(!FIXED_RECIPE_BREWERS.includes(state.brewer)){
        renderSizeScreen();
        if(state.size){
          document.querySelectorAll('.size-option').forEach(o => o.classList.toggle('selected', o.dataset.size === state.size));
        }
        if(state.intensity){
          document.querySelectorAll('.intensity-option').forEach(o => o.classList.toggle('selected', o.dataset.intensity === state.intensity));
        }
        updateNextButton();
      }
      const grindTag = document.getElementById('brewer-tag-grind');
      if(grindTag) grindTag.textContent = BREWER_LABELS[state.brewer];
      const grindBackBtn = document.getElementById('grind-back-btn');
      if(grindBackBtn){
        grindBackBtn.textContent = FIXED_RECIPE_BREWERS.includes(state.brewer) ? ui.backChangeCafetera : ui.backChangeSizeIntensity;
      }
      if(state.groundOrBean === 'grano'){
        const info = GRIND_INFO[state.brewer];
        document.getElementById('grind-level-tag').textContent = ui.grindRecommended + info.level;
        document.getElementById('grind-name').textContent = info.level;
        document.getElementById('grind-texture').innerHTML = info.texture;
      }
      if(state.groundOrBean){
        // v2: no se borra lo que el usuario escribió al cambiar de idioma
        refreshBrewScreenTexts();
      }
    }

    document.getElementById('timer-start-btn').textContent = timerRunning ? ui.timerPause : ui.timerStart;
    document.getElementById('mini-timer-start-btn').textContent = miniTimerRunning ? ui.timerPause : ui.timerStart;
    renderCustomPoints();
    renderFormPoints();
    renderSavedRecipes();
    applyTranslationsExt();   // textos nuevos (js/features.js)
  }

  function setLanguage(lang){
    currentLang = lang;
    try { localStorage.setItem('baristaLang', lang); } catch(e){}
    BREWER_LABELS = I18N[lang].brewerNames;
    BREWER_SUBS = I18N[lang].brewerSubs;
    SIZE_NAMES = I18N[lang].sizeNames;
    GRIND_OPTIONS = I18N[lang].grindOptions;
    GRIND_INFO = I18N[lang].grindInfo;
    BREWER_TIPS = I18N[lang].tips;
    BREWER_STEPS = I18N[lang].steps;
    BREWER_TIME = I18N[lang].time;
    WATER_TIP_TEXT = I18N[lang].waterTip;
    applyTranslations();
    closeSettings();
  }

  // v2: el arranque (migraciones, carga de datos, traducciones y tema) ahora lo hace
  // bootV2() al final de js/features.js, que se carga después de este script.

  // Registro del service worker (necesario para que la PWA funcione offline)
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => {
        console.log('No se pudo registrar el service worker:', err);
      });
    });
  }

  function renderSizeScreen(){
    document.getElementById('brewer-tag-size').textContent = BREWER_LABELS[state.brewer];
    const sizes = BREWER_SIZES[state.brewer];
    const row = document.getElementById('size-row');
    row.innerHTML = '';
    const names = SIZE_NAMES;
    Object.keys(sizes).forEach(key => {
      const el = document.createElement('div');
      el.className = 'size-option';
      el.dataset.size = key;
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.onclick = () => selectSize(key, sizes[key]);
      el.innerHTML = `<span class="size-name">${names[key]}</span><span class="size-ml">${sizes[key]} ml</span>`;
      row.appendChild(el);
    });
    // limpiar selección visual de intensidad al re-renderizar
    document.querySelectorAll('.intensity-option').forEach(o => o.classList.remove('selected'));
    updateNextButton();
  }

  function selectSize(key, ml){
    state.size = key;
    state.ml = ml;
    resetRecipeState();   // nueva taza → se recalcula la receta desde la base
    document.querySelectorAll('.size-option').forEach(o => {
      o.classList.toggle('selected', o.dataset.size === key);
    });
    updateNextButton();
  }

  function selectIntensity(level){
    state.intensity = level;
    if(!state.pendingRec) { const keep = state.roast; resetRecipeState(); state.roast = keep; }
    document.querySelectorAll('.intensity-option').forEach(o => {
      o.classList.toggle('selected', o.dataset.intensity === level);
    });
    updateNextButton();
  }

  function updateNextButton(){
    const btn = document.getElementById('size-next-btn');
    const ready = state.size && state.intensity;
    btn.classList.toggle('enabled', !!ready);
  }


