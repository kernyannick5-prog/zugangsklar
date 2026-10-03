/* ==========================================================================
   IRONHAUS – Shared JS (Header / Menu / Reveal / Forms)
   Wird von allen drei Paket-Demos (Basic, Business, Premium) eingebunden.
   Enthaelt:
   - Sticky-Header-Kompaktierung beim Scrollen
   - Mobiles Vollbildmenu (Toggle, Escape, Klick auf Link)
   - Scroll-Reveal fuer .reveal-Elemente
   - Statistik-Zaehler (.counter)
   - Zuverlaessiges Nachladen von loading="lazy"-Bildern
   - IronhausShared: wiederverwendbare Helfer fuer Formulare, Datum, Downloads
   ========================================================================== */
(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ */
  /* Sticky header shrink on scroll                                      */
  /* ------------------------------------------------------------------ */
  var header = document.getElementById("site-header");
  if (header) {
    var lastState = false;
    function updateHeader() {
      var shouldCompact = window.scrollY > 60;
      if (shouldCompact !== lastState) {
        header.classList.toggle("is-compact", shouldCompact);
        lastState = shouldCompact;
      }
    }
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
  }

  /* ------------------------------------------------------------------ */
  /* Mobile fullscreen menu                                              */
  /* ------------------------------------------------------------------ */
  var navToggle = document.querySelector(".nav-toggle");
  var mobileMenu = document.getElementById("mobile-menu");

  function closeMobileMenu() {
    navToggle.setAttribute("aria-expanded", "false");
    mobileMenu.classList.remove("is-open");
    document.body.style.overflow = "";
  }
  function openMobileMenu() {
    navToggle.setAttribute("aria-expanded", "true");
    mobileMenu.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }

  if (navToggle && mobileMenu) {
    navToggle.addEventListener("click", function () {
      var expanded = navToggle.getAttribute("aria-expanded") === "true";
      if (expanded) { closeMobileMenu(); } else { openMobileMenu(); }
    });
    mobileMenu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") closeMobileMenu();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
        closeMobileMenu();
        navToggle.focus();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Stat count-up (reduced-motion safe)                                 */
  /* ------------------------------------------------------------------ */
  var counters = document.querySelectorAll(".counter");
  function animateCounter(el) {
    if (el.dataset.animated) return;
    el.dataset.animated = "1";
    var target = parseInt(el.getAttribute("data-target"), 10) || 0;
    if (prefersReducedMotion) {
      el.textContent = target.toLocaleString("de-DE");
      return;
    }
    var duration = 1400;
    var startTime = null;
    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target).toLocaleString("de-DE");
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if ("IntersectionObserver" in window && counters.length) {
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: "200px 0px 200px 0px" });
    counters.forEach(function (c) { counterObserver.observe(c); });
    window.setTimeout(function () { counters.forEach(animateCounter); }, 2200);
  } else {
    counters.forEach(animateCounter);
  }

  /* ------------------------------------------------------------------ */
  /* Coaches – "Mehr erfahren" disclosure (also works via hover/CSS)     */
  /* ------------------------------------------------------------------ */
  var coachButtons = Array.prototype.slice.call(document.querySelectorAll(".coach-more"));
  coachButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var card = btn.closest(".coach-card");
      var expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", expanded ? "false" : "true");
      card.classList.toggle("is-open", !expanded);
      btn.textContent = expanded ? "Mehr erfahren" : "Weniger anzeigen";
    });
  });

  /* ------------------------------------------------------------------ */
  /* Testimonial slider (falls auf der Seite vorhanden)                  */
  /* ------------------------------------------------------------------ */
  var sliderRoot = document.querySelector("[data-slider]");
  if (sliderRoot) {
    var track = sliderRoot.querySelector(".testimonial-track");
    var slides = Array.prototype.slice.call(track.children);
    var prevBtn = sliderRoot.querySelector("[data-slider-prev]");
    var nextBtn = sliderRoot.querySelector("[data-slider-next]");
    var dotsWrap = sliderRoot.querySelector(".slider-dots");
    var status = sliderRoot.querySelector(".slider-status, [id$='slider-status']");
    var current = 0;

    slides.forEach(function (_, i) {
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "slider-dot";
      dot.setAttribute("aria-label", "Testimonial " + (i + 1) + " von " + slides.length);
      dot.setAttribute("aria-current", i === 0 ? "true" : "false");
      dot.addEventListener("click", function () { goTo(i); });
      dotsWrap.appendChild(dot);
    });
    var dots = Array.prototype.slice.call(dotsWrap.children);

    function goTo(index) {
      current = (index + slides.length) % slides.length;
      track.style.transform = "translateX(-" + (current * 100) + "%)";
      dots.forEach(function (d, i) { d.setAttribute("aria-current", i === current ? "true" : "false"); });
      if (status) status.textContent = "Testimonial " + (current + 1) + " von " + slides.length;
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { goTo(current - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { goTo(current + 1); });
    goTo(0);
  }

  /* ------------------------------------------------------------------ */
  /* Scroll reveal (progressive enhancement)                             */
  /* ------------------------------------------------------------------ */
  var revealItems = document.querySelectorAll(".reveal");
  function revealAll() {
    revealItems.forEach(function (item) { item.classList.add("is-visible"); });
  }
  if ("IntersectionObserver" in window && revealItems.length) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: "200px 0px 200px 0px" });
    revealItems.forEach(function (item) { revealObserver.observe(item); });
    window.setTimeout(revealAll, 1800);
  } else {
    revealAll();
  }

  /* ------------------------------------------------------------------ */
  /* Reliable lazy images                                                */
  /* ------------------------------------------------------------------ */
  var lazyImages = Array.prototype.slice.call(document.querySelectorAll('img[loading="lazy"]'));
  if (lazyImages.length) {
    if ("IntersectionObserver" in window) {
      var lazyObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.loading = "eager";
            lazyObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0, rootMargin: "400px 0px 400px 0px" });
      lazyImages.forEach(function (img) { lazyObserver.observe(img); });
    }
    window.setTimeout(function () {
      lazyImages.forEach(function (img) { if (!img.complete) img.loading = "eager"; });
    }, 2000);
  }

  /* ------------------------------------------------------------------ */
  /* Footer-Jahr automatisch aktuell halten                              */
  /* ------------------------------------------------------------------ */
  var yearEls = document.querySelectorAll("[data-current-year]");
  if (yearEls.length) {
    var year = String(new Date().getFullYear());
    yearEls.forEach(function (el) { el.textContent = year; });
  }

  /* ------------------------------------------------------------------ */
  /* IronhausShared – wiederverwendbare Helfer fuer Paketseiten          */
  /* ------------------------------------------------------------------ */
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function formatDateDE(isoDate) {
    if (!isoDate) return "";
    var d = new Date(isoDate + "T00:00:00");
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function setFieldError(input, errorEl, message) {
    if (input) input.setAttribute("aria-invalid", message ? "true" : "false");
    if (errorEl) errorEl.textContent = message || "";
  }

  /**
   * Validiert ein Formular anhand einer Regelliste.
   * rules: [{ input, error, required: true, email: true, minDate: "YYYY-MM-DD", message }]
   * Gibt true zurueck, wenn alle Regeln erfuellt sind, setzt sonst Fehlermeldungen
   * und fokussiert das erste ungueltige Feld.
   */
  function validateForm(rules) {
    var isValid = true;
    var firstInvalid = null;

    rules.forEach(function (rule) {
      var value = (rule.input.value || "").trim();
      var msg = "";

      if (rule.required && !value) {
        msg = rule.requiredMessage || "Dieses Feld ist erforderlich.";
      } else if (rule.email && value && !EMAIL_PATTERN.test(value)) {
        msg = rule.emailMessage || "Diese E-Mail-Adresse scheint nicht gueltig zu sein.";
      } else if (rule.minDate && value) {
        var chosen = new Date(value + "T00:00:00");
        var min = new Date(rule.minDate + "T00:00:00");
        if (chosen < min) msg = rule.minDateMessage || "Das Datum darf nicht in der Vergangenheit liegen.";
      } else if (rule.custom && value) {
        var customMsg = rule.custom(value);
        if (customMsg) msg = customMsg;
      } else if (rule.required && rule.checked !== undefined) {
        // reserved for checkbox handling below
      }

      if (rule.type === "checkbox") {
        if (rule.required && !rule.input.checked) {
          msg = rule.requiredMessage || "Bitte bestaetige diese Angabe.";
        }
      }

      setFieldError(rule.input, rule.error, msg);
      if (msg && !firstInvalid) firstInvalid = rule.input;
      if (msg) isValid = false;
    });

    if (firstInvalid) firstInvalid.focus();
    return isValid;
  }

  function downloadTextFile(filename, content, mime) {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  function formatEUR(amount) {
    return amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  /**
   * Erstellt einen minimalen .ics-Kalendereintrag (RFC 5545) als Download.
   * options: { title, description, location, start: Date, durationMinutes, filename }
   */
  function downloadICS(options) {
    function pad(n) { return String(n).padStart(2, "0"); }
    function toICSDate(d) {
      return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + "T" +
        pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + "00Z";
    }
    var start = options.start;
    var end = new Date(start.getTime() + (options.durationMinutes || 60) * 60000);
    var uid = "ironhaus-" + Date.now() + "@ironhaus-dortmund.example";
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//IRONHAUS//Demo//DE",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:" + uid,
      "DTSTAMP:" + toICSDate(new Date()),
      "DTSTART:" + toICSDate(start),
      "DTEND:" + toICSDate(end),
      "SUMMARY:" + (options.title || "IRONHAUS Termin"),
      "DESCRIPTION:" + (options.description || "").replace(/\n/g, "\\n"),
      "LOCATION:" + (options.location || "IRONHAUS, Beispielkai 12, 44147 Dortmund"),
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    downloadTextFile(options.filename || "ironhaus-termin.ics", lines.join("\r\n"), "text/calendar;charset=utf-8");
  }

  /**
   * Simuliert einen asynchronen API-Aufruf mit kuenstlicher Latenz (fuer
   * Demo-Zwecke ohne echten Server / ohne fetch auf lokale Dateien).
   */
  function simulateRequest(result, delayMs) {
    return new Promise(function (resolve) {
      window.setTimeout(function () { resolve(result); }, delayMs || 500);
    });
  }

  window.IronhausShared = {
    emailPattern: EMAIL_PATTERN,
    todayISO: todayISO,
    formatDateDE: formatDateDE,
    setFieldError: setFieldError,
    validateForm: validateForm,
    downloadTextFile: downloadTextFile,
    downloadICS: downloadICS,
    escapeHTML: escapeHTML,
    formatEUR: formatEUR,
    simulateRequest: simulateRequest,
    prefersReducedMotion: prefersReducedMotion
  };
})();
