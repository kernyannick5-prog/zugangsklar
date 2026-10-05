/* Yanqiva – zentrale Konfiguration und kleine Helfer. Keine Abhängigkeiten. */
(function () {
  'use strict';

  // Basis-URL der API (Cloudflare Worker). PLATZHALTER: nach dem Deployment durch die echte Worker-URL ersetzen.
  var API_BASE = 'https://yanqiva-api.yanqiva-api.workers.dev';

  // Zahlungslinks (z. B. Stripe Payment Links). Leer = Rechnungs-Fallback ("Wir melden uns innerhalb von 24 Stunden").
  var PAYMENT_LINKS = {
    report: '', monitoring: '', business: '', agentur: '', agentur_plus: '',
    'website-business': '', 'website-premium': '', 'website-pflege': '',
    'fix-google-fonts': '', 'fix-erklaerung': '', 'fix-security-header': '', 'fix-a11y': '', 'fix-individuell': ''
  };

  // Bewusst kein Analytics-Skript (DSGVO, Geschwindigkeit). Zählung erfolgt über API-Zähler.
  // Falls später nötig: Konfiguration hier eintragen. Aktuell: null.
  var ANALYTICS = null;

  // ?mock=1 lädt mock/*.json statt die API aufzurufen (Demo/Tests ohne Backend).
  var params = new URLSearchParams(window.location.search);
  var MOCK = params.get('mock') === '1';
  var scriptSrc = document.currentScript && document.currentScript.src;
  function mockUrl(name) { return scriptSrc ? new URL('../mock/' + name, scriptSrc).href : 'mock/' + name; }
  var MOCK_URL = mockUrl('check-example.json');

  /** DOM-Helfer: el('div', {class:'x'}, 'text', childNode). Text wird immer als textContent gesetzt. */
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] === false || attrs[k] == null) return;
        if (k === 'class') node.className = attrs[k];
        else node.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return node;
  }

  /**
   * POST JSON an die API. Wirft {kind:'network'} bei Netzwerkfehlern und {kind:'api', message} bei {"error":"..."}.
   * Im Mock-Modus wird nichts gesendet.
   */
  // E-Mail aus dem Impressum: Ausweg, wenn die API nicht erreichbar ist (Anfragen sollen nicht verloren gehen).
  var CONTACT_EMAIL = 'support@yanqiva.de';
  /** Schreibt eine Fehlermeldung plus mailto-Link (vorausgefüllt) in el – nur Textknoten, kein HTML. */
  function mailFallback(target, text, subject, body) {
    target.textContent = '';
    target.appendChild(document.createTextNode(text + ' '));
    var a = document.createElement('a');
    a.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent(subject || 'Anfrage über yanqiva') + (body ? '&body=' + encodeURIComponent(String(body).slice(0, 1800)) : '');
    a.textContent = 'E-Mail an ' + CONTACT_EMAIL;
    target.appendChild(a);
    target.appendChild(document.createTextNode('.'));
  }
  function postJson(path, payload, opts) {
    if (MOCK) {
      return new Promise(function (resolve) { setTimeout(function () { resolve({ ok: true, mock: true }); }, 500); });
    }
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, (opts && opts.timeout) || 60000) : null;
    return fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok || (data && data.error)) {
          var e = new Error((data && data.error) || 'Die Anfrage konnte nicht verarbeitet werden (Status ' + res.status + ').');
          e.kind = (data && data.error) ? 'api' : (res.status >= 500 ? 'network' : 'api');
          throw e;
        }
        return data;
      });
    }, function () {
      var e = new Error('Netzwerkfehler'); e.kind = 'network'; throw e;
    }).then(function (d) { if (timer) clearTimeout(timer); return d; }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  /** GET JSON von der API. Fehler: kind 'auth' (401/403/404), 'api' (sonstiger Status), 'network'. */
  function getJson(path, extraHeaders) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 30000) : null;
    var headers = { 'Accept': 'application/json' };
    if (extraHeaders) Object.keys(extraHeaders).forEach(function (k) { headers[k] = extraHeaders[k]; });
    return fetch(API_BASE + path, { headers: headers, signal: controller ? controller.signal : undefined }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) {
          var e = new Error((data && data.error) || 'Status ' + res.status);
          e.kind = (res.status === 401 || res.status === 403 || res.status === 404) ? 'auth' : (res.status >= 500 ? 'network' : 'api');
          throw e;
        }
        return data;
      });
    }, function () {
      var e = new Error('Netzwerkfehler'); e.kind = 'network'; throw e;
    }).then(function (d) { if (timer) clearTimeout(timer); return d; }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  // Newsletter-Anmeldung: false = Formular und Footer-Link bleiben verborgen (Funktion im Worker ist erst nach Aktivierung verfügbar, siehe worker/README.md).
  // Vor Tätigkeitsbeginn: Starthinweis (notice.js) und Hinweis beim Bestellen (order.js).
  // Ab START_DATE schalten sich beide automatisch ab; PRESTART = false schaltet sie sofort ab.
  // Der kostenlose Website-Check ist davon nicht betroffen.
  var START_DATE = '2026-10-15';
  var PRESTART = true;
  function prestartActive() { return PRESTART && new Date() < new Date(START_DATE + 'T00:00:00'); }
  var NEWSLETTER = false;
  var NEWSLETTER_CONSENT_VERSION = '2026-10-05'; // muss zum Einwilligungstext in ratgeber/index.html passen (Worker: CONSENT_VERSIONS)

  // Spamschutz ohne Drittanbieter: Honeypot (name="homepage", für Menschen unsichtbar) + Startzeit des Formulars.
  var PAGE_START = Date.now();
  /** { hp, ts } für den Request-Body: hp = Wert des Honeypot-Feldes (bei Menschen leer), ts = Startzeit des Formulars (ms). */
  function guard(form) {
    var f = form && form.querySelector ? form.querySelector('input[name="homepage"]') : null;
    return { hp: f ? f.value : '', ts: (form && form._yqTs) || PAGE_START };
  }
  /** Honeypot-Feld als DOM (für dynamisch erzeugte Formulare). */
  function hpField(id) {
    var w = el('div', { class: 'hp-field', 'aria-hidden': 'true' });
    w.appendChild(el('label', { for: id }, 'Bitte leer lassen'));
    w.appendChild(el('input', { type: 'text', id: id, name: 'homepage', tabindex: '-1', autocomplete: 'off' }));
    return w;
  }
  // Footer-Link "Newsletter" (im HTML mit hidden) nur zeigen, wenn die Anmeldung aktiv ist.
  if (NEWSLETTER) Array.prototype.forEach.call(document.querySelectorAll('[data-newsletter-link]'), function (a) { a.hidden = false; });

  window.YQ = { START_DATE: START_DATE, prestartActive: prestartActive, NEWSLETTER: NEWSLETTER, NEWSLETTER_CONSENT_VERSION: NEWSLETTER_CONSENT_VERSION, guard: guard, hpField: hpField, API_BASE: API_BASE, PAYMENT_LINKS: PAYMENT_LINKS, ANALYTICS: ANALYTICS, MOCK: MOCK, MOCK_URL: MOCK_URL, mockUrl: mockUrl, el: el, postJson: postJson, getJson: getJson, CONTACT_EMAIL: CONTACT_EMAIL, mailFallback: mailFallback };
})();
