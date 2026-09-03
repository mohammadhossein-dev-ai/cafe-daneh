/*
 * product-3d.js — نمایشگر سه‌بعدی کوچک محصول (فنجان یا دانه‌ها)
 * چرخش خودکار + کشیدن با اشاره‌گر؛ بدون وابستگی به GSAP؛ فال‌بک: مخفی‌شدن بوم و نمایش آیکون
 */
export function initProductScene(container, product) {
  let THREE;
  import('../vendor/three.module.min.js')
    .then(function (mod) {
      THREE = mod;
      boot();
    })
    .catch(function () {
      container.classList.add('no-fx');
    });

  function fail() {
    container.classList.add('no-fx');
  }

  function boot() {
    const canvas = document.createElement('canvas');
    container.insertBefore(canvas, container.firstChild);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (e) {
      fail();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
    camera.position.set(0, 1.6, 4.6);
    camera.lookAt(0, 0.7, 0);

    /* محیط */
    try {
      const ec = document.createElement('canvas');
      ec.width = 128; ec.height = 64;
      const g = ec.getContext('2d');
      const grad = g.createLinearGradient(0, 0, 0, 64);
      grad.addColorStop(0, '#4a3319');
      grad.addColorStop(1, '#050403');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 64);
      const tex = new THREE.CanvasTexture(ec);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromEquirectangular(tex).texture;
      tex.dispose();
      pmrem.dispose();
    } catch (e) { /* بدون env */ }

    scene.add(new THREE.AmbientLight(0x3a2c1c, 0.9));
    const key = new THREE.SpotLight(0xffd9a0, 140, 0, Math.PI / 5, 0.6, 1.4);
    key.position.set(3, 5, 4);
    scene.add(key);
    key.target.position.set(0, 0.5, 0);
    scene.add(key.target);
    const rim = new THREE.PointLight(0xd9a253, 20, 15, 1.8);
    rim.position.set(-3, 2, -2.4);
    scene.add(rim);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(8, 48),
      new THREE.MeshStandardMaterial({ color: 0x120d09, roughness: 0.92 })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.55;
    scene.add(disc);

    const matteBlack = new THREE.MeshPhysicalMaterial({
      color: 0x171210, roughness: 0.38, metalness: 0.05,
      clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.9,
    });
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9a253, metalness: 1, roughness: 0.24, envMapIntensity: 1.5 });

    const group = new THREE.Group();
    scene.add(group);

    function lathe(pairs, seg) {
      return new THREE.LatheGeometry(pairs.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 48);
    }

    if (product.model3d === 'beans') {
      /* تودهٔ دانه + یک دانهٔ شاخص بزرگ */
      const beanMat = new THREE.MeshStandardMaterial({ color: 0x3d2413, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.5 });
      const beanGeo = new THREE.CapsuleGeometry(0.22, 0.3, 6, 12);
      beanGeo.scale(1, 0.78, 0.62);
      for (let i = 0; i < 14; i += 1) {
        const b = new THREE.Mesh(beanGeo, beanMat);
        const a = (i / 14) * Math.PI * 2;
        const r = i === 0 ? 0 : 0.75 + Math.random() * 0.5;
        b.position.set(Math.cos(a) * r, -0.4 + (i === 0 ? 0.06 : Math.random() * 0.1), Math.sin(a) * r);
        b.rotation.set(Math.random(), Math.random() * Math.PI, Math.random() * 0.6);
        group.add(b);
      }
      const hero = new THREE.Mesh(beanGeo, beanMat);
      hero.scale.setScalar(1.7);
      hero.position.set(0, 0.55, 0);
      hero.rotation.z = -0.35;
      group.add(hero);
    } else {
      /* فنجان با رنگ نوشیدنی بر اساس دسته/نام */
      const cup = new THREE.Mesh(lathe([
        [0.3, 0], [0.42, 0.02], [0.52, 0.16], [0.62, 0.52], [0.68, 0.86], [0.7, 0.98],
        [0.655, 0.985], [0.615, 0.9], [0.53, 0.3], [0.17, 0.2], [0, 0.19],
      ], 64), matteBlack);
      cup.position.y = 0.09;
      group.add(cup);

      const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.695, 0.016, 14, 72), gold);
      rimRing.rotation.x = Math.PI / 2;
      rimRing.position.y = 1.07;
      group.add(rimRing);

      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.048, 12, 36, Math.PI * 1.15), matteBlack);
      handle.position.set(0.7, 0.62, 0);
      handle.rotation.z = -Math.PI / 2 + 0.18;
      group.add(handle);

      const liquidColors = {
        'اسپرسو': 0x1a0d05, 'آمریکانو': 0x241206, 'لاته': 0xc9a06a,
        'کاپوچینو': 0xb98f5c, 'موکا': 0x3a2012, 'فلت وایت': 0xa9825a,
        'آیس لاته': 0xb98f5c, 'آیس آمریکانو': 0x241206, 'کلد برو': 0x140a04,
      };
      const liquid = liquidColors[product.category] || liquidColors[product.name] || 0x1a0d05;
      const surface = new THREE.Mesh(
        new THREE.CircleGeometry(0.565, 48),
        new THREE.MeshPhysicalMaterial({ color: liquid, roughness: 0.14, metalness: 0.1, envMapIntensity: 1.7 })
      );
      surface.rotation.x = -Math.PI / 2;
      surface.position.y = 0.92;
      group.add(surface);
    }

    /* اندازه */
    function resize() {
      const w = container.clientWidth || 300;
      const h = container.clientHeight || w;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize);

    /* چرخش: خودکار + کشیدن */
    let rotY = 0.6;
    let target = 0.6;
    let dragging = false;
    let lastX = 0;
    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', function (e) {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      target += (e.clientX - lastX) * 0.008;
      lastX = e.clientX;
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      canvas.addEventListener(ev, function () {
        dragging = false;
        canvas.style.cursor = 'grab';
      });
    });

    const clock = new THREE.Clock();
    let running = true;
    function frame() {
      if (!running) return;
      requestAnimationFrame(frame);
      const dt = Math.min(clock.getDelta(), 0.05);
      if (!dragging) target += dt * 0.25;
      rotY += (target - rotY) * 0.1;
      group.rotation.y = rotY;
      renderer.render(scene, camera);
    }
    frame();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) running = false;
      else if (!running) { running = true; clock.getDelta(); frame(); }
    });
  }
}
