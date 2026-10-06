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
    'website-basic': /*YQ:orderLabel:website-basic*/'Website Basic (299 €, Einführungspreis bis 31.12.2026 (danach 349 €), einmalig, unverbindliche Anfrage, Angebot vorab)'/*YQ*/, 'website-business': 'Website Business (ab 590 €, einmalig, unverbindliche Anfrage, individuelles Angebot vorab)', 'website-pflege': 'Yanqiva Pflege (ab 29 €/Monat)', 'website-premium': 'Website Premium (individuelles Angebot, Orientierung ab 1.490 €, einmalig, unverbindliche Anfrage)',
    report: 'Website-Report (149 €, einmalig)', monitoring: 'Monitoring (29 € pro Monat)', business: 'Monitoring Plus (79 € pro Monat)',
    agentur: 'Agentur (99 € pro Monat)', agentur_plus: 'Agentur Plus (249 € pro Monat)',
    'fix-google-fonts': 'Fix: Google Fonts lokal einbinden (149 €)', 'fix-erklaerung': 'Fix: Barrierefreiheitserklärung erstellen (99 €)',
    'fix-security-header': 'Fix: Security-Header einrichten (149 €)', 'fix-a11y': 'Fix: Barrierefreiheits-Fix-Paket (ab 249 €)', 'fix-individuell': 'Fix: individuelle Umsetzung (nach Angebot)'
  };
  if (window.YQ_CATALOG && window.YQ_CATALOG.products) {
    Object.keys(window.YQ_CATALOG.products).forEach(function (id) { NAMES[id] = window.YQ_CATALOG.products[id].orderLabel; });
  }

  var MAX_MESSAGE = 2000; // entspricht dem Limit von POST /api/lead (worker/src/lead.js)
  var q = new URLSearchParams(window.location.search);
  var pre = q.get('produkt');
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
  function isInquiry(v) { return /^(website-(basic|business|premium|pflege)|fix-.+)$/.test(v || ''); }
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

  // Vor Tätigkeitsbeginn (YQ.prestartActive, Schalter in js/config.js): Hinweis vor dem Absenden.
  // Bestätigt der Nutzer, geht die Bestellung als unverbindliche Anfrage ein. Ab dem Starttermin automatisch aus.
  var prestartConfirmed = false;
  function prestart() { return !!(YQ.prestartActive && YQ.prestartActive()) && !(navigator.webdriver && !/[?&]hinweis=1/.test(location.search)); }
  function showPrestartDialog() {
    var dlg = document.createElement('dialog');
    dlg.className = 'yq-notice';
    dlg.setAttribute('aria-labelledby', 'yq-order-pre-h');
    dlg.setAttribute('aria-describedby', 'yq-order-pre-t');
    var start = new Date(YQ.START_DATE + 'T00:00:00').toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    var h = document.createElement('h2'); h.id = 'yq-order-pre-h'; h.textContent = 'Hinweis: Bestellungen erst ab ' + start;
    var t = document.createElement('div'); t.id = 'yq-order-pre-t';
    var p1 = document.createElement('p'); p1.textContent = 'Yanqiva nimmt die gewerbliche Tätigkeit voraussichtlich am ' + start + ' auf. Bis dahin kommt kein Vertrag zustande und es entstehen keine Kosten.';
    var p2 = document.createElement('p'); p2.textContent = 'Sie können Ihre Angaben schon jetzt als unverbindliche Anfrage senden. Wir melden uns ab dem Start bei Ihnen.';
    t.appendChild(p1); t.appendChild(p2);
    var actions = document.createElement('div'); actions.className = 'yq-notice-actions';
    var go = document.createElement('button'); go.type = 'button'; go.className = 'btn'; go.textContent = 'Als unverbindliche Anfrage senden';
    var cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn btn-secondary'; cancel.textContent = 'Abbrechen';
    actions.appendChild(go); actions.appendChild(cancel);
    dlg.appendChild(h); dlg.appendChild(t); dlg.appendChild(actions);
    var submitBtn = form.querySelector('button[type="submit"]');
    function close(send) {
      if (dlg.open) dlg.close();
      dlg.remove();
      if (send) { prestartConfirmed = true; if (form.requestSubmit) form.requestSubmit(); else form.dispatchEvent(new Event('submit', { cancelable: true })); }
      else if (submitBtn) submitBtn.focus();
    }
    go.addEventListener('click', function () { close(true); });
    cancel.addEventListener('click', function () { close(false); });
    dlg.addEventListener('cancel', function (e) { e.preventDefault(); close(false); });
    document.body.appendChild(dlg);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    go.focus();
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (prestart() && !prestartConfirmed) {
      // Formular erst prüfen (Browser-Validierung lief bereits), dann Hinweis zeigen
      showPrestartDialog();
      return;
    }
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
    var message = (prestart() ? 'VOR TÄTIGKEITSBEGINN (' + YQ.START_DATE + ') EINGEGANGEN – unverbindliche Anfrage\n' : '') + (isProject ? 'PROJEKTANFRAGE (unverbindlich, individuelles Angebot)\n' : '') + 'Produkt: ' + (NAMES[product] || product) + ' [' + product + ']' + '\nFirma: ' + f.firma.value.trim() + (isProject ? '\nProjektbeschreibung: ' + ((f.projekt && f.projekt.value.trim()) || '-') : '') + '\nHinweise: ' + (f.hinweise.value.trim() || '-') + '\nUnternehmer (§ 14 BGB) bestätigt und AGB akzeptiert: ' + (f.consent && f.consent.checked ? 'ja' : 'nein')
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
    var g = YQ.guard(form);
    var fields = { product: product, company: f.firma.value.trim() };
    if (url) fields.website = url;
    if (isProject && f.projekt && f.projekt.value.trim()) fields.project = f.projekt.value.trim();
    if (f.hinweise.value.trim()) fields.notes = f.hinweise.value.trim();
    YQ.postJson('/api/lead', { hp: g.hp, ts: g.ts, email: email, url: url, consent: true, source: 'bestellung', message: message, fields: fields }, { timeout: 20000 }).then(function (res) {
      var link = inquiry ? '' : YQ.PAYMENT_LINKS[product]; // Anfrage-Produkte: erst Angebot, keine Sofortzahlung
      if (link) {
        statusEl.textContent = 'Danke. Sie werden jetzt zur Zahlung weitergeleitet …';
        window.location.href = link + (link.indexOf('?') === -1 ? '?' : '&') + 'prefilled_email=' + encodeURIComponent(email);
        return;
      }
      form.hidden = true;
      statusEl.textContent = '';
      if (res && typeof res.id === 'string' && /^YQ-[0-9]{8}-[A-Z0-9]{4,6}$/.test(res.id)) {
        var idP = document.createElement('p');
        idP.appendChild(document.createTextNode('Ihre Anfrage-ID: '));
        var idS = document.createElement('strong'); idS.textContent = res.id; idP.appendChild(idS);
        done.insertBefore(idP, done.children[1] || null);
      }
      done.hidden = false;
      done.focus();
    }, function (e) {
      btn.disabled = false;
      if (e.kind === 'network') YQ.mailFallback(statusEl, (inquiry ? 'Ihre Anfrage' : 'Ihre Bestellung') + ' konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut oder senden Sie sie direkt per', (inquiry ? 'Anfrage: ' : 'Bestellung: ') + (NAMES[product] || product), message + '\nE-Mail: ' + email + (url ? '\nWebsite: ' + url : ''));
      else statusEl.textContent = 'Fehler: ' + e.message;
    });
  });
})();
