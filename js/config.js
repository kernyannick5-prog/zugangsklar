/* Yanqiva – zentrale Konfiguration und kleine Helfer. Keine Abhängigkeiten. */
(function () {
  'use strict';

  // Basis-URL der API (Cloudflare Worker). PLATZHALTER: nach dem Deployment durch die echte Worker-URL ersetzen.
  var API_BASE = 'https://yanqiva-api.yanqiva-api.workers.dev';

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
  // Rechenaufgabe (Proof of Work, selbst gehostet, keine Cookies, nichts wird gespeichert): Der Server (GET /api/challenge) stellt eine signierte
  // Aufgabe, der Browser sucht eine nonce mit SHA-256(salt + nonce) mit `difficulty` führenden Nullbits. Gerechnet wird mit einer kleinen eigenen
  // SHA-256-Implementierung (eine Block-Kompression je Versuch, ca. 20-mal schneller als crypto.subtle.digest je Aufruf) in Zeitscheiben von ca. 8 ms;
  // dazwischen gibt der Browser die Kontrolle ab, die Seite bleibt bedienbar. Kein Web Worker, kein crypto.subtle nötig.
  // Start beim ersten Fokus/Tippen im Formular, damit beim Absenden nichts wartet. Bei Fehlern wird normal gesendet (ohne pow, dann "ungeprüft").
  var POW_MAX_WAIT = 25000; // so lange wartet das Absenden höchstens auf die Lösung
  var POW_MAX_AGE = 8 * 60 * 1000; // lokal ältere Lösungen werden verworfen (der Server akzeptiert 10 min ab Ausgabe)
  var POW_SLICE_MS = 8;
  var SHA_K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function powSupported() {
    return !MOCK && typeof Promise !== 'undefined' && typeof Uint32Array !== 'undefined' && typeof Math.imul === 'function' && typeof fetch === 'function';
  }
  /**
   * Erstes 32-Bit-Wort von SHA-256(salt + String(counter)). salt = 32 ASCII-Zeichen (hex), die Nachricht passt immer in einen 64-Byte-Block.
   * Für difficulty <= 32 genügt dieses Wort für die Prüfung der führenden Nullbits.
   */
  function powHash0(w, k, saltWords, counter) {
    var digits = [], n = counter, i, len;
    do { digits.push(48 + (n % 10)); n = (n - (n % 10)) / 10; } while (n > 0);
    len = 32 + digits.length;
    for (i = 0; i < 8; i++) w[i] = saltWords[i];
    for (i = 8; i < 15; i++) w[i] = 0;
    for (i = 0; i < digits.length; i++) { var pos = 32 + i, shift = 24 - 8 * (pos & 3); w[pos >> 2] |= digits[digits.length - 1 - i] << shift; }
    w[len >> 2] |= 0x80 << (24 - 8 * (len & 3));
    w[15] = len * 8;
    for (i = 16; i < 64; i++) {
      var x = w[i - 15], y = w[i - 2];
      w[i] = (w[i - 16] + ((x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ (x >>> 3)) + w[i - 7] + ((y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ (y >>> 10))) | 0;
    }
    var a = 0x6a09e667, b = 0xbb67ae85, c = 0x3c6ef372, d = 0xa54ff53a, e = 0x510e527f, f = 0x9b05688c, g = 0x1f83d9ab, h = 0x5be0cd19;
    for (i = 0; i < 64; i++) {
      var t1 = (h + ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) + ((e & f) ^ (~e & g)) + k[i] + w[i]) | 0;
      var t2 = (((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    return (0x6a09e667 + a) | 0;
  }
  function yieldToBrowser() {
    return new Promise(function (resolve) {
      if (typeof MessageChannel === 'function') { var ch = new MessageChannel(); ch.port1.onmessage = function () { ch.port1.close(); resolve(); }; ch.port2.postMessage(0); }
      else setTimeout(resolve, 0);
    });
  }
  /** Sucht die nonce (als String). Löst nie synchron; wirft bei Zeitüberschreitung (30 s). */
  function powSolve(ch) {
    var bits = ch.difficulty, salt = String(ch.salt), counter = 0, deadline = Date.now() + 30000;
    var w = new Int32Array(64), k = new Int32Array(SHA_K), saltWords = new Int32Array(8), i;
    for (i = 0; i < 32; i++) saltWords[i >> 2] |= salt.charCodeAt(i) << (24 - 8 * (i & 3));
    function slice() {
      var start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      for (;;) {
        for (var j = 0; j < 128; j++, counter++) {
          if ((powHash0(w, k, saltWords, counter) >>> (32 - bits)) === 0) return String(counter);
        }
        var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (now - start > POW_SLICE_MS) break;
      }
      if (Date.now() > deadline) throw new Error('pow timeout');
      return yieldToBrowser().then(slice);
    }
    return yieldToBrowser().then(slice);
  }
  function powStart(form) {
    var job = { at: Date.now(), ms: null, promise: null };
    job.promise = Promise.race([
      getJson('/api/challenge'),
      new Promise(function (_, reject) { setTimeout(function () { reject(new Error('challenge timeout')); }, 10000); })
    ]).then(function (ch) {
      if (!ch || ch.algorithm !== 'SHA-256' || typeof ch.salt !== 'string' || !/^[0-9a-f]{32}$/.test(ch.salt) || !(ch.difficulty >= 1 && ch.difficulty <= 24)) throw new Error('bad challenge');
      var t0 = Date.now();
      return powSolve(ch).then(function (nonce) {
        job.ms = Date.now() - t0;
        return { salt: ch.salt, difficulty: ch.difficulty, expires: ch.expires, sig: ch.sig, nonce: nonce };
      });
    }).catch(function () { return null; }); // nie ein Fehler für das Formular
    form._yqPow = job;
    return job;
  }
  /** Lösung vorab berechnen, sobald der Nutzer das Formular benutzt (einmalig). */
  function powWatch(form) {
    if (!form || !powSupported() || form._yqPowWatch) return;
    form._yqPowWatch = true;
    var go = function () { if (!form._yqPow) powStart(form); };
    form.addEventListener('focusin', go);
    form.addEventListener('input', go);
  }
  /** Ergänzt den Request-Body um `pow` (wartet ggf. auf die Lösung). Löst immer auf, auch ohne Unterstützung/bei Fehlern (dann ohne pow). */
  function withPow(form, body) {
    if (!form || !powSupported()) return Promise.resolve(body);
    var job = form._yqPow;
    if (!job || Date.now() - job.at > POW_MAX_AGE) job = powStart(form);
    form._yqPow = null; // jede Lösung gilt nur einmal; der nächste Versuch holt eine neue Aufgabe
    return Promise.race([job.promise, new Promise(function (resolve) { setTimeout(function () { resolve(null); }, POW_MAX_WAIT); })]).then(function (pow) {
      if (pow) body.pow = pow;
      return body;
    });
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

  window.YQ = { START_DATE: START_DATE, prestartActive: prestartActive, NEWSLETTER: NEWSLETTER, NEWSLETTER_CONSENT_VERSION: NEWSLETTER_CONSENT_VERSION, guard: guard, pow: { watch: powWatch, withPow: withPow, solve: powSolve, supported: powSupported }, hpField: hpField, API_BASE: API_BASE, PAYMENT_LINKS: PAYMENT_LINKS, ANALYTICS: ANALYTICS, MOCK: MOCK, MOCK_URL: MOCK_URL, mockUrl: mockUrl, el: el, postJson: postJson, getJson: getJson, CONTACT_EMAIL: CONTACT_EMAIL, mailFallback: mailFallback };
})();
