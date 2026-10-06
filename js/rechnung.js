/* Rechnungsgenerator (Oberfläche). Läuft vollständig im Browser, nichts wird gesendet.
   Rechenlogik: rechnung-core.js (window.YQInvoice). Nutzerdaten werden ausschließlich per textContent ausgegeben. */
(function () {
  'use strict';
  var I = window.YQInvoice, YQ = window.YQ;
  var form = document.getElementById('inv-form');
  if (!form || !I || !YQ) return;
  var el = YQ.el;
  var $ = function (id) { return document.getElementById(id); };

  var KEY_SENDER = 'yq-inv-sender', KEY_DRAFT = 'yq-inv-draft', KEY_COUNTER = 'yq-inv-counter';
  var MAX_ITEMS = 50;
  var UNITS = ['Stk.', 'Std.', 'Tag(e)', 'Monat(e)', 'Pauschale', 'km', 'kg', 'm', 'm²', 'Satz'];

  var sheet = $('inv-sheet'), itemsBox = $('inv-items'), statusEl = $('inv-status');
  var items = [], uid = 0, touched = {}, submitted = false, numberEdited = false, suggested = '';

  // ---------- Speicher (localStorage kann fehlen oder gesperrt sein) ----------
  function store(key, value) { try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; } }
  function load(key) { try { return window.localStorage.getItem(key); } catch (e) { return null; } }
  function drop(key) { try { window.localStorage.removeItem(key); } catch (e) { /* ignorieren */ } }
  function loadJson(key) { var s = load(key); if (!s) return null; try { var o = JSON.parse(s); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }

  function say(msg) { statusEl.textContent = ''; window.setTimeout(function () { statusEl.textContent = msg; }, 30); }

  function todayIso() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 300) : ''; }

  // ---------- Rechnungsnummer ----------
  function nextCounter() {
    var c = loadJson(KEY_COUNTER), y = String(new Date().getFullYear());
    return c && c.year === y && typeof c.n === 'number' && isFinite(c.n) ? c.n + 1 : 1;
  }
  function commitCounter() {
    if (!suggested || $('i-nr').value.trim() !== suggested) return;
    var n = nextCounter();
    store(KEY_COUNTER, JSON.stringify({ year: String(new Date().getFullYear()), n: n }));
    suggested = '';
  }
  function applySuggestion() {
    var iso = I.isIsoDate($('i-date').value) ? $('i-date').value : todayIso();
    suggested = I.suggestNumber(iso, nextCounter());
    $('i-nr').value = suggested;
    numberEdited = false;
  }

  // ---------- Positionen ----------
  function newItem(p) {
    uid += 1;
    return { id: uid, desc: p && p.desc || '', qty: p && p.qty || '1', unit: p && p.unit || 'Stk.', price: p && p.price || '', rate: p && p.rate || '19' };
  }
  function mode() { return form.querySelector('input[name="tm"]:checked').value; }
  function serviceMode() { return form.querySelector('input[name="lm"]:checked').value; }

  function errEl(input) {
    var id = input.id + '-err', e = $(id);
    if (!e) {
      e = el('p', { id: id, class: 'field-error' });
      e.hidden = true;
      var host = input.parentNode;
      var hint = null;
      for (var i = 0; i < host.children.length; i++) if (host.children[i].classList.contains('hint')) hint = host.children[i];
      host.insertBefore(e, hint ? hint : input.nextSibling);
      input.setAttribute('data-base', input.getAttribute('aria-describedby') || '');
    }
    return e;
  }
  function setError(input, msg) {
    var show = msg && (touched[input.id] || submitted);
    var e = errEl(input), base = input.getAttribute('data-base') || '';
    if (show) {
      e.textContent = msg; e.hidden = false;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', (base + ' ' + e.id).trim());
    } else {
      e.textContent = ''; e.hidden = true;
      input.removeAttribute('aria-invalid');
      if (base) input.setAttribute('aria-describedby', base); else input.removeAttribute('aria-describedby');
    }
    return !!msg;
  }

  var RATES = ['19', '7', '0'];
  function field(labelText, input, id, cls) {
    return el('div', { class: 'field ' + (cls || '') }, el('label', { for: id }, labelText), input);
  }
  function renderItems(focus) {
    itemsBox.textContent = '';
    items.forEach(function (it, idx) {
      var pre = 'it' + it.id + '-', n = idx + 1;
      var desc = el('input', { type: 'text', id: pre + 'desc', maxlength: '300', 'data-f': 'desc', 'data-id': it.id });
      desc.value = it.desc;
      var qty = el('input', { type: 'text', id: pre + 'qty', inputmode: 'decimal', maxlength: '14', 'data-f': 'qty', 'data-id': it.id });
      qty.value = it.qty;
      var unit = el('input', { type: 'text', id: pre + 'unit', maxlength: '20', list: 'inv-units', 'data-f': 'unit', 'data-id': it.id });
      unit.value = it.unit;
      var price = el('input', { type: 'text', id: pre + 'price', inputmode: 'decimal', maxlength: '20', 'data-f': 'price', 'data-id': it.id, placeholder: '0,00' });
      price.value = it.price;
      var rate = el('select', { id: pre + 'rate', 'data-f': 'rate', 'data-id': it.id });
      RATES.forEach(function (r) { var o = el('option', { value: r }, r + ' %'); if (r === it.rate) o.selected = true; rate.appendChild(o); });
      var rateWrap = field('Steuersatz', rate, pre + 'rate', 'inv-rate');
      rateWrap.hidden = mode() !== 'regel';
      var up = el('button', { type: 'button', class: 'btn btn-secondary btn-small inv-ib', 'data-act': 'up', 'data-id': it.id, 'aria-label': 'Position ' + n + ' nach oben' }, el('span', { 'aria-hidden': 'true' }, '↑'));
      var down = el('button', { type: 'button', class: 'btn btn-secondary btn-small inv-ib', 'data-act': 'down', 'data-id': it.id, 'aria-label': 'Position ' + n + ' nach unten' }, el('span', { 'aria-hidden': 'true' }, '↓'));
      if (idx === 0) up.setAttribute('aria-disabled', 'true');
      if (idx === items.length - 1) down.setAttribute('aria-disabled', 'true');
      var del = el('button', { type: 'button', class: 'btn btn-secondary btn-small inv-del', 'data-act': 'del', 'data-id': it.id, 'aria-label': 'Position ' + n + ' löschen' }, 'Löschen');
      var total = el('p', { class: 'inv-line-total', 'data-total': it.id });
      var row = el('fieldset', { class: 'inv-item', 'data-row': it.id },
        el('legend', null, 'Position ' + n),
        field('Beschreibung', desc, pre + 'desc'),
        el('div', { class: 'inv-item-grid' },
          field('Menge', qty, pre + 'qty'),
          field('Einheit', unit, pre + 'unit'),
          field('Einzelpreis in €', price, pre + 'price'),
          rateWrap),
        el('div', { class: 'inv-item-foot' }, total, el('div', { class: 'inv-item-btns' }, up, down, del)));
      itemsBox.appendChild(row);
    });
    if (focus) { var t = $(focus) || document.querySelector(focus); if (t && t.focus) t.focus(); }
  }

  function itemById(id) { for (var i = 0; i < items.length; i++) if (String(items[i].id) === String(id)) return i; return -1; }

  // ---------- Zustand lesen / schreiben ----------
  function readState() {
    return {
      senderName: $('s-name').value, senderAddress: $('s-addr').value, senderMail: $('s-mail').value, senderTel: $('s-tel').value, senderTaxId: $('s-tax').value,
      senderTaxKind: $('s-taxkind').value, startDate: $('s-start').value, exemptNote: $('t-exempt').value,
      recipientName: $('r-name').value, recipientAddress: $('r-addr').value,
      number: $('i-nr').value, date: $('i-date').value,
      serviceMode: serviceMode(), serviceDate: $('l-date').value, serviceFrom: $('l-from').value, serviceTo: $('l-to').value,
      days: $('i-days').value, mode: mode(),
      holder: $('p-holder').value, iban: $('p-iban').value, bic: $('p-bic').value, notes: $('n-notes').value,
      items: items.map(function (it) { return { desc: it.desc, qty: it.qty, unit: it.unit, price: it.price, rate: it.rate }; })
    };
  }
  var TAX_KINDS = { stnr: 'Steuernummer', ustid: 'USt-IdNr.', kuid: 'Kleinunternehmer-ID' };
  var MAP = { startDate: 's-start', exemptNote: 't-exempt', senderName: 's-name', senderAddress: 's-addr', senderMail: 's-mail', senderTel: 's-tel', senderTaxId: 's-tax', recipientName: 'r-name', recipientAddress: 'r-addr', number: 'i-nr', date: 'i-date', serviceDate: 'l-date', serviceFrom: 'l-from', serviceTo: 'l-to', days: 'i-days', holder: 'p-holder', iban: 'p-iban', bic: 'p-bic', notes: 'n-notes' };
  function writeState(s) {
    Object.keys(MAP).forEach(function (k) { if (typeof s[k] === 'string') $(MAP[k]).value = str(s[k], 600); });
    $('s-taxkind').value = Object.prototype.hasOwnProperty.call(TAX_KINDS, s.senderTaxKind) ? s.senderTaxKind : 'stnr';
    var tm = s.mode === 'regel' ? 'regel' : 'klein', lm = s.serviceMode === 'zeitraum' ? 'zeitraum' : 'datum';
    form.querySelector('input[name="tm"][value="' + tm + '"]').checked = true;
    form.querySelector('input[name="lm"][value="' + lm + '"]').checked = true;
    if (Array.isArray(s.items)) {
      items = s.items.slice(0, MAX_ITEMS).map(function (p) {
        p = p && typeof p === 'object' ? p : {};
        return newItem({ desc: str(p.desc, 300), qty: str(p.qty, 14) || '1', unit: str(p.unit, 20), price: str(p.price, 20), rate: RATES.indexOf(str(p.rate, 3)) > -1 ? p.rate : '19' });
      });
    }
    if (!items.length) items = [newItem()];
  }

  // ---------- Validierung der Formularfelder ----------
  function validateFields(st) {
    var bad = [];
    function chk(id, msg) { if (setError($(id), msg)) bad.push(id); }
    var days = I.parseDays(st.days);
    chk('i-days', st.days.trim() !== '' && days === null ? 'Bitte ganze Tage von 0 bis 365 eingeben.' : '');
    chk('s-start', st.startDate && !I.isIsoDate(st.startDate) ? 'Bitte ein gültiges Datum eingeben.' : '');
    chk('i-date', st.date && !I.isIsoDate(st.date) ? 'Bitte ein gültiges Datum eingeben.' : (!st.date && (touched['i-date'] || submitted) ? 'Bitte ein Rechnungsdatum angeben.' : ''));
    if (st.serviceMode === 'zeitraum') {
      chk('l-from', st.serviceFrom && !I.isIsoDate(st.serviceFrom) ? 'Bitte ein gültiges Datum eingeben.' : '');
      chk('l-to', st.serviceTo && !I.isIsoDate(st.serviceTo) ? 'Bitte ein gültiges Datum eingeben.' : (st.serviceFrom && st.serviceTo && st.serviceTo < st.serviceFrom ? 'Das Ende darf nicht vor dem Beginn liegen.' : ''));
    }
    var iban = I.validateIban(st.iban);
    chk('p-iban', st.iban.trim() && !iban.ok ? iban.error : '');
    var bic = I.validateBic(st.bic);
    chk('p-bic', !bic.ok ? bic.error : '');
    chk('s-mail', st.senderMail.trim() && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(st.senderMail.trim()) ? 'Bitte eine gültige E-Mail-Adresse eingeben.' : '');
    return bad;
  }

  function validateItems(calc) {
    var bad = [];
    calc.lines.forEach(function (l, i) {
      var pre = 'it' + items[i].id + '-';
      ['desc', 'qty', 'price', 'rate'].forEach(function (f) {
        var inp = $(pre + f);
        if (!inp) return;
        if (setError(inp, l.errors[f] || '')) bad.push(pre + f);
      });
    });
    var te = $('items-error');
    if (calc.errors.total && (submitted || touched.total)) { te.textContent = calc.errors.total; te.hidden = false; bad.push('item-add'); }
    else { te.textContent = ''; te.hidden = true; }
    return bad;
  }

  // ---------- Vorschau ----------
  function ph(text) { return el('span', { class: 'inv-ph' }, text); }
  function lines(text) { return String(text).split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function block(cls, textLines, placeholder) {
    var d = el('div', { class: cls });
    if (!textLines.length) d.appendChild(el('div', null, ph(placeholder)));
    textLines.forEach(function (l) { d.appendChild(el('div', null, l)); });
    return d;
  }
  function metaRow(dl, k, v) { dl.appendChild(el('div', null, el('dt', null, k), el('dd', null, v))); }

  function renderPreview(st, calc) {
    sheet.textContent = '';
    var klein = st.mode === 'klein';
    var senderLine = [st.senderName.trim()].concat(lines(st.senderAddress)).filter(Boolean).join(' · ');
    sheet.appendChild(el('p', { class: 'inv-senderline' }, senderLine || ph('Absender')));
    var due = '';
    var days = I.parseDays(st.days);
    if (days !== null && I.isIsoDate(st.date)) due = I.addDays(st.date, days);
    var meta = el('dl', { class: 'inv-meta' });
    metaRow(meta, 'Rechnungsnummer', st.number.trim() || ph('Nummer'));
    metaRow(meta, 'Rechnungsdatum', I.formatDate(st.date) || ph('Datum'));
    var lv = '';
    if (st.serviceMode === 'zeitraum') lv = I.isIsoDate(st.serviceFrom) && I.isIsoDate(st.serviceTo) ? I.formatDate(st.serviceFrom) + ' bis ' + I.formatDate(st.serviceTo) : '';
    else lv = I.formatDate(st.serviceDate);
    metaRow(meta, st.serviceMode === 'zeitraum' ? 'Leistungszeitraum' : 'Leistungsdatum', lv || ph('Leistungszeitpunkt'));
    if (due) metaRow(meta, 'Zahlbar bis', I.formatDate(due));
    var rec = el('div', { class: 'inv-recipient' }, el('div', { class: 'inv-small' }, 'Rechnung an'),
      block('inv-rec-lines', [st.recipientName.trim()].concat(lines(st.recipientAddress)).filter(Boolean), 'Empfänger und Anschrift'));
    sheet.appendChild(el('div', { class: 'inv-top' }, rec, meta));
    sheet.appendChild(el('h3', { class: 'inv-title' }, 'Rechnung'));

    // Explizite Tabellenrollen: auf schmalen Vorschauen wird die Tabelle per CSS zu Karten umgebaut (display: grid),
    // die Rollen erhalten dabei die Tabellensemantik für Screenreader.
    var amountLabel = klein ? 'Betrag' : 'Netto';
    var th = function (cls, text) { return el('th', { scope: 'col', role: 'columnheader', class: cls }, text); };
    var td = function (attrs, content) { attrs.role = 'cell'; return el('td', attrs, content); };
    var thead = el('tr', { role: 'row' }, th('c-pos', 'Pos.'), th('c-desc', 'Beschreibung'), th('c-num', 'Menge'), th('c-num', 'Einzelpreis'));
    if (!klein) thead.appendChild(th('c-num', 'USt'));
    thead.appendChild(th('c-num', amountLabel));
    var tbody = el('tbody', { role: 'rowgroup' });
    var pos = 0, any = false;
    calc.lines.forEach(function (l, i) {
      if (l.empty) return;
      any = true; pos += 1;
      var it = st.items[i];
      var tr = el('tr', { role: 'row' }, td({ class: 'c-pos' }, String(pos)), td({ class: 'c-desc' }, it.desc.trim() || ph('Beschreibung')));
      if (l.ok) {
        tr.appendChild(td({ class: 'c-num', 'data-label': 'Menge' }, I.formatQty(l.qtyScaled) + (it.unit.trim() ? ' ' + it.unit.trim() : '')));
        tr.appendChild(td({ class: 'c-num', 'data-label': 'Einzelpreis' }, I.formatPrice(l.priceScaled)));
        if (!klein) tr.appendChild(td({ class: 'c-num', 'data-label': 'USt' }, l.rate + ' %'));
        tr.appendChild(td({ class: 'c-num c-total', 'data-label': amountLabel }, I.formatCents(l.cents)));
      } else {
        tr.appendChild(td({ class: 'c-num c-wide', colspan: klein ? '3' : '4' }, ph('Angaben unvollständig')));
      }
      tbody.appendChild(tr);
    });
    if (!any) tbody.appendChild(el('tr', { role: 'row' }, td({ colspan: klein ? '5' : '6', class: 'c-desc c-wide' }, ph('Noch keine Positionen'))));
    sheet.appendChild(el('table', { class: 'inv-table', role: 'table' }, el('caption', { class: 'visually-hidden' }, 'Positionen'), el('thead', { role: 'rowgroup' }, thead), tbody));

    var tot = el('dl', { class: 'inv-totals' });
    if (klein) metaRowTotal(tot, 'Gesamtbetrag', I.formatCents(calc.gross), true);
    else {
      metaRowTotal(tot, 'Nettobetrag', I.formatCents(calc.net));
      calc.groups.forEach(function (g) { metaRowTotal(tot, 'zzgl. ' + g.rate + ' % USt auf ' + I.formatCents(g.net), I.formatCents(g.vat)); });
      metaRowTotal(tot, 'Rechnungsbetrag (brutto)', I.formatCents(calc.gross), true);
    }
    sheet.appendChild(tot);
    // Kleinunternehmer: nur Gesamtbetrag, kein Steuersatz, kein Steuerbetrag (auch nicht 0 %), Pflichthinweis nach § 34a Nr. 5 UStDV
    if (klein) sheet.appendChild(el('p', { class: 'inv-taxnote' }, I.KU_NOTE));
    else if (hasZero(calc) && st.exemptNote.trim()) sheet.appendChild(block('inv-taxnote', lines(st.exemptNote), ''));

    var pay = el('div', { class: 'inv-pay' });
    var iban = I.validateIban(st.iban);
    if (due) pay.appendChild(el('p', null, 'Bitte überweisen Sie den Betrag bis zum ' + I.formatDate(due) + ' auf folgendes Konto:'));
    else pay.appendChild(el('p', null, 'Bitte überweisen Sie den Betrag auf folgendes Konto:'));
    var pd = el('dl', { class: 'inv-meta inv-paymeta' });
    if (st.holder.trim()) metaRow(pd, 'Kontoinhaber', st.holder.trim());
    if (iban.ok) metaRow(pd, 'IBAN', iban.formatted); else if (st.iban.trim()) metaRow(pd, 'IBAN', st.iban.trim());
    if (st.bic.trim()) metaRow(pd, 'BIC', st.bic.replace(/\s/g, '').toUpperCase());
    if (st.number.trim()) metaRow(pd, 'Verwendungszweck', st.number.trim());
    if (pd.children.length > 1 || st.holder.trim() || st.iban.trim()) { pay.appendChild(pd); sheet.appendChild(pay); }

    if (st.notes.trim()) sheet.appendChild(block('inv-notes', lines(st.notes), ''));

    var foot = el('footer', { class: 'inv-foot' });
    var col1 = [st.senderName.trim()].concat(lines(st.senderAddress)).filter(Boolean);
    var col2 = [];
    if (st.senderMail.trim()) col2.push(st.senderMail.trim());
    if (st.senderTel.trim()) col2.push('Tel. ' + st.senderTel.trim());
    if (st.senderTaxId.trim()) col2.push((TAX_KINDS[st.senderTaxKind] || TAX_KINDS.stnr) + ': ' + st.senderTaxId.trim());
    if (col1.length) foot.appendChild(block('inv-foot-col', col1, ''));
    if (col2.length) foot.appendChild(block('inv-foot-col', col2, ''));
    if (foot.children.length) sheet.appendChild(foot);
  }
  function hasZero(calc) { return calc.groups.some(function (g) { return g.rate === 0; }); }
  function vatMention(st) {
    if (st.mode === 'regel') return false;
    var texts = [st.notes];
    st.items.forEach(function (it) { texts.push(it.desc, it.unit); });
    return I.mentionsVat(texts);
  }
  function metaRowTotal(dl, k, v, strong) {
    dl.appendChild(el('div', { class: strong ? 'is-total' : null }, el('dt', null, k), el('dd', null, v)));
  }

  function renderChecklist(st, calc) {
    var list = $('inv-check-list');
    list.textContent = '';
    $('inv-check-h').textContent = I.checklistTitle(st.mode);
    var vm = vatMention(st);
    I.checklist({
      senderName: st.senderName, senderAddress: st.senderAddress, senderTaxId: st.senderTaxId, recipientName: st.recipientName, recipientAddress: st.recipientAddress,
      date: st.date, number: st.number, serviceMode: st.serviceMode, serviceDate: st.serviceDate, serviceFrom: st.serviceFrom, serviceTo: st.serviceTo,
      mode: st.mode, validCount: calc.validCount, hasErrors: calc.hasErrors, gross: calc.gross, hasZeroRate: st.mode === 'regel' && hasZero(calc), exemptNote: st.exemptNote
    }).forEach(function (c) {
      var rec = c.level === 'empfohlen';
      list.appendChild(el('li', { class: (c.ok ? 'is-ok' : (rec ? 'is-optional' : 'is-missing')) },
        el('span', { class: 'inv-mark', 'aria-hidden': 'true' }, c.ok ? '✓' : (rec ? 'i' : '!')),
        el('span', { class: 'visually-hidden' }, c.ok ? 'Vorhanden: ' : 'Fehlt: '),
        el('span', null, c.label, rec ? el('span', { class: 'inv-level' }, ' (empfohlen)') : null)));
    });
    var notes = I.notices({ mode: st.mode, gross: calc.gross, hasErrors: calc.hasErrors, vatMention: vm })
      .concat(I.dateWarnings({ startDate: st.startDate, date: st.date, serviceMode: st.serviceMode, serviceDate: st.serviceDate, serviceFrom: st.serviceFrom }).map(function (w) { return { key: w.key, level: 'warn', text: w.text }; }));
    var nl = $('inv-notice-list');
    nl.textContent = '';
    notes.forEach(function (n) {
      nl.appendChild(el('li', { class: n.level === 'warn' ? 'is-warn' : 'is-info' },
        el('span', { class: 'visually-hidden' }, n.level === 'warn' ? 'Bitte prüfen: ' : 'Information: '), n.text));
    });
    $('inv-notices').hidden = !notes.length;
  }

  // ---------- Gesamtupdate ----------
  var last = null;
  function update() {
    var st = readState();
    var isRegel = st.mode === 'regel';
    var rows = itemsBox.querySelectorAll('.inv-rate');
    for (var i = 0; i < rows.length; i++) rows[i].hidden = !isRegel;
    $('tm-hint-klein').hidden = isRegel;
    $('tm-regel-box').hidden = !isRegel;
    $('l-single').hidden = st.serviceMode === 'zeitraum';
    $('l-range').hidden = st.serviceMode !== 'zeitraum';
    var calc = I.calcInvoice({ mode: st.mode, items: st.items });
    var days = I.parseDays(st.days);
    $('i-due').textContent = days !== null && I.isIsoDate(st.date) ? I.formatDate(I.addDays(st.date, days)) : '–';
    calc.lines.forEach(function (l, i) {
      var t = itemsBox.querySelector('[data-total="' + items[i].id + '"]');
      if (t) t.textContent = l.ok ? 'Positionssumme: ' + I.formatCents(l.cents) : '';
    });
    var bad = validateFields(st).concat(validateItems(calc));
    renderPreview(st, calc);
    renderChecklist(st, calc);
    last = { st: st, calc: calc, bad: bad };
    return last;
  }

  // ---------- Ereignisse ----------
  form.addEventListener('input', function (ev) {
    var t = ev.target, f = t.getAttribute && t.getAttribute('data-f');
    if (f) { var ix = itemById(t.getAttribute('data-id')); if (ix > -1) items[ix][f] = t.value; }
    if (t.id === 'i-nr') numberEdited = true;
    if (t.id === 'p-iban') { /* Eingabe unverändert lassen, Formatierung nur in der Vorschau */ }
    update();
  });
  form.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'i-date' && !numberEdited) applySuggestion();
    if (t.id === 'p-iban' && I.validateIban(t.value).ok) t.value = I.formatIban(t.value);
    update();
  });
  form.addEventListener('focusout', function (ev) {
    var t = ev.target;
    if (!t.id) return;
    touched[t.id] = true;
    if (t.getAttribute('data-f')) touched.total = true;
    update();
  });

  itemsBox.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('button[data-act]') : null;
    if (!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id'), ix = itemById(id);
    if (ix < 0 || b.getAttribute('aria-disabled') === 'true') return;
    if (act === 'del') {
      items.splice(ix, 1);
      var replaced = false;
      if (!items.length) { items.push(newItem()); replaced = true; }
      renderItems();
      var target = items[Math.min(ix, items.length - 1)];
      var f = $('it' + target.id + '-desc'); if (f) f.focus();
      say(replaced ? 'Position gelöscht. Es wurde eine leere Position angelegt.' : 'Position ' + (ix + 1) + ' gelöscht. ' + items.length + (items.length === 1 ? ' Position' : ' Positionen') + ' übrig.');
    } else {
      var to = act === 'up' ? ix - 1 : ix + 1;
      var tmp = items[ix]; items[ix] = items[to]; items[to] = tmp;
      renderItems();
      var nb = itemsBox.querySelector('button[data-act="' + act + '"][data-id="' + id + '"]');
      if (nb && nb.getAttribute('aria-disabled') === 'true') nb = itemsBox.querySelector('button[data-act="' + (act === 'up' ? 'down' : 'up') + '"][data-id="' + id + '"]');
      if (nb) nb.focus();
      say('Position verschoben, jetzt Position ' + (to + 1) + ' von ' + items.length + '.');
    }
    update();
  });

  $('item-add').addEventListener('click', function () {
    if (items.length >= MAX_ITEMS) { say('Es sind höchstens ' + MAX_ITEMS + ' Positionen möglich.'); return; }
    var it = newItem();
    items.push(it);
    renderItems('it' + it.id + '-desc');
    update();
    say('Position ' + items.length + ' hinzugefügt.');
  });

  // Absender speichern / Daten löschen
  $('sender-save').addEventListener('click', function () {
    var st = readState();
    var ok = store(KEY_SENDER, JSON.stringify({ senderName: st.senderName, senderAddress: st.senderAddress, senderMail: st.senderMail, senderTel: st.senderTel, senderTaxId: st.senderTaxId, senderTaxKind: st.senderTaxKind, startDate: st.startDate, holder: st.holder, iban: st.iban, bic: st.bic, days: st.days, mode: st.mode }));
    say(ok ? 'Absender und Zahlungsinformationen wurden auf diesem Gerät gespeichert.' : 'Speichern ist in diesem Browser nicht möglich (Speicher gesperrt oder deaktiviert).');
  });
  $('data-clear').addEventListener('click', function () {
    if (!window.confirm('Gespeicherten Absender, Entwurf und Rechnungszähler von diesem Gerät löschen? Die aktuell sichtbaren Eingaben bleiben erhalten.')) return;
    drop(KEY_SENDER); drop(KEY_DRAFT); drop(KEY_COUNTER);
    say('Gespeicherte Daten wurden von diesem Gerät gelöscht.');
  });
  $('draft-save').addEventListener('click', function () {
    var ok = store(KEY_DRAFT, JSON.stringify(readState()));
    say(ok ? 'Entwurf wurde lokal in diesem Browser gespeichert.' : 'Speichern ist in diesem Browser nicht möglich (Speicher gesperrt oder deaktiviert).');
  });
  $('draft-load').addEventListener('click', function () {
    var d = loadJson(KEY_DRAFT);
    if (!d) { say('Es ist kein gespeicherter Entwurf vorhanden.'); return; }
    writeState(d);
    numberEdited = true; suggested = '';
    renderItems(); update();
    say('Entwurf geladen.');
  });

  $('inv-new').addEventListener('click', function () {
    if (!window.confirm('Eine neue Rechnung beginnen? Empfänger, Positionen, Daten und Hinweise dieser Rechnung werden zurückgesetzt. Absender und Zahlungsinformationen bleiben erhalten.')) return;
    ['r-name', 'r-addr', 'l-date', 'l-from', 'l-to', 'n-notes', 't-exempt'].forEach(function (id) { $(id).value = ''; });
    $('i-date').value = todayIso();
    form.querySelector('input[name="lm"][value="datum"]').checked = true;
    items = [newItem()];
    touched = {}; submitted = false;
    applySuggestion();
    renderItems(); update();
    $('r-name').focus();
    say('Neue Rechnung begonnen.');
  });

  var oldTitle = document.title;
  $('inv-print').addEventListener('click', function () {
    submitted = true;
    var r = update();
    if (r.bad.length) {
      var first = $(r.bad[0]);
      say('Bitte korrigieren Sie die markierten Felder, bevor Sie drucken (' + r.bad.length + (r.bad.length === 1 ? ' Fehler' : ' Fehler') + ').');
      if (first) first.focus();
      return;
    }
    if (r.calc.validCount === 0) { say('Bitte legen Sie mindestens eine vollständige Position an.'); $('it' + items[0].id + '-desc').focus(); return; }
    commitCounter();
    var nr = r.st.number.trim();
    oldTitle = document.title;
    document.title = 'Rechnung' + (nr ? ' ' + nr : '');
    window.print();
  });
  window.addEventListener('afterprint', function () { document.title = oldTitle; });

  // ---------- Start ----------
  var dl = el('datalist', { id: 'inv-units' });
  UNITS.forEach(function (u) { dl.appendChild(el('option', { value: u })); });
  form.appendChild(dl);

  $('i-date').value = todayIso();
  items = [newItem()];
  var saved = loadJson(KEY_SENDER);
  if (saved) {
    writeState(Object.assign({}, saved, { items: undefined }));
    items = items.length ? items : [newItem()];
    say('Gespeicherter Absender von diesem Gerät geladen.');
  }
  applySuggestion();
  renderItems();
  update();
})();
