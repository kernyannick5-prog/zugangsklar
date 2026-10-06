/* Kontaktformular -> POST /api/lead (source "kontakt"). */
(function () {
  'use strict';
  var YQ = window.YQ;
  var form = document.getElementById('contact-form');
  if (!form) return;
  var statusEl = document.getElementById('contact-status');
  if (YQ.pow) YQ.pow.watch(form); // Rechenaufgabe beim ersten Fokus vorab lösen (Spamschutz, siehe js/config.js)
  var quelle = (new URLSearchParams(window.location.search).get('quelle') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 40);
  // Mehrere Websites: kein eigener Plan mehr, Anfrage über das Kontaktformular
  if (quelle === 'mehrere-websites' && form.elements.nachricht && !form.elements.nachricht.value) form.elements.nachricht.value = 'Ich habe mehrere Websites und möchte wissen, wie Sie mir helfen können. Anzahl der Websites: ';
  // Aus dem Website-Check: geprüfte Adresse vorbelegen (nur http/https, gekürzt; Wert landet nur im Eingabefeld)
  if (quelle === 'check' && form.elements.url && !form.elements.url.value) {
    var checked = (new URLSearchParams(window.location.search).get('url') || '').trim().slice(0, 300);
    if (/^https?:\/\/[^\s]+$/i.test(checked)) form.elements.url.value = checked;
    if (form.elements.nachricht && !form.elements.nachricht.value) form.elements.nachricht.value = 'Ich habe meine Website mit dem Website-Check geprüft und möchte wissen, welche Punkte sich zu beheben lohnen.';
  }
  function kfields(f, url) {
    var o = { name: f.name.value.trim(), message: f.nachricht.value.trim() };
    if (url) o.website = url;
    return o;
  }
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = form.elements;
    var btn = form.querySelector('button[type="submit"]');
    var url = f.url.value.trim();
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    btn.disabled = true;
    statusEl.textContent = 'Nachricht wird gesendet …';
    var g = YQ.guard(form);
    var payload = { hp: g.hp, ts: g.ts, email: f.email.value.trim(), url: url, consent: true, source: 'kontakt', message: 'Name: ' + f.name.value.trim() + '\n' + f.nachricht.value.trim(), fields: kfields(f, url) };
    (YQ.pow ? YQ.pow.withPow(form, payload) : Promise.resolve(payload)).then(function (body) {
      return YQ.postJson('/api/lead', body, { timeout: 20000 });
    }).then(function (res) {
      statusEl.textContent = 'Vielen Dank. Wir antworten in der Regel innerhalb von 24 Stunden (werktags).' + (res && typeof res.id === 'string' && /^YQ-[0-9]{8}-[A-Z0-9]{4,6}$/.test(res.id) ? ' Ihre Anfrage-ID: ' + res.id : '');
      form.reset();
      btn.disabled = false;
      if (!document.activeElement || document.activeElement === document.body) btn.focus();
    }, function (e) {
      btn.disabled = false;
      if (!document.activeElement || document.activeElement === document.body) btn.focus();
      if (e.kind === 'network') YQ.mailFallback(statusEl, 'Das Formular ist gerade nicht erreichbar. Bitte schreiben Sie uns direkt per', 'Kontaktanfrage über yanqiva', f.nachricht.value.trim());
      else statusEl.textContent = 'Fehler: ' + e.message;
    });
  });
})();
