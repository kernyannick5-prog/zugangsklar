/* Hinweisfenster zum Start der gewerblichen Tätigkeit.
   Erscheint beim ersten Besuch bis einschließlich zum Vortag des Starttermins, danach nie wieder.
   Gespeichert wird nur ein Merkzeichen ohne personenbezogene Daten (localStorage, Fallback sessionStorage).
   In automatisierten Tests (navigator.webdriver) aus, außer mit ?hinweis=1. Keine Abhängigkeiten. */
(function () {
  'use strict';
  // Startdatum und Schalter zentral in js/config.js (YQ.START_DATE, YQ.prestartActive); Fallback 15.10.2026
  var YQ = window.YQ;
  var START = YQ && YQ.START_DATE ? new Date(YQ.START_DATE + 'T00:00:00') : new Date(2026, 9, 15);
  var KEY = 'yq-hinweis-start-2026-10';
  var force = /[?&]hinweis=1/.test(location.search);
  if (!force && (new Date() >= START || navigator.webdriver || (YQ && YQ.prestartActive && !YQ.prestartActive()))) return;
  if (window.top !== window.self) return; // nicht in eingebetteten Vorschauen
  function seen() {
    try { if (localStorage.getItem(KEY) === '1') return true; } catch (e) { /* Speicher gesperrt */ }
    try { if (sessionStorage.getItem(KEY) === '1') return true; } catch (e) { /* Speicher gesperrt */ }
    return false;
  }
  function remember() {
    try { localStorage.setItem(KEY, '1'); return; } catch (e) { /* Speicher gesperrt */ }
    try { sessionStorage.setItem(KEY, '1'); } catch (e) { /* dann erscheint der Hinweis erneut */ }
  }
  if (!force && seen()) return;

  function build() {
    var dlg = document.createElement('dialog');
    dlg.className = 'yq-notice';
    dlg.setAttribute('aria-labelledby', 'yq-notice-h');
    dlg.setAttribute('aria-describedby', 'yq-notice-t');
    var h = document.createElement('h2');
    h.id = 'yq-notice-h';
    h.textContent = 'Hinweis: Start am 15. Oktober 2026';
    var t = document.createElement('div');
    t.id = 'yq-notice-t';
    var p1 = document.createElement('p');
    p1.textContent = 'Yanqiva befindet sich im Aufbau. Die gewerbliche Tätigkeit wird voraussichtlich zum 15. Oktober 2026 aufgenommen.';
    var p2 = document.createElement('p');
    p2.textContent = 'Bis dahin erbringen wir keine Leistungen und schließen keine Verträge. Preise und Angebote auf dieser Website sind bis zum Tätigkeitsbeginn unverbindlich. Anfragen können Sie bereits senden – wir melden uns ab dem Start.';
    t.appendChild(p1);
    t.appendChild(p2);
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn yq-notice-ok';
    btn.textContent = 'Verstanden';
    dlg.appendChild(h);
    dlg.appendChild(t);
    dlg.appendChild(btn);
    var opener = document.activeElement;
    function close() {
      remember();
      if (dlg.open) dlg.close();
      dlg.remove();
      if (opener && opener.focus && document.contains(opener)) opener.focus();
    }
    btn.addEventListener('click', close);
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(); }); // Escape = verstanden
    document.body.appendChild(dlg);
    if (typeof dlg.showModal === 'function') {
      dlg.showModal();
    } else {
      dlg.setAttribute('open', '');
      dlg.classList.add('yq-notice-fallback');
    }
    btn.focus();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
