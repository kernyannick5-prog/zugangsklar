/* Yanqiva Effekte: Scroll-Reveal, Score-Count-up, 3D-Hero-Zeigerfuehrung, Pause ausserhalb des Sichtfelds.
   Nur transform/opacity. Aus bei prefers-reduced-motion, schwacher Hardware (html.fx-lite), Datensparen und Automatisierung
   (navigator.webdriver; zum Testen mit ?fx=1 erzwingbar). Ohne JS bleibt alles sichtbar. */
(function () {
  'use strict';
  var de = document.documentElement;
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

  /* Hero: Das 3D-Zeichen richtet sich exakt zum Mauszeiger aus (ganze Seite, nicht nur im Hero).
     Winkel = atan(Abstand Zeiger zur Zeichen-Mitte / virtuelle Tiefe), weich nachgeführt per rAF, Ruhe = kein rAF.
     Beim ersten Mauskontakt wird die Grunddrehung/Leerlauf-Animation ruckfrei ausgeblendet (aktuelle Matrix einfrieren, dann zurückblenden). */
  var hero = document.querySelector('.hero'), tilt = hero && hero.querySelector('.y3d-tilt'),
      scene = hero && hero.querySelector('.y3d-scene'), mark = hero && hero.querySelector('.y3d-stack');
  if (tilt && scene && mark) {
    var DEPTH = 460, MAXY = 34, MAXX = 26;
    var tx = 0, ty = 0, cx = 0, cy = 0, run = 0, following = false, px = 0, py = 0, hasP = false;
    function startFollow() {
      following = true;
      var m = getComputedStyle(scene).transform;
      scene.style.transform = m === 'none' ? '' : m;
      scene.style.animation = 'none';
      tilt.classList.add('y3d-follow');
      requestAnimationFrame(function () { requestAnimationFrame(function () { scene.style.transition = 'transform .7s cubic-bezier(.22, 1, .36, 1)'; scene.style.transform = 'none'; }); });
    }
    function aim() {
      var r = mark.getBoundingClientRect();
      if (!r.width) return;
      var dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2);
      ty = Math.max(-MAXY, Math.min(MAXY, Math.atan2(dx, DEPTH) * 180 / Math.PI));
      tx = Math.max(-MAXX, Math.min(MAXX, Math.atan2(-dy, DEPTH) * 180 / Math.PI));
    }
    function frame() {
      if (hasP) aim();
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      tilt.style.setProperty('--rx', cx.toFixed(2) + 'deg');
      tilt.style.setProperty('--ry', cy.toFixed(2) + 'deg');
      if (Math.abs(tx - cx) < 0.05 && Math.abs(ty - cy) < 0.05 || de.classList.contains('fx-paused')) { run = 0; return; }
      run = requestAnimationFrame(frame);
    }
    function kick() { if (!run) run = requestAnimationFrame(frame); }
    var art3d = tilt.closest('.hero-art');
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      if (art3d && art3d.classList.contains('h3d-on')) return; /* 3D-Canvas (hero3d.js) fuehrt selbst; verdeckte Kachel nicht mitbewegen */
      px = e.clientX; py = e.clientY; hasP = true;
      if (!following) startFollow();
      kick();
    }, { passive: true });
    window.addEventListener('scroll', function () { if (hasP) kick(); }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { hasP = false; tx = 0; ty = 0; kick(); });
  }
})();
