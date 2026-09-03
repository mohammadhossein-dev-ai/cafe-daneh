/*
 * home-scene.js — صحنهٔ سه‌بعدی «فنجان شب» (ESM)
 *
 * معماری (طبق skillهای threejs):
 *  - فنجان/بشقاب: LatheGeometry · دسته: TorusGeometry · حلقهٔ طلایی: TorusGeometry با MeshStandard (فلز)
 *  - سطح قهوه: Circle با MeshPhysical براق (envMap از PMREM بومِ equirect کوچک — بدون فایل خارجی)
 *  - بخار: Sprite با تکسچور بوم شعاعی، NormalBlending، depthWrite:false (طبق craft شفافیت)
 *  - دانه‌ها: CapsuleGeometry مشترک + متریال مشترک (کاهش درگ)
 *  - دوربین: کی‌فریم‌های اسکرولی (progress 0..1) با lerp نرم = حس scrub
 *  - کارایی: DPR محدود، تعداد ذرات کمتر در موبایل، توقف rAF وقتی تب مخفی است
 *  - فال‌بک: هر خطا (لود Three/WebGL) → کلاس no-fx و سایت ایستا و خوانا
 */

(async function () {
  const canvas = document.getElementById('scene');
  if (!canvas) return;

  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmall = window.matchMedia('(max-width: 768px)').matches || (window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 900);

  function fail() {
    document.documentElement.classList.add('no-fx');
  }

  /* ---------- بارگذاری Three ---------- */
  let THREE;
  try {
    THREE = await import('../vendor/three.module.min.js');
  } catch (e) {
    fail();
    return;
  }

  /* ---------- رندرر ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isSmall, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    fail();
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isSmall ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  /* ---------- صحنه و دوربین ---------- */
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d0a07, 10, 30);

  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.7, 7.4);

  /* ---------- محیط بازتابی (بوم equirect کوچک) ---------- */
  try {
    const envCanvas = document.createElement('canvas');
    envCanvas.width = isSmall ? 128 : 256;
    envCanvas.height = isSmall ? 64 : 128;
    const g = envCanvas.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, envCanvas.height);
    grad.addColorStop(0, '#4a3319');
    grad.addColorStop(0.45, '#1a120a');
    grad.addColorStop(1, '#050403');
    g.fillStyle = grad;
    g.fillRect(0, 0, envCanvas.width, envCanvas.height);
    const glow = g.createRadialGradient(envCanvas.width * 0.3, envCanvas.height * 0.22, 4, envCanvas.width * 0.3, envCanvas.height * 0.22, envCanvas.width * 0.28);
    glow.addColorStop(0, 'rgba(255, 214, 158, 0.9)');
    glow.addColorStop(1, 'rgba(255, 214, 158, 0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, envCanvas.width, envCanvas.height);
    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    envTex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(envTex).texture;
    envTex.dispose();
    pmrem.dispose();
  } catch (e) { /* بدون env هم صحنه با نورها کار می‌کند */ }

  /* ---------- نورها ---------- */
  scene.add(new THREE.AmbientLight(0x3a2c1c, 0.9));

  const key = new THREE.SpotLight(0xffd9a0, 180, 0, Math.PI / 5, 0.6, 1.4);
  key.position.set(4.5, 7.5, 5.5);
  scene.add(key);
  scene.add(key.target);
  key.target.position.set(0, 0.6, 0);

  const rim = new THREE.PointLight(0xd9a253, 26, 20, 1.8);
  rim.position.set(-4.2, 2.8, -3.4);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x8a6428, 0.45);
  fill.position.set(-3, 4, 6);
  scene.add(fill);

  /* ---------- میز ---------- */
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x120d09, roughness: 0.92, metalness: 0.0 });
  const table = new THREE.Mesh(new THREE.CircleGeometry(30, 64), tableMat);
  table.rotation.x = -Math.PI / 2;
  scene.add(table);

  /* ---------- متریال‌های مشترک ---------- */
  const matteBlack = new THREE.MeshPhysicalMaterial({
    color: 0x171210, roughness: 0.38, metalness: 0.05,
    clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.9,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xd9a253, metalness: 1.0, roughness: 0.24, envMapIntensity: 1.5,
  });
  const coffeeMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a0d05, roughness: 0.14, metalness: 0.1, envMapIntensity: 1.7,
  });
  const beanMat = new THREE.MeshStandardMaterial({
    color: 0x3d2413, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.5,
  });

  /* ---------- گروه فنجان ---------- */
  const cupGroup = new THREE.Group();
  scene.add(cupGroup);

  function latheFromPairs(pairs, segments) {
    const pts = pairs.map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    return new THREE.LatheGeometry(pts, segments);
  }

  /* بشقاب */
  const saucer = new THREE.Mesh(
    latheFromPairs([[0.05, 0], [0.86, 0.015], [1.04, 0.08], [0.98, 0.105], [0.2, 0.05]], 64),
    matteBlack
  );
  cupGroup.add(saucer);

  /* بدنهٔ فنجان */
  const cup = new THREE.Mesh(
    latheFromPairs([
      [0.30, 0.0], [0.42, 0.02], [0.52, 0.16], [0.62, 0.52], [0.68, 0.86], [0.70, 0.98],
      [0.655, 0.985], [0.615, 0.9], [0.53, 0.3], [0.17, 0.2], [0.0, 0.19],
    ], 64),
    matteBlack
  );
  cup.position.y = 0.09;
  cupGroup.add(cup);

  /* حلقهٔ طلایی لبه */
  const rimRing = new THREE.Mesh(new THREE.TorusGeometry(0.695, 0.016, 14, 72), gold);
  rimRing.rotation.x = Math.PI / 2;
  rimRing.position.y = 1.07;
  cupGroup.add(rimRing);

  /* دسته */
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.048, 12, 36, Math.PI * 1.15), matteBlack);
  handle.position.set(0.70, 0.62, 0);
  handle.rotation.z = -Math.PI / 2 + 0.18;
  cupGroup.add(handle);

  /* سطح قهوه */
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.565, 48), coffeeMat);
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.92;
  cupGroup.add(coffee);

  /* سایهٔ تماسی (تکسچور بوم شعاعی) */
  (function contactShadow() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    rg.addColorStop(0, 'rgba(0,0,0,0.62)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 3.4),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    shadow.renderOrder = 1;
    cupGroup.add(shadow);
  })();

  /* ---------- دانه‌ها ---------- */
  const beanGeo = new THREE.CapsuleGeometry(0.11, 0.16, 6, 12);
  beanGeo.scale(1, 0.78, 0.62);
  const beanCount = isSmall ? 12 : 26;
  const beans = [];
  let placed = 0;
  let guard = 0;
  while (placed < beanCount && guard < 400) {
    guard += 1;
    const a = Math.random() * Math.PI * 2;
    const r = 1.9 + Math.random() * 1.7;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) < 1.6 && Math.abs(z) < 1.6) continue; /* جای فنجان خالی بماند */
    const bean = new THREE.Mesh(beanGeo, beanMat);
    bean.position.set(x, 0.09, z);
    bean.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5);
    scene.add(bean);
    beans.push(bean);
    placed += 1;
  }

  /* سه دانهٔ شناور (حس زندگی) */
  const floaters = [
    { pos: new THREE.Vector3(-1.7, 0.95, 0.5), phase: 0 },
    { pos: new THREE.Vector3(-2.15, 1.25, -0.7), phase: 2.1 },
    { pos: new THREE.Vector3(-1.25, 1.6, -1.2), phase: 4.2 },
  ].map(function (f) {
    const m = new THREE.Mesh(beanGeo, beanMat);
    m.position.copy(f.pos);
    scene.add(m);
    return { mesh: m, base: f.pos.clone(), phase: f.phase };
  });

  /* ---------- بخار ---------- */
  const steamTex = (function () {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 256;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(64, 128, 10, 64, 128, 118);
    rg.addColorStop(0, 'rgba(236, 224, 202, 0.85)');
    rg.addColorStop(0.55, 'rgba(236, 224, 202, 0.28)');
    rg.addColorStop(1, 'rgba(236, 224, 202, 0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, 128, 256);
    return new THREE.CanvasTexture(c);
  })();

  const steamCount = isSmall ? 9 : 16;
  const steam = [];
  for (let i = 0; i < steamCount; i += 1) {
    const mat = new THREE.SpriteMaterial({
      map: steamTex, transparent: true, opacity: 0,
      color: 0xcdbfa6, depthWrite: false,
    });
    const s = new THREE.Sprite(mat);
    s.scale.set(0.42, 1.05, 1);
    cupGroup.add(s);
    steam.push({
      sprite: s,
      offset: i / steamCount,
      speed: 0.16 + Math.random() * 0.1,
      sway: 0.1 + Math.random() * 0.1,
      x0: (Math.random() - 0.5) * 0.3,
      z0: (Math.random() - 0.5) * 0.2,
    });
  }

  /* ---------- کی‌فریم‌های اسکرول ---------- */
  const KF = [
    { p: 0.00, cam: [0.0, 1.7, 7.4], look: [0.0, 0.95, 0.0], cupX: 0.00, steam: 1.0, rimBoost: 1.0 },
    { p: 0.20, cam: [2.7, 1.0, 4.4], look: [-0.45, 0.28, 0.0], cupX: -0.9, steam: 1.0, rimBoost: 1.05 },
    { p: 0.42, cam: [0.55, 2.15, 2.75], look: [0.0, 1.28, 0.0], cupX: 0.15, steam: 1.9, rimBoost: 1.15 },
    { p: 0.66, cam: [-2.45, 1.75, 5.85], look: [0.45, 1.0, 0.0], cupX: 1.15, steam: 0.85, rimBoost: 1.0 },
    { p: 0.88, cam: [0.0, 2.35, 8.25], look: [0.0, 1.0, 0.0], cupX: 0.0, steam: 1.45, rimBoost: 1.7 },
    { p: 1.00, cam: [0.0, 2.05, 8.9], look: [0.0, 0.92, 0.0], cupX: 0.0, steam: 1.25, rimBoost: 1.6 },
  ];

  function smooth(t) { return t * t * (3 - 2 * t); }

  function sampleKF(p) {
    let i = 0;
    while (i < KF.length - 2 && p > KF[i + 1].p) i += 1;
    const a = KF[i];
    const b = KF[i + 1];
    const span = Math.max(b.p - a.p, 0.0001);
    const t = smooth(Math.min(Math.max((p - a.p) / span, 0), 1));
    function lerp3(u, v) {
      return [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t, u[2] + (v[2] - u[2]) * t];
    }
    return {
      cam: lerp3(a.cam, b.cam),
      look: lerp3(a.look, b.look),
      cupX: a.cupX + (b.cupX - a.cupX) * t,
      steam: a.steam + (b.steam - a.steam) * t,
      rimBoost: a.rimBoost + (b.rimBoost - a.rimBoost) * t,
    };
  }

  /* ---------- پیشرفت اسکرول ---------- */
  const story = document.getElementById('story');
  function getProgress() {
    if (!story) return 0;
    const span = Math.max(story.offsetHeight - window.innerHeight, 1);
    return Math.min(Math.max(window.scrollY / span, 0), 1);
  }

  /* ---------- حلقهٔ رندر ---------- */
  const camTarget = new THREE.Vector3();
  let current = 0;
  let time = 0;
  let running = true;
  const clock = new THREE.Clock();

  const steamSpeedK = reduced ? 0.4 : 1;
  const idleK = reduced ? 0 : 1;

  function applyFrame() {
    const k = sampleKF(current);
    camera.position.set(k.cam[0], k.cam[1], k.cam[2]);
    camTarget.set(k.look[0], k.look[1], k.look[2]);
    camera.lookAt(camTarget);
    cupGroup.position.x = k.cupX;
    cupGroup.rotation.y = current * Math.PI * 1.6 + time * 0.12 * idleK;
    rim.intensity = 26 * k.rimBoost;

    steam.forEach(function (s) {
      const t = (time * s.speed * steamSpeedK + s.offset) % 1;
      s.sprite.position.set(
        s.x0 + Math.sin(time * 1.25 + s.offset * 9) * s.sway * t,
        1.12 + t * 1.55,
        s.z0
      );
      const grow = 0.42 + t * 0.5;
      s.sprite.scale.set(grow, grow * 2.4, 1);
      s.sprite.material.opacity = Math.sin(Math.PI * Math.min(t, 1)) * 0.3 * k.steam;
    });

    floaters.forEach(function (f) {
      f.mesh.position.y = f.base.y + Math.sin(time * 0.8 + f.phase) * 0.06 * idleK;
      f.mesh.rotation.y += 0.004 * idleK;
      f.mesh.rotation.x += 0.002 * idleK;
    });
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    time += dt;
    const target = reduced ? 0 : getProgress();
    current += (target - current) * (isSmall ? 0.14 : 0.085);
    applyFrame();
    renderer.render(scene, camera);
  }

  /* توقف کامل وقتی تب مخفی است (باتری) */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      clock.getDelta();
      frame();
    }
  });

  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  clock.getDelta();
  frame();
})();
