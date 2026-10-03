/* Yanqiva – Chat-Widget "Fragen zu Yanqiva".
 * Abhängig von config.js (window.YQ). Lädt keine externen Ressourcen, sendet erst bei aktiver Absendung.
 * Panel-DOM wird erst beim ersten Öffnen erzeugt. Antworten werden ausschließlich als Text gerendert. */
(function () {
  'use strict';
  var YQ = window.YQ;
  var root0 = document.documentElement;
  if (!YQ || root0.hasAttribute('data-no-chat') || document.getElementById('yq-chat-toggle')) return;

  var MAX_LEN = 1000;
  var MAX_SEND = 10;
  var MAX_STORE = 20;
  var STORE_KEY = 'yq-chat-v1';
  var TIMEOUT_MS = 30000;
  var OWN_HOSTS = ['yanqiva.de', 'www.yanqiva.de'];
  var SUGGESTIONS = ['Was kostet eine Website?', 'Was kostet eine Premium-Website?', 'Wie läuft die Zusammenarbeit ab?', 'Wie kann ich Yanqiva kontaktieren?'];
  var GREETING = 'Hallo! Ich beantworte Fragen zu Yanqiva, unseren Websites und Leistungen. Wählen Sie einen Vorschlag oder stellen Sie Ihre Frage.';
  var ERR_RATE = 'Sie haben gerade viele Fragen gestellt. Bitte versuchen Sie es später erneut.';
  var ERR_DOWN = 'Der Chat ist gerade nicht erreichbar. Nutzen Sie gern das Kontaktformular.';
  var ERR_BAD = 'Ihre Frage konnte nicht verarbeitet werden. Bitte kürzen oder ändern Sie sie und versuchen Sie es erneut.';

  var scriptSrc = document.currentScript && document.currentScript.src;
  var siteRoot = scriptSrc ? new URL('../', scriptSrc) : new URL('./', window.location.href);
  function siteUrl(p) { return new URL(p, siteRoot).href; }

  var el = YQ.el;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function icon(pathD) {
    var s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    var p = document.createElementNS(SVG_NS, 'path'); p.setAttribute('d', pathD); s.appendChild(p);
    return s;
  }
  var ICON_CHAT = 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z';
  var ICON_CLOSE = 'M6 6l12 12M18 6L6 18';

  var history = [];     // {role, content} – nur erfolgreich gesendete/erhaltene Einträge
  var view = [];        // zum Speichern: {r, c, s, m}
  var built = false, open = false, busy = false;
  var panel, toggle, scrollBox, log, chips, input, send, counter, statusEl, clearBtn, rootEl;
  var mq = window.matchMedia ? window.matchMedia('(max-width: 599px)') : null;

  function isMobile() { return !!(mq && mq.matches); }

  /* ---------- Speicher (nur sessionStorage, optional) ---------- */
  function loadStore() {
    try {
      var d = JSON.parse(window.sessionStorage.getItem(STORE_KEY) || 'null');
      if (d && d.v === 1 && Array.isArray(d.m)) return d.m.slice(-MAX_STORE);
    } catch (e) { /* Storage nicht verfügbar */ }
    return [];
  }
  function saveStore() {
    try {
      if (!view.length) window.sessionStorage.removeItem(STORE_KEY);
      else window.sessionStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, m: view.slice(-MAX_STORE) }));
    } catch (e) { /* ignorieren */ }
  }

  /* ---------- Quellen-Whitelist ---------- */
  function safeSourceHref(raw) {
    if (typeof raw !== 'string') return null;
    var u = raw.trim();
    if (!u || u.length > 300 || /[\u0000-\u001f\\]/.test(u)) return null;
    if (/^\/\//.test(u)) return null;
    var hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(u);
    try {
      if (!hasScheme) return new URL(u, siteRoot).href;
      var p = new URL(u);
      if (p.protocol !== 'https:' && p.protocol !== 'http:') return null;
      if (p.host === window.location.host || OWN_HOSTS.indexOf(p.hostname) !== -1) return p.href;
    } catch (e) { /* ungültig */ }
    return null;
  }

  /* ---------- Rendering ---------- */
  function renderMsg(role, text, opts) {
    opts = opts || {};
    var isBot = role === 'assistant';
    var box = el('div', { class: 'yq-chat-msg ' + (isBot ? 'is-bot' : 'is-user') + (opts.error ? ' is-error' : '') });
    if (isBot) box.appendChild(el('span', { class: 'visually-hidden' }, 'Antwort: '));
    else box.appendChild(el('span', { class: 'visually-hidden' }, 'Sie: '));
    box.appendChild(el('span', { class: 'yq-chat-text' }, text));   // textContent, Zeilenumbrüche via white-space: pre-wrap
    if (opts.errorLink) {
      box.appendChild(document.createElement('br'));
      box.appendChild(el('a', { href: siteUrl('kontakt.html') }, 'Zum Kontaktformular'));
    }
    if (isBot && (opts.mode === 'ai' || (opts.sources && opts.sources.length))) {
      var meta = el('div', { class: 'yq-chat-meta' });
      if (opts.mode === 'ai') meta.appendChild(el('span', { class: 'yq-chat-badge' }, 'KI-generiert'));
      var links = [];
      (opts.sources || []).slice(0, 5).forEach(function (s) {
        var href = s && safeSourceHref(s.url);
        if (!href) return;
        var title = (typeof s.title === 'string' && s.title.trim()) ? s.title.trim().slice(0, 120) : href;
        links.push(el('li', null, el('a', { href: href }, title)));
      });
      if (links.length) {
        var ul = el('ul', { class: 'yq-chat-sources', 'aria-label': 'Quellen' });
        links.forEach(function (li) { ul.appendChild(li); });
        meta.appendChild(ul);
      }
      if (meta.childNodes.length) box.appendChild(meta);
    }
    log.appendChild(box);
    return box;
  }

  function scrollToMsg(box, toTop) {
    scrollBox.scrollTop = toTop && box ? Math.max(0, box.offsetTop - log.offsetTop - 4 + log.offsetTop) : scrollBox.scrollHeight;
  }

  function removeChips() { if (chips && chips.parentNode) chips.parentNode.removeChild(chips); chips = null; }

  function setBusy(b) {
    busy = b;
    send.disabled = b;
    send.setAttribute('aria-disabled', b ? 'true' : 'false');
    log.setAttribute('aria-busy', b ? 'true' : 'false');
    statusEl.textContent = b ? 'Antwort wird erstellt …' : '';
  }

  function updateCounter() {
    counter.textContent = input.value.length + ' / ' + MAX_LEN + ' Zeichen';
  }

  /* ---------- Senden ---------- */
  function chatRequest(messages) {
    if (YQ.MOCK) {
      return fetch(YQ.mockUrl('chat-example.json')).then(function (r) { return r.json(); }).then(function (d) {
        var q = (messages[messages.length - 1].content || '').toLowerCase();
        var hit = d.default;
        for (var i = 0; i < d.entries.length; i++) {
          if (d.entries[i].keywords.some(function (k) { return q.indexOf(k) !== -1; })) { hit = d.entries[i]; break; }
        }
        return new Promise(function (res) { setTimeout(function () { res(hit); }, 600); });
      });
    }
    // Eigener fetch statt YQ.postJson: postJson verwirft den HTTP-Status, hier wird 429 von 503 unterschieden.
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    function done() { if (timer) clearTimeout(timer); }
    return fetch(YQ.API_BASE + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages }),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        done();
        if (!res.ok || !data || typeof data.reply !== 'string') {
          var e = new Error('HTTP ' + res.status);
          e.status = res.status;
          throw e;
        }
        return data;
      });
    }, function () { done(); var e = new Error('network'); e.status = 0; throw e; });
  }

  function submit(text) {
    text = (text || '').replace(/^\s+|\s+$/g, '');
    if (busy || !text) return;
    if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);
    removeChips();
    var userBox = renderMsg('user', text);
    history.push({ role: 'user', content: text });
    input.value = ''; updateCounter();
    setBusy(true);
    scrollToMsg(userBox, false);
    var payload = history.slice(-MAX_SEND).map(function (m) { return { role: m.role, content: String(m.content).slice(0, MAX_LEN) }; });
    chatRequest(payload).then(function (data) {
      var sources = Array.isArray(data.sources) ? data.sources : [];
      var mode = data.mode === 'ai' ? 'ai' : 'faq';
      history.push({ role: 'assistant', content: data.reply });
      view.push({ r: 'u', c: text }, { r: 'a', c: data.reply, s: sources.slice(0, 5), m: mode });
      saveStore();
      setBusy(false);
      var b = renderMsg('assistant', data.reply, { mode: mode, sources: sources });
      scrollToMsg(b, true);
    }, function (e) {
      history.pop();                       // fehlgeschlagene Frage nicht in den Verlauf übernehmen
      var rate = e.status === 429, bad = e.status === 400 || e.status === 415;
      setBusy(false);
      var b = renderMsg('assistant', rate ? ERR_RATE : (bad ? ERR_BAD : ERR_DOWN), { error: true, errorLink: !rate && !bad });
      input.value = text; updateCounter();  // Eingabe zum erneuten Versuch wiederherstellen
      scrollToMsg(b, true);
    });
  }

  /* ---------- Panel ---------- */
  function build() {
    built = true;
    var title = el('h2', { class: 'yq-chat-title', id: 'yq-chat-title' }, 'Fragen zu Yanqiva');
    var closeBtn = el('button', { type: 'button', 'aria-label': 'Chat schließen' });
    closeBtn.appendChild(icon(ICON_CLOSE));
    closeBtn.addEventListener('click', function () { setOpen(false); });

    scrollBox = el('div', { class: 'yq-chat-scroll' });
    var notice = el('p', { class: 'yq-chat-notice', id: 'yq-chat-notice' },
      'Automatische Antworten auf Basis der Website-Inhalte, ohne Gewähr; keine Rechtsberatung, keine verbindlichen Angebote. Bitte geben Sie keine personenbezogenen Daten ein. Ihre Fragen werden zur Beantwortung an unseren KI-Dienstleister übermittelt und nicht gespeichert. Mehr in der ',
      el('a', { href: siteUrl('datenschutz.html#chatbot') }, 'Datenschutzerklärung'), '.');
    log = el('div', { class: 'yq-chat-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Chatverlauf' });
    scrollBox.appendChild(notice);
    scrollBox.appendChild(log);

    statusEl = el('div', { class: 'yq-chat-status', role: 'status' });

    input = el('textarea', { class: 'yq-chat-input', id: 'yq-chat-input', rows: '2', maxlength: String(MAX_LEN), 'aria-describedby': 'yq-chat-counter', autocomplete: 'off', enterkeyhint: 'send' });
    send = el('button', { type: 'submit', class: 'yq-chat-send' }, 'Senden');
    counter = el('span', { id: 'yq-chat-counter' });
    clearBtn = el('button', { type: 'button', class: 'yq-chat-clear' }, 'Verlauf löschen');
    var form = el('form', { class: 'yq-chat-form', novalidate: true },
      el('label', { class: 'yq-chat-label', for: 'yq-chat-input' }, 'Ihre Frage'),
      el('div', { class: 'yq-chat-row' }, input, send),
      el('div', { class: 'yq-chat-foot' }, counter, clearBtn));

    panel = el('div', { class: 'yq-chat-panel', id: 'yq-chat-panel', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'yq-chat-title', hidden: true },
      el('div', { class: 'yq-chat-head' }, title, closeBtn), scrollBox, statusEl, form);
    rootEl.appendChild(panel);

    // Begrüßung und gespeicherter Verlauf
    renderMsg('assistant', GREETING);
    var saved = loadStore();
    saved.forEach(function (m) {
      if (!m || typeof m.c !== 'string') return;
      var role = m.r === 'a' ? 'assistant' : 'user';
      var content = m.c.slice(0, MAX_LEN * 4);
      history.push({ role: role, content: content });
      view.push(m.r === 'a' ? { r: 'a', c: content, s: Array.isArray(m.s) ? m.s : [], m: m.m } : { r: 'u', c: content });
      renderMsg(role, content, role === 'assistant' ? { mode: m.m === 'ai' ? 'ai' : 'faq', sources: Array.isArray(m.s) ? m.s : [] } : null);
    });
    if (!saved.length) {
      chips = el('div', { class: 'yq-chat-chips', role: 'group', 'aria-label': 'Vorschläge' });
      SUGGESTIONS.forEach(function (s) {
        var c = el('button', { type: 'button', class: 'yq-chat-chip' }, s);
        c.addEventListener('click', function () { submit(s); });
        chips.appendChild(c);
      });
      scrollBox.appendChild(chips);
    }
    updateCounter();

    form.addEventListener('submit', function (ev) { ev.preventDefault(); submit(input.value); input.focus(); });
    input.addEventListener('input', updateCounter);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); submit(input.value); }
    });
    clearBtn.addEventListener('click', function () {
      history = []; view = []; saveStore();
      while (log.firstChild) log.removeChild(log.firstChild);
      renderMsg('assistant', GREETING);
      removeChips();
      statusEl.textContent = 'Verlauf gelöscht.';
      input.focus();
    });
  }

  function focusables() {
    return Array.prototype.filter.call(panel.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled])'), function (n) { return n.offsetParent !== null || n === document.activeElement; });
  }

  function onDocKey(ev) {
    if (!open) return;
    if (ev.key === 'Escape') { ev.preventDefault(); setOpen(false); return; }
    if (ev.key === 'Tab' && isMobile()) {   // modal: Fokus im Dialog halten
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (!panel.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
      else if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  }

  function syncModal() {
    if (!panel) return;
    var m = isMobile();
    panel.setAttribute('aria-modal', m ? 'true' : 'false');
    root0.classList.toggle('yq-chat-lock', open && m);
  }

  function setOpen(o) {
    if (o === open) return;
    if (o && !built) build();
    open = o;
    panel.hidden = !o;
    toggle.hidden = o;
    toggle.setAttribute('aria-expanded', o ? 'true' : 'false');
    syncModal();
    if (o) {
      document.addEventListener('keydown', onDocKey);
      scrollBox.scrollTop = scrollBox.scrollHeight;
      input.focus();
    } else {
      document.removeEventListener('keydown', onDocKey);
      toggle.focus();
    }
  }

  /* ---------- Init (nur Button; Panel erst beim Öffnen) ---------- */
  function init() {
    rootEl = el('div', { class: 'yq-chat-root' });
    toggle = el('button', { type: 'button', class: 'yq-chat-toggle', id: 'yq-chat-toggle', 'aria-expanded': 'false', 'aria-controls': 'yq-chat-panel', 'aria-haspopup': 'dialog' });
    toggle.appendChild(icon(ICON_CHAT));
    toggle.appendChild(el('span', null, 'Fragen?'));
    toggle.appendChild(el('span', { class: 'visually-hidden' }, ' Chat zu Yanqiva öffnen'));
    toggle.addEventListener('click', function () { setOpen(!open); });
    rootEl.appendChild(toggle);
    document.body.appendChild(rootEl);
    root0.classList.add('yq-chat-on');
    if (mq) { var h = function () { syncModal(); }; if (mq.addEventListener) mq.addEventListener('change', h); else if (mq.addListener) mq.addListener(h); }
  }

  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
