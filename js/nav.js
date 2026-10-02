/* Navigation: Prüfbereiche-Menü (details/summary) per Escape, Klick außerhalb und Fokusverlust schließen. */
(function () {
  'use strict';
  var d = document.querySelector('.nav-drop');
  if (!d) return;
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && d.open) {
      d.open = false;
      var s = d.querySelector('summary');
      if (s) s.focus();
    }
  });
  document.addEventListener('click', function (e) {
    if (d.open && !d.contains(e.target)) d.open = false;
  });
  d.addEventListener('focusout', function (e) {
    if (d.open && e.relatedTarget && !d.contains(e.relatedTarget)) d.open = false;
  });
})();
