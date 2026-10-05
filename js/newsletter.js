/* Newsletter-Anmeldung (Double-Opt-in) -> POST /api/newsletter/subscribe. Nur sichtbar, wenn YQ.NEWSLETTER true ist. */
(function () {
  'use strict';
  var YQ = window.YQ;
  var box = document.getElementById('newsletter');
  var form = document.getElementById('newsletter-form');
  if (!box || !form || !YQ.NEWSLETTER) return;
  box.hidden = false;
  var statusEl = document.getElementById('nl-status');
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = form.elements, g = YQ.guard(form), btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    statusEl.textContent = 'Wird gesendet …';
    YQ.postJson('/api/newsletter/subscribe', { email: f.email.value.trim(), name: f.name.value.trim(), consent: f.consent.checked === true, consentVersion: YQ.NEWSLETTER_CONSENT_VERSION, hp: g.hp, ts: g.ts }, { timeout: 20000 }).then(function (d) {
      statusEl.textContent = (d && d.message) || 'Bitte bestätigen Sie Ihre Anmeldung über den Link in der E-Mail, die wir Ihnen senden.';
      form.reset();
      btn.disabled = false;
    }, function (e) {
      btn.disabled = false;
      statusEl.textContent = e.kind === 'network' ? 'Der Newsletter ist gerade nicht erreichbar. Bitte versuchen Sie es später erneut.' : 'Fehler: ' + e.message;
    });
  });
})();
