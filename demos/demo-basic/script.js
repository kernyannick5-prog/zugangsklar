(function () {
  "use strict";

  /* ---------------------------------------------------------
     Mobile slide-down navigation
     (unverändert aus 10-cafe/script.js übernommen)
  --------------------------------------------------------- */
  var menuToggle = document.getElementById("menuToggle");
  var mobileNav = document.getElementById("mobileNav");

  function openNav() {
    mobileNav.hidden = false;
    void mobileNav.offsetHeight;
    mobileNav.classList.add("is-open");
    menuToggle.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", onNavKeydown);
  }

  function closeNav() {
    mobileNav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", onNavKeydown);
    window.setTimeout(function () { mobileNav.hidden = true; }, 320);
  }

  function onNavKeydown(e) {
    if (e.key === "Escape") {
      closeNav();
      menuToggle.focus();
    }
  }

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener("click", function () {
      var expanded = menuToggle.getAttribute("aria-expanded") === "true";
      if (expanded) closeNav();
      else openNav();
    });
    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeNav);
    });
  }

  /* ---------------------------------------------------------
     Opening hours (Europe/Berlin) — live status pill + table highlight
     (unverändert aus 10-cafe/script.js übernommen)
  --------------------------------------------------------- */
  var HOURS = {
    "Montag":     { open: 8 * 60,  close: 19 * 60 },
    "Dienstag":   { open: 8 * 60,  close: 19 * 60 },
    "Mittwoch":   { open: 8 * 60,  close: 19 * 60 },
    "Donnerstag": { open: 8 * 60,  close: 19 * 60 },
    "Freitag":    { open: 8 * 60,  close: 19 * 60 },
    "Samstag":    { open: 9 * 60,  close: 19 * 60 },
    "Sonntag":    { open: 9 * 60,  close: 17 * 60 }
  };
  var DAY_ORDER = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

  function getBerlinParts() {
    var formatter = new Intl.DateTimeFormat("de-DE", {
      timeZone: "Europe/Berlin",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    var parts = formatter.formatToParts(new Date());
    var map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    var weekday = map.weekday.charAt(0).toUpperCase() + map.weekday.slice(1);
    var hour = parseInt(map.hour, 10);
    var minute = parseInt(map.minute, 10);
    return { weekday: weekday, minutes: hour * 60 + minute };
  }

  function formatMinutes(total) {
    var h = Math.floor(total / 60);
    var m = total % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function updateStatusPill() {
    var pill = document.getElementById("statusPill");
    if (!pill) return;
    var now = getBerlinParts();
    var todayIndex = DAY_ORDER.indexOf(now.weekday);
    var todayHours = HOURS[now.weekday];

    if (todayHours && now.minutes >= todayHours.open && now.minutes < todayHours.close) {
      pill.textContent = "Jetzt geöffnet · bis " + formatMinutes(todayHours.close) + " Uhr";
      pill.classList.remove("is-closed");
      return;
    }

    // Find next opening slot, starting today (if before opening) then following days
    for (var offset = 0; offset < 8; offset++) {
      var index = (todayIndex + offset) % 7;
      var dayName = DAY_ORDER[index];
      var dayHours = HOURS[dayName];
      if (offset === 0) {
        if (now.minutes < dayHours.open) {
          pill.textContent = "Gerade geschlossen · öffnet heute um " + formatMinutes(dayHours.open) + " Uhr";
          pill.classList.add("is-closed");
          return;
        }
        continue;
      }
      pill.textContent = "Gerade geschlossen · öffnet " + dayName + " um " + formatMinutes(dayHours.open) + " Uhr";
      pill.classList.add("is-closed");
      return;
    }
  }

  function highlightToday() {
    var now = getBerlinParts();
    document.querySelectorAll(".hours-table tr").forEach(function (row) {
      if (row.dataset.day === now.weekday) row.classList.add("is-today");
    });
  }

  updateStatusPill();
  highlightToday();

  /* ---------------------------------------------------------
     Vitrine category filter (nur auf angebot.html vorhanden;
     Selektoren finden auf anderen Seiten einfach nichts)
     (unverändert aus 10-cafe/script.js übernommen)
  --------------------------------------------------------- */
  var filterButtons = document.querySelectorAll(".filter-btn");
  var productCards = document.querySelectorAll(".product-card");
  var filterEmpty = document.getElementById("filterEmpty");

  filterButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      filterButtons.forEach(function (b) {
        b.classList.remove("is-active");
        b.setAttribute("aria-pressed", "false");
      });
      button.classList.add("is-active");
      button.setAttribute("aria-pressed", "true");

      var filter = button.dataset.filter;
      var visibleCount = 0;
      productCards.forEach(function (card) {
        var show = filter === "alle" || card.dataset.category === filter;
        card.hidden = !show;
        if (show) visibleCount++;
      });
      if (filterEmpty) filterEmpty.hidden = visibleCount !== 0;
    });
  });

  /* ---------------------------------------------------------
     Kontaktformular (kontakt.html)
     Struktur & Validierungslogik aus dem Vorbestellformular von
     10-cafe/script.js übernommen (gleiche Fehler-/Erfolgsmuster,
     keine echte Übertragung, event.preventDefault()).
  --------------------------------------------------------- */
  var contactForm = document.getElementById("contactForm");

  function setContactFieldError(field, message) {
    var input = document.getElementById("contact" + field);
    var errorEl = document.getElementById("contact" + field + "Error");
    if (errorEl) errorEl.textContent = message || "";
    if (input) {
      var row = input.closest(".form-row");
      if (row) row.classList.toggle("has-error", Boolean(message));
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  if (contactForm) {
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = document.getElementById("contactName").value.trim();
      var email = document.getElementById("contactEmail").value.trim();
      var msg = document.getElementById("contactMessage").value.trim();
      var status = document.getElementById("contactStatus");
      var valid = true;

      setContactFieldError("Name", "");
      setContactFieldError("Email", "");
      setContactFieldError("Message", "");

      if (name.length < 2) {
        setContactFieldError("Name", "Bitte gib deinen Namen ein.");
        valid = false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setContactFieldError("Email", "Bitte gib eine gültige E-Mail-Adresse ein.");
        valid = false;
      }
      if (msg.length < 10) {
        setContactFieldError("Message", "Deine Nachricht sollte mindestens 10 Zeichen lang sein.");
        valid = false;
      }

      if (!valid) {
        if (status) {
          status.textContent = "";
          status.className = "form-message";
        }
        return;
      }

      if (status) {
        status.textContent = "Danke, " + name + "! Deine Nachricht ist eingegangen. Wir melden uns unter " + email + " zurück.";
        status.className = "form-message is-success";
      }
      contactForm.reset();
    });
  }

  /* ---------------------------------------------------------
     Legal dialogs
     (unverändert aus 10-cafe/script.js übernommen)
  --------------------------------------------------------- */
  function wireDialog(buttonId, dialogId) {
    var button = document.getElementById(buttonId);
    var dialog = document.getElementById(dialogId);
    if (!button || !dialog) return;
    button.addEventListener("click", function () {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    });
  }
  wireDialog("openImpressum", "impressumDialog");
  wireDialog("openDatenschutz", "datenschutzDialog");

  /* ---------------------------------------------------------
     Scroll reveal via IntersectionObserver (content visible without JS)
     (unverändert aus 10-cafe/script.js übernommen)
  --------------------------------------------------------- */
  if ("IntersectionObserver" in window) {
    var revealItems = document.querySelectorAll(".reveal");
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: "0px 0px 200px 0px" }
    );
    revealItems.forEach(function (item) { observer.observe(item); });

    // Safety net: guarantee every section becomes visible even if a fast
    // programmatic scroll (or an unusual layout) causes the observer to
    // miss an element. Content must never stay permanently hidden.
    window.setTimeout(function () {
      revealItems.forEach(function (item) {
        item.classList.add("is-visible");
      });
      observer.disconnect();
    }, 2500);
  }
})();
