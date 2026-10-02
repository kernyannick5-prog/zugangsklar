/* Navigation: Mobile-Menue (Disclosure-Button) und Prüfbereiche-Menue (details/summary).
   Escape schliesst und gibt den Fokus zurueck; Klick ausserhalb und Linkklick schliessen. Ohne JS bleiben alle Links sichtbar. */
(function () {
  'use strict';
  var d = document.querySelector('.nav-drop');
  var btn = document.querySelector('.nav-toggle');
  var nav = document.getElementById('site-nav');
  var mq = window.matchMedia ? window.matchMedia('(max-width: 959px)') : null;

  function setMenu(open, refocus) {
    if (!btn || !nav) return;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    nav.classList.toggle('is-open', open);
    if (open && d && mq && mq.matches) d.open = true;
    if (!open && refocus) btn.focus();
  }
  if (btn && nav) {
    btn.addEventListener('click', function () { setMenu(btn.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a')) setMenu(false); });
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { setMenu(false); if (d) d.open = false; });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var menuOpen = btn && btn.getAttribute('aria-expanded') === 'true';
    if (d && d.open && !(mq && mq.matches)) {
      d.open = false;
      var s = d.querySelector('summary');
      if (s) s.focus();
    } else if (menuOpen) {
      setMenu(false, true);
    }
  });
  document.addEventListener('click', function (e) {
    if (d && d.open && !(mq && mq.matches) && !d.contains(e.target)) d.open = false;
    if (btn && nav && btn.getAttribute('aria-expanded') === 'true' && !nav.contains(e.target) && !btn.contains(e.target)) setMenu(false);
  });
  if (d) d.addEventListener('focusout', function (e) {
    if (d.open && !(mq && mq.matches) && e.relatedTarget && !d.contains(e.relatedTarget)) d.open = false;
  });
})();
