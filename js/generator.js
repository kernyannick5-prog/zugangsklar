/* Generator für die Barrierefreiheitserklärung. Läuft vollständig im Browser, nichts wird gesendet. */
(function () {
  'use strict';
  var ZK = window.ZK, el = ZK.el;
  var form = document.getElementById('gen-form');
  if (!form) return;
  var out = document.getElementById('gen-output');
  var preview = document.getElementById('gen-preview');
  var actions = document.getElementById('gen-actions');
  var statusEl = document.getElementById('gen-status');
  var sections = [];

  var d = form.elements.datum;
  if (!d.value) d.value = new Date().toISOString().slice(0, 10);

  var STAND = {
    vollstaendig: 'Unsere Dienstleistung ist mit den Barrierefreiheitsanforderungen des Barrierefreiheitsstärkungsgesetzes (BFSG) vollständig vereinbar.',
    teilweise: 'Unsere Dienstleistung ist mit den Barrierefreiheitsanforderungen des Barrierefreiheitsstärkungsgesetzes (BFSG) teilweise vereinbar. Die nicht vereinbaren Teile sind unter „Bekannte Einschränkungen“ aufgeführt.',
    nicht: 'Unsere Dienstleistung ist mit den Barrierefreiheitsanforderungen des Barrierefreiheitsstärkungsgesetzes (BFSG) derzeit nicht vereinbar. Wir arbeiten an der Umsetzung. Die bekannten Einschränkungen sind unter „Bekannte Einschränkungen“ aufgeführt.'
  };

  function fmtDate(iso) {
    var p = iso.split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : iso;
  }
  function lines(t) { return t.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }

  function build() {
    var f = form.elements;
    var firma = f.firma.value.trim(), url = f.website.value.trim(), email = f.email.value.trim(), tel = f.telefon.value.trim();
    var tage = parseInt(f.tage.value, 10) || 10;
    var s = [];
    s.push({ h: 'Erklärung zur Barrierefreiheit', p: ['Diese Erklärung gilt für ' + url + ' (nachfolgend „unsere Dienstleistung“), betrieben von ' + firma + '. Stand: ' + fmtDate(f.datum.value) + '.'] });
    s.push({ h: '1. Allgemeine Beschreibung der Dienstleistung', p: lines(f.beschreibung.value) });
    s.push({ h: '2. Erläuterungen: Wie die Dienstleistung die Barrierefreiheitsanforderungen erfüllt', p: lines(f.erlaeuterung.value) });
    s.push({ h: '3. Stand der Vereinbarkeit mit den Anforderungen', p: [STAND[f.stand.value]] });
    var lim = lines(f.einschraenkungen.value);
    s.push({ h: '4. Bekannte Einschränkungen', p: lim.length ? lim : ['Uns sind zum Zeitpunkt dieser Erklärung keine Einschränkungen bekannt.'], list: lim.length > 1 });
    var fb = ['Haben Sie Barrieren bemerkt oder benötigen Sie Inhalte in einer anderen Form? Schreiben Sie uns:', firma, 'E-Mail: ' + email];
    if (tel) fb.push('Telefon: ' + tel);
    fb.push('Wir antworten in der Regel innerhalb von ' + tage + ' Werktagen.');
    s.push({ h: '5. Feedback und Kontakt', p: fb });
    s.push({ h: '6. Zuständige Marktüberwachungsbehörde', p: ['Wenn Sie mit unserer Antwort nicht zufrieden sind oder keine Antwort erhalten, können Sie sich an die zuständige Marktüberwachungsbehörde wenden:', 'Marktüberwachungsstelle der Länder für die Barrierefreiheit von Produkten und Dienstleistungen (MLBF), Magdeburg', 'Aktuelle Anschrift und Kontaktdaten: www.mlbf-barrierefrei.de'] });
    s.push({ h: '7. Datum der Erklärung', p: [fmtDate(f.datum.value)] });
    return s;
  }

  function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  function toText(s) {
    return s.map(function (x) { return x.h + '\n' + x.p.join('\n'); }).join('\n\n') + '\n';
  }
  function toHtml(s) {
    return s.map(function (x, i) {
      var h = i === 0 ? 'h1' : 'h2';
      var body = x.list ? '<ul>\n' + x.p.map(function (l) { return '  <li>' + esc(l) + '</li>'; }).join('\n') + '\n</ul>' : x.p.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('\n');
      return '<' + h + '>' + esc(x.h) + '</' + h + '>\n' + body;
    }).join('\n') + '\n';
  }

  function renderPreview(s) {
    preview.textContent = '';
    s.forEach(function (x, i) {
      preview.appendChild(el(i === 0 ? 'h3' : 'h4', null, x.h));
      if (x.list) { var ul = el('ul'); x.p.forEach(function (l) { ul.appendChild(el('li', null, l)); }); preview.appendChild(ul); }
      else x.p.forEach(function (l) { preview.appendChild(el('p', null, l)); });
    });
  }

  function copy(text, okMsg) {
    function fallback() {
      var ta = el('textarea', { 'aria-hidden': 'true', tabindex: '-1', style: 'position:fixed;left:-9999px' });
      ta.value = text; document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      statusEl.textContent = ok ? okMsg : 'Kopieren nicht möglich. Bitte markieren Sie den Text in der Vorschau und kopieren Sie ihn manuell.';
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { statusEl.textContent = okMsg; }, fallback);
    } else fallback();
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    sections = build();
    renderPreview(sections);
    out.hidden = false;
    actions.hidden = false;
    statusEl.textContent = 'Erklärung erzeugt. Vorschau und Kopier-Schaltflächen stehen unter dem Formular.';
    var h = document.getElementById('gen-result-heading');
    h.focus();
  });
  document.getElementById('copy-text').addEventListener('click', function () { copy(toText(sections), 'Text kopiert.'); });
  document.getElementById('copy-html').addEventListener('click', function () { copy(toHtml(sections), 'HTML kopiert.'); });
})();
