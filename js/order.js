/* Bestellformular: Lead senden, dann Zahlungslink (falls konfiguriert) oder Rechnungs-Fallback. */
(function () {
  'use strict';
  var ZK = window.ZK;
  var form = document.getElementById('order-form');
  if (!form) return;
  var statusEl = document.getElementById('order-status');
  var done = document.getElementById('order-done');
  var NAMES = { report: 'BFSG-Report (149 € netto, einmalig)', monitoring: 'Monitoring (29 € netto pro Monat)', agentur: 'Agentur-Paket (99 € netto pro Monat)' };

  var q = new URLSearchParams(window.location.search);
  var pre = q.get('produkt');
  if (pre && form.elements.produkt) {
    Array.prototype.forEach.call(form.querySelectorAll('input[name="produkt"]'), function (r) { r.checked = r.value === pre; });
  }
  if (q.get('url')) form.elements.url.value = q.get('url');

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = form.elements;
    var product = form.querySelector('input[name="produkt"]:checked').value;
    var btn = form.querySelector('button[type="submit"]');
    var email = f.email.value.trim();
    var url = f.url.value.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    var message = 'Produkt: ' + NAMES[product] + '\nFirma: ' + f.firma.value.trim() + '\nHinweise: ' + (f.hinweise.value.trim() || '-');
    btn.disabled = true;
    statusEl.textContent = 'Bestellung wird gesendet …';
    ZK.postJson('/api/lead', { email: email, url: url, consent: true, source: 'bestellung', message: message }).then(function () {
      var link = ZK.PAYMENT_LINKS[product];
      if (link) {
        statusEl.textContent = 'Danke. Sie werden jetzt zur Zahlung weitergeleitet …';
        window.location.href = link + (link.indexOf('?') === -1 ? '?' : '&') + 'prefilled_email=' + encodeURIComponent(email);
        return;
      }
      form.hidden = true;
      statusEl.textContent = '';
      done.hidden = false;
      done.focus();
    }, function (e) {
      btn.disabled = false;
      statusEl.textContent = e.kind === 'network'
        ? 'Die Bestellung konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut oder nutzen Sie die Kontaktseite.'
        : 'Fehler: ' + e.message;
    });
  });
})();
