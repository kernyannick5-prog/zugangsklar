/* Yanqiva Hero-3D: das Yanqiva-Zeichen als echtes 3D-Objekt (three.js, selbst gehostet) in .hero-art.
   Indigo-Kachel mit Clearcoat, weisser Schaft + linker Arm, mintfarbener rechter Arm (Masse wie brand/yanqiva-zeichen.svg),
   Umgebungsreflexe per RoomEnvironment/PMREM, weiches Glühen (Sprite statt Bloom: bleibt transparent und guenstig),
   Orbit-Ring mit Lichtpunkt und wenigen Partikeln, sanftes Schweben, langsames Pendeln, gedaempfte Mausneigung.
   Lazy: three.js erst nach dem Laden, im Leerlauf und bei sichtbarem Hero (LCP bleibt frei). Die CSS-Kachel bleibt Fallback
   und wird erst ausgeblendet, wenn der Canvas rendert (hero-art.h3d-on). Ohne WebGL: still die CSS-Grafik, keine Konsolenfehler.
   prefers-reduced-motion: ein statisches Einzelbild. Pause ausserhalb des Sichtfelds und im verdeckten Tab. Canvas aria-hidden.
   Energie: Leistungsstufen (schwache Geraete/Datensparen = gar kein 3D, Software-Rendering = kein 3D, Mobil = leicht),
   Bildrate: Desktop konstant 60 (kein Wechsel = kein Ruck beim Erkennen der Maus), Mobil 30; misst die Bildzeit und schaltet bei Ueberlast selbst herunter. */
const art = document.querySelector('.hero .hero-art');

