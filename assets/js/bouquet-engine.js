/* ============================================================
   ДВИЖОК БУКЕТА
   Чистая логика без сцены: детерминированный ГПСЧ, смета с
   предупреждениями, раскладка бутонов в пространстве.

   Наружу отдаёт window.BouquetEngine:
     cartSeed(cart, variantSeed)   — зерно по составу корзины
     stats(cart, vaseId)           — диаметр, форма, цена, заметки
     layout(cart, vaseId, seed)    — позиции бутонов {stems, s}
   ============================================================ */
window.BouquetEngine = (function(){
  const CATALOG = window.CATALOG;
  const VASES = window.VASES;

  /* ---- Детерминированный ГПСЧ: одна корзина = один букет.
     Кнопка «другой вариант» просто меняет зерно. ---- */
  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a>>>15, 1 | a);
      t = t + Math.imul(t ^ t>>>7, 61 | t) ^ t;
      return ((t ^ t>>>14) >>> 0) / 4294967296;
    };
  }
  function cartSeed(cart, variantSeed){
    let h = 2166136261;
    for (const it of CATALOG){
      const q = cart[it.id] || 0;
      h = Math.imul(h ^ (it.id.charCodeAt(0) + q*31), 16777619);
    }
    return (h >>> 0) + (variantSeed||0)*7919;
  }

  /* ---- Расчёт: диаметр, форма, цена, предупреждения ---- */
  function stats(cart, vaseId){
    const lines = [];
    let n = 0, area = 0, flowers = 0;
    const byRole = {accent:0, mass:0, filler:0, green:0};
    for (const it of CATALOG){
      const q = cart[it.id] || 0; if (!q) continue;
      lines.push({item:it, qty:q, sum:q*it.price});
      n += q; flowers += q*it.price; byRole[it.role] += q;
      const w = it.role === 'green' ? .45 : 1;      // зелень занимает меньше «лица» букета
      area += q*Math.PI*Math.pow(it.bloom_cm/2, 2)*w;
    }
    const R = n ? Math.sqrt(area/(1.15*Math.PI)) : 0;
    const dia = R*2;

    let form = '—';
    if (n === 0) form = '—';
    else if (n < 6) form = 'Бутоньерка / мини';
    else if (dia < 20) form = 'Компактный круглый';
    else if (dia < 32) form = 'Круглый';
    else if (dia < 46) form = 'Круглый крупный';
    else form = 'Крупный, лучше каскад';

    const wrap = n===0 ? 0 : dia<25 ? 12 : dia<35 ? 18 : dia<46 ? 26 : 34;
    const labor = n===0 ? 0 : Math.round(15 + 1.2*n);
    const total = Math.round(flowers + wrap + labor);

    const notes = [];
    if (n>=5 && byRole.accent===0)
      notes.push({t:'warn', h:'Нет акцентных цветов', b:'Букет из одной массы читается плоско — глазу не за что зацепиться. Добавьте 3–5 крупных бутонов.'});
    if (n>=6 && byRole.green/n < .15)
      notes.push({t:'warn', h:'Мало зелени', b:'Контур получится рыхлым. Пять эвкалиптов дадут каркас и визуально прибавят объём.',
                  act:{id:'euc', qty:5, label:'Добавить 5 эвкалиптов · +30 zł'}});
    if (n>=8 && byRole.filler/n > .5)
      notes.push({t:'warn', h:'Перебор филлера', b:'Гипсофила и статица должны заполнять пустоты, а не составлять букет.'});
    if (n>0 && n<6)
      notes.push({t:'', h:'', b:'Из такого набора выходит не круглый букет, а компактная форма — так и продавайте.'});
    const VS = VASES.find(v => v.id === vaseId);
    if (VS && VS.height_cm && n>0){
      // Вместимость горловины: из реальной высоты и посчитанной пайплайном
      // доли neck_ratio выводим радиус устья, из него — сколько стеблей влезет.
      const cap = Math.round(Math.PI*Math.pow(VS.neck_ratio*VS.height_cm, 2)/0.42);
      if (n > cap) notes.push({t:'warn', h:'Букет не влезает в горловину',
        b:`В эту вазу помещается примерно ${cap} стеблей, у вас ${n}. Возьмите вазу пошире или уберите часть.`});
    }
    if (n>60)
      notes.push({t:'warn', h:'Больше 60 стеблей', b:'Это уже не ручной букет, а композиция на каркасе — считается по другой ставке работы.'});

    return {lines, n, dia, form, flowers, wrap, labor, total, notes, byRole, R};
  }

  /* ---- Раскладка. Стебли сходятся в точке связки, бутоны лежат
     на куполе. Азимут — золотой угол, радиус — по роли: акценты
     ближе к центру, зелень по краю и ниже. ---- */
  const BAND = {accent:[0,.42], mass:[.18,.72], filler:[.30,.88], green:[.80,1.18]};
  const GOLDEN = Math.PI*(3 - Math.sqrt(5));

  function layout(cart, vaseId, variantSeed){
    const s = stats(cart, vaseId);
    if (!s.n) return {stems:[], s};
    const rnd = mulberry32(cartSeed(cart, variantSeed));
    const R = Math.max(s.R, 4);
    const domeH = R*0.62;
    const V = VASES.find(v => v.id === vaseId);
    // в вазе стебли выходят из горловины, без вазы — из точки связки в руке
    const baseY = V && V.height_cm ? V.height_cm*0.99 : 15 + R*0.55;

    const groups = {accent:[], mass:[], filler:[], green:[]};
    for (const it of CATALOG){
      const q = cart[it.id] || 0;
      for (let k = 0; k < q; k++) groups[it.role].push(it);
    }
    const out = []; let i = 0;
    for (const role of ['accent','mass','filler','green']){
      const g = groups[role]; if (!g.length) continue;
      const [lo, hi] = BAND[role];
      for (let j = 0; j < g.length; j++){
        const u = (j+0.5)/g.length;
        let rr = R*Math.sqrt(lo + (hi-lo)*u);
        rr *= .88 + rnd()*.24;
        const ang = i*GOLDEN + rnd()*.5;
        const x = Math.cos(ang)*rr, z = Math.sin(ang)*rr;
        const k = Math.min(rr/(R*1.18), 1);
        let y = baseY + domeH*Math.sqrt(Math.max(0, 1 - k*k));
        if (role === 'green') y -= domeH*.35 + rnd()*3;
        y += (rnd()-.5)*2.2;
        out.push({item:g[j], pos:new THREE.Vector3(x,y,z)});
        i++;
      }
    }
    return {stems:out, s};
  }

  return { cartSeed, stats, layout, BAND, GOLDEN, mulberry32 };
})();
