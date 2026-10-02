/* Monitoring-Dashboard: ?t=<token> -> GET /api/portfolio, Detail per #site=<id>. Mock: ?mock=1. Alle API-Texte nur per textContent. */
(function () {
  'use strict';
  var YQ = window.YQ, el = YQ.el, R = YQ.report;
  var root = document.getElementById('dash-root');
  if (!root) return;
  var h1 = document.getElementById('dash-h1');
  var statusEl = document.getElementById('dash-status');
  var params = new URLSearchParams(window.location.search);
  var token = params.get('t') || '';
  var portfolio = null;
  var DEFAULT_TITLE = document.title;

  var PLAN = { monitoring: 'Monitoring', business: 'Business', agentur: 'Agentur', agentur_plus: 'Agentur Plus', free: 'Free' };
  var ALERT = { neues_kritisches_problem: 'Kritisch', neues_problem: 'Neu', behoben: 'Behoben', nicht_erreichbar: 'Fehler', score_drop: 'Score gesunken' };

  function str(v) { return v == null ? '' : String(v); }
  function fmtDate(v, time) {
    var d = new Date(v); if (!v || isNaN(d)) return '–';
    return d.toLocaleString('de-DE', time ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' });
  }
  function setStatus(m) { statusEl.textContent = m || ''; }
  function done() { root.setAttribute('aria-busy', 'false'); }

  /* ---------- White-Label ---------- */
  function lin(c) { c = c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function parseHex(v) {
    var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(str(v).trim());
    if (!m) return null;
    var x = m[1]; if (x.length === 3) x = x.split('').map(function (ch) { return ch + ch; }).join('');
    return [parseInt(x.substr(0, 2), 16), parseInt(x.substr(2, 2), 16), parseInt(x.substr(4, 2), 16)];
  }
  function contrastWhite(rgb) { var L = 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]); return 1.05 / (L + 0.05); }
  function contrastRgb(a, b) { function L(c) { return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]); } var x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mixWhite(rgb, t) { return rgb.map(function (n) { return n * t + 255 * (1 - t); }); }
  function hex(rgb) { return '#' + rgb.map(function (n) { return ('0' + Math.round(n).toString(16)).slice(-2); }).join(''); }
  function applyBrand(brand) {
    if (!brand || !brand.name) return;
    var old = document.getElementById('dash-brand');
    var node = el('span', { class: 'logo logo-custom', id: 'dash-brand' });
    var logo = str(brand.logoUrl);
    if (/^https:\/\//i.test(logo)) {
      var img = el('img', { src: logo, alt: '', class: 'brand-logo', height: '32', referrerpolicy: 'no-referrer', loading: 'lazy' });
      img.addEventListener('error', function () { img.remove(); });
      node.appendChild(img);
    }
    node.appendChild(el('span', { class: 'logo-word' }, str(brand.name)));
    old.parentNode.replaceChild(node, old);
    var p = document.getElementById('powered-by'); if (p) p.hidden = true;
    var rgb = parseHex(brand.color);
    var soft = rgb ? mixWhite(rgb, 0.08) : null;
    /* Markenfarbe nur uebernehmen, wenn Text in Markenfarbe auf Weiss UND auf der getoenten Flaeche >= 4,5:1 hat */
    if (rgb && contrastWhite(rgb) >= 4.5 && contrastRgb(rgb, soft) >= 4.5) {
      var s = document.documentElement.style;
      s.setProperty('--primary', hex(rgb));
      s.setProperty('--primary-hover', hex(rgb.map(function (n) { return n * 0.8; })));
      s.setProperty('--primary-soft', hex(soft));
    }
    document.title = 'Dashboard | ' + str(brand.name);
  }

  /* ---------- Daten ---------- */
  function fetchJson(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error('Mock nicht gefunden'); return r.json(); }); }
  function loadPortfolio() {
    if (YQ.MOCK) return fetchJson(YQ.mockUrl('portfolio-example.json'));
    return YQ.getJson('/api/portfolio?t=' + encodeURIComponent(token));
  }
  function loadSite(id) {
    if (YQ.MOCK) {
      return fetchJson(YQ.mockUrl('site-example.json')).then(function (ex) {
        var s = (portfolio.sites || []).filter(function (x) { return x.id === id; })[0];
        if (!s) { var e = new Error('nf'); e.kind = 'auth'; throw e; }
        var out = {}; Object.keys(ex).forEach(function (k) { out[k] = ex[k]; });
        ['id', 'url', 'label', 'score', 'history', 'diff', 'lastRunAt', 'nextRunAt', 'lastError', 'categories', 'summary'].forEach(function (k) { out[k] = s[k]; });
        if (s.id !== ex.id) out.latest = null; // Demo: Befundliste nur für die erste Website
        return out;
      });
    }
    return YQ.getJson('/api/portfolio/site?t=' + encodeURIComponent(token) + '&id=' + encodeURIComponent(id));
  }

  function cats(site) {
    var c = site.categories;
    if (Array.isArray(c)) return c.map(function (x) { return { id: x.id, title: str(x.title) || R.CAT_TITLES[x.id] || str(x.id), score: R.clampScore(x.score) }; });
    if (c && typeof c === 'object') return R.CAT_ORDER.filter(function (k) { return c[k] != null; }).concat(Object.keys(c).filter(function (k) { return R.CAT_ORDER.indexOf(k) === -1; })).map(function (k) { return { id: k, title: R.CAT_TITLES[k] || k, score: R.clampScore(c[k]) }; });
    return [];
  }
  function hist(site) {
    return (Array.isArray(site.history) ? site.history : []).filter(function (p) { return p && !isNaN(new Date(p.at)) && p.score != null; }).map(function (p) { return { at: p.at, score: R.clampScore(p.score) }; });
  }
  function trend(site) {
    var hs = hist(site);
    if (hs.length < 2) return { delta: null };
    var delta = hs[hs.length - 1].score - hs[hs.length - 2].score;
    return { delta: delta };
  }
  function trendNode(t) {
    if (t.delta == null) return el('span', null, '–', el('span', { class: 'visually-hidden' }, ' Noch kein Vergleich'));
    if (t.delta === 0) return el('span', { class: 'trend trend-flat' }, el('span', { 'aria-hidden': 'true' }, '▶ '), '±0', el('span', { class: 'visually-hidden' }, ' unverändert'));
    var up = t.delta > 0;
    return el('span', { class: 'trend ' + (up ? 'trend-up' : 'trend-down') }, el('span', { 'aria-hidden': 'true' }, up ? '▲ ' : '▼ '), (up ? '+' : '−') + Math.abs(t.delta), el('span', { class: 'visually-hidden' }, up ? ' verbessert' : ' verschlechtert'));
  }
  function crit(site) {
    var s = site.summary || {};
    if (s.kritisch != null) return s.kritisch;
    if (site.latest && site.latest.summary && site.latest.summary.kritisch != null) return site.latest.summary.kritisch;
    return null;
  }

  /* ---------- Fehler ---------- */
  function showProblem(kind, retry) {
    root.textContent = '';
    var msg, title;
    if (kind === 'missing') { title = 'Persönlicher Link fehlt'; msg = 'Diese Seite braucht Ihren persönlichen Dashboard-Link. Sie finden ihn in Ihrer Willkommens-E-Mail. Öffnen Sie ihn bitte direkt aus der E-Mail.'; }
    else if (kind === 'auth') { title = 'Link ungültig oder abgelaufen'; msg = 'Dieser Dashboard-Link wurde nicht erkannt. Prüfen Sie, ob Sie den vollständigen Link aus Ihrer Willkommens-E-Mail verwenden. Wenn das Problem bleibt, schreiben Sie uns über die Kontaktseite. Wir senden Ihnen einen neuen Link.'; }
    else { title = 'Dashboard gerade nicht erreichbar'; msg = 'Die Daten konnten nicht geladen werden. Bitte versuchen Sie es in einigen Minuten erneut.'; }
    var box = el('div', { class: 'notice ' + (kind === 'missing' ? 'info' : 'error') }, el('p', null, el('strong', null, title + '. '), msg));
    root.appendChild(box);
    var p = el('p', null);
    if (retry) { var b = el('button', { type: 'button', class: 'btn' }, 'Erneut versuchen'); b.addEventListener('click', retry); p.appendChild(b); p.appendChild(document.createTextNode(' ')); }
    p.appendChild(el('a', { class: 'btn btn-secondary', href: 'kontakt.html' }, 'Kontakt aufnehmen'));
    root.appendChild(p);
    h1.textContent = 'Monitoring-Dashboard';
    setStatus(title + '.');
    done();
  }

  /* ---------- Übersicht ---------- */
  function printBtn() {
    var b = el('button', { type: 'button', class: 'btn btn-secondary no-print' }, 'Bericht drucken / als PDF speichern');
    b.addEventListener('click', function () { window.print(); });
    return b;
  }

  function overview() {
    var sites = Array.isArray(portfolio.sites) ? portfolio.sites : [];
    var alerts = (Array.isArray(portfolio.alerts) ? portfolio.alerts : []).slice().sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    root.textContent = '';
    h1.textContent = str(portfolio.label) || 'Monitoring-Dashboard';
    var plan = PLAN[portfolio.plan] || str(portfolio.plan);
    if (YQ.MOCK) root.appendChild(el('p', { class: 'notice info' }, 'Demo-Daten (mock=1): Beispielportfolio einer Agentur, keine echten Websites.'));
    var avg = sites.length ? Math.round(sites.reduce(function (s, x) { return s + R.clampScore(x.score); }, 0) / sites.length) : null;
    var critTotal = sites.reduce(function (s, x) { return s + (crit(x) || 0); }, 0);
    root.appendChild(el('p', { class: 'muted dash-sub' }, (plan ? 'Plan: ' + plan + ' · ' : '') + sites.length + (sites.length === 1 ? ' Website' : ' Websites') + (avg != null ? ' · Durchschnitts-Score ' + avg + '/100 · ' + critTotal + ' kritische Befunde' : '')));
    root.appendChild(el('div', { class: 'btn-row no-print' }, printBtn()));

    root.appendChild(el('h2', null, 'Meldungen'));
    if (!alerts.length) root.appendChild(el('p', null, 'Keine Meldungen. Sobald ein Scan neue Probleme findet, erscheinen sie hier.'));
    else {
      var ul = el('ul', { class: 'alert-list' });
      alerts.slice(0, 12).forEach(function (a) {
        var site = sites.filter(function (s) { return s.id === a.siteId; })[0];
        var link = site ? el('a', { href: '#site=' + encodeURIComponent(site.id) }, str(site.label || a.url)) : el('span', null, str(a.url));
        ul.appendChild(el('li', { class: 'alert-item' },
          el('div', { class: 'alert-meta' }, el('span', { class: 'badge badge-neutral' }, ALERT[a.type] || 'Hinweis'), el('span', { class: 'muted' }, fmtDate(a.at, true)), link),
          el('p', null, str(a.text))));
      });
      root.appendChild(ul);
    }

    root.appendChild(el('h2', { id: 'sites-h' }, 'Websites'));
    if (!sites.length) {
      root.appendChild(el('div', { class: 'notice info' }, el('p', null, 'In diesem Portfolio sind noch keine Websites eingerichtet. Schreiben Sie uns über die ', el('a', { href: 'kontakt.html' }, 'Kontaktseite'), ', dann richten wir die ersten Websites mit Ihnen ein.')));
      done(); setStatus('Dashboard geladen. Keine Websites im Portfolio.');
      return;
    }
    var tbody = el('tbody', null);
    sites.forEach(function (s) {
      var sc = R.clampScore(s.score), c = crit(s);
      tbody.appendChild(el('tr', null,
        el('th', { scope: 'row' }, el('a', { href: '#site=' + encodeURIComponent(s.id) }, str(s.label || s.url)), el('br'), el('span', { class: 'muted url-text' }, str(s.url)), s.lastError ? el('br') : null, s.lastError ? el('span', { class: 'badge badge-kritisch' }, 'Letzter Scan fehlgeschlagen') : null),
        el('td', null, el('strong', null, sc + '/100'), el('br'), el('span', { class: 'muted' }, R.scoreWord(sc))),
        el('td', null, trendNode(trend(s))),
        el('td', null, c == null ? el('span', null, '–', el('span', { class: 'visually-hidden' }, ' nicht verfügbar')) : String(c)),
        el('td', null, fmtDate(s.lastRunAt, true)),
        el('td', null, fmtDate(s.nextRunAt, true))));
    });
    var table = el('table', { class: 'dash-table' },
      el('caption', { class: 'visually-hidden' }, 'Websites im Portfolio mit Score, Trend und Scan-Terminen'),
      el('thead', null, el('tr', null, el('th', { scope: 'col' }, 'Website'), el('th', { scope: 'col' }, 'Score'), el('th', { scope: 'col' }, 'Trend zum letzten Scan'), el('th', { scope: 'col' }, 'Kritisch'), el('th', { scope: 'col' }, 'Letzter Scan'), el('th', { scope: 'col' }, 'Nächster Scan'))),
      tbody);
    root.appendChild(el('div', { class: 'table-wrap', role: 'region', 'aria-labelledby': 'sites-h', tabindex: '0' }, table));
    done(); setStatus('Dashboard geladen. ' + sites.length + ' Websites.');
  }

  /* ---------- Detail ---------- */
  function sparkline(points) {
    var ns = 'http://www.w3.org/2000/svg';
    var W = 600, H = 180, pl = 36, pr = 12, pt = 12, pb = 28;
    function X(i) { return pl + (points.length === 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (points.length - 1)); }
    function Y(v) { return pt + (100 - v) * (H - pt - pb) / 100; }
    function mk(tag, a) { var n = document.createElementNS(ns, tag); Object.keys(a).forEach(function (k) { n.setAttribute(k, a[k]); }); return n; }
    var first = points[0], last = points[points.length - 1];
    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', class: 'sparkline', focusable: 'false', 'aria-label': 'Score-Verlauf über ' + points.length + ' Scans: von ' + first.score + ' am ' + fmtDate(first.at) + ' auf ' + last.score + ' am ' + fmtDate(last.at) + '. Werte stehen auch in der Tabelle darunter.' });
    [0, 50, 100].forEach(function (g) {
      svg.appendChild(mk('line', { x1: pl, x2: W - pr, y1: Y(g), y2: Y(g), class: 'spark-grid' }));
      var t = mk('text', { x: pl - 6, y: Y(g) + 4, 'text-anchor': 'end', class: 'spark-label' }); t.textContent = String(g); svg.appendChild(t);
    });
    svg.appendChild(mk('polyline', { points: points.map(function (p, i) { return X(i) + ',' + Y(p.score); }).join(' '), class: 'spark-line', fill: 'none' }));
    points.forEach(function (p, i) { svg.appendChild(mk('circle', { cx: X(i), cy: Y(p.score), r: 4, class: 'spark-dot' })); });
    var a = mk('text', { x: X(0), y: H - 8, 'text-anchor': 'start', class: 'spark-label' }); a.textContent = fmtDate(first.at); svg.appendChild(a);
    var b = mk('text', { x: X(points.length - 1), y: H - 8, 'text-anchor': 'end', class: 'spark-label' }); b.textContent = fmtDate(last.at); svg.appendChild(b);
    return svg;
  }

  function issueList(list, empty) {
    if (!list || !list.length) return el('p', { class: 'muted' }, empty);
    var ul = el('ul', { class: 'issue-compact' });
    list.forEach(function (i) {
      ul.appendChild(el('li', null, R.sevBadge(i.severity), ' ', el('span', null, str(i.title || i.id)), i.category ? el('span', { class: 'muted' }, ' (' + (R.CAT_TITLES[i.category] || i.category) + ')') : null));
    });
    return ul;
  }

  function detail(id) {
    root.textContent = '';
    root.setAttribute('aria-busy', 'true');
    setStatus('Website wird geladen …');
    var back = el('p', { class: 'no-print' }, el('a', { href: '#' }, '← Zurück zur Übersicht'));
    loadSite(id).then(function (site) {
      root.textContent = '';
      root.appendChild(back);
      var title = str(site.label || site.url);
      h1.textContent = title;
      if (YQ.MOCK) root.appendChild(el('p', { class: 'notice info' }, 'Demo-Daten (mock=1): Die Befundliste ist ein Beispiel und nur für die erste Website hinterlegt.'));
      root.appendChild(el('p', { class: 'muted' }, el('span', { class: 'url-text' }, str(site.url)), ' · Letzter Scan: ' + fmtDate(site.lastRunAt, true) + ' · Nächster Scan: ' + fmtDate(site.nextRunAt, true)));
      if (site.lastError) root.appendChild(el('div', { class: 'notice error' }, el('p', null, el('strong', null, 'Letzter Scan fehlgeschlagen. '), str(site.lastError))));
      root.appendChild(el('div', { class: 'btn-row no-print' }, printBtn()));

      var sc = R.clampScore(site.score);
      root.appendChild(el('div', { class: 'result-head' }, R.scoreRing(sc),
        el('div', null, el('p', { class: 'score-title' }, el('strong', null, 'Website-Score ' + sc + '/100'), el('span', { class: 'muted' }, ' · ' + R.scoreWord(sc))),
          el('p', null, 'Trend zum letzten Scan: ', trendNode(trend(site))))));

      var hs = hist(site);
      root.appendChild(el('h2', null, 'Score-Verlauf'));
      if (hs.length >= 2) {
        root.appendChild(el('div', { class: 'spark-wrap' }, sparkline(hs)));
        var tb = el('tbody', null);
        hs.forEach(function (p) { tb.appendChild(el('tr', null, el('th', { scope: 'row' }, fmtDate(p.at)), el('td', null, p.score + '/100'))); });
        var det = el('details', { class: 'disclosure spark-table' }, el('summary', null, 'Werte als Tabelle'),
          el('div', { class: 'table-wrap' }, el('table', { style: 'min-width:0;max-width:24rem' }, el('caption', { class: 'visually-hidden' }, 'Score-Verlauf'), el('thead', null, el('tr', null, el('th', { scope: 'col' }, 'Datum'), el('th', { scope: 'col' }, 'Score'))), tb)));
        root.appendChild(det);
      } else root.appendChild(el('p', { class: 'muted' }, 'Für einen Verlauf sind mindestens zwei Scans nötig.'));

      var cs = cats(site);
      if (cs.length) { root.appendChild(el('h2', null, 'Score je Prüfbereich')); root.appendChild(R.catScores(cs)); }

      var diff = site.diff || {};
      root.appendChild(el('h2', null, 'Neu seit letztem Scan'));
      root.appendChild(issueList(diff.newIssues, 'Keine neuen Probleme.'));
      root.appendChild(el('h2', null, 'Behoben'));
      root.appendChild(issueList(diff.fixedIssues, 'Seit dem letzten Scan wurde nichts als behoben erkannt.'));

      root.appendChild(el('h2', null, 'Alle Befunde'));
      if (site.latest) {
        var box = el('div', { class: 'findings-box' });
        root.appendChild(box);
        R.render(box, site.latest, { level: 3, title: 'Befunde des letzten Scans', headingId: 'findings-h', gate: false, skipSummary: true });
      } else root.appendChild(el('p', { class: 'muted' }, 'Für diese Website liegt noch kein vollständiges Scan-Ergebnis vor.'));
      done(); setStatus('Website ' + title + ' geladen.');
      h1.focus();
    }, function (e) {
      root.appendChild(back);
      if (e && e.kind === 'auth') showSiteError('Diese Website wurde in Ihrem Portfolio nicht gefunden.', back);
      else showSiteError('Die Daten dieser Website konnten nicht geladen werden. Bitte versuchen Sie es später erneut.', back);
    });
  }
  function showSiteError(msg, back) {
    root.textContent = '';
    root.appendChild(back);
    root.appendChild(el('div', { class: 'notice error' }, el('p', null, el('strong', null, 'Nicht verfügbar. '), msg)));
    h1.textContent = 'Monitoring-Dashboard';
    setStatus(msg); done();
  }

  /* ---------- Routing ---------- */
  function route() {
    if (!portfolio) return;
    var m = /^#site=(.+)$/.exec(window.location.hash);
    document.title = (portfolio.brand && portfolio.brand.name) ? 'Dashboard | ' + portfolio.brand.name : DEFAULT_TITLE;
    if (m) detail(decodeURIComponent(m[1])); else { overview(); if (portfolio._seen) h1.focus(); }
    portfolio._seen = true;
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeprint', function () { var d = document.querySelector('.spark-table'); if (d) d.open = true; });

  function start() {
    if (!YQ.MOCK && !token) { showProblem('missing'); return; }
    root.setAttribute('aria-busy', 'true');
    setStatus('Dashboard wird geladen …');
    loadPortfolio().then(function (p) {
      if (!p || typeof p !== 'object') throw Object.assign(new Error('x'), { kind: 'api' });
      portfolio = p;
      applyBrand(p.brand);
      route();
    }, function (e) { showProblem(e && e.kind === 'auth' ? 'auth' : 'network', start); });
  }
  start();
})();
