/* Rechnungsgenerator: reine Rechenlogik (ohne DOM), im Browser als window.YQInvoice, in Node per require().
   Alle Geldbeträge werden als ganze Cent (Integer) geführt. Nichts wird gesendet. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.YQInvoice = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_PRICE = 10000000;      // Einzelpreis (Betrag) in Euro
  var MAX_QTY = 1000000;         // Menge
  var MAX_TOTAL_CENTS = 1000000000; // 10 Mio. € Positions- und Gesamtsumme
  var PRICE_DEC = 4, QTY_DEC = 3;
  var RATES = [19, 7, 0];

  // ---------- Zahlen ----------
  function pow10(n) { var r = 1; while (n-- > 0) r *= 10; return r; }

  function validGroups(s, sep) { // "1.234.567" bzw. "1,234" -> Gruppen zu je 3 Ziffern
    var parts = s.split(sep);
    if (parts[0].length < 1 || parts[0].length > 3) return false;
    for (var i = 1; i < parts.length; i++) if (!/^\d{3}$/.test(parts[i])) return false;
    return /^\d+$/.test(parts[0]);
  }

  /* Liest "1.234,56", "1234.56", "12,5", "-3,50" usw. Ergebnis: Integer = Wert * 10^decimals.
     Mehrdeutig: ein einzelner Punkt mit genau drei Ziffern dahinter ("1.234") gilt als Tausendertrenner. */
  function parseNumber(input, decimals) {
    decimals = decimals == null ? 2 : decimals;
    var s = String(input == null ? '' : input).replace(/[\s  ']/g, '').replace(/(€|eur)$/i, '');
    if (s === '') return { ok: false, empty: true, error: 'Bitte einen Wert eingeben.' };
    var neg = false;
    if (/^[-−]/.test(s)) { neg = true; s = s.slice(1); } else if (s.charAt(0) === '+') s = s.slice(1);
    if (!/^[0-9.,]+$/.test(s) || !/\d/.test(s)) return { ok: false, error: 'Bitte eine Zahl eingeben, zum Beispiel 1.234,56 oder 12,5.' };
    var iPart, fPart = '';
    var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    var nc = s.split(',').length - 1, nd = s.split('.').length - 1;
    var bad = { ok: false, error: 'Die Zahl ist nicht lesbar. Beispiele: 1.234,56 oder 1234.56.' };
    if (nc && nd) {
      var dec = lc > ld ? ',' : '.', th = dec === ',' ? '.' : ',';
      var decCount = dec === ',' ? nc : nd;
      if (decCount !== 1) return bad;
      var halves = s.split(dec);
      if (halves[0].indexOf(th) === -1 || !validGroups(halves[0], th) || !/^\d*$/.test(halves[1])) return bad;
      iPart = halves[0].split(th).join(''); fPart = halves[1];
    } else if (nc) {
      if (nc === 1) { iPart = s.split(',')[0]; fPart = s.split(',')[1]; }
      else { if (!validGroups(s, ',')) return bad; iPart = s.split(',').join(''); }
    } else if (nd) {
      if (nd > 1) { if (!validGroups(s, '.')) return bad; iPart = s.split('.').join(''); }
      else if (/^[1-9]\d{0,2}\.\d{3}$/.test(s)) iPart = s.split('.').join('');
      else { iPart = s.split('.')[0]; fPart = s.split('.')[1]; }
    } else iPart = s;
    if (iPart === '') iPart = '0';
    if (!/^\d+$/.test(iPart) || (fPart !== '' && !/^\d+$/.test(fPart))) return bad;
    fPart = fPart.replace(/0+$/, '');
    if (fPart.length > decimals) return { ok: false, error: 'Höchstens ' + decimals + ' Nachkommastellen sind möglich.' };
    iPart = iPart.replace(/^0+(?=\d)/, '');
    if (iPart.length > 9) return { ok: false, error: 'Der Wert ist zu groß.' };
    while (fPart.length < decimals) fPart += '0';
    var scaled = parseInt(iPart, 10) * pow10(decimals) + (fPart ? parseInt(fPart, 10) : 0);
    if (!isFinite(scaled)) return { ok: false, error: 'Der Wert ist zu groß.' };
    return { ok: true, neg: neg, scaled: neg ? -scaled : scaled, decimals: decimals };
  }

  function divRound(n, d) { // kaufmännisch (halb weg von Null), n, d ganzzahlig
    var a = Math.abs(n), r = a % d, q = (a - r) / d;
    if (r * 2 >= d) q += 1;
    return n < 0 ? -q : q;
  }

  // ---------- Formatierung ----------
  function group3(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function formatCents(c) {
    var neg = c < 0, a = Math.abs(c), e = Math.floor(a / 100), ct = a % 100;
    return (neg ? '−' : '') + group3(String(e)) + ',' + (ct < 10 ? '0' : '') + ct + ' €';
  }
  function formatQty(scaled) { // Menge * 1000 -> "2,5"
    var neg = scaled < 0, a = Math.abs(scaled), i = Math.floor(a / 1000), f = String(a % 1000);
    while (f.length < 3) f = '0' + f;
    f = f.replace(/0+$/, '');
    return (neg ? '−' : '') + group3(String(i)) + (f ? ',' + f : '');
  }
  function formatPrice(scaled) { // Preis * 10^4 -> mindestens 2 Nachkommastellen
    var neg = scaled < 0, a = Math.abs(scaled), i = Math.floor(a / 10000), f = String(a % 10000);
    while (f.length < 4) f = '0' + f;
    f = f.replace(/0+$/, '');
    while (f.length < 2) f += '0';
    return (neg ? '−' : '') + group3(String(i)) + ',' + f + ' €';
  }

  // ---------- Positionen und Summen ----------
  function lineCents(qtyScaled, priceScaled) { // qty*1e3, price*1e4 -> Cent, Rundung je Zeile
    return divRound(qtyScaled * priceScaled, 100000);
  }

  function calcLine(it, mode) {
    var r = { empty: false, errors: {}, cents: 0, ok: false, rate: 0 };
    var desc = String(it.desc || '').trim();
    var priceBlank = String(it.price == null ? '' : it.price).trim() === '';
    if (!desc && priceBlank) { r.empty = true; return r; }
    if (!desc) r.errors.desc = 'Bitte eine Beschreibung eingeben.';
    var q = parseNumber(it.qty, QTY_DEC);
    if (!q.ok) r.errors.qty = q.empty ? 'Bitte eine Menge eingeben.' : q.error;
    else if (q.scaled <= 0) r.errors.qty = 'Die Menge muss größer als 0 sein. Rabatte tragen Sie als negativen Einzelpreis ein.';
    else if (q.scaled > MAX_QTY * 1000) r.errors.qty = 'Die Menge darf höchstens 1.000.000 betragen.';
    var p = parseNumber(it.price, PRICE_DEC);
    if (!p.ok) r.errors.price = p.empty ? 'Bitte einen Einzelpreis eingeben.' : p.error;
    else if (Math.abs(p.scaled) > MAX_PRICE * pow10(PRICE_DEC)) r.errors.price = 'Der Einzelpreis darf höchstens 10 Mio. Euro betragen.';
    if (mode === 'regel') {
      var rate = parseInt(it.rate, 10);
      if (RATES.indexOf(rate) === -1) r.errors.rate = 'Bitte einen Steuersatz wählen.'; else r.rate = rate;
    }
    if (!r.errors.qty && !r.errors.price) {
      if (Math.abs(q.scaled * p.scaled) / 1e7 > MAX_TOTAL_CENTS / 100) r.errors.price = 'Die Positionssumme darf höchstens 10 Mio. Euro betragen.';
      else { r.cents = lineCents(q.scaled, p.scaled); r.qtyScaled = q.scaled; r.priceScaled = p.scaled; }
    }
    r.ok = Object.keys(r.errors).length === 0;
    return r;
  }

  /* opts: { mode: 'klein' | 'regel', items: [{desc, qty, unit, price, rate}] }
     Rundung: je Zeile auf Cent; USt je Steuersatz aus der Netto-Summe des Satzes. */
  function calcInvoice(opts) {
    var mode = opts.mode === 'regel' ? 'regel' : 'klein';
    var lines = (opts.items || []).map(function (it) { return calcLine(it, mode); });
    var net = 0, byRate = {};
    lines.forEach(function (l) {
      if (!l.ok) return;
      net += l.cents;
      byRate[l.rate] = (byRate[l.rate] || 0) + l.cents;
    });
    var groups = [], vat = 0;
    if (mode === 'regel') {
      RATES.forEach(function (rt) {
        if (byRate[rt] === undefined) return;
        var v = divRound(byRate[rt] * rt, 100);
        groups.push({ rate: rt, net: byRate[rt], vat: v });
        vat += v;
      });
    }
    var gross = net + vat;
    var errors = {};
    if (Math.abs(net) > MAX_TOTAL_CENTS || Math.abs(gross) > MAX_TOTAL_CENTS) errors.total = 'Der Gesamtbetrag darf höchstens 10 Mio. Euro betragen.';
    else if (net < 0 || gross < 0) errors.total = 'Der Gesamtbetrag darf nicht negativ sein. Prüfen Sie Ihre Rabatt-Positionen.';
    var validCount = lines.filter(function (l) { return l.ok; }).length;
    var hasErrors = !!errors.total || lines.some(function (l) { return !l.empty && !l.ok; });
    return { mode: mode, lines: lines, net: net, vat: vat, gross: gross, groups: groups, errors: errors, validCount: validCount, hasErrors: hasErrors };
  }

  // ---------- IBAN ----------
  var IBAN_LEN = { AD: 24, AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GR: 27, HR: 21, HU: 28, IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27 };
  function normalizeIban(s) { return String(s == null ? '' : s).replace(/[\s .-]/g, '').toUpperCase(); }
  function formatIban(s) { return normalizeIban(s).replace(/(.{4})(?=.)/g, '$1 '); }
  function validateIban(input) {
    var s = normalizeIban(input);
    if (s === '') return { ok: false, empty: true, error: '' };
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return { ok: false, error: 'Die IBAN beginnt mit Länderkennung und Prüfziffer, zum Beispiel DE89 …' };
    if (s.length < 15 || s.length > 34) return { ok: false, error: 'Die IBAN hat eine ungültige Länge.' };
    var cc = s.slice(0, 2);
    if (IBAN_LEN[cc] && IBAN_LEN[cc] !== s.length) return { ok: false, error: 'Eine IBAN aus ' + cc + ' hat ' + IBAN_LEN[cc] + ' Stellen.' };
    var rearranged = s.slice(4) + s.slice(0, 4), rem = 0;
    for (var i = 0; i < rearranged.length; i++) {
      var ch = rearranged.charCodeAt(i);
      var v = ch >= 65 ? String(ch - 55) : String.fromCharCode(ch);
      for (var j = 0; j < v.length; j++) rem = (rem * 10 + (v.charCodeAt(j) - 48)) % 97;
    }
    if (rem !== 1) return { ok: false, error: 'Die Prüfziffer der IBAN stimmt nicht. Bitte auf Tippfehler prüfen.' };
    return { ok: true, iban: s, formatted: formatIban(s) };
  }
  function validateBic(input) {
    var s = String(input == null ? '' : input).replace(/\s/g, '').toUpperCase();
    if (!s) return { ok: true, empty: true };
    return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(s) ? { ok: true, bic: s } : { ok: false, error: 'Die BIC hat 8 oder 11 Zeichen, zum Beispiel COBADEFFXXX.' };
  }

  // ---------- Datum ----------
  function isIsoDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
  }
  function addDays(iso, n) {
    if (!isIsoDate(iso)) return '';
    var p = iso.split('-');
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.toISOString().slice(0, 10);
  }
  function formatDate(iso) {
    if (!isIsoDate(iso)) return '';
    var p = iso.split('-');
    return p[2] + '.' + p[1] + '.' + p[0];
  }
  function parseDays(s) {
    var t = String(s == null ? '' : s).trim();
    if (!/^\d{1,3}$/.test(t)) return null;
    var n = parseInt(t, 10);
    return n <= 365 ? n : null;
  }
  function pad(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function suggestNumber(iso, counter) { // RE-20261005-001
    return 'RE-' + String(iso || '').replace(/-/g, '') + '-' + pad(counter, 3);
  }

  // ---------- Steuerhinweise (Hinweis, keine Steuerberatung) ----------
  /* Pflichthinweis nach § 34a Satz 1 Nr. 5 UStDV: Die Rechnung muss darauf hinweisen, dass die Steuerbefreiung
     für Kleinunternehmer gilt (§ 19 UStG); eine eindeutige umgangssprachliche Angabe genügt (Abschn. 14.7a Abs. 1 UStAE). */
  var KU_NOTE = 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Steuerbefreiung für Kleinunternehmer).';
  var SMALL_LIMIT_CENTS = 25000; // Kleinbetragsrechnung: Gesamtbetrag bis 250 € (§ 33 UStDV)

  function isSmallAmount(grossCents) { return typeof grossCents === 'number' && grossCents > 0 && grossCents <= SMALL_LIMIT_CENTS; }

  /* Findet Texte, die im Kleinunternehmer-Modus einen Umsatzsteuer-Ausweis nahelegen (z. B. "zzgl. 19 % MwSt.").
     Bedingung: Steuerwort und eine Zahl bzw. ein Prozentzeichen im selben Text. "USt-IdNr." und ein Hinweis auf § 19 UStG zählen nicht. */
  var VAT_WORDS = /(^|[^a-zäöüß])(ust|mwst|mehrwertsteuer|umsatzsteuer)(?![a-zäöüß-])/i;
  function mentionsVat(texts) {
    return (texts || []).some(function (t) {
      var s = String(t == null ? '' : t);
      return VAT_WORDS.test(s) && /[0-9%]/.test(s.replace(/§\s*\d+[a-z]?/gi, '')) && !/§\s*19\s*UStG|kleinunternehm/i.test(s);
    });
  }

  /* Liegt das Datum vor dem (optional angegebenen) Beginn der Tätigkeit? Nur Hinweis, blockiert nichts. */
  function dateWarnings(d) {
    var w = [];
    if (!isIsoDate(d.startDate)) return w;
    var start = d.startDate, f = formatDate(start);
    if (isIsoDate(d.date) && d.date < start) w.push({ key: 'date-before-start', text: 'Das Rechnungsdatum liegt vor dem angegebenen Beginn Ihrer Tätigkeit (' + f + '). Bitte prüfen Sie, ob das so gewollt ist.' });
    var svc = d.serviceMode === 'zeitraum' ? d.serviceFrom : d.serviceDate;
    if (isIsoDate(svc) && svc < start) w.push({ key: 'service-before-start', text: 'Die Leistung liegt (teilweise) vor dem angegebenen Beginn Ihrer Tätigkeit (' + f + '). Bitte prüfen Sie Leistungsdatum und Tätigkeitsbeginn.' });
    return w;
  }

  // ---------- Checkliste (Hinweis, keine Steuerberatung) ----------
  /* level 'pflicht': nach § 14 Abs. 4 UStG bzw. § 34a / § 33 UStDV üblicherweise erforderlich.
     level 'empfohlen': gesetzlich in diesem Fall nicht vorgeschrieben, für Buchhaltung und Zuordnung aber üblich. */
  function checklist(d) {
    var has = function (v) { return String(v == null ? '' : v).trim() !== ''; };
    var regel = d.mode === 'regel';
    var small = isSmallAmount(d.gross) && !d.hasErrors && !(regel && d.hasZeroRate); // § 33 UStDV (nicht bei § 13b UStG, daher bei 0 % keine Erleichterung)
    var amountOk = d.validCount > 0 && !d.hasErrors;
    var serviceOk = d.serviceMode === 'zeitraum' ? (isIsoDate(d.serviceFrom) && isIsoDate(d.serviceTo) && d.serviceFrom <= d.serviceTo) : isIsoDate(d.serviceDate);
    var lvl = function (required) { return required ? 'pflicht' : 'empfohlen'; };
    var items = [
      { key: 'sender', level: 'pflicht', label: 'Vollständiger Name und Anschrift des Leistenden (Absender)', ok: has(d.senderName) && has(d.senderAddress) },
      { key: 'taxid', level: lvl(!small), label: regel ? 'Steuernummer oder USt-IdNr. des Leistenden' : 'Steuernummer, USt-IdNr. oder Kleinunternehmer-ID des Leistenden', ok: has(d.senderTaxId) },
      { key: 'recipient', level: lvl(!small), label: 'Vollständiger Name und Anschrift des Leistungsempfängers', ok: has(d.recipientName) && has(d.recipientAddress) },
      { key: 'date', level: 'pflicht', label: 'Ausstellungsdatum (Rechnungsdatum)', ok: isIsoDate(d.date) },
      { key: 'number', level: lvl(regel && !small), label: regel && !small ? 'Fortlaufende, einmalig vergebene Rechnungsnummer' : 'Einmalige, möglichst fortlaufende Rechnungsnummer', ok: has(d.number) },
      { key: 'service', level: lvl(regel && !small), label: 'Zeitpunkt oder Zeitraum der Leistung', ok: serviceOk },
      { key: 'items', level: 'pflicht', label: 'Menge und Art der Leistung (mindestens eine vollständige Position)', ok: amountOk },
      { key: 'amount', level: 'pflicht', label: regel ? 'Entgelt, nach Steuersätzen aufgeschlüsselt' : 'Entgelt in einer Summe', ok: amountOk }
    ];
    if (regel) {
      items.push({ key: 'vat', level: 'pflicht', label: 'Steuersatz und Steuerbetrag (wird automatisch berechnet und ausgewiesen)', ok: amountOk });
      if (d.hasZeroRate) items.push({ key: 'exempt', level: 'pflicht', label: 'Hinweis auf den Grund für 0 % (z. B. Steuerbefreiung oder Steuerschuldnerschaft des Leistungsempfängers)', ok: has(d.exemptNote) });
    } else {
      items.push({ key: 'kleinhinweis', level: 'pflicht', label: 'Hinweis auf die Steuerbefreiung für Kleinunternehmer (§ 19 UStG, wird automatisch ergänzt)', ok: true });
    }
    return items;
  }

  /* Allgemeine Hinweise je nach Modus und Betrag (ohne Datumshinweise). */
  function notices(d) {
    var n = [];
    if (d.mode !== 'regel' && d.vatMention) n.push({ key: 'vat-mention', level: 'warn', text: 'Eine Beschreibung oder ein Hinweis nennt Umsatzsteuer bzw. MwSt. zusammen mit einer Zahl. Bitte prüfen Sie, dass kein Steuersatz und kein Steuerbetrag ausgewiesen wird: Als Kleinunternehmer dürfen Sie keine Umsatzsteuer ausweisen; ein dennoch ausgewiesener Betrag wird in der Regel dem Finanzamt geschuldet (§ 14c UStG).' });
    if (isSmallAmount(d.gross) && !d.hasErrors) n.push({ key: 'small', level: 'info', text: 'Gesamtbetrag bis 250 €: Für Kleinbetragsrechnungen (§ 33 UStDV) sind weniger Angaben vorgeschrieben, zum Beispiel sind Empfänger und Steuernummer dann nicht zwingend. Das gilt nicht bei Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG) und bestimmten Lieferungen in andere EU-Staaten. Vollständige Angaben schaden nicht.' });
    return n;
  }

  function checklistTitle(mode) {
    return mode === 'regel'
      ? 'Für eine Rechnung nach § 14 Abs. 4 UStG üblicherweise erforderlich'
      : 'Für Rechnungen von Kleinunternehmern (§ 34a UStDV) üblicherweise erforderlich';
  }

  return {
    MAX_PRICE: MAX_PRICE, MAX_QTY: MAX_QTY, MAX_TOTAL_CENTS: MAX_TOTAL_CENTS, RATES: RATES,
    parseNumber: parseNumber, divRound: divRound, lineCents: lineCents, calcLine: calcLine, calcInvoice: calcInvoice,
    formatCents: formatCents, formatQty: formatQty, formatPrice: formatPrice,
    normalizeIban: normalizeIban, formatIban: formatIban, validateIban: validateIban, validateBic: validateBic,
    isIsoDate: isIsoDate, addDays: addDays, formatDate: formatDate, parseDays: parseDays, suggestNumber: suggestNumber,
    KU_NOTE: KU_NOTE, SMALL_LIMIT_CENTS: SMALL_LIMIT_CENTS, isSmallAmount: isSmallAmount, mentionsVat: mentionsVat, dateWarnings: dateWarnings,
    checklist: checklist, notices: notices, checklistTitle: checklistTitle
  };
});
