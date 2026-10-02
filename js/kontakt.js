/* Kontaktformular -> POST /api/lead (source "kontakt"). */
(function () {
  'use strict';
  var ZK = window.ZK;
  var form = document.getElementById('contact-form');
  if (!form) return;
  var statusEl = document.getElementById('contact-status');
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = form.elements;
    var btn = form.querySelector('button[type="submit"]');
    var url = f.url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    btn.disabled = true;
    statusEl.textContent = 'Nachricht wird gesendet …';
    ZK.postJson('/api/lead', { email: f.email.value.trim(), url: url, consent: true, source: 'kontakt', message: 'Name: ' + f.name.value.trim() + '\n' + f.nachricht.value.trim() }).then(function () {
      statusEl.textContent = 'Vielen Dank. Wir antworten innerhalb von 24 Stunden.';
      form.reset();
      btn.disabled = false;
    }, function (e) {
      btn.disabled = false;
      statusEl.textContent = e.kind === 'network'
        ? 'Das Formular ist gerade nicht erreichbar. Bitte schreiben Sie uns direkt per E-Mail.'
        : 'Fehler: ' + e.message;
    });
  });
})();
