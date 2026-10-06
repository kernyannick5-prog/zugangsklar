/* Kostenloser Website-Check: Formular -> POST /api/check (NDJSON-Fortschritt) -> Ergebnis rendern (report-render.js).
   Vertrag: docs/CHECKER_V3.md. Alle API-Texte nur per textContent. */
(function () {
  'use strict';
  var YQ = window.YQ, el = YQ.el;
  var form = document.getElementById('check');
  if (!form) return;
  var input = document.getElementById('check-url');
  var button = form.querySelector('button[type="submit"]');
  var statusEl = document.getElementById('check-status');
  var resultEl = document.getElementById('check-result');
  var BUTTON_TEXT = button.textContent;
  var currentUrl = '';
  var displayName = '';
  var lastData = null;
  var running = false;
  var FALLBACK = 'Der Check ist gerade nicht erreichbar. Bitte versuchen Sie es später erneut oder bestellen Sie den Website-Report direkt. Sie erhalten ihn in 48 Stunden.';

  // Die vier Phasen des Servers (docs/CHECKER_V3.md §6). Das Label des Servers ersetzt den Standardtext, sobald die Phase beginnt.
  var PHASES = [
    { id: 'fetch', label: 'Website wird abgerufen' },
    { id: 'analyze', label: 'Quelltext wird analysiert' },
    { id: 'extra', label: 'Zusatzprüfungen' },
    { id: 'score', label: 'Ergebnis wird berechnet' }
  ];

  // Fehlercodes (docs/CHECKER_V3.md §5): Titel, Standardtext (falls der Server keinen liefert), Handlungshinweis, Report-Angebot.
  var ERRORS = {
    invalid_url: { title: 'Adresse ungültig', text: 'Die Adresse konnte nicht verarbeitet werden.', todo: 'Geben Sie die Adresse Ihrer Website ein, zum Beispiel beispiel.de.' },
    invalid_scheme: { title: 'Adresse ungültig', text: 'Es sind nur Adressen mit http oder https möglich.', todo: 'Geben Sie die Adresse Ihrer Website ein, zum Beispiel beispiel.de.' },
    blocked: { title: 'Adresse nicht prüfbar', text: 'Diese Adresse kann nicht geprüft werden.', todo: 'Geprüft werden nur öffentlich erreichbare Websites Dritter oder Ihre eigene. Interne Adressen, Adressen mit Zugangsdaten oder besondere Ports sind ausgeschlossen.' },
    dns: { title: 'Domain nicht gefunden', text: 'Zu dieser Adresse gibt es keinen Eintrag im Domain-Namensdienst.', todo: 'Prüfen Sie die Schreibweise (zum Beispiel Tippfehler oder fehlende Endung). Ist die Domain neu, kann es einige Stunden dauern, bis sie erreichbar ist.' },
    ssl: { title: 'Zertifikatsproblem', text: 'Die verschlüsselte Verbindung zur Website ist nicht möglich, weil das Zertifikat ungültig ist.', todo: 'Prüfen Sie das SSL-Zertifikat bei Ihrem Hoster (abgelaufen, falscher Name, unvollständige Kette). Besucher sehen dort vermutlich ebenfalls eine Warnung.' },
    unreachable: { title: 'Website nicht erreichbar', text: 'Es konnte keine Verbindung zur Website aufgebaut werden.', todo: 'Prüfen Sie, ob die Website im Browser erreichbar ist, und versuchen Sie es später erneut.', report: true },
    timeout: { title: 'Zeitüberschreitung', text: 'Die Website hat nicht rechtzeitig geantwortet.', todo: 'Versuchen Sie es später erneut. Antwortet die Seite dauerhaft langsam, ist das selbst ein Hinweis auf ein Problem beim Hoster.', report: true },
    too_many_redirects: { title: 'Zu viele Weiterleitungen', text: 'Die Adresse leitet in einer Schleife oder zu oft weiter.', todo: 'Prüfen Sie die Weiterleitungen (http zu https, www zu ohne www) bei Ihrem Hoster oder im Shop-System.' },
    bad_redirect: { title: 'Ungültige Weiterleitung', text: 'Die Website leitet auf eine ungültige Adresse weiter.', todo: 'Prüfen Sie die Weiterleitungen bei Ihrem Hoster oder im Shop-System.' },
    bot_protection: { ownText: true, title: 'Automatischer Zugriff blockiert', text: 'Die Website wird durch einen Bot-Schutz oder eine Sicherheitsabfrage geschützt (zum Beispiel Cloudflare oder DDoS-Guard). Der Schnellcheck wird dort wie ein automatisches Programm behandelt und abgewiesen. Das ist kein Fehler Ihrer Website.', todo: 'Sie können den Bot-Schutz für die Prüfung kurz lockern oder den Website-Report bestellen: Er prüft mit einem echten Browser und kann in solchen Fällen oft trotzdem ein Ergebnis liefern.', report: true },
    http_404: { title: 'Seite nicht gefunden', text: 'Unter dieser Adresse gibt es keine Seite (Status 404).', todo: 'Prüfen Sie die Adresse. Für den Check genügt die Startseite, zum Beispiel beispiel.de.' },
    http_forbidden: { title: 'Zugriff verweigert', text: 'Die Website verweigert den Zugriff auf die Startseite (Status 401 oder 403).', todo: 'Blockiert ein Bot-Schutz den Schnellcheck, sehen Ihre Besucher davon nichts. Der Website-Report prüft Ihre Seiten mit einem echten Browser.', report: true },
    http_rate_limited: { title: 'Zu viele Anfragen bei der Website', text: 'Die Website hat die Prüfung wegen zu vieler Anfragen abgelehnt (Status 429).', todo: 'Versuchen Sie es in einigen Minuten erneut.' },
    http_server_error: { title: 'Fehler auf der Website', text: 'Die Website meldet einen Serverfehler.', todo: 'Der Fehler liegt auf der Seite der Website, nicht beim Check. Versuchen Sie es später erneut oder wenden Sie sich an Ihren Hoster.' },
    upstream_error: { title: 'Seite nicht abrufbar', text: 'Die Website hat die Anfrage mit einem Fehler beantwortet.', todo: 'Prüfen Sie, ob die Startseite im Browser normal lädt, und versuchen Sie es erneut.' },
    not_html: { title: 'Keine Webseite', text: 'Unter dieser Adresse liegt keine HTML-Seite, sondern zum Beispiel eine Datei oder ein Bild.', todo: 'Geben Sie die Adresse der Startseite ein, nicht die einer Datei.' },
    too_large: { title: 'Seite zu groß', text: 'Die Seite ist für den Schnellcheck zu groß.', todo: 'Im Website-Report können wir große Seiten gesondert prüfen.', report: true },
    parse_failed: { title: 'Seite nicht lesbar', text: 'Der Quelltext der Seite konnte nicht ausgewertet werden.', todo: 'Versuchen Sie es erneut. Besteht das Problem weiter, kann der Website-Report helfen.', report: true },
    rate_limited: { title: 'Limit erreicht', text: 'Sie haben das Limit von 10 Prüfungen pro Stunde erreicht.', todo: '' }
  };

  /* Anzeigename: so, wie der Nutzer ihn eingegeben hat (IDN statt Punycode), ohne Schema und Schrägstrich am Ende. */
  function displayOf(raw) {
    var v = (raw || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    return v.length > 80 ? v.slice(0, 77) + '…' : v;
  }

  function normalize(raw) {
    var v = (raw || '').trim();
    if (!v || v.length > 2000) return null;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try {
      var u = new URL(v);
      if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.hostname.indexOf('.') < 1 || /\s/.test(raw.trim())) return null;
      return u.href;
    } catch (e) { return null; }
  }

  function setStatus(msg, isError) {
    statusEl.textContent = msg || '';
    if (isError) statusEl.classList.add('is-error'); else statusEl.classList.remove('is-error');
  }
  function setBusy(b) {
    running = b;
    resultEl.setAttribute('aria-busy', b ? 'true' : 'false');
    // Kein aria-busy am Status-Bereich: Sprachausgaben unterdrücken sonst genau die Fortschrittsmeldungen der Phasen.
    button.disabled = b;
    button.setAttribute('aria-disabled', b ? 'true' : 'false');
    button.textContent = '';
    if (b) { button.appendChild(el('span', { class: 'spinner', 'aria-hidden': 'true' })); button.appendChild(document.createTextNode('Analyse läuft …')); }
    else button.textContent = BUTTON_TEXT;
  }

  function scrollTo(node) {
    node.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function reportLink() {
    return el('p', { class: 'error-actions' }, el('a', { class: 'btn', href: 'bestellen.html?produkt=report' + (currentUrl ? '&url=' + encodeURIComponent(currentUrl) : '') }, 'Website-Report für ' + ((window.YQ_CATALOG && window.YQ_CATALOG.products.report.amountText) || '149 €').replace(/ €/g, ' €') + ' bestellen'), ' ', el('span', { class: 'hint' }, 'Endpreis, keine Umsatzsteuer (§ 19 UStG)'));
  }

  /* Fehleranzeige im Ergebnisbereich: Titel, Meldung (Server-Text, sonst Standardtext), Hinweis. Fokus auf den Titel. */
  function showError(err) {
    var code = err && err.code, info;
    if (err && err.kind === 'network') {
      info = err.timeout
        ? { title: 'Zeitüberschreitung', text: 'Die Prüfung hat zu lange gedauert und wurde abgebrochen.', todo: 'Versuchen Sie es erneut. Antwortet die Website sehr langsam, kann auch der Website-Report helfen.', report: true }
        : { title: 'Check nicht erreichbar', text: FALLBACK, todo: '', report: true, fallback: true };
    } else {
      info = (code && ERRORS[code]) || { title: 'Prüfung nicht möglich', text: '', todo: '' };
    }
    // Server-Text hat Vorrang (kurz, deutsch, mit Hinweis); eigener Text bei Fallback, Bot-Schutz (ausführlichere Erklärung) oder ohne Servertext.
    var serverText = err && err.message ? String(err.message) : '';
    var message = (info.fallback || info.ownText || !serverText) ? info.text : serverText;
    if (!message) message = 'Die Prüfung konnte nicht durchgeführt werden.';
    resultEl.hidden = false;
    resultEl.textContent = '';
    var title = el('h3', { id: 'check-error-title', tabindex: '-1' }, info.title);
    var box = el('div', { class: 'notice error check-error', role: 'group', 'aria-labelledby': 'check-error-title' }, title, el('p', null, message));
    if (info.todo && !info.fallback) box.appendChild(el('p', null, el('strong', null, 'Was Sie tun können: '), info.todo));
    resultEl.appendChild(box);
    if (info.report) resultEl.appendChild(reportLink());
    setStatus('');
    scrollTo(resultEl);
    title.focus({ preventScroll: true });
  }

  function postLead(email, g, promo) {
    var body = { email: email, url: currentUrl, consent: true, source: 'schnellcheck', hp: g ? g.hp : '', ts: g ? g.ts : undefined, pow: g ? g.pow : undefined };
    // Empfehlung vorn in die Nachricht (Lead-Liste zeigt nur die ersten Zeichen)
    if (lastData && YQ.recommend) { try { body.message = YQ.recommend.recommend(lastData).leadLine.slice(0, 600); } catch (e) { /* Empfehlung ist optional */ } }
    // Werbe-Einwilligung (freiwillig, getrennt) nur im Nachrichtentext; das API-Schema bleibt unverändert
    body.message = (promo ? 'WERBE-EINWILLIGUNG: ja. ' : 'Werbe-Einwilligung: nein. ') + (body.message || '');
    body.message = body.message.slice(0, 700);
    return YQ.postJson('/api/lead', body);
  }

  function render(data) {
    lastData = data;
    resultEl.hidden = false;
    var r = YQ.report.render(resultEl, data, {
      level: 3, headingId: 'result-heading', title: 'Ergebnis für ' + (displayName || displayOf(currentUrl)), url: currentUrl, gate: true, ctas: true, recommend: true, legacyLead: true,
      postLead: postLead, focus: form.getAttribute('data-focus') || null,
      mockNotice: YQ.MOCK ? 'Demo-Daten (mock=1): Dies ist ein Beispielergebnis, kein echter Test.' : null
    });
    var s = r.summary;
    setStatus('Analyse abgeschlossen. ' + (r.score == null ? 'Kein Gesamtwert berechenbar.' : 'Gesamtwert ' + r.score + ' von 100, ' + r.rating.label + '.') + ' ' + s.kritisch + ' kritisch, ' + s.hoch + ' wichtig, ' + s.mittel + ' Verbesserung, ' + s.gering + ' Hinweis.');
    r.heading.focus({ preventScroll: true });
    scrollTo(resultEl);
  }

  /* Fortschrittsanzeige: Liste der Phasen (wartet / läuft / fertig). Nur echte Serverereignisse, kein Prozentwert, kein Zeitgeber. */
  function Progress() {
    var self = this;
    this.title = el('h3', { id: 'check-progress-title', tabindex: '-1' }, 'Ihre Website wird analysiert');
    this.list = el('ol', { class: 'progress-steps', 'aria-labelledby': 'check-progress-title' });
    this.steps = null;
    this.single = null;
    this.node = el('div', { class: 'check-progress' }, this.title, this.list);
    this.setSingle('Analyse läuft …');
    this.announced = '';
    this.announce = function (text) { if (text && text !== self.announced) { self.announced = text; setStatus(text); } };
  }
  Progress.prototype.step = function (label, state) {
    var words = { pending: 'wartet', active: 'läuft', done: 'fertig' };
    return el('li', { class: 'step step-' + state, 'aria-current': state === 'active' ? 'step' : null },
      el('span', { class: 'step-mark', 'aria-hidden': 'true' }, state === 'done' ? '✓' : (state === 'active' ? '●' : '○')),
      el('span', { class: 'step-label' }, label),
      el('span', { class: 'step-state' }, words[state]));
  };
  Progress.prototype.setSingle = function (label) {
    this.list.textContent = '';
    this.single = this.step(label, 'active');
    this.list.appendChild(this.single);
  };
  Progress.prototype.phase = function (id, label) {
    var idx = -1;
    PHASES.forEach(function (p, i) { if (p.id === id) idx = i; });
    if (idx < 0) return; // unbekannte Phase ignorieren
    if (!this.steps) this.steps = PHASES.map(function (p) { return { id: p.id, label: p.label, state: 'pending' }; });
    var steps = this.steps;
    if (typeof label === 'string' && label) steps[idx].label = label;
    steps.forEach(function (s, i) { s.state = i < idx ? 'done' : (i === idx ? 'active' : 'pending'); });
    this.render();
    this.announce(steps[idx].label);
  };
  Progress.prototype.finish = function () {
    if (!this.steps) return;
    this.steps.forEach(function (s) { s.state = 'done'; });
    this.render();
  };
  Progress.prototype.render = function () {
    var self = this;
    this.list.textContent = '';
    this.steps.forEach(function (s) { self.list.appendChild(self.step(s.label, s.state)); });
  };

  // Fortschrittsphasen per NDJSON-Stream (Worker kann das). Aus, solange der Worker im Free-Plan läuft: dort bricht
  // Cloudflare gestreamte Antworten bei großen Seiten wegen des CPU-Limits ab (live gemessen 2026-10-06, spiegel.de,
  // "exceededCpu"), während die normale JSON-Antwort durchläuft. Mit Workers Paid auf true setzen und live testen.
  var STREAM = false;

  function loadMock() {
    return fetch(YQ.MOCK_URL).then(function (r) { if (!r.ok) throw new Error('Mock nicht gefunden'); return r.json(); });
  }

  function run(url) {
    var progress = new Progress();
    resultEl.hidden = false;
    resultEl.textContent = '';
    resultEl.appendChild(progress.node);
    setBusy(true);
    setStatus('');
    scrollTo(resultEl);
    progress.title.focus({ preventScroll: true });
    var request;
    if (YQ.MOCK) {
      progress.setSingle('Demo-Daten werden geladen');
      request = loadMock();
    } else if (!STREAM) {
      // Ohne Streaming: ein ehrlicher Schritt mit dem, was tatsächlich passiert (keine erfundenen Zwischenstände)
      progress.setSingle('Startseite wird abgerufen und in acht Bereichen geprüft, dazu robots.txt, Sitemap und Stichproben von Links und Bildern');
      request = YQ.postJson('/api/check', { url: url }, { timeout: 60000 });
    } else {
      request = YQ.postNdjson('/api/check', { url: url }, {
        timeout: 60000,
        onEvent: function (ev) { if (ev && ev.type === 'phase') progress.phase(ev.phase, ev.label); }
      });
    }
    request.then(function (data) {
      progress.finish();
      setBusy(false);
      try { render(data); } catch (err) { showError({ kind: 'network' }); } // Darstellungsfehler nicht als hängende Anzeige enden lassen
    }, function (e) {
      setBusy(false);
      showError(e || {});
    });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (running) return;
    var raw = input.value;
    var url = normalize(raw);
    if (!url) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'check-hint check-status check-terms');
      setStatus(raw.indexOf('@') !== -1 && raw.indexOf('/') === -1
        ? 'Das sieht nach einer E-Mail-Adresse aus. Bitte geben Sie die Adresse Ihrer Website ein, zum Beispiel beispiel.de.'
        : 'Bitte geben Sie eine gültige Website-Adresse ein, zum Beispiel beispiel.de oder https://www.beispiel.de.', true);
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    input.setAttribute('aria-describedby', 'check-hint check-terms');
    currentUrl = url;
    displayName = displayOf(raw);
    run(url);
  });
})();
