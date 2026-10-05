/* Produktempfehlung zum kostenlosen Website-Check. Reine Funktion, ohne DOM (Node-testbar: tools/site-build/recommend.test.mjs).

   recommend(result) -> { rule, primary, alternatives[], reason, why[], notes[], disclaimer, leadLine }
   result = API-Ergebnis (v1/v2): { score, system, categories[{id,score}], issues[{id,category,severity}] }.
   Produkt-Schlüssel entsprechen bestellen.html?produkt=<key> (siehe order.js).

   Regeln (erste passende gewinnt):
   P  "poor"   Gesamt-Score < 50, ODER >= 3 Bereiche < 60, ODER veraltetes jQuery (sec-old-jquery) + >= 4 Barrierefreiheits-Befunde
               -> neues Website-Projekt (Business ab 590 EUR als Projektanfrage; bei Shop-System shopify/woocommerce/shopware zusätzlich Premium als Hinweis).
               Alternativen: Website-Report 149 EUR (wird bei Website-Bestellung angerechnet), Fix-Paket ab 490 EUR.
   H  "heavy"  Barrierefreiheit (ohne Erklärungs-Link): >= 3 Befunde kritisch/hoch ODER >= 6 Befunde insgesamt
               -> Website-Report 149 EUR als erster Schritt ("damit Sie wissen, was genau zu tun ist"); Alternative Fix-Paket ab 490 EUR.
   A  "a11y"   1-5 Barrierefreiheits-Befunde (ohne Erklärungs-Link), nicht heavy -> Barrierefreiheits-Fix-Paket ab 490 EUR;
               Alternativen: Report 149 EUR, ggf. Einzel-Fixes (Erklärung/Fonts).
   F  "fixes"  Keine sonstigen Barrierefreiheits-Befunde, aber Einzel-Fixes möglich:
               Erklärung fehlt (a11y-statement) 99 EUR; Google Fonts extern (privacy-google-fonts) 149 EUR;
               Security-Header fehlen (sec-hsts/csp/nosniff/frame/referrer) 149 EUR, NUR wenn Server-/Hosting-Zugriff
               plausibel ist (nicht bei Shopify -> dann nur Hinweis). 1 Fix -> dieser Fix, mehrere -> Liste mit Summe (Endpreise).
   N  "none"   Score >= 95, keine kritisch/hoch-Befunde, hoechstens 3 mittel-Befunde (Rest gering): KEIN Kauf noetig.
               Primaer = "Kein Kauf noetig" (ohne Preis, ohne Bestell-CTA), Liste "Kleinigkeiten zum Selbermachen" (max. 3),
               CTA nur "in ein paar Monaten erneut kostenlos pruefen". Monitoring nur als kleine Textnotiz, nie als Empfehlung.
   G  "good"   Score >= 85, keine kritisch/hoch, nicht "none": ein Fix hat Vorrang, wenn er sich wirklich lohnt
               (>= 3 Barrierefreiheits-Befunde -> Fix-Paket ab 490 EUR; Security-Header mit mittel-Befund und Serverzugriff -> 149 EUR;
               siehe auch F). Sonst Regel "monitoring".
   M  "monitoring" Score 85-94 (oder >= 95 mit > 3 mittel) ohne kritisch/hoch und ohne lohnenden Fix: Monitoring 29 EUR/Monat,
               ehrlich gerahmt ("gut, aber kleine Luecken; meldet, wenn Updates neue Probleme bringen"), plus Selbermach-Liste,
               Alternative Report 149 EUR.
   Security-Header nur mit gering-Befunden werden nicht verkauft, nur als Selbermach-Hinweis genannt.
   R  "report" Rest (z. B. Datenschutz-/Rechtsbefunde, die technisch genauer untersucht werden sollten) -> Website-Report 149 EUR;
               Alternativen: Monitoring, individuelle Umsetzung nach Angebot.
   Immer: Hinweis, dass es ein automatischer Vorschlag auf Basis der Startseite ist, der kostenlose Check nur einen Teil
   der Probleme findet und keine Rechtskonformität zugesichert wird. Alle Preise sind Endpreise (Kleinunternehmer § 19 UStG). */
