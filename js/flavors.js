/* =====================================================================
 * Barista de Bolsillo — RUEDA DE SABORES (datos editables)
 * ---------------------------------------------------------------------
 * Taxonomía propia de la app, en 3 niveles:
 *   categoría (anillo interior) → familia (anillo medio) → sabor (anillo exterior)
 * Pensada para catadores que empiezan: vocabulario cotidiano y argentino
 * (dulce de leche, mate, galletita), del aroma general al específico.
 *
 * Formato:
 *   categoría: { id, color, name:[es,en,pt], desc:[es,en,pt], children:[familias] }
 *   familia:   { id, name:[es,en,pt], desc:[es,en,pt], children:[sabores] }
 *   sabor:     [id, es, en, pt, tipEs, tipEn, tipPt]   ← tip = cómo reconocerlo
 *
 * Para agregar un sabor: sumá un array a la familia. Los ids no se repiten.
 * Verificación: node tests/check-i18n.mjs
 * ===================================================================== */
const FLAVOR_WHEEL_RAW = [
  { id: 'frutal', color: '#C8384A',
    name: ['Frutal', 'Fruity', 'Frutado'],
    desc: ['Aromas a fruta fresca, madura o seca. Muy típicos de cafés de altura y tuestes claros.',
           'Fresh, ripe or dried fruit aromas. Very typical of high-grown coffees and light roasts.',
           'Aromas de fruta fresca, madura ou seca. Muito típicos de cafés de altitude e torras claras.'],
    children: [
      { id: 'frutos-rojos', name: ['Frutos rojos', 'Berries', 'Frutas vermelhas'],
        desc: ['Dulces y ácidos a la vez, jugosos. Frecuentes en cafés de Etiopía y Kenia.', 'Sweet and tart at once, juicy. Common in Ethiopian and Kenyan coffees.', 'Doces e ácidas ao mesmo tempo, suculentas. Frequentes em cafés da Etiópia e do Quênia.'],
        children: [
          ['frutilla', 'Frutilla', 'Strawberry', 'Morango', 'Mermelada de frutilla o frutilla bien madura.', 'Strawberry jam or very ripe strawberries.', 'Geleia de morango ou morango bem maduro.'],
          ['frambuesa', 'Frambuesa', 'Raspberry', 'Framboesa', 'Más ácida y perfumada que la frutilla.', 'Tarter and more perfumed than strawberry.', 'Mais ácida e perfumada que o morango.'],
          ['arandano', 'Arándano', 'Blueberry', 'Mirtilo', 'Dulce, profundo, un poco terroso. Clásico de naturales etíopes.', 'Sweet, deep, slightly earthy. A classic of natural Ethiopians.', 'Doce, profundo, um pouco terroso. Clássico dos naturais etíopes.'],
          ['mora', 'Mora', 'Blackberry', 'Amora', 'Fruta oscura, jugosa, con un final algo ácido.', 'Dark, juicy fruit with a slightly tart finish.', 'Fruta escura, suculenta, com final um pouco ácido.'],
          ['cereza', 'Cereza', 'Cherry', 'Cereja', 'Dulce y redonda; recuerda a la cereza en almíbar.', 'Sweet and round, like cherries in syrup.', 'Doce e redonda; lembra cereja em calda.'],
          ['grosella', 'Grosella', 'Redcurrant', 'Groselha', 'Ácida y brillante, típica de Kenia.', 'Bright and sour, typical of Kenya.', 'Ácida e brilhante, típica do Quênia.']
        ] },
      { id: 'citricos', name: ['Cítricos', 'Citrus', 'Cítricos'],
        desc: ['Acidez brillante y refrescante, como la cáscara o el jugo de cítricos.', 'Bright, refreshing acidity, like citrus peel or juice.', 'Acidez brilhante e refrescante, como casca ou suco de cítricos.'],
        children: [
          ['limon', 'Limón', 'Lemon', 'Limão-siciliano', 'Acidez aguda, limpia. Rallá cáscara de limón y olela.', 'Sharp, clean acidity. Zest a lemon and smell it.', 'Acidez aguda e limpa. Rale a casca do limão e cheire.'],
          ['lima', 'Lima', 'Lime', 'Limão', 'Más verde y herbal que el limón.', 'Greener and more herbal than lemon.', 'Mais verde e herbal que o limão-siciliano.'],
          ['naranja', 'Naranja', 'Orange', 'Laranja', 'Dulce y jugosa, menos ácida que el limón.', 'Sweet and juicy, less sour than lemon.', 'Doce e suculenta, menos ácida que o limão.'],
          ['mandarina', 'Mandarina', 'Tangerine', 'Tangerina', 'Muy dulce y perfumada.', 'Very sweet and fragrant.', 'Muito doce e perfumada.'],
          ['pomelo', 'Pomelo', 'Grapefruit', 'Toranja', 'Cítrico con un toque amargo al final.', 'Citrus with a bitter touch at the end.', 'Cítrico com um toque amargo no final.']
        ] },
      { id: 'carozo', name: ['Frutas de carozo', 'Stone fruit', 'Frutas de caroço'],
        desc: ['Fruta carnosa y dulce, de acidez suave.', 'Fleshy, sweet fruit with gentle acidity.', 'Fruta carnuda e doce, de acidez suave.'],
        children: [
          ['durazno', 'Durazno', 'Peach', 'Pêssego', 'Dulce, aterciopelado, muy aromático.', 'Sweet, velvety, very aromatic.', 'Doce, aveludado, muito aromático.'],
          ['damasco', 'Damasco', 'Apricot', 'Damasco', 'Parecido al durazno pero más ácido.', 'Like peach but tarter.', 'Parecido com pêssego, mas mais ácido.'],
          ['ciruela', 'Ciruela', 'Plum', 'Ameixa', 'Fruta oscura, jugosa, algo ácida en la piel.', 'Dark, juicy fruit, a little tart in the skin.', 'Fruta escura, suculenta, um pouco ácida na casca.'],
          ['nectarina', 'Pelón', 'Nectarine', 'Nectarina', 'Durazno sin pelusa: más jugoso y brillante.', 'A fuzzless peach: juicier and brighter.', 'Pêssego sem pelinho: mais suculento e brilhante.']
        ] },
      { id: 'tropicales', name: ['Tropicales', 'Tropical', 'Tropicais'],
        desc: ['Fruta muy madura y exótica, intensa. Común en procesos naturales y anaeróbicos.', 'Very ripe, exotic, intense fruit. Common in natural and anaerobic processes.', 'Fruta muito madura e exótica, intensa. Comum em processos naturais e anaeróbicos.'],
        children: [
          ['anana', 'Ananá', 'Pineapple', 'Abacaxi', 'Dulce y ácido a la vez, muy jugoso.', 'Sweet and sour at once, very juicy.', 'Doce e ácido ao mesmo tempo, muito suculento.'],
          ['mango', 'Mango', 'Mango', 'Manga', 'Dulce, denso, casi cremoso.', 'Sweet, dense, almost creamy.', 'Doce, denso, quase cremoso.'],
          ['maracuya', 'Maracuyá', 'Passion fruit', 'Maracujá', 'Muy ácido y perfumado.', 'Very tart and perfumed.', 'Muito ácido e perfumado.'],
          ['banana', 'Banana', 'Banana', 'Banana', 'Banana madura, casi como un licuado.', 'Ripe banana, almost like a smoothie.', 'Banana madura, quase como uma vitamina.'],
          ['coco', 'Coco', 'Coconut', 'Coco', 'Dulce, cremoso, un poco a nuez.', 'Sweet, creamy, slightly nutty.', 'Doce, cremoso, um pouco amendoado.']
        ] },
      { id: 'pomaceas', name: ['Manzana, pera y uva', 'Apple, pear & grape', 'Maçã, pera e uva'],
        desc: ['Fruta fresca y crocante, de acidez limpia.', 'Fresh, crisp fruit with clean acidity.', 'Fruta fresca e crocante, de acidez limpa.'],
        children: [
          ['manzana-verde', 'Manzana verde', 'Green apple', 'Maçã verde', 'Acidez crocante y fresca (ácido málico).', 'Crisp, fresh acidity (malic acid).', 'Acidez crocante e fresca (ácido málico).'],
          ['manzana-roja', 'Manzana roja', 'Red apple', 'Maçã vermelha', 'Más dulce y madura que la verde.', 'Sweeter and riper than green apple.', 'Mais doce e madura que a verde.'],
          ['pera', 'Pera', 'Pear', 'Pera', 'Dulce, suave y jugosa.', 'Sweet, soft and juicy.', 'Doce, suave e suculenta.'],
          ['uva', 'Uva', 'Grape', 'Uva', 'Dulce y jugosa, como uva blanca o rosada.', 'Sweet and juicy, like white or red grapes.', 'Doce e suculenta, como uva branca ou rosada.']
        ] },
      { id: 'frutas-secas', name: ['Frutas desecadas', 'Dried fruit', 'Frutas secas'],
        desc: ['Fruta concentrada y dulce, sin acidez fresca. Típica de naturales y tuestes medios.', 'Concentrated, sweet fruit without fresh acidity. Typical of naturals and medium roasts.', 'Fruta concentrada e doce, sem acidez fresca. Típica de naturais e torras médias.'],
        children: [
          ['pasas', 'Pasas de uva', 'Raisin', 'Uva-passa', 'Dulce y concentrado, como pasas de uva.', 'Sweet and concentrated, like raisins.', 'Doce e concentrado, como uva-passa.'],
          ['higo', 'Higo seco', 'Dried fig', 'Figo seco', 'Dulce, profundo, con algo de miel.', 'Sweet and deep, somewhat honeyed.', 'Doce, profundo, com algo de mel.'],
          ['datil', 'Dátil', 'Date', 'Tâmara', 'Muy dulce, casi acaramelado.', 'Very sweet, almost caramel-like.', 'Muito doce, quase caramelizado.'],
          ['ciruela-pasa', 'Ciruela pasa', 'Prune', 'Ameixa seca', 'Fruta oscura concentrada, levemente ácida.', 'Concentrated dark fruit, slightly tart.', 'Fruta escura concentrada, levemente ácida.']
        ] }
    ] },

  { id: 'floral', color: '#B9649E',
    name: ['Floral', 'Floral', 'Floral'],
    desc: ['Aromas delicados a flores e infusiones. Se perciben mejor con el café tibio y en tuestes claros.',
           'Delicate flower and tea aromas. Best noticed when the coffee is warm and in light roasts.',
           'Aromas delicados de flores e infusões. Percebidos melhor com o café morno e em torras claras.'],
    children: [
      { id: 'flores', name: ['Flores', 'Flowers', 'Flores'],
        desc: ['Perfumado y liviano, se siente más en el aroma que en la boca.', 'Perfumed and light, felt more in the aroma than on the palate.', 'Perfumado e leve, sentido mais no aroma do que na boca.'],
        children: [
          ['jazmin', 'Jazmín', 'Jasmine', 'Jasmim', 'Flor blanca, dulce e intensa. Clásica de Etiopía.', 'Sweet, intense white flower. A classic of Ethiopia.', 'Flor branca, doce e intensa. Clássica da Etiópia.'],
          ['azahar', 'Azahar', 'Orange blossom', 'Flor de laranjeira', 'Flor de naranjo: floral con algo cítrico.', 'Orange blossom: floral with a citrus edge.', 'Floral com algo cítrico.'],
          ['rosa', 'Rosa', 'Rose', 'Rosa', 'Floral dulce y empolvado.', 'Sweet, powdery floral.', 'Floral doce e empoado.'],
          ['lavanda', 'Lavanda', 'Lavender', 'Lavanda', 'Floral herbal, fresco.', 'Herbal, fresh floral.', 'Floral herbal, fresco.'],
          ['madreselva', 'Madreselva', 'Honeysuckle', 'Madressilva', 'Flor dulce con algo de miel.', 'Sweet flower with a honey note.', 'Flor doce com algo de mel.']
        ] },
      { id: 'infusiones', name: ['Té e infusiones', 'Tea & infusions', 'Chás e infusões'],
        desc: ['Recuerda a un té: liviano, limpio, a veces con un leve amargor.', 'Tea-like: light, clean, sometimes slightly bitter.', 'Lembra um chá: leve, limpo, às vezes com leve amargor.'],
        children: [
          ['te-negro', 'Té negro', 'Black tea', 'Chá preto', 'Taninos suaves y final seco, como un té en hebras.', 'Soft tannins and a dry finish, like loose-leaf tea.', 'Taninos suaves e final seco, como chá em folhas.'],
          ['te-verde', 'Té verde', 'Green tea', 'Chá verde', 'Vegetal y fresco.', 'Vegetal and fresh.', 'Vegetal e fresco.'],
          ['manzanilla', 'Manzanilla', 'Chamomile', 'Camomila', 'Floral suave, un poco a miel.', 'Soft floral, a bit honeyed.', 'Floral suave, um pouco de mel.'],
          ['bergamota', 'Bergamota', 'Bergamot', 'Bergamota', 'El aroma del té Earl Grey.', 'The aroma of Earl Grey tea.', 'O aroma do chá Earl Grey.'],
          ['hibisco', 'Hibisco', 'Hibiscus', 'Hibisco', 'Floral ácido, como un té de flor de Jamaica.', 'Tart floral, like hibiscus tea.', 'Floral ácido, como chá de hibisco.']
        ] }
    ] },

  { id: 'dulce', color: '#D9902F',
    name: ['Dulce', 'Sweet', 'Doce'],
    desc: ['Sensación de dulzor y aromas de azúcar cocida. Señal de una buena extracción.',
           'Sweetness and cooked-sugar aromas. A sign of good extraction.',
           'Sensação de doçura e aromas de açúcar cozido. Sinal de boa extração.'],
    children: [
      { id: 'azucares', name: ['Azúcares', 'Sugars', 'Açúcares'],
        desc: ['Dulzor natural y limpio.', 'Clean, natural sweetness.', 'Doçura natural e limpa.'],
        children: [
          ['azucar-morena', 'Azúcar mascabo', 'Brown sugar', 'Açúcar mascavo', 'Dulce con un toque a melaza.', 'Sweet with a hint of molasses.', 'Doce com um toque de melaço.'],
          ['miel', 'Miel', 'Honey', 'Mel', 'Dulce, floral y redondo.', 'Sweet, floral and round.', 'Doce, floral e redondo.'],
          ['arce', 'Jarabe de arce', 'Maple syrup', 'Xarope de bordo', 'Dulce con algo amaderado.', 'Sweet with a woody touch.', 'Doce com algo amadeirado.'],
          ['panela', 'Panela', 'Panela', 'Rapadura', 'Azúcar de caña sin refinar, profunda.', 'Unrefined cane sugar, deep.', 'Açúcar de cana não refinado, profundo.']
        ] },
      { id: 'caramelizado', name: ['Caramelizado', 'Caramelized', 'Caramelizado'],
        desc: ['Azúcar cocida hasta dorarse: más intenso en tuestes medios.', 'Sugar cooked until golden: stronger in medium roasts.', 'Açúcar cozido até dourar: mais intenso em torras médias.'],
        children: [
          ['caramelo', 'Caramelo', 'Caramel', 'Caramelo', 'Azúcar dorada, como el de un flan.', 'Golden sugar, like flan caramel.', 'Açúcar dourado, como calda de pudim.'],
          ['dulce-de-leche', 'Dulce de leche', 'Dulce de leche', 'Doce de leite', 'Caramelo cremoso y lácteo.', 'Creamy, milky caramel.', 'Caramelo cremoso e lácteo.'],
          ['toffee', 'Toffee', 'Toffee', 'Toffee', 'Caramelo con manteca, más denso.', 'Buttery, denser caramel.', 'Caramelo amanteigado, mais denso.'],
          ['melaza', 'Melaza', 'Molasses', 'Melaço', 'Dulce oscuro con algo amargo.', 'Dark sweetness with some bitterness.', 'Doce escuro com algo amargo.']
        ] },
      { id: 'vainilla-masas', name: ['Vainilla y masas', 'Vanilla & pastry', 'Baunilha e massas'],
        desc: ['Dulzor de repostería, suave y redondo.', 'Bakery sweetness, soft and round.', 'Doçura de confeitaria, suave e redonda.'],
        children: [
          ['vainilla', 'Vainilla', 'Vanilla', 'Baunilha', 'Dulce, cremoso y perfumado.', 'Sweet, creamy and fragrant.', 'Doce, cremoso e perfumado.'],
          ['galletita', 'Galletita', 'Biscuit', 'Biscoito', 'Masa dulce horneada, como una galletita de vainilla.', 'Sweet baked dough, like a vanilla biscuit.', 'Massa doce assada, como biscoito de baunilha.'],
          ['bizcochuelo', 'Bizcochuelo', 'Sponge cake', 'Pão de ló', 'Torta esponjosa, huevo y azúcar.', 'Fluffy cake, egg and sugar.', 'Bolo fofo, ovo e açúcar.'],
          ['manteca', 'Manteca', 'Butter', 'Manteiga', 'Sensación cremosa y redonda en boca.', 'A creamy, round mouthfeel.', 'Sensação cremosa e redonda na boca.']
        ] }
    ] },

  { id: 'chocolate-nuez', color: '#7A4A2A',
    name: ['Chocolate y frutos secos', 'Chocolate & nuts', 'Chocolate e castanhas'],
    desc: ['Notas cálidas y reconfortantes. Muy comunes en Brasil, Colombia y tuestes medios.',
           'Warm, comforting notes. Very common in Brazil, Colombia and medium roasts.',
           'Notas quentes e reconfortantes. Muito comuns no Brasil, na Colômbia e em torras médias.'],
    children: [
      { id: 'chocolate', name: ['Chocolate', 'Chocolate', 'Chocolate'],
        desc: ['Del chocolate con leche dulce al cacao puro y amargo.', 'From sweet milk chocolate to pure, bitter cocoa.', 'Do chocolate ao leite doce ao cacau puro e amargo.'],
        children: [
          ['choco-leche', 'Chocolate con leche', 'Milk chocolate', 'Chocolate ao leite', 'Dulce, cremoso, suave.', 'Sweet, creamy, mild.', 'Doce, cremoso, suave.'],
          ['choco-amargo', 'Chocolate amargo', 'Dark chocolate', 'Chocolate amargo', 'Intenso, con amargor agradable.', 'Intense, with pleasant bitterness.', 'Intenso, com amargor agradável.'],
          ['cacao', 'Cacao', 'Cocoa', 'Cacau', 'Polvo de cacao: seco y terroso.', 'Cocoa powder: dry and earthy.', 'Cacau em pó: seco e terroso.'],
          ['brownie', 'Brownie', 'Brownie', 'Brownie', 'Chocolate horneado, dulce y denso.', 'Baked chocolate, sweet and dense.', 'Chocolate assado, doce e denso.']
        ] },
      { id: 'frutos-secos', name: ['Frutos secos', 'Nuts', 'Castanhas'],
        desc: ['Tostado suave y untuoso, como nueces recién tostadas.', 'Soft, unctuous toastiness, like freshly toasted nuts.', 'Tostado suave e untuoso, como castanhas recém-torradas.'],
        children: [
          ['mani', 'Maní', 'Peanut', 'Amendoim', 'Tostado y algo salado.', 'Toasted and slightly salty.', 'Torrado e um pouco salgado.'],
          ['almendra', 'Almendra', 'Almond', 'Amêndoa', 'Suave, dulce, a mazapán.', 'Mild, sweet, marzipan-like.', 'Suave, doce, como marzipã.'],
          ['avellana', 'Avellana', 'Hazelnut', 'Avelã', 'Tostada y aceitosa, como una crema de avellanas.', 'Toasted and oily, like hazelnut spread.', 'Torrada e oleosa, como creme de avelã.'],
          ['nuez', 'Nuez', 'Walnut', 'Nozes', 'Frutos secos con un final algo amargo.', 'Nutty with a slightly bitter finish.', 'Castanha com final um pouco amargo.']
        ] }
    ] },

  { id: 'especiado', color: '#A5502E',
    name: ['Especiado', 'Spicy', 'Especiado'],
    desc: ['Aromas cálidos y picantes de especias de cocina.', 'Warm, pungent aromas of kitchen spices.', 'Aromas quentes e picantes de especiarias de cozinha.'],
    children: [
      { id: 'especias-dulces', name: ['Especias dulces', 'Warm spices', 'Especiarias doces'],
        desc: ['Especias de repostería: cálidas y perfumadas.', 'Baking spices: warm and fragrant.', 'Especiarias de confeitaria: quentes e perfumadas.'],
        children: [
          ['canela', 'Canela', 'Cinnamon', 'Canela', 'Dulce, cálida, amaderada.', 'Sweet, warm, woody.', 'Doce, quente, amadeirada.'],
          ['clavo', 'Clavo de olor', 'Clove', 'Cravo', 'Intenso, casi medicinal en exceso.', 'Intense, almost medicinal when strong.', 'Intenso, quase medicinal em excesso.'],
          ['nuez-moscada', 'Nuez moscada', 'Nutmeg', 'Noz-moscada', 'Especia cálida y terrosa.', 'Warm, earthy spice.', 'Especiaria quente e terrosa.'],
          ['anis', 'Anís', 'Anise', 'Anis', 'Dulce, como regaliz.', 'Sweet, licorice-like.', 'Doce, como alcaçuz.']
        ] },
      { id: 'especias-picantes', name: ['Especias picantes', 'Pungent spices', 'Especiarias picantes'],
        desc: ['Picor o frescura en la nariz.', 'Heat or freshness in the nose.', 'Ardência ou frescor no nariz.'],
        children: [
          ['pimienta', 'Pimienta negra', 'Black pepper', 'Pimenta-do-reino', 'Picante y seca.', 'Pungent and dry.', 'Picante e seca.'],
          ['jengibre', 'Jengibre', 'Ginger', 'Gengibre', 'Picante fresco y cítrico.', 'Fresh, citrusy heat.', 'Picância fresca e cítrica.'],
          ['cardamomo', 'Cardamomo', 'Cardamom', 'Cardamomo', 'Especia fresca, casi mentolada.', 'Fresh, almost minty spice.', 'Especiaria fresca, quase mentolada.']
        ] }
    ] },

  { id: 'tostado', color: '#5B4636',
    name: ['Tostado', 'Roasted', 'Torrado'],
    desc: ['Notas que vienen del tostado: de pan dorado a humo. Muy marcadas en tuestes oscuros.',
           'Notes that come from roasting: from golden bread to smoke. Very marked in dark roasts.',
           'Notas que vêm da torra: de pão dourado a fumaça. Muito marcadas em torras escuras.'],
    children: [
      { id: 'panificado', name: ['Cereal y pan', 'Cereal & bread', 'Cereal e pão'],
        desc: ['Tostado suave, a horno de panadería.', 'Soft toastiness, like a bakery oven.', 'Tostado suave, como forno de padaria.'],
        children: [
          ['pan-tostado', 'Pan tostado', 'Toast', 'Pão torrado', 'Corteza de pan dorada.', 'Golden bread crust.', 'Casca de pão dourada.'],
          ['cereal', 'Cereal', 'Cereal', 'Cereal', 'Grano tostado, como copos de maíz.', 'Toasted grain, like corn flakes.', 'Grão torrado, como flocos de milho.'],
          ['malta', 'Malta', 'Malt', 'Malte', 'Dulce y tostado, como la cerveza o la malta.', 'Sweet and toasty, like beer or malt drinks.', 'Doce e torrado, como cerveja ou maltado.']
        ] },
      { id: 'tostado-oscuro', name: ['Tostado intenso', 'Dark roast', 'Torra intensa'],
        desc: ['Notas fuertes del tostado; en exceso tapan los demás sabores.', 'Strong roast notes; in excess they mask everything else.', 'Notas fortes da torra; em excesso escondem os outros sabores.'],
        children: [
          ['ahumado', 'Ahumado', 'Smoky', 'Defumado', 'Humo de leña o asado.', 'Wood or barbecue smoke.', 'Fumaça de lenha ou churrasco.'],
          ['tabaco', 'Tabaco', 'Tobacco', 'Tabaco', 'Hoja de tabaco seca, dulce y amarga.', 'Dry tobacco leaf, sweet and bitter.', 'Folha de tabaco seca, doce e amarga.'],
          ['quemado', 'Quemado', 'Burnt', 'Queimado', 'Carbón o tostada quemada: señal de tueste excesivo.', 'Charcoal or burnt toast: a sign of over-roasting.', 'Carvão ou torrada queimada: sinal de torra excessiva.']
        ] }
    ] },

  { id: 'vegetal', color: '#5E8A3A',
    name: ['Vegetal y herbal', 'Green & herbal', 'Vegetal e herbal'],
    desc: ['Notas verdes y frescas. Algo de herbal suma; mucho puede indicar subextracción o tueste muy claro.',
           'Green, fresh notes. A little herbal adds complexity; a lot can mean under-extraction or a very light roast.',
           'Notas verdes e frescas. Um pouco de herbal soma; muito pode indicar subextração ou torra muito clara.'],
    children: [
      { id: 'herbal', name: ['Herbal', 'Herbal', 'Herbal'],
        desc: ['Hierbas frescas o secas.', 'Fresh or dried herbs.', 'Ervas frescas ou secas.'],
        children: [
          ['mate', 'Yerba mate', 'Yerba mate', 'Erva-mate', 'Herbal, amargo y vegetal, como un mate.', 'Herbal, bitter and green, like a mate.', 'Herbal, amargo e vegetal, como um chimarrão.'],
          ['menta', 'Menta', 'Mint', 'Hortelã', 'Fresca y refrescante.', 'Fresh and cooling.', 'Fresca e refrescante.'],
          ['hierba', 'Pasto recién cortado', 'Fresh-cut grass', 'Grama cortada', 'Verde y húmedo.', 'Green and damp.', 'Verde e úmido.'],
          ['eucalipto', 'Eucalipto', 'Eucalyptus', 'Eucalipto', 'Fresco y resinoso.', 'Fresh and resinous.', 'Fresco e resinoso.']
        ] },
      { id: 'verde', name: ['Vegetal', 'Vegetal', 'Vegetal'],
        desc: ['Verdura cruda o cocida.', 'Raw or cooked vegetables.', 'Verdura crua ou cozida.'],
        children: [
          ['arveja', 'Arveja', 'Pea pod', 'Ervilha', 'Vaina verde fresca.', 'Fresh green pod.', 'Vagem verde fresca.'],
          ['morron', 'Morrón verde', 'Green pepper', 'Pimentão verde', 'Vegetal y punzante.', 'Vegetal and sharp.', 'Vegetal e pungente.'],
          ['heno', 'Heno / paja', 'Hay / straw', 'Feno / palha', 'Pasto seco; común en cafés viejos.', 'Dry grass; common in old coffees.', 'Capim seco; comum em cafés velhos.']
        ] }
    ] },

  { id: 'fermentado', color: '#8C3B6E',
    name: ['Ácido y fermentado', 'Sour & fermented', 'Ácido e fermentado'],
    desc: ['Acidez y notas de fermentación. En su justa medida dan complejidad; en exceso, un sabor avinagrado.',
           'Acidity and fermentation notes. In balance they add complexity; in excess, a vinegary taste.',
           'Acidez e notas de fermentação. Na medida certa trazem complexidade; em excesso, um sabor avinagrado.'],
    children: [
      { id: 'acidos', name: ['Tipos de acidez', 'Acidity types', 'Tipos de acidez'],
        desc: ['Cómo se siente la acidez en la boca.', 'How acidity feels on the palate.', 'Como a acidez é sentida na boca.'],
        children: [
          ['acidez-citrica', 'Acidez cítrica', 'Citric acidity', 'Acidez cítrica', 'Viva y brillante, como el limón.', 'Lively and bright, like lemon.', 'Viva e brilhante, como limão.'],
          ['acidez-malica', 'Acidez málica', 'Malic acidity', 'Acidez málica', 'Crocante, como la manzana verde.', 'Crisp, like green apple.', 'Crocante, como maçã verde.'],
          ['acidez-tartarica', 'Acidez vínica', 'Winey acidity', 'Acidez vínica', 'Como la de la uva o el vino.', 'Like grapes or wine.', 'Como a da uva ou do vinho.'],
          ['avinagrado', 'Avinagrado', 'Vinegar', 'Avinagrado', 'Acético, punzante: suele ser un defecto.', 'Acetic, sharp: usually a defect.', 'Acético, pungente: costuma ser defeito.']
        ] },
      { id: 'fermento', name: ['Fermentado', 'Fermented', 'Fermentado'],
        desc: ['Notas alcohólicas o de fermentación, típicas de procesos naturales y anaeróbicos.', 'Boozy or fermented notes, typical of natural and anaerobic processes.', 'Notas alcoólicas ou de fermentação, típicas de processos naturais e anaeróbicos.'],
        children: [
          ['vino-tinto', 'Vino tinto', 'Red wine', 'Vinho tinto', 'Fruta oscura con algo de tanino.', 'Dark fruit with some tannin.', 'Fruta escura com algum tanino.'],
          ['whisky', 'Whisky / licor', 'Whiskey / liqueur', 'Uísque / licor', 'Alcohólico y cálido.', 'Boozy and warm.', 'Alcoólico e quente.'],
          ['sidra', 'Sidra', 'Cider', 'Sidra', 'Manzana fermentada, burbujeante.', 'Fermented, fizzy apple.', 'Maçã fermentada, borbulhante.'],
          ['yogur', 'Yogur', 'Yogurt', 'Iogurte', 'Ácido lácteo, cremoso.', 'Creamy, lactic sourness.', 'Ácido lácteo, cremoso.']
        ] }
    ] },

  { id: 'defectos', color: '#6E6A62',
    name: ['Defectos', 'Off-flavors', 'Defeitos'],
    desc: ['Sabores no deseados. Te ayudan a detectar café viejo, mal almacenado o con problemas de proceso.',
           'Unwanted flavors. They help you spot old, badly stored or poorly processed coffee.',
           'Sabores indesejados. Ajudam a detectar café velho, mal armazenado ou com problemas de processo.'],
    children: [
      { id: 'tierra-humedad', name: ['Tierra y humedad', 'Earth & damp', 'Terra e umidade'],
        desc: ['Suelen venir de mal almacenamiento o humedad.', 'Usually from poor storage or moisture.', 'Costumam vir de mau armazenamento ou umidade.'],
        children: [
          ['terroso', 'Terroso', 'Earthy', 'Terroso', 'Tierra mojada.', 'Wet soil.', 'Terra molhada.'],
          ['humedad', 'Humedad / moho', 'Musty / mold', 'Mofo', 'Placard cerrado, sótano.', 'Closed cupboard, basement.', 'Armário fechado, porão.'],
          ['madera', 'Madera', 'Woody', 'Madeira', 'Madera seca o cartón; café viejo.', 'Dry wood or cardboard; old coffee.', 'Madeira seca ou papelão; café velho.']
        ] },
      { id: 'quimicos', name: ['Químicos y rancios', 'Chemical & stale', 'Químicos e rançosos'],
        desc: ['Señal de café oxidado o contaminado.', 'A sign of oxidized or contaminated coffee.', 'Sinal de café oxidado ou contaminado.'],
        children: [
          ['carton', 'Papel / cartón', 'Papery', 'Papel / papelão', 'Plano y seco; también aparece si no enjuagás el filtro.', 'Flat and dry; also appears if you skip rinsing the filter.', 'Plano e seco; aparece também se não enxaguar o filtro.'],
          ['rancio', 'Rancio', 'Rancid', 'Rançoso', 'Aceite viejo: café oxidado.', 'Old oil: oxidized coffee.', 'Óleo velho: café oxidado.'],
          ['goma', 'Goma', 'Rubber', 'Borracha', 'Goma quemada; típico de robustas de baja calidad.', 'Burnt rubber; typical of low-quality robusta.', 'Borracha queimada; típico de robustas de baixa qualidade.'],
          ['medicinal', 'Medicinal', 'Medicinal', 'Medicinal', 'Remedio o yodo.', 'Medicine or iodine.', 'Remédio ou iodo.']
        ] }
    ] }
];

