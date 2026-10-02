/* =========================================================
   Café Pistazie — Paket Business
   Seiteneigene Logik: Tischreservierung, Torten-Vorbestellung,
   Events-Kalender, Karten-Einwilligung. Nutzt window.PistazieShared
   (Kalender-Renderer, .ics-Export, Utilities) sowie die
   unveränderte Basislogik aus ../demo-basic/script.js
   (Menü, Öffnungszeiten-Pill, Kontaktformular, Dialoge, Filter).
   ========================================================= */
(function () {
  "use strict";
  var S = window.PistazieShared;
  if (!S) return;

  S.renderReviews("reviews");
  S.wireNewsletter("newsletter-form");

  var HOURS = {
    1: { open: 8 * 60, close: 19 * 60 }, // Montag
    2: { open: 8 * 60, close: 19 * 60 },
    3: { open: 8 * 60, close: 19 * 60 },
    4: { open: 8 * 60, close: 19 * 60 },
    5: { open: 8 * 60, close: 19 * 60 },
    6: { open: 9 * 60, close: 19 * 60 }, // Samstag
    0: { open: 9 * 60, close: 17 * 60 }  // Sonntag
  };

  /* ---------------------------------------------------------
     Tischreservierung (reservieren.html)
     --------------------------------------------------------- */
  var bookingTool = document.getElementById("bookingTool");
  if (bookingTool) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    var state = { viewYear: today.getFullYear(), viewMonth: today.getMonth(), date: null, time: null, guests: 2 };

    var calGrid = document.getElementById("rvCalGrid");
    var calLabel = document.getElementById("rvCalLabel");
    var calPrev = document.getElementById("rvCalPrev");
    var calNext = document.getElementById("rvCalNext");
    var dateReadout = document.getElementById("rvDateReadout");
    var slotGroup = document.getElementById("rvSlotGroup");
    var guestCount = document.getElementById("rvGuestCount");
    var guestMinus = document.getElementById("rvGuestMinus");
    var guestPlus = document.getElementById("rvGuestPlus");
    var guestHint = document.getElementById("rvGuestHint");

    var steps = Array.prototype.slice.call(bookingTool.querySelectorAll(".tool-step"));
    var stepperItems = Array.prototype.slice.call(bookingTool.querySelectorAll(".stepper li"));

    function goToStep(n) {
      steps.forEach(function (s) { s.hidden = Number(s.getAttribute("data-step")) !== n; });
      stepperItems.forEach(function (li) {
        var num = Number(li.getAttribute("data-step"));
        li.removeAttribute("aria-current");
        li.removeAttribute("data-done");
        if (num === n) li.setAttribute("aria-current", "step");
        else if (num < n) li.setAttribute("data-done", "true");
      });
      var heading = steps[n - 1] && steps[n - 1].querySelector("h2");
      if (heading) { heading.setAttribute("tabindex", "-1"); heading.focus(); }
    }

    function dayIsFullyBooked(date) {
      return S.isBlockedDate(date);
    }

    function slotsForDate(date) {
      var hours = HOURS[date.getDay()];
      if (!hours) return [];
      var slots = [];
      for (var m = hours.open; m <= hours.close - 60; m += 30) {
        var h = Math.floor(m / 60), min = m % 60;
        slots.push((h < 10 ? "0" : "") + h + ":" + (min === 0 ? "00" : min));
      }
      return slots;
    }

    function slotBlocked(date, slot) {
      // Deterministisches Demo-Muster: jeder dritte Slot ab Tagesindex ist "belegt".
      var idx = slotsForDate(date).indexOf(slot);
      return (idx + date.getDate()) % 3 === 0;
    }

    function renderCalendar() {
      calLabel.textContent = S.monthLabel(state.viewYear, state.viewMonth);
      var isCurrentMonth = state.viewYear === today.getFullYear() && state.viewMonth === today.getMonth();
      calPrev.disabled = isCurrentMonth;

      S.renderCalendarGrid(calGrid, state.viewYear, state.viewMonth, function (btn, date) {
        btn.setAttribute("aria-label", S.formatDateDE(date));
        if (date < today || dayIsFullyBooked(date)) {
          btn.disabled = true;
          btn.classList.add("calendar__day--unavailable");
        } else {
          btn.addEventListener("click", function () { onDayClick(date); });
        }
        if (S.sameDay(date, today)) btn.classList.add("calendar__day--today");
        if (S.sameDay(date, state.date)) {
          btn.classList.add("calendar__day--selected");
          btn.setAttribute("aria-pressed", "true");
        }
      });
      updateNextEnabled();
    }

    function onDayClick(date) {
      state.date = date;
      state.time = null;
      renderCalendar();
      renderSlots();
    }

    function renderSlots() {
      if (!state.date) {
        dateReadout.textContent = "Bitte zuerst ein Datum wählen.";
        slotGroup.innerHTML = "";
        return;
      }
      dateReadout.textContent = "Gewähltes Datum: " + S.formatDateDE(state.date);
      var slots = slotsForDate(state.date);
      slotGroup.innerHTML = "";
      slots.forEach(function (slot) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot-chip";
        btn.textContent = slot;
        var blocked = slotBlocked(state.date, slot);
        if (blocked) {
          btn.disabled = true;
        } else {
          btn.setAttribute("aria-pressed", state.time === slot ? "true" : "false");
          btn.addEventListener("click", function () {
            state.time = slot;
            renderSlots();
            updateNextEnabled();
          });
        }
        slotGroup.appendChild(btn);
      });
    }

    function updateNextEnabled() {
      var nextBtn = document.getElementById("rvStep1Next");
      if (!nextBtn) return;
      nextBtn.disabled = !(state.date && state.time);
      guestHint.style.color = state.guests > 8 ? "#b3564d" : "";
    }

    if (calPrev && calNext) {
      calPrev.addEventListener("click", function () {
        state.viewMonth -= 1;
        if (state.viewMonth < 0) { state.viewMonth = 11; state.viewYear -= 1; }
        renderCalendar();
      });
      calNext.addEventListener("click", function () {
        state.viewMonth += 1;
        if (state.viewMonth > 11) { state.viewMonth = 0; state.viewYear += 1; }
        renderCalendar();
      });
    }
    if (guestMinus && guestPlus && guestCount) {
      guestMinus.addEventListener("click", function () {
        state.guests = Math.max(1, state.guests - 1);
        guestCount.textContent = String(state.guests);
        updateNextEnabled();
      });
      guestPlus.addEventListener("click", function () {
        state.guests = Math.min(12, state.guests + 1);
        guestCount.textContent = String(state.guests);
        updateNextEnabled();
      });
    }

    var step1Next = document.getElementById("rvStep1Next");
    if (step1Next) step1Next.addEventListener("click", function () { goToStep(2); });
    var step2Back = document.getElementById("rvStep2Back");
    if (step2Back) step2Back.addEventListener("click", function () { goToStep(1); });

    var step2Next = document.getElementById("rvStep2Next");
    if (step2Next) {
      step2Next.addEventListener("click", function () {
        var name = document.getElementById("rvName");
        var email = document.getElementById("rvEmail");
        var ok = true;
        S.setFieldError(name, name.value.trim() ? "" : (ok = false, "Bitte gib deinen Namen an."));
        S.setFieldError(email, S.validEmail(email.value.trim()) ? "" : (ok = false, "Bitte gib eine gültige E-Mail-Adresse ein."));
        if (!ok) { (name.value.trim() ? email : name).focus(); return; }
        renderSummary();
        goToStep(3);
      });
    }

    function renderSummary() {
      document.getElementById("rvSummaryDate").textContent = S.formatDateDE(state.date);
      document.getElementById("rvSummaryTime").textContent = state.time + " Uhr";
      document.getElementById("rvSummaryGuests").textContent = state.guests + (state.guests === 1 ? " Person" : " Personen");
      document.getElementById("rvSummaryName").textContent = document.getElementById("rvName").value.trim();
      document.getElementById("rvSummaryEmail").textContent = document.getElementById("rvEmail").value.trim();
    }

    var step3Back = document.getElementById("rvStep3Back");
    if (step3Back) step3Back.addEventListener("click", function () { goToStep(2); });

    var requestForm = document.getElementById("rvRequestForm");
    var refNumber = "";
    if (requestForm) {
      requestForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var consent = document.getElementById("rvConsent");
        var err = document.getElementById("rvConsentError");
        if (!consent.checked) { err.textContent = "Bitte bestätige die Datenschutzhinweise."; return; }
        err.textContent = "";
        refNumber = "CP-" + S.ymd(state.date) + "-" + Math.floor(100 + Math.random() * 900);
        document.getElementById("rvConfirmationRef").textContent = refNumber;
        goToStep(4);
      });
    }

    var icsBtn = document.getElementById("rvIcsDownload");
    if (icsBtn) {
      icsBtn.addEventListener("click", function () {
        var timeDigits = state.time.replace(":", "");
        var startMinutes = parseInt(state.time.split(":")[0], 10) * 60 + parseInt(state.time.split(":")[1], 10);
        var endMinutes = startMinutes + 90;
        var endH = Math.floor(endMinutes / 60), endM = endMinutes % 60;
        var endTime = (endH < 10 ? "0" : "") + endH + (endM < 10 ? "0" : "") + endM;
        var ics = S.buildICS({
          prodid: "Tischreservierung",
          start: state.date, end: state.date,
          startTime: timeDigits, endTime: endTime,
          title: "Tischreservierung Café Pistazie (" + state.guests + " Pers.)",
          description: "Referenz " + refNumber + " — Demo-Reservierung, es wurde nichts wirklich gebucht."
        });
        S.downloadICS("cafe-pistazie-reservierung.ics", ics);
      });
    }

    var restartBtn = document.getElementById("rvRestart");
    if (restartBtn) {
      restartBtn.addEventListener("click", function () {
        state.date = null; state.time = null; state.guests = 2;
        guestCount.textContent = "2";
        requestForm.reset();
        document.getElementById("rvName").value = "";
        document.getElementById("rvEmail").value = "";
        renderCalendar();
        renderSlots();
        goToStep(1);
      });
    }

    renderCalendar();
    renderSlots();
  }

  /* ---------------------------------------------------------
     Torten-Vorbestellung (vorbestellen.html)
     --------------------------------------------------------- */
  var cakeForm = document.getElementById("cakeOrderForm");
  if (cakeForm) {
    var cakeDateInput = document.getElementById("cakeDate");
    var minDate = new Date();
    minDate.setDate(minDate.getDate() + 2);
    var minDateStr = minDate.getFullYear() + "-" + S.pad2(minDate.getMonth() + 1) + "-" + S.pad2(minDate.getDate());
    cakeDateInput.min = minDateStr;

    var breakdown = document.getElementById("cakePriceBreakdown");

    function currentPrice() {
      var select = document.getElementById("cakeSelect");
      var option = select.options[select.selectedIndex];
      var base = option ? Number(option.getAttribute("data-price")) : 0;
      var sizeInput = cakeForm.querySelector('input[name="cakeSize"]:checked');
      var multiplier = sizeInput ? Number(sizeInput.value) : 1;
      var count = Math.max(1, Number(document.getElementById("cakeCount").value) || 1);
      return { base: base, multiplier: multiplier, count: count, total: base * multiplier * count, sizeLabel: sizeInput ? sizeInput.closest(".choice-option").querySelector("strong").textContent : "" };
    }

    function updatePrice() {
      var p = currentPrice();
      if (!p.base) {
        breakdown.innerHTML = "<li><span>Bitte Torte, Größe und Anzahl wählen</span><span>—</span></li>";
        return;
      }
      breakdown.innerHTML =
        "<li><span>Grundpreis (" + p.sizeLabel + ")</span><span>" + S.formatEUR(p.base * p.multiplier) + "</span></li>" +
        "<li><span>Anzahl × " + p.count + "</span><span>" + S.formatEUR(p.total) + "</span></li>" +
        '<li class="total"><span>Gesamtsumme</span><span>' + S.formatEUR(p.total) + "</span></li>";
    }

    ["change", "input"].forEach(function (evt) {
      cakeForm.addEventListener(evt, function (e) {
        if (e.target.id === "cakeSelect" || e.target.name === "cakeSize" || e.target.id === "cakeCount") updatePrice();
      });
    });
    updatePrice();

    cakeForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var select = document.getElementById("cakeSelect");
      var date = cakeDateInput.value;
      var name = document.getElementById("cakeName");
      var email = document.getElementById("cakeEmail");
      var ok = true;

      S.setFieldError(select, select.value ? "" : (ok = false, "Bitte wähle eine Torte."));
      var dateOk = date && date >= minDateStr;
      var dateErr = document.getElementById("cakeDateError");
      dateErr.textContent = dateOk ? "" : "Bitte wähle ein Abholdatum ab dem " + minDateStr.split("-").reverse().join(".") + ".";
      if (!dateOk) ok = false;
      S.setFieldError(name, name.value.trim() ? "" : (ok = false, "Bitte gib deinen Namen an."));
      S.setFieldError(email, S.validEmail(email.value.trim()) ? "" : (ok = false, "Bitte gib eine gültige E-Mail-Adresse ein."));
      if (!ok) return;

      var p = currentPrice();
      var ref = "TB-" + date.replace(/-/g, "") + "-" + Math.floor(100 + Math.random() * 900);
      document.getElementById("cakeConfirmationRef").textContent = ref;
      document.getElementById("cakeConfirmationText").textContent =
        p.count + "× " + select.value + " (" + p.sizeLabel + "), Abholung am " + date.split("-").reverse().join(".") + " — Gesamtpreis " + S.formatEUR(p.total) + ". Wir bestätigen per E-Mail an " + email.value.trim() + " (Demo, keine echte Übertragung).";
      cakeForm.hidden = true;
      document.getElementById("cakeConfirmation").hidden = false;
      document.getElementById("cakeConfirmation").querySelector("h2").focus();
    });

    var cakeRestart = document.getElementById("cakeRestart");
    if (cakeRestart) {
      cakeRestart.addEventListener("click", function () {
        cakeForm.reset();
        cakeDateInput.min = minDateStr;
        updatePrice();
        cakeForm.hidden = false;
        document.getElementById("cakeConfirmation").hidden = true;
      });
    }
  }

  /* ---------------------------------------------------------
     Events & Workshops (events.html)
     --------------------------------------------------------- */
  var eventList = document.getElementById("eventList");
  if (eventList) {
    var base = new Date(); base.setHours(9, 0, 0, 0);
    var EVENTS = [
      { title: "Latte-Art-Workshop", offset: 6, start: "10:00", end: "12:00", price: "39 €", desc: "Herzen, Rosetten & Tulpen — für Einsteiger:innen, Milch und Espresso inklusive." },
      { title: "Macaron-Backkurs", offset: 13, start: "16:00", end: "18:30", price: "49 €", desc: "Von der Meringue bis zur Füllung: dein eigenes Dutzend Macarons zum Mitnehmen." },
      { title: "Kaffee-Verkostung: Ursprünge", offset: 20, start: "18:00", end: "19:30", price: "25 €", desc: "Drei Single-Origin-Röstungen im direkten Vergleich, geführt von Jonah." },
      { title: "Brunch &amp; Buch: Lesekreis", offset: 27, start: "10:30", end: "12:30", price: "kostenlos", desc: "Entspannter Austausch bei Kaffee und Gebäck — Buchtitel wechselt monatlich." }
    ];
    EVENTS.forEach(function (ev) {
      var d = new Date(base); d.setDate(d.getDate() + ev.offset);
      ev.date = d;
    });

    function renderEventList() {
      eventList.innerHTML = EVENTS.map(function (ev, i) {
        return '<li class="product-card reveal is-visible">' +
          "<h3>" + ev.title + "</h3>" +
          "<p>" + S.formatDateDE(ev.date) + " · " + ev.start + "–" + ev.end + " Uhr</p>" +
          "<p>" + ev.desc + "</p>" +
          '<p class="product-price">' + ev.price + "</p>" +
          '<button type="button" class="btn btn-ghost" data-event-index="' + i + '" style="margin-top:var(--space-s);">Zum Kalender hinzufügen (.ics)</button>' +
          "</li>";
      }).join("");
      Array.prototype.slice.call(eventList.querySelectorAll("[data-event-index]")).forEach(function (btn) {
        btn.addEventListener("click", function () {
          var ev = EVENTS[Number(btn.getAttribute("data-event-index"))];
          var ics = S.buildICS({
            prodid: "Event",
            start: ev.date, end: ev.date,
            startTime: ev.start.replace(":", "") + "00",
            endTime: ev.end.replace(":", "") + "00",
            title: ev.title + " · Café Pistazie",
            description: ev.desc
          });
          S.downloadICS("cafe-pistazie-" + ev.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".ics", ics);
        });
      });
    }
    renderEventList();

    var firstEventDate = EVENTS[0].date;
    var evState = { viewYear: firstEventDate.getFullYear(), viewMonth: firstEventDate.getMonth() };
    var evGrid = document.getElementById("evCalGrid");
    var evLabel = document.getElementById("evCalLabel");
    var evPrev = document.getElementById("evCalPrev");
    var evNext = document.getElementById("evCalNext");

    function renderEvCalendar() {
      evLabel.textContent = S.monthLabel(evState.viewYear, evState.viewMonth);
      S.renderCalendarGrid(evGrid, evState.viewYear, evState.viewMonth, function (btn, date) {
        btn.disabled = true;
        btn.setAttribute("aria-label", S.formatDateDE(date));
        if (S.sameDay(date, base)) btn.classList.add("calendar__day--today");
        var hasEvent = EVENTS.some(function (ev) { return S.sameDay(ev.date, date); });
        if (hasEvent) { btn.classList.add("calendar__day--selected"); btn.disabled = false; btn.style.cursor = "default"; }
      });
    }
    if (evPrev && evNext) {
      evPrev.addEventListener("click", function () {
        evState.viewMonth -= 1;
        if (evState.viewMonth < 0) { evState.viewMonth = 11; evState.viewYear -= 1; }
        renderEvCalendar();
      });
      evNext.addEventListener("click", function () {
        evState.viewMonth += 1;
        if (evState.viewMonth > 11) { evState.viewMonth = 0; evState.viewYear += 1; }
        renderEvCalendar();
      });
    }
    renderEvCalendar();
  }

  /* ---------------------------------------------------------
     Karte mit zweistufiger Einwilligung (kontakt.html)
     --------------------------------------------------------- */
  var mapConsent = document.getElementById("mapConsent");
  if (mapConsent) {
    var step1Btn = document.getElementById("mapConsentStep1");
    if (step1Btn) {
      step1Btn.addEventListener("click", function () {
        mapConsent.innerHTML =
          '<div class="map-consent__cover">' +
          "<p><strong>Fast geschafft.</strong> Beim endgültigen Laden würde im echten Betrieb eine Verbindung zu Google Maps aufgebaut und dabei deine IP-Adresse übertragen. Diese Demo lädt stattdessen nur eine lokale Kartenskizze.</p>" +
          '<button type="button" class="btn btn-primary" id="mapConsentStep2">Ja, Karte jetzt laden</button>' +
          "</div>";
        document.getElementById("mapConsentStep2").addEventListener("click", function () {
          mapConsent.innerHTML =
            '<svg class="map-consent__loaded" tabindex="-1" viewBox="0 0 400 240" role="img" aria-labelledby="mapTitle mapDesc" xmlns="http://www.w3.org/2000/svg">' +
            '<title id="mapTitle">Kartenskizze zur Lage von Café Pistazie</title>' +
            '<desc id="mapDesc">Vereinfachte, nicht maßstabsgetreue Illustration: Café Pistazie liegt an der Steinstraße, wenige Gehminuten von der Königsallee entfernt.</desc>' +
            '<rect width="400" height="240" fill="#f6efe1"/>' +
            '<rect x="20" y="20" width="90" height="60" rx="10" fill="#cfe3c1"/>' +
            '<rect x="140" y="30" width="70" height="50" rx="10" fill="#f6d6d6"/>' +
            '<rect x="240" y="15" width="100" height="70" rx="10" fill="#d9d3f2"/>' +
            '<rect x="30" y="140" width="100" height="70" rx="10" fill="#d9d3f2"/>' +
            '<rect x="160" y="150" width="80" height="60" rx="10" fill="#f6d6d6"/>' +
            '<rect x="270" y="130" width="100" height="80" rx="10" fill="#cfe3c1"/>' +
            '<path d="M0 120 H400" stroke="#fffaf3" stroke-width="14"/>' +
            '<path d="M150 0 V240" stroke="#fffaf3" stroke-width="14"/>' +
            '<path d="M0 120 H400" stroke="#e7ded0" stroke-width="2" stroke-dasharray="6 6"/>' +
            '<path d="M150 0 V240" stroke="#e7ded0" stroke-width="2" stroke-dasharray="6 6"/>' +
            '<g transform="translate(150 118)"><path d="M0 -34c12 0 22 10 22 22 0 16-22 34-22 34s-22-18-22-34c0-12 10-22 22-22z" fill="#4a3428"/><circle cx="0" cy="-12" r="9" fill="#fffaf3"/></g>' +
            '<text x="175" y="100" font-family="Nunito Sans, sans-serif" font-size="12" font-weight="700" fill="#4a3428">Steinstraße</text>' +
            '<text x="250" y="16" font-family="Nunito Sans, sans-serif" font-size="11" font-weight="700" fill="#4a3428" opacity="0.7">Richtung Königsallee →</text>' +
            "</svg>";
          var svg = mapConsent.querySelector(".map-consent__loaded");
          if (svg) svg.focus();
        });
      });
    }
  }
})();
