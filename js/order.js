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
    'website-business': 'Website Business (ab 590 €, einmalig, unverbindliche Anfrage, individuelles Angebot vorab)', 'website-pflege': 'Yanqiva Pflege (ab 29 €/Monat)', 'website-premium': 'Website Premium (individuelles Angebot, Orientierung ab 1.490 €, einmalig, unverbindliche Anfrage)',
    report: 'Website-Report (149 €, einmalig)', monitoring: 'Monitoring (29 € pro Monat)', business: 'Business (79 € pro Monat)',
    agentur: 'Agentur (99 € pro Monat)', agentur_plus: 'Agentur Plus (249 € pro Monat)',
    'fix-google-fonts': 'Fix: Google Fonts lokal einbinden (149 €)', 'fix-erklaerung': 'Fix: Barrierefreiheitserklärung erstellen (99 €)',
    'fix-security-header': 'Fix: Security-Header einrichten (149 €)', 'fix-a11y': 'Fix: Barrierefreiheits-Fix-Paket (ab 490 €)', 'fix-individuell': 'Fix: individuelle Umsetzung (nach Angebot)'
  };
  if (window.YQ_CATALOG && window.YQ_CATALOG.products) {
    Object.keys(window.YQ_CATALOG.products).forEach(function (id) { NAMES[id] = window.YQ_CATALOG.products[id].orderLabel; });
  }

  var MAX_MESSAGE = 2000; // entspricht dem Limit von POST /api/lead (worker/src/lead.js)
  var q = new URLSearchParams(window.location.search);
  var pre = q.get('produkt');
  if (pre === 'website-basic') pre = 'website-business'; // Basic entfällt (seit 2026-10-03): alte Links landen bei Business
  // Unbekannte Werte (?produkt=xyz) ignorieren: sonst wäre kein Produkt gewählt und das Absenden würde fehlschlagen.
  var preRadio = pre ? Array.prototype.filter.call(form.querySelectorAll('input[name="produkt"]'), function (r) { return r.value === pre; })[0] : null;
  if (preRadio) {
    Array.prototype.forEach.call(form.querySelectorAll('input[name="produkt"]'), function (r) { r.checked = r === preRadio; });
  }
  if (!form.querySelector('input[name="produkt"]:checked')) {
    var firstRadio = form.querySelector('input[name="produkt"]');
    if (firstRadio) firstRadio.checked = true;
  }
  if (q.get('url')) form.elements.url.value = q.get('url');

  // Bei Website-Projekten ist die Adresse einer bestehenden Website optional (es gibt ggf. noch keine).
  var urlInput = form.elements.url;
  var urlReq = document.getElementById('o-url-req');
  var urlOpt = document.getElementById('o-url-opt');
  // Bestätigung „Inhaber oder beauftragt“: Pflicht für alle Leistungen an einer bestehenden Website
  // (Report, Monitoring-/Agentur-Pläne, Fix, Pflege). Bei einem neuen Website-Projekt (Business/Premium) entfällt sie.
  var authInput = document.getElementById('o-auth');
  var authField = document.getElementById('o-auth-field');
  var authWeb = document.getElementById('o-auth-web');
  // Unverbindliche Anfrage mit Angebot (AGB Ziffer 4): Website-Projekte, Yanqiva Pflege, alle Yanqiva-Fix-Leistungen.
  function isInquiry(v) { return /^(website-(business|premium|pflege)|fix-.+)$/.test(v || ''); }
  function isNewWebsite(v) { return /^website-(business|premium)$/.test(v || ''); }
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
    var projekt = document.getElementById('o-projekt-field');
    var submit = document.getElementById('o-submit');
    var isProject = !!sel && isNewWebsite(sel.value);
    if (projekt) projekt.hidden = !isProject;
    if (submit) submit.textContent = isProject ? 'Projekt anfragen (unverbindlich)' : (sel && isInquiry(sel.value)) ? 'Anfrage senden (unverbindlich)' : 'Verbindlich bestellen';
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
    var isProject = isNewWebsite(product);
    var inquiry = isInquiry(product);
    var message = (isProject ? 'PROJEKTANFRAGE (unverbindlich, individuelles Angebot)\n' : '') + 'Produkt: ' + (NAMES[product] || product) + ' [' + product + ']' + '\nFirma: ' + f.firma.value.trim() + (isProject ? '\nProjektbeschreibung: ' + ((f.projekt && f.projekt.value.trim()) || '-') : '') + '\nHinweise: ' + (f.hinweise.value.trim() || '-') + '\nUnternehmer (§ 14 BGB) bestätigt und AGB akzeptiert: ' + (f.consent && f.consent.checked ? 'ja' : 'nein')
      + '\nInhaber der Website oder vom Inhaber beauftragt (Agentur: mit Auftrag des Kunden) bestätigt: ' + (auth ? (authInput.checked ? 'ja' : 'nein') : 'entfällt (neue Website)');
    // Die API erlaubt höchstens 2000 Zeichen je Nachricht; Projektbeschreibung und Hinweise (je bis 1500) können zusammen darüber liegen.
    if (message.length > MAX_MESSAGE) {
      var over = message.length - MAX_MESSAGE;
      statusEl.textContent = 'Ihre Angaben sind insgesamt ' + over + ' Zeichen zu lang. Bitte kürzen Sie die Projektbeschreibung oder die Hinweise.';
      var longer = (f.projekt && f.projekt.value.length > f.hinweise.value.length) ? f.projekt : f.hinweise;
      longer.focus();
      return;
    }
    btn.disabled = true;
    statusEl.textContent = inquiry ? 'Anfrage wird gesendet …' : 'Bestellung wird gesendet …';
    YQ.postJson('/api/lead', { email: email, url: url, consent: true, source: 'bestellung', message: message }).then(function () {
      var link = inquiry ? '' : YQ.PAYMENT_LINKS[product]; // Anfrage-Produkte: erst Angebot, keine Sofortzahlung
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
