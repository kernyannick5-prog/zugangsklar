/* Bestellformular: Lead senden, dann Zahlungslink (falls konfiguriert) oder Rechnungs-Fallback. */
(function () {
  'use strict';
  var YQ = window.YQ;
  var form = document.getElementById('order-form');
  if (!form) return;
  var statusEl = document.getElementById('order-status');
  if (YQ.pow) YQ.pow.watch(form); // Rechenaufgabe beim ersten Fokus vorab lösen (Spamschutz, siehe js/config.js)
  var done = document.getElementById('order-done');
  // Fallback-Namen (Stand 2026-10-03). Maßgeblich ist window.YQ_CATALOG (js/catalog.js, generiert aus tools/site-build/catalog.mjs).
  var NAMES = {
    'website-basic': /*YQ:orderLabel:website-basic*/'Website Basic (249 €, Einführungspreis bis 31.12.2026 (danach 399 €), einmalig, unverbindliche Anfrage, Angebot vorab)'/*YQ*/, 'website-business': 'Website Business (ab 690 €, einmalig, unverbindliche Anfrage, individuelles Angebot vorab)', 'website-pflege': 'Yanqiva Pflege (39 €/Monat, Mindestlaufzeit 12 Monate)', 'website-premium': 'Website Premium (individuelles Angebot, Orientierung ab 1.690 €, einmalig, unverbindliche Anfrage)',
    report: 'Website-Report (99 €, einmalig)', monitoring: 'Monitoring (29 € pro Monat)',
    'einzel-fix': 'Einzel-Fix (99 €, einmalig, ein konkretes Problem)', 'fix-paket': 'Fix-Paket (ab 299 €, einmalig)'
  };
  // Prüfbereiche des Checkers (Fallback, maßgeblich ist YQ_CATALOG.categories)
  var CATS = (window.YQ_CATALOG && window.YQ_CATALOG.categories) || [];
  function catTitle(id) { for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i].title; return id; }
  if (window.YQ_CATALOG && window.YQ_CATALOG.products) {
    Object.keys(window.YQ_CATALOG.products).forEach(function (id) { NAMES[id] = window.YQ_CATALOG.products[id].orderLabel; });
  }

  var MAX_MESSAGE = 3500; // entspricht MESSAGE_MAX von POST /api/lead (worker/src/lead.js): Projektbeschreibung + Hinweise je 1500 passen zusammen
  var q = new URLSearchParams(window.location.search);
  var pre = q.get('produkt');
  // Alte Links (entfallene Angebote) und der gemeinsame Einzel-Fix: auf bestehende Produkte abbilden.
  // Fallback, maßgeblich ist YQ_CATALOG.redirects (generiert aus tools/site-build/catalog.mjs: LEGACY_PRODUCTS).
  var REDIRECTS = (window.YQ_CATALOG && window.YQ_CATALOG.redirects) || { business: 'monitoring', agentur_plus: 'monitoring', agentur: 'monitoring', 'fix-a11y': 'fix-paket', 'fix-google-fonts': 'fix-paket', 'fix-security-header': 'fix-paket', 'fix-erklaerung': 'fix-paket', 'fix-individuell': 'fix-paket' };
  var REDIRECT_CATS = (window.YQ_CATALOG && window.YQ_CATALOG.redirectCategories) || { 'fix-google-fonts': 'privacy', 'fix-security-header': 'security', 'fix-erklaerung': 'accessibility' };
  var preCategory = (q.get('kategorie') || '').replace(/[^a-z]/g, '');
  var preAreas = (q.get('bereiche') || '').split(',').map(function (x) { return x.replace(/[^a-z]/g, ''); }).filter(Boolean);
  var redirectNote = document.getElementById('order-redirect');
  if (pre && Object.prototype.hasOwnProperty.call(REDIRECTS, pre)) {
    var target = REDIRECTS[pre];
    if (REDIRECT_CATS[pre] && !preCategory) preCategory = REDIRECT_CATS[pre];
    if (redirectNote) {
      redirectNote.textContent = target === 'einzel-fix'
        ? 'Das Angebot, über das Sie hierher gekommen sind, gibt es nicht mehr. Wir haben „Einzel-Fix“ (ein konkretes Problem, 99 €) für Sie vorausgewählt' + (preCategory ? ', mit dem Bereich „' + catTitle(preCategory) + '“' : '') + '. Sie können die Auswahl unten ändern.'
        : target === 'fix-paket'
          ? 'Das Angebot, über das Sie hierher gekommen sind, gibt es nicht mehr als eigene Leistung. Es ist jetzt Bestandteil des Fix-Pakets, das wir für Sie vorausgewählt haben. Geht es nur um ein einzelnes, konkretes Problem, genügt der Einzel-Fix. Eine Prüfung können Sie vorab mit dem kostenlosen Website-Check durchführen.'
          : 'Das Angebot, über das Sie hierher gekommen sind, gibt es nicht mehr. Wir haben „Monitoring“ (1 Website) für Sie vorausgewählt. Haben Sie mehrere Websites, schreiben Sie uns bitte über das Kontaktformular.';
      redirectNote.hidden = false;
    }
    pre = target;
  }
  // Unbekannte Werte (?produkt=xyz) ignorieren: sonst wäre kein Produkt gewählt und das Absenden würde fehlschlagen.
  var preRadio = pre ? Array.prototype.filter.call(form.querySelectorAll('input[name="produkt"]'), function (r) { return r.value === pre; })[0] : null;
  if (preRadio) {
    Array.prototype.forEach.call(form.querySelectorAll('input[name="produkt"]'), function (r) { r.checked = r === preRadio; });
  }
  if (!form.querySelector('input[name="produkt"]:checked')) {
    var firstRadio = form.querySelector('input[name="produkt"][value="einzel-fix"]') || form.querySelector('input[name="produkt"]');
    if (firstRadio) firstRadio.checked = true;
  }
  // Kategorie (Einzel-Fix) bzw. Bereiche (Fix-Paket) aus dem Scan-Ergebnis vorauswählen; unbekannte Werte werden ignoriert
  Array.prototype.forEach.call(form.querySelectorAll('input[name="kategorie"]'), function (r) { r.checked = !!preCategory && r.value === preCategory; });
  Array.prototype.forEach.call(form.querySelectorAll('input[name="bereiche"]'), function (c) { c.checked = preAreas.indexOf(c.value) !== -1; });
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
  function isInquiry(v) { return /^(website-(basic|business|premium|pflege)|einzel-fix|fix-.+)$/.test(v || ''); }
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
    var catField = document.getElementById('o-cat-field'), areaField = document.getElementById('o-bereiche-field');
    var isEinzel = !!sel && sel.value === 'einzel-fix';
    if (catField) catField.hidden = !isEinzel;
    if (areaField) areaField.hidden = !(sel && sel.value === 'fix-paket');
    var problemEl = document.getElementById('o-problem');
    if (problemEl) problemEl.required = isEinzel;   // Einzel-Fix = ein konkretes Problem: Beschreibung ist Pflicht, der Bereich optional
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
    var catEl = form.querySelector('input[name="kategorie"]:checked');
    var category = '';
    if (product === 'einzel-fix') category = catEl ? catEl.value : '';
    else if (product === 'fix-paket') category = Array.prototype.map.call(form.querySelectorAll('input[name="bereiche"]:checked'), function (c) { return c.value; }).join(',');
    var categoryText = category ? category.split(',').map(catTitle).join(', ') + ' [' + category + ']' : '';
    var email = f.email.value.trim();
    var url = f.url.value.trim();
    var nu = YQ.normalizeUrl(url);
    if (nu === null) {
      statusEl.textContent = 'Bitte geben Sie eine gültige Website-Adresse ein, zum Beispiel beispiel.de.';
      f.url.focus();
      return;
    }
    url = nu;
    var isProject = isNewWebsite(product);
    var inquiry = isInquiry(product);
    var message = (prestart() ? 'VOR TÄTIGKEITSBEGINN (' + YQ.START_DATE + ') EINGEGANGEN – unverbindliche Anfrage\n' : '') + (isProject ? 'PROJEKTANFRAGE (unverbindlich, individuelles Angebot)\n' : '') + 'Produkt: ' + (NAMES[product] || product) + ' [' + product + ']' + (categoryText ? '\n' + (product === 'einzel-fix' ? 'Bereich: ' : 'Betroffene Bereiche: ') + categoryText : '') + (product === 'einzel-fix' && f.problem ? '\nProblem: ' + (f.problem.value.trim() || '-') : '') + '\nFirma: ' + f.firma.value.trim() + (isProject ? '\nProjektbeschreibung: ' + ((f.projekt && f.projekt.value.trim()) || '-') : '') + '\nHinweise: ' + (f.hinweise.value.trim() || '-') + '\nUnternehmer (§ 14 BGB) bestätigt und AGB akzeptiert: ' + (f.consent && f.consent.checked ? 'ja' : 'nein')
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
    if (category) fields.category = category;
    if (isProject && f.projekt && f.projekt.value.trim()) fields.project = f.projekt.value.trim();
    if (f.hinweise.value.trim()) fields.notes = f.hinweise.value.trim();
    var payload = { hp: g.hp, ts: g.ts, email: email, url: url, consent: true, source: 'bestellung', message: message, fields: fields };
    (YQ.pow ? YQ.pow.withPow(form, payload) : Promise.resolve(payload)).then(function (body) {
      return YQ.postJson('/api/lead', body, { timeout: 20000 });
    }).then(function (res) {
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
      if (!document.activeElement || document.activeElement === document.body) btn.focus(); // Tastaturposition behalten
      if (e.kind === 'network') YQ.mailFallback(statusEl, (inquiry ? 'Ihre Anfrage' : 'Ihre Bestellung') + ' konnte gerade nicht gesendet werden. Bitte versuchen Sie es später erneut oder senden Sie sie direkt per', (inquiry ? 'Anfrage: ' : 'Bestellung: ') + (NAMES[product] || product), message + '\nE-Mail: ' + email + (url ? '\nWebsite: ' + url : ''));
      else statusEl.textContent = 'Fehler: ' + e.message;
    });
  });
})();
