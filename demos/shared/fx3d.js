/* Yanqiva Demo-Websites: 3D-Effekt-Engine (Business + Premium, NICHT Basic).
   Reines CSS-3D; dieses Skript steuert nur: fx-lite-Erkennung, Pause ausserhalb des Viewports /
   bei versteckter Seite, Zeiger-Parallaxe, Karten-Tilt, Flip-Karten, Scroll-Parallaxe.
   Ohne JS bleibt alles statisch und lesbar. Nur transform/opacity (ueber CSS-Variablen). */
(function () {
  "use strict";
  var d = document, root = d.documentElement, n = navigator;
  var badge = d.querySelector(".paket-badge");
  var pro = !!badge && badge.getAttribute("data-tier") === "premium";
  var mq = window.matchMedia;
  var lite = (mq && mq("(prefers-reduced-motion: reduce)").matches) ||
    (n.hardwareConcurrency && n.hardwareConcurrency < 4) ||
    (n.deviceMemory && n.deviceMemory < 4) ||
    (n.connection && n.connection.saveData) || false;
  var fine = !!mq && mq("(hover: hover) and (pointer: fine)").matches;
  root.classList.add("fx-ready", lite ? "fx-lite" : "fx3d");
  if (pro) root.classList.add("fx-pro");

  /* ---- Flip-Karten (auch im Lite-Modus: Nutzeraktion, kein Dauer-Effekt) ---- */
  function setFlip(card, on) {
    card.classList.toggle("is-flipped", on);
    var b = card.querySelector(".fx-flip__btn");
    if (b) b.setAttribute("aria-pressed", on ? "true" : "false");
    var f = card.querySelector(".fx-flip__front"), k = card.querySelector(".fx-flip__back");
    if (f) f.inert = on;
    if (k) k.inert = !on;
  }
  var flips = d.querySelectorAll(".fx-flip");
  Array.prototype.forEach.call(flips, function (c) { setFlip(c, false); });
  d.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest(".fx-flip");
    if (c) setFlip(c, !c.classList.contains("is-flipped"));
  });

  /* ---- Live-Auslastung im 3D-Band spiegeln (Premium IRONHAUS) ---- */
  var occ = d.querySelector(".occupancy-value"), outs = d.querySelectorAll("[data-fx-occ]");
  if (occ && outs.length && "MutationObserver" in window) {
    var sync = function () { Array.prototype.forEach.call(outs, function (o) { o.textContent = occ.textContent; }); };
    new MutationObserver(sync).observe(occ, { childList: true, characterData: true, subtree: true });
    sync();
  }

  if (lite) return;

  /* ---- Sichtbarkeit: Szenen laufen nur im Viewport und bei sichtbarer Seite ---- */
  var scenes = d.querySelectorAll("[data-fx-scene]"), live = [];
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        var el = en.target, i = live.indexOf(el);
        el.classList.toggle("fx-run", en.isIntersecting);
        if (en.isIntersecting && i < 0) live.push(el);
        if (!en.isIntersecting && i > -1) live.splice(i, 1);
      });
    }, { rootMargin: "80px" });
    Array.prototype.forEach.call(scenes, function (s) { io.observe(s); });
  }
  d.addEventListener("visibilitychange", function () { root.classList.toggle("fx-hidden", d.hidden); });

  /* ---- Zeiger-Parallaxe + Tilt (nur feiner Zeiger) ---- */
  var TILT = ".feature-card,.price-card,.coach-teaser,.iw-card,.blog-card,.product-card,.origin-card,.shop-card,.vitrine-card,.fx-tilt";
  var max = pro ? 9 : 5, raf = 0, px = 0, py = 0, mx = 0, my = 0, hot = null;
  function frame() {
    raf = 0;
    live.forEach(function (s) {
      if (s.getAttribute("data-fx-ptr") === null) return;
      var r = s.getBoundingClientRect();
      var x = ((mx - r.left) / r.width) * 2 - 1, y = ((my - r.top) / r.height) * 2 - 1;
      s.style.setProperty("--px", Math.max(-1, Math.min(1, x)).toFixed(3));
      s.style.setProperty("--py", Math.max(-1, Math.min(1, y)).toFixed(3));
    });
    if (hot) {
      var b = hot.getBoundingClientRect();
      var u = (mx - b.left) / b.width - 0.5, v = (my - b.top) / b.height - 0.5;
      hot.style.setProperty("--rx", (-v * max * 2).toFixed(2) + "deg");
      hot.style.setProperty("--ry", (u * max * 2).toFixed(2) + "deg");
    }
  }
  /* ---- Feder-Neigung der Langhantel (IRONHAUS Premium): Zielwinkel folgt dem Zeiger, Bewegung per gedaempfter Feder ---- */
  var bbs = Array.prototype.map.call(d.querySelectorAll(".fx-bb"), function (el) {
    var cs = getComputedStyle(el);
    return { el: el, tilt: el.querySelector(".bb-tilt"), scene: el.closest("[data-fx-scene]"),
      bx: parseFloat(cs.getPropertyValue("--bb-rx")) || 0, by: parseFloat(cs.getPropertyValue("--bb-ry")) || 0,
      x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };
  });
  var sp = 0, spLast = 0, idleT = 0;
  function springStep(t) {
    sp = 0;
    var dt = Math.min(0.05, spLast ? (t - spLast) / 1000 : 0.016); spLast = t;
    var busy = false;
    bbs.forEach(function (b) {
      /* Feder: a = k * (Ziel - Lage) - c * v   (leicht unterkritisch gedaempft, ~0.75) */
      var k = 34, c = 8.8;
      b.vx += (k * (b.tx - b.x) - c * b.vx) * dt; b.x += b.vx * dt;
      b.vy += (k * (b.ty - b.y) - c * b.vy) * dt; b.y += b.vy * dt;
      b.tilt.style.transform = "rotateX(" + (b.bx + b.x).toFixed(3) + "deg) rotateY(" + (b.by + b.y).toFixed(3) + "deg)";
      if (Math.abs(b.vx) + Math.abs(b.vy) > 0.02 || Math.abs(b.tx - b.x) + Math.abs(b.ty - b.y) > 0.02) busy = true;
      else { b.x = b.tx; b.y = b.ty; }
    });
    if (busy && !d.hidden) sp = requestAnimationFrame(springStep); else spLast = 0;
  }
  function springKick() { if (!sp && bbs.length) sp = requestAnimationFrame(springStep); }
  function springAim(px, py) {
    var any = false;
    bbs.forEach(function (b) {
      if (!b.scene || !b.scene.classList.contains("fx-run")) { b.tx = 0; b.ty = 0; return; }
      var r = b.el.getBoundingClientRect(), W = window.innerWidth || 1, H = window.innerHeight || 1;
      var u = Math.max(-1, Math.min(1, (px - (r.left + r.width / 2)) / (W * 0.5)));
      var v = Math.max(-1, Math.min(1, (py - (r.top + r.height / 2)) / (H * 0.5)));
      b.ty = u * 6.5; b.tx = -v * 3.5; any = true;
    });
    if (any) springKick();
  }
  function springRelax() { bbs.forEach(function (b) { b.tx = 0; b.ty = 0; }); springKick(); }

  if (fine) {
    d.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX; my = e.clientY;
      if (bbs.length) { springAim(mx, my); clearTimeout(idleT); idleT = setTimeout(springRelax, 2600); }
      var t = e.target.closest ? e.target.closest(TILT) : null;
      if (t !== hot) {
        if (hot) { hot.style.setProperty("--rx", "0deg"); hot.style.setProperty("--ry", "0deg"); }
        hot = t; if (t) t.classList.add("fx-hot");
      }
      if (!raf) raf = requestAnimationFrame(frame);
    }, { passive: true });
    /* Zeiger verlaesst das Fenster: Szenen und Karte federn (per CSS-Transition) in die Ruhelage zurueck */
    root.addEventListener("pointerleave", function () {
      if (hot) { hot.style.setProperty("--rx", "0deg"); hot.style.setProperty("--ry", "0deg"); hot = null; }
      live.forEach(function (s) { s.style.setProperty("--px", "0"); s.style.setProperty("--py", "0"); });
      springRelax();
    });
  }

  /* ---- Scroll-Parallaxe (nur sichtbare Szenen mit data-fx-scroll) ---- */
  var sraf = 0;
  function sframe() {
    sraf = 0;
    var vh = window.innerHeight || 1;
    live.forEach(function (s) {
      if (s.getAttribute("data-fx-scroll") === null) return;
      var r = s.getBoundingClientRect();
      s.style.setProperty("--sy", (Math.max(-1, Math.min(1, -r.top / vh))).toFixed(3));
    });
  }
  window.addEventListener("scroll", function () { if (!sraf) sraf = requestAnimationFrame(sframe); }, { passive: true });

  /* ---- Langhantel (IRONHAUS Premium): echte Gierwinkel-Projektion ----
     Alle Teile liegen auf EINER Achse (y = 190) und werden aus demselben Gierwinkel psi berechnet:
       x-Lage / Dicke  ~ cos(psi)   (Position entlang der Stange)
       Scheibenflaeche ~ sin(psi)   (Ellipsenbreite der Scheibenvorderseite / des Lochs)
     Die Stange kann das Scheibenloch daher in keiner Phase verlassen (gleiche Achse, gleiche Basis).
     Basis-Markup = Pose bei psi0 = 30 Grad (ohne JS / Lite exakt diese Pose). Antrieb: Scroll (gedaempft), leichtes Atmen,
     Ziehen (Trägheit), Tippen = gedaempftes Anheben. Schleife laeuft nur im Viewport und bei sichtbarer Seite. */
  (function () {
    var bb = d.querySelector(".fx-bb");
    if (!bb || !bb.querySelector("[data-gl]") || bb.hasAttribute("data-bb-cv")) return; /* Canvas-3D aktiv (barbell.js) */
    var RAD = Math.PI / 180, P0 = 30, PMIN = 18, PMAX = 46, C0 = Math.cos(P0 * RAD), S0 = Math.sin(P0 * RAD);
    var scene = bb.closest("[data-fx-scene]") || bb, settle = bb.querySelector(".bb-settle");
    var gx = d.getElementById("bb-gx");
    var items = [], sh = [], faces = Array.prototype.map.call(bb.querySelectorAll(".bb-face"), function (el) { return { el: el, cx: +el.getAttribute("data-cx"), sh: el.querySelector("i") }; }), pxu = bb.offsetWidth / 900;
    Array.prototype.forEach.call(bb.querySelectorAll(".bb-layer > g *"), function (el) {
      var t = el.tagName.toLowerCase(), m;
      if (t === "rect") items.push({ el: el, t: 0, x: +el.getAttribute("x"), w: +el.getAttribute("width") });
      else if (t === "ellipse") items.push({ el: el, t: 1, x: +el.getAttribute("cx"), w: +el.getAttribute("rx") });
    });
    Array.prototype.forEach.call(bb.querySelectorAll(".bb-floor ellipse"), function (el) {
      sh.push({ el: el, x: +el.getAttribute("cx"), w: +el.getAttribute("rx") });
    });
    var psi = P0, psiV = 0, lastDraw = -99, user = 0, down = false, moved = false, lx = 0, sx0 = 0, dv = 0;
    var lift = 0, liftV = 0, liftDraw = 0, run = false, raf = 0, last = 0, t0 = 0;
    function draw() {
      var k = Math.cos(psi * RAD) / C0, s = Math.sin(psi * RAD) / S0, i, it, f = 1 - 0.012 * lift;
      for (i = 0; i < items.length; i++) {
        it = items[i];
        if (it.t === 0) { it.el.setAttribute("x", (500 + (it.x - 500) * k).toFixed(2)); it.el.setAttribute("width", (it.w * k).toFixed(2)); }
        else if (it.t === 1) { it.el.setAttribute("cx", (500 + (it.x - 500) * k).toFixed(2)); it.el.setAttribute("rx", (it.w * s).toFixed(2)); }
      }
      /* Scheibenvorderseiten: eigene Compositor-Ebenen (nur transform, kein Neu-Rastern der Beschriftung) */
      var sn = Math.sin(psi * RAD).toFixed(4), so = ((psi - P0) * 2.4).toFixed(2);
      for (i = 0; i < faces.length; i++) {
        faces[i].el.style.transform = "translate3d(" + ((faces[i].cx - 500) * (k - 1) * pxu).toFixed(2) + "px,0,0) scale(" + sn + ",1)";
        faces[i].sh.style.transform = "translate3d(" + so + "%,0,0)";
      }
      for (i = 0; i < sh.length; i++) {
        sh[i].el.setAttribute("cx", (500 + (sh[i].x - 500) * k).toFixed(2));
        sh[i].el.setAttribute("rx", (sh[i].w * k * f).toFixed(2));
        sh[i].el.setAttribute("opacity", (1 - 0.018 * lift).toFixed(3));
      }
      /* Lichtreflex wandert mit dem Drehwinkel ueber Stange und Scheiben */
      var off = (psi - P0) * 15;
      if (gx) { gx.setAttribute("x1", (500 + off - 90).toFixed(1)); gx.setAttribute("x2", (500 + off + 90).toFixed(1)); }
      lastDraw = psi;
    }
    function tick(now) {
      raf = 0;
      if (!run) return;
      var dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
      if (!t0) t0 = now;
      var r = scene.getBoundingClientRect(), vh = window.innerHeight || 1;
      var p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
      if (!down) user *= Math.exp(-dt / 2.4);
      var target = 18 + 24 * p + user;
      target = Math.max(PMIN, Math.min(PMAX, target));
      psiV += (26 * (target - psi) - 8.6 * psiV) * dt; psi += psiV * dt;
      psi = Math.max(PMIN - 2, Math.min(PMAX + 2, psi));
      if (Math.abs(psi - lastDraw) > 0.004 || lift !== liftDraw) {
        draw();
      }
      if (lift !== 0 || liftV !== 0) {
        liftV += (-70 * lift - 9 * liftV) * dt; lift += liftV * dt;
        if (Math.abs(lift) < 0.05 && Math.abs(liftV) < 0.5) { lift = 0; liftV = 0; }
        if (settle) settle.style.translate = "0 " + (-lift).toFixed(2) + "px";
        liftDraw = lift;
      }
      /* ruht die Hantel (kein Scrollen/Ziehen, Feder ausgeschwungen), endet die Schleife: kein Dauer-rAF */
      if (down || lift !== 0 || liftV !== 0 || Math.abs(psiV) > 0.02 || Math.abs(target - psi) > 0.02) raf = requestAnimationFrame(tick);
      else { psi = target; draw(); }
    }
    function kick() { if (run && !raf) { last = 0; raf = requestAnimationFrame(tick); } }
    function sync() {
      var go = vis && !d.hidden;
      if (go && !run) { run = true; last = 0; if (!raf) raf = requestAnimationFrame(tick); }
      else if (!go && run) { run = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    }
    var vis = false, io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (es) { vis = es[es.length - 1].isIntersecting; sync(); }, { rootMargin: "60px" });
      io.observe(scene);
    }
    function onVis() { sync(); }
    function onSize() { pxu = bb.offsetWidth / 900; if (run) { lastDraw = -99; kick(); } }
    window.addEventListener("resize", onSize);
    d.addEventListener("visibilitychange", onVis);
    window.addEventListener("scroll", kick, { passive: true });
    /* Interaktion: Ziehen = drehen (mit Traegheit), Tippen/Klick = kurzes, gedaempftes Anheben (reine Bewegung, keine Verformung) */
    bb.setAttribute("data-bb-live", "");
    function pd(e) { kick(); if (e.pointerType === "mouse" && e.button !== 0) return; down = true; moved = false; lx = sx0 = e.clientX; dv = 0; try { bb.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } }
    function pm(e) {
      if (!down) return;
      if (!moved && Math.abs(e.clientX - sx0) > 6) moved = true;
      kick();
      if (moved) { var dx = e.clientX - lx; user += dx * 0.16; user = Math.max(-30, Math.min(30, user)); dv = dx; }
      lx = e.clientX;
    }
    function pu() {
      if (!down) return; down = false;
      if (moved) psiV += dv * 9; else { liftV = 330; psiV += 40; }
      kick();
    }
    function pc() { down = false; }
    bb.addEventListener("pointerdown", pd); bb.addEventListener("pointermove", pm);
    bb.addEventListener("pointerup", pu); bb.addEventListener("pointercancel", pc);
    window.addEventListener("pagehide", function () {
      run = false; if (raf) cancelAnimationFrame(raf); if (io) io.disconnect();
      d.removeEventListener("visibilitychange", onVis); window.removeEventListener("scroll", kick); window.removeEventListener("resize", onSize);
      bb.removeEventListener("pointerdown", pd); bb.removeEventListener("pointermove", pm);
      bb.removeEventListener("pointerup", pu); bb.removeEventListener("pointercancel", pc);
    });
    /* fuer Tests: Winkel fest setzen (haelt die Schleife an) */
    bb.__setPsi = function (v) { run = false; if (raf) cancelAnimationFrame(raf); raf = 0; psi = v; draw(); };
  })();

})();
