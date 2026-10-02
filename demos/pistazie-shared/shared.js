/* =========================================================
   Café Pistazie — gemeinsame Helfer für Business & Premium
   (Kalender-Rendering, .ics-Export, kleine Utilities)
   Kein Modul-Bundler nötig: alles hängt an window.PistazieShared,
   damit die Seiten per file:// ohne Build-Schritt funktionieren.
   ========================================================= */
(function (global) {
  "use strict";

  function pad2(n) { return (n < 10 ? "0" : "") + n; }
  function ymd(d) { return d.getFullYear() + "" + pad2(d.getMonth() + 1) + "" + pad2(d.getDate()); }
  function icsEscape(str) {
    return String(str).replace(/[\\,;]/g, function (m) { return "\\" + m; }).replace(/\n/g, "\\n");
  }

  function buildICS(opts) {
    var stamp = ymd(new Date()) + "T000000Z";
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Café Pistazie Demo//" + (opts.prodid || "Termin") + "//DE",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      "UID:" + Date.now() + Math.round(Math.random() * 1e6) + "@cafe-pistazie.example",
      "DTSTAMP:" + stamp
    ];
    if (opts.startTime && opts.endTime) {
      lines.push("DTSTART:" + ymd(opts.start) + "T" + opts.startTime + "00");
      lines.push("DTEND:" + ymd(opts.end || opts.start) + "T" + opts.endTime + "00");
    } else {
      lines.push("DTSTART;VALUE=DATE:" + ymd(opts.start));
      lines.push("DTEND;VALUE=DATE:" + ymd(opts.end || opts.start));
    }
    lines.push("SUMMARY:" + icsEscape(opts.title));
    lines.push("DESCRIPTION:" + icsEscape(opts.description || ""));
    lines.push("LOCATION:" + icsEscape(opts.location || "Café Pistazie, Steinstraße 22, 40212 Düsseldorf"));
    lines.push("END:VEVENT", "END:VCALENDAR", "");
    return lines.join("\r\n");
  }

  function downloadICS(filename, icsString) {
    var blob = new Blob([icsString], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function firstWeekdayMonday(y, m) { var wd = new Date(y, m, 1).getDay(); return (wd + 6) % 7; }
  function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function addDays(date, n) { var d = new Date(date); d.setDate(d.getDate() + n); return d; }
  function formatDateDE(d) { return pad2(d.getDate()) + "." + pad2(d.getMonth() + 1) + "." + d.getFullYear(); }
  function monthLabel(y, m) {
    var label = new Date(y, m, 1).toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function renderCalendarGrid(gridEl, year, month, dayRenderer) {
    gridEl.innerHTML = "";
    var first = firstWeekdayMonday(year, month);
    var total = daysInMonth(year, month);
    for (var i = 0; i < first; i++) {
      var pad = document.createElement("div");
      pad.className = "calendar__day calendar__day--pad";
      pad.setAttribute("aria-hidden", "true");
      gridEl.appendChild(pad);
    }
    for (var d = 1; d <= total; d++) {
      var date = new Date(year, month, d);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calendar__day";
      btn.textContent = String(d);
      dayRenderer(btn, date);
      gridEl.appendChild(btn);
    }
  }

  function formatEUR(value) {
    return value.toFixed(2).replace(".", ",") + " €";
  }

  /* Deterministisches Demo-Muster für "ausgebucht" (kein Zufall bei jedem Rendern) */
  function isBlockedDate(date) {
    return date.getDate() % 7 === 3;
  }

  /* Simulierte API mit Promise + künstlicher Latenz (kein echter Server nötig,
     funktioniert auch offline / per file://). */
  function simulateApi(resultOrFn, delay) {
    delay = typeof delay === "number" ? delay : 450 + Math.round(Math.random() * 350);
    return new Promise(function (resolve) {
      global.setTimeout(function () {
        resolve(typeof resultOrFn === "function" ? resultOrFn() : resultOrFn);
      }, delay);
    });
  }

  function readJSON(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }

  function setFieldError(fieldEl, message) {
    var wrap = fieldEl.closest(".field") || fieldEl.closest(".form-row");
    var err = wrap && wrap.querySelector(".field__error, .form-error");
    if (err) err.textContent = message || "";
    if (wrap) {
      if (wrap.classList.contains("field")) {
        if (message) wrap.setAttribute("data-invalid", "true"); else wrap.removeAttribute("data-invalid");
      } else {
        wrap.classList.toggle("has-error", Boolean(message));
      }
    }
    if (message) fieldEl.setAttribute("aria-invalid", "true"); else fieldEl.removeAttribute("aria-invalid");
  }

  /* ---------------------------------------------------------
     Newsletter-Anmeldung (Double-Opt-in-Demo, "wie bei Brevo")
     Wird von business.js und premium.js auf jeder Seite mit
     einem #newsletter-form Formular aufgerufen.
     --------------------------------------------------------- */
  function wireNewsletter(formId) {
    var form = document.getElementById(formId || "newsletter-form");
    if (!form) return;
    var message = form.querySelector(".newsletter__message");
    var confirmBox = form.querySelector(".newsletter__confirm");
    var confirmBtn = form.querySelector("[data-newsletter-confirm]");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = form.querySelector('input[type="email"]').value.trim();
      if (!validEmail(email)) {
        if (message) { message.textContent = "Bitte eine gültige E-Mail-Adresse eingeben."; message.className = "newsletter__message"; }
        return;
      }
      if (message) {
        message.textContent = "Fast geschafft, " + email + "! Bitte bestätige die Anmeldung über den Link, den wir dir gerade geschickt hätten (Demo via Brevo-artigem Double-Opt-in).";
        message.className = "newsletter__message";
      }
      if (confirmBox) confirmBox.hidden = false;
    });
    if (confirmBtn) {
      confirmBtn.addEventListener("click", function () {
        if (message) { message.textContent = "Angemeldet! Du bekommst ab sofort Post von Café Pistazie."; message.className = "newsletter__message is-success"; }
        if (confirmBox) confirmBox.hidden = true;
        form.reset();
      });
    }
  }

  /* ---------------------------------------------------------
     Bewertungs-Widget: rendert statische Demo-Reviews
     --------------------------------------------------------- */
  var DEMO_REVIEWS = [
    { name: "Marie K.", stars: 5, text: "Bester Flat White in der Altstadt und die Pistazien-Rose ist Suchtgefahr." },
    { name: "Tom H.", stars: 5, text: "Brunch am Sonntag ist immer voll, aber es lohnt sich total." },
    { name: "Sana R.", stars: 4, text: "Torte auf Bestellung war pünktlich fertig und sah toll aus." }
  ];

  function starString(n) {
    var full = "★".repeat(n);
    var empty = "☆".repeat(5 - n);
    return full + empty;
  }

  function renderReviews(containerId) {
    var box = document.getElementById(containerId || "reviews");
    if (!box) return;
    var list = box.querySelector(".review-list");
    if (list) {
      list.innerHTML = DEMO_REVIEWS.map(function (r) {
        return '<article class="review-card"><div class="review-card__head"><span>' + r.name + '</span>' +
          '<span class="review-card__stars" aria-label="' + r.stars + ' von 5 Sternen">' + starString(r.stars) + "</span></div>" +
          "<p>" + r.text + "</p></article>";
      }).join("");
    }
  }

  global.PistazieShared = {
    pad2: pad2, ymd: ymd, buildICS: buildICS, downloadICS: downloadICS,
    daysInMonth: daysInMonth, firstWeekdayMonday: firstWeekdayMonday, sameDay: sameDay,
    addDays: addDays, formatDateDE: formatDateDE, monthLabel: monthLabel,
    renderCalendarGrid: renderCalendarGrid, formatEUR: formatEUR, isBlockedDate: isBlockedDate,
    simulateApi: simulateApi, readJSON: readJSON, writeJSON: writeJSON,
    validEmail: validEmail, setFieldError: setFieldError, wireNewsletter: wireNewsletter,
    renderReviews: renderReviews, DEMO_REVIEWS: DEMO_REVIEWS
  };
})(window);
