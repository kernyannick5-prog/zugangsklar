/* IRONHAUS Premium: Langhantel in Echtzeit-3D (Canvas 2D, ohne Bibliothek).
   Modell in Millimetern (Olympia-Hantel 2.200 mm, Bumper 450 mm), echte Perspektiv-Projektion mit Gier-/Nickwinkel.
   Mantelflaechen = beleuchtete Vierecke (Licht fest im Kamerraum, oben links), Scheibenvorderseiten = einmal
   vorgerenderte Bilder, pro Frame nur affin gesetzt. Zeichenreihenfolge entlang der Stangenachse (Maler-Verfahren).
   Ablauf: beim Erscheinen "Stange laden" (Scheiben gleiten auf, Zaehler zaehlt hoch, Klemmen schliessen),
   danach Ziehen = Drehen (360 Grad, mit Schwung), Tippen = Anheben, Scroll = leichte Drehung.
   Alte Geraete: rAF nur waehrend Bewegung, Qualitaet passt sich der gemessenen Zeichenzeit an (Aufloesung, Segmente),
   Lite/reduzierte Bewegung = ruhende Endpose ohne Intro. Ohne JS bleibt die SVG-Hantel (Fallback). */
(function () {
  "use strict";
  var d = document, w = window, n = navigator;
  var host = d.querySelector(".fx-hero3d.is-pro"), svgBb = host && host.querySelector(".fx-bb");
  if (!host || !svgBb) return;
  var cv = d.createElement("canvas");
  var ctx = cv.getContext && cv.getContext("2d");
  if (!ctx) return;
  var mq = w.matchMedia;
  var reduce = !!(mq && mq("(prefers-reduced-motion: reduce)").matches);
  var lite = reduce || (n.hardwareConcurrency && n.hardwareConcurrency < 4) || (n.deviceMemory && n.deviceMemory < 4) || (n.connection && n.connection.saveData) || false;

  /* SVG-Hantel abschalten (fx3d.js ueberspringt sie dann), Canvas + Gewichtsanzeige einsetzen */
  svgBb.setAttribute("data-bb-cv", "");
  host.classList.add("bb-cv-on");
  cv.className = "bb-cv";
  cv.setAttribute("aria-hidden", "true");
  host.appendChild(cv);
  var hud = d.createElement("div");
  hud.className = "bb-hud";
  hud.setAttribute("aria-hidden", "true");
  hud.innerHTML = '<span class="bb-hud__l">Auf der Stange</span><span class="bb-hud__v"><b>20</b> kg</span>';
  host.appendChild(hud);
  var hudN = hud.querySelector("b");

  var RAD = Math.PI / 180, PI2 = Math.PI * 2;
  /* ---------- Modell (mm), Stange entlang x, Mitte 0 ---------- */
  var SLEEVE0 = 685, SLEEVE1 = 1100;
  var PLATES = [ // je Seite, von innen nach aussen
    { kind: "y20", r: 225, w: 54, kg: 20 },
    { kind: "y20", r: 225, w: 54, kg: 20 },
    { kind: "g10", r: 225, w: 32, kg: 10 },
    { kind: "s5", r: 114, w: 24, kg: 5 },
    { kind: "clamp", r: 40, w: 42, kg: 2.5 }
  ];
  var x = 690;
  PLATES.forEach(function (p) { p.x0 = x; x += p.w; });
  var MAT = {
    rubber: { c: [30, 31, 35], sp: 0.22, ex: 18 },
    rubberY: { c: [36, 36, 38], sp: 0.22, ex: 18 },
    steel: { c: [150, 154, 162], sp: 0.95, ex: 34 },
    chrome: { c: [176, 180, 188], sp: 1.1, ex: 44 },
    shaft: { c: [112, 116, 124], sp: 0.8, ex: 28 },
    clamp: { c: [26, 26, 28], sp: 0.55, ex: 30 }
  };
  var PMAT = { y20: MAT.rubberY, g10: MAT.rubber, s5: MAT.steel, clamp: MAT.clamp };

  /* ---------- Zustand ---------- */
  var REST_PITCH = 13, INTRO_YAW = 64, INTRO_PITCH = 21;
  var yaw = INTRO_YAW, yawV = 0, pitch = INTRO_PITCH, lift = 0, liftV = 0, shake = 0, shakeV = 0, roll = 0, rollV = 0;
  var slide = [1, 1, 1, 1, 1]; // 1 = noch ausserhalb, 0 = sitzt
  var appear = 0, kg = 20, introT = -1, introDone = false, scrollP = 0.5;
  var down = false, moved = false, lx = 0, sx0 = 0, lastMoveT = 0, dragV = 0, idleT = 0;
  var W = 0, H = 0, DPR = 1, K = 1, CX = 0, CY = 0, DIST = 3300;
  var q = 2, segP = 40, segB = 18, drawEma = 0, sprites = {}, spritePx = 0;

  /* ---------- Projektion ---------- */
  var cy_ = 1, sy_ = 0, cp_ = 1, sp_ = 0;
  function pose() { cy_ = Math.cos(yaw * RAD); sy_ = Math.sin(yaw * RAD); cp_ = Math.cos(pitch * RAD); sp_ = Math.sin(pitch * RAD); }
  var P = { x: 0, y: 0, z: 0, s: 1 };
  function cam(x, y, z, o) { // Welt -> Kamera (ohne Perspektive); o erhaelt x,y,z
    var x1 = x * cy_ + z * sy_, z1 = -x * sy_ + z * cy_;
    o.x = x1; o.y = y * cp_ - z1 * sp_; o.z = y * sp_ + z1 * cp_; return o;
  }
  function proj(x, y, z, o) {
    cam(x, y, z, o);
    var s = DIST / (DIST + o.z);
    o.s = s; o.x = CX + o.x * s * K; o.y = CY + o.y * s * K; return o;
  }
  var L = norm([-0.38, -0.78, -0.5]), HV = norm([L[0], L[1], L[2] - 1]);
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
  function shade(m, nx, ny, nz, dim) {
    var di = nx * L[0] + ny * L[1] + nz * L[2]; if (di < 0) di = 0;
    var h = nx * HV[0] + ny * HV[1] + nz * HV[2]; h = h > 0 ? Math.pow(h, m.ex) * m.sp : 0;
    var k = (0.3 + 0.82 * di) * (dim || 1), sp = h * 255;
    return "rgb(" + Math.min(255, m.c[0] * k + sp | 0) + "," + Math.min(255, m.c[1] * k + sp | 0) + "," + Math.min(255, m.c[2] * k + sp | 0) + ")";
  }

  /* ---------- Zylinder (Mantel + sichtbarer Deckel) ---------- */
  var A = { x: 0, y: 0, z: 0, s: 1 }, B = { x: 0, y: 0, z: 0, s: 1 }, Cc = { x: 0, y: 0, z: 0, s: 1 }, Dd = { x: 0, y: 0, z: 0, s: 1 }, N = { x: 0, y: 0, z: 0 }, Q = { x: 0, y: 0, z: 0 };
  var VIS = [], RA = [], RB = [];
  function cylinder(x0, x1, r, m, segs, yo, cap, rot, alpha) {
    var dt = PI2 / segs, i, t, j, nv = 0;
    ctx.globalAlpha = alpha;
    /* Mantel: sichtbare Segmente bestimmen, Umriss als EIN Pfad, glatte Schattierung per Verlauf quer zur Achse */
    for (i = 0; i < segs; i++) {
      t = i * dt + dt / 2;
      cam(0, Math.cos(t), Math.sin(t), N);
      cam((x0 + x1) / 2, yo + Math.cos(t) * r, Math.sin(t) * r, Q);
      VIS[i] = N.x * Q.x + N.y * Q.y + N.z * (Q.z + DIST) < 0;
      if (VIS[i]) nv++;
    }
    if (nv) {
      var st0 = 0;
      for (i = 0; i < segs; i++) if (VIS[i] && !VIS[(i + segs - 1) % segs]) { st0 = i; break; }
      ctx.beginPath();
      for (j = 0; j <= nv; j++) { t = (st0 + j) * dt; proj(x0, yo + Math.cos(t) * r, Math.sin(t) * r, A); if (j) ctx.lineTo(A.x, A.y); else ctx.moveTo(A.x, A.y); }
      for (j = nv; j >= 0; j--) { t = (st0 + j) * dt; proj(x1, yo + Math.cos(t) * r, Math.sin(t) * r, A); ctx.lineTo(A.x, A.y); }
      ctx.closePath();
      cam(1, 0, 0, N); var al = Math.hypot(N.x, N.y) || 1, px = -N.y / al, py = N.x / al;
      proj((x0 + x1) / 2, yo, 0, B); var hw = r * B.s * K * 1.04;
      var g = ctx.createLinearGradient(B.x - px * hw, B.y - py * hw, B.x + px * hw, B.y + py * hw);
      for (j = 0; j <= 8; j++) { var u = j / 4 - 1, wv = Math.sqrt(Math.max(0, 1 - u * u)); g.addColorStop(j / 8, shade(m, px * u, py * u, -wv)); }
      ctx.fillStyle = g; ctx.fill();
    }
    if (!cap) { ctx.globalAlpha = 1; return; }
    /* sichtbarer Deckel: Normale +x oder -x */
    cam(1, 0, 0, N);
    cam(x1, yo, 0, Q);
    var plus = N.x * Q.x + N.y * Q.y + N.z * (Q.z + DIST) < 0, xf = plus ? x1 : x0, sg = plus ? 1 : -1;
    var nx = N.x * sg, ny = N.y * sg, nz = N.z * sg;
    if (cap === true) {
      ctx.fillStyle = shade(m, nx, ny, nz, 0.92);
      ctx.beginPath();
      for (i = 0; i < segs; i++) { t = i * dt; proj(xf, yo + Math.cos(t) * r, Math.sin(t) * r, A); if (i) ctx.lineTo(A.x, A.y); else ctx.moveTo(A.x, A.y); }
      ctx.fill();
    } else {
      /* Scheibenbild affin aufsetzen: Ellipse durch die vier projizierten Randpunkte; Drehung um die Achse = rot */
      var cr = Math.cos(rot), sr = Math.sin(rot), eu = sg; // +x-Seite: Welt +z = Bild rechts
      proj(xf, yo - sr * r * eu, cr * r * eu, A);
      proj(xf, yo + sr * r * eu, -cr * r * eu, B);
      proj(xf, yo + cr * r, sr * r, Cc);
      proj(xf, yo - cr * r, -sr * r, Dd);
      var ux = (A.x - B.x) / 2, uy = (A.y - B.y) / 2, vx = (Cc.x - Dd.x) / 2, vy = (Cc.y - Dd.y) / 2;
      var ox = (A.x + B.x + Cc.x + Dd.x) / 4, oy = (A.y + B.y + Cc.y + Dd.y) / 4;
      ctx.setTransform(ux * DPR, uy * DPR, vx * DPR, vy * DPR, ox * DPR, oy * DPR);
      ctx.drawImage(cap, -1.01, -1.01, 2.02, 2.02);
      /* Licht auf der Flaeche: Abdunkeln bei abgewandter Flaeche, Glanz bei Spiegelwinkel */
      var di = nx * L[0] + ny * L[1] + nz * L[2], h = nx * HV[0] + ny * HV[1] + nz * HV[2];
      var dark = Math.max(0, 0.55 - 0.75 * Math.max(0, di)), gl = h > 0 ? Math.pow(h, m === MAT.steel ? 20 : 8) * (m === MAT.steel ? 0.5 : 0.14) : 0;
      ctx.beginPath(); ctx.arc(0, 0, 1.01, 0, PI2);
      if (dark > 0.01) { ctx.fillStyle = "rgba(0,0,0," + dark.toFixed(3) + ")"; ctx.fill(); }
      if (gl > 0.01) { ctx.fillStyle = "rgba(255,255,255," + gl.toFixed(3) + ")"; ctx.fill(); }
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    ctx.globalAlpha = 1;
  }

  /* ---------- Scheibenbilder (einmal je Groesse) ---------- */
  var DISP = '"Barlow Condensed", "Arial Narrow", sans-serif';
  function sprite(kind, px) {
    var c = d.createElement("canvas"); c.width = c.height = px;
    var g = c.getContext("2d"), R = px / 2, gr, i;
    g.translate(R, R); g.scale(R, R);
    function ring(r0, r1, col) { g.beginPath(); g.arc(0, 0, r1, 0, PI2); g.arc(0, 0, r0, 0, PI2, true); g.fillStyle = col; g.fill(); }
    function hub(rh, holeR) {
      gr = g.createLinearGradient(-rh, -rh, rh, rh);
      gr.addColorStop(0, "#f3f4f6"); gr.addColorStop(0.45, "#9ba0a8"); gr.addColorStop(0.55, "#c9ccd2"); gr.addColorStop(1, "#5d616a");
      g.beginPath(); g.arc(0, 0, rh, 0, PI2); g.fillStyle = gr; g.fill();
      ring(rh - 0.02, rh, "rgba(0,0,0,.45)");
      g.beginPath(); g.arc(0, 0, holeR, 0, PI2); g.fillStyle = "#0a0a0b"; g.fill();
    }
    function text(s, y, size, col, ls) {
      g.save(); g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "middle";
      g.font = "italic 800 " + size + "px " + DISP;
      if (ls && "letterSpacing" in g) g.letterSpacing = ls + "px";
      g.fillText(s, 0, y); g.restore();
    }
    if (kind === "y20" || kind === "g10") {
      gr = g.createRadialGradient(-0.25, -0.3, 0.05, 0, 0, 1);
      gr.addColorStop(0, "#2c2d31"); gr.addColorStop(1, "#151619");
      g.beginPath(); g.arc(0, 0, 1, 0, PI2); g.fillStyle = gr; g.fill();
      for (i = 0; i < 9; i++) ring(0.3 + i * 0.065, 0.3 + i * 0.065 + 0.006, "rgba(255,255,255,.035)");
      var col = kind === "y20" ? "#ffd400" : "#9ea2a9";
      ring(0.84, 0.885, col);
      ring(0.955, 1, "#0f1012");
      text("IRONHAUS", -0.56, 0.17, col, 0.02);
      text(kind === "y20" ? "20 KG" : "10 KG", 0.56, 0.2, kind === "y20" ? "#ffd400" : "#e9eaec");
      g.save(); g.globalAlpha = 0.5; text("OLYMPIC · 450 MM", 0.74, 0.07, "#c9ccd2"); g.restore();
      hub(0.2, 0.12);
    } else if (kind === "s5") {
      gr = g.createLinearGradient(-1, -1, 1, 1);
      gr.addColorStop(0, "#e2e4e8"); gr.addColorStop(0.5, "#8d929b"); gr.addColorStop(1, "#4f535b");
      g.beginPath(); g.arc(0, 0, 1, 0, PI2); g.fillStyle = gr; g.fill();
      ring(0.72, 0.78, "rgba(0,0,0,.28)"); ring(0.78, 0.8, "rgba(255,255,255,.35)");
      text("5 KG", 0.5, 0.26, "rgba(20,21,24,.78)");
      hub(0.36, 0.24);
    } else { // Klemme: schwarz eloxiert, gelber Hebelring
      g.beginPath(); g.arc(0, 0, 1, 0, PI2); g.fillStyle = "#1b1b1e"; g.fill();
      ring(0.8, 0.92, "#ffd400");
      g.beginPath(); g.arc(0, 0, 0.66, 0, PI2); g.fillStyle = "#0b0b0c"; g.fill();
    }
    return c;
  }
  function buildSprites() {
    var px = Math.min(512, Math.max(96, Math.ceil(225 * K * 1.45 * 2 * DPR / 32) * 32));
    if (px === spritePx) return;
    spritePx = px;
    sprites = { y20: sprite("y20", px), g10: sprite("g10", px), s5: sprite("s5", Math.ceil(px * 0.55)), clamp: sprite("clamp", Math.ceil(px * 0.25)) };
  }

  /* ---------- Szene zeichnen ---------- */
  var items = [];
  function draw() {
    var t0 = performance.now();
    pose();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var yo = -lift + shake, i, s, p;
    /* Bodenschatten (Boden bei y = 225) */
    var fy = 225, sa = Math.max(0.25, 1 - lift / 260) * appear;
    for (s = -1; s <= 1; s += 2) {
      proj(s * 790, fy, 0, A);
      var rx = 300 * A.s * K * (0.5 + 0.5 * Math.abs(cy_)) + 120 * A.s * K * Math.abs(sy_), ry = 30 * A.s * K * (1 + lift / 300);
      p = ctx.createRadialGradient(A.x, A.y, 0, A.x, A.y, rx);
      p.addColorStop(0, "rgba(0,0,0," + (0.62 * sa).toFixed(3) + ")"); p.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save(); ctx.translate(A.x, A.y); ctx.scale(1, ry / rx); ctx.translate(-A.x, -A.y);
      ctx.fillStyle = p; ctx.beginPath(); ctx.arc(A.x, A.y, rx, 0, PI2); ctx.fill(); ctx.restore();
    }
    /* Elemente sammeln: Scheiben (mit Gleitversatz), Stangenstuecke dazwischen */
    items.length = 0;
    for (s = -1; s <= 1; s += 2) {
      var occ = [];
      for (i = 0; i < PLATES.length; i++) {
        var pl = PLATES[i], off = slide[i];
        if (off >= 1) continue;
        var ease = off * off; // beschleunigt aufs Ende zu
        var a0 = pl.x0 + ease * 560, a1 = a0 + pl.w;
        occ.push([a0, a1]);
        items.push({ x0: s > 0 ? a0 : -a1, x1: s > 0 ? a1 : -a0, r: pl.r, m: PMAT[pl.kind], cap: sprites[pl.kind], segs: pl.r > 100 ? segP : segB, a: Math.min(1, (1 - off) * 2.2), rot: roll + (i === 1 ? 0.35 : 0) });
      }
      /* Huelse in die freien Abschnitte zerlegen */
      occ.sort(function (a, b) { return a[0] - b[0]; });
      var cur = SLEEVE0;
      for (i = 0; i <= occ.length; i++) {
        var nx0 = i < occ.length ? Math.min(SLEEVE1, occ[i][0]) : SLEEVE1;
        if (nx0 > cur + 0.5) items.push({ x0: s > 0 ? cur : -nx0, x1: s > 0 ? nx0 : -cur, r: 25, m: MAT.chrome, cap: (i === occ.length) || null, segs: segB, a: 1, rot: 0 });
        if (i < occ.length) cur = Math.max(cur, occ[i][1]);
      }
      items.push({ x0: s > 0 ? 655 : -685, x1: s > 0 ? 685 : -655, r: 33, m: MAT.chrome, cap: true, segs: segB + 4, a: 1, rot: 0 });
    }
    items.push({ x0: -655, x1: 655, r: 14, m: MAT.shaft, cap: null, segs: segB, a: 1, rot: 0, shaft: true });
    /* Reihenfolge: koaxiale Koerper werden nach Abstand vom Fusspunkt der Kamera auf der Achse gezeichnet (fern zuerst).
       Exakt fuer Scheiben auf einer Achse, auch bei Blick schraeg von innen (reine Tiefensortierung versagt dort). */
    var xc = DIST * cp_ * sy_;
    for (i = 0; i < items.length; i++) items[i].z = Math.abs((items[i].x0 + items[i].x1) / 2 - xc);
    items.sort(function (a, b) { return b.z - a.z; });
    for (i = 0; i < items.length; i++) {
      var it = items[i], al = it.a * appear;
      if (al <= 0.01) continue;
      if (it.shaft) { shaft(yo, al); continue; }
      cylinder(it.x0, it.x1, it.r, it.m, it.segs, yo, it.cap, it.rot, al);
    }
    var dtw = performance.now() - t0;
    drawEma = drawEma ? drawEma * 0.85 + dtw * 0.15 : dtw;
  }
  /* Stange mit Raendelung: Zylinder + feine Querschraffur in den Griffzonen */
  function shaft(yo, al) {
    cylinder(-655, 655, 14, MAT.shaft, segB, yo, null, 0, al);
    if (q < 1) return;
    ctx.globalAlpha = 0.22 * al; ctx.strokeStyle = "#0c0c0e"; ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (var z = -1; z <= 1; z += 2) for (var xk = 90; xk < 600; xk += 9) {
      if (xk > 420 && xk < 460) continue; // Markierungsring
      proj(z * xk, yo - 12, -4, A); proj(z * xk + 4, yo + 12, -4, B); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  /* ---------- Groesse / Qualitaet ---------- */
  function size() {
    var r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    DPR = q >= 2 ? Math.min(2, w.devicePixelRatio || 1) : 1;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    var narrow = W < 520; // Smartphone: Hantel fuellt die Breite, Anzeige liegt darueber
    K = Math.min(W / (narrow ? 2150 : 2700), H / 1050); CX = W * 0.5; CY = H * (narrow ? 0.6 : 0.48);
    segP = q >= 2 ? 40 : q === 1 ? 30 : 22; segB = q >= 2 ? 18 : 14;
    buildSprites();
  }
  function degrade() {
    if (q === 0) return;
    q--; drawEma = 0; size();
    if (q === 0) finishIntro(); // sehr langsam: Intro ueberspringen
  }

  /* ---------- Intro "Stange laden" ---------- */
  var ORDER = [0, 1, 2, 3, 4], T_START = 380, T_STEP = 300, T_SLIDE = 380;
  function kgAt(nLoaded) { var k = 20; for (var i = 0; i < nLoaded; i++) k += PLATES[i].kg * 2; return k; }
  function finishIntro() {
    introDone = true; appear = 1;
    for (var i = 0; i < slide.length; i++) slide[i] = 0;
    kg = kgAt(PLATES.length); hudN.textContent = fmt(kg); hud.classList.add("is-done");
  }
  function fmt(v) { return String(v).replace(".", ","); }
  function stepIntro(ms) {
    appear = Math.min(1, ms / 450);
    var loaded = 0;
    for (var i = 0; i < ORDER.length; i++) {
      var st = T_START + i * T_STEP, u = (ms - st) / T_SLIDE;
      var was = slide[i];
      slide[i] = u <= 0 ? 1 : u >= 1 ? 0 : 1 - u;
      if (was > 0 && slide[i] === 0) { shakeV += i < 3 ? 420 : 200; rollV += i % 2 ? -1.1 : 1.1; } // Aufschlag
      if (slide[i] === 0) loaded++;
    }
    var nk = kgAt(loaded);
    if (nk !== kg) { kg = nk; hudN.textContent = fmt(kg); hud.classList.remove("is-tick"); void hud.offsetWidth; hud.classList.add("is-tick"); }
    var cam_ = Math.min(1, ms / (T_START + ORDER.length * T_STEP + 300)), e = 1 - Math.pow(1 - cam_, 3);
    yaw = INTRO_YAW + (restYaw() - INTRO_YAW) * e; pitch = INTRO_PITCH + (REST_PITCH - INTRO_PITCH) * e;
    if (cam_ >= 1 && loaded === ORDER.length) { finishIntro(); hud.classList.add("is-done"); }
  }
  function restYaw() { return 14 + 22 * scrollP; }

  /* ---------- Schleife (nur waehrend Bewegung) ---------- */
  var raf = 0, last = 0, vis = false;
  function kick() { if (!raf && vis && !d.hidden) { last = 0; raf = requestAnimationFrame(tick); } }
  function tick(now) {
    raf = 0;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60; last = now;
    var r = host.getBoundingClientRect(), vh = w.innerHeight || 1;
    scrollP = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
    var busy = false;
    if (!introDone) {
      introT = introT < 0 ? 0 : introT + dt * 1000; // Intro-Zeit laeuft nur waehrend sichtbarer Frames (pausierbar)
      stepIntro(introT); busy = true;
    } else {
      var tgt = restYaw();
      if (down) { idleT = 0; busy = true; }
      else {
        idleT += dt;
        if (Math.abs(yawV) > 30) { yaw += yawV * dt; yawV *= Math.exp(-dt * 2.4); }
        else {
          var tg = tgt + 360 * Math.round((yaw - tgt) / 360);
          yawV += (16 * (tg - yaw) - 7.5 * yawV) * dt; yaw += yawV * dt;
          if (Math.abs(tg - yaw) < 0.01 && Math.abs(yawV) < 0.02) { yaw = tg; yawV = 0; }
        }
        busy = Math.abs(yawV) > 0 || Math.abs(tgt + 360 * Math.round((yaw - tgt) / 360) - yaw) > 0.01;
      }
      pitch += (REST_PITCH - lift / 40 - pitch) * Math.min(1, dt * 6);
    }
    /* Federn: Anheben, Aufschlag-Zittern, Rollen der Scheiben */
    liftV += (-60 * lift - 8.5 * liftV) * dt; lift += liftV * dt;
    shakeV += (-900 * shake - 26 * shakeV) * dt; shake += shakeV * dt;
    rollV += (-34 * roll - 3.2 * rollV) * dt; roll += rollV * dt; // Scheiben pendeln nach dem Aufschlag zurueck (Schrift bleibt lesbar)
    if (Math.abs(lift) + Math.abs(liftV) > 0.05 || Math.abs(shake) + Math.abs(shakeV) > 0.02 || Math.abs(rollV) + Math.abs(roll) > 0.003) busy = true;
    else { lift = 0; liftV = 0; shake = 0; shakeV = 0; rollV = 0; roll = 0; }
    draw();
    if (q > 0 && drawEma > (q === 2 ? 9 : 13)) degrade();
    if (busy || down) kick();
  }

  /* ---------- Sichtbarkeit / Ereignisse ---------- */
  var io = null;
  function onVis() { if (!d.hidden) kick(); else if (raf) { cancelAnimationFrame(raf); raf = 0; } }
  function onScroll() { if (introDone) kick(); }
  function onSize() { size(); draw(); }
  function start() {
    size();
    if (lite) { finishIntro(); yaw = restYaw(); pitch = REST_PITCH; } else { appear = 0; }
    pose(); draw();
    if ("IntersectionObserver" in w) {
      io = new IntersectionObserver(function (es) {
        var e = es[es.length - 1];
        vis = e.isIntersecting;
        if (vis && (introT >= 0 || introDone || e.intersectionRatio >= 0.35)) kick();
        if (!vis && raf) { cancelAnimationFrame(raf); raf = 0; }
      }, { threshold: [0, 0.35, 0.6] });
      io.observe(host);
    } else { vis = true; finishIntro(); kick(); }
    if ("ResizeObserver" in w) new ResizeObserver(onSize).observe(host); else w.addEventListener("resize", onSize);
    d.addEventListener("visibilitychange", onVis);
    w.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Interaktion: Ziehen = drehen (frei, mit Schwung), Tippen = Anheben */
  function pd(e) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!introDone) finishIntro();
    down = true; moved = false; lx = sx0 = e.clientX; dragV = 0; lastMoveT = performance.now(); yawV = 0;
    try { cv.setPointerCapture(e.pointerId); } catch (x) { /* ok */ }
    kick();
  }
  function pm(e) {
    if (!down) return;
    if (!moved && Math.abs(e.clientX - sx0) > 6) moved = true;
    if (moved) {
      var dx = e.clientX - lx, now = performance.now(), dtm = Math.max(8, now - lastMoveT);
      var dy = dx * 360 / Math.max(320, W * 1.1);
      yaw -= dy; dragV = -dy / (dtm / 1000); lastMoveT = now;
      kick();
    }
    lx = e.clientX;
  }
  function pu() {
    if (!down) return; down = false;
    if (moved) yawV = reduce ? 0 : Math.max(-900, Math.min(900, dragV));
    else if (!reduce) { liftV = 520; rollV += 1.6; }
    kick();
  }
  function pc() { down = false; kick(); }
  cv.addEventListener("pointerdown", pd); cv.addEventListener("pointermove", pm);
  cv.addEventListener("pointerup", pu); cv.addEventListener("pointercancel", pc);
  w.addEventListener("pagehide", function () {
    if (raf) cancelAnimationFrame(raf); raf = 0; if (io) io.disconnect();
    d.removeEventListener("visibilitychange", onVis); w.removeEventListener("scroll", onScroll);
  });

  /* Schrift fuer die Scheibenbeschriftung abwarten (max. 1,2 s), dann starten */
  var go = false;
  function begin() { if (go) return; go = true; start(); }
  if (d.fonts && d.fonts.load) {
    Promise.race([d.fonts.load('italic 800 40px "Barlow Condensed"'), new Promise(function (r) { setTimeout(r, 1200); })]).then(begin, begin);
  } else begin();
})();
