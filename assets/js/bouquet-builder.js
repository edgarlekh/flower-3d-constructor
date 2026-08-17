/* ============================================================
   СБОРЩИК БУКЕТА
   Собирает букет как ЕДИНЫЙ объект (THREE.Group): ваза + стебли +
   бутоны, низ на y=0. Один и тот же букет строится и в конструкторе
   (где двигают отдельные цветы), и в зале (где ставят копии на стол).

   window.BouquetBuilder:
     build(cart, vaseId, seed, {manual}) → {root, flowerGroups, stats, vase, focus, usedKeys}
       root         — THREE.Group: ваза + цветы, основание в y=0
       flowerGroups — массив групп-цветков (стебель+бутон), их двигают руками
       stats        — смета из движка
       focus        — {y, radius, top, bottom} для кадрирования камеры
       usedKeys     — какие ключи id#повтор задействованы (для чистки manual)
     reaimFlower(group, target) — переставить бутон, дотянуть стебель
   ============================================================ */
window.BouquetBuilder = (function(){
  const { layout, cartSeed, mulberry32, GOLDEN } = window.BouquetEngine;
  const VASES = window.VASES;
  const UP = new THREE.Vector3(0, 1, 0);

  const stemGeo = new THREE.CylinderGeometry(.32, .4, 1, 6);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4C6B4A, roughness: .85 });

  // Нацелить цилиндр-стебель от p0 к p1. Возвращает направление.
  function aimCyl(mesh, p0, p1){
    const v = p1.clone().sub(p0), L = Math.max(v.length(), 0.001), d = v.clone().normalize();
    mesh.scale.y = L;
    mesh.quaternion.setFromUnitVectors(UP, d);
    mesh.position.copy(p0).addScaledVector(d, L * 0.5);
    return d;
  }
  function makeCyl(p0, p1){ const m = new THREE.Mesh(stemGeo, stemMat); aimCyl(m, p0, p1); return m; }

  // Переставить бутон группы в target: стебель дотягивается, низ на месте.
  function reaimFlower(g, target){
    const dir = aimCyl(g.userData.aimStem, g.userData.base, target);
    g.userData.head.position.copy(target);
    g.userData.head.quaternion.setFromUnitVectors(UP, dir);
    g.userData.headPos.copy(target);
  }

  function build(cart, vaseId, variantSeed, opts){
    opts = opts || {};
    const manual = opts.manual || {};
    const root = new THREE.Group();
    const flowerGroups = [];

    // ваза (внутри root, чтобы букет был единым объектом)
    const V = VASES.find(v => v.id === vaseId);
    let vase = null;
    if (V && V.height_cm && window.ModelLoader.vaseAssets[V.model]){
      const A = window.ModelLoader.vaseAssets[V.model];
      const m = new THREE.Mesh(A.geo, A.mat);
      m.scale.setScalar(V.height_cm);
      root.add(m); vase = { V, A };
    }

    const { stems, s } = layout(cart, vaseId, variantSeed);
    const rnd = mulberry32(cartSeed(cart, variantSeed) + 11);
    const ORIGIN = vase ? new THREE.Vector3(0, vase.V.height_cm * 0.95, 0) : new THREE.Vector3(0, 0, 0);
    const NECK = vase ? vase.A.neck * vase.V.height_cm * 0.72 : 0;

    const occ = {}, usedKeys = {};
    stems.forEach((st, idx) => {
      const n = occ[st.item.id] = (occ[st.item.id] || 0) + 1;
      const key = st.item.id + '#' + (n - 1);   // устойчивый ключ цветка
      usedKeys[key] = true;
      const headPos = manual[key] ? manual[key].clone() : st.pos.clone();

      const g = new THREE.Group();
      let base;
      if (vase){
        const ob = ORIGIN.clone();
        const a = idx * GOLDEN, rr = NECK * Math.sqrt((idx + 0.5) / stems.length);
        ob.x += Math.cos(a) * rr; ob.z += Math.sin(a) * rr;
        const knee = new THREE.Vector3(ob.x, vase.V.height_cm * 1.06, ob.z);
        g.add(makeCyl(ob, knee));       // нижний сегмент фиксирован в горловине
        base = knee;
      } else {
        base = ORIGIN.clone();          // точка связки в руке
      }
      const aim = makeCyl(base, headPos);
      const dir = headPos.clone().sub(base).normalize();
      const head = window.ModelLoader.bloomMesh(st.item, rnd);
      head.position.copy(headPos);
      head.quaternion.setFromUnitVectors(UP, dir);
      g.add(aim); g.add(head);
      g.userData = { delay: idx * 0.012, idx, key, base: base.clone(), headPos: headPos.clone(), aimStem: aim, head };
      root.add(g); flowerGroups.push(g);
    });

    // габариты для кадрирования
    let lo = 1e9, hi = -1e9, rad = 0;
    flowerGroups.forEach(g => {
      const b = 6 * 0.6;
      const p = g.userData.headPos;
      lo = Math.min(lo, p.y - b); hi = Math.max(hi, p.y + b);
      rad = Math.max(rad, Math.hypot(p.x, p.z) + b);
    });
    if (vase){
      lo = Math.min(lo, 0); hi = Math.max(hi, vase.V.height_cm);
      rad = Math.max(rad, vase.V.height_cm * vase.A.w * 0.5);
    }
    if (lo > hi){ lo = 0; hi = 20; }

    return {
      root, flowerGroups, stats: s, vase, usedKeys,
      focus: { y: (lo + hi) / 2, radius: rad, top: hi, bottom: lo },
    };
  }

  return { build, reaimFlower };
})();
