/* ============================================================
   ЗАГРУЗЧИК МОДЕЛЕЙ
   Распаковывает компактный JSON (window.VASE_MODELS, window.ROSE_MODEL)
   обратно в геометрию three.js и собирает меши бутонов.

   Настоящие модели с фотографий пропущены через TRELLIS 2. Цвет розы
   снят с исходной текстуры и уложен прямо в вершины — поэтому текстура
   ей не нужна. Вазы несут текстуру; для неё обязательно flipY=false,
   иначе развёртка ложится зеркально (glTF: V идёт сверху вниз).

   Наружу отдаёт window.ModelLoader:
     vaseAssets   — { ключ: {geo, mat, neck, w} }
     roseGeo/roseMat
     bloomMesh(item, rnd) — готовый THREE-объект бутона по позиции каталога
   ============================================================ */
window.ModelLoader = (function(){
  const bytes = s => {
    const b = atob(s), u = new Uint8Array(b.length);
    for (let k = 0; k < b.length; k++) u[k] = b.charCodeAt(k);
    return u;
  };

  /* ---------- вазы: геометрия + текстура ---------- */
  const vaseAssets = {};
  (function(){
    const D = window.VASE_MODELS; if (!D) return;
    for (const key in D){
      const R = D[key];
      const P = new Uint16Array(bytes(R.p).buffer),
            U = new Uint16Array(bytes(R.u).buffer),
            Nq = new Int8Array(bytes(R.n).buffer),
            I = R.i32 ? new Uint32Array(bytes(R.i).buffer) : new Uint16Array(bytes(R.i).buffer);
      const pos = new Float32Array(R.nv*3), uv = new Float32Array(R.nv*2), nrm = new Float32Array(R.nv*3);
      for (let v = 0; v < R.nv; v++){
        for (let k = 0; k < 3; k++){
          pos[v*3+k] = R.mn[k] + P[v*3+k]/65535*R.sp[k];
          nrm[v*3+k] = Nq[v*3+k]/127;
        }
        uv[v*2] = U[v*2]/65535; uv[v*2+1] = U[v*2+1]/65535;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos,3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm,3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv,2));
      g.setIndex(new THREE.BufferAttribute(I,1));
      g.computeVertexNormals();
      const img = new Image(); const t = new THREE.Texture(img);
      t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
      t.flipY = false;                                   // glTF: V идёт сверху вниз
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      img.onload = () => { t.needsUpdate = true; }; img.src = R.t;
      vaseAssets[key] = {
        geo: g,
        mat: new THREE.MeshStandardMaterial({map:t, roughness:.35, metalness:0, side:THREE.FrontSide}),
        neck: R.neck, w: R.w
      };
    }
  })();

  /* ---------- роза: цвет в вершинах ---------- */
  let roseGeo = null, roseMat = null;
  (function(){
    const R = window.ROSE_MODEL; if (!R) return;
    const P = new Uint16Array(bytes(R.p).buffer), C8 = bytes(R.c),
          Nq = new Int8Array(bytes(R.n).buffer), I = new Uint16Array(bytes(R.i).buffer);
    const pos = new Float32Array(R.nv*3), col = new Float32Array(R.nv*3), nrm = new Float32Array(R.nv*3);
    for (let i = 0; i < R.nv; i++) for (let k = 0; k < 3; k++){
      pos[i*3+k] = R.mn[k] + P[i*3+k]/65535*R.sp[k];
      nrm[i*3+k] = Nq[i*3+k]/127;
      col[i*3+k] = Math.pow(C8[i*3+k]/255, 2.2);         // в линейное пространство
    }
    roseGeo = new THREE.BufferGeometry();
    roseGeo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    roseGeo.setAttribute('normal', new THREE.BufferAttribute(nrm,3));
    roseGeo.setAttribute('color', new THREE.BufferAttribute(col,3));
    roseGeo.setIndex(new THREE.BufferAttribute(I,1));
    roseMat = new THREE.MeshStandardMaterial({vertexColors:true, roughness:.68, metalness:0, side:THREE.DoubleSide});
  })();

  /* ---------- процедурные бутоны (кэш материалов) ---------- */
  const matCache = {};
  function mat(hex, rough){
    const k = hex + '_' + rough;
    if (!matCache[k]) matCache[k] = new THREE.MeshStandardMaterial({color:hex, roughness:rough, flatShading:true});
    return matCache[k];
  }

  /* Собирает объект бутона по позиции каталога.
     Красная роза — настоящая модель, остальное — процедурные формы. */
  function bloomMesh(item, rnd){
    if (item.model && roseGeo){
      const g = new THREE.Group();
      const m = new THREE.Mesh(roseGeo, roseMat);
      m.scale.setScalar(item.bloom_cm);
      m.position.y = -item.bloom_cm*0.14;
      m.rotation.y = rnd()*6.283;
      m.rotation.x = (rnd()-.5)*0.25;
      g.add(m); return g;
    }
    const g = new THREE.Group();
    const r = item.bloom_cm/2;
    if (item.shape === 'ball'){
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r,1), mat(item.color,.62));
      m.scale.set(1,.82,1); m.rotation.y = rnd()*3; g.add(m);
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r*.55,0), mat(item.color,.5));
      c.position.y = r*.35; g.add(c);
    } else if (item.shape === 'cup'){
      const m = new THREE.Mesh(new THREE.SphereGeometry(r,10,8,0,Math.PI*2,0,Math.PI*.62), mat(item.color,.55));
      m.rotation.x = Math.PI; m.position.y = r*.35; m.scale.set(1,1.5,1); g.add(m);
    } else if (item.shape === 'cluster'){
      const n = item.role === 'filler' ? 16 : 22;
      for (let i = 0; i < n; i++){
        const a = rnd()*Math.PI*2, b = Math.acos(rnd()*.9), rr = r*(.55+rnd()*.45);
        const p = new THREE.Mesh(new THREE.IcosahedronGeometry(r*(item.role==='filler'?.13:.2),0), mat(item.color,.7));
        p.position.set(Math.sin(b)*Math.cos(a)*rr, Math.cos(b)*rr*.75+r*.2, Math.sin(b)*Math.sin(a)*rr);
        g.add(p);
      }
    } else { // spray — веточка с листьями
      const L = item.bloom_cm;
      for (let i = 0; i < 7; i++){
        const t = i/6, side = i%2 ? 1 : -1;
        const l = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9-t*.6,0), mat(item.color,.8));
        l.scale.set(1,.35,.62);
        l.position.set(side*(2.1+rnd()), (t-.5)*L*.85, (rnd()-.5)*1.6);
        l.rotation.z = side*.5; g.add(l);
      }
    }
    return g;
  }

  return { vaseAssets, get roseGeo(){return roseGeo;}, get roseMat(){return roseMat;}, mat, bloomMesh };
})();
