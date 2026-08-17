/* ============================================================
   ДВИЖОК РУЧНОЙ РАССТАНОВКИ — «взять и поставить»
   Сердце продукта. Нажал на цветок (мышью или пальцем) и тянешь —
   он едет за курсором в плоскости экрана. Нажал на пустое место —
   работает камера. Этот же движок дальше ляжет в основу расстановки
   в зале и на арке.

   createFlowerDrag(camera, el, opts) → { isDragging() }
   opts:
     getPickables()      — массив верхних групп-цветков (что можно хватать)
     canGrab()           — можно ли сейчас хватать (напр. закончилась анимация роста)
     moveTo(group, pos)  — переставить цветок в новую точку (THREE.Vector3)
     setCameraPaused(b)  — притормозить/вернуть камеру
     onGrab(group), onRelease(group) — колбэки для подсветки

   Слушатели на фазе перехвата (capture) — срабатывают раньше камеры,
   и при захвате цветка глушат событие, чтобы камера не поехала.
   ============================================================ */
window.createFlowerDrag = function(camera, el, opts){
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane();
  const hit = new THREE.Vector3();
  const grabOffset = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  let active = null, activePointer = null;

  function toNDC(e){
    const r = el.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  }

  // Какую верхнюю группу-цветок задел луч (или null).
  function pick(e){
    toNDC(e); ray.setFromCamera(ndc, camera);
    const groups = opts.getPickables();
    const hits = ray.intersectObjects(groups, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && groups.indexOf(o) === -1) o = o.parent;
    return groups.indexOf(o) === -1 ? null : o;
  }

  el.addEventListener('pointerdown', e => {
    if (active || (opts.canGrab && !opts.canGrab())) return;
    const g = pick(e);
    if (!g) return;                          // мимо цветка — пусть работает камера
    active = g; activePointer = e.pointerId;
    try { el.setPointerCapture(e.pointerId); } catch(_){}
    opts.setCameraPaused(true);
    // плоскость перетаскивания: проходит через цветок и смотрит на камеру
    camera.getWorldDirection(camDir);
    plane.setFromNormalAndCoplanarPoint(camDir, g.userData.headPos);
    if (ray.ray.intersectPlane(plane, hit)) grabOffset.copy(g.userData.headPos).sub(hit);
    else grabOffset.set(0,0,0);
    e.stopPropagation();
    el.style.cursor = 'grabbing';
    if (opts.onGrab) opts.onGrab(g);
  }, true);

  el.addEventListener('pointermove', e => {
    if (!active){
      // подсказка курсором на компе: над цветком — «схватить»
      if (e.pointerType === 'mouse' && opts.canGrab && opts.canGrab()){
        el.style.cursor = pick(e) ? 'grab' : '';
      }
      return;
    }
    if (e.pointerId !== activePointer) return;
    toNDC(e); ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) opts.moveTo(active, hit.clone().add(grabOffset));
    e.stopPropagation();
  }, true);

  function end(e){
    if (!active || e.pointerId !== activePointer) return;
    const g = active; active = null; activePointer = null;
    opts.setCameraPaused(false);
    el.style.cursor = '';
    if (opts.onRelease) opts.onRelease(g);
    e.stopPropagation();
  }
  el.addEventListener('pointerup', end, true);
  el.addEventListener('pointercancel', end, true);

  return { isDragging: () => !!active };
};
