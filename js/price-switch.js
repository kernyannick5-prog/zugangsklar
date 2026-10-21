/* GENERIERT von tools/site-build/build.mjs aus catalog.mjs und price-switch.client.js. Nicht von Hand ändern. */
/* Yanqiva – Datumsumschaltung des befristeten Einführungspreises (Basic), ohne Neubau der Website.
 *
 * Quelle: tools/site-build/price-switch.client.js. build.mjs setzt die Daten (Enddatum, Textpaare) aus catalog.mjs ein
 * und schreibt site/js/price-switch.js. Die statischen Seiten zeigen den Preis zum Build-Datum (No-JS-Fallback mit
 * ausdrücklich genanntem Enddatum). Ab dem Tag nach dem Enddatum (Europe/Berlin) ersetzt dieses Skript die Texte im
 * Dokument durch den Regelpreis und blendet die Hinweise zum Einführungspreis aus. js/catalog.js nutzt dieselbe Regel.
 * Es werden nur Textknoten geändert (kein innerHTML), keine Daten gesendet, nichts gespeichert. */
(function () {
  'use strict';
  var D = {"until":"2026-12-31","pairs":[["Basic ist ein Festpreis für ein kompaktes Projekt mit 1–3 Seiten. Wünschen Sie mehr Seiten, ein Buchungstool oder Integrationen, passt Business besser. Vorab erhalten Sie ein verbindliches Angebot; die Anfrage ist unverbindlich. Für Basic gibt es keine Live-Vorschau. Befristetes Einführungsangebot: Der Einführungspreis von 249 € gilt für Anfragen, die bis 31.12.2026 bei uns eingehen. Danach kostet Basic 399 €. Maßgeblich ist der Preis in Ihrem Angebot.","Basic ist ein Festpreis für ein kompaktes Projekt mit 1–3 Seiten. Wünschen Sie mehr Seiten, ein Buchungstool oder Integrationen, passt Business besser. Vorab erhalten Sie ein verbindliches Angebot; die Anfrage ist unverbindlich. Für Basic gibt es keine Live-Vorschau."],["Befristetes Einführungsangebot: Der Einführungspreis von 249 € gilt für Anfragen, die bis 31.12.2026 bei uns eingehen. Danach kostet Basic 399 €. Maßgeblich ist der Preis in Ihrem Angebot.",""],["Website Basic (249 €, Einführungspreis bis 31.12.2026 (danach 399 €), einmalig, unverbindliche Anfrage, Angebot vorab)","Website Basic (399 €, einmalig, unverbindliche Anfrage, Angebot vorab)"],["Einführungspreis 249 € für Anfragen bis 31.12.2026, danach 399 €",""],["249 € (Einführungspreis bis 31.12.2026, danach 399 €)","399 €"],["Einführungspreis bis 31.12.2026 · danach 399 €",""],["249 € (Einführungspreis bis 31.12.2026)","399 €"],["249 €","399 €"]]};

  function today() {
    /* Schnellpfad: Berlin liegt hoechstens 2 h vor UTC, daher ist das Datum weit vor/nach dem Stichtag eindeutig. Intl.DateTimeFormat mit
       Zeitzone kostet beim ersten Aufruf auf schwachen Geraeten ca. 100 ms Hauptthread und wird nur noch rund um den Stichtag gebraucht. */
    var u = D.until && Date.parse(D.until + 'T00:00:00Z'), t = Date.now();
    if (u && t < u - 2 * 864e5) return '0000-00-00';
    if (u && t > u + 3 * 864e5) return '9999-99-99';
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) {
      var n = new Date();
      return n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-' + ('0' + n.getDate()).slice(-2);
    }
  }
  var active = !!D.until && today() > D.until;

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // Leerzeichen in den Vorlagen passen auf normale und geschützte Leerzeichen (der Build setzt vor "€" ein &nbsp;)
  var RES = D.pairs.map(function (p) { return [new RegExp(esc(p[0]).replace(/ /g, '[  ]'), 'g'), p[1].replace(/ €/g, ' €')]; });

  function apply(text) {
    var out = String(text);
    if (!active) return out;
    for (var i = 0; i < RES.length; i++) out = out.replace(RES[i][0], function () { return RES[i][1]; });
    return out;
  }
  window.YQ_PRICE = { until: D.until, active: active, apply: apply };
  if (!active || !document.createTreeWalker) return;

  function walk() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node, changed = [];
    while ((node = walker.nextNode())) {
      var tag = node.parentNode && node.parentNode.nodeName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') continue;
      var v = node.nodeValue, o = apply(v);
      if (o !== v) { node.nodeValue = o.replace(/ {2,}/g, ' '); changed.push(node); }
    }
    // Leer gewordene Hinweise (Badge, Hinweisabsatz) samt leerem Umschlag ausblenden
    changed.forEach(function (n) {
      if (!/^[\s ]*$/.test(n.nodeValue)) return;
      var el = n.parentElement;
      while (el && el !== document.body && !el.textContent.replace(/[\s ]+/g, '')) {
        el.style.display = 'none';
        el = el.parentElement;
      }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', walk);
  else walk();
})();
