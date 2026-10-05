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
  var SUGGESTIONS = ['Was steht in den Verträgen?', 'Wie funktioniert ein Vertragsabschluss?', 'Welche Kündigungsfristen gibt es?', 'Welche Kosten entstehen?', 'Kannst du mir einen Vertrag einfach erklären?'];
  var GREETING = 'Hallo! Ich beantworte Fragen zu Yanqiva: Leistungen, Preise, Bestellablauf und unsere Vertragsbedingungen (AGB). Begriffe erkläre ich allgemein, das ist keine Rechtsberatung. Wählen Sie eine Frage oder schreiben Sie Ihre eigene.';
  var ERR_RATE = 'Sie haben gerade viele Fragen gestellt. Bitte versuchen Sie es später erneut.';
  var ERR_DOWN = 'Der Chat ist gerade nicht erreichbar. Versuchen Sie es erneut oder nutzen Sie das Kontaktformular.';
  var ERR_BAD = 'Ihre Frage konnte nicht verarbeitet werden. Bitte kürzen oder ändern Sie sie und versuchen Sie es erneut.';
  var NEAR_BOTTOM_PX = 48;

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
  var built = false, open = false, busy = false, gen = 0; // gen: wird bei "Verlauf löschen" erhöht, damit späte Antworten verworfen werden
  var panel, toggle, scrollBox, log, chips, input, send, counter, statusEl, clearBtn, rootEl, typing, jumpBtn, pendingBox, statusTimer;
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
    if (opts.errorLink || opts.retry) {
      var actions = el('div', { class: 'yq-chat-actions' });
      if (opts.retry) {
        var rb = el('button', { type: 'button', class: 'yq-chat-action' }, 'Erneut versuchen');
        rb.addEventListener('click', function () { if (!busy) { input.value = ''; updateCounter(); submit(opts.retry); } });
        actions.appendChild(rb);
      }
      if (opts.errorLink) actions.appendChild(el('a', { href: siteUrl('kontakt.html') }, 'Zum Kontaktformular'));
      box.appendChild(actions);
    }
    var linkTexts = [];
    if (isBot && (opts.mode === 'ai' || (opts.sources && opts.sources.length))) {
      var meta = el('div', { class: 'yq-chat-meta' });
      if (opts.mode === 'ai') meta.appendChild(el('span', { class: 'yq-chat-badge' }, 'KI-generiert'));
      var links = [];
      (opts.sources || []).slice(0, 5).forEach(function (s) {
        var href = s && safeSourceHref(s.url);
        if (!href) return;
        var title = (typeof s.title === 'string' && s.title.trim()) ? s.title.trim().slice(0, 120) : href;
        links.push(el('li', null, el('a', { href: href }, title)));
        linkTexts.push(title + ': ' + href);
      });
      if (links.length) {
        var ul = el('ul', { class: 'yq-chat-sources', 'aria-label': 'Quellen' });
        links.forEach(function (li) { ul.appendChild(li); });
        meta.appendChild(ul);
      }
      if (meta.childNodes.length) box.appendChild(meta);
    }
    if (isBot && opts.copy) {
      var copyText = text + (linkTexts.length ? '\n\nQuellen:\n' + linkTexts.join('\n') : '');
      var cb = el('button', { type: 'button', class: 'yq-chat-copy', 'aria-label': 'Antwort kopieren' }, 'Kopieren');
      cb.addEventListener('click', function () { copyToClipboard(copyText, cb); });
      box.appendChild(cb);
    }
    log.appendChild(box);
    return box;
  }

  /* ---------- Kopieren (Clipboard-API mit Fallback) ---------- */
  function announce(msg) {
    if (statusTimer) clearTimeout(statusTimer);
    statusEl.textContent = msg;
    statusTimer = setTimeout(function () { if (!busy) statusEl.textContent = ''; }, 2500);
  }
  function legacyCopy(t) {
    var ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly', ''); ta.setAttribute('aria-hidden', 'true'); ta.tabIndex = -1;
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    var active = document.activeElement, ok = false;
    try { ta.select(); ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    if (active && active.focus) active.focus();
    return ok;
  }
  function copyToClipboard(t, btn) {
    function done(ok) {
      announce(ok ? 'Kopiert.' : 'Kopieren nicht möglich. Bitte markieren Sie den Text und kopieren Sie ihn manuell.');
      if (ok) {
        btn.textContent = 'Kopiert';
        setTimeout(function () { btn.textContent = 'Kopieren'; }, 2000);
      }
    }
    if (navigator.clipboard && window.isSecureContext && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(function () { done(true); }, function () { done(legacyCopy(t)); });
    } else done(legacyCopy(t));
  }

  /* ---------- Scrollen: ans Ende, außer der Nutzer hat hochgescrollt ---------- */
  function nearBottom() { return scrollBox.scrollHeight - scrollBox.scrollTop - scrollBox.clientHeight < NEAR_BOTTOM_PX; }
  function scrollToEnd() { scrollBox.scrollTop = scrollBox.scrollHeight; }
  function revealAnswer(box) {
    // Lange Antworten: Anfang der Antwort zeigen; kurze: ans Ende.
    var top = box.offsetTop - 8;
    scrollBox.scrollTop = box.offsetHeight > scrollBox.clientHeight ? top : scrollBox.scrollHeight;
  }
  function showJump(box) { pendingBox = box; jumpBtn.hidden = false; }
  function hideJump() { pendingBox = null; if (jumpBtn) jumpBtn.hidden = true; }

  function removeChips() { if (chips && chips.parentNode) chips.parentNode.removeChild(chips); chips = null; }
  function showChips() {
    removeChips();
    chips = el('div', { class: 'yq-chat-chips', role: 'group', 'aria-label': 'Vorschläge' });
    SUGGESTIONS.forEach(function (s) {
      var c = el('button', { type: 'button', class: 'yq-chat-chip' }, s);
      c.addEventListener('click', function () { submit(s); });
      chips.appendChild(c);
    });
    scrollBox.insertBefore(chips, typing);
  }

  function setBusy(b) {
    busy = b;
    send.disabled = b;
    send.setAttribute('aria-disabled', b ? 'true' : 'false');
    log.setAttribute('aria-busy', b ? 'true' : 'false');
    typing.hidden = !b;
    if (statusTimer) { clearTimeout(statusTimer); statusTimer = null; }
    statusEl.textContent = b ? 'Antwort wird erstellt …' : '';
  }

  function updateCounter() {
    counter.textContent = input.value.length + ' / ' + MAX_LEN + ' Zeichen';
  }

  /* ---------- Senden ---------- */
  // Verlauf für die API: neueste zuerst, höchstens MAX_SEND Nachrichten und MAX_TOTAL Zeichen (Server-Limit 4000).
  // Lange Antworten (z. B. Vertragstexte) werden gekürzt, damit Folgefragen nicht am Gesamtlimit scheitern.
  var MAX_TOTAL = 3800, MAX_ASSISTANT = 600;
  function buildPayload() {
    var out = [], total = 0;
    for (var i = history.length - 1; i >= 0 && out.length < MAX_SEND; i--) {
      var m = history[i];
      var c = String(m.content).slice(0, m.role === 'assistant' ? MAX_ASSISTANT : MAX_LEN).replace(/^\s+|\s+$/g, '');
      if (!c) continue;
      if (total + c.length > MAX_TOTAL) break;
      total += c.length;
      out.unshift({ role: m.role, content: c });
    }
    return out;
  }
  // Feste Antworten direkt im Browser (js/chat-faq.js, gleiche Logik + Wissensbasis wie der Server-FAQ-Modus).
  // Kein Server nötig, Fragen verlassen den Browser nicht. Das Bündel wird erst beim ersten Öffnen geladen.
  var LOCAL = !/[?&]chat=api/.test(location.search); // ?chat=api: Server-Modus (Worker), z. B. für tools/site-build/chat.e2e.mjs
  var faqPromise = null;
  function loadFaq() {
    if (window.YQFaq) return Promise.resolve(window.YQFaq);
    if (!faqPromise) {
      faqPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = siteUrl('js/chat-faq.js');
        s.async = true;
        s.onload = function () { if (window.YQFaq) resolve(window.YQFaq); else { faqPromise = null; var e = new Error('load'); e.status = 0; reject(e); } };
        s.onerror = function () { faqPromise = null; var e = new Error('network'); e.status = 0; reject(e); };
        document.head.appendChild(s);
      });
    }
    return faqPromise;
  }
  function chatRequest(messages) {
    if (LOCAL && !YQ.MOCK) {
      return loadFaq().then(function (faq) {
        var r = faq.answer(messages);
        // kurze Pause, damit die Antwort nicht „springt“ und der Status angesagt werden kann
        return new Promise(function (res) { setTimeout(function () { res({ reply: r.reply, sources: r.sources || [], mode: 'faq', answered: r.answered }); }, 250); });
      });
    }
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
    hideJump();
    renderMsg('user', text);
    history.push({ role: 'user', content: text });
    input.value = ''; updateCounter();
    setBusy(true);
    scrollToEnd();                         // eigene Frage: immer ans Ende (Tipp-Indikator sichtbar)
    var myGen = gen;
    var payload = buildPayload();
    function place(b) {
      // Nur mitscrollen, wenn der Nutzer unten war; sonst Hinweis-Schaltfläche statt Wegspringen.
      if (stick) revealAnswer(b); else showJump(b);
    }
    var stick;
    chatRequest(payload).then(function (data) {
      if (myGen !== gen) { setBusy(false); return; } // Verlauf wurde währenddessen gelöscht
      stick = nearBottom();
      var sources = Array.isArray(data.sources) ? data.sources : [];
      var mode = data.mode === 'ai' ? 'ai' : 'faq';
      history.push({ role: 'assistant', content: data.reply });
      view.push({ r: 'u', c: text }, { r: 'a', c: data.reply, s: sources.slice(0, 5), m: mode });
      saveStore();
      setBusy(false);
      place(renderMsg('assistant', data.reply, { mode: mode, sources: sources, copy: true }));
    }, function (e) {
      if (myGen !== gen) { setBusy(false); return; }
      stick = nearBottom();
      history.pop();                       // fehlgeschlagene Frage nicht in den Verlauf übernehmen
      var rate = e.status === 429, bad = e.status === 400 || e.status === 413 || e.status === 415;
      setBusy(false);
      var b = renderMsg('assistant', rate ? ERR_RATE : (bad ? ERR_BAD : ERR_DOWN), { error: true, errorLink: !rate && !bad, retry: (!rate && !bad) ? text : null });
      input.value = text; updateCounter();  // Eingabe zum erneuten Versuch wiederherstellen
      place(b);
    });
  }

  /* ---------- Panel ---------- */
  function build() {
    built = true;
    if (LOCAL && !YQ.MOCK) loadFaq().catch(function () { /* Fehler zeigt erst die erste Frage */ });
    var title = el('h2', { class: 'yq-chat-title', id: 'yq-chat-title' }, 'Fragen zu Yanqiva');
    var closeBtn = el('button', { type: 'button', 'aria-label': 'Chat schließen' });
    closeBtn.appendChild(icon(ICON_CLOSE));
    closeBtn.addEventListener('click', function () { setOpen(false); });

    scrollBox = el('div', { class: 'yq-chat-scroll' });
    var notice = el('p', { class: 'yq-chat-notice', id: 'yq-chat-notice' },
      'Automatische Antworten aus den Inhalten dieser Website, ohne Gewähr; keine Rechtsberatung, keine verbindlichen Angebote. Der Chat läuft vollständig in Ihrem Browser: Ihre Fragen werden nicht an uns oder Dritte übertragen. Mehr in der ',
      el('a', { href: siteUrl('datenschutz.html#chatbot') }, 'Datenschutzerklärung'), '.');
    log = el('div', { class: 'yq-chat-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', 'aria-label': 'Chatverlauf' });
    scrollBox.appendChild(notice);
    scrollBox.appendChild(log);
    // Tipp-Indikator: rein visuell (Status wird über role=status angesagt), außerhalb des Logs
    typing = el('div', { class: 'yq-chat-typing', 'aria-hidden': 'true', hidden: true },
      el('span', { class: 'yq-chat-dot' }), el('span', { class: 'yq-chat-dot' }), el('span', { class: 'yq-chat-dot' }));
    scrollBox.appendChild(typing);
    jumpBtn = el('button', { type: 'button', class: 'yq-chat-jump', hidden: true }, 'Neue Antwort anzeigen');
    jumpBtn.addEventListener('click', function () { var b = pendingBox; hideJump(); if (b) { revealAnswer(b); b.setAttribute('tabindex', '-1'); b.focus({ preventScroll: true }); } });
    scrollBox.addEventListener('scroll', function () { if (pendingBox && nearBottom()) hideJump(); }, { passive: true });

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
      el('div', { class: 'yq-chat-head' }, title, closeBtn), el('div', { class: 'yq-chat-body' }, scrollBox, jumpBtn), statusEl, form);
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
      renderMsg(role, content, role === 'assistant' ? { mode: m.m === 'ai' ? 'ai' : 'faq', sources: Array.isArray(m.s) ? m.s : [], copy: true } : null);
    });
    if (!saved.length) showChips();
    updateCounter();

    form.addEventListener('submit', function (ev) { ev.preventDefault(); submit(input.value); input.focus(); });
    input.addEventListener('input', updateCounter);
    input.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); submit(input.value); }
    });
    clearBtn.addEventListener('click', function () {
      gen++; history = []; view = []; saveStore();
      while (log.firstChild) log.removeChild(log.firstChild);
      renderMsg('assistant', GREETING);
      hideJump();
      showChips();
      announce('Verlauf gelöscht.');
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
    toggle.appendChild(el('span', { class: 'yq-chat-toggle__label' }, 'Fragen?'));
    toggle.appendChild(el('span', { class: 'visually-hidden' }, ' Chat zu Yanqiva öffnen'));
    toggle.addEventListener('click', function () { setOpen(!open); });
    rootEl.appendChild(toggle);
    document.body.appendChild(rootEl);
    root0.classList.add('yq-chat-on');
    if (mq) { var h = function () { syncModal(); }; if (mq.addEventListener) mq.addEventListener('change', h); else if (mq.addListener) mq.addListener(h); }
  }

  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
