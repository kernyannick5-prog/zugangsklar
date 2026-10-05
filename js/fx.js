/* Yanqiva Effekte: Scroll-Reveal, Score-Count-up, 3D-Hero-Zeigerfuehrung, Pause ausserhalb des Sichtfelds.
   Nur transform/opacity. Aus bei prefers-reduced-motion, schwacher Hardware (html.fx-lite), Datensparen und Automatisierung
   (navigator.webdriver; zum Testen mit ?fx=1 erzwingbar). Ohne JS bleibt alles sichtbar. */
(function () {
  'use strict';
  var de = document.documentElement;
  /* Hero-Logo: Endlosanimation erst starten, wenn die Seite geladen ist und der Browser frei hat (html.anim-go).
     Bis dahin steht das Logo in der Ausgangsposition (pausiert bei 0), daher startet es nahtlos ohne Sprung und
     wird nicht von Layout-/Skriptarbeit beim Öffnen ausgebremst. */
  function animGo() { requestAnimationFrame(function () { requestAnimationFrame(function () { de.classList.add('anim-go'); }); }); }
  function animIdle() { if ('requestIdleCallback' in window) requestIdleCallback(animGo, { timeout: 1200 }); else setTimeout(animGo, 300); }
  if (document.readyState === 'complete') animIdle(); else window.addEventListener('load', animIdle, { once: true });
  var force = /[?&]fx=1/.test(location.search);
  if (!('IntersectionObserver' in window) || document.getElementById('dash-header')) return;
  /* Pause: Endlosanimationen nur im Sichtfeld und im sichtbaren Tab */
  var live = new IntersectionObserver(function (es) {
    es.forEach(function (e) { e.target.classList.toggle('fx-off', !e.isIntersecting); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.hero'), function (el) { live.observe(el); });
  document.addEventListener('visibilitychange', function () { de.classList.toggle('fx-paused', document.hidden); });

  /* Ab hier nur die Bewegungseffekte (nicht bei fx-lite, reduzierter Bewegung, Automatisierung) */
  if (de.classList.contains('fx-lite') || (navigator.webdriver && !force)) return;
  de.classList.add('fx');
  var fine = window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  var vh = window.innerHeight || 800;

  /* Reveal: nur Elemente unterhalb des ersten Bildschirms werden vorab versteckt, jedes nur einmal */
  var REVEAL = 'main section:not(.hero):not(.showcase):not(.cta-band) .section-head, main section:not(.hero):not(.showcase) .card, main section:not(.hero):not(.showcase) .protocol, main section:not(.hero) .honest, main section:not(.hero) .faq-item, main section:not(.hero) .steps li';
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('fx-in'); io.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  var batch = new Map();
  Array.prototype.forEach.call(document.querySelectorAll(REVEAL), function (el) {
    if (el.closest('[hidden]') || el.getBoundingClientRect().top < vh * 0.95) return;
    var p = el.parentNode, n = batch.get(p) || 0;
    batch.set(p, n + 1);
    el.style.setProperty('--fx-d', (n % 4) * 70 + 'ms');
    el.classList.add('fx-r');
    io.observe(el);
  });

  /* Score-Beispiel: Ring und Balken fuellen sich, Zahl zaehlt hoch */
  Array.prototype.forEach.call(document.querySelectorAll('.protocol .score-row'), function (row) {
    var prot = row.closest('.protocol'), bar = row.querySelector('.bar'), num = row.querySelector('.score-num span');
    if (!bar || !num || !num.firstChild) return;
    var target = parseInt(num.firstChild.nodeValue, 10), full = bar.getAttribute('stroke-dashoffset');
    var scoreBox = row.querySelector('.score-num');
    scoreBox.setAttribute('aria-hidden', 'true');
    bar.style.strokeDashoffset = bar.getAttribute('stroke-dasharray');
    num.firstChild.nodeValue = '0';
    Array.prototype.forEach.call(prot.querySelectorAll('.bar-fill'), function (f, i) { f.style.setProperty('--fx-d', i * 90 + 'ms'); f.classList.add('fx-fill'); });
    new IntersectionObserver(function (es, o) {
      if (!es[0].isIntersecting) return;
      o.disconnect();
      bar.style.strokeDashoffset = full;
      prot.classList.add('fx-go');
      var t0 = performance.now();
      (function tick(t) {
        var k = Math.min(1, (t - t0) / 1100);
        num.firstChild.nodeValue = Math.round(target * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(tick); else scoreBox.removeAttribute('aria-hidden');
      })(t0);
    }, { threshold: 0.45 }).observe(prot);
  });

  if (!fine) return;

  /* Hero (Desktop mit Maus): Das 3D-Zeichen neigt sich sanft zum Mauszeiger (ganze Seite).
     Das räumliche Schwingen (CSS y3d-idle) läuft immer weiter, die Neigung liegt auf dem übergeordneten .y3d-tilt.
     Bewegung als kritisch gedämpfte Feder mit Tempolimit: auch sehr schnelle Mausbewegungen ergeben nur eine ruhige
     Neigung, nie eine Umdrehung. Mitte aus dem unbewegten .hero-art, nur nach Scrollen/Größenänderung neu gemessen. */
  var hero = document.querySelector('.hero'), tilt = hero && hero.querySelector('.y3d-tilt'), art = hero && hero.querySelector('.hero-art');
  if (tilt && art) {
    var DEPTH = 520, MAXY = 20, MAXX = 14;   // Maximalwinkel der Neigung in Grad
    var K = 38, D = 2 * Math.sqrt(38), VMAX = 90; // Federsteifigkeit, kritische Dämpfung, max. Grad pro Sekunde
    var tx = 0, ty = 0, cx = 0, cy = 0, vx = 0, vy = 0, run = 0, last = 0, px = 0, py = 0, hasP = false, rect = null;
    function aim() {
      var r = rect || (rect = art.getBoundingClientRect());
      if (!r.width) return;
      var dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2);
      ty = Math.max(-MAXY, Math.min(MAXY, Math.atan2(dx, DEPTH) * 180 / Math.PI));
      tx = Math.max(-MAXX, Math.min(MAXX, Math.atan2(-dy, DEPTH) * 180 / Math.PI));
    }
    function frame(t) {
      var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t;
      if (hasP) aim();
      for (var i = 0, n = Math.ceil(dt / 0.008), h = dt / n; i < n; i++) {
        vx += ((tx - cx) * K - vx * D) * h; vy += ((ty - cy) * K - vy * D) * h;
        vx = Math.max(-VMAX, Math.min(VMAX, vx)); vy = Math.max(-VMAX, Math.min(VMAX, vy));
        cx += vx * h; cy += vy * h;
      }
      tilt.style.setProperty('--rx', cx.toFixed(2) + 'deg');
      tilt.style.setProperty('--ry', cy.toFixed(2) + 'deg');
      var rest = Math.abs(tx - cx) < 0.05 && Math.abs(ty - cy) < 0.05 && Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05;
      if (rest || de.classList.contains('fx-paused')) { run = 0; last = 0; return; }
      run = requestAnimationFrame(frame);
    }
    function kick() { if (!run) run = requestAnimationFrame(frame); }
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      px = e.clientX; py = e.clientY; hasP = true;
      if (!tilt.classList.contains('y3d-follow')) tilt.classList.add('y3d-follow');
      kick();
    }, { passive: true });
    window.addEventListener('scroll', function () { rect = null; if (hasP) kick(); }, { passive: true });
    window.addEventListener('resize', function () { rect = null; }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { hasP = false; tx = 0; ty = 0; kick(); });
  }
})();
