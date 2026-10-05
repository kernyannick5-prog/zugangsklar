/* Hinweisfenster zum Start der gewerblichen Tätigkeit.
   Erscheint bis einschließlich zum Vortag des Starttermins, insgesamt höchstens MAX_SHOWS-mal: auf der Startseite bei jedem
   Aufruf (auch per Zurück-Button), auf allen anderen Seiten nur, solange er noch gar nicht erschienen ist.
   Gespeichert wird nur ein Anzeigezähler ohne personenbezogene Daten (localStorage, Fallback sessionStorage).
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
  var MAX_SHOWS = 3; // Entscheidung Eigentümer 2026-10-05: höchstens 3 Anzeigen insgesamt
  // Bisherige Anzeigen; der frühere Wert '1' (Version „nur einmal“) zählt als eine Anzeige
  function shows() {
    var n = 0;
    try { n = Math.max(n, parseInt(localStorage.getItem(KEY), 10) || 0); } catch (e) { /* Speicher gesperrt */ }
    try { n = Math.max(n, parseInt(sessionStorage.getItem(KEY), 10) || 0); } catch (e) { /* Speicher gesperrt */ }
    return n;
  }
  function remember() {
    var n = String(shows() + 1);
    try { localStorage.setItem(KEY, n); return; } catch (e) { /* Speicher gesperrt */ }
    try { sessionStorage.setItem(KEY, n); } catch (e) { /* dann erscheint der Hinweis erneut */ }
  }
  // Startseite: bei jedem Aufruf bis zum Limit; andere Seiten nur, solange er noch nie erschienen ist
  var isHome = /^\/(index(\.html)?)?$/.test(location.pathname);
  function allowed() { return force || shows() < (isHome ? MAX_SHOWS : 1); }
  if (!allowed()) return;
  // Gilt schon beim Anzeigen als gesehen: auch ohne Klick auf „Verstanden“ (Weiterklicken, Zurück, Tab schließen) erscheint er nicht erneut
  var shownThisPage = false;

  function build() {
    if (shownThisPage || !allowed()) return;
    shownThisPage = true;
    remember();
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
  // Rückkehr per Zurück-Button lädt die Seite aus dem Cache neu, ohne das Skript erneut auszuführen
  if (isHome) window.addEventListener('pageshow', function (e) {
    if (!e.persisted || document.querySelector('dialog.yq-notice')) return;
    shownThisPage = false;
    build();
  });
})();
