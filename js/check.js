/* Kostenloser Schnellcheck: Formular -> POST /api/check -> Ergebnis rendern. Alle API-Texte nur per textContent. */
(function () {
  'use strict';
  var ZK = window.ZK, el = ZK.el;
  var form = document.getElementById('check');
  if (!form) return;
  var input = document.getElementById('check-url');
  var button = form.querySelector('button[type="submit"]');
  var statusEl = document.getElementById('check-status');
  var resultEl = document.getElementById('check-result');
  var currentUrl = '';

  var SEV_LABEL = { kritisch: 'Kritisch', hoch: 'Hoch', mittel: 'Mittel' };
  var SEV_ORDER = { kritisch: 0, hoch: 1, mittel: 2 };
  var FALLBACK = 'Der Schnellcheck ist gerade nicht erreichbar. Bestellen Sie den Report direkt – Sie erhalten ihn in 48 Stunden.';

  function normalize(raw) {
    var v = (raw || '').trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
    try {
      var u = new URL(v);
      if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.hostname.indexOf('.') < 1 || /\s/.test(raw.trim())) return null;
      return u.href;
    } catch (e) { return null; }
  }

  function setStatus(msg) { statusEl.textContent = msg || ''; }
  function setBusy(b) {
    resultEl.setAttribute('aria-busy', b ? 'true' : 'false');
    statusEl.setAttribute('aria-busy', b ? 'true' : 'false');
    button.disabled = b;
    button.setAttribute('aria-disabled', b ? 'true' : 'false');
    button.textContent = '';
    if (b) { button.appendChild(el('span', { class: 'spinner', 'aria-hidden': 'true' })); button.appendChild(document.createTextNode('Prüfung läuft …')); }
    else button.textContent = 'Kostenlos prüfen';
  }

  function showError(msg, unreachable) {
    resultEl.hidden = false;
    resultEl.textContent = '';
    var box = el('div', { class: 'notice error' }, el('p', null, el('strong', null, unreachable ? 'Nicht erreichbar. ' : 'Prüfung nicht möglich. '), msg));
    resultEl.appendChild(box);
    if (unreachable) resultEl.appendChild(orderCta(true));
    setStatus(unreachable ? FALLBACK : 'Fehler: ' + msg);
  }

  function orderCta(compact) {
    var href = 'bestellen.html?produkt=report' + (currentUrl ? '&url=' + encodeURIComponent(currentUrl) : '');
    return el('p', null, el('a', { class: 'btn', href: href }, compact ? 'BFSG-Report für 149 € bestellen' : 'Vollständigen BFSG-Report für 149 € bestellen'), ' ', el('span', { class: 'hint' }, 'netto zzgl. MwSt. Lieferung als PDF in 48 Stunden.'));
  }

  function scoreClass(s) { return s >= 80 ? 's-ok' : (s >= 50 ? 's-warn' : 's-crit'); }

  function scoreRing(score) {
    var C = 2 * Math.PI * 52;
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    function circle(cls) {
      var c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', '60'); c.setAttribute('cy', '60'); c.setAttribute('r', '52');
      c.setAttribute('fill', 'none'); c.setAttribute('stroke-width', '12'); c.setAttribute('class', cls);
      return c;
    }
    var bar = circle('bar ' + scoreClass(score));
    bar.setAttribute('stroke-linecap', 'round');
    bar.setAttribute('stroke-dasharray', String(C));
    bar.setAttribute('stroke-dashoffset', String(C));
    svg.appendChild(circle('track')); svg.appendChild(bar);
    requestAnimationFrame(function () { bar.setAttribute('stroke-dashoffset', String(C * (1 - Math.max(0, Math.min(100, score)) / 100))); });
    return el('div', { class: 'score-ring' }, svg, el('div', { class: 'score-num' }, el('span', null, String(score), el('small', null, 'von 100'))));
  }

  function count(label, n, cls) {
    return el('li', null, el('strong', null, String(n)), el('span', { class: 'badge badge-' + cls }, label));
  }

  function issueItem(issue) {
    var sev = SEV_LABEL[issue.severity] ? issue.severity : 'mittel';
    var art = el('article', { class: 'finding sev-' + sev },
      el('div', { class: 'finding-meta' },
        el('span', { class: 'badge badge-' + sev }, 'Schwere: ' + SEV_LABEL[sev]),
        issue.count != null ? el('span', null, issue.count + '× gefunden') : null,
        issue.wcag ? el('span', null, 'WCAG ' + issue.wcag) : null),
      el('h4', null, String(issue.title || issue.id || 'Befund')),
      issue.description ? el('p', null, String(issue.description)) : null);
    var ex = Array.isArray(issue.examples) ? issue.examples.filter(function (x) { return typeof x === 'string'; }) : [];
    if (ex.length) {
      var list = el('ul', { class: 'example-list' });
      ex.forEach(function (x) { list.appendChild(el('li', null, el('code', null, x))); });
      art.appendChild(el('details', { class: 'disclosure' }, el('summary', null, 'Beispiele aus dem Quelltext (' + ex.length + ')'), list));
    }
    return el('li', null, art);
  }

  function leadForm() {
    var emailId = 'lead-email', consentId = 'lead-consent', msgId = 'lead-status';
    var f = el('form', { class: 'lead-form', id: 'lead-form' },
      el('div', { class: 'field' }, el('label', { for: emailId }, 'E-Mail-Adresse'), el('input', { type: 'email', id: emailId, name: 'email', autocomplete: 'email', required: true, placeholder: 'name@firma.de' })),
      el('div', { class: 'field' }, el('label', { class: 'check-line', for: consentId }, el('input', { type: 'checkbox', id: consentId, name: 'consent', required: true }),
        el('span', null, 'Ich willige ein, dass Zugangsklar mir das Ergebnis per E-Mail sendet und meine Daten dafür speichert. Details in der ', el('a', { href: 'datenschutz.html' }, 'Datenschutzerklärung'), '. Widerruf jederzeit möglich.'))),
      el('button', { type: 'submit', class: 'btn btn-secondary' }, 'Ergebnis per E-Mail erhalten'),
      el('p', { id: msgId, class: 'status-msg', role: 'status', 'aria-live': 'polite' }));
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = f.elements.email.value.trim();
      var btn = f.querySelector('button');
      var msg = f.querySelector('#' + msgId);
      btn.disabled = true; msg.textContent = 'Wird gesendet …';
      ZK.postJson('/api/lead', { email: email, url: currentUrl, consent: true, source: 'schnellcheck' }).then(function () {
        msg.textContent = 'Danke. Wir senden Ihnen das Ergebnis per E-Mail.';
        f.querySelectorAll('input').forEach(function (i) { i.disabled = true; });
      }, function (e) {
        btn.disabled = false;
        msg.textContent = e.kind === 'network' ? 'Der Versand ist gerade nicht erreichbar. Bitte versuchen Sie es später erneut oder schreiben Sie uns über die Kontaktseite.' : 'Fehler: ' + e.message;
      });
    });
    return f;
  }

  function render(data) {
    resultEl.textContent = '';
    resultEl.hidden = false;
    var s = data.summary || {};
    var score = Math.round(Number(data.score) || 0);
    var issues = (Array.isArray(data.issues) ? data.issues : []).slice().sort(function (a, b) { return (SEV_ORDER[a.severity] != null ? SEV_ORDER[a.severity] : 9) - (SEV_ORDER[b.severity] != null ? SEV_ORDER[b.severity] : 9); });
    var passed = Array.isArray(data.passed) ? data.passed : [];

    var heading = el('h3', { id: 'result-heading', tabindex: '-1' }, 'Ergebnis für ' + String(data.finalUrl || data.url || currentUrl));
    resultEl.appendChild(heading);
    if (ZK.MOCK) resultEl.appendChild(el('p', { class: 'notice info' }, 'Demo-Daten (mock=1): Dies ist ein Beispielergebnis, kein echter Test.'));
    var meta = [];
    if (data.system && data.system !== 'unbekannt') meta.push('Erkanntes Shopsystem: ' + data.system.charAt(0).toUpperCase() + data.system.slice(1));
    if (data.checkedAt) { var d = new Date(data.checkedAt); if (!isNaN(d)) meta.push('Geprüft am ' + d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })); }
    if (meta.length) resultEl.appendChild(el('p', { class: 'muted' }, meta.join(' · ')));

    resultEl.appendChild(el('div', { class: 'result-head' },
      scoreRing(score),
      el('div', null,
        el('p', { style: 'margin-bottom:.6rem;font-weight:650' }, 'Score ' + score + ' von 100'),
        el('ul', { class: 'counts', 'aria-label': 'Zusammenfassung' },
          count('Kritisch', s.kritisch || 0, 'kritisch'), count('Hoch', s.hoch || 0, 'hoch'), count('Mittel', s.mittel || 0, 'mittel'), count('Bestanden', s.bestanden != null ? s.bestanden : passed.length, 'bestanden')))));

    if (data.overlayDetected) {
      resultEl.appendChild(el('div', { class: 'notice warn' }, el('p', null, el('strong', null, 'Overlay-Widget erkannt: ' + String(data.overlayDetected) + '. '), 'Overlays beheben die Barrieren im Quelltext nicht und gelten nicht als BFSG-Lösung. ', el('a', { href: 'ratgeber/overlay-widgets-bfsg.html' }, 'Warum Overlays nicht reichen'), '.')));
    }

    if (issues.length) {
      resultEl.appendChild(el('h4', null, 'Befunde (' + issues.length + ')'));
      var ul = el('ul', { class: 'issue-list' });
      issues.forEach(function (i) { ul.appendChild(issueItem(i)); });
      resultEl.appendChild(ul);
    } else {
      resultEl.appendChild(el('div', { class: 'notice success' }, el('p', null, 'Der automatische Schnellcheck hat auf der Startseite keine Befunde gefunden. Das ist noch keine Konformität: Tastaturbedienung, Checkout und Verständlichkeit prüft nur der vollständige Report.')));
    }

    if (passed.length) {
      var pl = el('ul', null);
      passed.forEach(function (p) { pl.appendChild(el('li', null, String(p.title || p.id))); });
      resultEl.appendChild(el('details', { class: 'disclosure' }, el('summary', null, 'Bestanden (' + passed.length + ' Prüfungen)'), pl));
    }

    if (data.note) resultEl.appendChild(el('p', { class: 'hint', style: 'margin-top:1.25rem' }, String(data.note)));

    var box = el('div', { class: 'lead-box' },
      el('h3', null, 'Alle Befunde beheben – mit Anleitung'),
      el('p', null, 'Der Report prüft bis zu 10 Seiten (Kategorie, Produkt, Warenkorb, Rechtliches), nennt je Befund die Stelle und den Code-Fix für Ihr Shopsystem und enthält eine Checkliste für die manuellen Prüfpunkte.'),
      orderCta(false),
      el('h4', { style: 'margin-top:1.5rem' }, 'Oder erst einmal das Ergebnis per E-Mail erhalten'),
      leadForm());
    resultEl.appendChild(box);

    var crit = s.kritisch || 0, hoch = s.hoch || 0, mit = s.mittel || 0;
    setStatus('Prüfung abgeschlossen. Score ' + score + ' von 100. ' + crit + ' kritisch, ' + hoch + ' hoch, ' + mit + ' mittel.');
    heading.focus();
    resultEl.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var url = normalize(input.value);
    if (!url) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'check-hint check-status');
      showError('Bitte geben Sie eine gültige Shop-Adresse ein, zum Beispiel www.ihr-shop.de.', false);
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    currentUrl = url;
    resultEl.hidden = true;
    setBusy(true);
    setStatus('Die Prüfung läuft. Das dauert etwa 30 Sekunden.');
    var request = ZK.MOCK
      ? fetch(ZK.MOCK_URL).then(function (r) { if (!r.ok) throw new Error('Mock nicht gefunden'); return r.json(); }).then(function (d) { return new Promise(function (res) { setTimeout(function () { res(d); }, 900); }); })
      : ZK.postJson('/api/check', { url: url });
    request.then(function (data) { setBusy(false); render(data); }, function (e) {
      setBusy(false);
      if (e.kind === 'api') showError(e.message, false);
      else showError(FALLBACK, true);
    });
  });
})();
