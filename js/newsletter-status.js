/* Bestätigungs-/Abmeldeseite: Text je nach ?s=ok|ungueltig (ohne JavaScript bleibt der neutrale Text). */
(function () {
  'use strict';
  var s = new URLSearchParams(window.location.search).get('s');
  var t = document.getElementById('nl-text');
  var h = document.getElementById('nl-title');
  if (!t || !h) return;
  var abm = /abgemeldet/.test(window.location.pathname);
  if (s === 'ok') {
    h.textContent = abm ? 'Sie sind abgemeldet' : 'Anmeldung bestätigt';
    t.textContent = abm ? 'Sie erhalten keine weiteren Newsletter. Ihre E-Mail-Adresse haben wir gelöscht; zurück bleibt nur ein Sperrvermerk (Hash), damit keine weitere Zusendung erfolgt.' : 'Vielen Dank, Ihre Einwilligung ist bestätigt. Sie erhalten künftig unseren Newsletter und können sich jederzeit mit einem Klick abmelden.';
  } else if (s === 'ungueltig') {
    h.textContent = 'Link ungültig';
    t.textContent = abm ? 'Der Abmeldelink ist ungültig. Bitte schreiben Sie uns an support@yanqiva.de, wir melden Sie ab.' : 'Der Bestätigungslink ist ungültig, abgelaufen oder wurde bereits verwendet. Bitte melden Sie sich erneut an.';
  }
})();
