/* YANQIVA Entwurfs-Demos (Business): Mobilmenü, dezente Animationen, Filter, Demo-Formulare und Demo-Buchungs-Widget.
   Alles läuft ausschließlich lokal im Browser: kein Netzwerkzugriff, kein Speichern (kein localStorage/Cookie), keine Übertragung von Eingaben. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.classList.add('bz-ready');

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* Mobilmenü (Disclosure-Muster) */
  var toggle = $('.nav-toggle');
  var nav = toggle ? document.getElementById(toggle.getAttribute('aria-controls')) : null;
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      nav.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', function () { setOpen(toggle.getAttribute('aria-expanded') !== 'true'); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
    });
  }

  /* Sprunglinks im Seitentext: Ziel anspringen, ohne das URL-Fragment (Name/Ort) zu überschreiben */
  $$('a[href^="#"]').forEach(function (a) {
    var id = a.getAttribute('href').slice(1);
    if (!id) return;
    a.addEventListener('click', function (e) {
      var t = document.getElementById(id);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
    });
  });

  /* Einblend-Animation beim Scrollen */
  var rev = $$('[data-reveal]');
  if (rev.length) {
    if (reduce || !('IntersectionObserver' in window)) rev.forEach(function (el) { el.classList.add('is-in'); });
    else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
      }, { threshold: 0.12 });
      rev.forEach(function (el) { io.observe(el); });
    }
  }

  /* Dezente 3D-Neigung bei Mauszeiger (nur mit Zeigergerät, nicht bei reduzierter Bewegung) */
  if (!reduce && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('[data-tilt]').forEach(function (el) {
      var raf = 0;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(function () { el.style.setProperty('--ry', (x * 8).toFixed(2) + 'deg'); el.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg'); });
      });
      el.addEventListener('pointerleave', function () { cancelAnimationFrame(raf); el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
    });
  }

  /* Referenzen filtern */
  var fbtns = $$('[data-filter]');
  if (fbtns.length) {
    var items = $$('[data-cat]');
    var status = $('[data-filter-status]');
    fbtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var f = b.getAttribute('data-filter'), n = 0;
        fbtns.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        items.forEach(function (it) { var show = f === '*' || it.getAttribute('data-cat') === f; it.hidden = !show; if (show) n++; });
        if (status) status.textContent = n + ' Beispiel-Einträge angezeigt';
      });
    });
  }

  /* Demo-Formulare: validieren, aber niemals senden */
  var DEMO_OK = 'Entwurf: Ihre Eingaben wurden nicht gesendet und nicht gespeichert. In einer fertigen Website könnte die Anfrage hier an den Betrieb gesendet werden.';
  $$('form[data-demo-form]').forEach(function (form) {
    var st = $('[data-status]', form);
    var run = function () {
      if (form.reportValidity && !form.reportValidity()) return;
      if (st) st.textContent = form.getAttribute('data-ok') || DEMO_OK;
    };
    form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    var btn = $('[data-demo-submit]', form);
    if (btn) btn.addEventListener('click', run);
    var file = $('input[type="file"]', form), list = $('[data-file-list]', form);
    if (file && list) file.addEventListener('change', function () {
      var names = [];
      for (var i = 0; i < file.files.length; i++) names.push(file.files[i].name);
      list.textContent = names.length ? 'Ausgewählt (nur lokal, nicht übertragen): ' + names.join(', ') : '';
    });
  });

  /* Demo-Buchungs-Widget (lokal, Beispieltermine ab morgen) */
  var WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  var SING = { 'Nächte': 'Nacht', 'Tage': 'Tag', 'Personen': 'Person', 'Tiere': 'Tier' };
  var unit = function (u, n) { return n === 1 && SING[u] ? SING[u] : u; };
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  var fmt = function (d) { return WD[d.getDay()] + ' ' + p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '.'; };
  $$('[data-booking]').forEach(function (w, wi) {
    var mode = w.getAttribute('data-mode');
    var slots = (w.getAttribute('data-slots') || '').split(',').filter(Boolean);
    var daysEl = $('[data-days]', w), slotsEl = $('[data-slots-box]', w), sum = $('[data-summary]', w), st = $('[data-status]', w), btn = $('[data-book-submit]', w);
    var nightsEl = $('[data-nights]', w), personsEl = $('[data-persons]', w);
    var days = [], d = new Date();
    d.setHours(12, 0, 0, 0);
    var count = mode === 'stay' ? 14 : 12;
    while (days.length < count) { d = new Date(d.getTime() + 86400000); if (mode === 'stay' || d.getDay() !== 0) days.push(d); }
    var pre = 'bz' + wi;
    var html = '';
    days.forEach(function (day, i) {
      var parts = fmt(day).split(' ');
      html += '<label class="bz-chip"><input type="radio" name="' + pre + '-tag" value="' + i + '"><span>' + parts[0] + '<small>' + parts[1] + '</small></span></label>';
    });
    daysEl.innerHTML = html;
    var chosenDay = -1, chosenSlot = '';
    var showSlots = function () {
      if (mode !== 'slot' || !slotsEl) return;
      var h = '';
      slots.forEach(function (s, j) {
        var busy = (chosenDay * 7 + j * 3) % 5 === 0;
        h += '<label class="bz-chip"><input type="radio" name="' + pre + '-zeit" value="' + s + '"' + (busy ? ' disabled' : '') + '><span>' + s + '<small>' + (busy ? 'belegt' : 'frei') + '</small></span></label>';
      });
      slotsEl.innerHTML = h;
      chosenSlot = '';
    };
    var update = function () {
      var txt = '';
      if (chosenDay < 0) txt = 'Bitte einen Tag auswählen.';
      else if (mode === 'slot') {
        txt = 'Ihre Auswahl: ' + fmt(days[chosenDay]) + (chosenSlot ? ', ' + chosenSlot + ' Uhr' : ' (Uhrzeit fehlt noch)');
        if (personsEl) txt += ', ' + personsEl.value + ' ' + unit(personsEl.getAttribute('data-unit') || 'Personen', parseInt(personsEl.value, 10));
      } else {
        var n = parseInt(nightsEl.value, 10) || 1;
        var end = new Date(days[chosenDay].getTime() + n * 86400000);
        txt = 'Ihre Auswahl: ' + w.getAttribute('data-start') + ' ' + fmt(days[chosenDay]) + ', ' + n + ' ' + unit(w.getAttribute('data-unit'), n) + ', ' + w.getAttribute('data-end') + ' ' + fmt(end) + ', ' + personsEl.value + ' ' + unit(personsEl.getAttribute('data-unit') || 'Personen', parseInt(personsEl.value, 10));
      }
      sum.textContent = txt;
      if (st) st.textContent = '';
    };
    daysEl.addEventListener('change', function (e) { chosenDay = parseInt(e.target.value, 10); showSlots(); update(); });
    if (slotsEl) slotsEl.addEventListener('change', function (e) { chosenSlot = e.target.value; update(); });
    [nightsEl, personsEl].forEach(function (el) { if (el) el.addEventListener('change', update); });
    btn.addEventListener('click', function () {
      if (chosenDay < 0 || (mode === 'slot' && !chosenSlot)) { st.textContent = 'Bitte zuerst ' + (chosenDay < 0 ? 'einen Tag' : 'eine Uhrzeit') + ' auswählen.'; return; }
      st.textContent = 'Entwurf: Es wurde nichts gesendet und nichts gespeichert. In einer fertigen Website könnte – mit angebundenem Kalender – hier die Verfügbarkeit geprüft und die Anfrage an den Betrieb übergeben werden.';
    });
    update();
  });
})();
