/* Bestellformular: Lead senden, dann Zahlungslink (falls konfiguriert) oder Rechnungs-Fallback. */
(function () {
  'use strict';
  var YQ = window.YQ;
  var form = document.getElementById('order-form');
  if (!form) return;
  var statusEl = document.getElementById('order-status');
  var done = document.getElementById('order-done');
  // Fallback-Namen (Stand 2026-10-03). Maßgeblich ist window.YQ_CATALOG (js/catalog.js, generiert aus tools/site-build/catalog.mjs).
  var NAMES = {
    'website-basic': 'Website Basic (349 €, einmalig)', 'website-business': 'Website Business (790 €, einmalig)', 'website-pflege': 'Yanqiva Pflege (ab 29 €/Monat)', 'website-premium': 'Website Premium (ab 1.490 €, einmalig, Festpreis-Angebot vorab)',
    report: 'Website-Report (149 €, einmalig)', monitoring: 'Monitoring (29 € pro Monat)', business: 'Business (79 € pro Monat)',
    agentur: 'Agentur (99 € pro Monat)', agentur_plus: 'Agentur Plus (249 € pro Monat)',
    'fix-google-fonts': 'Fix: Google Fonts lokal einbinden (149 €)', 'fix-erklaerung': 'Fix: Barrierefreiheitserklärung erstellen (99 €)',
    'fix-security-header': 'Fix: Security-Header einrichten (149 €)', 'fix-a11y': 'Fix: Barrierefreiheits-Fix-Paket (ab 490 €)', 'fix-individuell': 'Fix: individuelle Umsetzung (nach Angebot)'
  };
  if (window.YQ_CATALOG && window.YQ_CATALOG.products) {
    Object.keys(window.YQ_CATALOG.products).forEach(function (id) { NAMES[id] = window.YQ_CATALOG.products[id].orderLabel; });
  }

  var q = new URLSearchParams(window.location.search);
  var pre = q.get('produkt');
  if (pre && form.elements.produkt) {
    Array.prototype.forEach.call(form.querySelectorAll('input[name="produkt"]'), function (r) { r.checked = r.value === pre; });
  }
  if (q.get('url')) form.elements.url.value = q.get('url');

  // Bei Website-Paketen ist die Adresse einer bestehenden Website optional (es gibt ggf. noch keine).
  var urlInput = form.elements.url;
  var urlReq = document.getElementById('o-url-req');
  var urlOpt = document.getElementById('o-url-opt');
  // Bestätigung „Inhaber oder beauftragt“: Pflicht für alle Leistungen an einer bestehenden Website
  // (Report, Monitoring-/Agentur-Pläne, Fix, Pflege). Bei neuer Website (Basic/Business/Premium) entfällt sie.
  var authInput = document.getElementById('o-auth');
  var authField = document.getElementById('o-auth-field');
  var authWeb = document.getElementById('o-auth-web');
  function isNewWebsite(v) { return /^website-(basic|business|premium)$/.test(v || ''); }
  function needsAuth() {
    var sel = form.querySelector('input[name="produkt"]:checked');
    return !!authInput && !(sel && isNewWebsite(sel.value));
  }
  function syncUrlRequired() {
    var sel = form.querySelector('input[name="produkt"]:checked');
    var isWeb = !!sel && sel.value.indexOf('website-') === 0;
    urlInput.required = !isWeb;
    if (urlReq) urlReq.hidden = isWeb;
    if (urlOpt) urlOpt.hidden = !isWeb;
    var auth = needsAuth();
    if (authInput) authInput.required = auth;
    if (authField) authField.hidden = !auth;
    if (authWeb) authWeb.hidden = auth;
  }
  form.addEventListener('change', function (e) { if (e.target && e.target.name === 'produkt') syncUrlRequired(); });
  syncUrlRequired();

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = form.elements;
    var product = form.querySelector('input[name="produkt"]:checked').value;
    var btn = form.querySelector('button[type="submit"]');
    var auth = needsAuth();
    if (auth && !authInput.checked) {
      statusEl.textContent = 'Bitte bestätigen Sie, dass Sie Inhaber der angegebenen Website oder vom Inhaber beauftragt sind.';
      authInput.focus();
      return;
    }
    var email = f.email.value.trim();
    var url = f.url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    var message = 'Produkt: ' + (NAMES[product] || product) + ' [' + product + ']' + '\nFirma: ' + f.firma.value.trim() + '\nHinweise: ' + (f.hinweise.value.trim() || '-') + '\nUnternehmer (§ 14 BGB) bestätigt und AGB akzeptiert: ' + (f.consent && f.consent.checked ? 'ja' : 'nein')
      + '\nInhaber der Website oder vom Inhaber beauftragt (Agentur: mit Auftrag des Kunden) bestätigt: ' + (auth ? (authInput.checked ? 'ja' : 'nein') : 'entfällt (neue Website)');
    btn.disabled = true;
    statusEl.textContent = 'Bestellung wird gesendet …';
    YQ.postJson('/api/lead', { email: email, url: url, consent: true, source: 'bestellung', message: message }).then(function () {
      var link = YQ.PAYMENT_LINKS[product];
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
