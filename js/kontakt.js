/* Kontaktformular -> POST /api/lead (source "kontakt"). */
(function () {
  'use strict';
  var YQ = window.YQ;
  var form = document.getElementById('contact-form');
  if (!form) return;
  var statusEl = document.getElementById('contact-status');
  var quelle = (new URLSearchParams(window.location.search).get('quelle') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  if (quelle === 'agentur-probe-report' && form.elements.nachricht && !form.elements.nachricht.value) form.elements.nachricht.value = 'Bitte senden Sie mir einen kostenlosen Probe-Report für einen Kundenshop. Adresse des Shops: ';
  if (quelle === 'agentur-partner' && form.elements.nachricht && !form.elements.nachricht.value) form.elements.nachricht.value = 'Ich interessiere mich für die Partnerprovision. Unsere Agentur: ';
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = form.elements;
    var btn = form.querySelector('button[type="submit"]');
    var url = f.url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    btn.disabled = true;
    statusEl.textContent = 'Nachricht wird gesendet …';
    var g = YQ.guard(form);
    YQ.postJson('/api/lead', { hp: g.hp, ts: g.ts, email: f.email.value.trim(), url: url, consent: true, source: 'kontakt', message: 'Name: ' + f.name.value.trim() + '\n' + f.nachricht.value.trim() }, { timeout: 20000 }).then(function () {
      statusEl.textContent = 'Vielen Dank. Wir antworten in der Regel innerhalb von 24 Stunden (werktags).';
      form.reset();
      btn.disabled = false;
    }, function (e) {
      btn.disabled = false;
      if (e.kind === 'network') YQ.mailFallback(statusEl, 'Das Formular ist gerade nicht erreichbar. Bitte schreiben Sie uns direkt per', 'Kontaktanfrage über yanqiva', f.nachricht.value.trim());
      else statusEl.textContent = 'Fehler: ' + e.message;
    });
  });
})();
