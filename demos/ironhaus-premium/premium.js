/* IRONHAUS Premium – seitenspezifisches JS.
   Voraussetzung: ../ironhaus-shared/data.js und ../ironhaus-shared/shared.js
   sind vor dieser Datei eingebunden. */
(function () {
  "use strict";
  var IH = window.IronhausShared;
  var DATA = window.IronhausData;
  if (!IH || !DATA) return;

  /* ==================================================================== */
  /* Kursplan – Filter + Buchung + Warteliste + simulierte Live-Kapazitaet */
  /* ==================================================================== */
  var courseList = document.getElementById("course-list");
  if (courseList) {
    var dayButtons = Array.prototype.slice.call(document.querySelectorAll(".day-btn"));
    var chipButtons = Array.prototype.slice.call(document.querySelectorAll(".chip"));
    var state = { day: 0, categories: [] };
    var liveCapacity = {}; // courseId -> { capacity, booked }

    function courseRowHTML(c, live) {
      if (!live) {
        return (
          '<span class="course-time">' + c.time + '</span>' +
          '<span><span class="course-name">' + IH.escapeHTML(c.name) + '</span><br><span class="course-coach">' + IH.escapeHTML(c.coach) + '</span></span>' +
          '<span class="course-category">' + c.category + '</span>' +
          '<span class="iw-skeleton">Auslastung wird geladen…</span>' +
          '<span></span>'
        );
      }
      var full = live.booked >= live.capacity;
      var free = live.capacity - live.booked;
      var pct = Math.min(100, Math.round((live.booked / live.capacity) * 100));
      var pillClass = full ? "iw-pill--full" : (free <= 3 ? "iw-pill--low" : "iw-pill--free");
      var pillText = full ? "Ausgebucht" : free + " frei";
      return (
        '<span class="course-time">' + c.time + '</span>' +
        '<span><span class="course-name">' + IH.escapeHTML(c.name) + '</span><br><span class="course-coach">' + IH.escapeHTML(c.coach) + '</span></span>' +
        '<span class="course-category">' + c.category + '</span>' +
        '<span class="iw-capacity"><span class="iw-pill ' + pillClass + '">' + pillText + '</span><span class="iw-capacity-track"><span class="iw-capacity-bar' + (full ? " is-full" : "") + '" style="width:' + pct + '%"></span></span></span>' +
        (full
          ? '<button type="button" class="course-wait-btn" data-course-id="' + c.id + '">Warteliste</button>'
          : '<button type="button" class="course-book-btn" data-course-id="' + c.id + '">Buchen</button>')
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
        li.dataset.courseId = c.id;
        li.innerHTML = courseRowHTML(c, liveCapacity[c.id]);
        courseList.appendChild(li);
      });
    }

    function loadCapacity() {
      // Simuliert einen asynchronen API-Aufruf pro Kurs (kuenstliche Latenz).
      DATA.courses.forEach(function (c) {
        IH.simulateRequest({ capacity: c.capacity, booked: c.booked }, 400 + Math.random() * 500).then(function (result) {
          liveCapacity[c.id] = result;
          renderCourses();
        });
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
    loadCapacity();

    /* Buchungs-/Wartelisten-Modal */
    var modal = document.getElementById("booking-modal");
    var bookingForm = document.getElementById("booking-form");
    var bookingCourseLabel = document.getElementById("booking-course-label");
    var bookingSuccess = document.getElementById("booking-success");
    var bookingSubmitBtn = document.getElementById("booking-submit-btn");
    var currentCourse = null;
    var isWaitlist = false;

    function nextDateForCourse(course) {
      var now = new Date();
      var todayIdx = (now.getDay() + 6) % 7;
      var diff = (course.day - todayIdx + 7) % 7;
      var target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff);
      var parts = course.time.split(":");
      target.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
      if (diff === 0 && target < now) target.setDate(target.getDate() + 7);
      return target;
    }

    function openModal(course, waitlist) {
      currentCourse = course;
      isWaitlist = waitlist;
      bookingCourseLabel.textContent = (waitlist ? "Warteliste: " : "") + DATA.dayShort[course.day] + " " + course.time + " Uhr – " + course.name + " (" + course.coach + ")";
      bookingSubmitBtn.textContent = waitlist ? "Auf Warteliste setzen" : "Verbindlich buchen";
      bookingForm.hidden = false;
      bookingSuccess.hidden = true;
      modal.hidden = false;
      document.getElementById("booking-name").focus();
      document.addEventListener("keydown", onModalKeydown);
    }
    function closeModal() { modal.hidden = true; document.removeEventListener("keydown", onModalKeydown); }
    function onModalKeydown(e) { if (e.key === "Escape") closeModal(); }

    if (modal) {
      courseList.addEventListener("click", function (e) {
        var bookBtn = e.target.closest(".course-book-btn");
        var waitBtn = e.target.closest(".course-wait-btn");
        var btn = bookBtn || waitBtn;
        if (!btn) return;
        var course = DATA.courses.filter(function (c) { return c.id === btn.getAttribute("data-course-id"); })[0];
        if (course) openModal(course, !!waitBtn);
      });
      modal.querySelectorAll("[data-modal-close]").forEach(function (el) { el.addEventListener("click", closeModal); });
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
          var storeKey = isWaitlist ? "ironhaus-premium-waitlist" : "ironhaus-premium-bookings";
          var list = JSON.parse(localStorage.getItem(storeKey) || "[]");
          list.push({ courseId: currentCourse.id, name: nameInput.value.trim(), email: emailInput.value.trim(), at: new Date().toISOString() });
          localStorage.setItem(storeKey, JSON.stringify(list));
        } catch (err) { /* localStorage evtl. nicht verfuegbar */ }

        bookingForm.hidden = true;
        bookingSuccess.hidden = false;
        bookingSuccess.querySelector("p").textContent = isWaitlist
          ? "Du stehst auf der Warteliste. Wird ein Platz frei, informieren wir dich sofort per E-Mail."
          : "Deine Buchung ist bestätigt! Wir freuen uns auf dich.";
        bookingSuccess.focus();

        var icsBtn = document.getElementById("booking-ics-btn");
        icsBtn.hidden = isWaitlist;
        if (!isWaitlist) {
          icsBtn.onclick = function () {
            IH.downloadICS({
              title: "IRONHAUS – " + currentCourse.name,
              description: "Kurs bei " + currentCourse.coach + " – gebucht über die IRONHAUS Website (Demo).",
              start: nextDateForCourse(currentCourse), durationMinutes: 60,
              filename: "ironhaus-" + currentCourse.id + ".ics"
            });
          };
        }
      });
    }
  }

  /* ==================================================================== */
  /* Mitgliedschaft – Monatlich/Jaehrlich                                   */
  /* ==================================================================== */
  var termButtons = Array.prototype.slice.call(document.querySelectorAll(".term-btn"));
  var priceAmounts = Array.prototype.slice.call(document.querySelectorAll(".price-amount[data-price-monthly]"));
  var termNote = document.getElementById("term-note");
  termButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var term = btn.getAttribute("data-term");
      termButtons.forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      btn.setAttribute("aria-pressed", "true");
      priceAmounts.forEach(function (el) { var price = el.getAttribute("data-price-" + term); if (price) el.textContent = price + " €"; });
      if (termNote) termNote.textContent = term === "yearly" ? "Jährliche Abrechnung, 2 Monate geschenkt. Alle Preise inkl. MwSt." : "Monatliche Abrechnung, Mindestlaufzeit 12 Monate. Alle Preise inkl. MwSt.";
    });
  });

  /* ==================================================================== */
  /* Probetraining – Datum + Uhrzeit                                        */
  /* ==================================================================== */
  var slotGrid = document.getElementById("slot-grid");
  if (slotGrid) {
    var slotDateInput = document.getElementById("trial-date");
    var isoToday = IH.todayISO();
    slotDateInput.min = isoToday;
    var allSlots = ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00"];
    var selectedSlot = null;
    var slotError = document.getElementById("trial-err-slot");

    function seedFullSlots(dateStr) {
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
        btn.type = "button"; btn.className = "slot-btn"; btn.textContent = time;
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
      document.getElementById("trial-success-summary").textContent = nameInput.value.trim() + ", " + IH.formatDateDE(slotDateInput.value) + " um " + selectedSlot + " Uhr";
      trialForm.hidden = true; trialSuccess.hidden = false; trialSuccess.focus();
      document.getElementById("trial-ics-btn").onclick = function () {
        IH.downloadICS({ title: "IRONHAUS – Probetraining", description: "Kostenloses Probetraining bei IRONHAUS (Demo-Buchung).", start: dateObj, durationMinutes: 60, filename: "ironhaus-probetraining.ics" });
      };
    });
    var trialReset = document.getElementById("trial-reset");
    if (trialReset) {
      trialReset.addEventListener("click", function () {
        trialForm.reset(); slotDateInput.min = isoToday; renderSlots();
        trialSuccess.hidden = true; trialForm.hidden = false; document.getElementById("trial-name").focus();
      });
    }
  }

  /* ==================================================================== */
  /* Kontakt – Formular + Karten-Consent                                    */
  /* ==================================================================== */
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
      contactForm.hidden = true; contactSuccess.hidden = false; contactSuccess.focus();
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

  /* ==================================================================== */
  /* Newsletter                                                             */
  /* ==================================================================== */
  var newsletterForm = document.getElementById("newsletter-form");
  if (newsletterForm) {
    var newsletterMsg = document.getElementById("newsletter-msg");
    newsletterForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var emailInput = document.getElementById("newsletter-email");
      var valid = IH.validateForm([{ input: emailInput, error: document.getElementById("newsletter-err"), required: true, email: true, requiredMessage: "Bitte gib deine E-Mail-Adresse an." }]);
      if (!valid) return;
      newsletterMsg.hidden = false;
      newsletterMsg.textContent = "Danke! Du bist für den IRONHAUS-Newsletter angemeldet (Demo, es wird keine echte E-Mail versendet).";
      newsletterForm.reset();
    });
  }

  /* ==================================================================== */
  /* Review-Widget                                                          */
  /* ==================================================================== */
  var reviewRoot = document.getElementById("review-widget");
  if (reviewRoot) {
    function starString(rating) { return "★★★★★☆☆☆☆☆".slice(5 - rating, 10 - rating); }
    var avg = DATA.reviews.reduce(function (sum, r) { return sum + r.rating; }, 0) / DATA.reviews.length;
    reviewRoot.querySelector(".review-avg").textContent = avg.toFixed(1);
    reviewRoot.querySelector(".review-stars").textContent = starString(Math.round(avg));
    reviewRoot.querySelector(".review-count").textContent = DATA.reviews.length + " Bewertungen (Demo)";
    var grid = reviewRoot.querySelector(".review-grid");
    DATA.reviews.forEach(function (r) {
      var card = document.createElement("article");
      card.className = "review-card";
      card.innerHTML = '<span class="review-stars">' + starString(r.rating) + '</span>' + "<p>„" + IH.escapeHTML(r.text) + "“</p>" + "<footer>" + IH.escapeHTML(r.name) + ", Mitglied seit " + r.since + "</footer>";
      grid.appendChild(card);
    });
  }

  /* ==================================================================== */
  /* Live-Auslastung (simulierte API, aktualisiert periodisch)              */
  /* ==================================================================== */
  var occupancyRoot = document.getElementById("occupancy-widget");
  if (occupancyRoot) {
    var occValue = occupancyRoot.querySelector(".occupancy-value");
    var occFill = occupancyRoot.querySelector(".occupancy-fill");
    var occMeta = occupancyRoot.querySelector(".occupancy-meta");
    function fetchOccupancy() {
      var simulated = 25 + Math.round(Math.random() * 55);
      IH.simulateRequest(simulated, 500).then(function (pct) {
        occValue.textContent = pct + " %";
        occFill.style.width = pct + "%";
        occMeta.textContent = "Zuletzt aktualisiert: " + new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) + " Uhr (Demo-Daten)";
      });
    }
    fetchOccupancy();
    var occInterval = window.setInterval(fetchOccupancy, 20000);
    window.addEventListener("beforeunload", function () { window.clearInterval(occInterval); });
  }

  /* ==================================================================== */
  /* Mitglieder-Login + Dashboard (Demo via localStorage)                   */
  /* ==================================================================== */
  var loginForm = document.getElementById("member-login-form");
  var dashboard = document.getElementById("member-dashboard");
  var loginBox = document.getElementById("member-login-box");

  function getMember() {
    try { return JSON.parse(localStorage.getItem("ironhaus-premium-member") || "null"); } catch (e) { return null; }
  }

  function renderDashboard(member) {
    if (!loginBox || !dashboard) return;
    loginBox.hidden = true;
    dashboard.hidden = false;
    document.getElementById("member-email-display").textContent = member.email;

    var bookings = [];
    try { bookings = JSON.parse(localStorage.getItem("ironhaus-premium-bookings") || "[]"); } catch (e) { bookings = []; }
    var bookedList = document.getElementById("member-bookings");
    bookedList.innerHTML = "";
    if (bookings.length === 0) {
      bookedList.innerHTML = '<li class="course-empty">Noch keine Kurse gebucht – schau im <a href="kursplan.html">Kursplan</a> vorbei.</li>';
    } else {
      bookings.slice(-5).reverse().forEach(function (b) {
        var course = DATA.courses.filter(function (c) { return c.id === b.courseId; })[0];
        var li = document.createElement("li");
        li.className = "course-row";
        li.innerHTML = '<span class="course-time">' + (course ? course.time : "–") + '</span><span><span class="course-name">' + (course ? IH.escapeHTML(course.name) : "Kurs") + '</span><br><span class="course-coach">gebucht am ' + IH.escapeHTML(IH.formatDateDE(String(b.at).slice(0, 10))) + '</span></span><span class="course-category">' + (course ? course.category : "") + '</span>';
        bookedList.appendChild(li);
      });
    }

    // Check-in-Verlauf (statische Demo-Daten)
    var checkins = [
      { date: "2026-09-22", time: "18:04", duration: "72 min" },
      { date: "2026-09-19", time: "07:12", duration: "58 min" },
      { date: "2026-09-17", time: "17:41", duration: "80 min" },
      { date: "2026-09-15", time: "06:35", duration: "65 min" }
    ];
    var checkinBody = document.getElementById("checkin-body");
    checkinBody.innerHTML = checkins.map(function (c) {
      return "<tr><td>" + IH.formatDateDE(c.date) + "</td><td>" + c.time + " Uhr</td><td>" + c.duration + "</td></tr>";
    }).join("");

    // Rechnungen (Demo-Download als Textdatei)
    var invoices = [
      { id: "RE-2026-09", date: "2026-09-01", amount: 44.90 },
      { id: "RE-2026-08", date: "2026-08-01", amount: 44.90 },
      { id: "RE-2026-07", date: "2026-07-01", amount: 44.90 }
    ];
    var invoiceBody = document.getElementById("invoice-body");
    invoiceBody.innerHTML = invoices.map(function (inv) {
      return "<tr><td>" + inv.id + "</td><td>" + IH.formatDateDE(inv.date) + "</td><td>" + IH.formatEUR(inv.amount) + "</td><td><button type=\"button\" class=\"invoice-download\" data-id=\"" + inv.id + "\" data-amount=\"" + inv.amount + "\" data-date=\"" + inv.date + "\">Herunterladen</button></td></tr>";
    }).join("");
    invoiceBody.querySelectorAll(".invoice-download").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var text = "IRONHAUS Trainingshalle GmbH\nRechnung " + btn.dataset.id + "\nDatum: " + IH.formatDateDE(btn.dataset.date) +
          "\nBetrag: " + IH.formatEUR(parseFloat(btn.dataset.amount)) + "\n\nDies ist eine Demo-Rechnung ohne echten Zahlungsbezug.";
        IH.downloadTextFile(btn.dataset.id + ".txt", text);
      });
    });

    // Trainingsstatistik als einfaches SVG-Balkendiagramm
    var chartData = [4, 6, 5, 7, 8, 6, 9, 8];
    var chartSvg = document.getElementById("training-chart");
    if (chartSvg) {
      var barWidth = 30, gap = 14, max = Math.max.apply(null, chartData);
      var svgWidth = chartData.length * (barWidth + gap);
      chartSvg.setAttribute("viewBox", "0 0 " + svgWidth + " 120");
      var bars = chartData.map(function (v, i) {
        var h = Math.round((v / max) * 90);
        var x = i * (barWidth + gap);
        var y = 100 - h;
        return '<rect x="' + x + '" y="' + y + '" width="' + barWidth + '" height="' + h + '" fill="#ffd400" rx="2"></rect>' +
          '<text x="' + (x + barWidth / 2) + '" y="114" font-size="11" fill="#b7bac0" text-anchor="middle">W' + (i + 1) + '</text>';
      }).join("");
      chartSvg.innerHTML = bars;
      chartSvg.setAttribute("role", "img");
      chartSvg.setAttribute("aria-label", "Trainingseinheiten pro Woche der letzten 8 Wochen, zwischen " + Math.min.apply(null, chartData) + " und " + max + " Einheiten.");
    }

    // Wearable-Sync Demo
    var syncToggle = document.getElementById("sync-toggle");
    var syncStatus = document.getElementById("sync-status");
    if (syncToggle && syncStatus) {
      syncToggle.addEventListener("change", function () {
        if (syncToggle.checked) {
          syncStatus.textContent = "Verbinde…";
          syncStatus.dataset.status = "connecting";
          syncToggle.disabled = true;
          IH.simulateRequest(true, 900).then(function () {
            syncStatus.textContent = "Verbunden mit Garmin/Apple Health (Demo)";
            syncStatus.dataset.status = "connected";
            syncToggle.disabled = false;
          });
        } else {
          syncStatus.textContent = "Nicht verbunden";
          syncStatus.dataset.status = "disconnected";
        }
      });
    }

    var logoutBtn = document.getElementById("member-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function () {
        localStorage.removeItem("ironhaus-premium-member");
        dashboard.hidden = true;
        loginBox.hidden = false;
        document.getElementById("member-login-email").focus();
      });
    }
  }

  if (loginForm) {
    var existingMember = getMember();
    if (existingMember) renderDashboard(existingMember);

    loginForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var emailInput = document.getElementById("member-login-email");
      var passInput = document.getElementById("member-login-password");
      var valid = IH.validateForm([
        { input: emailInput, error: document.getElementById("member-login-err-email"), required: true, email: true, requiredMessage: "Bitte gib deine E-Mail-Adresse an." },
        { input: passInput, error: document.getElementById("member-login-err-password"), required: true, requiredMessage: "Bitte gib dein Passwort ein." }
      ]);
      if (!valid) return;
      var member = { email: emailInput.value.trim() };
      try { localStorage.setItem("ironhaus-premium-member", JSON.stringify(member)); } catch (err) { /* ignore */ }
      renderDashboard(member);
    });
  }

  /* ==================================================================== */
  /* Shop – Produkte, Warenkorb, Checkout (Demo, localStorage)              */
  /* ==================================================================== */
  var productGrid = document.getElementById("product-grid");
  var refreshCartUI = null; // wird gesetzt, sobald die Warenkorb-Sektion auf der Seite existiert
  function getCart() {
    var raw;
    try { raw = JSON.parse(localStorage.getItem("ironhaus-premium-cart") || "[]"); } catch (e) { return []; }
    if (!Array.isArray(raw)) return [];
    // Nur bekannte Produkte, ganzzahlige Mengen 1..99 (manipulierter localStorage ergäbe sonst negative oder NaN-Summen)
    var clean = [];
    raw.forEach(function (i) {
      if (!i || !DATA.products.some(function (p) { return p.id === i.id; })) return;
      var q = Math.floor(Number(i.qty));
      if (!isFinite(q) || q < 1) return;
      clean.push({ id: i.id, qty: Math.min(99, q) });
    });
    return clean;
  }
  function saveCart(cart) {
    try { localStorage.setItem("ironhaus-premium-cart", JSON.stringify(cart)); } catch (e) { /* ignore */ }
    updateCartCount();
    if (refreshCartUI) refreshCartUI();
  }
  function updateCartCount() {
    var countEl = document.getElementById("cart-count");
    var countElMobile = document.getElementById("cart-count-mobile");
    if (!countEl && !countElMobile) return;
    var cart = getCart();
    var total = cart.reduce(function (sum, i) { return sum + i.qty; }, 0);
    if (countEl) countEl.textContent = String(total);
    if (countElMobile) countElMobile.textContent = String(total);
  }
  updateCartCount();

  if (productGrid) {
    productGrid.innerHTML = DATA.products.map(function (p) {
      return '<article class="product-card">' +
        '<img src="' + p.img + '" width="500" height="500" loading="lazy" alt="' + IH.escapeHTML(p.name) + '">' +
        '<p class="product-cat">' + p.category + '</p>' +
        '<h3>' + IH.escapeHTML(p.name) + '</h3>' +
        '<p style="font-size:0.85rem; color:#5a5d63; margin:0;">' + IH.escapeHTML(p.desc) + '</p>' +
        '<p class="product-price">' + IH.formatEUR(p.price) + '</p>' +
        '<button type="button" class="add-cart-btn" data-product-id="' + p.id + '">In den Warenkorb</button>' +
        '</article>';
    }).join("");

    productGrid.addEventListener("click", function (e) {
      var btn = e.target.closest(".add-cart-btn");
      if (!btn) return;
      var cart = getCart();
      var existing = cart.filter(function (i) { return i.id === btn.dataset.productId; })[0];
      if (existing) { existing.qty = Math.min(99, existing.qty + 1); } else { cart.push({ id: btn.dataset.productId, qty: 1 }); }
      saveCart(cart);
      var original = btn.textContent;
      btn.textContent = "Hinzugefügt ✓";
      window.setTimeout(function () { btn.textContent = original; }, 1200);
    });
  }

  var cartRoot = document.getElementById("cart-items");
  if (cartRoot) {
    refreshCartUI = renderCart;
    function renderCart() {
      var cart = getCart();
      var totalEl = document.getElementById("cart-total-amount");
      if (cart.length === 0) {
        cartRoot.innerHTML = '<p class="empty-cart">Dein Warenkorb ist leer. <a href="shop.html">Jetzt einkaufen</a></p>';
        if (totalEl) totalEl.textContent = IH.formatEUR(0);
        var checkoutForm = document.getElementById("checkout-form");
        if (checkoutForm) checkoutForm.hidden = true;
        return;
      }
      var total = 0;
      cartRoot.innerHTML = cart.map(function (item) {
        var product = DATA.products.filter(function (p) { return p.id === item.id; })[0];
        if (!product) return "";
        var lineTotal = product.price * item.qty;
        total += lineTotal;
        return '<div class="cart-item">' +
          '<span>' + IH.escapeHTML(product.name) + '</span>' +
          '<span class="cart-item-qty"><button type="button" data-qty-minus="' + IH.escapeHTML(item.id) + '" aria-label="Menge verringern">−</button>' + IH.escapeHTML(item.qty) + '<button type="button" data-qty-plus="' + IH.escapeHTML(item.id) + '" aria-label="Menge erhöhen">+</button></span>' +
          '<span>' + IH.formatEUR(lineTotal) + ' <button type="button" class="cart-remove" data-remove="' + IH.escapeHTML(item.id) + '">Entfernen</button></span>' +
          '</div>';
      }).join("");
      if (totalEl) totalEl.textContent = IH.formatEUR(total);
      var checkoutForm2 = document.getElementById("checkout-form");
      if (checkoutForm2) checkoutForm2.hidden = false;
    }
    renderCart();

    cartRoot.addEventListener("click", function (e) {
      var cart = getCart();
      var plusId = e.target.getAttribute("data-qty-plus");
      var minusId = e.target.getAttribute("data-qty-minus");
      var removeId = e.target.getAttribute("data-remove");
      if (plusId) { var plusItem = cart.filter(function (i) { return i.id === plusId; })[0]; if (plusItem) plusItem.qty = Math.min(99, plusItem.qty + 1); }
      if (minusId) {
        var item = cart.filter(function (i) { return i.id === minusId; })[0];
        if (item) item.qty -= 1;
        if (item && item.qty <= 0) cart = cart.filter(function (i) { return i.id !== minusId; });
      }
      if (removeId) cart = cart.filter(function (i) { return i.id !== removeId; });
      if (plusId || minusId || removeId) { saveCart(cart); renderCart(); }
    });

    var checkoutForm = document.getElementById("checkout-form");
    var orderConfirmation = document.getElementById("order-confirmation");
    if (checkoutForm) {
      checkoutForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var valid = IH.validateForm([
          { input: document.getElementById("checkout-name"), error: document.getElementById("checkout-err-name"), required: true, requiredMessage: "Bitte gib deinen Namen an." },
          { input: document.getElementById("checkout-email"), error: document.getElementById("checkout-err-email"), required: true, email: true, requiredMessage: "Bitte gib deine E-Mail-Adresse an." }
        ]);
        if (!valid) return;
        var orderId = "IH-" + Math.floor(100000 + Math.random() * 900000);
        var payment = checkoutForm.querySelector('input[name="payment"]:checked');
        document.getElementById("order-id").textContent = orderId;
        document.getElementById("order-payment").textContent = payment ? payment.parentElement.textContent.trim() : "–";
        saveCart([]);
        renderCart();
        checkoutForm.hidden = true;
        document.getElementById("cart-items").hidden = true;
        document.querySelector(".cart-total").hidden = true;
        orderConfirmation.hidden = false;
        orderConfirmation.focus();
      });
    }
  }

  /* ==================================================================== */
  /* Cookie-Consent mit Kategorien                                          */
  /* ==================================================================== */
  var cookieBanner = document.getElementById("cookie-banner");
  if (cookieBanner) {
    // Verhindert, dass das fixe Banner Inhalte/Buttons am Seitenende verdeckt
    // und damit unklickbar macht (wichtig z.B. fuer das Login-Formular).
    function reserveSpaceForBanner() {
      if (cookieBanner.hidden) { document.body.style.paddingBottom = ""; return; }
      document.body.style.paddingBottom = cookieBanner.offsetHeight + "px";
    }
    function getConsent() {
      try { return JSON.parse(localStorage.getItem("ironhaus-premium-cookie-consent") || "null"); } catch (e) { return null; }
    }
    function setConsent(consent) {
      try { localStorage.setItem("ironhaus-premium-cookie-consent", JSON.stringify(consent)); } catch (e) { /* ignore */ }
      cookieBanner.hidden = true;
      reserveSpaceForBanner();
    }
    if (!getConsent()) { cookieBanner.hidden = false; reserveSpaceForBanner(); }
    window.addEventListener("resize", reserveSpaceForBanner);

    var acceptAllBtn = document.getElementById("cookie-accept-all");
    var rejectBtn = document.getElementById("cookie-reject");
    var saveBtn = document.getElementById("cookie-save");
    var statsCheckbox = document.getElementById("cookie-stats");
    var marketingCheckbox = document.getElementById("cookie-marketing");

    if (acceptAllBtn) acceptAllBtn.addEventListener("click", function () {
      statsCheckbox.checked = true; marketingCheckbox.checked = true;
      setConsent({ necessary: true, stats: true, marketing: true, at: new Date().toISOString() });
    });
    if (rejectBtn) rejectBtn.addEventListener("click", function () {
      statsCheckbox.checked = false; marketingCheckbox.checked = false;
      setConsent({ necessary: true, stats: false, marketing: false, at: new Date().toISOString() });
    });
    if (saveBtn) saveBtn.addEventListener("click", function () {
      setConsent({ necessary: true, stats: statsCheckbox.checked, marketing: marketingCheckbox.checked, at: new Date().toISOString() });
    });
  }

  /* ==================================================================== */
  /* Priority-Support Chat-Widget                                           */
  /* ==================================================================== */
  var chatToggle = document.getElementById("chat-toggle");
  var chatPanel = document.getElementById("chat-panel");
  if (chatToggle && chatPanel) {
    var chatBody = document.getElementById("chat-body");
    function addMessage(text, from) {
      var msg = document.createElement("div");
      msg.className = "iw-chat-msg iw-chat-msg--" + from;
      msg.textContent = text;
      chatBody.appendChild(msg);
      chatBody.scrollTop = chatBody.scrollHeight;
    }
    chatToggle.addEventListener("click", function () {
      var open = !chatPanel.hidden;
      chatPanel.hidden = open;
      chatToggle.setAttribute("aria-expanded", String(!open));
      if (!open) document.getElementById("chat-close").focus();
    });
    var chatClose = document.getElementById("chat-close");
    if (chatClose) chatClose.addEventListener("click", function () {
      chatPanel.hidden = true; chatToggle.setAttribute("aria-expanded", "false"); chatToggle.focus();
    });
    document.querySelectorAll(".iw-chat-quick button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        addMessage(btn.textContent, "user");
        window.setTimeout(function () {
          addMessage("Danke für deine Nachricht! Unser Support-Team (Priority Support) antwortet dir hier in der Demo automatisch – in echt meldet sich ein Coach innerhalb weniger Minuten.", "bot");
        }, 500);
      });
    });
  }
})();
