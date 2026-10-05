/* Newsletter-Admin: Token nur im Speicher dieser Seite (nicht persistiert). */
(function () {
  'use strict';
  var YQ = window.YQ, token = '', count = 0;
  var $ = function (id) { return document.getElementById(id); };
  var st = $('nla-status');
  function api(method, path, body) {
    return fetch(YQ.API_BASE + path, { method: method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error(d.error || 'Status ' + r.status); return d; }); });
  }
  function syncLive() { $('nla-live').disabled = !(count > 0 && $('nla-confirm').value === 'SENDEN ' + count); }
  $('nla-confirm').addEventListener('input', syncLive);
  $('nla-login').addEventListener('submit', function (ev) {
    ev.preventDefault();
    token = $('nla-token').value.trim();
    $('nla-token').value = '';
    st.textContent = 'Wird abgerufen …';
    api('GET', '/api/admin/newsletter/subscribers').then(function (d) {
      count = d.confirmed; $('nla-phrase').textContent = 'SENDEN ' + count;
      var ul = $('nla-stats'); ul.textContent = '';
      ['Bestätigte Abonnenten: ' + d.confirmed, 'Unbestätigt (löschen sich nach 7 Tagen): ' + d.pending, 'Live-Versand heute noch erlaubt: ' + (d.liveAllowedNow ? 'ja' : 'nein'), 'Max. Empfänger je Lauf: ' + d.limits.maxRecipients, 'Test-Adresse konfiguriert: ' + (d.testAddressConfigured ? 'ja' : 'nein')].forEach(function (t) { var li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
      $('nla-main').hidden = false; st.textContent = ''; syncLive();
    }, function (e) { token = ''; st.textContent = 'Fehler: ' + e.message; });
  });
  $('nla-preview-btn').addEventListener('click', function () { $('nla-preview-text').textContent = $('nla-subject').value + '\n\n' + $('nla-body').value + '\n\n-- \n(Hier folgen automatisch: Anmeldegrund, Abmeldelink, Impressumsangaben)'; $('nla-preview').hidden = false; });
  function send(payload) {
    st.textContent = 'Wird gesendet …';
    return api('POST', '/api/admin/newsletter/send', Object.assign({ subject: $('nla-subject').value, text: $('nla-body').value }, payload))
      .then(function (d) { st.textContent = 'Fertig: ' + JSON.stringify(d); }, function (e) { st.textContent = 'Fehler: ' + e.message; });
  }
  $('nla-test').addEventListener('click', function () { send({ mode: 'test', to: $('nla-to').value.trim() }); });
  $('nla-live').addEventListener('click', function () { $('nla-live').disabled = true; send({ mode: 'live', confirm: $('nla-confirm').value }).then(function () { $('nla-confirm').value = ''; }); });
})();
