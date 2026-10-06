/* Gemeinsamer Renderer für Prüfergebnisse (API v3, abwärtskompatibel zu v2 und v1; Vertrag: docs/CHECKER_V3.md).
   Genutzt von check.js (mit Lead-Gate) und dashboard.js (ohne Gate). Alle API-Texte nur per textContent (el()). */
(function () {
  'use strict';
  var YQ = window.YQ, el = YQ.el;

  var DISCLAIMER = 'Automatische Prüfung. Liefert Hinweise, keine Rechtsberatung und keine Garantie für Rechtskonformität.';
  // Rechtliche Einordnung (RDG): Grundlage und Charakter der Ergebnisse, immer unter dem Ergebnis.
  var BASIS = 'Automatische Hinweise auf Basis öffentlich abrufbarer Inhalte, keine rechtliche Bewertung.';
  // Emoji nur dekorativ (aria-hidden), die Bedeutung steht immer im Text. API-Werte bleiben kritisch|hoch|mittel|gering.
  var SEV = {
    kritisch: { label: 'Kritisch', icon: '🔴', order: 0 },
    hoch: { label: 'Wichtig', icon: '🟠', order: 1 },
    mittel: { label: 'Verbesserung', icon: '🟡', order: 2 },
    gering: { label: 'Hinweis', icon: '⚪', order: 3 }
  };
  var KIND = { fehler: 'Fehler', warnung: 'Mögliches Problem – bitte prüfen', empfehlung: 'Empfehlung' };
  var CAT_TITLES = { accessibility: 'Barrierefreiheit', privacy: 'Datenschutz', legal: 'Rechtliches', security: 'Sicherheit', seo: 'SEO', technical: 'Technik', performance: 'Performance', mobile: 'Mobil' };
  var CAT_ORDER = ['accessibility', 'privacy', 'legal', 'security', 'seo', 'technical', 'performance', 'mobile'];
  var GATE_FULL = 2;
  var uid = 0;

  /* Einstufung (docs/CHECKER_V3.md §3): >= 90 sehr gut, >= 75 gut, >= 50 verbesserungswürdig, sonst kritisch. */
  function ratingOf(s) {
    if (s == null) return { id: 'none', label: 'Nicht bewertet', word: 'nicht bewertet', cls: 's-none' };
    return s >= 90 ? { id: 'sehr-gut', label: 'Sehr gut', word: 'sehr gut', cls: 's-ok' }
      : s >= 75 ? { id: 'gut', label: 'Gut', word: 'gut', cls: 's-ok' }
      : s >= 50 ? { id: 'verbesserungswuerdig', label: 'Verbesserungswürdig', word: 'verbesserungswürdig', cls: 's-warn' }
      : { id: 'kritisch', label: 'Kritisch', word: 'kritisch', cls: 's-crit' };
  }
  function scoreClass(s) { return ratingOf(s).cls; }
  function scoreWord(s) { return ratingOf(s).word; }
  function clampScore(v) { var n = Math.round(Number(v)); return isNaN(n) ? 0 : Math.max(0, Math.min(100, n)); }
  function scoreOrNull(v) { return (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : clampScore(v); }
  function str(v) { return v == null ? '' : String(v); }
  function num(v, fallback) { var n = Number(v); return isFinite(n) ? n : fallback; }
  function fmt(n) { return String(Math.round(n * 10) / 10).replace('.', ','); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function reducedMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }

  function sevBadge(sev, prefix) {
    var s = SEV[sev] || SEV.mittel;
    return el('span', { class: 'badge badge-' + (SEV[sev] ? sev : 'mittel') }, el('span', { 'aria-hidden': 'true' }, s.icon + ' '), (prefix || '') + s.label);
  }

  function h(level, attrs) {
    var args = Array.prototype.slice.call(arguments, 2);
    return el.apply(null, ['h' + Math.min(6, level), attrs].concat(args));
  }

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
    var has = score != null;
    var bar = circle('bar ' + scoreClass(score));
    bar.setAttribute('stroke-linecap', 'round');
    bar.setAttribute('stroke-dasharray', String(C));
    bar.setAttribute('stroke-dashoffset', String(C));
    svg.appendChild(circle('track')); if (has) svg.appendChild(bar);
    if (has) requestAnimationFrame(function () { bar.setAttribute('stroke-dashoffset', String(C * (1 - score / 100))); });
    return el('div', { class: 'score-ring' }, svg, el('div', { class: 'score-num' }, el('span', null, has ? String(score) : '–', el('small', null, has ? 'von 100' : 'offen'))));
  }

  /* Normalisiert v1, v2 und v3 auf eine gemeinsame Form. legacy = v1 (keine categories). */
  function normalize(data) {
    data = data || {};
    var rawIssues = Array.isArray(data.issues) ? data.issues : [];
    var hasCats = Array.isArray(data.categories) && data.categories.length > 0;
    var catIds = hasCats ? data.categories.map(function (c) { return c.id; }) : ['accessibility'];
    function catOf(c) { return hasCats ? (c && catIds.indexOf(c) !== -1 ? c : catIds[0]) : 'accessibility'; }
    var issues = rawIssues.filter(function (i) { return i && typeof i === 'object'; }).map(function (i, idx) {
      var sev = SEV[i.severity] ? i.severity : 'mittel';
      var pts = i.points && typeof i.points === 'object' ? { lost: num(i.points.lost, 0), max: num(i.points.max, 0) } : null;
      return { _i: idx, id: i.id, category: catOf(i.category), severity: sev, kind: KIND[i.kind] ? i.kind : null, title: i.title, description: i.description, impact: i.impact, fix: i.fix, count: i.count, points: pts,
        examples: Array.isArray(i.examples) ? i.examples.filter(function (x) { return typeof x === 'string'; }) : [], wcag: i.wcag, ref: i.ref, affectedUrl: i.affectedUrl };
    }).sort(function (a, b) { return (SEV[a.severity].order - SEV[b.severity].order) || (a._i - b._i); });
    function listFor(arr, mapFn) {
      return (Array.isArray(arr) ? arr : []).filter(function (x) { return x && typeof x === 'object'; }).map(function (x) { var o = mapFn(x); o.category = catOf(x.category); return o; });
    }
    var passed = listFor(data.passed, function (p) { return { id: p.id, title: p.title }; });
    var unchecked = listFor(data.unchecked, function (u) { return { id: u.id, title: u.title, reason: u.reason }; });
    var infos = listFor(data.infos, function (n) { return { id: n.id, title: n.title, text: n.text }; });
    var cats;
    if (hasCats) {
      cats = data.categories.map(function (c) {
        var own = issues.filter(function (i) { return i.category === c.id; });
        var score = scoreOrNull(c.score);
        var rt = ratingOf(score);
        if (c.rating && typeof c.rating.label === 'string' && score != null) rt = { id: str(c.rating.id), label: c.rating.label, word: c.rating.label.toLowerCase(), cls: rt.cls };
        var pts = c.points && typeof c.points === 'object' && isFinite(Number(c.points.possible)) ? { earned: num(c.points.earned, 0), possible: num(c.points.possible, 0) } : null;
        return { id: c.id, title: str(c.title) || CAT_TITLES[c.id] || str(c.id), score: score, rating: rt, weight: c.weight, error: !!c.error,
          issueCount: own.length, issues: own, points: pts, checked: c.checked != null ? num(c.checked, null) : null,
          manual: (Array.isArray(c.manual) ? c.manual : []).filter(function (m) { return typeof m === 'string' && m; }),
          passed: passed.filter(function (p) { return p.category === c.id; }), unchecked: unchecked.filter(function (u) { return u.category === c.id; }), infos: infos.filter(function (n) { return n.category === c.id; }) };
      });
    } else {
      var ls = clampScore(data.score);
      cats = [{ id: 'accessibility', title: CAT_TITLES.accessibility, score: ls, rating: ratingOf(ls), issueCount: issues.length, issues: issues, points: null, checked: null, manual: [], error: false, passed: [], unchecked: [], infos: [] }];
    }
    var s = data.summary || {};
    function cnt(sev) { return s[sev] != null ? num(s[sev], 0) : issues.filter(function (i) { return i.severity === sev; }).length; }
    var summary = { kritisch: cnt('kritisch'), hoch: cnt('hoch'), mittel: cnt('mittel'), gering: cnt('gering'),
      bestanden: s.bestanden != null ? num(s.bestanden, 0) : passed.length, nichtGeprueft: s.nichtGeprueft != null ? num(s.nichtGeprueft, 0) : unchecked.length };
    var score = hasCats ? scoreOrNull(data.score) : clampScore(data.score);
    var rating = ratingOf(score);
    if (data.rating && typeof data.rating.label === 'string' && score != null) rating = { id: str(data.rating.id), label: data.rating.label, word: data.rating.label.toLowerCase(), cls: rating.cls };
    var cap = data.scoreCap && typeof data.scoreCap === 'object' ? { max: num(data.scoreCap.max, 74), uncapped: data.scoreCap.uncapped != null ? num(data.scoreCap.uncapped, null) : null, reasons: (Array.isArray(data.scoreCap.reasons) ? data.scoreCap.reasons : []).map(function (r) { return str(r && (r.title || r.id)); }).filter(Boolean) } : null;
    var v3 = hasCats && cats.some(function (c) { return c.points; });
    return { legacy: !hasCats, v3: v3, score: score, rating: rating, cap: cap, categories: cats, issues: issues, passed: passed, unchecked: unchecked, infos: infos, summary: summary,
      measurements: data.measurements && typeof data.measurements === 'object' ? data.measurements : null,
      limitations: (Array.isArray(data.limitations) ? data.limitations : []).filter(function (x) { return typeof x === 'string' && x; }) };
  }

  /* Anzahl je Priorität; Bedeutung steht im Text, Emoji nur dekorativ. */
  function totals(summary) {
    function item(n, sev, label, cls) {
      return el('li', null, el('strong', null, String(n)), sev ? sevBadge(sev) : el('span', { class: 'badge ' + cls }, label));
    }
    var ul = el('ul', { class: 'counts', 'aria-label': 'Zusammenfassung nach Priorität' },
      item(summary.kritisch, 'kritisch'), item(summary.hoch, 'hoch'), item(summary.mittel, 'mittel'), item(summary.gering, 'gering'),
      el('li', null, el('strong', null, String(summary.bestanden)), el('span', { class: 'badge badge-bestanden' }, el('span', { 'aria-hidden': 'true' }, '🟢 '), 'Gut')));
    if (summary.nichtGeprueft > 0) ul.appendChild(el('li', null, el('strong', null, String(summary.nichtGeprueft)), el('span', { class: 'badge badge-neutral' }, 'Nicht geprüft')));
    return ul;
  }

  /* Score je Bereich: Text + Balken (Balken dekorativ, Wert steht im Text, Wortbewertung zusätzlich zur Farbe). Auch vom Dashboard genutzt. */
  function catScores(cats, label) {
    var ul = el('ul', { class: 'cat-scores', 'aria-label': label || 'Score je Prüfbereich' });
    cats.forEach(function (c) {
      var sc = c.score == null ? null : clampScore(c.score);
      var fill = el('div', { class: 'bar-fill ' + scoreClass(sc) });
      fill.style.width = (sc == null ? 0 : sc) + '%';
      ul.appendChild(el('li', null,
        el('div', { class: 'cat-line' }, el('span', null, c.title), el('span', { class: 'cat-val' }, sc == null ? 'nicht bewertet' : sc + '/100 · ' + scoreWord(sc))),
        el('div', { class: 'bar-track', 'aria-hidden': 'true' }, fill)));
    });
    return ul;
  }

  function issueFull(issue, level) {
    var meta = el('div', { class: 'finding-meta' },
      sevBadge(issue.severity, 'Priorität: '),
      issue.kind ? el('span', { class: 'kind-label' }, KIND[issue.kind]) : null,
      issue.count != null && Number(issue.count) > 1 ? el('span', null, issue.count + '× gefunden') : null);
    var art = el('article', { class: 'finding sev-' + issue.severity }, meta,
      h(level, { class: 'finding-title' }, str(issue.title || issue.id || 'Befund')));
    if (issue.description) art.appendChild(el('p', null, el('strong', null, 'Festgestellt: '), str(issue.description)));
    if (issue.impact) art.appendChild(el('p', null, el('strong', null, 'Auswirkung: '), str(issue.impact)));
    if (issue.fix) art.appendChild(el('p', { class: 'fix-text' }, el('strong', null, 'So beheben Sie es: '), str(issue.fix)));
    if (issue.points && issue.points.lost > 0 && issue.points.max > 0) art.appendChild(el('p', { class: 'points-line' }, '−' + fmt(issue.points.lost) + ' von ' + fmt(issue.points.max) + ' Punkten'));
    var refs = [];
    if (issue.wcag && !(issue.ref && /WCAG/.test(str(issue.ref)))) refs.push('WCAG ' + issue.wcag);
    if (issue.ref) refs.push(str(issue.ref));
    if (refs.length) art.appendChild(el('p', { class: 'issue-ref' }, el('strong', null, 'Referenz: '), refs.join(' · ')));
    if (issue.affectedUrl) art.appendChild(el('p', { class: 'issue-ref' }, el('strong', null, 'Betroffene Adresse: '), el('span', { class: 'url-text' }, str(issue.affectedUrl))));
    if (issue.examples.length) {
      var list = el('ul', { class: 'example-list' });
      issue.examples.forEach(function (x) { list.appendChild(el('li', null, el('code', null, x))); });
      art.appendChild(el('details', { class: 'disclosure' }, el('summary', null, 'Beispiele aus dem Quelltext (' + issue.examples.length + ')'), list));
    }
    return el('li', null, art);
  }

  function issueCompact(issue) {
    return el('li', null, sevBadge(issue.severity), ' ', el('span', null, str(issue.title || issue.id || 'Befund')));
  }

  function leadForm(opts, suffix, onDone) {
    var emailId = 'lead-email-' + suffix, consentId = 'lead-consent-' + suffix, promoId = 'lead-promo-' + suffix, msgId = 'lead-status-' + suffix;
    var f = el('form', { class: 'lead-form', id: 'lead-form-' + suffix },
      el('div', { class: 'field' }, el('label', { for: emailId }, 'E-Mail-Adresse'), el('input', { type: 'email', id: emailId, name: 'email', autocomplete: 'email', required: true, placeholder: 'name@firma.de' })),
      el('div', { class: 'field' }, el('label', { class: 'check-line', for: consentId }, el('input', { type: 'checkbox', id: consentId, name: 'consent', required: true }),
        el('span', null, 'Ich willige ein, dass Yanqiva meine E-Mail-Adresse speichert, um mir alle Befunde freizuschalten und das Ergebnis per E-Mail zu senden. Details in der ', el('a', { href: 'datenschutz.html' }, 'Datenschutzerklärung'), '. Widerruf jederzeit möglich.'))),
      el('div', { class: 'field' }, el('label', { class: 'check-line', for: promoId }, el('input', { type: 'checkbox', id: promoId, name: 'promo' }),
        el('span', null, 'Optional: Ich möchte zusätzlich einen unverbindlichen Vorschlag zur Behebung der Befunde (Angebot) per E-Mail erhalten. Widerruf jederzeit möglich.'))),
      YQ.hpField('lead-hp-' + suffix),
      el('button', { type: 'submit', class: 'btn' }, 'Befunde freischalten'),
      el('p', { id: msgId, class: 'status-msg', role: 'status', 'aria-live': 'polite' }));
    f._yqTs = Date.now();
    if (YQ.pow) YQ.pow.watch(f);
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = f.elements.email.value.trim();
      var btn = f.querySelector('button');
      var msg = f.querySelector('#' + msgId);
      btn.disabled = true; msg.textContent = 'Wird gesendet …';
      // Rechenaufgabe (Spamschutz) wird beim ersten Fokus vorab gelöst und hier dem guard-Objekt als `pow` beigefügt (siehe js/config.js).
      var g = YQ.guard(f);
      (YQ.pow ? YQ.pow.withPow(f, g) : Promise.resolve(g)).then(function (gp) {
        return opts.postLead(email, gp, !!f.elements.promo.checked);
      }).then(function () {
        onDone();
      }, function (e) {
        btn.disabled = false;
        msg.textContent = e && e.kind === 'network' ? 'Der Versand ist gerade nicht erreichbar. Bitte versuchen Sie es später erneut oder schreiben Sie uns über die Kontaktseite.' : 'Fehler: ' + (e && e.message ? e.message : 'unbekannt');
      });
    });
    return f;
  }

  function fmtBytes(b) { return b >= 1048576 ? fmt(b / 1048576) + ' MB' : (b >= 1024 ? fmt(b / 1024) + ' KB' : b + ' Bytes'); }
  var COMPRESSION = { br: 'Brotli', gzip: 'gzip', deflate: 'deflate', zstd: 'zstd' };
  function measurementsLine(m) {
    if (!m) return null;
    var parts = [];
    if (isFinite(Number(m.responseTimeMs)) && m.responseTimeMs !== null) parts.push('Antwortzeit ' + Math.round(m.responseTimeMs) + ' ms');
    if (isFinite(Number(m.htmlBytes)) && m.htmlBytes !== null) parts.push('HTML-Größe ' + fmtBytes(Number(m.htmlBytes)));
    if (isFinite(Number(m.redirects)) && m.redirects !== null) parts.push(Number(m.redirects) === 0 ? 'keine Weiterleitung' : plural(Number(m.redirects), 'Weiterleitung', 'Weiterleitungen'));
    // null heißt „nicht feststellbar“ (die Prüf-Laufzeit entpackt Antworten), nicht „keine Kompression“
    if (m.compression) parts.push('Kompression ' + (COMPRESSION[m.compression] || str(m.compression)));
    var smp = [];
    if (Number(m.imagesSampled) > 0) smp.push(plural(Number(m.imagesSampled), 'Bild', 'Bilder'));
    if (Number(m.linksSampled) > 0) smp.push(plural(Number(m.linksSampled), 'Link', 'Links'));
    if (smp.length) parts.push('Stichprobe: ' + smp.join(', '));
    return parts.length ? el('p', { class: 'hint measure-line' }, el('strong', null, 'Messwerte: '), parts.join(' · ')) : null;
  }

  function scoreWhy(d) {
    var rated = d.categories.filter(function (c) { return c.score != null; }).length;
    var text = d.v3
      ? 'Der Gesamtwert ist der gewichtete Durchschnitt aus ' + rated + ' Bereichen. Jeder Prüfpunkt bringt Punkte, Befunde kosten davon je nach Priorität einen Teil. Was nicht geprüft werden konnte, zählt nicht mit.'
      : 'Der Gesamtwert fasst die ' + (rated > 1 ? rated + ' Prüfbereiche' : 'Befunde') + ' zusammen. Befunde mit höherer Priorität senken den Wert stärker.';
    return el('p', { class: 'score-why' }, el('strong', null, 'Warum ' + d.score + '/100? '), text);
  }

  /* Kachelübersicht je Bereich. Jede Kachel ist ein Button und öffnet den zugehörigen Tab. */
  function catOverview(d, level, sfx) {
    var ul = el('ul', { class: 'cat-tiles' }), buttons = [];
    d.categories.forEach(function (c) {
      var top = c.issues[0];
      var fill = el('span', { class: 'bar-fill ' + scoreClass(c.score) });
      fill.style.width = (c.score == null ? 0 : c.score) + '%';
      var btn = el('button', { type: 'button', class: 'cat-tile', 'aria-controls': 'panel-' + sfx + '-' + c.id },
        el('span', { class: 'tile-title' }, c.title),
        el('span', { class: 'tile-score' },
          c.score == null ? el('span', { class: 'tile-word' }, 'nicht bewertet') : el('strong', null, c.score + '/100'),
          c.score == null ? null : el('span', { class: 'tile-word ' + c.rating.cls }, c.rating.label)),
        el('span', { class: 'bar-track', 'aria-hidden': 'true' }, fill),
        el('span', { class: 'tile-issues' }, c.issues.length ? plural(c.issues.length, 'Befund', 'Befunde') : 'Keine Befunde'),
        top ? el('span', { class: 'tile-top' }, el('span', { class: 'visually-hidden' }, 'Wichtigster Befund, ' + SEV[top.severity].label + ': '), str(top.title || top.id)) : null);
      buttons.push(btn);
      ul.appendChild(el('li', null, btn));
    });
    return { node: ul, buttons: buttons };
  }

  function simpleList(items, cls) {
    var ul = el('ul', { class: cls || 'plain-list' });
    items.forEach(function (t) { ul.appendChild(el('li', null, t)); });
    return ul;
  }

  /**
   * render(container, data, opts)
   * opts: { level (Überschriften-Basisebene, Standard 3), headingId, title, gate (Lead-Gate aktiv), postLead(email)->Promise,
   *         ctas (ruhiger Abschluss "Website verbessern lassen"), url (für Links), focus (Kategorie-ID für Start-Tab), recommend, legacyLead,
   *         skipSummary (ohne Kopf/Übersicht, Dashboard), mockNotice }
   * Gibt { heading, summary, score } zurück.
   */
  function render(container, data, opts) {
    opts = opts || {};
    data = data || {};
    var level = opts.level || 3;
    var d = normalize(data);
    var sfx = 'r' + (++uid);
    var gateOn = !!opts.gate && !d.legacy && typeof opts.postLead === 'function';
    var unlocked = false;
    container.textContent = '';

    var heading = h(level, { id: opts.headingId, tabindex: '-1' }, opts.title || ('Ergebnis für ' + str(opts.displayUrl || data.finalUrl || data.url || opts.url)));
    container.appendChild(heading);
    if (opts.mockNotice) container.appendChild(el('p', { class: 'notice info' }, opts.mockNotice));

    var tileSet = null;
    if (!opts.skipSummary) {
      var meta = [];
      if (data.system && data.system !== 'unbekannt') meta.push('Erkanntes System: ' + str(data.system).charAt(0).toUpperCase() + str(data.system).slice(1));
      if (data.checkedAt) { var dt = new Date(data.checkedAt); if (!isNaN(dt)) meta.push('Geprüft am ' + dt.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })); }
      if (meta.length) container.appendChild(el('p', { class: 'muted' }, meta.join(' · ')));

      container.appendChild(el('div', { class: 'result-head' },
        scoreRing(d.score),
        el('div', { class: 'result-head-text' },
          el('p', { class: 'score-title' }, el('strong', null, d.score == null ? 'Website-Score nicht berechenbar' : 'Website-Score ' + d.score + '/100'), d.score == null ? null : el('span', { class: 'rating-pill ' + d.rating.cls }, d.rating.label)),
          d.score == null ? null : scoreWhy(d),
          totals(d.summary))));
      if (d.cap && d.score != null) {
        container.appendChild(el('div', { class: 'notice warn' }, el('p', null, el('strong', null, 'Gesamtwert auf ' + d.cap.max + ' begrenzt' + (d.cap.uncapped != null ? ' (rechnerisch ' + d.cap.uncapped + ')' : '')), d.cap.reasons.length ? ', wegen: ' + d.cap.reasons.join(', ') + '. ' : '. ', d.cap.max >= 89 ? 'Mit einem kritischen Befund vergeben wir keine Einstufung „Sehr gut“.' : 'Ein grundlegender Mangel soll nicht durch gute Werte in anderen Bereichen verdeckt werden.')));
      }
    }

    if (!opts.skipSummary && d.limitations.length) {
      var lim = el('div', { class: 'notice info limitations' }, el('p', null, el('strong', null, 'Zu dieser Prüfung')));
      lim.appendChild(simpleList(d.limitations));
      container.appendChild(lim);
    }

    if (data.overlayDetected) {
      container.appendChild(el('div', { class: 'notice warn' }, el('p', null, el('strong', null, 'Overlay-Widget erkannt: ' + str(data.overlayDetected) + '. '), 'Overlays beheben die Barrieren im Quelltext nicht und ersetzen keine barrierefreie Umsetzung. ', el('a', { href: 'ratgeber/overlay-widgets-bfsg.html' }, 'Warum Overlays nicht reichen'), '.')));
    }

    if (!opts.skipSummary) {
      var ml = measurementsLine(d.measurements);
      if (ml) container.appendChild(ml);
      if (!d.legacy && d.categories.length > 1) {
        container.appendChild(h(level + 1, { class: 'section-title' }, 'Ergebnis je Bereich'));
        tileSet = catOverview(d, level, sfx);
        container.appendChild(tileSet.node);
      }
    }

    if (opts.recommend && YQ.recommend) container.appendChild(recoCard(opts, level, data));

    // Befunde
    var panels = [];
    function fillPanel(p) {
      var cat = p.cat;
      p.node.textContent = '';
      p.node.appendChild(h(level + 2, { class: 'panel-title' }, cat.title));
      if (cat.score != null || cat.points) {
        var line = el('p', { class: 'panel-score' }, el('strong', null, cat.score == null ? 'nicht bewertet' : cat.score + '/100'), cat.score == null ? null : el('span', { class: 'rating-pill ' + cat.rating.cls }, cat.rating.label));
        if (cat.points && cat.checked != null) line.appendChild(el('span', { class: 'muted points-sum' }, fmt(cat.points.earned) + ' von ' + fmt(cat.points.possible) + ' Punkten aus ' + plural(cat.checked, 'Prüfpunkt', 'Prüfpunkten')));
        p.node.appendChild(line);
      }
      if (cat.error) p.node.appendChild(el('div', { class: 'notice error' }, el('p', null, 'Dieser Bereich konnte nicht ausgewertet werden. Bitte starten Sie die Prüfung später erneut.')));
      else if (cat.score == null && !d.legacy) p.node.appendChild(el('div', { class: 'notice info' }, el('p', null, 'Dieser Bereich ist nicht bewertet, weil kein Prüfpunkt ausgewertet werden konnte. Er zählt nicht in den Gesamtwert.')));
      if (!cat.issues.length) {
        if (!cat.error && !(cat.score == null && !d.legacy)) p.node.appendChild(el('div', { class: 'notice success' }, el('p', null, 'Die automatische Prüfung hat in diesem Bereich keine Befunde gefunden. Das ist noch keine Bestätigung der Konformität.')));
      } else {
        if (unlocked) {
          p.unlockNote = el('div', { class: 'notice success', tabindex: '-1' }, el('p', null, el('strong', null, 'Danke. '), 'Wir melden uns mit Ihrem Ergebnis und einem Vorschlag, wie Sie die wichtigsten Punkte beheben. Alle Befunde sind jetzt freigeschaltet.'));
          p.node.appendChild(p.unlockNote);
        }
        var split = gateOn && !unlocked ? GATE_FULL : cat.issues.length;
        var full = el('ul', { class: 'issue-list' });
        cat.issues.slice(0, split).forEach(function (i) { full.appendChild(issueFull(i, level + 3)); });
        p.node.appendChild(full);
        var rest = cat.issues.slice(split);
        if (rest.length) {
          p.node.appendChild(el('details', { class: 'disclosure rest-list' },
            el('summary', null, 'Weitere ' + rest.length + ' Befunde in diesem Bereich (nur Titel)'),
            el.apply(null, ['ul', { class: 'issue-compact' }].concat(rest.map(issueCompact)))));
          var total = d.issues.length;
          p.node.appendChild(el('div', { class: 'gate-callout' },
            h(level + 3, null, 'Alle ' + total + ' Befunde mit Lösungen ansehen'),
            el('p', null, 'Kostenlos per E-Mail: Tragen Sie Ihre Adresse ein, dann sehen Sie sofort zu allen Befunden Erklärung, Lösung und betroffene Adresse.'),
            leadForm(opts, sfx + '-' + cat.id, function () { unlockAll(); })));
        }
      }
      if (cat.passed.length) {
        p.node.appendChild(el('details', { class: 'disclosure' }, el('summary', null, 'Gut gelöst (' + cat.passed.length + ')'),
          simpleList(cat.passed.map(function (x) { return str(x.title || x.id); }), 'plain-list passed-list')));
      }
      if (cat.unchecked.length) {
        var ul = el('ul', { class: 'plain-list' });
        cat.unchecked.forEach(function (u) { ul.appendChild(el('li', null, el('strong', null, str(u.title || u.id)), u.reason ? ' – ' + str(u.reason) : null)); });
        p.node.appendChild(el('details', { class: 'disclosure', open: true }, el('summary', null, 'Nicht geprüft (' + cat.unchecked.length + ')'),
          el('p', { class: 'hint' }, 'Diese Punkte zählen nicht in den Score.'), ul));
      }
      if (cat.manual.length) {
        p.node.appendChild(el('details', { class: 'disclosure' }, el('summary', null, 'Nicht automatisch prüfbar (' + cat.manual.length + ')'),
          el('p', { class: 'hint' }, 'Das kann eine automatische Prüfung nicht beurteilen. Es braucht eine Prüfung durch Menschen oder mit einem echten Browser.'), simpleList(cat.manual)));
      }
      if (cat.infos.length) {
        var il = el('ul', { class: 'plain-list info-list' });
        cat.infos.forEach(function (n) { il.appendChild(el('li', null, el('strong', null, str(n.title || n.id) + ': '), str(n.text))); });
        p.node.appendChild(el('div', { class: 'panel-infos' }, el('p', { class: 'panel-sub' }, 'Informationen'), il));
      }
    }
    function unlockAll() {
      unlocked = true;
      panels.forEach(fillPanel);
      var active = panels.filter(function (p) { return !p.node.hidden; })[0];
      if (active && active.unlockNote) active.unlockNote.focus();
    }

    var withIssues = d.issues.length > 0;
    container.appendChild(h(level + 1, { class: 'section-title' }, withIssues ? 'Befunde nach Bereich (' + d.issues.length + ')' : 'Befunde'));
    if (!withIssues) {
      container.appendChild(el('div', { class: 'notice success' }, el('p', null, 'Die automatische Prüfung hat auf der Startseite keine Befunde gefunden. Das ist noch keine Bestätigung der Konformität: Tastaturbedienung, Checkout und Verständlichkeit brauchen eine manuelle Prüfung, und rechtliche Inhalte bewertet keine automatische Prüfung.')));
    }
    if (d.categories.length > 1 && (withIssues || !d.legacy)) {
      var tablist = el('div', { class: 'tablist', role: 'tablist', 'aria-label': 'Prüfbereiche' });
      var startIdx = 0;
      d.categories.forEach(function (c, idx) { if (opts.focus && c.id === opts.focus) startIdx = idx; });
      var tabs = [];
      d.categories.forEach(function (c, idx) {
        var tabId = 'tab-' + sfx + '-' + c.id, panelId = 'panel-' + sfx + '-' + c.id;
        var tab = el('button', { type: 'button', class: 'tab', role: 'tab', id: tabId, 'aria-controls': panelId, 'aria-selected': idx === startIdx ? 'true' : 'false', tabindex: idx === startIdx ? '0' : '-1' },
          c.title, el('span', { class: 'tab-count' }, ' (' + c.issues.length + ')'));
        var node = el('div', { class: 'tabpanel', role: 'tabpanel', id: panelId, 'aria-labelledby': tabId, tabindex: '0' });
        if (idx !== startIdx) node.hidden = true;
        var p = { cat: c, node: node, tab: tab };
        panels.push(p); tabs.push(p);
        tablist.appendChild(tab);
      });
      var select = function (i, focus) {
        tabs.forEach(function (p, idx) {
          var on = idx === i;
          p.tab.setAttribute('aria-selected', on ? 'true' : 'false');
          p.tab.tabIndex = on ? 0 : -1;
          p.node.hidden = !on;
          if (tileSet) { if (on) tileSet.buttons[idx].setAttribute('aria-current', 'true'); else tileSet.buttons[idx].removeAttribute('aria-current'); }
        });
        if (focus) tabs[i].tab.focus();
      };
      if (tileSet) {
        tileSet.buttons[startIdx].setAttribute('aria-current', 'true');
        tileSet.buttons.forEach(function (b, idx) {
          b.addEventListener('click', function () {
            select(idx, false);
            tablist.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
            tabs[idx].node.focus({ preventScroll: true });
          });
        });
      }
      tablist.addEventListener('click', function (ev) {
        var t = ev.target.closest ? ev.target.closest('[role="tab"]') : null;
        if (!t) return;
        tabs.forEach(function (p, idx) { if (p.tab === t) select(idx, false); });
      });
      tablist.addEventListener('keydown', function (ev) {
        var cur = -1; tabs.forEach(function (p, idx) { if (p.tab === document.activeElement) cur = idx; });
        if (cur < 0) return;
        var next = null;
        if (ev.key === 'ArrowRight') next = (cur + 1) % tabs.length;
        else if (ev.key === 'ArrowLeft') next = (cur - 1 + tabs.length) % tabs.length;
        else if (ev.key === 'Home') next = 0;
        else if (ev.key === 'End') next = tabs.length - 1;
        if (next != null) { ev.preventDefault(); select(next, true); }
      });
      container.appendChild(tablist);
      tabs.forEach(function (p) { fillPanel(p); container.appendChild(p.node); });
    } else if (withIssues) {
      var only = { cat: d.categories[0], node: el('div', { class: 'tabpanel single' }) };
      panels.push(only);
      fillPanel(only);
      container.appendChild(only.node);
    }

    // v1: keine Bereiche, Bestandenes gesammelt
    if (d.legacy && d.passed.length) {
      var pl = el('ul', null);
      d.passed.forEach(function (p) { pl.appendChild(el('li', null, str(p.title || p.id))); });
      container.appendChild(el('details', { class: 'disclosure' }, el('summary', null, 'Bestanden (' + d.passed.length + ' Prüfungen)'), pl));
    }

    if (data.note) container.appendChild(el('p', { class: 'hint', style: 'margin-top:1.25rem' }, str(data.note)));
    container.appendChild(el('p', { class: 'hint disclaimer' }, (str(data.disclaimer) || DISCLAIMER) + ' ' + BASIS));

    if (opts.ctas) container.appendChild(improveBox(opts, level));
    if (opts.legacyLead && d.legacy && typeof opts.postLead === 'function') {
      container.appendChild(el('div', { class: 'lead-box' },
        h(level + 1, null, 'Das Ergebnis per E-Mail erhalten'),
        leadForm(opts, sfx + '-legacy', function () {
          var m = container.querySelector('#lead-status-' + sfx + '-legacy');
          if (m) m.textContent = 'Danke. Wir senden Ihnen das Ergebnis per E-Mail.';
        })));
    }

    return { heading: heading, summary: d.summary, score: d.score, rating: d.rating };
  }

  /* Produktempfehlung (recommend.js). Immer sichtbar, auch bei geschlossenem Lead-Gate. Alle Texte per textContent. */
  function recoCard(opts, level, data) {
    var rec = YQ.recommend.recommend(data);
    var q = opts.url ? '&url=' + encodeURIComponent(opts.url) : '';
    function href(key) { return 'bestellen.html?produkt=' + key + q; }
    var hid = 'reco-title-' + (++uid);
    var p = rec.primary;
    var main = el('div', { class: 'reco-main' },
      h(level + 2, { class: 'reco-product' }, 'Empfehlung: ', el('strong', null, p.items ? 'Einzel-Fixes (' + p.items.length + ')' : p.name), p.noSale ? null : ' – ', p.noSale ? null : el('span', { class: 'reco-price' }, p.price)),
      el('p', { class: 'reco-reason' }, rec.reason));
    if (p.noSale) {
      if (rec.selfFix && rec.selfFix.length) {
        var sl = el('ul', { class: 'reco-selffix' });
        rec.selfFix.forEach(function (t) { sl.appendChild(el('li', null, t)); });
        main.appendChild(h(level + 3, { class: 'reco-selffix-title' }, 'Kleinigkeiten, die Sie selbst erledigen können'));
        main.appendChild(sl);
      }
      main.appendChild(el('p', { class: 'reco-cta' }, el('a', { class: 'btn btn-light', href: '#check' }, p.cta)));
    } else if (p.items) {
      var fl = el('ul', { class: 'reco-fixes' });
      p.items.forEach(function (f) { fl.appendChild(el('li', null, el('a', { class: 'btn btn-light', href: href(f.key) }, f.name + ' bestellen (' + f.price + ')'))); });
      main.appendChild(fl);
      main.appendChild(el('p', { class: 'reco-sum' }, 'Summe aller ' + p.items.length + ' Fixes: ' + p.price + ' (Endpreis).'));
    } else {
      if (rec.rule === 'monitoring' && rec.selfFix && rec.selfFix.length) {
        var ml = el('ul', { class: 'reco-selffix' });
        rec.selfFix.forEach(function (t) { ml.appendChild(el('li', null, t)); });
        main.appendChild(h(level + 3, { class: 'reco-selffix-title' }, 'Kleinigkeiten, die Sie selbst erledigen können'));
        main.appendChild(ml);
      }
      main.appendChild(el('p', { class: 'reco-cta' }, el('a', { class: 'btn btn-light', href: href(p.key) }, p.name + (/^website-/.test(p.key) ? ' anfragen (' + p.price + ')' : ' bestellen (' + p.price + ')'))));
    }
    var whyList = el('ul', { class: 'reco-why' });
    rec.why.concat(rec.notes).forEach(function (t) { whyList.appendChild(el('li', null, t)); });
    var card = el('section', { class: 'reco on-dark', 'aria-labelledby': hid },
      h(level + 1, { id: hid, class: 'reco-title' }, 'Unsere Empfehlung für Ihre Website'),
      h(level + 2, { class: 'reco-sub reco-sub-first' }, 'Kurze Einschätzung'),
      el('p', { class: 'reco-assess' }, rec.assessment),
      main,
      h(level + 2, { class: 'reco-sub' }, 'Warum?'), whyList);
    if (rec.alternatives.length) {
      var al = el('ul', { class: 'reco-alts' });
      rec.alternatives.forEach(function (a) {
        al.appendChild(el('li', null, el('a', { href: a.key === 'fix-individuell' ? 'fix.html' : href(a.key) }, a.name + ' (' + a.price + ')'), a.why ? el('span', null, ' – ' + a.why) : null));
      });
      card.appendChild(h(level + 2, { class: 'reco-sub' }, 'Alternativen'));
      card.appendChild(al);
    }
    card.appendChild(el('p', { class: 'reco-hint' }, rec.disclaimer + ' Alle Preise sind Endpreise (Kleinunternehmer nach § 19 UStG, keine Umsatzsteuer).'));
    return card;
  }

  // Preistexte aus window.YQ_CATALOG (js/catalog.js, generiert aus tools/site-build/catalog.mjs); Fallback = Stand 2026-10-03.
  function catText(id, field, fallback) {
    var c = window.YQ_CATALOG && window.YQ_CATALOG.products && window.YQ_CATALOG.products[id];
    return (c && c[field]) || fallback;
  }

  /* Ruhiger Abschluss: eine Anfrage-Option, eine Nebenoption. */
  function improveBox(opts, level) {
    var enc = opts.url ? encodeURIComponent(opts.url) : '';
    var hid = 'improve-title-' + (++uid);
    return el('section', { class: 'improve-box', 'aria-labelledby': hid },
      h(level + 1, { id: hid }, 'Website verbessern lassen'),
      el('p', null, 'Wir sehen uns das Ergebnis mit Ihnen an und sagen Ihnen unverbindlich, was sich lohnt.'),
      el('p', { class: 'improve-actions' },
        el('a', { class: 'btn', href: 'kontakt.html?quelle=check' + (enc ? '&url=' + enc : '') }, 'Unverbindlich anfragen'),
        el('a', { class: 'improve-link', href: 'bestellen.html?produkt=report' + (enc ? '&url=' + enc : '') }, 'Vollständigen Website-Report ansehen')),
      el('p', { class: 'hint' }, 'Der Website-Report prüft bis zu 10 Seiten und kostet ' + catText('report', 'amountText', '149 €') + '. Alle Preise sind Endpreise, als Kleinunternehmer nach § 19 UStG berechnen wir keine Umsatzsteuer.'));
  }

  YQ.report = { render: render, normalize: normalize, scoreRing: scoreRing, catScores: catScores, sevBadge: sevBadge, scoreClass: scoreClass, scoreWord: scoreWord, ratingOf: ratingOf, clampScore: clampScore, SEV: SEV, KIND: KIND, CAT_TITLES: CAT_TITLES, CAT_ORDER: CAT_ORDER, DISCLAIMER: DISCLAIMER };
})();
