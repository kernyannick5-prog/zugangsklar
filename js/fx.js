/* Yanqiva Effekte: Scroll-Reveal, Score-Count-up, Karten-Tilt, 3D-Hero-Parallax, Pause ausserhalb des Sichtfelds.
   Nur transform/opacity. Aus bei prefers-reduced-motion, schwacher Hardware (html.fx-lite), Datensparen und Automatisierung
   (navigator.webdriver; zum Testen mit ?fx=1 erzwingbar). Ohne JS bleibt alles sichtbar. */
(function () {
  'use strict';
  var de = document.documentElement;
  var force = /[?&]fx=1/.test(location.search);
  if (de.classList.contains('fx-lite') || (navigator.webdriver && !force) || !('IntersectionObserver' in window)) return;
  if (document.getElementById('dash-header')) return;
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

  /* Pause: Endlosanimationen nur im Sichtfeld und im sichtbaren Tab */
  var live = new IntersectionObserver(function (es) {
    es.forEach(function (e) { e.target.classList.toggle('fx-off', !e.isIntersecting); });
  });
  Array.prototype.forEach.call(document.querySelectorAll('.hero, .cta-band'), function (el) { live.observe(el); });
  document.addEventListener('visibilitychange', function () { de.classList.toggle('fx-paused', document.hidden); });

  if (!fine) return;

  /* Karten: leichter 3D-Tilt und Lichtreflex */
  var TILT = '.mod-card, .pkg-card, .pkg-teaser, .path-card, .stepup-card';
  var cur = null, ev = null, raf = 0;
  function reset(el) {
    if (!el) return;
    el.classList.remove('fx-tilt');
    el.style.removeProperty('--tx');
    el.style.removeProperty('--ty');
  }
  function paint() {
    raf = 0;
    if (!cur || !ev) return;
    var r = cur.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
    cur.style.setProperty('--tx', ((x - 0.5) * 7).toFixed(2) + 'deg');
    cur.style.setProperty('--ty', ((0.5 - y) * 7).toFixed(2) + 'deg');
    cur.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
    cur.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    cur.classList.add('fx-tilt');
  }
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    var t = e.target.closest ? e.target.closest(TILT) : null;
    if (t !== cur) { reset(cur); cur = t; }
    ev = e;
    if (cur && !raf) raf = requestAnimationFrame(paint);
  }, { passive: true });
  document.addEventListener('mouseleave', function () { reset(cur); cur = null; }, true);

  /* Hero: Parallax-Neigung des 3D-Zeichens */
  var hero = document.querySelector('.hero'), tilt = hero && hero.querySelector('.y3d-tilt');
  if (tilt) {
    var hr = 0, he = null;
    hero.addEventListener('pointermove', function (e) {
      he = e;
      if (hr) return;
      hr = requestAnimationFrame(function () {
        hr = 0;
        var r = hero.getBoundingClientRect(), x = (he.clientX - r.left) / r.width, y = (he.clientY - r.top) / r.height;
        tilt.style.setProperty('--ry', ((x - 0.5) * 22).toFixed(1) + 'deg');
        tilt.style.setProperty('--rx', ((0.5 - y) * 14).toFixed(1) + 'deg');
      });
    }, { passive: true });
    hero.addEventListener('pointerleave', function () { tilt.style.removeProperty('--ry'); tilt.style.removeProperty('--rx'); });
  }
})();
