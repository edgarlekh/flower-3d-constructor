/* ============================================================
   UI КАТАЛОГА-КОРЗИНЫ И СМЕТЫ
   Рисует список ваз, список цветов со степперами и правую панель
   с составом и ценой. Меняет состояние (state.cart, state.vaseId)
   и дёргает onChange, чтобы сцена пересобралась.

   window.CatalogUI.init(state, {onChange}) → {drawAll, renderRecipe}
   state: {cart:{id->qty}, vaseId}
   ============================================================ */
window.CatalogUI = (function(){
  const CATALOG = window.CATALOG, ROLES = window.ROLES, VASES = window.VASES;
  const $ = id => document.getElementById(id);
  const hex6 = c => c.toString(16).padStart(6,'0');

  function init(state, cb){
    const onChange = (cb && cb.onChange) || function(){};
    const listEl = $('list'), vaseListEl = $('vaselist'), notesEl = $('notes');

    function drawVaseList(){
      vaseListEl.innerHTML = VASES.map(v => `
        <div class="row ${v.id===state.vaseId?'on':''}" data-vase="${v.id}" style="cursor:pointer">
          <span class="dot" style="background:${v.id==='none'?'transparent':'#8FA8C4'};border:1px dashed ${v.id==='none'?'#B7B3AA':'transparent'}"></span>
          <span class="nm"><b>${v.name}</b><span>${v.price ? v.price+' zł · высота '+v.height_cm+' см' : 'букет в руках'}</span></span>
          <span class="stepper"><span class="q" style="width:auto;font-size:15px;color:${v.id===state.vaseId?'var(--rose)':'var(--muted)'}">${v.id===state.vaseId?'✓':''}</span></span>
        </div>`).join('');
    }

    function drawCatalog(){
      let html = '';
      for (const role of ['accent','mass','filler','green']){
        html += `<div class="group-title"><span class="label">${ROLES[role].title}</span><span class="label" style="letter-spacing:0;text-transform:none;font-weight:400">${ROLES[role].hint}</span></div>`;
        for (const it of CATALOG.filter(i => i.role === role)){
          const q = state.cart[it.id] || 0;
          html += `<div class="row ${q?'on':''}" data-row="${it.id}">
            <span class="dot" style="background:#${hex6(it.color)}"></span>
            <span class="nm"><b>${it.name}</b><span>${it.price} zł · бутон ${it.bloom_cm} см${it.model?' · <b style=\"color:var(--straw);font-weight:600\">модель из фото</b>':''}</span></span>
            <span class="stepper">
              <button data-m="${it.id}" ${q?'':'disabled'}>−</button>
              <span class="q">${q}</span>
              <button data-p="${it.id}">+</button>
            </span></div>`;
        }
      }
      listEl.innerHTML = html;
    }

    function drawAll(){ drawVaseList(); drawCatalog(); }

    function renderRecipe(s){
      $('dia').innerHTML = s.n ? `${Math.round(s.dia)}<small> см</small>` : '—';
      $('form').textContent = s.form;

      $('stems').innerHTML = s.n
        ? s.lines.map(l => `<div class="stem-line">
            <span class="dot" style="background:#${hex6(l.item.color)}"></span>
            <i>${l.item.name}</i><u>×${l.qty}</u><s>${l.sum} zł</s></div>`).join('')
          + `<div class="stem-line" style="border-top:1px solid var(--line);margin-top:6px;padding-top:9px">
             <i style="color:var(--muted)">Всего стеблей</i><s>${s.n}</s></div>`
        : '<div style="font-size:12px;color:var(--muted);padding:4px 0">Корзина пуста</div>';

      notesEl.innerHTML = s.notes.map(n =>
        `<div class="note ${n.t}">${n.h?`<strong>${n.h}.</strong> `:''}${n.b}
         ${n.act?`<button data-add="${n.act.id}" data-q="${n.act.qty}">${n.act.label}</button>`:''}</div>`).join('');

      const V = VASES.find(v => v.id === state.vaseId);
      $('r-vase').style.display = (V && V.price) ? 'flex' : 'none';
      if (V && V.price) $('p-vase').textContent = V.price+' zł';
      $('p-flowers').textContent = s.flowers+' zł';
      $('p-wrap').textContent = s.wrap+' zł';
      $('p-labor').textContent = s.labor+' zł';
      $('p-total').innerHTML = (s.total + ((V && V.price)||0)) + '<small> zł</small>';
    }

    /* ---- события ---- */
    vaseListEl.addEventListener('click', e => {
      const vrow = e.target.closest('[data-vase]');
      if (!vrow) return;
      state.vaseId = vrow.dataset.vase; drawVaseList(); onChange();
    });
    listEl.addEventListener('click', e => {
      const p = e.target.dataset.p, m = e.target.dataset.m;
      if (p) state.cart[p] = Math.min(30, (state.cart[p]||0) + 1);
      else if (m) state.cart[m] = Math.max(0, (state.cart[m]||0) - 1);
      else return;
      drawCatalog(); onChange();
    });
    notesEl.addEventListener('click', e => {
      const id = e.target.dataset.add; if (!id) return;
      state.cart[id] = Math.min(30, (state.cart[id]||0) + (+e.target.dataset.q));
      drawCatalog(); onChange();
    });

    return { drawAll, renderRecipe };
  }

  return { init };
})();