(function (root) {
  'use strict';

  // Fallback-Preise (Stand 2026-10-03); werden unten durch window.YQ_CATALOG (js/catalog.js, generiert aus tools/site-build/catalog.mjs) überschrieben.
  var FALLBACK_PRODUCTS = {
    'report': { name: 'Website-Report', price: '149 €', short: 'Analyse bis zu 10 Seiten, PDF mit Code-Fixes' },
    'monitoring': { name: 'Monitoring', price: '29 €/Monat', short: 'wöchentlicher Scan, Score-Verlauf, Alerts' },
    'fix-erklaerung': { name: 'Barrierefreiheitserklärung + Footer-Link', price: '99 €', amount: 99 },
    'fix-google-fonts': { name: 'Google Fonts lokal einbinden', price: '149 €', amount: 149 },
    'fix-security-header': { name: 'Security-Header einrichten', price: '149 €', amount: 149 },
    'fix-a11y': { name: 'Barrierefreiheits-Fix-Paket', price: 'ab 490 €', amount: 490 },
    'fix-individuell': { name: 'Individuelle Umsetzung', price: 'nach Angebot' },
    'website-business': { name: 'Neue Website Business', price: 'ab 590 €' },
    'website-premium': { name: 'Neue Website Premium', price: 'ab 1.490 €' }
  };
  var CAT = (root.YQ_CATALOG && root.YQ_CATALOG.products) || {};
  var PRODUCTS = {};
  Object.keys(FALLBACK_PRODUCTS).forEach(function (k) {
    var f = FALLBACK_PRODUCTS[k], c = CAT[k], o = {};
    for (var x in f) o[x] = f[x];
    if (c) {
      if (c.priceTextShort) o.price = c.priceTextShort;
      if (f.amount != null && typeof c.price === 'number') o.amount = c.price;
    }
    PRODUCTS[k] = o;
  });
  var HEADER_IDS = ['sec-hsts', 'sec-csp', 'sec-nosniff', 'sec-frame', 'sec-referrer'];
  var SHOPS = ['shopify', 'woocommerce', 'shopware'];
  var HOSTED_NO_HEADERS = ['shopify'];
  var DISCLAIMER = 'Das ist ein automatischer Vorschlag auf Basis Ihrer Startseite. Der kostenlose Check findet nur einen Teil der möglichen Probleme und ersetzt weder eine manuelle Prüfung noch eine Rechtsberatung. Eine Zusicherung der Rechtskonformität ist damit nicht verbunden.';

  function catOf(i) {
    if (i.category) return i.category;
    var id = String(i.id || '');
    if (/^privacy-/.test(id)) return 'privacy';
    if (/^legal-/.test(id)) return 'legal';
    if (/^sec-/.test(id)) return 'security';
    if (/^seo-/.test(id)) return 'seo';
    return 'accessibility';
  }
  function item(key, extra) {
    var p = PRODUCTS[key];
    var o = { key: key, name: p.name, price: p.price };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function eur(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' €'; }
  function firstSentence(t) { t = String(t).trim(); var m = /[.!] /.exec(t); return m ? t.slice(0, m.index + 1) : t; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  var CAT_NAMES = { accessibility: 'Barrierefreiheit', privacy: 'Datenschutz', legal: 'Pflichtangaben', security: 'Sicherheit', seo: 'Technik & SEO' };
  function joinDe(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1]; }

  /* Kurze, individuelle Einschätzung (2-3 Sätze, Sie-Ansprache). Nie "rechtskonform": unauffällig statt konform. */
  function assess(score, cats, issues, system, sevCount, a11yVerify, noneMode) {
    var named = cats.filter(function (c) { return CAT_NAMES[c.id] && isFinite(Number(c.score)); }).map(function (c) { return { id: c.id, name: CAT_NAMES[c.id], score: Math.round(Number(c.score)) }; });
    var sysName = system && system !== 'unbekannt' ? ({ woocommerce: 'WooCommerce', shopify: 'Shopify', shopware: 'Shopware' }[system] || system.charAt(0).toUpperCase() + system.slice(1)) : '';
    var subject = 'Ihre Website' + (sysName ? ' (' + sysName + ')' : '');
    var s1 = subject + ' erreicht ' + score + '/100';
    var tone = score >= 95 ? 'excellent' : score >= 85 ? 'good' : score >= 70 ? 'solid' : score >= 50 ? 'weak' : 'poor';
    s1 += tone === 'excellent' ? ' und steht damit insgesamt sehr gut da.' : tone === 'good' ? ' und ist gut, hat aber kleine Lücken.' : tone === 'solid' ? ' und ist insgesamt solide, hat aber erkennbare Lücken.' : tone === 'weak' ? ' und hat in mehreren Punkten Nachholbedarf.' : ' und hat deutlichen Handlungsbedarf.';
    var out = [s1];
    if (noneMode) out = [subject + ' ist auf der Startseite in sehr gutem Zustand (Score ' + score + '/100). Wir sehen aktuell keinen Grund, etwas bei uns zu kaufen.'];
    if (named.length >= 2) {
      var sorted = named.slice().sort(function (a, b) { return b.score - a.score; });
      var strong = sorted.filter(function (c) { return c.score >= 80; }).slice(0, 2);
      var weak = sorted.slice().reverse().filter(function (c) { return c.score < 70 || (sevCount[c.id] || 0) >= 2; }).slice(0, 2);
      var parts = [];
      if (strong.length) parts.push((strong.length > 1 ? 'Stark sind ' : 'Stark ist ') + joinDe(strong.map(function (c) { return c.name + ' (' + c.score + ')'; })));
      if (weak.length) {
        var txt = (weak[0].score < 50 ? 'dringenden' : 'deutlichen') + ' Handlungsbedarf gibt es bei ' + joinDe(weak.map(function (c) {
          var sv = sevCount[c.id] || 0;
          var stmt = c.id === 'accessibility' && sevCount.stmt ? 'dazu fehlt der Link zur Barrierefreiheitserklärung' : '';
          var det = [sv ? (sv === 1 ? '1 kritischer oder hoher Befund' : sv + ' kritische oder hohe Befunde') : '', stmt].filter(Boolean).join(', ');
          return c.name + ' (' + c.score + '/100' + (det ? ', ' + det : '') + ')';
        }));
        parts.push(strong.length ? txt : txt.charAt(0).toUpperCase() + txt.slice(1));
      }
      var s2 = parts.join('; ');
      if (s2) out.push(s2.charAt(0) + s2.slice(1) + '.');
      var calm = sorted.filter(function (c) { return c.score >= 70 && strong.indexOf(c) === -1; });
      if (!weak.length && !strong.length && calm.length) out.push(joinDe(calm.map(function (c) { return c.name; })) + ' ' + (calm.length > 1 || calm[0].name === 'Pflichtangaben' ? 'sind' : 'ist') + ' auf der Startseite unauffällig.');
      else if (weak.length && (strong.length || calm.length)) {
        var quiet = sorted.filter(function (c) { return c.score >= 90 && !sevCount[c.id]; }).map(function (c) { return c.name; }).filter(function (n) { return !strong.some(function (c) { return c.name === n; }); });
        if (quiet.length) out.push(joinDe(quiet) + ' ' + (quiet.length > 1 || quiet[0] === 'Pflichtangaben' ? 'sind' : 'ist') + ' auf der Startseite unauffällig.');
      }
    } else if (sevCount.total) {
      out.push('Es gibt ' + (sevCount.total === 1 ? '1 kritischen oder hohen Befund' : sevCount.total + ' kritische oder hohe Befunde') + '.');
    }
    if (a11yVerify || named.length < 2) out.push('Einzelne Punkte konnten automatisch nicht abschließend geprüft werden.');
    return out.join(' ');
  }

  function recommend(result) {
    var r = result || {};
    var issues = (Array.isArray(r.issues) ? r.issues : []).filter(function (i) { return i && typeof i === 'object'; });
    var rawScore = (r.score === null || r.score === undefined || r.score === '' || typeof r.score === 'boolean') ? NaN : Number(r.score);
    var score = Math.round(rawScore);
    var system = String(r.system || '').toLowerCase();
    var isShop = SHOPS.indexOf(system) !== -1;
    var ids = {}, sev = { kritisch: 0, hoch: 0 };
    var a11yOthers = 0, a11ySevere = 0, uncoveredSevere = 0, sevByCat = { total: 0 };
    issues.forEach(function (i) {
      var id = String(i.id || ''), cat = catOf(i), severe = i.severity === 'kritisch' || i.severity === 'hoch';
      ids[id] = true;
      if (severe) { sev[i.severity]++; if (id !== 'a11y-statement') { sevByCat[cat] = (sevByCat[cat] || 0) + 1; sevByCat.total++; } }
      if (id === 'a11y-statement') sevByCat.stmt = true;
      if (cat === 'accessibility' && id !== 'a11y-statement') { a11yOthers++; if (severe) a11ySevere++; }
      else if (severe && id !== 'a11y-statement' && id !== 'privacy-google-fonts' && HEADER_IDS.indexOf(id) === -1) uncoveredSevere++;
    });
    var cats = (Array.isArray(r.categories) ? r.categories : []).filter(function (c) { return c && typeof c === 'object'; });
    var lowCats = cats.filter(function (c) { return Number(c.score) < 60; }).length;
    var oldJq = !!ids['sec-old-jquery'];
    var headerIssues = HEADER_IDS.filter(function (id) { return ids[id]; }).length;
    var notes = [], why = [];
    // Fehlender, nicht numerischer oder außerhalb 0-100 liegender Score: keine Aussage über Zustand oder Neubau erfinden.
    // Sicherer Standard: Report als Überblick (ohne Score-Aussage).
    if (!isFinite(score) || score < 0 || score > 100) {
      why.push('Der Score konnte nicht ausgewertet werden. Der Report zeigt technisch genau, was auf allen wichtigen Seiten zu tun ist.');
      var pr = item('report', { cta: 'Website-Report bestellen' });
      return { rule: 'report', assessment: 'Das Ergebnis des kostenlosen Checks konnte nicht vollständig ausgewertet werden. Einzelne Punkte konnten automatisch nicht abschließend geprüft werden.', selfFix: [], primary: pr,
        alternatives: [item('monitoring', { why: 'Wöchentlicher Scan und Score-Verlauf' })], reason: 'Erst den Überblick über alle Befunde schaffen.', why: why, notes: notes, disclaimer: DISCLAIMER,
        leadLine: 'Empfehlung: report (' + pr.price + ') | Score nicht auswertbar | Erst den Überblick über alle Befunde schaffen.' };
    }
    var mittelCount = issues.filter(function (i) { return i.severity === 'mittel'; }).length;

    var noneEligible = score >= 95 && sev.kritisch === 0 && sev.hoch === 0 && mittelCount <= 3;
    var assessment = assess(score, cats, issues, system, sevByCat, !!ids['privacy-trackers-verify'], noneEligible);
    var selfFix = [];
    issues.filter(function (i) { return i.severity === 'mittel' || i.severity === 'gering'; })
      .sort(function (a, b) { return (a.severity === 'mittel' ? 0 : 1) - (b.severity === 'mittel' ? 0 : 1); })
      .forEach(function (i) {
        if (selfFix.length >= 3) return;
        var t = String(i.title || i.id || '').trim();
        var fx = firstSentence(String(i.fix || ''));
        if (fx.length > 160) fx = fx.slice(0, 157).replace(/ [^ ]*$/, '') + ' …';
        if (t) selfFix.push(fx ? t + ': ' + fx : t);
      });
    function done(rule, primary, alts, reason) {
      var label = primary.items ? primary.items.map(function (x) { return x.key; }).join(' + ') : primary.key;
      var first = firstSentence(assessment);
      var line = primary.noSale ? 'Empfehlung: keine (Website gut) | ' + first + ' | ' + reason : 'Empfehlung: ' + label + ' (' + primary.price + ') | ' + first + ' | ' + reason;
      return { rule: rule, assessment: assessment, selfFix: selfFix, primary: primary, alternatives: alts.slice(0, 2), reason: reason, why: why, notes: notes, disclaimer: DISCLAIMER, leadLine: line };
    }

    // Einzel-Fixes ermitteln (für F, A und Hinweise)
    var fixes = [];
    if (ids['a11y-statement']) fixes.push(item('fix-erklaerung'));
    if (ids['privacy-google-fonts']) fixes.push(item('fix-google-fonts'));
    var headersSkipped = false;
    var headerMittel = issues.some(function (i) { return HEADER_IDS.indexOf(i.id) !== -1 && i.severity !== 'gering'; });
    if (headerIssues) {
      if (HOSTED_NO_HEADERS.indexOf(system) !== -1) headersSkipped = true;
      else if (headerMittel) fixes.push(item('fix-security-header'));
    }
    if (headersSkipped) notes.push('Fehlende Security-Header lassen sich bei Shopify nicht selbst setzen. Dafür empfehlen wir keine Umsetzung, sie sind hier ohnehin nur ein geringes Risiko.');
    else if (headerIssues && headerMittel) notes.push('Security-Header setzen wir nur, wenn wir Zugriff auf die Server- oder Hosting-Konfiguration bekommen.');
    else if (headerIssues) notes.push('Einzelne fehlende Security-Header (geringes Risiko) können Sie bei Zugriff auf Ihr Hosting selbst setzen oder Ihrem Hoster mitteilen. Dafür verkaufen wir nichts.');
    if (uncoveredSevere > 0) notes.push(plural(uncoveredSevere, 'weiterer wichtiger Befund', 'weitere wichtige Befunde') + ' (z. B. Datenschutz oder Rechtliches) ' + (uncoveredSevere === 1 ? 'ist' : 'sind') + ' in dieser Empfehlung nicht eingerechnet. Die technische Umsetzung übernehmen wir gern; die rechtliche Bewertung klären Sie bitte mit Ihrem Datenschutzbeauftragten oder einer Anwältin bzw. einem Anwalt.');
    var reportAlt = item('report', { why: 'Alle Befunde auf bis zu 10 Seiten, mit Fundstelle und Lösung als PDF' });

    function doneMonitoring() {
      why.push('Score ' + score + ' von 100 und keine Befunde mit Priorität kritisch oder hoch: Ihre Website ist gut, hat aber kleine Lücken.');
      why.push('Monitoring prüft wöchentlich und meldet, wenn durch Updates neue Probleme dazukommen.');
      return done('monitoring', item('monitoring', { cta: 'Monitoring aktivieren' }),
        [item('report', { why: 'Wenn Sie es genauer wissen wollen: bis zu 10 Seiten und manuelle Checkliste' })],
        'Gut, aber nicht lückenlos: Monitoring meldet neue Probleme, bevor sie auffallen.');
    }
    function doneNone() {
      why.push('Score ' + score + ' von 100 und keine Befunde mit Priorität kritisch oder hoch.');
      why.push('Der kostenlose Check prüft nur die Startseite und findet nur einen Teil möglicher Probleme. Das Ergebnis ist ein Hinweis, keine Zusicherung der Rechtskonformität.');
      notes.push('Falls Sie Ihre Website häufig ändern, kann Monitoring (' + PRODUCTS.monitoring.price + ') später sinnvoll sein.');
      return done('none', { key: 'none', name: 'Kein Kauf nötig', price: null, noSale: true, cta: 'In ein paar Monaten erneut kostenlos prüfen' }, [],
        'Ihre Website ist in gutem Zustand, Sie müssen aktuell nichts bei uns kaufen.');
    }

    // P: sehr schlechtes Gesamtbild -> Neubau
    if (score < 50 || lowCats >= 3 || (oldJq && a11yOthers >= 4)) {
      var up = 'website-business'; // Website-Projekte nur als Projektanfrage (individuelles Angebot)
      if (score < 50) why.push('Der Gesamt-Score liegt bei ' + score + ' von 100.');
      if (lowCats >= 3) why.push(lowCats + ' von ' + cats.length + ' Prüfbereichen liegen unter 60 von 100.');
      if (oldJq) why.push('Es wird ein veraltetes jQuery verwendet, das auf eine alte technische Basis hinweist.');
      if (a11yOthers) why.push(plural(a11yOthers, 'Barrierefreiheits-Befund', 'Barrierefreiheits-Befunde') + ' kommen dazu.');
      why.push('Bei so vielen Baustellen ist ein Neubau oft günstiger als die Reparatur der alten Seite.');
      if (isShop) notes.push('Erkanntes Shop-System: ' + system.charAt(0).toUpperCase() + system.slice(1) + '. Für Shops mit größerem Funktionsumfang (Shop, Mitgliederbereich) passt Premium, ein individuelles Angebot mit Orientierung ' + PRODUCTS['website-premium'].price + '.');
      notes.push('Wenn Sie vorher den Website-Report (' + PRODUCTS.report.price + ') bestellen, wird der Preis bei einem späteren Website-Auftrag angerechnet.');
      return done('poor', item(up, { cta: 'Website-Projekt anfragen' }),
        [reportAlt, item('fix-a11y', { why: 'Reparatur der bestehenden Seite, Festpreis nach Sichtung' })],
        'Neubau statt Reparatur ist hier voraussichtlich die wirtschaftlichere Lösung.');
    }

    // H: viele schwere Barrierefreiheits-Befunde -> erst Report
    if (a11ySevere >= 3 || a11yOthers >= 6) {
      why.push(plural(a11ySevere, 'Barrierefreiheits-Befund ist', 'Barrierefreiheits-Befunde sind') + ' kritisch oder hoch (insgesamt ' + a11yOthers + ' in diesem Bereich' + (ids['a11y-statement'] ? ', ohne den fehlenden Link zur Barrierefreiheitserklärung, der separat gezählt wird' : '') + ').');
      why.push('Der kostenlose Check prüft nur die Startseite. Bevor Sie Geld in Reparaturen stecken, zeigt der Report, was auf allen wichtigen Seiten genau zu tun ist.');
      if (fixes.length) notes.push('Kleine Einzel-Fixes (' + fixes.map(function (f) { return f.name; }).join(', ') + ') lassen sich zusätzlich beauftragen.');
      return done('heavy', item('report', { cta: 'Website-Report bestellen' }),
        [item('fix-a11y', { why: 'Alt-Texte, Labels, Kontraste, Überschriften im Theme, Festpreis nach Sichtung' })],
        'Erst wissen, was genau zu tun ist – dann gezielt beheben.');
    }

    // N: nichts zu kaufen noetig
    if (noneEligible) return doneNone();

    // A: einzelne Barrierefreiheits-Befunde
    if (a11yOthers >= 1 && !(score >= 85 && sev.kritisch === 0 && sev.hoch === 0)) {
      why.push(plural(a11yOthers, 'Barrierefreiheits-Befund', 'Barrierefreiheits-Befunde') + ' auf der Startseite, die sich im Theme beheben lassen.');
      if (fixes.length) why.push('Zusätzlich: ' + fixes.map(function (f) { return f.name + ' (' + f.price + ')'; }).join(', ') + '.');
      var altsA = [reportAlt];
      if (fixes.length) altsA.push(item('fix-individuell', { why: 'Einzel-Fixes zusammen nach Angebot' }));
      return done('a11y', item('fix-a11y', { cta: 'Fix-Paket anfragen' }), altsA,
        'Die Befunde sind überschaubar und lassen sich als Paket zum Festpreis beheben.');
    }

    // F: nur Einzel-Fixes
    if (fixes.length) {
      var total = fixes.reduce(function (s, f) { return s + (PRODUCTS[f.key].amount || 0); }, 0);
      var primary;
      if (fixes.length === 1) {
        primary = fixes[0]; primary.cta = 'Fix bestellen';
        if (primary.key === 'fix-erklaerung') why.push('Sonst ist auf der Startseite kein Befund zur Barrierefreiheit offen, nur der Link zur Barrierefreiheitserklärung fehlt.');
        if (primary.key === 'fix-google-fonts') why.push('Schriften werden von Google-Servern geladen. Lokal eingebunden entfällt die Übermittlung der IP-Adresse.');
        if (primary.key === 'fix-security-header') why.push('Es fehlen Security-Header (geringes bis mittleres Risiko), die sich in der Server-Konfiguration setzen lassen.');
      } else {
        primary = { key: 'fix-bundle', name: 'Einzel-Fixes im Paket', price: eur(total), items: fixes, cta: 'Fixes bestellen' };
        why.push('Mehrere klar abgegrenzte Einzel-Fixes: ' + fixes.map(function (f) { return f.name + ' ' + f.price; }).join(' + ') + ' = ' + eur(total) + '.');
      }
      var altsF = [reportAlt];
      if (score >= 80) altsF.push(item('monitoring', { why: 'Wöchentlicher Scan, damit es so bleibt' }));
      return done('fixes', primary, altsF, fixes.length === 1 ? 'Ein einzelner, klar abgegrenzter Fix löst den Hauptbefund.' : 'Wenige klar abgegrenzte Fixes, die zusammen ' + eur(total) + ' kosten.');
    }

    // G: Score gut, aber mehr als 3 mittel-Befunde: nur bei wirklich lohnendem Fix etwas empfehlen, sonst none
    if (score >= 85 && sev.kritisch === 0 && sev.hoch === 0) {
      if (a11yOthers >= 3) {
        why.push(plural(a11yOthers, 'Barrierefreiheits-Befund', 'Barrierefreiheits-Befunde') + ' (mittel oder gering) summieren sich; als Paket zum Festpreis ist das schneller erledigt.');
        return done('good', item('fix-a11y', { cta: 'Fix-Paket anfragen' }), [], 'Die Gesamtlage ist gut, die Barrierefreiheits-Kleinigkeiten lohnen sich als Paket.');
      }
      if (fixes.length === 1 && fixes[0].key === 'fix-security-header') {
        why.push('Mehrere Sicherheits-Hinweise (mittel) lassen sich in der Server-Konfiguration gebündelt beheben.');
        return done('good', fixes[0], [], 'Die Gesamtlage ist gut, ein einzelner Fix schließt die Sicherheitslücken.');
      }
      return doneMonitoring();
    }

    // R: Rest
    why.push('Die offenen Befunde betreffen vor allem Datenschutz, Rechtliches oder Technik. Der Report zeigt technisch genau, was auf allen wichtigen Seiten zu tun ist; rechtliche Fragen klären Sie bitte mit Ihrem Datenschutzbeauftragten oder einer Anwältin bzw. einem Anwalt.');
    why.push('Der Report nennt je Befund die Stelle und den Lösungsvorschlag und prüft bis zu 10 Seiten.');
    return done('report', item('report', { cta: 'Website-Report bestellen' }),
      [item('monitoring', { why: 'Wöchentlicher Scan und Score-Verlauf' }), item('fix-individuell', { why: 'Umsetzung nach Sichtung Ihrer Befunde' })],
      'Erst den Überblick über alle Befunde schaffen.');
  }

  var api = { recommend: recommend, PRODUCTS: PRODUCTS, DISCLAIMER: DISCLAIMER };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (root.YQ) root.YQ.recommend = api;
})(typeof window !== 'undefined' ? window : globalThis);
