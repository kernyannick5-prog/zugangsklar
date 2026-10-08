/* Lösungsvorschlag zum kostenlosen Website-Check (Scan -> Ergebnis -> passende Lösung). Reine Funktion, ohne DOM (Node-testbar: tools/site-build/recommend.test.mjs).

   recommend(result) -> { rule, assessment, categories[], flagged[], selfFix[], primary, alternatives[], also[], reason, why[], notes[], disclaimer, leadLine }
   result = API-Ergebnis (v1/v2/v3): { score, system, categories[{id,score}], issues[{id,category,severity}] }.
   Produkt-Schlüssel entsprechen bestellen.html?produkt=<key> (siehe order.js): einzel-fix, fix-paket, monitoring, report, website-*.

   Prüfbereiche (docs/CHECKER_V3.md): accessibility, privacy, legal, security, seo, technical, performance, mobile.
   Ampel je Bereich (Text und Farbe, nie nur Farbe): "Kritisch" (Score < 50 oder kritischer Befund), "Optimierung empfohlen"
   (Score < 75 oder Befund "hoch"), sonst "Gut"; ohne Score "Nicht bewertet". Die Grenzen entsprechen der Einstufung des Checkers
   (kritisch < 50, verbesserungswürdig < 75, gut ab 75). "Auffällig" = Ampel Kritisch oder Optimierung empfohlen.

   Regeln:
   S  "single"  Genau ein auffälliger Bereich mit genau einem relevanten Problem -> Einzel-Fix 99 EUR (ein konkretes Problem), Link bestellen?produkt=einzel-fix&kategorie=<id>.
   M  "multi"   Mehrere Probleme (mehrere auffällige Bereiche oder mehrere Probleme in einem Bereich) -> Fix-Paket ab 299 EUR.
   N  "monitoring" Kein auffälliger Bereich -> Monitoring 29 EUR/Monat (ehrlich gerahmt, plus Selbermach-Liste).
   U  "unrated" Score nicht auswertbar -> keine Empfehlung zum Kauf, Check erneut starten.
   Monitoring steht sonst immer dezent als Zusatzoption, der Website-Report (99 EUR) als Option für eine genauere Analyse. Der direkte Weg
   Scan -> Einzel-Fix/Fix-Paket verlangt keinen Report. Sehr schlechtes Gesamtbild (Score < 50 oder viele schwache Bereiche): zusätzlich Hinweis auf ein Website-Projekt.
   Immer: Hinweis, dass es ein automatischer Vorschlag auf Basis der Startseite ist, der kostenlose Check nur einen Teil
   der Probleme findet und keine Rechtskonformität zugesichert wird. Alle Preise sind Endpreise (Kleinunternehmer § 19 UStG). */
