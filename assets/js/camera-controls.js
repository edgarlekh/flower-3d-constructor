/* ============================================================
   КАМЕРА ДЛЯ ТЕЛЕФОНА
   Один палец — поворот, два — приближение и сдвиг, двойное
   касание — вернуть вид. Точка вращения всегда стоит в центре
   букета, поэтому вблизи цветы не улетают за экран. После броска —
   мягкая инерция.

   createCameraControls(camera, el, opts) → {
     place()                       — поставить камеру по текущим углам
     frame(focus, fit, keepDist)   — навести на центр букета
     updateInertia()               — дожать инерцию (звать каждый кадр)
     getPointerCount()             — сколько пальцев на экране
   }
   opts.onInteract — колбэк на первое касание (спрятать подсказку).
   ============================================================ */
window.createCameraControls = function(camera, el, opts){
  opts = opts || {};
  const DMIN = 3.5, DMAX = 300;
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

  let az = .7, pol = 1.28, dist = 110;
  const target = new THREE.Vector3(0, 32, 0);
  let vaz = 0, vpol = 0;                       // инерция после броска

  function place(){
    camera.position.set(
      target.x + dist*Math.sin(pol)*Math.cos(az),
      target.y + dist*Math.cos(pol),
      target.z + dist*Math.sin(pol)*Math.sin(az));
    camera.lookAt(target);
  }
  function pan(dx, dy){
    const f = new THREE.Vector3().subVectors(target, camera.position).normalize();
    const r = new THREE.Vector3().crossVectors(f, new THREE.Vector3(0,1,0)).normalize();
    const u = new THREE.Vector3().crossVectors(r, f).normalize();
    const s = dist*0.0016;
    target.addScaledVector(r, -dx*s).addScaledVector(u, dy*s);
    target.y = clamp(target.y, -10, 120);
    const rr = Math.hypot(target.x, target.z);
    if (rr > 40){ target.x *= 40/rr; target.z *= 40/rr; }
    place();
  }
  function frame(focus, fit, keepDist){
    target.copy(focus);
    if (!keepDist) dist = clamp(fit, DMIN, DMAX);
    place();
  }

  const ptrs = new Map();
  let last2 = null;

  el.addEventListener('pointerdown', e => {
    if (opts.onInteract) opts.onInteract();
    el.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY, btn:e.button, shift:e.shiftKey});
    vaz = vpol = 0;
  });
  el.addEventListener('pointermove', e => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 1){
      if (p.btn === 2 || p.shift || e.ctrlKey){ pan(dx, dy); return; }
      const base = Math.max(220, Math.min(el.clientWidth, el.clientHeight));
      const k = Math.PI*1.6/base;      // проводишь через экран — примерно полоборота
      vaz = -dx*k; vpol = -dy*k*0.7;   // по вертикали мягче, чтобы не заваливать
      az += vaz; pol = clamp(pol + vpol, .30, 1.70);
      place();
    } else if (ptrs.size === 2){
      const a = [...ptrs.values()];
      const d = Math.hypot(a[0].x-a[1].x, a[0].y-a[1].y);
      const cx = (a[0].x+a[1].x)/2, cy = (a[0].y+a[1].y)/2;
      if (last2 && d > 0){
        dist = clamp(dist*Math.pow(last2.d/d, 0.9), DMIN, DMAX);
        pan(cx-last2.cx, cy-last2.cy);
      }
      last2 = {d, cx, cy};
      place();
    }
  });
  function endPtr(e){ ptrs.delete(e.pointerId); if (ptrs.size < 2) last2 = null; }
  el.addEventListener('pointerup', endPtr);
  el.addEventListener('pointercancel', endPtr);
  el.addEventListener('pointerleave', endPtr);
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('wheel', e => {
    e.preventDefault();
    dist = clamp(dist*(1 + e.deltaY*.0012), DMIN, DMAX); place();
  }, {passive:false});

  // двойное касание / двойной клик — вернуть вид (через колбэк наружу)
  el.addEventListener('dblclick', () => { if (opts.onReset) opts.onReset(); });
  let tapT = 0;
  el.addEventListener('pointerup', e => {
    if (e.pointerType !== 'touch') return;
    const now = Date.now();
    if (now - tapT < 300 && opts.onReset) opts.onReset();
    tapT = now;
  });

  function updateInertia(){
    if (!ptrs.size && (Math.abs(vaz) > 1e-4 || Math.abs(vpol) > 1e-4)){
      az += vaz; pol = clamp(pol + vpol, .30, 1.70); vaz *= .86; vpol *= .86; place();
    }
  }

  return { place, frame, updateInertia, getPointerCount: () => ptrs.size };
};
