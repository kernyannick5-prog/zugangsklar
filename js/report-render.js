/* Gemeinsamer Renderer für Prüfergebnisse (API v2, abwärtskompatibel zu v1).
   Genutzt von check.js (mit Lead-Gate) und dashboard.js (ohne Gate). Alle API-Texte nur per textContent (el()). */
(function () {
  'use strict';
  var YQ = window.YQ, el = YQ.el;

  var DISCLAIMER = 'Automatische Prüfung. Liefert Hinweise, keine Rechtsberatung und keine Garantie für Rechtskonformität.';
  // Emoji nur dekorativ (aria-hidden), die Bedeutung steht immer im Text.
  var SEV = {
    kritisch: { label: 'Kritisch', icon: '🔴', order: 0 },
    hoch: { label: 'Hoch', icon: '🟠', order: 1 },
    mittel: { label: 'Mittel', icon: '🟡', order: 2 },
    gering: { label: 'Gering', icon: '⚪', order: 3 }
  };
  var CAT_TITLES = { accessibility: 'Barrierefreiheit', privacy: 'Datenschutz', legal: 'Rechtliches', security: 'Sicherheit', seo: 'Technik & SEO' };
  var CAT_ORDER = ['accessibility', 'privacy', 'legal', 'security', 'seo'];
  var GATE_FULL = 2;
  var uid = 0;

  function scoreClass(s) { return s >= 80 ? 's-ok' : (s >= 50 ? 's-warn' : 's-crit'); }
  function scoreWord(s) { return s >= 80 ? 'gut' : (s >= 50 ? 'verbesserungswürdig' : 'kritisch'); }
  function clampScore(v) { var n = Math.round(Number(v)); return isNaN(n) ? 0 : Math.max(0, Math.min(100, n)); }
  function str(v) { return v == null ? '' : String(v); }

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
    var bar = circle('bar ' + scoreClass(score));
    bar.setAttribute('stroke-linecap', 'round');
    bar.setAttribute('stroke-dasharray', String(C));
    bar.setAttribute('stroke-dashoffset', String(C));
    svg.appendChild(circle('track')); svg.appendChild(bar);
    requestAnimationFrame(function () { bar.setAttribute('stroke-dashoffset', String(C * (1 - score / 100))); });
    return el('div', { class: 'score-ring' }, svg, el('div', { class: 'score-num' }, el('span', null, String(score), el('small', null, 'von 100'))));
  }

  /* Normalisiert v1 und v2 auf eine gemeinsame Form. legacy = v1 (keine categories). */
  function normalize(data) {
    data = data || {};
    var rawIssues = Array.isArray(data.issues) ? data.issues : [];
    var hasCats = Array.isArray(data.categories) && data.categories.length > 0;
    var catIds = hasCats ? data.categories.map(function (c) { return c.id; }) : ['accessibility'];
    var issues = rawIssues.map(function (i, idx) {
      var sev = SEV[i.severity] ? i.severity : 'mittel';
      var cat = i.category && (catIds.indexOf(i.category) !== -1 || !hasCats) ? i.category : catIds[0];
      return { _i: idx, id: i.id, category: hasCats ? cat : 'accessibility', severity: sev, title: i.title, description: i.description, fix: i.fix, count: i.count, examples: Array.isArray(i.examples) ? i.examples.filter(function (x) { return typeof x === 'string'; }) : [], wcag: i.wcag, ref: i.ref, affectedUrl: i.affectedUrl };
    }).sort(function (a, b) { return (SEV[a.severity].order - SEV[b.severity].order) || (a._i - b._i); });
    var cats;
    if (hasCats) {
      cats = data.categories.map(function (c) {
        var own = issues.filter(function (i) { return i.category === c.id; });
        return { id: c.id, title: str(c.title) || CAT_TITLES[c.id] || str(c.id), score: clampScore(c.score), weight: c.weight, issueCount: c.issueCount != null ? c.issueCount : own.length, issues: own };
      });
    } else {
      cats = [{ id: 'accessibility', title: CAT_TITLES.accessibility, score: clampScore(data.score), issueCount: issues.length, issues: issues }];
    }
    var passed = Array.isArray(data.passed) ? data.passed : [];
    var s = data.summary || {};
    var summary = {
      kritisch: s.kritisch != null ? s.kritisch : issues.filter(function (i) { return i.severity === 'kritisch'; }).length,
      hoch: s.hoch != null ? s.hoch : issues.filter(function (i) { return i.severity === 'hoch'; }).length,
      mittel: s.mittel != null ? s.mittel : issues.filter(function (i) { return i.severity === 'mittel'; }).length,
      gering: s.gering != null ? s.gering : issues.filter(function (i) { return i.severity === 'gering'; }).length,
      bestanden: s.bestanden != null ? s.bestanden : passed.length
    };
    return { legacy: !hasCats, score: clampScore(data.score), categories: cats, issues: issues, passed: passed, summary: summary };
  }

  function totals(summary) {
    function item(n, sev, label) {
      return el('li', null, el('strong', null, String(n)), sev ? sevBadge(sev) : el('span', { class: 'badge badge-bestanden' }, label));
    }
    return el('ul', { class: 'counts', 'aria-label': 'Zusammenfassung nach Priorität' },
      item(summary.kritisch, 'kritisch'), item(summary.hoch, 'hoch'), item(summary.mittel, 'mittel'), item(summary.gering, 'gering'), item(summary.bestanden, null, 'Bestanden'));
  }

  /* Score je Bereich: Text + Balken (Balken dekorativ, Wert steht im Text, Wortbewertung zusätzlich zur Farbe). */
  function catScores(cats, label) {
    var ul = el('ul', { class: 'cat-scores', 'aria-label': label || 'Score je Prüfbereich' });
    cats.forEach(function (c) {
      var fill = el('div', { class: 'bar-fill ' + scoreClass(c.score) });
      fill.style.width = c.score + '%';
      ul.appendChild(el('li', null,
        el('div', { class: 'cat-line' }, el('span', null, c.title), el('span', { class: 'cat-val' }, c.score + '/100 · ' + scoreWord(c.score))),
        el('div', { class: 'bar-track', 'aria-hidden': 'true' }, fill)));
    });
    return ul;
  }

  function issueFull(issue, level) {
    var meta = el('div', { class: 'finding-meta' },
      sevBadge(issue.severity, 'Priorität: '),
      issue.count != null ? el('span', null, issue.count + '× gefunden') : null);
    var art = el('article', { class: 'finding sev-' + issue.severity }, meta,
      h(level, { class: 'finding-title' }, str(issue.title || issue.id || 'Befund')));
    if (issue.description) art.appendChild(el('p', null, el('strong', null, 'Erklärung: '), str(issue.description)));
    if (issue.fix) art.appendChild(el('p', { class: 'fix-text' }, el('strong', null, 'Lösung: '), str(issue.fix)));
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
    var emailId = 'lead-email-' + suffix, consentId = 'lead-consent-' + suffix, msgId = 'lead-status-' + suffix;
    var f = el('form', { class: 'lead-form', id: 'lead-form-' + suffix },
      el('div', { class: 'field' }, el('label', { for: emailId }, 'E-Mail-Adresse'), el('input', { type: 'email', id: emailId, name: 'email', autocomplete: 'email', required: true, placeholder: 'name@firma.de' })),
      el('div', { class: 'field' }, el('label', { class: 'check-line', for: consentId }, el('input', { type: 'checkbox', id: consentId, name: 'consent', required: true }),
        el('span', null, 'Ich willige ein, dass Yanqiva mir das Ergebnis und einen Vorschlag zur Behebung per E-Mail sendet und meine Daten dafür speichert. Details in der ', el('a', { href: 'datenschutz.html' }, 'Datenschutzerklärung'), '. Widerruf jederzeit möglich.'))),
      el('button', { type: 'submit', class: 'btn' }, 'Befunde freischalten'),
      el('p', { id: msgId, class: 'status-msg', role: 'status', 'aria-live': 'polite' }));
    f.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = f.elements.email.value.trim();
      var btn = f.querySelector('button');
      var msg = f.querySelector('#' + msgId);
      btn.disabled = true; msg.textContent = 'Wird gesendet …';
      opts.postLead(email).then(function () {
        onDone();
      }, function (e) {
        btn.disabled = false;
        msg.textContent = e && e.kind === 'network' ? 'Der Versand ist gerade nicht erreichbar. Bitte versuchen Sie es später erneut oder schreiben Sie uns über die Kontaktseite.' : 'Fehler: ' + (e && e.message ? e.message : 'unbekannt');
      });
    });
    return f;
  }

  /**
   * render(container, data, opts)
   * opts: { level (Überschriften-Basisebene, Standard 3), headingId, title, gate (Lead-Gate aktiv), postLead(email)->Promise,
   *         ctas (3 Handlungsoptionen), url (für Bestell-Links), focus (Kategorie-ID für Start-Tab), showMeta }
   * Gibt { heading } zurück.
   */
  function render(container, data, opts) {
    opts = opts || {};
    var level = opts.level || 3;
    var d = normalize(data);
    var sfx = 'r' + (++uid);
    var gateOn = !!opts.gate && !d.legacy && typeof opts.postLead === 'function';
    var unlocked = false;
    container.textContent = '';

    var heading = h(level, { id: opts.headingId, tabindex: '-1' }, opts.title || ('Ergebnis für ' + str(data.finalUrl || data.url || opts.url)));
    container.appendChild(heading);
    if (opts.mockNotice) container.appendChild(el('p', { class: 'notice info' }, opts.mockNotice));

    var meta = [];
    if (!opts.skipSummary) {
    if (data.system && data.system !== 'unbekannt') meta.push('Erkanntes System: ' + str(data.system).charAt(0).toUpperCase() + str(data.system).slice(1));
    if (data.checkedAt) { var dt = new Date(data.checkedAt); if (!isNaN(dt)) meta.push('Geprüft am ' + dt.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })); }
    if (meta.length) container.appendChild(el('p', { class: 'muted' }, meta.join(' · ')));

    container.appendChild(el('div', { class: 'result-head' },
      scoreRing(d.score),
      el('div', { class: 'result-head-text' },
        el('p', { class: 'score-title' }, el('strong', null, 'Website-Score ' + d.score + '/100'), el('span', { class: 'muted' }, ' · ' + scoreWord(d.score))),
        totals(d.summary))));
    }

    if (data.overlayDetected) {
      container.appendChild(el('div', { class: 'notice warn' }, el('p', null, el('strong', null, 'Overlay-Widget erkannt: ' + str(data.overlayDetected) + '. '), 'Overlays beheben die Barrieren im Quelltext nicht und gelten nicht als BFSG-Lösung. ', el('a', { href: 'ratgeber/overlay-widgets-bfsg.html' }, 'Warum Overlays nicht reichen'), '.')));
    }

    if (!d.legacy && !opts.skipSummary) {
      container.appendChild(h(level + 1, null, 'Score je Prüfbereich'));
      container.appendChild(catScores(d.categories));
    }

    // Befunde
    var panels = [];
    function fillPanel(p) {
      var cat = p.cat;
      p.node.textContent = '';
      p.node.appendChild(h(level + 2, { class: 'panel-title' }, cat.title + ' – Score ' + cat.score + '/100'));
      if (!cat.issues.length) {
        p.node.appendChild(el('div', { class: 'notice success' }, el('p', null, 'Die automatische Prüfung hat in diesem Bereich keine Befunde gefunden. Das ist noch keine Bestätigung der Konformität.')));
        return;
      }
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
        p.node.appendChild(el('div', { class: 'gate-callout notice info' },
          h(level + 3, null, 'Alle ' + total + ' Befunde mit Lösungen ansehen – kostenlos per E-Mail'),
          el('p', null, 'Tragen Sie Ihre E-Mail-Adresse ein. Dann sehen Sie sofort zu allen Befunden Erklärung, Lösung und betroffene Adresse.'),
          leadForm(opts, sfx + '-' + cat.id, function () { unlockAll(); })));
      }
    }
    function unlockAll() {
      unlocked = true;
      panels.forEach(fillPanel);
      var active = panels.filter(function (p) { return !p.node.hidden; })[0];
      if (active && active.unlockNote) active.unlockNote.focus();
    }

    var withIssues = d.issues.length > 0;
    container.appendChild(h(level + 1, null, withIssues ? 'Befunde nach Bereich (' + d.issues.length + ')' : 'Befunde'));
    if (!withIssues) {
      container.appendChild(el('div', { class: 'notice success' }, el('p', null, 'Die automatische Prüfung hat auf der Startseite keine Befunde gefunden. Das ist noch keine Konformität: Tastaturbedienung, Checkout, Verständlichkeit und rechtliche Inhalte prüft nur der vollständige Report.')));
    } else if (d.categories.length > 1) {
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
      function select(i, focus) {
        tabs.forEach(function (p, idx) {
          var on = idx === i;
          p.tab.setAttribute('aria-selected', on ? 'true' : 'false');
          p.tab.tabIndex = on ? 0 : -1;
          p.node.hidden = !on;
        });
        if (focus) tabs[i].tab.focus();
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
    } else {
      var only = { cat: d.categories[0], node: el('div', { class: 'tabpanel single' }) };
      panels.push(only);
      fillPanel(only);
      container.appendChild(only.node);
    }

    if (d.passed.length) {
      var pl = el('ul', null);
      d.passed.forEach(function (p) {
        var ct = !d.legacy && p.category ? (CAT_TITLES[p.category] || p.category) : null;
        pl.appendChild(el('li', null, str(p.title || p.id), ct ? el('span', { class: 'muted' }, ' (' + ct + ')') : null));
      });
      container.appendChild(el('details', { class: 'disclosure' }, el('summary', null, 'Bestanden (' + d.passed.length + ' Prüfungen)'), pl));
    }

    if (data.note) container.appendChild(el('p', { class: 'hint', style: 'margin-top:1.25rem' }, str(data.note)));
    container.appendChild(el('p', { class: 'hint disclaimer' }, str(data.disclaimer) || DISCLAIMER));

    if (opts.ctas) container.appendChild(ctaBox(opts, level, d));
    if (opts.legacyLead && d.legacy && typeof opts.postLead === 'function') {
      container.appendChild(el('div', { class: 'lead-box' },
        h(level + 1, null, 'Das Ergebnis per E-Mail erhalten'),
        leadForm(opts, sfx + '-legacy', function () {
          var m = container.querySelector('#lead-status-' + sfx + '-legacy');
          if (m) m.textContent = 'Danke. Wir melden uns mit Ihrem Ergebnis und einem Vorschlag, wie Sie die wichtigsten Punkte beheben.';
        })));
    }

    return { heading: heading, summary: d.summary, score: d.score };
  }

  function ctaBox(opts, level, d) {
    var q = opts.url ? '&url=' + encodeURIComponent(opts.url) : '';
    return el('div', { class: 'lead-box cta-box' },
      h(level + 1, null, 'Nächste Schritte'),
      el('p', null, 'Der Website-Report prüft bis zu 10 Seiten, nennt je Befund die Stelle und den Lösungsvorschlag und enthält eine Checkliste für die manuellen Prüfpunkte.'),
      el('ul', { class: 'cta-list' },
        el('li', null, el('a', { class: 'btn', href: 'bestellen.html?produkt=report' + q }, 'Vollständigen Website-Report bestellen (149 €)')),
        el('li', null, el('a', { class: 'btn btn-secondary', href: 'bestellen.html?produkt=monitoring' + q }, 'Automatische Überwachung aktivieren (ab 29 €/Monat)')),
        el('li', null, el('a', { class: 'btn btn-secondary', href: 'fix.html' }, 'Probleme beheben lassen (Yanqiva Fix)'))),
      el('p', { class: 'hint' }, 'Alle Preise netto zzgl. MwSt.'));
  }

  YQ.report = { render: render, normalize: normalize, scoreRing: scoreRing, catScores: catScores, sevBadge: sevBadge, scoreClass: scoreClass, scoreWord: scoreWord, clampScore: clampScore, SEV: SEV, CAT_TITLES: CAT_TITLES, CAT_ORDER: CAT_ORDER, DISCLAIMER: DISCLAIMER };
})();