if (art && !('IntersectionObserver' in window && 'ResizeObserver' in window)) art.classList.add('h3d-fail');
else if (art) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const nav = navigator, dpr = window.devicePixelRatio || 1;
  /* Ob 3D kommt, entscheidet das Kopf-Skript vor dem ersten Bild (html.h3d-wait: nicht schwach, WebGL vorhanden);
     schwache Geraete/Datensparen behalten die CSS-Grafik. Klappt 3D nicht oder dauert zu lange: Ersatz-Kachel (h3d-fail). */
  const weak = !document.documentElement.classList.contains('h3d-wait');
  let gaveUp = false;
  const fail = () => { gaveUp = true; art.classList.add('h3d-fail'); };
  const failTimer = weak ? 0 : setTimeout(() => { if (!art.classList.contains('h3d-on')) fail(); }, 7500); /* vor der CSS-Absicherung (8 s) */
  const lite = !fine || innerWidth < 960 || nav.hardwareConcurrency <= 4; /* leichtere Variante */
  let started = false;

  /* Start erst, wenn Hero sichtbar ist und die Seite fertig geladen wurde */
  const io = new IntersectionObserver((es) => {
    if (!es.some((e) => e.isIntersecting) || started || weak) return;
    started = true;
    io.disconnect();
    const go = () => start().then((ok) => { if (!ok) fail(); }, fail);
    /* frueh starten (Modul laeuft nach dem Parsen), aber erst im naechsten Leerlauf: Partikel und Zeichen sind fast sofort da */
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 300 }); else setTimeout(go, 50);
  });
  io.observe(art);

  async function start() {
    /* WebGL selbst anlegen: so gibt es ohne Unterstuetzung keinen Konsolenfehler */
    const canvas = document.createElement('canvas');
    /* failIfMajorPerformanceCaveat: kein 3D bei Software-Rendering (frisst CPU); Kantenglaettung nur bei niedriger Pixeldichte noetig */
    const opts = { alpha: true, antialias: dpr < 2, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true };
    const gl = canvas.getContext('webgl2', opts) || canvas.getContext('webgl', opts);
    if (!gl || gaveUp) return false;
    /* schlankes Teilpaket (nur die hier genutzten Teile + RoomEnvironment), gebaut mit tools/three-bundle */
    const THREE = await import('./vendor/three/three-hero.min.js');
    const { RoomEnvironment } = THREE;

    const renderer = new THREE.WebGLRenderer({ canvas, context: gl, alpha: true, antialias: dpr < 2 });
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping; /* hält Markenfarben ehrlich */
    canvas.className = 'h3d';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.tabIndex = -1;
    art.insertBefore(canvas, art.firstChild);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.85;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    const key = new THREE.DirectionalLight(0xffffff, 0.7); key.position.set(-3, 4, 6); scene.add(key);
    const rimL = new THREE.DirectionalLight(0x7fe0cb, 1.2); rimL.position.set(5, -2, -3); scene.add(rimL);

    /* Masse aus dem Logo (32er-Raster): Strichbreite 3.8, Kachel 31 mit Radius 7.5; k = Einheiten pro Logo-Punkt */
    const k = 0.1, R = 1.9 * k, P = (x, y) => new THREE.Vector3((x - 16) * k, (16 - y) * k, 0);
    const root = new THREE.Group(); /* Schweben, Pendeln, Mausneigung */
    scene.add(root);

    const hw = 15.5 * k, rr = 7.5 * k, sh = new THREE.Shape();
    sh.moveTo(-hw + rr, -hw); sh.lineTo(hw - rr, -hw); sh.absarc(hw - rr, -hw + rr, rr, -Math.PI / 2, 0);
    sh.lineTo(hw, hw - rr); sh.absarc(hw - rr, hw - rr, rr, 0, Math.PI / 2);
    sh.lineTo(-hw + rr, hw); sh.absarc(-hw + rr, hw - rr, rr, Math.PI / 2, Math.PI);
    sh.lineTo(-hw, -hw + rr); sh.absarc(-hw + rr, -hw + rr, rr, Math.PI, Math.PI * 1.5);
    const depth = 0.4, bev = 0.07;
    const tileGeo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 5, curveSegments: 18 });
    tileGeo.translate(0, 0, -depth / 2);
    const tile = new THREE.Mesh(tileGeo, new THREE.MeshPhysicalMaterial({ color: 0x2c2790, roughness: 0.38, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.12, envMapIntensity: 0.3 }));
    root.add(tile);

    /* Strich = Kapsel zwischen zwei Logo-Punkten (runde Enden wie stroke-linecap: round) */
    const front = depth / 2 + bev;
    const stroke = (a, b, mat, dz) => {
      const pa = P(...a), pb = P(...b), d = pb.clone().sub(pa);
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(R, d.length(), 8, 28), mat);
      m.position.copy(pa.add(pb).multiplyScalar(0.5)); m.position.z = front + R * 0.45 + dz;
      m.rotation.z = Math.atan2(d.y, d.x) - Math.PI / 2;
      root.add(m);
    };
    const white = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1 });
    const mint = new THREE.MeshPhysicalMaterial({ color: 0x7ee0c8, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0x2a8a76, emissiveIntensity: 0.35 });
    stroke([8.5, 8], [16, 17.5], white, 0);
    stroke([16, 17.5], [16, 26], white, 0);
    stroke([23.5, 8], [16, 17.5], mint, 0.03);

    /* Weiches Glühen hinter dem Zeichen (Sprite mit Radialverlauf; Normal-Blending, damit der Hintergrund transparent bleibt) */
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const g2 = gc.getContext('2d'), gr = g2.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(126,224,200,.42)'); gr.addColorStop(0.4, 'rgba(99,90,235,.24)'); gr.addColorStop(1, 'rgba(63,55,201,0)');
    g2.fillStyle = gr; g2.fillRect(0, 0, 128, 128);
    const glowTex = new THREE.CanvasTexture(gc); glowTex.colorSpace = THREE.SRGBColorSpace;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, toneMapped: false }));
    glow.scale.setScalar(7.2); glow.position.z = -1.2; scene.add(glow);

    /* Orbit: duenner Ring, wandernder Lichtpunkt, wenige Partikel */
    /* pivot dreht den Ring zusammen mit dem Zeichen zur Maus (wie frueher die CSS-Kachel samt Ring); orbit behaelt seine Schraeglage */
    const pivot = new THREE.Group(); scene.add(pivot);
    const orbit = new THREE.Group(); orbit.rotation.set(1.2, 0.15, -0.25); pivot.add(orbit);
    const ringR = 2.75;
    orbit.add(new THREE.Mesh(new THREE.TorusGeometry(ringR, 0.012, 8, 160), new THREE.MeshBasicMaterial({ color: 0x7ee0c8, transparent: true, opacity: 0.55, toneMapped: false })));
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    const beadGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, toneMapped: false }));
    beadGlow.scale.setScalar(0.9); bead.add(beadGlow); orbit.add(bead);

    const dc = document.createElement('canvas'); dc.width = dc.height = 32;
    const d2 = dc.getContext('2d'), dg = d2.createRadialGradient(16, 16, 0, 16, 16, 16);
    dg.addColorStop(0, 'rgba(255,255,255,1)'); dg.addColorStop(0.35, 'rgba(255,255,255,.7)'); dg.addColorStop(1, 'rgba(255,255,255,0)');
    d2.fillStyle = dg; d2.fillRect(0, 0, 32, 32);
    const dotTex = new THREE.CanvasTexture(dc);
    const N = lite ? 22 : 56, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), tint = [new THREE.Color(0x7fe0cb), new THREE.Color(0x8c86ff), new THREE.Color(0xffffff)];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = ringR + (Math.random() - 0.5) * 1.6;
      pos.set([Math.cos(a) * r, Math.sin(a) * r, (Math.random() - 0.5) * 1.1], i * 3);
      const c = tint[i % 3]; col.set([c.r, c.g, c.b], i * 3);
    }
    const dotGeo = new THREE.BufferGeometry();
    dotGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); dotGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const dots = new THREE.Points(dotGeo, new THREE.PointsMaterial({ size: lite ? 0.12 : 0.1, map: dotTex, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, sizeAttenuation: true, toneMapped: false }));
    orbit.add(dots);

    /* Hintergrund-Partikel: ein einziger Draw-Call, Bewegung nur ueber Gruppen-Rotation/Versatz (keine Daten pro Bild) */
    const BN = lite ? 70 : 170, bpos = new Float32Array(BN * 3), bcol = new Float32Array(BN * 3);
    for (let i = 0; i < BN; i++) {
      bpos.set([(Math.random() - 0.5) * 11, (Math.random() - 0.5) * 8, -1 - Math.random() * 3], i * 3);
      const c = tint[i % 3], f = 0.45 + Math.random() * 0.55; bcol.set([c.r * f, c.g * f, c.b * f], i * 3);
    }
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute('position', new THREE.BufferAttribute(bpos, 3)); bgGeo.setAttribute('color', new THREE.BufferAttribute(bcol, 3));
    const bg = new THREE.Points(bgGeo, new THREE.PointsMaterial({ size: lite ? 0.17 : 0.15, map: dotTex, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, sizeAttenuation: true, toneMapped: false }));
    scene.add(bg);

    let w = 0, h = 0, visible = true, raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, t0 = 0, px = 0, py = 0, hasP = false, follow = 0, lastT = 0, init = false, vy = 0, vx = 0,
      rect = null, lastMove = 0, lastFrame = 0, slow = 0, frames = 0, level = lite ? 1 : 0, frozen = false;
    const size = () => {
      const r = art.getBoundingClientRect();
      if (!r.width || !r.height || (r.width === w && r.height === h)) return;
      w = r.width; h = r.height;
      renderer.setPixelRatio(Math.min(dpr, level >= 2 ? 1 : level === 1 ? 1.5 : 2));
      rect = null;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      /* Halbe sichtbare Hoehe in Welteinheiten: Desktop gross, schmales Mobilband etwas knapper, damit das Y deutlich bleibt */
      const half = Math.max(w / h > 1.5 ? 2.55 : 3.3, 3.6 / camera.aspect);
      camera.position.z = half / Math.tan((camera.fov * Math.PI) / 360);
      camera.updateProjectionMatrix();
    };
    const ease = (x) => 1 - Math.pow(1 - x, 3);
    const draw = (t, fixed) => {
      const s = t / 1000, k2 = fixed ? 1 : ease(Math.min(1, (t - t0) / 1600)); /* sanftes Einfliegen */
      /* Zeiger verfolgen wie die CSS-Kachel in fx.js (gleiche Winkel/Daempfung); Pendeln blendet aus, sobald die Maus fuehrt */
      if (hasP) aim();
      /* Ziel = Mischung aus Pendeln und Zeigerrichtung; der Anteil des Zeigers waechst zeitbasiert mit weicher S-Kurve (kein Sprung beim Erkennen),
         die Drehung folgt dem Ziel als gedaempfte Feder (bildratenunabhaengig). dt begrenzt, damit nach Pausen (Tab, Scrollen) nichts springt. */
      const dt = fixed || !lastT ? 0 : Math.min(0.05, (t - lastT) / 1000); lastT = t;
      follow = Math.max(0, Math.min(1, follow + (hasP ? dt / 0.6 : -dt / 1.4)));
      const fe = follow * follow * (3 - 2 * follow);
      const swingY = Math.sin(s * 0.35) * 0.4, swingX = -0.08 + Math.sin(s * 0.27) * 0.05;
      const gy = swingY + (tx - swingY) * fe, gx = swingX + (ty - swingX) * fe;
      if (!init || fixed) { cx = gy; cy = gx; init = true; }
      else { /* kritisch gedaempfte Feder: stetige Geschwindigkeit, kein Nachschwingen; in Teilschritten fuer Stabilitaet */
        for (let i = 0, n = Math.ceil(dt / 0.008), h = dt / n; i < n; i++) {
          vy += ((gy - cx) * 56 - vy * 15) * h; vx += ((gx - cy) * 56 - vx * 15) * h; cx += vy * h; cy += vx * h;
        }
      }
      root.rotation.y = cx + (1 - k2) * -1.1;
      root.rotation.x = cy;
      pivot.rotation.y = cx; pivot.rotation.x = cy;
      /* leichter Versatz zum Zeiger hin (folgt der gefederten Drehung, also ebenso weich) */
      root.position.x = cx * 0.32; pivot.position.x = root.position.x;
      root.position.y = Math.sin(s * 0.7) * 0.09 - (1 - k2) * 0.8 - cy * 0.32;
      root.scale.setScalar(0.72 + 0.28 * k2);
      glow.material.opacity = k2; glow.scale.setScalar(7.2 + Math.sin(s * 0.8) * 0.25);
      orbit.rotation.z = -0.25 + s * 0.05;
      dots.rotation.z = s * 0.08;
      const a = s * 0.55; bead.position.set(Math.cos(a) * ringR, Math.sin(a) * ringR, 0);
      /* Ring und Partikel sind von Anfang an voll da; nur das Zeichen fliegt ein */
      /* Hintergrund: langsames Driften + Parallaxe gegen die Zeigerrichtung (Tiefenwirkung) */
      bg.rotation.z = s * 0.012; bg.position.x = -cx * 0.45; bg.position.y = cy * 0.35;
      renderer.render(scene, camera);
    };
    /* Bildrate: Desktop gleichmaessig 60, Mobil/leicht 30 (ohne Wechsel, sonst sieht man einen Ruck). Ueberlast-Erkennung:
       sind die Bilder dauerhaft zu langsam, erst Aufloesung/Hintergrund reduzieren, danach nur noch ein stehendes Bild. */
    const degrade = () => {
      level++;
      if (level === 2) { bg.visible = false; dots.visible = false; w = 0; size(); }
      if (level >= 3) frozen = true;
    };
    const loop = (t) => {
      raf = 0;
      if (!visible || document.hidden || frozen) { lastT = 0; lastFrame = 0; return; }
      const step = level === 0 ? 1000 / 60 : 1000 / 30;
      if (t - lastFrame >= step * 0.8) { /* Toleranz: bei 120/144 Hz gleichmaessig jedes 2. Bild */
        const gap = lastFrame ? t - lastFrame : step; lastFrame = t;
        draw(t);
        if (t - t0 > 2500) { /* Einflug und Shader-Aufbau nicht mitzaehlen */
          frames++; if (gap > step * 1.8) slow++;
          if (frames >= 90) { if (slow > 30) degrade(); frames = 0; slow = 0; }
        }
      }
      if (!frozen) raf = requestAnimationFrame(loop);
    };
    const kick = () => { if (!still && !frozen && !raf && visible && !document.hidden) raf = requestAnimationFrame(loop); };

    size();
    /* Shader vorab im Hintergrund uebersetzen (parallel, falls vom Treiber unterstuetzt): kein Haenger beim ersten Bild/Mauskontakt */
    try { await renderer.compileAsync(scene, camera); } catch (e) { /* aelterer Treiber: Uebersetzung beim ersten Bild */ }
    if (!canvas.isConnected) return true;
    if (gaveUp) { canvas.remove(); renderer.dispose(); return true; } /* zu spaet: Ersatz-Kachel bleibt, kein Wechsel mehr */
    clearTimeout(failTimer);
    t0 = performance.now();
    draw(still ? 9000 : t0, still);
    canvas.classList.add('on');
    /* CSS-Kachel erst nach dem ersten gerenderten Bild ausblenden (Ueberblendung per CSS, kein Springen) */
    requestAnimationFrame(() => art.classList.add('h3d-on'));
    /* nach der Ueberblendung die CSS-Animationen der verdeckten Kachel ganz anhalten (spart Leistung) */
    setTimeout(() => { if (canvas.isConnected) art.classList.add('h3d-idle'); }, 900);

    const ro = new ResizeObserver(() => { size(); if (still || frozen) draw(still ? 9000 : performance.now(), still); });
    ro.observe(art);
    const vis = new IntersectionObserver((es) => { visible = es[es.length - 1].isIntersecting; kick(); });
    vis.observe(art);
    const onVis = () => kick();
    /* Wie fx.js: Blickrichtung vom Kachelmittelpunkt zum Zeiger, virtuelle Tiefe 460 px, max. 34 Grad seitlich / 26 Grad hoch */
    const DEPTH = 460, MAXY = 34 * Math.PI / 180, MAXX = 26 * Math.PI / 180;
    /* Kachelposition nur nach Scrollen/Groessenaenderung neu messen, nicht in jedem Bild (kein erzwungenes Layout) */
    const onScroll = () => { rect = null; };
    addEventListener('scroll', onScroll, { passive: true });
    const aim = () => {
      const r = rect || (rect = art.getBoundingClientRect());
      if (!r.width) return;
      const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2);
      tx = Math.max(-MAXY, Math.min(MAXY, Math.atan2(dx, DEPTH)));
      ty = Math.max(-MAXX, Math.min(MAXX, Math.atan2(dy, DEPTH)));
    };
    const onMove = (e) => {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      px = e.clientX; py = e.clientY; hasP = true; lastMove = performance.now();
      kick();
    };
    const onLeave = () => { hasP = false; }; /* Rueckkehr zum Pendeln uebernimmt die Ueberblendung, kein Zielsprung */
    document.addEventListener('visibilitychange', onVis);
    if (fine && !still) {
      addEventListener('pointermove', onMove, { passive: true });
      document.documentElement.addEventListener('mouseleave', onLeave);
    }
    kick();

    /* Aufraeumen: Kontextverlust (Canvas weg, CSS-Grafik wieder sichtbar) und Seite verlassen */
    const dispose = () => {
      cancelAnimationFrame(raf); raf = 0; visible = false;
      ro.disconnect(); vis.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      removeEventListener('pointermove', onMove);
      removeEventListener('scroll', onScroll);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { o.material.map && o.material.map.dispose(); o.material.dispose(); } });
      glowTex.dispose(); dotTex.dispose(); envRT.dispose(); pmrem.dispose(); renderer.dispose();
    };
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dispose(); canvas.remove(); art.classList.remove('h3d-on', 'h3d-idle'); art.classList.add('h3d-fail'); });
    addEventListener('pagehide', dispose, { once: true });
    return true;
  }
}
