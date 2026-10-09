/* Personalisierung nur im Browser: liest #f=<Name>&o=<Ort> aus dem URL-Fragment.
   Werte werden ausschließlich per textContent eingesetzt, nirgendwohin gesendet, nicht gespeichert. */
(function () {
  'use strict';
  var OK = /^[A-Za-z0-9\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF .,&'()\/\u2019\u201E\u201C\u201D-]+$/;
  function clean(v) {
    if (typeof v !== 'string') return null;
    v = v.trim();
    return v.length > 0 && v.length <= 80 && OK.test(v) ? v : null;
  }
  /* Ablauf: Entwurf ist nur befristet online. Datum (YYYY-MM-DD) steht in <meta name="demo-expires">.
     Verglichen wird mit dem heutigen Datum in Europe/Berlin; ab dem Folgetag 00:00 zeigt die Seite nur eine Meldung.
     Ohne JavaScript bleibt der Inhalt sichtbar. */
  function berlinToday() {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      var m = {};
      for (var i = 0; i < parts.length; i++) m[parts[i].type] = parts[i].value;
      return m.year + '-' + m.month + '-' + m.day;
    } catch (e) {
      var d = new Date();
      return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
  }
  var meta = document.querySelector('meta[name="demo-expires"]');
  var exp = meta ? meta.getAttribute('content') : null;
  if (exp && /^\d{4}-\d{2}-\d{2}$/.test(exp) && berlinToday() > exp) {
    document.title = 'Entwurf abgelaufen';
    var b = document.body;
    while (b.firstChild) b.removeChild(b.firstChild);
    b.style.cssText = 'margin:0;padding:2rem 1rem;background:#fff;color:#1b1b1f;font:1.125rem/1.55 system-ui,-apple-system,"Segoe UI",Arial,sans-serif';
    var box = document.createElement('main');
    box.style.cssText = 'max-width:34rem;margin:12vh auto 0;text-align:center';
    var p = document.createElement('p');
    p.appendChild(document.createTextNode('Dieser Entwurf ist abgelaufen. Bei Interesse erstellen wir Ihnen gern einen neuen: '));
    var a = document.createElement('a');
    a.href = 'mailto:support@yanqiva.de';
    a.textContent = 'support@yanqiva.de';
    a.style.color = '#2F2A85';
    p.appendChild(a);
    box.appendChild(p);
    b.appendChild(box);
    return;
  }
  var f = null, o = null;
  try {
    var p = new URLSearchParams(location.hash.slice(1));
    f = clean(p.get('f'));
    o = clean(p.get('o'));
  } catch (e) { /* ungültiges Fragment: Standardtexte bleiben */ }
  function fill(attr, val) {
    if (!val) return;
    var els = document.querySelectorAll('[' + attr + ']');
    for (var i = 0; i < els.length; i++) els[i].textContent = val;
  }
  fill('data-f', f);
  fill('data-o', o);
  if (f) document.title = 'Website-Entwurf für ' + f + ' \u2013 Konzept von YANQIVA';
})();
