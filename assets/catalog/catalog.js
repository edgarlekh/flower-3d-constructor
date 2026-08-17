/* ============================================================
   КАТАЛОГ — правда о товаре.
   Каждая позиция несёт реальные габариты в сантиметрах и роль.
   Роль и размер бутона — те метаданные, без которых движок не
   знает, что куда ставить.

   Поля цветка:
     id        — короткий код
     type      — 'flower'
     name      — как показываем пользователю
     role      — accent | mass | filler | green
     bloom_cm  — диаметр бутона, см (реальный размер)
     stem_cm   — длина стебля, см (реальный размер)
     price     — цена за стебель, zł
     color     — цвет бутона (для процедурной модели)
     shape     — форма бутона: ball | cup | cluster | spray
     model     — true, если это настоящая 3D-модель с фото
   ============================================================ */
window.CATALOG = [
  {id:'peo',  type:'flower', name:'Пион розовый',       role:'accent', bloom_cm:11,  stem_cm:50, price:28, color:0xE7A9BC, shape:'ball'},
  {id:'gros', type:'flower', name:'Роза садовая белая', role:'accent', bloom_cm:9,   stem_cm:55, price:15, color:0xF2EDE2, shape:'ball'},
  {id:'red',  type:'flower', name:'Роза красная',       role:'accent', bloom_cm:7,   stem_cm:45, price:9,  color:0xAF3648, shape:'ball', model:true},
  {id:'ran',  type:'flower', name:'Ранункулюс персик',  role:'accent', bloom_cm:6.5, stem_cm:40, price:12, color:0xEFBF97, shape:'ball'},
  {id:'dah',  type:'flower', name:'Георгин бордовый',   role:'accent', bloom_cm:12,  stem_cm:45, price:18, color:0x7E2233, shape:'ball'},
  {id:'ane',  type:'flower', name:'Анемон белый',       role:'accent', bloom_cm:6,   stem_cm:35, price:14, color:0xF3EFE8, shape:'cup'},

  {id:'hyd',  type:'flower', name:'Гортензия голубая',  role:'mass',   bloom_cm:15,  stem_cm:45, price:34, color:0xA6BDDE, shape:'cluster'},
  {id:'tul',  type:'flower', name:'Тюльпан коралловый', role:'mass',   bloom_cm:6,   stem_cm:38, price:7,  color:0xE86F6E, shape:'cup'},
  {id:'eus',  type:'flower', name:'Эустома кремовая',   role:'mass',   bloom_cm:6.5, stem_cm:50, price:11, color:0xF1EADC, shape:'cup'},
  {id:'chr',  type:'flower', name:'Хризантема сирень',  role:'mass',   bloom_cm:8,   stem_cm:55, price:10, color:0xC0A5D4, shape:'ball'},
  {id:'car',  type:'flower', name:'Гвоздика пыльная роза', role:'mass', bloom_cm:6,  stem_cm:50, price:6,  color:0xC98B93, shape:'ball'},
  {id:'fre',  type:'flower', name:'Фрезия жёлтая',      role:'mass',   bloom_cm:5,   stem_cm:40, price:9,  color:0xEFD98A, shape:'cup'},

  {id:'gyp',  type:'flower', name:'Гипсофила',          role:'filler', bloom_cm:10,  stem_cm:45, price:6,  color:0xFAF6F1, shape:'cluster'},
  {id:'sta',  type:'flower', name:'Статица лавандовая', role:'filler', bloom_cm:8,   stem_cm:40, price:5,  color:0x9B8CBE, shape:'cluster'},
  {id:'ber',  type:'flower', name:'Гиперикум (ягоды)',  role:'filler', bloom_cm:7,   stem_cm:45, price:7,  color:0x9E4B3A, shape:'cluster'},

  {id:'euc',  type:'flower', name:'Эвкалипт',           role:'green',  bloom_cm:20,  stem_cm:55, price:6,  color:0x93A98C, shape:'spray'},
  {id:'rus',  type:'flower', name:'Рускус',             role:'green',  bloom_cm:18,  stem_cm:50, price:5,  color:0x5F7F5C, shape:'spray'},
  {id:'pis',  type:'flower', name:'Фисташка',           role:'green',  bloom_cm:22,  stem_cm:55, price:7,  color:0x6E8F63, shape:'spray'},
];

/* Роли: как объясняем пользователю, зачем группа нужна. */
window.ROLES = {
  accent: {title:'Акценты', hint:'держат форму'},
  mass:   {title:'Масса',   hint:'заполняют объём'},
  filler: {title:'Филлеры', hint:'закрывают пустоты'},
  green:  {title:'Зелень',  hint:'каркас и контур'},
};

/* ============================================================
   ВАЗЫ — модели с фотографий.
     height_cm    — ЕДИНСТВЕННЫЙ размер, введённый вручную.
                    По нему модель масштабируется.
     neck_ratio   — радиус горловины в долях высоты. Посчитан
                    пайплайном из модели, не руками. По нему
                    проверяется, влезает ли букет.
     width_ratio  — ширина в долях высоты. Тоже из модели.
     model        — ключ в window.VASE_MODELS (упакованная геометрия).
   ============================================================ */
window.VASES = [
  {id:'none', type:'vase', name:'Без вазы', price:0},
  {id:'tall', type:'vase', name:'Ваза высокая, роспись', price:45,
    height_cm:30, neck_ratio:0.19062215089797974, width_ratio:0.5139865875244141, model:'tall'},
  {id:'wide', type:'vase', name:'Ваза широкая, роспись', price:58,
    height_cm:26, neck_ratio:0.2160896360874176, width_ratio:0.7886868715286255, model:'wide'},
];

/* ============================================================
   СТОЛЫ И ПОСУДА — реальные размеры для зала (см).
   Тот же принцип: размер вводится ОДНИМ числом здесь, система
   считает по нему зазоры (до края, до тарелки, проход между столами).
   Добавляете новый стол/посуду — вписываете размер сюда.
   ============================================================ */
window.TABLES = [
  {id:'round-150', type:'table', name:'Круглый', shape:'round', diameter_cm:150, height_cm:75, seats_default:6},
  // Позже: прямоугольные столы, разные диаметры
];

window.TABLEWARE = {
  plate_cm: 27,          // диаметр тарелки
  napkin_cm: [15, 20],   // салфетка (ширина × длина)
  cutlery_cm: 17,        // длина приборов
  chair_cm: 45,          // ширина/глубина стула
};

// Позже: window.TEXTILES, window.VENUES