// Convierte el formato compacto a nodos { id, name:{es,en,pt}, desc|tip, color, parent, depth, children }
const FLAVOR_WHEEL = (function () {
  const LANGS = ['es', 'en', 'pt'];
  const tri = (arr) => ({ es: arr[0], en: arr[1], pt: arr[2] });
  const byId = {};
  const root = { id: 'root', depth: 0, children: [] };
  FLAVOR_WHEEL_RAW.forEach(cat => {
    const c = { id: cat.id, depth: 1, color: cat.color, name: tri(cat.name), desc: tri(cat.desc), parent: root, children: [] };
    byId[c.id] = c;
    root.children.push(c);
    cat.children.forEach(fam => {
      const f = { id: fam.id, depth: 2, color: cat.color, name: tri(fam.name), desc: tri(fam.desc), parent: c, children: [] };
      byId[f.id] = f;
      c.children.push(f);
      fam.children.forEach(leaf => {
        const l = { id: leaf[0], depth: 3, color: cat.color, name: { es: leaf[1], en: leaf[2], pt: leaf[3] },
                    tip: { es: leaf[4], en: leaf[5], pt: leaf[6] }, parent: f, children: [] };
        byId[l.id] = l;
        f.children.push(l);
      });
    });
  });
  // Peso = cantidad de hojas (define el ancho angular de cada sector)
  (function weigh(n) { n.weight = n.children.length ? n.children.reduce((s, ch) => s + weigh(ch), 0) : 1; return n.weight; })(root);
  return { root, byId, LANGS, leaves: Object.values(byId).filter(n => n.depth === 3) };
})();
