/* Angebotsseite (/angebot): zeigt das Angebot, nimmt es online an oder lehnt es ab.
   Der Zugangstoken kommt aus location.hash (#t=...), wird sofort aus der Adresszeile entfernt und nur im Arbeitsspeicher gehalten
   (nie in localStorage/sessionStorage/Cookies/URLs). Alle Daten werden als Text ausgegeben (kein innerHTML). Schnittstelle: docs/VERTRAEGE.md §6. */
(function () {
  'use strict';
  var YQ = window.YQ, el = YQ.el;
  var $ = function (id) { return document.getElementById(id); };
  var root = $('offer-root'), statusEl = $('offer-status'), h1 = $('offer-h1');
  var token = '';
  var view = null;          // letzte Antwort von GET /api/offer
  var fresh = null;         // Antwort der soeben erfolgten Online-Annahme (für den Hinweis zur Bestätigungsmail)
  var busy = false;         // Doppelklick-Schutz für Annahme/Ablehnung

  var FALLBACK_BUTTON = 'Angebot zahlungspflichtig annehmen';
  var STATUS_LABELS = { versendet: 'Offen', angenommen: 'Angenommen', abgelaufen: 'Abgelaufen', abgelehnt: 'Abgelehnt', zurueckgezogen: 'Zurückgezogen', ersetzt: 'Durch neuere Version ersetzt' };
  var METHOD_LABELS = { online: 'Online-Annahme über diese Seite', upload: 'Unterschriebenes Vertrags-PDF', email_manuell: 'Annahme per E-Mail' };
  var INFO_ORDER = ['schritte', 'vertragstext', 'eingabefehler', 'sprache', 'verhaltenskodex'];

  // ---------- Formatierung ----------
  var eur = (typeof Intl !== 'undefined') ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }) : null;
  function money(c) { var n = Number(c) / 100; return eur ? eur.format(n) : n.toFixed(2).replace('.', ',') + ' €'; }
  function deDay(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s.split('-').reverse().join('.') : String(s || ''); }
  function deStamp(iso) {
    var d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return '';
    try { return d.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr'; } catch (e) { return iso; }
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function para(text, cls) { return el('p', cls ? { class: cls } : null, text); }

  // ---------- Token ----------
  function takeToken() {
    var m = /(?:^#|&)t=([A-Za-z0-9_-]{16,200})(?:&|$)/.exec(window.location.hash || '');
    if (window.location.hash) {
      try { window.history.replaceState(null, document.title, window.location.pathname + window.location.search); } catch (e) { /* ältere Browser: Fragment bleibt sichtbar */ }
    }
    return m ? m[1] : '';
  }

  // ---------- API ----------
  function req(method, path, body) {
    var opts = { method: method, headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, cache: 'no-store', referrerPolicy: 'no-referrer' };
    if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(YQ.API_BASE + path, opts).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) { return { status: r.status, data: d }; });
    }, function () { var e = new Error('network'); e.network = true; throw e; });
  }

  /** PDF per fetch mit Bearer laden und als Blob zum Download anbieten (kein Token in URLs). */
  function downloadPdf(kind, fallbackName, out, trigger) {
    clear(out);
    out.appendChild(document.createTextNode('Dokument wird geladen …'));
    if (trigger) trigger.setAttribute('aria-busy', 'true');
    var done = function () { if (trigger) trigger.removeAttribute('aria-busy'); };
    return fetch(YQ.API_BASE + '/api/offer/document?kind=' + encodeURIComponent(kind), { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store', referrerPolicy: 'no-referrer' }).then(function (r) {
      if (!r.ok) { var e = new Error('http'); e.status = r.status; throw e; }
      var cd = r.headers.get('content-disposition') || '';
      var m = /filename="?([^";]+)"?/i.exec(cd);
      return r.blob().then(function (b) { return { blob: b, name: m ? m[1] : fallbackName }; });
    }).then(function (f) {
      var url = URL.createObjectURL(new Blob([f.blob], { type: 'application/pdf' }));
      var a = el('a', { href: url, download: f.name, class: 'offer-dl-link' }, 'Falls der Download nicht startet: ' + f.name + ' öffnen');
      clear(out);
      out.appendChild(document.createTextNode('Dokument bereit. '));
      out.appendChild(a);
      a.click();
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) { /* egal */ } }, 120000);
      done();
    }, function (e) {
      done();
      clear(out);
      out.appendChild(document.createTextNode(e && e.status === 404 ? 'Dieses Dokument ist nicht verfügbar.' : 'Das Dokument konnte nicht geladen werden. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.'));
    });
  }

  // ---------- Zustandsseiten ----------
  function showOnly(node) { clear(root); root.hidden = false; root.appendChild(node); }
  function setHeading(text) { h1.textContent = text; }
  function announce(text) { statusEl.textContent = text; }

  function showInvalid() {
    setHeading('Link ungültig');
    announce('');
    var box = el('div', { class: 'notice warn', role: 'note' },
      para('Dieser Link ist ungültig oder nicht mehr gültig.'),
      para('Bitte öffnen Sie den Link aus Ihrer Angebots-E-Mail erneut. Wenn Sie die Seite neu geladen haben, geht der Zugang aus Sicherheitsgründen verloren, weil er nicht gespeichert wird. Bei Fragen schreiben Sie uns an '),
    );
    box.lastChild.appendChild(el('a', { href: 'mailto:' + YQ.CONTACT_EMAIL }, YQ.CONTACT_EMAIL));
    box.lastChild.appendChild(document.createTextNode('.'));
    showOnly(box);
    h1.focus();
  }

  function showFailure(text, retry) {
    setHeading('Angebot');
    announce('');
    var box = el('div', { class: 'notice error', role: 'alert' }, para(text));
    if (retry) {
      var b = el('button', { type: 'button', class: 'btn btn-secondary' }, 'Erneut versuchen');
      b.addEventListener('click', load);
      box.appendChild(el('p', null, b));
    }
    showOnly(box);
    h1.focus();
  }

  // ---------- Bausteine ----------
  function block(title, id) {
    var h = el('h2', { id: id }, title);
    var d = el('div', { class: 'offer-card', role: 'group', 'aria-labelledby': id });
    d.appendChild(h);
    return d;
  }
  function dl(pairs) {
    var d = el('dl', { class: 'offer-dl' });
    pairs.forEach(function (p) {
      if (p[1] === null || p[1] === undefined || p[1] === '') return;
      d.appendChild(el('dt', null, p[0]));
      d.appendChild(el('dd', null, String(p[1])));
    });
    return d;
  }
  function list(items) {
    var ul = el('ul', { class: 'offer-list' });
    items.forEach(function (t) { ul.appendChild(el('li', null, String(t))); });
    return ul;
  }
  function party(title, p) {
    var d = el('div', { class: 'offer-party' }, el('h3', null, title));
    if (!p) { d.appendChild(para('–')); return d; }
    var lines = [p.company || p.name, p.company ? p.name : p.trade_name, p.street, [p.zip, p.city].filter(Boolean).join(' '), p.country && p.country !== 'DE' ? p.country : '', p.email].filter(Boolean);
    var addr = el('p', { class: 'offer-addr' });
    lines.forEach(function (l, i) { if (i) addr.appendChild(el('br')); addr.appendChild(document.createTextNode(l)); });
    d.appendChild(addr);
    return d;
  }

  function statusBanner(v) {
    var o = v.offer;
    if (v.accepted) return null; // eigener Bestätigungsblock
    var expired = o.status === 'abgelaufen' || (o.status === 'versendet' && o.expired);
    if (expired) return ['warn', 'Dieses Angebot ist abgelaufen.', 'Die Gültigkeit endete am ' + deDay(o.valid_until) + '. Sie können es nicht mehr online annehmen. Wenn Sie weiterhin Interesse haben, melden Sie sich bitte; wir erstellen Ihnen gern ein neues Angebot.'];
    if (o.status === 'abgelehnt') return ['info', 'Sie haben dieses Angebot abgelehnt.', 'Es ist kein Vertrag zustande gekommen. Falls das ein Versehen war, melden Sie sich bitte bei uns.'];
    if (o.status === 'zurueckgezogen') return ['warn', 'Dieses Angebot wurde zurückgezogen.', 'Es kann nicht mehr angenommen werden. Bei Fragen melden Sie sich bitte bei uns.'];
    if (o.status === 'ersetzt') return ['warn', 'Dieses Angebot wurde durch eine neuere Version ersetzt.', 'Bitte verwenden Sie den Link aus der neuesten Angebots-E-Mail. Diese Fassung kann nicht mehr angenommen werden.'];
    if (o.status === 'versendet' && !v.can_accept) return ['warn', 'Dieses Angebot kann online derzeit nicht angenommen werden.', 'Bitte melden Sie sich bei uns, dann klären wir das gemeinsam.'];
    return null;
  }

  function acceptedBlock(v) {
    var a = v.accepted;
    var b = el('div', { class: 'offer-card offer-accepted', role: 'group', 'aria-labelledby': 'offer-acc-h' });
    var h = el('h2', { id: 'offer-acc-h', tabindex: '-1' }, 'Angebot angenommen – Vertrag geschlossen');
    b.appendChild(h);
    b.appendChild(dl([
      ['Vertragsnummer', a.contract_no],
      ['Angebotsnummer', a.offer_no],
      ['Angenommen am', a.accepted_at_local || deStamp(a.accepted_at)],
      ['Art der Annahme', METHOD_LABELS[a.method] || a.method]
    ]));
    if (fresh && fresh.confirmation_mail === 'gesendet') b.appendChild(para('Wir haben Ihnen eine Bestätigung mit dem Vertrag und den AGB per E-Mail gesendet.'));
    else if (fresh) b.appendChild(para('Ihre Annahme ist bei uns eingegangen. Die Bestätigung per E-Mail konnte gerade nicht zugestellt werden; wir senden sie Ihnen unverzüglich nach. Den Vertrag können Sie hier herunterladen.'));
    else b.appendChild(para('Der Vertrag ist geschlossen. Den Vertrag mit Annahmevermerk können Sie hier herunterladen.'));
    if (v.documents && v.documents.vertrag) {
      var out = el('p', { class: 'offer-dl-status', role: 'status', 'aria-live': 'polite' });
      var btn = el('button', { type: 'button', class: 'btn' }, 'Vertrag herunterladen (PDF)');
      btn.addEventListener('click', function () { downloadPdf('vertrag', 'Vertrag-' + a.contract_no + '.pdf', out, btn); });
      b.appendChild(el('p', null, btn));
      b.appendChild(out);
    }
    return b;
  }

  function itemsTable(o) {
    var table = el('table', { class: 'offer-table' });
    table.appendChild(el('caption', { class: 'visually-hidden' }, 'Positionen'));
    table.appendChild(el('thead', null, el('tr', null, el('th', { scope: 'col' }, 'Position'), el('th', { scope: 'col', class: 'num' }, 'Menge'), el('th', { scope: 'col', class: 'num' }, 'Einzelpreis'), el('th', { scope: 'col', class: 'num' }, 'Summe'))));
    var tb = el('tbody');
    (o.items || []).forEach(function (it) {
      tb.appendChild(el('tr', null,
        el('th', { scope: 'row', 'data-label': 'Position' }, it.label),
        el('td', { class: 'num', 'data-label': 'Menge' }, String(it.qty)),
        el('td', { class: 'num', 'data-label': 'Einzelpreis' }, money(it.unit_cents)),
        el('td', { class: 'num', 'data-label': 'Summe' }, money(it.total_cents))));
    });
    table.appendChild(tb);
    return table;
  }

  function scopeBlock(o) {
    var b = block('Leistungsbeschreibung', 'offer-scope-h');
    if (o.title) b.appendChild(el('h3', null, o.title));
    if (o.description) b.appendChild(para(o.description, 'offer-pre'));
    if (o.scope && o.scope.length) { b.appendChild(el('h3', null, 'Leistungsumfang')); b.appendChild(list(o.scope)); }
    var w = o.website;
    if (w && (w.pages != null || (w.features && w.features.length) || w.revision_rounds != null || w.hosting)) {
      b.appendChild(el('h3', null, 'Angaben zur Website'));
      b.appendChild(dl([
        ['Seiten', w.pages != null ? w.pages : ''],
        ['Funktionen', w.features && w.features.length ? w.features.join(', ') : ''],
        ['Korrekturrunden', w.revision_rounds != null ? w.revision_rounds : ''],
        ['Hosting', w.hosting]
      ]));
    }
    if (o.not_included && o.not_included.length) { b.appendChild(el('h3', null, 'Nicht enthalten')); b.appendChild(list(o.not_included)); }
    if (o.customer_duties && o.customer_duties.length) { b.appendChild(el('h3', null, 'Mitwirkung des Auftraggebers')); b.appendChild(list(o.customer_duties)); }
    var extra = dl([['Support nach Abschluss', o.support], ['Lieferzeit', o.lead_time], ['Mindestlaufzeit', o.min_term_months ? o.min_term_months + ' Monate' : ''], ['Kündigung', o.cancellation]]);
    if (extra.firstChild) b.appendChild(extra);
    if (o.notes) { b.appendChild(el('h3', null, 'Hinweise')); b.appendChild(para(o.notes, 'offer-pre')); }
    b.appendChild(el('h3', null, 'Positionen'));
    b.appendChild(itemsTable(o));
    return b;
  }

  function priceBlock(o) {
    var b = block('Preis und Zahlung', 'offer-price-h');
    b.appendChild(el('p', { class: 'offer-total' }, el('span', { class: 'offer-total-label' }, 'Gesamtpreis'), el('strong', null, money(o.total_cents))));
    var pn = (view.clauses && view.clauses.price_note) || (o.tax && o.tax.price_note);
    if (pn) b.appendChild(para(pn, 'offer-note'));
    var p = o.payment;
    if (p) {
      b.appendChild(el('h3', null, 'Zahlungsmodell'));
      b.appendChild(para(p.model_label || p.model || ''));
      if (p.schedule && p.schedule.length) {
        var ul = el('ul', { class: 'offer-schedule' });
        p.schedule.forEach(function (s) {
          ul.appendChild(el('li', null, el('span', { class: 'offer-sch-label' }, s.label), el('strong', { class: 'offer-sch-amount' }, money(s.amount_cents)), el('span', { class: 'offer-sch-due' }, s.due_text || '')));
        });
        b.appendChild(el('h3', null, 'Zahlungsplan'));
        b.appendChild(ul);
      }
      if (p.bank) {
        b.appendChild(el('h3', null, 'Bankverbindung'));
        b.appendChild(dl([['Kontoinhaber', p.bank.account_holder], ['IBAN', p.bank.iban], ['BIC', p.bank.bic], ['Bank', p.bank.bank_name]]));
      }
    }
    if (o.start_text) {
      b.appendChild(el('h3', null, 'Leistungsbeginn'));
      b.appendChild(para(o.start_text));
    }
    return b;
  }

  function clausesBlock(v) {
    var c = v.clauses;
    if (!c) return null;
    var parts = [['Zahlung', c.payment], ['Leistungsbeginn bei Vorauszahlung', c.start], ['Gültigkeit des Angebots', c.validity], ['Allgemeine Geschäftsbedingungen', c.agb], ['Annahme', c.acceptance]].filter(function (p) { return p[1]; });
    if (!parts.length) return null;
    var b = block('Vertragsbedingungen', 'offer-clauses-h');
    parts.forEach(function (p) { b.appendChild(el('h3', null, p[0])); b.appendChild(para(p[1], 'offer-clause')); });
    return b;
  }

  function docsBlock(v) {
    var o = v.offer;
    var b = block('Dokumente und AGB', 'offer-docs-h');
    if (o.agb) b.appendChild(para('Es gelten unsere Allgemeinen Geschäftsbedingungen in der Fassung vom ' + (o.agb.stand_label || '') + ' (Version ' + (o.agb.version || '') + ').'));
    var out = el('p', { class: 'offer-dl-status', role: 'status', 'aria-live': 'polite' });
    var row = el('div', { class: 'btn-row' });
    var bAgb = el('button', { type: 'button', class: 'btn btn-secondary' }, 'AGB herunterladen (PDF)');
    bAgb.addEventListener('click', function () { downloadPdf('agb', 'AGB-' + (o.agb ? o.agb.version : '') + '.pdf', out, bAgb); });
    var bOff = el('button', { type: 'button', class: 'btn btn-secondary' }, 'Angebot herunterladen (PDF)');
    bOff.addEventListener('click', function () { downloadPdf('angebot', 'Angebot-' + o.offer_no + '-v' + o.version + '.pdf', out, bOff); });
    row.appendChild(bAgb);
    row.appendChild(bOff);
    b.appendChild(row);
    b.appendChild(out);
    return b;
  }

  function infoBlock(v) {
    var i = v.info_246c;
    if (!i) return null;
    var d = el('details', { class: 'offer-info disclosure', open: true });
    d.appendChild(el('summary', null, i.title || 'Informationen zum Vertragsschluss'));
    var inner = el('div', { class: 'offer-info-body' });
    INFO_ORDER.forEach(function (k) { if (i[k]) inner.appendChild(para(i[k])); });
    d.appendChild(inner);
    return d;
  }

  // ---------- Annahmeformular ----------
  function acceptBlock(v) {
    var o = v.offer;
    var label = v.button_label || FALLBACK_BUTTON;
    var keys = Object.keys(v.declarations || {});
    var wrap = el('div', { class: 'offer-card offer-accept', role: 'group', 'aria-labelledby': 'offer-accept-h' });
    wrap.appendChild(el('h2', { id: 'offer-accept-h' }, 'Angebot annehmen'));
    wrap.appendChild(para('Gültig bis einschließlich ' + deDay(o.valid_until) + '. Mit dem Klick auf „' + label + '“ gehen Sie eine Zahlungspflicht ein.'));
    var info = infoBlock(v);
    if (info) wrap.appendChild(info);
    var form = el('form', { id: 'offer-accept-form', novalidate: true, autocomplete: 'off' });
    var fs = el('fieldset', null, el('legend', null, 'Erklärungen (alle vier sind erforderlich)'));
    var boxes = [];
    keys.forEach(function (k) {
      var cb = el('input', { type: 'checkbox', id: 'offer-decl-' + k, name: 'decl-' + k, required: true });
      boxes.push({ key: k, node: cb });
      fs.appendChild(el('div', { class: 'field' }, el('label', { for: 'offer-decl-' + k, class: 'check-line offer-decl' }, cb, el('span', null, v.declarations[k]))));
    });
    form.appendChild(fs);
    var nameId = 'offer-name';
    var nameIn = el('input', { type: 'text', id: nameId, name: 'acceptor_name', maxlength: '150', autocomplete: 'name', required: true, 'aria-describedby': 'offer-name-hint' });
    form.appendChild(el('div', { class: 'field' }, el('label', { for: nameId }, 'Name der annehmenden Person ', el('span', { class: 'req', 'aria-hidden': 'true' }, '*')), nameIn,
      el('p', { id: 'offer-name-hint', class: 'offer-hint' }, 'Vor- und Nachname der Person, die für den Auftraggeber annimmt.')));
    if (v.info_246c && v.info_246c.eingabefehler) form.appendChild(para(v.info_246c.eingabefehler, 'offer-hint'));
    var err = el('p', { id: 'offer-form-error', class: 'field-error', role: 'alert', tabindex: '-1' });
    var submit = el('button', { type: 'submit', class: 'btn btn-block offer-accept-btn', disabled: true, 'aria-describedby': 'offer-ready-hint' }, label);
    var ready = el('p', { id: 'offer-ready-hint', class: 'offer-hint' }, 'Die Schaltfläche wird aktiv, sobald alle vier Erklärungen bestätigt und ein Name eingetragen ist.');
    form.appendChild(err);
    form.appendChild(submit);
    form.appendChild(ready);
    wrap.appendChild(form);

    function complete() { return boxes.every(function (b) { return b.node.checked; }) && nameIn.value.trim().length >= 2; }
    function sync() {
      var ok = complete();
      if (!busy) submit.disabled = !ok;
      ready.hidden = ok;
    }
    boxes.forEach(function (b) { b.node.addEventListener('change', sync); });
    nameIn.addEventListener('input', sync);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (busy || !complete()) return;
      busy = true;
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      submit.textContent = 'Wird gesendet …';
      err.textContent = '';
      var decl = {};
      keys.forEach(function (k) { decl[k] = true; });
      req('POST', '/api/offer/accept', { declarations: decl, acceptor_name: nameIn.value.trim(), offer_version: o.version }).then(function (r) {
        var d = r.data || {};
        if (r.status === 200 && d.ok) {
          fresh = d;
          view.accepted = d.contract;
          view.can_accept = false;
          view.offer.status = 'angenommen';
          view.documents = { angebot: true, agb: true, vertrag: !!(d.documents && d.documents.vertrag) };
          busy = false;
          render(true);
          return;
        }
        if (r.status === 409 && d.code === 'already_accepted') {
          view.accepted = d.contract || { contract_no: o.contract_no, offer_no: o.offer_no, accepted_at: '', accepted_at_local: '', method: 'online' };
          view.can_accept = false;
          view.offer.status = 'angenommen';
          view.documents = { angebot: true, agb: true, vertrag: true };
          busy = false;
          render(true);
          return;
        }
        if (r.status === 409 && d.code === 'offer_version_mismatch') {
          fail('Diese Seite zeigt eine veraltete Fassung des Angebots. Bitte laden Sie das Angebot neu und prüfen Sie es erneut.', true);
          return;
        }
        if (r.status === 409 && /^offer_(expired|withdrawn|replaced|declined)$/.test(d.code || '')) { busy = false; load(true); return; }
        if (r.status === 404) { busy = false; showInvalid(); return; }
        if (r.status === 429) { fail('Zu viele Anfragen. Bitte versuchen Sie es in einigen Minuten erneut.'); return; }
        if (r.status === 400 || r.status === 409) { fail(d.error || 'Die Annahme konnte nicht verarbeitet werden.'); return; }
        fail('Die Annahme konnte nicht verarbeitet werden. Es wurde nichts angenommen. Bitte versuchen Sie es erneut.');
      }, function () {
        fail('Netzwerkfehler: Die Annahme konnte nicht übermittelt werden. Es wurde nichts angenommen. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.');
      });
      function fail(msg, reload) {
        busy = false;
        submit.removeAttribute('aria-busy');
        submit.textContent = label;
        sync();
        clear(err);
        err.appendChild(document.createTextNode(msg));
        if (reload) {
          err.appendChild(document.createTextNode(' '));
          var rb = el('button', { type: 'button', class: 'btn btn-secondary btn-small' }, 'Angebot neu laden');
          rb.addEventListener('click', function () { load(true); });
          err.appendChild(rb);
        }
        err.focus();
      }
    });

    // Ablehnen (sekundär, mit eigenem Inline-Dialog statt window.confirm)
    var decline = el('div', { class: 'offer-decline' });
    var openBtn = el('button', { type: 'button', class: 'btn btn-secondary btn-small', 'aria-expanded': 'false', 'aria-controls': 'offer-decline-box' }, 'Angebot ablehnen');
    var box = el('div', { id: 'offer-decline-box', class: 'offer-confirm', role: 'group', 'aria-labelledby': 'offer-decline-h', hidden: true });
    var dh = el('h3', { id: 'offer-decline-h', tabindex: '-1' }, 'Angebot wirklich ablehnen?');
    var reason = el('textarea', { id: 'offer-decline-reason', maxlength: '500', rows: '3' });
    var dErr = el('p', { class: 'field-error', role: 'alert' });
    var send = el('button', { type: 'button', class: 'btn btn-small' }, 'Ablehnung senden');
    var cancel = el('button', { type: 'button', class: 'btn btn-secondary btn-small' }, 'Abbrechen');
    box.appendChild(dh);
    box.appendChild(para('Das Angebot kann danach nicht mehr angenommen werden. Es entsteht kein Vertrag und es fallen keine Kosten an.'));
    box.appendChild(el('div', { class: 'field' }, el('label', { for: 'offer-decline-reason' }, 'Grund (optional, höchstens 500 Zeichen)'), reason));
    box.appendChild(dErr);
    box.appendChild(el('div', { class: 'btn-row' }, send, cancel));
    function closeDecline() { box.hidden = true; openBtn.setAttribute('aria-expanded', 'false'); openBtn.focus(); }
    openBtn.addEventListener('click', function () { box.hidden = false; openBtn.setAttribute('aria-expanded', 'true'); dErr.textContent = ''; dh.focus(); });
    cancel.addEventListener('click', closeDecline);
    box.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.stopPropagation(); closeDecline(); } });
    send.addEventListener('click', function () {
      if (busy) return;
      busy = true; send.disabled = true; cancel.disabled = true; dErr.textContent = '';
      var body = {};
      if (reason.value.trim()) body.reason = reason.value.trim();
      function dfail(msg) { busy = false; send.disabled = false; cancel.disabled = false; dErr.textContent = msg; }
      req('POST', '/api/offer/decline', body).then(function (r) {
        var d = r.data || {};
        if (r.status === 200 && d.ok) { busy = false; view.offer.status = 'abgelehnt'; view.can_accept = false; render(true); return; }
        if (r.status === 409 && d.code === 'already_accepted') { busy = false; load(true); return; }
        if (r.status === 409) { busy = false; load(true); return; }
        if (r.status === 404) { busy = false; showInvalid(); return; }
        if (r.status === 429) { dfail('Zu viele Anfragen. Bitte versuchen Sie es später erneut.'); return; }
        dfail(d.error || 'Die Ablehnung konnte nicht verarbeitet werden.');
      }, function () { dfail('Netzwerkfehler: Die Ablehnung wurde nicht übermittelt. Bitte versuchen Sie es erneut.'); });
    });
    decline.appendChild(el('p', { class: 'offer-hint' }, 'Das Angebot passt nicht? Sie können es ablehnen; dafür müssen Sie nichts begründen.'));
    decline.appendChild(openBtn);
    decline.appendChild(box);
    wrap.appendChild(decline);
    return wrap;
  }

  // ---------- Seite ----------
  function render(moveFocus) {
    var v = view, o = v.offer;
    clear(root);
    root.hidden = false;
    announce('');
    setHeading('Angebot ' + o.offer_no);
    var frag = document.createDocumentFragment();

    var meta = el('div', { class: 'offer-card offer-meta', role: 'group', 'aria-labelledby': 'offer-meta-h' });
    meta.appendChild(el('h2', { id: 'offer-meta-h' }, 'Angebotsdaten'));
    meta.appendChild(dl([
      ['Angebotsnummer', o.offer_no],
      ['Vertragsnummer (nach Annahme)', o.contract_no],
      ['Version', o.version],
      ['Versendet am', deStamp(o.sent_at)],
      ['Gültig bis einschließlich', deDay(o.valid_until)],
      ['Status', v.accepted ? STATUS_LABELS.angenommen : (o.status === 'versendet' && o.expired ? STATUS_LABELS.abgelaufen : (STATUS_LABELS[o.status] || o.status))]
    ]));
    frag.appendChild(meta);

    var banner = statusBanner(v);
    var bannerNode = null;
    if (banner) {
      bannerNode = el('div', { class: 'notice ' + banner[0], role: 'note', tabindex: '-1', id: 'offer-state' }, el('p', null, el('strong', null, banner[1])), para(banner[2]));
      frag.appendChild(bannerNode);
    }
    var accNode = null;
    if (v.accepted) { accNode = acceptedBlock(v); frag.appendChild(accNode); }

    var parties = el('div', { class: 'offer-card offer-parties', role: 'group', 'aria-labelledby': 'offer-parties-h' }, el('h2', { id: 'offer-parties-h' }, 'Vertragsparteien'));
    var grid = el('div', { class: 'offer-party-grid' }, party('Auftragnehmer', o.seller), party('Auftraggeber', o.buyer));
    parties.appendChild(grid);
    frag.appendChild(parties);
    frag.appendChild(scopeBlock(o));
    frag.appendChild(priceBlock(o));
    frag.appendChild(docsBlock(v));
    var cl = clausesBlock(v);
    if (cl) frag.appendChild(cl);

    var showForm = !v.accepted && o.status === 'versendet' && v.can_accept && !o.expired;
    if (showForm) frag.appendChild(acceptBlock(v));
    else if (!v.accepted) { var inf = infoBlock(v); if (inf) { var ib = block('Informationen zum Vertragsschluss', 'offer-info-h'); ib.appendChild(inf); frag.appendChild(ib); } }
    root.appendChild(frag);
    if (!v.accepted && !banner) { /* offenes Angebot */ }
    if (moveFocus) {
      var target = accNode ? accNode.querySelector('h2') : bannerNode || h1;
      if (target) target.focus();
      if (target && target.scrollIntoView) target.scrollIntoView({ block: 'start' });
    }
  }

  function load(moveFocus) {
    busy = false;
    if (!token) { showInvalid(); return; }
    announce('Angebot wird geladen …');
    req('GET', '/api/offer').then(function (r) {
      if (r.status === 200 && r.data && r.data.offer) { view = r.data; render(!!moveFocus); return; }
      if (r.status === 404 || r.status === 401 || r.status === 403) { showInvalid(); return; }
      if (r.status === 429) { showFailure('Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es dann erneut.', true); return; }
      showFailure('Das Angebot konnte gerade nicht geladen werden. Bitte versuchen Sie es erneut.', true);
    }, function () { showFailure('Netzwerkfehler: Das Angebot konnte nicht geladen werden. Bitte prüfen Sie Ihre Verbindung.', true); });
  }

  token = takeToken();
  load(false);
})();