(function (root) {
  'use strict';

  // Fallback-Preise; werden unten durch window.YQ_CATALOG (js/catalog.js, generiert aus tools/site-build/catalog.mjs) überschrieben.
  var FALLBACK_PRODUCTS = {
    'report': { name: 'Website-Report', price: '99 €', amount: 99, short: 'Analyse bis zu 10 Seiten, PDF mit Lösungsvorschlägen' },
    'monitoring': { name: 'Monitoring', price: '29 €/Monat', short: 'wöchentlicher Scan, Score-Verlauf, Alerts' },
    'einzel-fix': { name: 'Einzel-Fix', price: '99 €', amount: 99 },
    'fix-paket': { name: 'Fix-Paket', price: 'ab 299 €', amount: 299 },
    'website-basic': { name: 'Neue Website Basic', price: /*YQ:priceTextShort:website-basic*/'249 € (Einführungspreis bis 31.12.2026)'/*YQ*/, intro: /*YQ:introSentence:website-basic*/'Einführungspreis 249 € für Anfragen bis 31.12.2026, danach 399 €'/*YQ*/ },
    'website-business': { name: 'Neue Website Business', price: 'ab 690 €' },
    'website-premium': { name: 'Neue Website Premium', price: 'ab 1.690 €' }
  };
  var CAT = (root.YQ_CATALOG && root.YQ_CATALOG.products) || {};
  var PRODUCTS = {};
  Object.keys(FALLBACK_PRODUCTS).forEach(function (k) {
    var f = FALLBACK_PRODUCTS[k], c = CAT[k], o = {};
    for (var x in f) o[x] = f[x];
    if (c) {
      if (c.priceTextShort) o.price = c.priceTextShort;
      if (k === 'website-basic') o.intro = c.introSentence || '';
      if (f.amount != null && typeof c.price === 'number') o.amount = c.price;
    }
    PRODUCTS[k] = o;
  });
  var CAT_IDS = ['accessibility', 'privacy', 'legal', 'security', 'seo', 'technical', 'performance', 'mobile'];
  var CAT_NAMES = { accessibility: 'Barrierefreiheit', privacy: 'Datenschutz', legal: 'Rechtliches', security: 'Sicherheit', seo: 'SEO', technical: 'Technik', performance: 'Performance', mobile: 'Mobil' };
  var STATUS = {
    crit: { id: 'crit', label: 'Kritisch', sym: '▲', order: 0 },
    warn: { id: 'warn', label: 'Optimierung empfohlen', sym: '◆', order: 1 },
    ok: { id: 'ok', label: 'Gut', sym: '●', order: 2 },
    none: { id: 'none', label: 'Nicht bewertet', sym: '○', order: 3 }
  };
  var DISCLAIMER = 'Das ist ein automatischer Vorschlag auf Basis Ihrer Startseite. Der kostenlose Check findet nur einen Teil der möglichen Probleme und ersetzt weder eine manuelle Prüfung noch eine Rechtsberatung. Eine Zusicherung der Rechtskonformität ist damit nicht verbunden.';

  function catOf(i) {
    if (i.category && CAT_NAMES[i.category]) return i.category;
    var id = String(i.id || '');
    if (/^privacy-/.test(id)) return 'privacy';
    if (/^legal-/.test(id)) return 'legal';
    if (/^sec-/.test(id)) return 'security';
    if (/^seo-/.test(id)) return 'seo';
    if (/^tech-/.test(id)) return 'technical';
    if (/^perf-/.test(id)) return 'performance';
    if (/^mob-/.test(id)) return 'mobile';
    return 'accessibility';
  }
  function item(key, extra) {
    var p = PRODUCTS[key];
    var o = { key: key, name: p.name, price: p.price };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function firstSentence(t) { t = String(t).trim(); var m = /[.!] /.exec(t); return m ? t.slice(0, m.index + 1) : t; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function joinDe(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1]; }
  function isNum(v) { return v !== null && v !== undefined && v !== '' && typeof v !== 'boolean' && isFinite(Number(v)); }

  /* Kurze, individuelle Einschätzung (2-3 Sätze, Sie-Ansprache). Nie "rechtskonform": unauffällig statt konform. */
  function assess(score, cats, system, sevCount, a11yVerify, noneMode) {
    var named = cats.filter(function (c) { return CAT_NAMES[c.id] && isNum(c.score); }).map(function (c) { return { id: c.id, name: CAT_NAMES[c.id], score: Math.round(Number(c.score)) }; });
    var sysName = system && system !== 'unbekannt' ? ({ woocommerce: 'WooCommerce', shopify: 'Shopify', shopware: 'Shopware' }[system] || system.charAt(0).toUpperCase() + system.slice(1)) : '';
    var subject = 'Ihre Website' + (sysName ? ' (' + sysName + ')' : '');
    var s1 = subject + ' erreicht ' + score + '/100';
    var tone = score >= 95 ? 'excellent' : score >= 85 ? 'good' : score >= 70 ? 'solid' : score >= 50 ? 'weak' : 'poor';
    s1 += tone === 'excellent' ? ' und steht damit insgesamt sehr gut da.' : tone === 'good' ? ' und ist gut, hat aber kleine Lücken.' : tone === 'solid' ? ' und ist insgesamt solide, hat aber erkennbare Lücken.' : tone === 'weak' ? ' und hat in mehreren Punkten Nachholbedarf.' : ' und hat deutlichen Handlungsbedarf.';
    var out = [s1];
    if (noneMode) out = [subject + ' ist auf der Startseite in sehr gutem Zustand (Score ' + score + '/100). Wir sehen aktuell keinen Bereich mit Handlungsbedarf.'];
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
      if (!weak.length && !strong.length && calm.length) out.push(joinDe(calm.map(function (c) { return c.name; })) + ' ' + (calm.length > 1 ? 'sind' : 'ist') + ' auf der Startseite unauffällig.');
      else if (weak.length && (strong.length || calm.length)) {
        var quiet = sorted.filter(function (c) { return c.score >= 90 && !sevCount[c.id]; }).map(function (c) { return c.name; }).filter(function (n) { return !strong.some(function (c) { return c.name === n; }); });
        if (quiet.length) out.push(joinDe(quiet) + ' ' + (quiet.length > 1 ? 'sind' : 'ist') + ' auf der Startseite unauffällig.');
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
    var cats = (Array.isArray(r.categories) ? r.categories : []).filter(function (c) { return c && typeof c === 'object'; });
    var notes = [], why = [];

    // Auswertung je Bereich aus Befunden und Score
    var byCat = {}, sevByCat = { total: 0 }, ids = {}, sevTotal = { kritisch: 0, hoch: 0 };
    function bucket(id) { return byCat[id] || (byCat[id] = { crit: 0, high: 0, mid: 0, low: 0 }); }
    issues.forEach(function (i) {
      var id = String(i.id || ''), c = catOf(i), b = bucket(c);
      ids[id] = true;
      if (i.severity === 'kritisch') { b.crit++; sevTotal.kritisch++; }
      else if (i.severity === 'hoch') { b.high++; sevTotal.hoch++; }
      else if (i.severity === 'mittel') b.mid++;
      else b.low++;
      if ((i.severity === 'kritisch' || i.severity === 'hoch') && id !== 'a11y-statement') { sevByCat[c] = (sevByCat[c] || 0) + 1; sevByCat.total++; }
      if (id === 'a11y-statement') sevByCat.stmt = true;
    });
    var list = [];
    var seen = {};
    var order = CAT_IDS.slice();
    var scoreOf = {};
    cats.forEach(function (c) { if (CAT_NAMES[c.id]) scoreOf[c.id] = isNum(c.score) ? Math.round(Number(c.score)) : null; });
    var known = cats.length > 0;
    order.forEach(function (id) {
      if (seen[id]) return; seen[id] = true;
      var b = byCat[id] || { crit: 0, high: 0, mid: 0, low: 0 };
      var hasScore = scoreOf[id] !== undefined && scoreOf[id] !== null;
      if (known && scoreOf[id] === undefined) return;               // Bereich wurde nicht geliefert
      if (!known && !byCat[id] && id !== 'accessibility') return;   // v1 ohne Bereiche: nur Bereiche mit Befunden
      var sc = hasScore ? scoreOf[id] : (!known && isFinite(score) && id === 'accessibility' ? score : null);
      var all = b.crit + b.high + b.mid + b.low;
      var st = (sc !== null && sc < 50) || b.crit ? STATUS.crit : (sc !== null && sc < 75) || b.high ? STATUS.warn : sc === null && !all ? STATUS.none : STATUS.ok;
      var relevant = b.crit + b.high + b.mid;
      list.push({ id: id, title: CAT_NAMES[id], score: sc, status: st.id, label: st.label, sym: st.sym, count: relevant || all, all: all });
    });
    var flagged = list.filter(function (c) { return c.status === 'crit' || c.status === 'warn'; });
    var scoredCats = cats.filter(function (c) { return isNum(c.score); });
    var lowCats = scoredCats.filter(function (c) { return Number(c.score) < 60; }).length;
    var lowCatsLimit = cats.length > 5 ? 4 : 3;
    var tooManyProblems = score < 50 || lowCats >= lowCatsLimit;

    // Score nicht auswertbar: keine Empfehlung zum Kauf, nichts erfinden.
    if (!isFinite(score) || score < 0 || score > 100) {
      why.push('Der Score konnte nicht ausgewertet werden. Starten Sie den Check bitte erneut.');
      return { rule: 'unrated', assessment: 'Das Ergebnis des kostenlosen Checks konnte nicht vollständig ausgewertet werden. Einzelne Punkte konnten automatisch nicht abschließend geprüft werden.', categories: list, flagged: [], selfFix: [],
        primary: { key: 'none', name: 'Check erneut starten', price: null, noSale: true, cta: 'Check erneut starten' }, alternatives: [item('report', { why: 'Genauere Analyse bis zu 10 Seiten als PDF' })], also: [], reason: 'Erst ein auswertbares Ergebnis abwarten.', why: why, notes: notes, disclaimer: DISCLAIMER,
        leadLine: 'Empfehlung: keine (Score nicht auswertbar) | Score nicht auswertbar | Erst ein auswertbares Ergebnis abwarten.' };
    }

    var mittelCount = issues.filter(function (i) { return i.severity === 'mittel'; }).length;
    var noneEligible = flagged.length === 0 && score >= 95 && sevTotal.kritisch === 0 && sevTotal.hoch === 0 && mittelCount <= 3;
    var assessment = assess(score, cats, system, sevByCat, !!ids['privacy-trackers-verify'], noneEligible);
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

    var monAlt = item('monitoring', { why: 'Dauerhaft im Blick behalten: regelmäßige Prüfungen, Verlauf, Hinweis bei kritischen Auffälligkeiten' });
    var reportAlt = item('report', { why: 'Wenn Sie zuerst eine genauere Analyse bis zu 10 Seiten als PDF möchten (kein Muss für den Fix)' });
    var siteAlt = item('website-business', { why: 'Bei sehr vielen Baustellen kann ein Neubau wirtschaftlicher sein (Projektanfrage)', cta: 'Website-Projekt anfragen' });
    function alts(arr) { if (tooManyProblems) arr.push(siteAlt); return arr.slice(0, 3); }
    if (flagged.length) notes.push('Der Festpreis richtet sich nach dem beim Check erkannten Umfang; vor Beginn erhalten Sie ein schriftliches Angebot, und der Auftrag kommt erst nach Ihrer Zustimmung zustande.');

    function done(rule, primary, altList, reason, also) {
      var first = firstSentence(assessment);
      var line = 'Empfehlung: ' + primary.key + (primary.category ? ' [' + primary.category + ']' : '') + (primary.categories ? ' [' + primary.categories.join(',') + ']' : '') + ' (' + primary.price + ') | ' + first + ' | ' + reason;
      return { rule: rule, assessment: assessment, categories: list, flagged: flagged.map(function (c) { return c.id; }), selfFix: selfFix, primary: primary, alternatives: altList, also: also || [], reason: reason, why: why, notes: notes, disclaimer: DISCLAIMER, leadLine: line };
    }

    // N: kein auffälliger Bereich -> Monitoring (dezent und ehrlich)
    if (flagged.length === 0) {
      why.push('Score ' + score + ' von 100, in keinem Prüfbereich ein kritischer oder wichtiger Befund.');
      why.push('Monitoring prüft regelmäßig und meldet, wenn durch Updates neue Probleme dazukommen.');
      if (noneEligible) notes.push('Der kostenlose Check prüft nur die Startseite und findet nur einen Teil möglicher Probleme. Das Ergebnis ist ein Hinweis, keine Zusicherung der Rechtskonformität.');
      return done('monitoring', item('monitoring', { cta: 'Monitoring starten', href: 'bestellen.html?produkt=monitoring' }), alts([]),
        noneEligible ? 'Ihre Website ist in gutem Zustand. Monitoring hält das so und meldet neue Probleme, bevor sie auffallen.' : 'Aktuell kein Bereich mit Handlungsbedarf. Monitoring meldet neue Probleme, bevor sie auffallen.');
    }

    // S: genau ein konkretes Problem (ein auffälliger Bereich mit höchstens einem relevanten Befund) -> Einzel-Fix
    if (flagged.length === 1 && flagged[0].count <= 1) {
      var f = flagged[0];
      why.push(f.title + ' ist der einzige Bereich mit Handlungsbedarf (' + f.label + (f.score !== null ? ', ' + f.score + '/100' : '') + '), mit einem relevanten Problem.');
      var p1 = item('einzel-fix', { cta: 'Problem beheben lassen', category: f.id, categoryTitle: f.title, count: f.count, headline: 'Ein konkretes Problem beheben', meta: 'Bereich ' + f.title + ': 1 relevantes Problem erkannt', href: 'bestellen.html?produkt=einzel-fix&kategorie=' + f.id });
      return done('single', p1, alts([monAlt, reportAlt]), 'Es gibt genau ein konkretes Problem: Ein Einzel-Fix behebt es zum Festpreis.');
    }

    // M: mehrere Probleme (in einem oder mehreren Bereichen) -> Fix-Paket
    var nProblems = flagged.reduce(function (n, c) { return n + Math.max(1, c.count); }, 0);
    why.push(flagged.length > 1
      ? plural(flagged.length, 'Prüfbereich zeigt', 'Prüfbereiche zeigen') + ' Handlungsbedarf: ' + joinDe(flagged.map(function (c) { return c.title; })) + '.'
      : flagged[0].title + ' zeigt Handlungsbedarf (' + flagged[0].label + (flagged[0].score !== null ? ', ' + flagged[0].score + '/100' : '') + '). ' + plural(flagged[0].count, 'relevantes Problem', 'relevante Probleme') + ' erkannt.');
    var fids = flagged.map(function (c) { return c.id; });
    var p2 = item('fix-paket', { cta: 'Fix-Paket ansehen', categories: fids, count: nProblems, headline: 'Mehrere Probleme erkannt', meta: 'Mit dem Fix-Paket beheben wir mehrere Probleme Ihrer Website in einem Auftrag', href: 'bestellen.html?produkt=fix-paket&bereiche=' + fids.join(',') });
    return done('multi', p2, alts([monAlt, reportAlt]), 'Es gibt mehrere Probleme: Im Fix-Paket beheben wir sie gemeinsam zu einem Festpreis.');
  }

  var api = { recommend: recommend, PRODUCTS: PRODUCTS, DISCLAIMER: DISCLAIMER, STATUS: STATUS, CAT_NAMES: CAT_NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else if (root.YQ) root.YQ.recommend = api;
})(typeof window !== 'undefined' ? window : globalThis);
