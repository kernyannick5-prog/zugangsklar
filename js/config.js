/* Yanqiva – zentrale Konfiguration und kleine Helfer. Keine Abhängigkeiten. */
(function () {
  'use strict';

  // Basis-URL der API (Cloudflare Worker). PLATZHALTER: nach dem Deployment durch die echte Worker-URL ersetzen.
  var API_BASE = 'https://yanqiva-api.orchid-game.workers.dev';

  // Zahlungslinks (z. B. Stripe Payment Links). Leer = Rechnungs-Fallback ("Wir melden uns innerhalb von 24 Stunden").
  var PAYMENT_LINKS = {
    report: '', monitoring: '', business: '', agentur: '', agentur_plus: '',
    'website-basic': '', 'website-business': '', 'website-premium': '', 'website-pflege': '',
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
  function postJson(path, payload) {
    if (MOCK) {
      return new Promise(function (resolve) { setTimeout(function () { resolve({ ok: true, mock: true }); }, 500); });
    }
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 60000) : null;
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
  function getJson(path) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 30000) : null;
    return fetch(API_BASE + path, { headers: { 'Accept': 'application/json' }, signal: controller ? controller.signal : undefined }).then(function (res) {
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

  window.YQ = { API_BASE: API_BASE, PAYMENT_LINKS: PAYMENT_LINKS, ANALYTICS: ANALYTICS, MOCK: MOCK, MOCK_URL: MOCK_URL, mockUrl: mockUrl, el: el, postJson: postJson, getJson: getJson };
})();
