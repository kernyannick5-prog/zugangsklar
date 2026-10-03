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
  if (fine) {
    d.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX; my = e.clientY;
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

})();
