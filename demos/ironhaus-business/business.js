/* IRONHAUS Business – seitenspezifisches JS.
   Voraussetzung: ../ironhaus-shared/data.js und ../ironhaus-shared/shared.js
   sind vor dieser Datei eingebunden. */
(function () {
  "use strict";
  var IH = window.IronhausShared;
  var DATA = window.IronhausData;
  if (!IH || !DATA) return;

  /* ------------------------------------------------------------------ */
  /* Kursplan – Filter + Buchung                                        */
  /* ------------------------------------------------------------------ */
  var courseList = document.getElementById("course-list");
  if (courseList) {
    var dayButtons = Array.prototype.slice.call(document.querySelectorAll(".day-btn"));
    var chipButtons = Array.prototype.slice.call(document.querySelectorAll(".chip"));
    var state = { day: 0, categories: [] };

    function courseRowHTML(c) {
      var full = c.booked >= c.capacity;
      var free = c.capacity - c.booked;
      var pillClass = full ? "iw-pill--full" : (free <= 3 ? "iw-pill--low" : "iw-pill--free");
      var pillText = full ? "Ausgebucht" : free + " Plätze frei";
      return (
        '<span class="course-time">' + c.time + '</span>' +
        '<span><span class="course-name">' + IH.escapeHTML(c.name) + '</span><br><span class="course-coach">' + IH.escapeHTML(c.coach) + '</span></span>' +
        '<span class="course-category">' + c.category + '</span>' +
        '<span class="iw-pill ' + pillClass + '">' + pillText + '</span>' +
        '<button type="button" class="course-book-btn" data-course-id="' + c.id + '" ' + (full ? "disabled" : "") + '>' + (full ? "Ausgebucht" : "Buchen") + '</button>'
      );
    }

    function renderCourses() {
      var filtered = DATA.courses.filter(function (c) {
        var dayMatches = c.day === state.day;
        var categoryMatches = state.categories.length === 0 || state.categories.indexOf(c.category) !== -1;
        return dayMatches && categoryMatches;
      }).sort(function (a, b) { return a.time.localeCompare(b.time); });

      courseList.innerHTML = "";
      if (filtered.length === 0) {
        var empty = document.createElement("li");
        empty.className = "course-empty";
        empty.textContent = "Keine Kurse gefunden für diese Auswahl.";
        courseList.appendChild(empty);
        return;
      }
      filtered.forEach(function (c) {
        var li = document.createElement("li");
        li.className = "course-row";
        li.innerHTML = courseRowHTML(c);
        courseList.appendChild(li);
      });
    }

    dayButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        dayButtons.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
        btn.setAttribute("aria-pressed", "true");
        state.day = parseInt(btn.getAttribute("data-day"), 10);
        renderCourses();
      });
    });
    chipButtons.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var category = chip.getAttribute("data-category");
        var pressed = chip.getAttribute("aria-pressed") === "true";
        chip.setAttribute("aria-pressed", pressed ? "false" : "true");
        if (pressed) { state.categories = state.categories.filter(function (c) { return c !== category; }); }
        else { state.categories.push(category); }
        renderCourses();
      });
    });
    renderCourses();

    /* Buchungsmodal */
    var modal = document.getElementById("booking-modal");
    var bookingForm = document.getElementById("booking-form");
    var bookingCourseLabel = document.getElementById("booking-course-label");
    var bookingSuccess = document.getElementById("booking-success");
    var currentCourse = null;

    function nextDateForCourse(course) {
      var now = new Date();
      var todayIdx = (now.getDay() + 6) % 7; // Montag = 0
      var diff = (course.day - todayIdx + 7) % 7;
      var target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      var parts = course.time.split(":");
      target.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      if (diff === 0 && target < now) target.setDate(target.getDate() + 7);
      return target;
    }

    function openModal(course) {
      currentCourse = course;
      bookingCourseLabel.textContent = DATA.dayShort[course.day] + " " + course.time + " Uhr – " + course.name + " (" + course.coach + ")";
      bookingForm.hidden = false;
      bookingSuccess.hidden = true;
      modal.hidden = false;
      document.getElementById("booking-name").focus();
      document.addEventListener("keydown", onModalKeydown);
    }
    function closeModal() {
      modal.hidden = true;
      document.removeEventListener("keydown", onModalKeydown);
    }
    function onModalKeydown(e) { if (e.key === "Escape") closeModal(); }

    if (modal) {
      courseList.addEventListener("click", function (e) {
        var btn = e.target.closest(".course-book-btn");
        if (!btn || btn.disabled) return;
        var course = DATA.courses.filter(function (c) { return c.id === btn.getAttribute("data-course-id"); })[0];
        if (course) openModal(course);
      });
      modal.querySelectorAll("[data-modal-close]").forEach(function (el) {
        el.addEventListener("click", closeModal);
      });
      bookingForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var nameInput = document.getElementById("booking-name");
        var emailInput = document.getElementById("booking-email");
        var valid = IH.validateForm([
          { input: nameInput, error: document.getElementById("booking-err-name"), required: true, requiredMessage: "Bitte gib deinen Namen an." },
          { input: emailInput, error: document.getElementById("booking-err-email"), required: true, email: true, requiredMessage: "Bitte gib deine E-Mail-Adresse an." }
        ]);
        if (!valid) return;

        try {
          var bookings = JSON.parse(localStorage.getItem("ironhaus-business-bookings") || "[]");
          bookings.push({ courseId: currentCourse.id, name: nameInput.value.trim(), email: emailInput.value.trim(), bookedAt: new Date().toISOString() });
          localStorage.setItem("ironhaus-business-bookings", JSON.stringify(bookings));
        } catch (err) { /* localStorage evtl. nicht verfügbar – Buchung trotzdem bestätigen */ }

        bookingForm.hidden = true;
        bookingSuccess.hidden = false;
        bookingSuccess.focus();

        var icsBtn = document.getElementById("booking-ics-btn");
        icsBtn.onclick = function () {
          IH.downloadICS({
            title: "IRONHAUS – " + currentCourse.name,
            description: "Kurs bei " + currentCourse.coach + " – gebucht über die IRONHAUS Website (Demo).",
            start: nextDateForCourse(currentCourse),
            durationMinutes: 60,
            filename: "ironhaus-" + currentCourse.id + ".ics"
          });
        };
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Mitgliedschaft – Monatlich / Jährlich                               */
  /* ------------------------------------------------------------------ */
  var termButtons = Array.prototype.slice.call(document.querySelectorAll(".term-btn"));
  var priceAmounts = Array.prototype.slice.call(document.querySelectorAll(".price-amount[data-price-monthly]"));
  var termNote = document.getElementById("term-note");
  termButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var term = btn.getAttribute("data-term");
      termButtons.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      priceAmounts.forEach(function (el) {
        var price = el.getAttribute("data-price-" + term);
        if (price) el.textContent = price + " €";
      });
      if (termNote) {
        termNote.textContent = term === "yearly"
          ? "Jährliche Abrechnung, 2 Monate geschenkt. Alle Preise inkl. MwSt."
          : "Monatliche Abrechnung, Mindestlaufzeit 12 Monate. Alle Preise inkl. MwSt.";
      }
    });
  });

  /* ------------------------------------------------------------------ */
  /* Probetraining – Datum + Uhrzeit-Auswahl                              */
  /* ------------------------------------------------------------------ */
  var slotGrid = document.getElementById("slot-grid");
  if (slotGrid) {
    var slotDateInput = document.getElementById("trial-date");
    var isoToday = IH.todayISO();
    slotDateInput.min = isoToday;
    var allSlots = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"];
    var selectedSlot = null;
    var slotError = document.getElementById("trial-err-slot");

    function seedFullSlots(dateStr) {
      // Deterministische Demo-Auslastung je nach Datum (kein echtes Backend).
      var sum = dateStr.split("").reduce(function (a, c) { return a + c.charCodeAt(0); }, 0);
      return allSlots.filter(function (_, i) { return (sum + i) % 5 === 0; });
    }

    function renderSlots() {
      var dateVal = slotDateInput.value || isoToday;
      var fullSlots = seedFullSlots(dateVal);
      slotGrid.innerHTML = "";
      selectedSlot = null;
      allSlots.forEach(function (time) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot-btn";
        btn.textContent = time;
        btn.setAttribute("aria-pressed", "false");
        if (fullSlots.indexOf(time) !== -1) { btn.disabled = true; btn.title = "Ausgebucht"; }
        btn.addEventListener("click", function () {
          slotGrid.querySelectorAll(".slot-btn").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
          btn.setAttribute("aria-pressed", "true");
          selectedSlot = time;
          if (slotError) slotError.textContent = "";
        });
        slotGrid.appendChild(btn);
      });
    }
    slotDateInput.addEventListener("change", renderSlots);
    renderSlots();

    var trialForm = document.getElementById("trial-form");
    var trialSuccess = document.getElementById("trial-success");
    trialForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var nameInput = document.getElementById("trial-name");
      var emailInput = document.getElementById("trial-email");
      var valid = IH.validateForm([
        { input: nameInput, error: document.getElementById("trial-err-name"), required: true, requiredMessage: "Bitte gib deinen Namen an." },
        { input: emailInput, error: document.getElementById("trial-err-email"), required: true, email: true, requiredMessage: "Bitte gib deine E-Mail-Adresse an." },
        { input: slotDateInput, error: document.getElementById("trial-err-date"), required: true, minDate: isoToday, requiredMessage: "Bitte wähle ein Datum.", minDateMessage: "Das Datum darf nicht in der Vergangenheit liegen." }
      ]);
      if (!selectedSlot) { slotError.textContent = "Bitte wähle eine Uhrzeit."; valid = false; }
      if (!valid) return;

      var dateObj = new Date(slotDateInput.value + "T" + selectedSlot + ":00");
      document.getElementById("trial-success-summary").textContent =
        nameInput.value.trim() + ", " + IH.formatDateDE(slotDateInput.value) + " um " + selectedSlot + " Uhr";
      trialForm.hidden = true;
      trialSuccess.hidden = false;
      trialSuccess.focus();
      document.getElementById("trial-ics-btn").onclick = function () {
        IH.downloadICS({
          title: "IRONHAUS – Probetraining",
          description: "Kostenloses Probetraining bei IRONHAUS (Demo-Buchung).",
          start: dateObj,
          durationMinutes: 60,
          filename: "ironhaus-probetraining.ics"
        });
      };
    });
    var trialReset = document.getElementById("trial-reset");
    if (trialReset) {
      trialReset.addEventListener("click", function () {
        trialForm.reset();
        slotDateInput.min = isoToday;
        renderSlots();
        trialSuccess.hidden = true;
        trialForm.hidden = false;
        document.getElementById("trial-name").focus();
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /* Kontakt – Formular + Karten-Consent                                  */
  /* ------------------------------------------------------------------ */
  var contactForm = document.getElementById("contact-form");
  if (contactForm) {
    var contactSuccess = document.getElementById("contact-success");
    contactForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var valid = IH.validateForm([
        { input: document.getElementById("contact-name"), error: document.getElementById("contact-err-name"), required: true, requiredMessage: "Bitte gib deinen Namen an." },
        { input: document.getElementById("contact-email"), error: document.getElementById("contact-err-email"), required: true, email: true, requiredMessage: "Bitte gib deine E-Mail-Adresse an." },
        { input: document.getElementById("contact-message"), error: document.getElementById("contact-err-message"), required: true, requiredMessage: "Bitte gib eine Nachricht ein." }
      ]);
      if (!valid) return;
      contactForm.hidden = true;
      contactSuccess.hidden = false;
      contactSuccess.focus();
    });
  }
  var mapConsent = document.getElementById("map-consent");
  if (mapConsent) {
    var mapPlaceholder = document.getElementById("map-placeholder");
    mapConsent.addEventListener("change", function () {
      mapPlaceholder.hidden = !mapConsent.checked;
      if (mapConsent.checked) mapPlaceholder.textContent = "Kartenausschnitt geladen (Demo – es werden keine externen Kartendaten nachgeladen).";
    });
  }

  /* ------------------------------------------------------------------ */
  /* Newsletter (Demo)                                                    */
  /* ------------------------------------------------------------------ */
  var newsletterForm = document.getElementById("newsletter-form");
  if (newsletterForm) {
    var newsletterMsg = document.getElementById("newsletter-msg");
    newsletterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var emailInput = document.getElementById("newsletter-email");
      var valid = IH.validateForm([
        { input: emailInput, error: document.getElementById("newsletter-err"), required: true, email: true, requiredMessage: "Bitte gib deine E-Mail-Adresse an." }
      ]);
      if (!valid) return;
      newsletterMsg.hidden = false;
      newsletterMsg.textContent = "Danke! Du bist für den IRONHAUS-Newsletter angemeldet (Demo, es wird keine echte E-Mail versendet).";
      newsletterForm.reset();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Review-Widget                                                        */
  /* ------------------------------------------------------------------ */
  var reviewRoot = document.getElementById("review-widget");
  if (reviewRoot) {
    function starString(rating) {
      return "★★★★★☆☆☆☆☆".slice(5 - rating, 10 - rating);
    }
    var avg = DATA.reviews.reduce(function (sum, r) { return sum + r.rating; }, 0) / DATA.reviews.length;
    reviewRoot.querySelector(".review-avg").textContent = avg.toFixed(1);
    reviewRoot.querySelector(".review-stars").textContent = starString(Math.round(avg));
    reviewRoot.querySelector(".review-count").textContent = DATA.reviews.length + " Bewertungen (Demo)";
    var grid = reviewRoot.querySelector(".review-grid");
    DATA.reviews.forEach(function (r) {
      var card = document.createElement("article");
      card.className = "review-card";
      card.innerHTML =
        '<span class="review-stars">' + starString(r.rating) + '</span>' +
        "<p>„" + IH.escapeHTML(r.text) + "“</p>" +
        "<footer>" + IH.escapeHTML(r.name) + ", Mitglied seit " + r.since + "</footer>";
      grid.appendChild(card);
    });
  }
})();
