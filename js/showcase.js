/* Showcase: Beispiel-Websites (Stufe x Beispielkunde x Gerät) in einem Browser-/Geräte-Mockup.
   - Tabs (Leistungsstufe) nach WAI-ARIA-Muster, Radiogruppen für Beispielkunde und Ansicht.
   - Genau ein same-origin <iframe> ist aktiv; src wird getauscht und erst geladen, wenn der Bereich fast sichtbar ist.
   - Echter Viewport (1280/820/390 px) per CSS-Transform skaliert, Neuberechnung per ResizeObserver.
   - Zustand im URL-Hash: #showcase=business-ironhaus-mobile (Teile optional, Reihenfolge beliebig). */
(function () {
  'use strict';
  var root = document.querySelector('[data-showcase]');
  if (!root) return;

  var TIERS = ['business', 'premium'];
  var TIER_NAMES = { business: 'Business', premium: 'Premium' };
  var CLIENTS = {
    ironhaus: { name: 'IRONHAUS', host: 'ironhaus-dortmund.example', folders: { business: 'ironhaus-business', premium: 'ironhaus-premium' } },
    pistazie: { name: 'Café Pistazie', host: 'cafe-pistazie.example', folders: { business: 'pistazie-business', premium: 'pistazie-premium' } }
  };
  // Geräte: vw = echte CSS-Viewportbreite im iframe, pref = bevorzugte Viewporthöhe, max = maximale Anzeigebreite, pad = Gehäuserand
  var DEVICES = {
    desktop: { vw: 1280, pref: 800, max: 100000, pad: 0 },
    tablet: { vw: 820, pref: 1100, max: 620, pad: 14 },
    mobile: { vw: 390, pref: 820, max: 390, pad: 10 }
  };
  var MIN_SCALE = 0.5; // darunter wird eine Ansicht deaktiviert (Text nicht mehr lesbar)

  var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
  var panels = Array.prototype.slice.call(root.querySelectorAll('[role="tabpanel"]'));
  var clientRadios = Array.prototype.slice.call(root.querySelectorAll('input[name="sc-client"]'));
  var deviceRadios = Array.prototype.slice.call(root.querySelectorAll('input[name="sc-device"]'));
  var stage = document.getElementById('sc-stage');
  var device = document.getElementById('sc-device');
  var viewport = document.getElementById('sc-viewport');
  var frame = document.getElementById('sc-frame');
  var loading = viewport.querySelector('.sc-loading');
  var urlText = document.getElementById('sc-url-text');
  var openLink = document.getElementById('sc-open');
  var hint = document.getElementById('sc-device-hint');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var state = { tier: 'business', client: 'ironhaus', device: 'desktop' };
  var visible = false;       // Bereich in der Nähe des Viewports?
  var loadedKey = null;      // "folder/page" des aktuell geladenen Iframes
  var loadTimer = null;
  var userDevice = false;    // Gerät explizit gewählt (Hash oder Klick)?
  var currentPage = 'index.html';
  var started = false;       // erst nach dem ersten Rendern animieren

  function folderOf(s) { return CLIENTS[s.client].folders[s.tier]; }

  /* ---------- Hash ---------- */
  function parseHash(str) {
    var m = /^#showcase=([a-z-]+)$/.exec(str === undefined ? (window.location.hash || '') : str);
    if (!m) return null;
    var out = {};
    m[1].split('-').forEach(function (p) {
      if (p === 'basic') out.tier = 'business'; // alter Link (Basic entfallen)
      else if (TIERS.indexOf(p) > -1) out.tier = p;
      else if (CLIENTS[p]) out.client = p;
      else if (DEVICES[p]) out.device = p;
    });
    return out;
  }
  function writeHash() {
    var h = '#showcase=' + state.tier + '-' + state.client + '-' + state.device;
    if (window.location.hash !== h && window.history && history.replaceState) history.replaceState(null, '', h);
  }

  /* ---------- Layout / Skalierung ---------- */
  function availWidth() {
    var cs = window.getComputedStyle(stage);
    return Math.floor(stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  }
  function scaleFor(dev, avail) {
    var d = DEVICES[dev];
    var shown = Math.min(avail, d.max + 2 * d.pad) - 2 * d.pad;
    return Math.max(0.05, Math.min(1, shown / d.vw));
  }
  function updateAvailability() {
    var avail = availWidth();
    var anyDisabled = false;
    deviceRadios.forEach(function (r) {
      var off = scaleFor(r.value, avail) < MIN_SCALE;
      r.disabled = off;
      if (off) anyDisabled = true;
    });
    hint.hidden = !anyDisabled;
    var cur = deviceRadios.filter(function (r) { return r.value === state.device; })[0];
    if (cur && cur.disabled) {
      var fallback = ['desktop', 'tablet', 'mobile'].filter(function (id) {
        return deviceRadios.filter(function (r) { return r.value === id && !r.disabled; }).length;
      })[0] || 'mobile';
      state.device = fallback;
      syncControls();
      writeHash();
    }
  }
  function layout() {
    var d = DEVICES[state.device];
    var avail = availWidth();
    if (!avail) return;
    var scale = scaleFor(state.device, avail);
    var maxH = Math.max(380, Math.round(window.innerHeight * 0.8));
    var dispH = Math.min(Math.round(d.pref * scale), maxH);
    device.setAttribute('data-device', state.device);
    device.style.setProperty('--sc-vw', d.vw + 'px');
    device.style.setProperty('--sc-vh', Math.round(dispH / scale) + 'px');
    device.style.setProperty('--sc-scale', String(scale));
    device.style.setProperty('--sc-w', Math.round(d.vw * scale) + 'px');
    device.style.setProperty('--sc-h', dispH + 'px');
  }
  var raf = 0;
  function relayout() {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; updateAvailability(); layout(); });
  }

  /* ---------- Zustand anwenden ---------- */
  function syncControls() {
    root.setAttribute('data-tier', state.tier);
    root.setAttribute('data-client', state.client);
    root.setAttribute('data-device', state.device);
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-tier') === state.tier;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) {
      var on = p.id === 'sc-panel-' + state.tier;
      if (on && p.hidden) {
        p.hidden = false;
        if (started && !reduceMotion) { p.classList.remove('sc-enter'); void p.offsetWidth; p.classList.add('sc-enter'); }
      } else if (!on) { p.hidden = true; p.classList.remove('sc-enter'); }
    });
    clientRadios.forEach(function (r) { r.checked = r.value === state.client; });
    deviceRadios.forEach(function (r) { r.checked = r.value === state.device; });
    var c = CLIENTS[state.client];
    frame.title = 'Demo-Website ' + c.name + ' in der Stufe ' + TIER_NAMES[state.tier];
    urlText.textContent = c.host + pagePath();
  }
  function pagePath() { return currentPage === 'index.html' ? '' : '/' + currentPage.replace(/\.html$/, ''); }

  function load(immediate) {
    clearTimeout(loadTimer);
    var wanted = folderOf(state);
    openLink.href = 'demos/' + wanted + '/index.html';
    if (!visible) return; // wird nachgeholt, sobald sichtbar
    var run = function () {
      var folder = folderOf(state);
      if (loadedKey && loadedKey.split('/')[0] === folder) return; // Iframe zeigt bereits dieses Paket
      loadedKey = folder + '/index.html';
      currentPage = 'index.html';
      viewport.setAttribute('aria-busy', 'true');
      loading.classList.add('is-on');
      frame.src = 'demos/' + folder + '/index.html';
      syncControls();
    };
    if (immediate) run(); else loadTimer = setTimeout(run, 200); // schnelles Durchschalten per Pfeiltasten entlastet
  }

  function apply(next, opts) {
    opts = opts || {};
    if (next.tier) state.tier = next.tier;
    if (next.client) state.client = next.client;
    if (next.device) { state.device = next.device; userDevice = true; }
    currentPage = 'index.html';
    syncControls();
    updateAvailability();
    layout();
    writeHash();
    load(opts.immediate);
  }

  /* ---------- Iframe-Ereignisse ---------- */
  frame.addEventListener('load', function () {
    if (!frame.getAttribute('src')) return;
    viewport.setAttribute('aria-busy', 'false');
    loading.classList.remove('is-on');
    // Navigation im Demo-Inhalt (z. B. Wechsel auf "Kurse" oder auf eine andere Stufe) nachführen, ohne neu zu laden.
    try {
      var m = /\/demos\/([^/]+)\/([^/?#]*)/.exec(frame.contentWindow.location.pathname);
      if (!m) return;
      var folder = m[1];
      currentPage = m[2] || 'index.html';
      loadedKey = folder + '/' + currentPage;
      Object.keys(CLIENTS).forEach(function (cid) {
        TIERS.forEach(function (tid) {
          if (CLIENTS[cid].folders[tid] === folder && (cid !== state.client || tid !== state.tier)) {
            state.client = cid; state.tier = tid; writeHash();
          }
        });
      });
      openLink.href = 'demos/' + folder + '/' + currentPage;
      syncControls();
    } catch (e) { /* Zugriff verweigert: Anzeige bleibt wie sie ist */ }
  });

  /* ---------- Tabs: Tastatur und Klick ---------- */
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { apply({ tier: t.getAttribute('data-tier') }, { immediate: true }); });
    t.addEventListener('keydown', function (e) {
      var n = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i + tabs.length - 1) % tabs.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = tabs.length - 1;
      if (n < 0) return;
      e.preventDefault();
      tabs[n].focus();
      apply({ tier: tabs[n].getAttribute('data-tier') });
    });
  });
  clientRadios.forEach(function (r) { r.addEventListener('change', function () { if (r.checked) apply({ client: r.value }, { immediate: true }); }); });
  deviceRadios.forEach(function (r) { r.addEventListener('change', function () { if (r.checked) apply({ device: r.value }, { immediate: true }); }); });

  /* ---------- Links von außen: <a data-sc-tier> und #showcase=... ---------- */
  function scrollToShowcase(focusTab) {
    root.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (focusTab) {
      var sel = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0];
      if (sel) sel.focus({ preventScroll: true });
    }
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-sc-tier], a[href^="#showcase="]') : null;
    if (!a) return;
    var next = a.hasAttribute('data-sc-tier') ? { tier: a.getAttribute('data-sc-tier') } : parseHash(a.getAttribute('href'));
    e.preventDefault();
    apply(next || {}, { immediate: true });
    scrollToShowcase(true);
  });
  window.addEventListener('hashchange', function () {
    var h = parseHash();
    if (h) { apply(h, { immediate: true }); scrollToShowcase(false); }
  });

  /* ---------- Start ---------- */
  var initial = parseHash();
  if (initial) {
    if (initial.tier) state.tier = initial.tier;
    if (initial.client) state.client = initial.client;
    if (initial.device) { state.device = initial.device; userDevice = true; }
  }
  var avail0 = availWidth();
  if (!userDevice && avail0 && scaleFor('desktop', avail0) < MIN_SCALE) state.device = 'mobile';
  syncControls();
  started = true;
  updateAvailability();
  layout();
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(stage); else window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (en) { return en.isIntersecting; })) { visible = true; io.disconnect(); load(true); }
    }, { rootMargin: '400px 0px' });
    io.observe(root);
  } else { visible = true; load(true); }
  if (initial) window.addEventListener('load', function () { scrollToShowcase(false); });
})();
