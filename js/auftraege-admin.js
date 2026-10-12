/* Auftragsverwaltung (Admin): Angebote, Verträge, Zahlungen, Rechnungen. Schnittstelle: docs/VERTRAEGE.md §6, Code: worker/src/orders/admin.js.
   Der ADMIN_TOKEN liegt nur im Arbeitsspeicher dieser Seite (nie in localStorage/sessionStorage/Cookies/URLs). Alle Daten werden als Text ausgegeben (kein innerHTML).
   Gefährliche Aktionen verlangen eine eigene Inline-Bestätigung (kein window.confirm/alert). */
(function () {
  'use strict';
  var API = window.YQ.API_BASE;
  var token = '';
  var $ = function (id) { return document.getElementById(id); };

  var STATUS = {
    neue_anfrage: 'Neue Anfrage', angebot_in_bearbeitung: 'Angebot in Bearbeitung', angebot_versendet: 'Angebot versendet', annahme_ausstehend: 'Annahme ausstehend',
    vertrag_geschlossen: 'Vertrag geschlossen', vorauszahlung_offen: 'Vorauszahlung offen', vorauszahlung_eingegangen: 'Vorauszahlung eingegangen', in_bearbeitung: 'In Bearbeitung',
    fertiggestellt: 'Fertiggestellt', rechnung_ausstehend: 'Rechnung ausstehend', rechnung_erstellt: 'Rechnung erstellt', abgeschlossen: 'Abgeschlossen', storniert: 'Storniert'
  };
  var PAY_STATUS = { keine: 'keine Zahlung', offen: 'offen', teilweise: 'teilweise bezahlt', bezahlt: 'bezahlt' };
  var OFFER_STATUS = { entwurf: 'Entwurf', versendet: 'Versendet', angenommen: 'Angenommen', abgelehnt: 'Abgelehnt', abgelaufen: 'Abgelaufen', ersetzt: 'Ersetzt', zurueckgezogen: 'Zurückgezogen' };
  var TAX_STATUS = { vollstaendig: 'vollständig', steuernummer_ausstehend: 'Steuernummer ausstehend', gesperrt: 'gesperrt', freigegeben: 'freigegeben' };
  var MODELS = { vorkasse_100: 'Vorauszahlung (100 %)', anzahlung_50: 'Anzahlung 50 % und Rest nach Abnahme', nach_fertigstellung: 'Zahlung nach Abnahme', monatlich: 'Monatliche Zahlung im Voraus' };
  var REQUEST_KINDS = { vorkasse_100: [['vorauszahlung', 'Vorauszahlung']], anzahlung_50: [['anzahlung', 'Anzahlung'], ['schlusszahlung', 'Schlusszahlung']], nach_fertigstellung: [['nach_fertigstellung', 'Zahlung nach Abnahme']], monatlich: [['monatlich', 'Monatliche Zahlung']] };
  var PAY_METHODS = [['ueberweisung', 'Überweisung'], ['zahlungsdienst', 'Zahlungsdienst'], ['bar', 'Bar'], ['sonstiges', 'Sonstiges']];
  var INVOICE_KINDS = [['rechnung', 'Rechnung'], ['anzahlungsrechnung', 'Anzahlungsrechnung'], ['schlussrechnung', 'Schlussrechnung'], ['kleinbetragsrechnung', 'Kleinbetragsrechnung (bis 250 €)']];
  var MAIL_KINDS = { angebot: 'Angebot', vertrag: 'Vertragsbestätigung', zahlungsaufforderung: 'Zahlungsaufforderung', rechnung: 'Rechnung', intern_annahme: 'Interne Benachrichtigung' };
  var ACC_METHODS = { online: 'Online-Annahme', upload: 'Unterschriebenes PDF', email_manuell: 'Annahme per E-Mail' };
  var CAT = (window.YQ_CATALOG && window.YQ_CATALOG.products) || {};
  var PRODUCTS = [['', '(wie im Auftrag / unverändert)']].concat(Object.keys(CAT).filter(function (k) { return !CAT[k].hidden && !CAT[k].retired; }).map(function (k) { return [k, CAT[k].name || k]; }));

  var MAX_UPLOAD = 10 * 1024 * 1024;

  var state = { view: '', orderId: null, detail: null, filter: '', tax: null, biz: null, sentLink: null };

  // ---------- DOM-Helfer ----------
  var uidN = 0;
  function uid(p) { uidN += 1; return (p || 'f') + '-' + uidN; }
  function h(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, String(v));
    });
    var add = function (c) {
      if (c === null || c === undefined || c === false) return;
      if (Array.isArray(c)) { c.forEach(add); return; }
      n.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    };
    for (var i = 2; i < arguments.length; i++) add(arguments[i]);
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function inp(o) {
    o = o || {};
    var tag = o.tag || 'input';
    var n = h(tag, { id: o.id || uid('i'), type: tag === 'input' ? (o.type || 'text') : null, name: o.name, maxlength: o.maxlength, min: o.min, max: o.max, step: o.step, rows: o.rows, required: o.required, readonly: o.readonly, disabled: o.disabled, placeholder: o.placeholder, inputmode: o.inputmode, autocomplete: 'off', spellcheck: 'false', accept: o.accept });
    if (o.value !== undefined && o.value !== null) n.value = o.value;
    return n;
  }
  function sel(options, value, o) {
    o = o || {};
    var n = h('select', { id: o.id || uid('s'), disabled: o.disabled });
    options.forEach(function (op) { n.appendChild(h('option', { value: op[0] }, op[1])); });
    n.value = value === undefined || value === null ? options[0][0] : value;
    return n;
  }
  function fld(label, control, hint, req) {
    var w = h('div', { class: 'field' }, h('label', { for: control.id }, label, req ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null), control);
    if (hint) { var hid = uid('hint'); w.appendChild(h('p', { id: hid, class: 'offer-hint' }, hint)); control.setAttribute('aria-describedby', hid); }
    return w;
  }
  function chk(label, checked, o) {
    o = o || {};
    var c = h('input', { type: 'checkbox', id: o.id || uid('c'), disabled: o.disabled });
    c.checked = !!checked;
    return { input: c, node: h('div', { class: 'field' }, h('label', { for: c.id, class: 'check-line' }, c, h('span', null, label))) };
  }
  function btn(label, cls, onclick, extra) {
    var attrs = { type: 'button', class: 'btn btn-small ' + (cls || ''), onclick: onclick };
    if (extra) Object.keys(extra).forEach(function (k) { attrs[k] = extra[k]; });
    return h('button', attrs, label);
  }
  function link(label, onclick) { return h('button', { type: 'button', class: 'adm-link', onclick: onclick }, label); }

  // ---------- Formatierung ----------
  var eurFmt = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  function money(c) { return c === null || c === undefined ? '–' : eurFmt.format(Number(c) / 100); }
  function parseEuro(s) {
    s = String(s || '').trim().replace(/[\s€]/g, '');
    if (!/^\d{1,9}([.,]\d{1,2})?$/.test(s)) return null;
    var parts = s.replace(',', '.').split('.');
    return Number(parts[0]) * 100 + Number(((parts[1] || '') + '00').slice(0, 2));
  }
  function euroInput(c) { return c === null || c === undefined ? '' : Math.floor(c / 100) + ',' + String(c % 100).padStart(2, '0'); }
  function fmtTs(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return iso || '–';
    return d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function fmtDay(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s.split('-').reverse().join('.') : (s || '–'); }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function lines(t) { return String(t || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean); }
  function intOrNull(s, label, min, max) {
    s = String(s || '').trim();
    if (s === '') return { value: null };
    if (!/^\d+$/.test(s) || Number(s) < min || Number(s) > max) return { error: label + ': ganze Zahl von ' + min + ' bis ' + max + ' eingeben.' };
    return { value: Number(s) };
  }
  function newKey() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Array.prototype.map.call(crypto.getRandomValues(new Uint8Array(16)), function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  }
  function toBase64(buf) {
    var b = new Uint8Array(buf), s = '';
    for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }

  // ---------- API ----------
  function logout(msg) {
    token = '';
    state = { view: '', orderId: null, detail: null, filter: '', tax: null, biz: null, sentLink: null };
    $('adm-main').hidden = true;
    $('adm-login').hidden = false;
    clear($('adm-view'));
    $('adm-login-msg').textContent = msg || '';
    $('adm-login-msg').className = 'status-msg' + (msg ? ' is-error' : '');
    $('adm-token').focus();
  }
  async function api(method, path, body, headers) {
    var opts = { method: method, headers: Object.assign({ Authorization: 'Bearer ' + token, Accept: 'application/json' }, headers || {}), cache: 'no-store', referrerPolicy: 'no-referrer' };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    var res;
    try { res = await fetch(API + (path.charAt(0) === '/' ? path : '/api/admin/' + path), opts); } catch (e) {
      return { status: 0, ok: false, data: { error: 'Netzwerkfehler: Keine Verbindung zum Server.', code: 'network' } };
    }
    if (res.status === 401) logout('Der Token wurde nicht akzeptiert (401). Bitte erneut anmelden.');
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { status: res.status, ok: res.ok, data: data || {} };
  }
  async function fetchBlob(path) {
    var res;
    try { res = await fetch(API + '/api/admin/' + path, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', referrerPolicy: 'no-referrer' }); } catch (e) { return { error: 'Netzwerkfehler: Keine Verbindung zum Server.' }; }
    if (res.status === 401) { logout('Der Token wurde nicht akzeptiert (401). Bitte erneut anmelden.'); return { error: 'Nicht autorisiert.' }; }
    if (!res.ok) { var d = null; try { d = await res.json(); } catch (e) { d = null; } return { error: (d && d.error) || ('Fehler (Status ' + res.status + ')') }; }
    var m = /filename="?([^";]+)"?/i.exec(res.headers.get('content-disposition') || '');
    return { blob: await res.blob(), name: m ? m[1] : null };
  }

  // ---------- Meldungen ----------
  function notice(kind, text, items, extra) {
    var n = h('div', { class: 'notice ' + kind, role: kind === 'error' ? 'alert' : 'status' }, h('p', null, text));
    if (items && items.length) n.appendChild(h('ul', null, items.map(function (i) { return h('li', null, String(i)); })));
    if (extra) n.appendChild(extra);
    return n;
  }
  var CODE_TEXT = {
    offer_open: 'Die Kundendaten sind gesperrt, solange ein Angebot versendet oder angenommen ist. Bitte das Angebot zuerst zurückziehen und danach eine neue Version anlegen.',
    reason_required: 'Für diese Änderung ist eine Begründung nötig (mindestens 5 Zeichen).',
    acceptor_name_required: 'Bitte den Namen der annehmenden Person angeben.',
    attachment_missing: 'Die Anhänge (Angebots-PDF oder archivierte AGB) sind nicht verfügbar. Es wurde nichts versendet.',
    invoice_incomplete: 'Die Rechnung ist nicht vollständig. Es fehlen Pflichtangaben:',
    anzahlungsrechnung_exists: 'Es gibt bereits eine Anzahlungsrechnung für diesen Auftrag.',
    amount_exceeds_open: 'Der Betrag übersteigt den noch offenen Betrag.',
    order_cancelled: 'Der Auftrag ist storniert; diese Aktion ist nicht mehr möglich.',
    service_date_missing: 'Das Leistungsdatum (oder der Leistungszeitraum) fehlt. Bitte im Rechnungsentwurf ergänzen.',
    invoice_blocked_business: 'Die Rechnung kann nicht ausgestellt werden: Angaben zum Auftragnehmer fehlen im Unternehmensprofil.'
  };
  function errNode(r) {
    var d = r.data || {};
    var text = d.error || ('Unerwarteter Fehler (Status ' + r.status + ').');
    if (CODE_TEXT[d.code]) text = CODE_TEXT[d.code] + (d.error && d.error !== CODE_TEXT[d.code] ? ' (' + d.error + ')' : '');
    var items = Array.isArray(d.missing) ? d.missing : (Array.isArray(d.reasons) ? d.reasons : null);
    var extra = null;
    if (d.code === 'invoice_blocked_tax') {
      text = 'Die Rechnung kann nicht ausgestellt werden: Die steuerlichen Angaben sind unvollständig oder nicht bestätigt.';
      extra = h('div', null, d.hint ? h('p', null, 'Hinweis: ' + d.hint) : null, h('p', null, btn('Steuerprofil öffnen', 'btn-secondary', function () { showSettings(); })));
    } else if (d.code === 'invoice_blocked_business') {
      text = 'Die Rechnung kann nicht ausgestellt werden: Angaben zum Auftragnehmer fehlen im Unternehmensprofil.';
      extra = h('p', null, btn('Unternehmensprofil öffnen', 'btn-secondary', function () { showSettings(); }));
    } else if (d.code === 'offer_incomplete') text = 'Das Angebot ist nicht versandfähig. Es fehlen Pflichtangaben:';
    else if (d.code === 'invoice_exceeds_contract') extra = h('p', null, 'Ausnahme nur mit Begründung (override_reason): Feld unter der Rechnung ausfüllen und erneut ausstellen.');
    else if (d.code === 'orders_not_configured') text = 'Das Auftragsmodul ist im Worker nicht eingerichtet (D1-Datenbank ORDERS_DB fehlt).';
    else if (d.hint) extra = h('p', null, 'Hinweis: ' + d.hint);
    return notice('error', text, items, extra);
  }
  function setArea(area, node) { clear(area); if (node) area.appendChild(node); }
  var toastTimer = null;
  function toast(text) {
    var t = $('adm-toast');
    clear(t);
    t.appendChild(h('span', null, text));
    t.appendChild(h('button', { type: 'button', class: 'adm-toast-x', 'aria-label': 'Meldung schließen', onclick: function () { t.hidden = true; } }, '×'));
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 12000);
  }
  function area() { return h('div', { class: 'adm-area' }); }

  /** Eigener Inline-Bestätigungsdialog (statt window.confirm). Löst mit {value} (Bestätigung) oder null (Abbruch) auf. */
  function confirmInline(trigger, o) {
    return new Promise(function (resolve) {
      var host = trigger.closest('.btn-row') || trigger;
      var old = host.parentNode.querySelector(':scope > .adm-confirm');
      if (old) old.remove();
      var hid = uid('cf');
      var ta = o.reason ? inp({ tag: 'textarea', rows: 3, maxlength: o.reason.maxlength || 500 }) : null;
      var err = h('p', { class: 'field-error', role: 'alert' });
      var ok = h('button', { type: 'button', class: 'btn btn-small' + (o.danger ? ' adm-danger' : '') }, o.label);
      var no = h('button', { type: 'button', class: 'btn btn-small btn-secondary' }, 'Abbrechen');
      var box = h('div', { class: 'adm-confirm', role: 'group', 'aria-labelledby': hid },
        h('h4', { id: hid, tabindex: '-1' }, o.title), h('p', null, o.text), ta ? fld(o.reason.label, ta) : null, err, h('div', { class: 'btn-row' }, ok, no));
      function close(v) { box.remove(); if (trigger.isConnected) trigger.focus(); resolve(v); }
      ok.addEventListener('click', function () {
        if (ta && o.reason.required && ta.value.trim().length < (o.reason.min || 1)) { err.textContent = 'Bitte einen Grund angeben' + (o.reason.min ? ' (mindestens ' + o.reason.min + ' Zeichen)' : '') + '.'; ta.focus(); return; }
        close({ value: ta ? ta.value.trim() : '' });
      });
      no.addEventListener('click', function () { close(null); });
      box.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(null); } });
      host.after(box);
      box.querySelector('h4').focus();
    });
  }

  /** Doppelklick-Schutz: Button während der Aktion sperren. */
  async function act(button, areaNode, fn) {
    if (button.disabled) return undefined;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    if (areaNode) clear(areaNode);
    try { return await fn(); } finally { button.disabled = false; button.removeAttribute('aria-busy'); }
  }

  async function downloadTo(path, fallback, areaNode) {
    setArea(areaNode, h('p', null, 'Dokument wird geladen …'));
    var r = await fetchBlob(path);
    if (r.error) { setArea(areaNode, notice('error', r.error)); return; }
    var url = URL.createObjectURL(new Blob([r.blob], { type: 'application/pdf' }));
    var name = r.name || fallback;
    var a = h('a', { href: url, download: name }, 'Falls der Download nicht startet: ' + name + ' öffnen');
    setArea(areaNode, h('p', null, 'Dokument bereit. ', a));
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
  }

  // ---------- Ansichten ----------
  function setView(name, node, title) {
    state.view = name;
    var v = $('adm-view');
    clear(v);
    var heading = h('h2', { id: 'adm-view-h', tabindex: '-1' }, title);
    v.appendChild(heading);
    v.appendChild(node);
    ['list', 'new', 'settings'].forEach(function (k) { var b = $('adm-nav-' + k); if (k === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    heading.focus();
    window.scrollTo(0, 0);
  }

  async function loadWarnings() {
    var res = await Promise.all([api('GET', 'tax-profile'), api('GET', 'business-profile')]);
    state.tax = res[0].ok ? res[0].data.tax : null;
    state.biz = res[1].ok ? res[1].data : null;
    var box = $('adm-warn');
    clear(box);
    var tax = state.tax, biz = state.biz, any = false;
    if (res[0].status === 503) { box.appendChild(errNode(res[0])); return; }
    if (!tax) box.appendChild(notice('warn', 'Das Steuerprofil konnte nicht geladen werden.'));
    else if (tax.invoice_blocked) {
      any = true;
      box.appendChild(notice('warn', 'Steuerliche Angaben fehlen – Rechnungen sind gesperrt (Steuerstatus: ' + (TAX_STATUS[tax.status] || tax.status) + '):', tax.reasons || tax.missing, h('p', null, btn('Einstellungen öffnen', 'btn-secondary', function () { showSettings(); }))));
    }
    if (biz && biz.missing && biz.missing.length) {
      any = true;
      box.appendChild(notice('warn', 'Angaben im Unternehmensprofil fehlen (nötig für Angebot und Rechnung):', biz.missing, h('p', null, btn('Einstellungen öffnen', 'btn-secondary', function () { showSettings(); }))));
    }
    var cw = res[0].ok ? res[0].data.config_warnings : null;
    if (cw && cw.length) { any = true; box.appendChild(notice('warn', 'Konfigurationshinweise:', cw)); }
    if (!any && tax && biz) box.appendChild(notice('success', 'Steuer- und Unternehmensprofil sind vollständig (Steuerstatus: ' + (TAX_STATUS[tax.status] || tax.status) + ').'));
  }

  // ----- Liste -----
  async function showList() {
    var wrap = h('div');
    var filter = sel([['', 'Alle Status']].concat(Object.keys(STATUS).map(function (k) { return [k, STATUS[k]]; })), state.filter, { id: 'adm-filter' });
    var out = h('div', { id: 'adm-list-out' });
    var reload = btn('Neu laden', 'btn-secondary', function () { loadOrders(); });
    wrap.appendChild(h('div', { class: 'adm-toolbar' }, h('div', { class: 'field' }, h('label', { for: 'adm-filter' }, 'Statusfilter'), filter), reload));
    wrap.appendChild(out);
    filter.addEventListener('change', function () { state.filter = filter.value; loadOrders(); });
    async function loadOrders() {
      setArea(out, h('p', null, 'Aufträge werden geladen …'));
      var r = await api('GET', 'orders' + (state.filter ? '?status=' + encodeURIComponent(state.filter) : ''));
      if (!r.ok) { setArea(out, errNode(r)); return; }
      renderOrders(out, r.data);
      loadWarnings();
    }
    setView('list', wrap, 'Aufträge');
    await loadOrders();
  }

  function renderOrders(out, d) {
    clear(out);
    var rows = d.orders || [];
    out.appendChild(h('p', { class: 'offer-hint', role: 'status' }, rows.length + (rows.length === 1 ? ' Auftrag' : ' Aufträge') + (state.filter ? ' mit Status „' + STATUS[state.filter] + '“' : '') + ' (neueste zuerst, höchstens 500).'));
    if (!rows.length) { out.appendChild(notice('info', 'Keine Aufträge vorhanden. Mit „Neuer Auftrag“ eine Anfrage importieren oder manuell anlegen.')); return; }
    var taxLabel = (TAX_STATUS[d.tax_status] || d.tax_status || '–') + (d.tax_invoice_blocked ? ' (Rechnungen gesperrt)' : '');
    var table = h('table', { class: 'adm-table' });
    table.appendChild(h('caption', { class: 'visually-hidden' }, 'Aufträge'));
    table.appendChild(h('thead', null, h('tr', null, ['Anfrage-ID', 'Angebotsnr.', 'Vertragsnr.', 'Kunde', 'Produkt', 'Betrag', 'Status', 'Zahlung', 'Steuerstatus'].map(function (t) { return h('th', { scope: 'col' }, t); }))));
    var tb = h('tbody');
    rows.forEach(function (o) {
      var c = o.customer || {};
      var cust = [c.company, c.name].filter(Boolean).join(', ') || c.email || '–';
      tb.appendChild(h('tr', null,
        h('th', { scope: 'row', 'data-label': 'Anfrage-ID' }, link(o.request_id, function () { showDetail(o.id); })),
        h('td', { 'data-label': 'Angebotsnr.' }, o.offer_no || '–'),
        h('td', { 'data-label': 'Vertragsnr.' }, o.contract_no || '–'),
        h('td', { 'data-label': 'Kunde' }, cust),
        h('td', { 'data-label': 'Produkt' }, o.product_name || '–'),
        h('td', { 'data-label': 'Betrag' }, money(o.amount_cents)),
        h('td', { 'data-label': 'Status' }, h('span', { class: 'badge badge-neutral' }, o.status_label || STATUS[o.status] || o.status)),
        h('td', { 'data-label': 'Zahlung' }, PAY_STATUS[o.payment_status] || o.payment_status || '–'),
        h('td', { 'data-label': 'Steuerstatus' }, taxLabel)));
    });
    table.appendChild(tb);
    out.appendChild(table);
  }

  // ----- Neuer Auftrag -----
  function showNew() {
    var wrap = h('div');
    // Import aus Lead
    var imp = h('div', { class: 'adm-card' }, h('h3', null, 'Aus Anfrage importieren'));
    var leadKey = inp({ id: 'adm-leadkey', placeholder: 'lead:2026-10-11T…' });
    var impArea = area();
    var leadList = h('div');
    imp.appendChild(h('p', { class: 'offer-hint' }, 'Übernimmt Firma, Name, E-Mail und Produkt aus einer Bestellanfrage. Der Auftrag startet immer als „Neue Anfrage“.'));
    imp.appendChild(h('p', null, btn('Bestellanfragen laden', 'btn-secondary', async function (ev) {
      var b = ev.currentTarget;
      await act(b, impArea, async function () {
        var r = await api('GET', '/api/leads');
        if (!r.ok) { setArea(impArea, errNode(r)); return; }
        var leads = (r.data.leads || []).filter(function (l) { return l.source === 'bestellung'; });
        clear(leadList);
        if (!leads.length) { leadList.appendChild(notice('info', 'Keine Bestellanfragen gefunden.')); return; }
        var ul = h('ul', { class: 'adm-leads' });
        leads.slice(0, 50).forEach(function (l) {
          ul.appendChild(h('li', null, h('span', null, (l.id || 'ohne ID') + ' · ' + fmtTs(l.t) + ' · ' + (l.email || '')), ' ', btn('Auswählen', 'btn-secondary', function () { leadKey.value = l.key; leadKey.focus(); })));
        });
        leadList.appendChild(ul);
      });
    })));
    imp.appendChild(leadList);
    var impForm = h('form', { novalidate: true }, fld('Lead-Schlüssel', leadKey, 'Beginnt mit „lead:“.', true), h('button', { type: 'submit', class: 'btn btn-small' }, 'Auftrag importieren'), impArea);
    impForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var sb = impForm.querySelector('button[type=submit]');
      var key = leadKey.value.trim();
      if (!/^lead:/.test(key)) { setArea(impArea, notice('error', 'Bitte einen Schlüssel eingeben, der mit „lead:“ beginnt.')); leadKey.focus(); return; }
      await act(sb, impArea, async function () {
        var r = await api('POST', 'orders', { lead_key: key });
        if (!r.ok) { setArea(impArea, errNode(r)); return; }
        toast('Auftrag ' + r.data.order.request_id + ' angelegt.');
        showDetail(r.data.order.id);
      });
    });
    imp.appendChild(impForm);
    wrap.appendChild(imp);

    // Manuell
    var man = h('div', { class: 'adm-card' }, h('h3', null, 'Manuell anlegen'));
    var f = customerFields({ customer: {}, product_id: '' }, true);
    var manArea = area();
    var form = h('form', { novalidate: true }, f.nodes, h('button', { type: 'submit', class: 'btn btn-small' }, 'Auftrag anlegen'), manArea);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var body = f.read();
      if (!body.customer_company && !body.customer_name && !body.customer_email) { setArea(manArea, notice('error', 'Bitte mindestens Firma, Name oder E-Mail angeben.')); return; }
      var sb = form.querySelector('button[type=submit]');
      await act(sb, manArea, async function () {
        var r = await api('POST', 'orders', body);
        if (!r.ok) { setArea(manArea, errNode(r)); return; }
        toast('Auftrag ' + r.data.order.request_id + ' angelegt.');
        showDetail(r.data.order.id);
      });
    });
    man.appendChild(form);
    wrap.appendChild(man);
    setView('new', wrap, 'Neuer Auftrag');
  }

  /** Kundenfelder (Formular für Neuanlage und Bearbeitung). */
  function customerFields(order, withProduct, readOnly) {
    var c = order.customer || {};
    var ro = !!readOnly;
    var e = {
      company: inp({ value: c.company || '', maxlength: 150, readonly: ro }), name: inp({ value: c.name || '', maxlength: 100, readonly: ro }),
      email: inp({ type: 'email', value: c.email || '', maxlength: 254, readonly: ro }), street: inp({ value: c.street || '', maxlength: 150, readonly: ro }),
      zip: inp({ value: c.zip || '', maxlength: 10, readonly: ro }), city: inp({ value: c.city || '', maxlength: 100, readonly: ro }), country: inp({ value: c.country || 'DE', maxlength: 2, readonly: ro })
    };
    var biz = chk('Kunde ist Unternehmer (§ 14 BGB). Ich bestätige das bewusst; Angebote können nur Unternehmer annehmen.', !!c.is_business, { disabled: ro });
    var prod = withProduct ? sel(PRODUCTS, order.product_id || '') : null;
    var initialBiz = !!c.is_business;
    var reason = inp({ tag: 'textarea', rows: 2, maxlength: 300 });
    var reasonFld = fld('Begründung für die Änderung der Unternehmereigenschaft (Pflicht, mindestens 5 Zeichen; wird im Audit-Log festgehalten)', reason, null, true);
    reasonFld.hidden = true;
    biz.input.addEventListener('change', function () { reasonFld.hidden = withProduct || biz.input.checked === initialBiz; });
    var nodes = [
      fld('Firma', e.company), fld('Ansprechpartner', e.name), fld('E-Mail', e.email), fld('Straße und Hausnummer', e.street),
      h('div', { class: 'adm-row' }, fld('PLZ', e.zip), fld('Ort', e.city), fld('Land (ISO-Code, Pflicht)', e.country, null, true)), biz.node,
      reasonFld, prod ? fld('Produkt', prod) : null
    ];
    return {
      nodes: nodes,
      reasonInput: reason,
      read: function () {
        var o = { customer_company: e.company.value.trim(), customer_name: e.name.value.trim(), customer_email: e.email.value.trim(), customer_street: e.street.value.trim(), customer_zip: e.zip.value.trim(), customer_city: e.city.value.trim(), customer_country: e.country.value.trim() || 'DE', customer_is_business: biz.input.checked };
        if (prod && prod.value) o.product_id = prod.value;
        if (!withProduct && biz.input.checked !== initialBiz) o.reason = reason.value.trim();
        return o;
      }
    };
  }

  // ----- Detail -----
  async function showDetail(id) {
    state.orderId = id;
    var r = await api('GET', 'orders/' + id);
    if (!r.ok) {
      setView('detail', h('div', null, errNode(r), h('p', null, btn('Zur Liste', 'btn-secondary', function () { showList(); }))), 'Auftrag');
      return;
    }
    state.detail = r.data;
    renderDetail(true);
  }
  async function reloadDetail(focusId) {
    var y = window.scrollY;
    var r = await api('GET', 'orders/' + state.orderId);
    if (!r.ok) { toast('Der Auftrag konnte nicht neu geladen werden: ' + ((r.data && r.data.error) || r.status)); return; }
    state.detail = r.data;
    renderDetail(false);
    window.scrollTo(0, y);
    var t = focusId && $(focusId);
    if (t) t.focus({ preventScroll: true });
  }

  function card(id, title) {
    return h('div', { class: 'adm-card', role: 'group', 'aria-labelledby': id }, h('h3', { id: id, tabindex: '-1' }, title));
  }
  function dlist(pairs) {
    var d = h('dl', { class: 'offer-dl' });
    pairs.forEach(function (p) { if (p[1] === null || p[1] === undefined || p[1] === '') return; d.appendChild(h('dt', null, p[0])); d.appendChild(h('dd', null, String(p[1]))); });
    return d;
  }

  function renderDetail(focusTitle) {
    var d = state.detail, o = d.order;
    var wrap = h('div');
    var contract = d.acceptances.length ? d.acceptances[d.acceptances.length - 1] : null;
    var closed = o.status === 'storniert' || o.status === 'abgeschlossen';

    wrap.appendChild(h('p', null, btn('← Zur Liste', 'btn-secondary', function () { showList(); })));
    if (d.warnings && d.warnings.length) wrap.appendChild(notice('warn', 'Hinweis:', d.warnings));
    if (d.config_warnings && d.config_warnings.length) wrap.appendChild(notice('warn', 'Konfigurationshinweise:', d.config_warnings));

    // Kopf + Status
    var head = card('adm-sec-head', 'Auftrag ' + o.request_id);
    head.appendChild(dlist([
      ['Status', o.status_label || STATUS[o.status]], ['Zahlungsstatus', PAY_STATUS[o.payment_status] || o.payment_status], ['Produkt', o.product_name || o.product_id],
      ['Anfrage vom', o.inquiry && o.inquiry.at ? fmtTs(o.inquiry.at) : ''], ['Angelegt', fmtTs(o.created_at)], ['Aufbewahren bis', o.retain_until ? fmtDay(o.retain_until) : '']
    ]));
    head.appendChild(statusForm(d, closed));
    wrap.appendChild(head);

    wrap.appendChild(customerCard(d, contract, closed));
    wrap.appendChild(offersCard(d, contract, closed));
    wrap.appendChild(acceptCard(d));
    wrap.appendChild(paymentCard(d, contract));
    wrap.appendChild(invoiceCard(d, contract));
    wrap.appendChild(documentsCard(d));
    wrap.appendChild(mailCard(d));
    wrap.appendChild(auditCard(d));
    setView('detail', wrap, 'Auftrag ' + o.request_id);
    if (!focusTitle) $('adm-view-h').removeAttribute('tabindex');
  }

  function statusForm(d, closed) {
    var o = d.order;
    var allowed = (d.allowed_transitions || []).filter(function (s) { return s !== 'storniert'; });
    var wrap = h('div', { class: 'adm-sub' });
    var out = area();
    if (allowed.length) {
      var s = sel(allowed.map(function (k) { return [k, STATUS[k]]; }), allowed[0], { id: 'adm-status-sel' });
      var reason = inp({ tag: 'textarea', rows: 2, maxlength: 500 });
      var reasonWrap = fld('Begründung für die Ausnahme (Vorauszahlung nicht vollständig gebucht, mindestens 5 Zeichen)', reason);
      reasonWrap.hidden = true;
      var needsOverride = function () { return s.value === 'in_bearbeitung' && d.payment && d.payment.prepay_due_cents > 0 && d.payment.paid_cents < d.payment.prepay_due_cents; };
      var sync = function () { reasonWrap.hidden = !needsOverride() && !reasonWrap.dataset.force; };
      s.addEventListener('change', sync);
      var go = btn('Status ändern', '', async function (ev) {
        await act(ev.currentTarget, out, async function () {
          var body = { status: s.value };
          if (!reasonWrap.hidden) body.override_reason = reason.value.trim();
          var r = await api('PATCH', 'orders/' + o.id, body);
          if (!r.ok) {
            if (r.data && r.data.code === 'prepayment_missing') { reasonWrap.dataset.force = '1'; reasonWrap.hidden = false; reason.focus(); }
            setArea(out, errNode(r));
            return;
          }
          toast('Status geändert auf „' + STATUS[s.value] + '“.');
          reloadDetail('adm-sec-head');
        });
      });
      wrap.appendChild(h('div', { class: 'adm-row-end' }, fld('Neuer Status (nur erlaubte Wechsel)', s), go));
      wrap.appendChild(reasonWrap);
      sync();
    } else if (!closed) wrap.appendChild(h('p', { class: 'offer-hint' }, 'Aktuell ist kein manueller Statuswechsel möglich. Weitere Status entstehen durch Angebot, Annahme, Zahlung und Rechnung.'));
    if ((d.allowed_transitions || []).indexOf('storniert') !== -1) {
      var cancel = btn('Auftrag stornieren …', 'adm-danger', async function (ev) {
        var b = ev.currentTarget;
        var ok = await confirmInline(b, { title: 'Auftrag wirklich stornieren?', text: 'Offene Angebote werden zurückgezogen und offene Zahlungsaufforderungen storniert. Das lässt sich nicht rückgängig machen.', label: 'Auftrag endgültig stornieren', danger: true });
        if (!ok) return;
        await act(b, out, async function () {
          var r = await api('PATCH', 'orders/' + o.id, { status: 'storniert' });
          if (!r.ok) { setArea(out, errNode(r)); return; }
          toast('Auftrag storniert.');
          reloadDetail('adm-sec-head');
        });
      });
      wrap.appendChild(h('div', { class: 'btn-row' }, cancel));
    }
    wrap.appendChild(out);
    return wrap;
  }

  function customerCard(d, contract, closed) {
    var o = d.order;
    var c = card('adm-sec-customer', 'Kundendaten');
    var offerOpen = d.offers.some(function (x) { return x.status === 'versendet' || x.status === 'angenommen'; });
    var locked = !!contract || closed || offerOpen;
    var f = customerFields(o, false, locked);
    var out = area();
    if (locked) c.appendChild(h('p', { class: 'offer-hint' }, contract ? 'Nach Vertragsschluss sind die Kundendaten gesperrt.' : (closed ? 'Der Auftrag ist geschlossen.' : 'Solange ein Angebot versendet ist, sind die Kundendaten gesperrt. Zur Korrektur das Angebot zurückziehen und eine neue Version anlegen.')));
    var form = h('form', { novalidate: true }, f.nodes, locked ? null : h('button', { type: 'submit', class: 'btn btn-small' }, 'Kundendaten speichern'), out);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (locked) return;
      var body = f.read();
      if (!/^[A-Za-z]{2}$/.test(body.customer_country)) { setArea(out, notice('error', 'Bitte das Land als ISO-Code mit zwei Buchstaben angeben (z. B. DE).')); return; }
      if ('reason' in body && body.reason.length < 5) { setArea(out, notice('error', 'Für die Änderung der Unternehmereigenschaft ist eine Begründung mit mindestens 5 Zeichen nötig.')); f.reasonInput.focus(); return; }
      await act(form.querySelector('button[type=submit]'), out, async function () {
        var r = await api('PATCH', 'orders/' + o.id, body);
        if (!r.ok) { setArea(out, errNode(r)); return; }
        toast('Kundendaten gespeichert.');
        reloadDetail('adm-sec-customer');
      });
    });
    c.appendChild(form);
    return c;
  }

  // ----- Positionen-Editor (Angebot und Rechnung) -----
  function itemsEditor(items) {
    var box = h('div', { class: 'adm-items' });
    var rowsEl = h('div');
    var totalEl = h('p', { class: 'offer-total-line', 'aria-live': 'polite' });
    var rows = [];
    function recalc() {
      var sum = 0, bad = false;
      rows.forEach(function (r) {
        var q = Number(r.qty.value), u = parseEuro(r.price.value);
        if (Number.isInteger(q) && q >= 1 && u !== null) sum += q * u; else bad = true;
      });
      totalEl.textContent = 'Summe: ' + money(sum) + (bad ? ' (unvollständige Zeilen nicht eingerechnet)' : '');
    }
    function addRow(it) {
      var label = inp({ value: it ? it.label : '', maxlength: 300 });
      var qty = inp({ type: 'number', value: it ? it.qty : 1, min: 1, step: 1, inputmode: 'numeric' });
      var price = inp({ value: it ? euroInput(it.unit_cents) : '', inputmode: 'decimal', placeholder: '0,00' });
      var row = { label: label, qty: qty, price: price };
      var node = h('div', { class: 'adm-item', role: 'group', 'aria-label': 'Position' }, fld('Bezeichnung', label), fld('Menge', qty), fld('Einzelpreis in € (Endpreis)', price));
      var rm = btn('Position entfernen', 'btn-secondary', function () { rows.splice(rows.indexOf(row), 1); node.remove(); recalc(); });
      node.appendChild(rm);
      row.node = node;
      rows.push(row);
      rowsEl.appendChild(node);
      [qty, price].forEach(function (x) { x.addEventListener('input', recalc); });
      recalc();
      return row;
    }
    (items || []).forEach(addRow);
    box.appendChild(rowsEl);
    box.appendChild(h('div', { class: 'btn-row' }, btn('Position hinzufügen', 'btn-secondary', function () { addRow(null).label.focus(); })));
    box.appendChild(totalEl);
    return {
      node: box,
      read: function () {
        var out = [];
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i], q = r.qty.value.trim(), u = parseEuro(r.price.value);
          if (!r.label.value.trim()) { return { error: 'Position ' + (i + 1) + ': Bezeichnung fehlt.', focus: r.label }; }
          if (!/^\d+$/.test(q) || Number(q) < 1) { return { error: 'Position ' + (i + 1) + ': Menge muss eine ganze Zahl ab 1 sein.', focus: r.qty }; }
          if (u === null) { return { error: 'Position ' + (i + 1) + ': Einzelpreis bitte als Euro-Betrag wie 249,00 eingeben.', focus: r.price }; }
          out.push({ label: r.label.value.trim(), qty: Number(q), unit_cents: u });
        }
        return { items: out };
      }
    };
  }

  // ----- Angebote -----
  function offersCard(d, contract, closed) {
    var c = card('adm-sec-offers', 'Angebote');
    var o = d.order;
    var offers = d.offers.slice().sort(function (a, b) { return b.version - a.version; });
    var draft = offers.filter(function (x) { return x.status === 'entwurf'; })[0];
    var out = area();

    // Kundenlink (einmalig) – nur im Arbeitsspeicher
    if (state.sentLink) c.appendChild(linkBox());

    offers.forEach(function (of) {
      var b = h('div', { class: 'adm-sub' }, h('h4', null, 'Angebot ' + of.offer_no + ' · Version ' + of.version + ' ', h('span', { class: 'badge badge-neutral' }, OFFER_STATUS[of.status] || of.status)));
      b.appendChild(dlist([
        ['Vertragsnummer', of.contract_no], ['Gesamtpreis', money(of.total_cents)], ['Zahlungsmodell', MODELS[of.payment_model] || ''], ['Zahlungsfrist', of.payment_due_days !== null && of.payment_due_days !== undefined ? of.payment_due_days + ' Tage' : ''],
        ['Leistungsbeginn', (of.data && of.data.start_text) || (of.start_date ? fmtDay(of.start_date) : '')], ['Gültig bis', of.valid_until ? fmtDay(of.valid_until) : ''], ['AGB-Version', of.agb_version],
        ['Versendet', of.sent_at ? fmtTs(of.sent_at) : ''], ['Entschieden', of.decided_at ? fmtTs(of.decided_at) : ''], ['Ablehnungsgrund', of.decline_reason]
      ]));
      if (of.status === 'entwurf') b.appendChild(offerEditor(of, d));
      else if (of.status === 'versendet') b.appendChild(sentOfferActions(of, d));
      c.appendChild(b);
    });

    if (!contract && !closed && !draft) {
      var prod = sel(PRODUCTS, '', { id: 'adm-new-offer-prod' });
      var label = offers.length ? 'Neue Version anlegen' : 'Angebotsentwurf anlegen';
      var create = btn(label, '', async function (ev) {
        await act(ev.currentTarget, out, async function () {
          var body = {};
          if (prod.value) body.product_id = prod.value;
          var r = await api('POST', 'orders/' + o.id + '/offers', body);
          if (!r.ok) { setArea(out, errNode(r)); return; }
          toast('Entwurf angelegt (Version ' + r.data.offer.version + ').' + (r.data.hints && r.data.hints.length ? ' ' + r.data.hints.join(' ') : ''));
          reloadDetail('adm-sec-offers');
        });
      });
      c.appendChild(h('div', { class: 'adm-sub' }, fld('Produkt als Vorlage (optional; füllt Leistung und Preis aus dem Katalog)', prod, offers.length ? 'Ohne Auswahl wird die letzte Version als Vorlage übernommen. Die bisherige Version wird erst beim Versand der neuen ersetzt.' : null), h('div', { class: 'btn-row' }, create)));
    }
    c.appendChild(out);
    return c;
  }

  function linkBox() {
    var sl = state.sentLink;
    var box = h('div', { class: 'notice success', role: 'status' });
    var field = inp({ value: sl.link, readonly: true });
    var cpArea = h('span', { 'aria-live': 'polite' });
    box.appendChild(h('p', null, h('strong', null, 'Kundenlink – wird nur dieses eine Mal angezeigt.'), ' ' + (sl.note || '')));
    if (sl.mail) box.appendChild(h('p', null, 'E-Mail an den Kunden: ' + (sl.mail.status || '–') + (sl.mail.error ? ' (' + sl.mail.error + ')' : '') + '.'));
    box.appendChild(fld('Link zum Kopieren (enthält den geheimen Zugang, nicht öffentlich teilen)', field));
    box.appendChild(h('div', { class: 'btn-row' },
      btn('Link kopieren', '', async function () {
        try { await navigator.clipboard.writeText(sl.link); cpArea.textContent = 'Kopiert.'; } catch (e) { field.focus(); field.select(); cpArea.textContent = 'Bitte mit Strg+C kopieren.'; }
      }),
      btn('Link ausblenden', 'btn-secondary', function () { state.sentLink = null; box.remove(); }), cpArea));
    return box;
  }

  function sentOfferActions(of, d) {
    var out = area();
    var wrap = h('div');
    var row = h('div', { class: 'btn-row' });
    row.appendChild(btn('Neuen Link erzeugen und senden …', 'btn-secondary', async function (ev) {
      var b = ev.currentTarget;
      var ok = await confirmInline(b, { title: 'Angebot erneut senden?', text: 'Es wird ein neuer Link erzeugt und per E-Mail an ' + (d.order.customer.email || 'den Kunden') + ' gesendet. Der bisherige Link wird ungültig.', label: 'Erneut senden' });
      if (!ok) return;
      await act(b, out, async function () {
        var r = await api('POST', 'orders/' + d.order.id + '/resend', { kind: 'angebot', id: of.id });
        if (!r.ok) { setArea(out, errNode(r)); return; }
        state.sentLink = { link: r.data.link, note: r.data.link_note, mail: r.data.mail };
        toast('Neuer Link erzeugt.');
        reloadDetail('adm-sec-offers');
      });
    }));
    row.appendChild(btn('Angebot zurückziehen …', 'adm-danger', async function (ev) {
      var b = ev.currentTarget;
      var ok = await confirmInline(b, { title: 'Angebot zurückziehen?', text: 'Der Kunde kann das Angebot danach nicht mehr annehmen.', label: 'Angebot zurückziehen', danger: true });
      if (!ok) return;
      await act(b, out, async function () {
        var r = await api('POST', 'offers/' + of.id + '/withdraw', {});
        if (!r.ok) { setArea(out, errNode(r)); return; }
        toast('Angebot zurückgezogen.');
        reloadDetail('adm-sec-offers');
      });
    }));
    wrap.appendChild(row);
    wrap.appendChild(manualAccept(of, d));
    wrap.appendChild(out);
    return wrap;
  }

  function manualAccept(of, d) {
    var det = h('details', { class: 'disclosure' }, h('summary', null, 'Annahme außerhalb der Website dokumentieren'));
    var out = area();
    var method = sel([['upload', 'Unterschriebenes Vertrags-PDF hochladen'], ['email_manuell', 'Annahme per E-Mail (manuell dokumentieren)']], 'upload');
    var file = inp({ type: 'file', accept: 'application/pdf,.pdf' });
    var fileFld = fld('Unterschriebene PDF (höchstens 10 MB)', file);
    var date = inp({ type: 'date', max: todayIso() });
    var dateFld = fld('Datum der Annahme-E-Mail', date);
    var note = inp({ tag: 'textarea', rows: 2, maxlength: 1000 });
    var who = inp({ maxlength: 150, value: d.order.customer.name || '' });
    var conf = chk('Bestätigung mit Vertrags-PDF an den Kunden senden', true);
    function sync() { var up = method.value === 'upload'; fileFld.hidden = !up; dateFld.hidden = up; }
    method.addEventListener('change', sync);
    sync();
    var form = h('form', { novalidate: true }, fld('Art der Annahme', method), fileFld, dateFld, fld('Name der annehmenden Person (Pflicht)', who, null, true), fld('Notiz zum Nachweis (z. B. Datum, Absender, Fundstelle)', note), conf.node,
      h('div', { class: 'btn-row' }, h('button', { type: 'submit', class: 'btn btn-small adm-danger' }, 'Annahme dokumentieren …')), out);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var sb = form.querySelector('button[type=submit]');
      var body = { method: method.value, note: note.value.trim(), send_confirmation: conf.input.checked };
      if (who.value.trim().length < 2) { setArea(out, notice('error', 'Bitte den Namen der annehmenden Person angeben (mindestens 2 Zeichen).')); who.focus(); return; }
      body.acceptor_name = who.value.trim();
      if (method.value === 'upload') {
        var f = file.files && file.files[0];
        if (!f) { setArea(out, notice('error', 'Bitte die unterschriebene PDF auswählen.')); file.focus(); return; }
        if (f.size > MAX_UPLOAD) { setArea(out, notice('error', 'Die Datei ist größer als 10 MB.')); file.focus(); return; }
        var buf = await f.arrayBuffer();
        if (String.fromCharCode.apply(null, new Uint8Array(buf.slice(0, 5))) !== '%PDF-') { setArea(out, notice('error', 'Die Datei ist keine PDF-Datei.')); file.focus(); return; }
        body.file = toBase64(buf);
      } else {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) { setArea(out, notice('error', 'Bitte das Datum der E-Mail angeben.')); date.focus(); return; }
        body.email_date = date.value;
      }
      var ok = await confirmInline(sb, { title: 'Annahme verbindlich dokumentieren?', text: 'Damit gilt der Vertrag ' + of.contract_no + ' als geschlossen (' + ACC_METHODS[method.value] + '). Die Annahme ist unveränderlich und kann nicht gelöscht werden. Prüfen Sie Nachweis und Datum.', label: 'Annahme jetzt dokumentieren', danger: true });
      if (!ok) return;
      await act(sb, out, async function () {
        var r = await api('POST', 'offers/' + of.id + '/accept-manual', body);
        if (!r.ok) { setArea(out, errNode(r)); return; }
        toast('Annahme dokumentiert. Vertrag geschlossen.' + (r.data.mail ? ' E-Mail: ' + r.data.mail.status + '.' : ''));
        reloadDetail('adm-sec-accept');
      });
    });
    det.appendChild(form);
    return det;
  }

  function offerEditor(of, d) {
    var data = of.data || {};
    var w = data.website || {};
    var out = area();
    var f = {
      title: inp({ value: data.title || '', maxlength: 200 }),
      description: inp({ tag: 'textarea', rows: 4, maxlength: 4000, value: data.description || '' }),
      scope: inp({ tag: 'textarea', rows: 5, value: (data.scope || []).join('\n') }),
      pages: inp({ type: 'number', min: 0, max: 1000, value: w.pages === undefined || w.pages === null ? '' : w.pages, inputmode: 'numeric' }),
      features: inp({ tag: 'textarea', rows: 3, value: (w.features || []).join('\n') }),
      rounds: inp({ type: 'number', min: 0, max: 1000, value: w.revision_rounds === undefined || w.revision_rounds === null ? '' : w.revision_rounds, inputmode: 'numeric' }),
      hosting: inp({ value: w.hosting || '', maxlength: 300 }),
      notIncluded: inp({ tag: 'textarea', rows: 4, value: (data.not_included || []).join('\n') }),
      duties: inp({ tag: 'textarea', rows: 4, value: (data.customer_duties || []).join('\n') }),
      model: sel([['', '(bitte wählen)']].concat(Object.keys(MODELS).map(function (k) { return [k, MODELS[k]]; })), of.payment_model || ''),
      due: inp({ type: 'number', min: 0, max: 365, value: of.payment_due_days === null || of.payment_due_days === undefined ? '' : of.payment_due_days, inputmode: 'numeric' }),
      startDate: inp({ type: 'date', value: of.start_date || '' }),
      startText: inp({ value: data.start_text || '', maxlength: 300, placeholder: 'z. B. 3 Werktage nach Zahlungseingang' }),
      valid: inp({ type: 'date', value: of.valid_until || '' }),
      support: inp({ value: data.support || '', maxlength: 600 }),
      lead: inp({ value: data.lead_time || '', maxlength: 200 }),
      minTerm: inp({ type: 'number', min: 0, max: 120, value: data.min_term_months === null || data.min_term_months === undefined ? '' : data.min_term_months, inputmode: 'numeric' }),
      cancel: inp({ value: data.cancellation || '', maxlength: 300 }),
      notes: inp({ tag: 'textarea', rows: 3, maxlength: 2000, value: data.notes || '' })
    };
    var items = itemsEditor(data.items || []);
    var form = h('form', { novalidate: true, class: 'adm-offer-form' },
      h('fieldset', null, h('legend', null, 'Leistung'), fld('Titel', f.title), fld('Beschreibung', f.description), fld('Umfang (ein Punkt pro Zeile)', f.scope)),
      h('fieldset', null, h('legend', null, 'Website-Angaben'), h('div', { class: 'adm-row' }, fld('Anzahl Seiten', f.pages), fld('Korrekturrunden', f.rounds)), fld('Funktionen (eine pro Zeile)', f.features), fld('Hosting', f.hosting)),
      h('fieldset', null, h('legend', null, 'Abgrenzung'), fld('Nicht enthalten (ein Punkt pro Zeile)', f.notIncluded), fld('Mitwirkung des Auftraggebers (ein Punkt pro Zeile)', f.duties)),
      h('fieldset', null, h('legend', null, 'Positionen (Endpreise in Euro)'), items.node),
      h('fieldset', null, h('legend', null, 'Zahlung und Termine'), fld('Zahlungsmodell', f.model), h('div', { class: 'adm-row' }, fld('Zahlungsfrist (Tage)', f.due), fld('Gültig bis (einschließlich)', f.valid)),
        h('div', { class: 'adm-row' }, fld('Leistungsbeginn als Datum', f.startDate), fld('oder als Text', f.startText))),
      h('fieldset', null, h('legend', null, 'Weitere Angaben'), fld('Support nach Abschluss', f.support), fld('Lieferzeit', f.lead), h('div', { class: 'adm-row' }, fld('Mindestlaufzeit (Monate)', f.minTerm), fld('Kündigung', f.cancel)), fld('Notizen für den Kunden (erscheinen im Angebot)', f.notes)));

    function read() {
      var it = items.read();
      if (it.error) return { error: it.error, focus: it.focus };
      var pages = intOrNull(f.pages.value, 'Seiten', 0, 1000); if (pages.error) return { error: pages.error, focus: f.pages };
      var rounds = intOrNull(f.rounds.value, 'Korrekturrunden', 0, 1000); if (rounds.error) return { error: rounds.error, focus: f.rounds };
      var due = intOrNull(f.due.value, 'Zahlungsfrist', 0, 365); if (due.error) return { error: due.error, focus: f.due };
      var term = intOrNull(f.minTerm.value, 'Mindestlaufzeit', 0, 120); if (term.error) return { error: term.error, focus: f.minTerm };
      var website = { features: lines(f.features.value), hosting: f.hosting.value.trim() };
      if (pages.value !== null) website.pages = pages.value;
      if (rounds.value !== null) website.revision_rounds = rounds.value;
      return {
        body: {
          data: {
            title: f.title.value.trim(), description: f.description.value.trim(), scope: lines(f.scope.value), website: website, not_included: lines(f.notIncluded.value), customer_duties: lines(f.duties.value),
            items: it.items, notes: f.notes.value.trim(), support: f.support.value.trim(), lead_time: f.lead.value.trim(), start_text: f.startText.value.trim(), min_term_months: term.value, cancellation: f.cancel.value.trim()
          },
          payment_model: f.model.value || null, payment_due_days: due.value, start_date: f.startDate.value || null, valid_until: f.valid.value || null
        }
      };
    }
    async function save(silent) {
      var r = read();
      if (r.error) { setArea(out, notice('error', r.error)); if (r.focus) r.focus.focus(); return false; }
      var res = await api('PATCH', 'offers/' + of.id, r.body);
      if (!res.ok) { setArea(out, errNode(res)); return false; }
      if (!silent) toast('Entwurf gespeichert.');
      return true;
    }
    var row = h('div', { class: 'btn-row' });
    row.appendChild(btn('Entwurf speichern', '', async function (ev) {
      await act(ev.currentTarget, out, async function () { if (await save(false)) reloadDetail('adm-sec-offers'); });
    }));
    row.appendChild(btn('Pflichtangaben prüfen', 'btn-secondary', async function (ev) {
      await act(ev.currentTarget, out, async function () {
        if (!(await save(true))) return;
        var r = await api('GET', 'offers/' + of.id + '/check');
        if (!r.ok) { setArea(out, errNode(r)); return; }
        var node;
        if (r.data.ready) node = notice('success', 'Alle Pflichtangaben sind vorhanden. Das Angebot ist versandfähig.', r.data.warnings);
        else node = notice('warn', 'Es fehlen Pflichtangaben (nichts wird automatisch ergänzt):', r.data.missing, r.data.warnings && r.data.warnings.length ? h('p', null, 'Hinweise: ' + r.data.warnings.join(' ')) : null);
        setArea(out, node);
      });
    }));
    row.appendChild(btn('Entwurfs-PDF (Vorschau)', 'btn-secondary', async function (ev) {
      await act(ev.currentTarget, out, async function () {
        if (!(await save(true))) return;
        await downloadTo('offers/' + of.id + '/preview.pdf', 'ENTWURF-' + of.offer_no + '.pdf', out);
      });
    }));
    row.appendChild(btn('Versenden …', 'adm-danger', async function (ev) {
      var b = ev.currentTarget;
      if (!(await act(b, out, async function () { return save(true); }))) return;
      var ok = await confirmInline(b, { title: 'Angebot verbindlich versenden?', text: 'Das Angebot wird als PDF mit den AGB per E-Mail an ' + (d.order.customer.email || 'den Kunden') + ' gesendet. Danach ist es unveränderlich; Änderungen sind nur über eine neue Version möglich. Prüfen Sie Preis, Parteien und Gültigkeit.', label: 'Jetzt versenden', danger: true });
      if (!ok) return;
      await act(b, out, async function () {
        var r = await api('POST', 'offers/' + of.id + '/send', {});
        if (!r.ok) { setArea(out, errNode(r)); return; }
        state.sentLink = { link: r.data.link, note: r.data.link_note, mail: r.data.mail };
        toast('Angebot versendet.');
        reloadDetail('adm-sec-offers');
      });
    }));
    row.appendChild(btn('Entwurf verwerfen …', 'btn-secondary', async function (ev) {
      var b = ev.currentTarget;
      var ok = await confirmInline(b, { title: 'Entwurf zurückziehen?', text: 'Der Entwurf wird als zurückgezogen markiert. Danach kann ein neuer Entwurf angelegt werden.', label: 'Entwurf zurückziehen', danger: true });
      if (!ok) return;
      await act(b, out, async function () {
        var r = await api('POST', 'offers/' + of.id + '/withdraw', {});
        if (!r.ok) { setArea(out, errNode(r)); return; }
        toast('Entwurf zurückgezogen.');
        reloadDetail('adm-sec-offers');
      });
    }));
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.appendChild(row);
    form.appendChild(out);
    return form;
  }

  // ----- Annahme/Vertrag -----
  function acceptCard(d) {
    var c = card('adm-sec-accept', 'Annahme und Vertrag');
    if (!d.acceptances.length) { c.appendChild(h('p', null, 'Noch keine Annahme. Der Vertrag kommt erst mit einer dokumentierten Annahme zustande (online, Upload oder E-Mail).')); return c; }
    d.acceptances.forEach(function (a) {
      var ev = a.evidence || {};
      c.appendChild(dlist([
        ['Vertrag', a.contract_no + ' (Angebot ' + a.offer_no + ', Version ' + a.offer_version + ')'], ['Angenommen am', a.accepted_at_local || fmtTs(a.accepted_at)], ['Art', ACC_METHODS[a.method] || a.method],
        ['Erfasst von', a.recorded_by], ['Name der annehmenden Person', ev.acceptor_name], ['Datum der E-Mail', ev.email_date ? fmtDay(ev.email_date) : ''], ['Notiz', ev.note], ['Betrag', money(a.total_cents)],
        ['AGB-Version', a.agb_version], ['Prüfsumme Vertragsdaten (SHA-256)', a.snapshot_sha256]
      ]));
    });
    return c;
  }

  // ----- Zahlungen -----
  function paymentCard(d, contract) {
    var c = card('adm-sec-pay', 'Zahlungen');
    var p = d.payment || {};
    var out = area();
    c.appendChild(dlist([
      ['Zahlungsmodell', MODELS[p.model] || ''], ['Vertragssumme', p.total_cents !== null && p.total_cents !== undefined ? money(p.total_cents) : ''], ['Fällige Vorauszahlung', p.prepay_due_cents ? money(p.prepay_due_cents) : ''], ['Gebucht', money(p.paid_cents || 0)],
      ['Offen', p.open_cents !== null && p.open_cents !== undefined ? money(p.open_cents) : ''], ['Überzahlung (Guthaben)', p.overpaid_cents > 0 ? money(p.overpaid_cents) : '']
    ]));
    if (p.overpaid_cents > 0) c.appendChild(notice('warn', 'Es wurde mehr gebucht als vereinbart (' + money(p.overpaid_cents) + '). Bitte prüfen und ggf. erstatten oder verrechnen.'));
    if (!contract) { c.appendChild(h('p', null, 'Zahlungsaufforderungen und Buchungen sind erst nach Vertragsschluss möglich.')); return c; }

    // Zahlungsaufforderungen
    c.appendChild(h('h4', null, 'Zahlungsaufforderungen'));
    if (!d.payment_requests.length) c.appendChild(h('p', { class: 'offer-hint' }, 'Noch keine Zahlungsaufforderung.'));
    d.payment_requests.forEach(function (pr) {
      var o2 = area();
      var row = h('div', { class: 'btn-row' },
        btn(pr.sent_at ? 'Erneut senden …' : 'Per E-Mail senden …', 'btn-secondary', async function (ev) {
          var b = ev.currentTarget;
          var ok = await confirmInline(b, { title: 'Zahlungsaufforderung senden?', text: 'Die Zahlungsaufforderung ' + pr.reference + ' (' + money(pr.amount_cents) + ') wird per E-Mail an ' + (d.order.customer.email || 'den Kunden') + ' gesendet. Sie ist keine Rechnung.', label: 'Senden' });
          if (!ok) return;
          await act(b, o2, async function () {
            var r = await api('POST', 'payment-requests/' + pr.id + '/send', {});
            if (!r.ok) { setArea(o2, errNode(r)); return; }
            toast('Zahlungsaufforderung: E-Mail ' + (r.data.mail && r.data.mail.status) + '.');
            reloadDetail('adm-sec-pay');
          });
        }),
        pr.pdf_doc_id ? btn('PDF', 'btn-secondary', function () { downloadTo('documents/' + pr.pdf_doc_id, 'Zahlungsaufforderung-' + pr.reference + '.pdf', o2); }) : null);
      c.appendChild(h('div', { class: 'adm-sub' }, h('p', null, h('strong', null, pr.kind_label + ' ' + money(pr.amount_cents)), ' · fällig ' + fmtDay(pr.due_date) + ' · ' + pr.status + (pr.sent_at ? ' · gesendet ' + fmtTs(pr.sent_at) : ' · noch nicht gesendet')), h('p', { class: 'offer-hint' }, 'Verwendungszweck: ' + pr.reference), row, o2));
    });
    var kinds = REQUEST_KINDS[p.model] || [];
    if (kinds.length && d.order.status !== 'storniert' && d.order.status !== 'abgeschlossen') {
      var kind = sel(kinds, kinds[0][0]);
      var amt = inp({ inputmode: 'decimal', placeholder: 'leer = laut Zahlungsplan' });
      var due = inp({ type: 'date' });
      var cform = h('form', { novalidate: true, class: 'adm-sub' }, h('h5', null, 'Zahlungsaufforderung erzeugen'), h('div', { class: 'adm-row' }, fld('Art', kind), fld('Betrag in € (optional)', amt), fld('Fällig am (optional)', due)),
        h('button', { type: 'submit', class: 'btn btn-small' }, 'Zahlungsaufforderung erzeugen'));
      var cout = area();
      cform.appendChild(cout);
      cform.addEventListener('submit', async function (e) {
        e.preventDefault();
        var body = { kind: kind.value };
        if (amt.value.trim()) { var v = parseEuro(amt.value); if (v === null || v < 1) { setArea(cout, notice('error', 'Betrag bitte wie 249,00 eingeben.')); amt.focus(); return; } body.amount_cents = v; }
        if (due.value) body.due_date = due.value;
        await act(cform.querySelector('button[type=submit]'), cout, async function () {
          var r = await api('POST', 'orders/' + d.order.id + '/payment-requests', body);
          if (!r.ok) { setArea(cout, errNode(r)); return; }
          toast('Zahlungsaufforderung ' + r.data.payment_request.reference + ' erzeugt.');
          reloadDetail('adm-sec-pay');
        });
      });
      c.appendChild(cform);
    }

    // Buchungen
    c.appendChild(h('h4', null, 'Gebuchte Zahlungen'));
    if (!d.payments.length) c.appendChild(h('p', { class: 'offer-hint' }, 'Noch keine Zahlung gebucht. Status „bezahlt“ entsteht nur durch eine Buchung mit Betrag, Eingangsdatum und Referenz.'));
    else {
      var ul = h('ul', { class: 'adm-plain' });
      d.payments.forEach(function (pay) { ul.appendChild(h('li', null, money(pay.amount_cents) + ' · Eingang ' + fmtDay(pay.received_on) + ' · ' + ((PAY_METHODS.filter(function (m) { return m[0] === pay.method; })[0] || [0, pay.method])[1]) + ' · Referenz ' + pay.external_ref + (pay.note ? ' · ' + pay.note : ''))); });
      c.appendChild(ul);
    }
    if (d.order.status !== 'storniert') {
      var key = newKey(); // je Formularöffnung ein Idempotency-Key; bei Wiederholung nach Fehler bleibt er gleich
      var pa = inp({ inputmode: 'decimal', placeholder: '0,00' });
      var pd = inp({ type: 'date', max: todayIso() });
      var pm = sel(PAY_METHODS, 'ueberweisung');
      var pr2 = inp({ maxlength: 120 });
      var prSel = sel([['', '(automatisch zuordnen)']].concat(d.payment_requests.map(function (x) { return [String(x.id), x.reference + ' · ' + money(x.amount_cents) + ' · ' + x.status]; })), '');
      var pn = inp({ tag: 'textarea', rows: 2, maxlength: 500 });
      var pout = area();
      var pform = h('form', { novalidate: true, class: 'adm-sub' }, h('h5', null, 'Zahlung buchen'), h('p', { class: 'offer-hint' }, 'Nur tatsächlich auf dem Konto eingegangene Zahlungen buchen (Betrag und Datum laut Kontoauszug). Keine Konto- oder Kartendaten eintragen.'),
        h('div', { class: 'adm-row' }, fld('Betrag in €', pa, null, true), fld('Eingangsdatum', pd, null, true)), h('div', { class: 'adm-row' }, fld('Zahlungsart', pm), fld('Referenz (Bankreferenz / Transaktions-ID)', pr2, 'Pflicht; schützt vor Doppelbuchung.', true)),
        fld('Zu Zahlungsaufforderung', prSel), fld('Notiz (optional)', pn), h('button', { type: 'submit', class: 'btn btn-small' }, 'Zahlung buchen'), pout);
      pform.addEventListener('submit', async function (e) {
        e.preventDefault();
        var cents = parseEuro(pa.value);
        if (cents === null || cents < 1) { setArea(pout, notice('error', 'Bitte einen Betrag über 0 wie 249,00 eingeben.')); pa.focus(); return; }
        if (!pd.value) { setArea(pout, notice('error', 'Bitte das Eingangsdatum laut Kontoauszug angeben.')); pd.focus(); return; }
        if (!pr2.value.trim()) { setArea(pout, notice('error', 'Bitte die Referenz (Bankreferenz oder Transaktions-ID) angeben.')); pr2.focus(); return; }
        var body = { amount_cents: cents, received_on: pd.value, method: pm.value, external_ref: pr2.value.trim() };
        if (prSel.value) body.payment_request_id = Number(prSel.value);
        if (pn.value.trim()) body.note = pn.value.trim();
        await act(pform.querySelector('button[type=submit]'), pout, async function () {
          var r = await api('POST', 'orders/' + d.order.id + '/payments', body, { 'Idempotency-Key': key });
          if (!r.ok) { setArea(pout, errNode(r)); return; }
          toast(r.data.duplicate ? 'Diese Zahlung war bereits gebucht (Duplikat, nichts doppelt gebucht).' : 'Zahlung gebucht.' + (r.data.overpaid ? ' Achtung: Es wurde mehr als die Vertragssumme gebucht.' : ''));
          reloadDetail('adm-sec-pay');
        });
      });
      c.appendChild(pform);
    }
    c.appendChild(out);
    return c;
  }

  // ----- Rechnungen -----
  function invoiceCard(d, contract) {
    var c = card('adm-sec-inv', 'Rechnungen');
    var out = area();
    if (d.invoice_deadline_hint) c.appendChild(notice('info', d.invoice_deadline_hint.note + ' (Leistungsdatum ' + fmtDay(d.invoice_deadline_hint.service_date) + ', Richtwert ' + fmtDay(d.invoice_deadline_hint.latest_hint) + ')'));
    if (state.tax && state.tax.invoice_blocked) c.appendChild(notice('warn', 'Rechnungen sind derzeit gesperrt (Steuerangaben fehlen). Bis 250,00 € Gesamtbetrag ist eine Kleinbetragsrechnung auch ohne Steuernummer möglich, sofern der Kleinunternehmerstatus bestätigt ist.'));
    if (!contract) { c.appendChild(h('p', null, 'Rechnungen sind erst nach Vertragsschluss möglich.')); return c; }
    if (!d.invoices.length) c.appendChild(h('p', { class: 'offer-hint' }, 'Noch keine Rechnung.'));
    d.invoices.forEach(function (inv) {
      var o2 = area();
      var b = h('div', { class: 'adm-sub' }, h('h4', null, (inv.invoice_no || 'Entwurf') + ' · ' + inv.kind_label + ' ', h('span', { class: 'badge badge-neutral' }, inv.status)));
      b.appendChild(dlist([
        ['Rechnungsdatum', inv.issue_date ? fmtDay(inv.issue_date) : ''], ['Leistungsdatum', inv.service_date ? fmtDay(inv.service_date) : (inv.service_from ? fmtDay(inv.service_from) + ' bis ' + fmtDay(inv.service_to) : '')],
        ['Summe', money(inv.total_cents)], ['Abgezogene Anzahlungen', inv.prepaid_cents ? money(inv.prepaid_cents) : ''], ['Zu zahlen', inv.status === 'entwurf' ? '' : money(inv.due_cents)], ['Steuerhinweis', inv.tax_note]
      ]));
      var ul = h('ul', { class: 'adm-plain' });
      (inv.items || []).forEach(function (it) { ul.appendChild(h('li', null, it.qty + ' × ' + it.label + ' à ' + money(it.unit_cents))); });
      b.appendChild(ul);
      if (inv.prepaid && inv.prepaid.length) {
        var pl = h('ul', { class: 'adm-plain' });
        inv.prepaid.forEach(function (x) { pl.appendChild(h('li', null, (x.label || ('Anzahlung ' + (x.invoice_no || ''))) + ': −' + money(Math.abs(x.amount_cents)))); });
        b.appendChild(pl);
      }
      var row = h('div', { class: 'btn-row' });
      if (inv.status === 'entwurf') {
        var ovr = inp({ tag: 'textarea', rows: 2, maxlength: 500 });
        var ovrFld = fld('Begründung für die Ausnahme (Rechnung übersteigt den Vertragsbetrag; mindestens 5 Zeichen)', ovr);
        ovrFld.hidden = true;
        b.appendChild(ovrFld);
        row.appendChild(btn('Ausstellen …', 'adm-danger', async function (ev) {
          var bt = ev.currentTarget;
          var ok = await confirmInline(bt, { title: 'Rechnung verbindlich ausstellen?', text: 'Es wird die nächste fortlaufende Rechnungsnummer vergeben. Die Rechnung ist danach unveränderlich und kann nur durch eine Stornorechnung aufgehoben werden.', label: 'Rechnung jetzt ausstellen', danger: true });
          if (!ok) return;
          await act(bt, o2, async function () {
            var r = await api('POST', 'invoices/' + inv.id + '/issue', ovr.value.trim() && !ovrFld.hidden ? { override_reason: ovr.value.trim() } : {});
            if (!r.ok) {
              if (r.data && r.data.code === 'invoice_exceeds_contract') { ovrFld.hidden = false; ovr.focus(); }
              setArea(o2, errNode(r));
              return;
            }
            toast('Rechnung ' + r.data.invoice_no + ' ausgestellt.');
            reloadDetail('adm-sec-inv');
          });
        }));
      } else {
        if (inv.pdf_doc_id) row.appendChild(btn('PDF', 'btn-secondary', function () { downloadTo('documents/' + inv.pdf_doc_id, inv.invoice_no + '.pdf', o2); }));
        row.appendChild(btn('Per E-Mail senden …', 'btn-secondary', async function (ev) {
          var bt = ev.currentTarget;
          var ok = await confirmInline(bt, { title: 'Rechnung senden?', text: 'Die Rechnung ' + inv.invoice_no + ' wird per E-Mail an ' + (d.order.customer.email || 'den Kunden') + ' gesendet.', label: 'Senden' });
          if (!ok) return;
          await act(bt, o2, async function () {
            var r = await api('POST', 'invoices/' + inv.id + '/send', {});
            if (!r.ok) { setArea(o2, errNode(r)); return; }
            toast('Rechnung: E-Mail ' + (r.data.mail && r.data.mail.status) + '.');
            reloadDetail('adm-sec-inv');
          });
        }));
        if (inv.status === 'ausgestellt' && inv.kind !== 'stornorechnung') {
          row.appendChild(btn('Stornieren …', 'adm-danger', async function (ev) {
            var bt = ev.currentTarget;
            var ok = await confirmInline(bt, { title: 'Rechnung ' + inv.invoice_no + ' stornieren?', text: 'Es wird eine Stornorechnung mit eigener Nummer erzeugt; die Rechnung wird aufgehoben. Das lässt sich nicht rückgängig machen.', label: 'Stornorechnung erzeugen', danger: true, reason: { label: 'Grund (optional, höchstens 300 Zeichen)', maxlength: 300 } });
            if (!ok) return;
            await act(bt, o2, async function () {
              var r = await api('POST', 'invoices/' + inv.id + '/cancel', ok.value ? { reason: ok.value } : {});
              if (!r.ok) { setArea(o2, errNode(r)); return; }
              toast('Stornorechnung ' + r.data.storno.invoice_no + ' erzeugt.');
              reloadDetail('adm-sec-inv');
            });
          }));
        }
      }
      b.appendChild(row);
      if (inv.status === 'entwurf') b.appendChild(invoiceDraftEditor(inv, o2));
      b.appendChild(o2);
      c.appendChild(b);
    });

    // Neuer Entwurf
    var kind = sel(INVOICE_KINDS, 'rechnung');
    var sd = inp({ type: 'date' }), sf = inp({ type: 'date' }), st = inp({ type: 'date' });
    var nout = area();
    var nform = h('form', { novalidate: true, class: 'adm-sub' }, h('h5', null, 'Rechnungsentwurf anlegen'), h('p', { class: 'offer-hint' }, 'Positionen werden aus dem Vertrag übernommen (bei Anzahlungsrechnung: 50 % laut Zahlungsplan) und können im Entwurf geändert werden.'),
      fld('Art', kind), h('div', { class: 'adm-row' }, fld('Leistungsdatum', sd), fld('oder Leistungszeitraum von', sf), fld('bis', st)), h('button', { type: 'submit', class: 'btn btn-small' }, 'Entwurf anlegen'), nout);
    nform.addEventListener('submit', async function (e) {
      e.preventDefault();
      var body = { kind: kind.value };
      if (sd.value) body.service_date = sd.value;
      if (sf.value || st.value) { if (!sf.value || !st.value) { setArea(nout, notice('error', 'Bitte Beginn und Ende des Leistungszeitraums angeben.')); return; } body.service_from = sf.value; body.service_to = st.value; }
      await act(nform.querySelector('button[type=submit]'), nout, async function () {
        var r = await api('POST', 'orders/' + d.order.id + '/invoices', body);
        if (!r.ok) { setArea(nout, errNode(r)); return; }
        toast('Rechnungsentwurf angelegt.');
        reloadDetail('adm-sec-inv');
      });
    });
    c.appendChild(nform);
    c.appendChild(out);
    return c;
  }

  function invoiceDraftEditor(inv, o2) {
    var det = h('details', { class: 'disclosure' }, h('summary', null, 'Entwurf bearbeiten (Positionen, Leistungsdatum)'));
    var items = itemsEditor(inv.items || []);
    var sd = inp({ type: 'date', value: inv.service_date || '' }), sf = inp({ type: 'date', value: inv.service_from || '' }), st = inp({ type: 'date', value: inv.service_to || '' });
    var form = h('form', { novalidate: true }, items.node, h('div', { class: 'adm-row' }, fld('Leistungsdatum', sd), fld('oder von', sf), fld('bis', st)), h('button', { type: 'submit', class: 'btn btn-small' }, 'Entwurf speichern'));
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var it = items.read();
      if (it.error) { setArea(o2, notice('error', it.error)); if (it.focus) it.focus.focus(); return; }
      var body = { items: it.items, service_date: sd.value || null, service_from: sf.value || null, service_to: st.value || null };
      await act(form.querySelector('button[type=submit]'), o2, async function () {
        var r = await api('PATCH', 'invoices/' + inv.id, body);
        if (!r.ok) { setArea(o2, errNode(r)); return; }
        toast('Rechnungsentwurf gespeichert.');
        reloadDetail('adm-sec-inv');
      });
    });
    det.appendChild(form);
    return det;
  }

  // ----- Dokumente, Mail-Log, Audit, Notiz -----
  function documentsCard(d) {
    var c = card('adm-sec-docs', 'Dokumente');
    var out = area();
    if (!d.documents.length) c.appendChild(h('p', { class: 'offer-hint' }, 'Noch keine Dokumente.'));
    else {
      var ul = h('ul', { class: 'adm-plain' });
      d.documents.forEach(function (doc) {
        ul.appendChild(h('li', null, h('span', null, doc.kind + ' · ' + doc.filename + ' · ' + Math.max(1, Math.round(doc.size / 1024)) + ' KB · ' + fmtTs(doc.created_at) + (doc.retain_until ? ' · aufbewahren bis ' + fmtDay(doc.retain_until) : '')), ' ',
          btn('Herunterladen', 'btn-secondary', function () { downloadTo('documents/' + doc.id, doc.filename, out); })));
      });
      c.appendChild(ul);
    }
    c.appendChild(out);
    return c;
  }

  function mailCard(d) {
    var c = card('adm-sec-mail', 'Mail-Log');
    var out = area();
    if (!d.mail_log.length) c.appendChild(h('p', { class: 'offer-hint' }, 'Noch keine E-Mails.'));
    var lastOffer = d.offers.filter(function (o) { return o.status === 'versendet' || o.status === 'angenommen'; }).sort(function (a, b) { return b.version - a.version; })[0];
    var lastAcc = d.acceptances[d.acceptances.length - 1];
    var pending = d.payment_requests.filter(function (x) { return x.status !== 'storniert'; });
    var issued = d.invoices.filter(function (x) { return x.invoice_no; });
    d.mail_log.slice().reverse().forEach(function (m) {
      var target = null;
      if (m.kind === 'angebot' && lastOffer) target = { kind: 'angebot', id: lastOffer.id, warn: 'Es wird ein neuer Link erzeugt; der bisherige Link wird ungültig.' };
      else if (m.kind === 'vertrag' && lastAcc) target = { kind: 'vertrag', id: lastAcc.id, warn: 'Der Vertrag mit Annahmevermerk wird erneut gesendet.' };
      else if (m.kind === 'zahlungsaufforderung' && pending.length === 1) target = { kind: 'zahlungsaufforderung', id: pending[0].id, warn: 'Die Zahlungsaufforderung wird erneut gesendet.' };
      else if (m.kind === 'rechnung' && issued.length === 1) target = { kind: 'rechnung', id: issued[0].id, warn: 'Die Rechnung wird erneut gesendet.' };
      var row = h('div', { class: 'btn-row' });
      if (target) {
        row.appendChild(btn('Erneut senden …', 'btn-secondary', async function (ev) {
          var b = ev.currentTarget;
          var ok = await confirmInline(b, { title: 'E-Mail erneut senden?', text: target.warn + ' Empfänger: ' + (d.order.customer.email || m.recipient) + '.', label: 'Erneut senden' });
          if (!ok) return;
          await act(b, out, async function () {
            var r = await api('POST', 'orders/' + d.order.id + '/resend', { kind: target.kind, id: target.id });
            if (!r.ok) { setArea(out, errNode(r)); return; }
            if (r.data.link) state.sentLink = { link: r.data.link, note: r.data.link_note, mail: r.data.mail };
            toast('E-Mail: ' + ((r.data.mail && r.data.mail.status) || 'ok') + '.');
            reloadDetail('adm-sec-mail');
          });
        }));
      }
      c.appendChild(h('div', { class: 'adm-sub' }, h('p', null, h('strong', null, MAIL_KINDS[m.kind] || m.kind), ' · ' + m.status + ' · ' + fmtTs(m.created_at)), h('p', { class: 'offer-hint' }, 'An ' + m.recipient + ': ' + m.subject + (m.error ? ' (Fehler: ' + m.error + ')' : '')), target ? row : null));
    });
    if (d.mail_log.some(function (m) { return (m.kind === 'zahlungsaufforderung' && pending.length > 1) || (m.kind === 'rechnung' && issued.length > 1); })) c.appendChild(h('p', { class: 'offer-hint' }, 'Bei mehreren Zahlungsaufforderungen oder Rechnungen erneut senden über die jeweilige Liste oben.'));
    c.appendChild(out);
    return c;
  }

  function auditCard(d) {
    var c = card('adm-sec-audit', 'Audit-Log und Notizen');
    var out = area();
    var note = inp({ tag: 'textarea', rows: 3, maxlength: 2000 });
    var form = h('form', { novalidate: true, class: 'adm-sub' }, fld('Manuelle Aktion dokumentieren (Notiz, höchstens 2000 Zeichen)', note, 'Wird unveränderlich im Audit-Log abgelegt.'), h('button', { type: 'submit', class: 'btn btn-small' }, 'Notiz speichern'), out);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!note.value.trim()) { setArea(out, notice('error', 'Bitte eine Notiz eingeben.')); note.focus(); return; }
      await act(form.querySelector('button[type=submit]'), out, async function () {
        var r = await api('POST', 'orders/' + d.order.id + '/notes', { text: note.value.trim() });
        if (!r.ok) { setArea(out, errNode(r)); return; }
        toast('Notiz gespeichert.');
        reloadDetail('adm-sec-audit');
      });
    });
    c.appendChild(form);
    var det = h('details', { class: 'disclosure' }, h('summary', null, 'Verlauf anzeigen (' + d.audit.length + ' Einträge, neueste zuerst)'));
    var ul = h('ul', { class: 'adm-audit' });
    d.audit.forEach(function (a) {
      var detail = a.detail === null || a.detail === undefined ? '' : (typeof a.detail === 'string' ? a.detail : (a.action === 'note' && a.detail.text ? a.detail.text : JSON.stringify(a.detail)));
      ul.appendChild(h('li', null, h('span', { class: 'adm-audit-meta' }, fmtTs(a.at) + ' · ' + a.actor + ' · ' + a.action), detail ? h('span', { class: 'adm-audit-detail' }, detail) : null));
    });
    det.appendChild(ul);
    c.appendChild(det);
    return c;
  }

  // ----- Einstellungen -----
  async function showSettings() {
    var wrap = h('div', null, h('p', null, 'Lade Profile …'));
    setView('settings', wrap, 'Einstellungen');
    var res = await Promise.all([api('GET', 'business-profile'), api('GET', 'tax-profile')]);
    clear(wrap);
    if (!res[0].ok || !res[1].ok) { wrap.appendChild(errNode(!res[0].ok ? res[0] : res[1])); return; }
    wrap.appendChild(businessForm(res[0].data));
    wrap.appendChild(taxForm(res[1].data.tax));
  }

  var FIELD_BY_CODE = { invalid_iban: 'iban', invalid_bic: 'bic', invalid_email: 'email', invalid_zip: 'zip', invalid_website: 'website', invalid_country: 'country', invalid_steuernummer: 'steuernummer', looks_like_idnr: 'steuernummer', invalid_ust_idnr: 'ust_idnr', invalid_kleinunternehmer_idnr: 'kleinunternehmer_idnr', status_requires_tax_id: 'steuernummer', invalid_status: 'status' };
  function showFormError(out, r, refs) {
    setArea(out, errNode(r));
    Object.keys(refs).forEach(function (k) { refs[k].removeAttribute('aria-invalid'); });
    var f = FIELD_BY_CODE[(r.data || {}).code];
    if (f && refs[f]) { refs[f].setAttribute('aria-invalid', 'true'); refs[f].focus(); }
  }

  function businessForm(data) {
    var b = data.business || {};
    var c = card('adm-sec-biz', 'Unternehmensprofil (Auftragnehmer und Bankverbindung)');
    var keys = [['name', 'Name / Firma', 150], ['trade_name', 'Handelsname (optional)', 100], ['street', 'Straße und Hausnummer', 150], ['zip', 'PLZ', 10], ['city', 'Ort', 100], ['country', 'Land (ISO-Code, z. B. DE, Pflicht)', 2], ['email', 'E-Mail', 254], ['website', 'Website (https://…)', 200], ['account_holder', 'Kontoinhaber', 150], ['iban', 'IBAN', 40], ['bic', 'BIC', 11], ['bank_name', 'Bank', 100]];
    var refs = {};
    var out = area();
    var form = h('form', { novalidate: true });
    keys.forEach(function (k) { refs[k[0]] = inp({ value: b[k[0]] || '', maxlength: k[2], type: k[0] === 'email' ? 'email' : 'text' }); });
    if (data.prefilled_from_imprint && data.prefilled_from_imprint.length) c.appendChild(notice('info', 'Vorbelegt aus den Impressumsdaten (bitte prüfen und speichern): ' + data.prefilled_from_imprint.join(', ') + '.'));
    if (data.missing && data.missing.length) c.appendChild(notice('warn', 'Es fehlen Angaben:', data.missing));
    keys.forEach(function (k) { form.appendChild(fld(k[1], refs[k[0]])); });
    form.appendChild(h('button', { type: 'submit', class: 'btn btn-small' }, 'Unternehmensprofil speichern'));
    form.appendChild(out);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var body = {};
      keys.forEach(function (k) { body[k[0]] = refs[k[0]].value.trim(); });
      if (!/^[A-Za-z]{2}$/.test(body.country)) { setArea(out, notice('error', 'Bitte das Land als ISO-Code mit zwei Buchstaben angeben (z. B. DE).')); refs.country.focus(); return; }
      await act(form.querySelector('button[type=submit]'), out, async function () {
        var r = await api('PUT', 'business-profile', body);
        if (!r.ok) { showFormError(out, r, refs); return; }
        toast('Unternehmensprofil gespeichert.');
        loadWarnings();
        setArea(out, r.data.missing && r.data.missing.length ? notice('warn', 'Gespeichert. Es fehlen noch Angaben:', r.data.missing) : notice('success', 'Gespeichert. Alle Pflichtangaben sind vorhanden.'));
      });
    });
    c.appendChild(form);
    return c;
  }

  function taxForm(t) {
    var c = card('adm-sec-tax', 'Steuerprofil');
    c.appendChild(notice('warn', 'Nicht die persönliche Steuer-ID (IdNr.) eintragen.', null, h('p', null, 'Die Steuernummer erhalten Sie vom Finanzamt (mit Schrägstrichen, z. B. 12/345/67890). Eine 11-stellige Zahl ohne Trennzeichen sieht aus wie die persönliche Steuer-ID und wird abgelehnt.')));
    var refs = {};
    var out = area();
    refs.status = sel(Object.keys(TAX_STATUS).map(function (k) { return [k, TAX_STATUS[k]]; }), t.status, { id: 'adm-tax-status' });
    refs.steuernummer = inp({ value: t.steuernummer || '', maxlength: 40 });
    refs.ust_idnr = inp({ value: t.ust_idnr || '', maxlength: 20, placeholder: 'DE123456789' });
    refs.kleinunternehmer_idnr = inp({ value: t.kleinunternehmer_idnr || '', maxlength: 40 });
    refs.notes = inp({ tag: 'textarea', rows: 3, maxlength: 1000, value: t.notes || '' });
    var klein = chk('Ich bin Kleinunternehmer nach § 19 UStG (keine Umsatzsteuer auf Rechnungen)', t.kleinunternehmer);
    var conf = chk('Ich bestätige ausdrücklich, dass ich Kleinunternehmer nach § 19 UStG bin. Erst mit dieser Bestätigung erscheint der Befreiungshinweis auf Rechnungen.', !!t.kleinunternehmer_confirmed_at);
    function sync() { conf.node.hidden = !klein.input.checked; }
    klein.input.addEventListener('change', sync);
    sync();
    c.appendChild(t.invoice_blocked ? notice('warn', 'Rechnungen sind gesperrt:', t.reasons || t.missing) : notice('success', 'Rechnungen sind freigegeben.'));
    if (t.kleinunternehmer_confirmed_at) c.appendChild(h('p', { class: 'offer-hint' }, 'Kleinunternehmerstatus bestätigt am ' + fmtTs(t.kleinunternehmer_confirmed_at) + '.'));
    var form = h('form', { novalidate: true },
      fld('Steuerstatus', refs.status, '„vollständig“ oder „freigegeben“ setzt eine Steuernummer, USt-IdNr. oder Kleinunternehmer-Identifikationsnummer voraus.'),
      fld('Steuernummer (vom Finanzamt)', refs.steuernummer), fld('USt-IdNr. (DE + 9 Ziffern)', refs.ust_idnr), fld('Kleinunternehmer-Identifikationsnummer', refs.kleinunternehmer_idnr),
      klein.node, conf.node, fld('Notizen (intern)', refs.notes), h('button', { type: 'submit', class: 'btn btn-small' }, 'Steuerprofil speichern'), out);
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var body = { status: refs.status.value, steuernummer: refs.steuernummer.value.trim(), ust_idnr: refs.ust_idnr.value.trim(), kleinunternehmer_idnr: refs.kleinunternehmer_idnr.value.trim(), kleinunternehmer: klein.input.checked, notes: refs.notes.value.trim() };
      if (klein.input.checked) body.confirm_kleinunternehmer = conf.input.checked;
      await act(form.querySelector('button[type=submit]'), out, async function () {
        var r = await api('PUT', 'tax-profile', body);
        if (!r.ok) { showFormError(out, r, refs); return; }
        toast('Steuerprofil gespeichert.');
        loadWarnings();
        var nt = r.data.tax;
        setArea(out, nt.invoice_blocked ? notice('warn', 'Gespeichert. Rechnungen sind noch gesperrt:', nt.reasons || nt.missing) : notice('success', 'Gespeichert. Rechnungen sind freigegeben.'));
      });
    });
    c.appendChild(form);
    return c;
  }

  // ---------- Start ----------
  $('adm-login').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = $('adm-login-msg');
    var b = $('adm-login-btn');
    token = $('adm-token').value.trim();
    $('adm-token').value = '';
    if (!token) { msg.textContent = 'Bitte den ADMIN_TOKEN eingeben.'; msg.className = 'status-msg is-error'; return; }
    b.disabled = true;
    msg.className = 'status-msg';
    msg.textContent = 'Anmeldung …';
    var r = await api('GET', 'tax-profile');
    b.disabled = false;
    if (r.status === 401) return; // logout() hat die Meldung gesetzt
    if (!r.ok) {
      token = '';
      msg.className = 'status-msg is-error';
      msg.textContent = r.data && r.data.code === 'orders_not_configured' ? 'Das Auftragsmodul ist im Worker nicht eingerichtet (D1-Datenbank ORDERS_DB fehlt).' : ((r.data && r.data.error) || 'Anmeldung fehlgeschlagen.');
      return;
    }
    msg.textContent = '';
    $('adm-login').hidden = true;
    $('adm-main').hidden = false;
    await loadWarnings();
    showList();
  });
  $('adm-nav-list').addEventListener('click', function () { showList(); });
  $('adm-nav-new').addEventListener('click', function () { showNew(); });
  $('adm-nav-settings').addEventListener('click', function () { showSettings(); });
  $('adm-nav-logout').addEventListener('click', function () { logout('Abgemeldet. Der Token wurde aus dem Arbeitsspeicher entfernt.'); $('adm-login-msg').className = 'status-msg'; });
})();
