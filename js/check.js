/* Kostenloser Website-Check: Formular -> POST /api/check -> Ergebnis rendern (report-render.js). Alle API-Texte nur per textContent. */
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
  var FALLBACK = 'Der Check ist gerade nicht erreichbar. Bitte versuchen Sie es später erneut oder bestellen Sie den Website-Report direkt. Sie erhalten ihn in 48 Stunden.';

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
    else button.textContent = 'Website prüfen';
  }

  function showError(msg, unreachable) {
    resultEl.hidden = false;
    resultEl.textContent = '';
    resultEl.appendChild(el('div', { class: 'notice error' }, el('p', null, el('strong', null, unreachable ? 'Nicht erreichbar. ' : 'Prüfung nicht möglich. '), msg)));
    if (unreachable) resultEl.appendChild(el('p', null, el('a', { class: 'btn', href: 'bestellen.html?produkt=report' + (currentUrl ? '&url=' + encodeURIComponent(currentUrl) : '') }, 'Website-Report für 149 € bestellen'), ' ', el('span', { class: 'hint' }, 'netto zzgl. MwSt.')));
    setStatus(unreachable ? FALLBACK : 'Fehler: ' + msg);
  }

  function postLead(email) {
    return ZK.postJson('/api/lead', { email: email, url: currentUrl, consent: true, source: 'schnellcheck' });
  }

  function render(data) {
    resultEl.hidden = false;
    var r = ZK.report.render(resultEl, data, {
      level: 3, headingId: 'result-heading', url: currentUrl, gate: true, ctas: true, legacyLead: true,
      postLead: postLead, focus: form.getAttribute('data-focus') || null,
      mockNotice: ZK.MOCK ? 'Demo-Daten (mock=1): Dies ist ein Beispielergebnis, kein echter Test.' : null
    });
    var s = r.summary;
    setStatus('Prüfung abgeschlossen. Website-Score ' + r.score + ' von 100. ' + s.kritisch + ' kritisch, ' + s.hoch + ' hoch, ' + s.mittel + ' mittel, ' + s.gering + ' gering.');
    r.heading.focus();
    resultEl.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var url = normalize(input.value);
    if (!url) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', 'check-hint check-status');
      showError('Bitte geben Sie eine gültige Adresse ein, zum Beispiel www.ihre-website.de.', false);
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
