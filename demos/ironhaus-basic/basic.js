/* IRONHAUS Basic – Seiten-spezifisches JS (Kontakt-/Probetraining-Formular).
   Header, Menü, Reveal, Zähler etc. kommen aus ../ironhaus-shared/shared.js */
(function () {
  "use strict";
  var IH = window.IronhausShared;
  var trialForm = document.getElementById("trial-form");
  if (!trialForm || !IH) return;

  var trialDate = document.getElementById("trial-date");
  var isoToday = IH.todayISO();
  if (trialDate) trialDate.min = isoToday;

  var fields = {
    name: { input: document.getElementById("trial-name"), error: document.getElementById("trial-err-name") },
    email: { input: document.getElementById("trial-email"), error: document.getElementById("trial-err-email") },
    date: { input: trialDate, error: document.getElementById("trial-err-date") },
    message: { input: document.getElementById("trial-message"), error: document.getElementById("trial-err-message") }
  };

  var trialSuccess = document.getElementById("trial-success");
  var trialReset = document.getElementById("trial-reset");

  trialForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var valid = IH.validateForm([
      { input: fields.name.input, error: fields.name.error, required: true, requiredMessage: "Bitte gib deinen Namen an." },
      { input: fields.email.input, error: fields.email.error, required: true, email: true, requiredMessage: "Bitte gib deine E-Mail-Adresse an." },
      { input: fields.date.input, error: fields.date.error, required: false, minDate: isoToday, minDateMessage: "Das Datum darf nicht in der Vergangenheit liegen." }
    ]);
    if (!valid) return;

    document.getElementById("trial-success-name").textContent = fields.name.input.value.trim();
    document.getElementById("trial-success-email").textContent = fields.email.input.value.trim();
    var dateWrap = document.getElementById("trial-success-date-wrap");
    if (fields.date.input.value) {
      document.getElementById("trial-success-date").textContent = IH.formatDateDE(fields.date.input.value);
      if (dateWrap) dateWrap.hidden = false;
    } else if (dateWrap) {
      dateWrap.hidden = true;
    }

    trialForm.hidden = true;
    trialSuccess.hidden = false;
    trialSuccess.focus();
  });

  if (trialReset) {
    trialReset.addEventListener("click", function () {
      trialForm.reset();
      if (trialDate) trialDate.min = isoToday;
      Object.keys(fields).forEach(function (key) { IH.setFieldError(fields[key].input, fields[key].error, ""); });
      trialSuccess.hidden = true;
      trialForm.hidden = false;
      fields.name.input.focus();
    });
  }
})();
