/* =========================================================
   Café Pistazie — Paket Premium
   Cookie-Consent, Sprachumschalter, Chat-Widget, Live-Widgets,
   Warenkorb/Shop/Kasse, Gutschein, Mitgliederbereich.
   Nutzt window.PistazieShared (Kalender, .ics, Utilities) und
   window.PISTAZIE_PRODUCTS (data.js). Reservierung/Vorbestellung/
   Events/Karten-Einwilligung laufen weiter über
   ../pistazie-business/business.js (identische Logik, gleiche IDs).
   ========================================================= */
(function () {
  "use strict";
  var S = window.PistazieShared;
  if (!S) return;
  var PRODUCTS = window.PISTAZIE_PRODUCTS || [];
  if (S.wireNewsletter) S.wireNewsletter("newsletter-form");

  /* ---------------------------------------------------------
     Cookie-Consent mit Kategorien
     --------------------------------------------------------- */
  var COOKIE_KEY = "pistazie-premium:cookie_consent_v1";
  var cookieBanner = document.getElementById("cookieBanner");
  if (cookieBanner) {
    var existing = S.readJSON(COOKIE_KEY, null);
    if (!existing) cookieBanner.hidden = false;

    function saveConsent(consent) {
      S.writeJSON(COOKIE_KEY, consent);
      cookieBanner.hidden = true;
    }
    var acceptAll = document.getElementById("cookieAcceptAll");
    var rejectAll = document.getElementById("cookieReject");
    var saveChoice = document.getElementById("cookieSave");
    var statsBox = document.getElementById("cookieStats");
    var marketingBox = document.getElementById("cookieMarketing");
    if (acceptAll) acceptAll.addEventListener("click", function () { saveConsent({ necessary: true, stats: true, marketing: true, date: Date.now() }); });
    if (rejectAll) rejectAll.addEventListener("click", function () { saveConsent({ necessary: true, stats: false, marketing: false, date: Date.now() }); });
    if (saveChoice) {
      saveChoice.addEventListener("click", function () {
        saveConsent({ necessary: true, stats: !!(statsBox && statsBox.checked), marketing: !!(marketingBox && marketingBox.checked), date: Date.now() });
      });
    }
  }

  /* ---------------------------------------------------------
     Sprachumschalter (DE/EN) — Demo: Navigation, Überschriften
     und Footer sind zweisprachig hinterlegt (data-de/data-en).
     --------------------------------------------------------- */
  var LANG_KEY = "pistazie-premium:lang_v1";
  function applyLang(lang) {
    document.documentElement.lang = lang === "en" ? "en" : "de";
    document.querySelectorAll("[data-de][data-en]").forEach(function (el) {
      el.textContent = lang === "en" ? el.getAttribute("data-en") : el.getAttribute("data-de");
    });
    document.querySelectorAll(".lang-toggle").forEach(function (btn) {
      btn.textContent = lang === "en" ? "DE" : "EN";
      btn.setAttribute("aria-label", lang === "en" ? "DE – Zur deutschen Version wechseln" : "EN – Switch to English");
    });
  }
  var savedLang = S.readJSON(LANG_KEY, "de");
  applyLang(savedLang);
  document.querySelectorAll(".lang-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var current = document.documentElement.lang === "en" ? "en" : "de";
      var next = current === "en" ? "de" : "en";
      S.writeJSON(LANG_KEY, next);
      applyLang(next);
    });
  });

  /* ---------------------------------------------------------
     Chat-Widget (priorisierter Support, unten rechts)
     --------------------------------------------------------- */
  var chatToggle = document.getElementById("chatToggle");
  var chatPanel = document.getElementById("chatPanel");
  if (chatToggle && chatPanel) {
    chatToggle.addEventListener("click", function () {
      var open = chatPanel.hidden;
      chatPanel.hidden = !open;
      chatToggle.setAttribute("aria-expanded", String(open));
      if (open) chatPanel.querySelector("h2").setAttribute("tabindex", "-1"), chatPanel.querySelector("h2").focus();
    });
    var log = document.getElementById("chatLog");
    function addMsg(text, who) {
      var div = document.createElement("div");
      div.className = "chat-widget__msg chat-widget__msg--" + who;
      div.textContent = text;
      log.appendChild(div);
      log.scrollTop = log.scrollHeight;
    }
    var ANSWERS = {
      "Öffnungszeiten?": "Mo–Fr 8–19 Uhr, Sa 9–19 Uhr, So 9–17 Uhr. Aktuellen Status siehst du oben auf der Startseite.",
      "Tisch reservieren?": "Klar, das geht über „Reservieren“ in der Navigation — Datum, Uhrzeit und Personenzahl wählen, fertig.",
      "Lieferung möglich?": "Ja, im Warenkorb kannst du deine Postleitzahl prüfen — wir liefern aktuell im Düsseldorfer Stadtgebiet (PLZ 40x/41x)."
    };
    Array.prototype.slice.call(document.querySelectorAll(".chat-widget__quick button")).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var q = btn.textContent;
        addMsg(q, "user");
        window.setTimeout(function () { addMsg(ANSWERS[q] || "Danke für deine Nachricht! Unser Team antwortet dir demnächst (Demo).", "bot"); }, 400);
      });
    });
  }

  /* ---------------------------------------------------------
     Live-Widgets (Startseite): Wartezeit & „Heute frisch“
     simulierte API mit Promise-Latenz
     --------------------------------------------------------- */
  var waitWidget = document.getElementById("waitTimeWidget");
  if (waitWidget) {
    var waitValue = waitWidget.querySelector(".live-widget__value");
    waitValue.setAttribute("data-loading", "true");
    var minutesPattern = [2, 5, 8, 12, 4, 6];
    var todayIndex = new Date().getDate() % minutesPattern.length;
    S.simulateApi(minutesPattern[todayIndex]).then(function (minutes) {
      waitWidget.classList.remove("is-loading");
      waitValue.removeAttribute("data-loading");
      waitValue.textContent = "ca. " + minutes + " Min.";
    });
  }
  var freshWidget = document.getElementById("freshWidget");
  if (freshWidget) {
    var freshValue = freshWidget.querySelector(".live-widget__value");
    freshValue.setAttribute("data-loading", "true");
    S.simulateApi(function () {
      return PRODUCTS.slice().sort(function (a, b) { return a.stock - b.stock; }).slice(0, 2);
    }).then(function (items) {
      freshWidget.classList.remove("is-loading");
      freshValue.removeAttribute("data-loading");
      freshValue.textContent = items.map(function (p) { return p.name.split(",")[0]; }).join(" · ") || "—";
    });
  }

  /* ---------------------------------------------------------
     Warenkorb (localStorage, seitenübergreifend)
     --------------------------------------------------------- */
  var CART_KEY = "pistazie-premium:cart_v1";
  var MAX_QTY = 99;
  // Nur bekannte Produkte, ganzzahlige Mengen 1..99, Preis aus dem Katalog (manipulierter localStorage ergibt sonst negative/NaN-Summen)
  function cartRead() {
    var raw = S.readJSON(CART_KEY, []);
    if (!Array.isArray(raw)) return [];
    var out = [];
    raw.forEach(function (it) {
      if (!it) return;
      var p = PRODUCTS.find(function (x) { return x.id === it.id; });
      var q = Math.floor(Number(it.qty));
      if (!p || !isFinite(q) || q < 1) return;
      out.push({ id: p.id, name: p.name, price: p.price, qty: Math.min(MAX_QTY, q) });
    });
    return out;
  }
  function cartWrite(items) {
    S.writeJSON(CART_KEY, items);
    window.dispatchEvent(new CustomEvent("cp:cart-changed"));
  }
  function cartAdd(product, qty) {
    var items = cartRead();
    var existing = items.find(function (it) { return it.id === product.id; });
    if (existing) existing.qty = Math.min(MAX_QTY, existing.qty + qty);
    else items.push({ id: product.id, name: product.name, price: product.price, qty: qty });
    cartWrite(items);
  }
  function cartUpdateQty(id, qty) {
    var items = cartRead();
    items.forEach(function (it) { if (it.id === id) it.qty = Math.min(MAX_QTY, Math.max(1, qty)); });
    cartWrite(items);
  }
  function cartRemove(id) { cartWrite(cartRead().filter(function (it) { return it.id !== id; })); }
  function cartCount(items) { return (items || cartRead()).reduce(function (s, it) { return s + it.qty; }, 0); }
  function cartSubtotal(items) { return (items || cartRead()).reduce(function (s, it) { return s + it.qty * it.price; }, 0); }

  function renderCartBadge() {
    var n = cartCount();
    document.querySelectorAll("[data-cart-count]").forEach(function (el) {
      el.textContent = String(n);
      var link = el.closest(".cart-link");
      if (link) { link.setAttribute("data-bump", "true"); window.setTimeout(function () { link.removeAttribute("data-bump"); }, 220); }
    });
  }
  renderCartBadge();
  window.addEventListener("cp:cart-changed", renderCartBadge);
  window.addEventListener("storage", function (e) { if (e.key === CART_KEY) renderCartBadge(); });

  /* ---------------------------------------------------------
     Shop (shop.html)
     --------------------------------------------------------- */
  var shopGrid = document.getElementById("shopGrid");
  if (shopGrid) {
    var WISH_KEY = "pistazie-premium:wishlist_v1";
    function wishlist() { return S.readJSON(WISH_KEY, []); }
    function toggleWish(id) {
      var list = wishlist();
      var idx = list.indexOf(id);
      if (idx === -1) list.push(id); else list.splice(idx, 1);
      S.writeJSON(WISH_KEY, list);
      return list.indexOf(id) !== -1;
    }

    shopGrid.innerHTML = PRODUCTS.map(function (p) {
      var wished = wishlist().indexOf(p.id) !== -1;
      var stockNote = p.stock <= 3
        ? '<p class="stock-note is-low">Nur noch ' + p.stock + ' da — heute frisch</p>'
        : '<p class="stock-note is-ok">Auf Lager</p>';
      return '<article class="shop-card reveal is-visible">' +
        '<div class="shop-card__media"><img src="' + p.image + '" alt="' + p.alt + '" width="600" height="450" loading="lazy"></div>' +
        '<div class="shop-card__body"><h3>' + p.name + '</h3><p>' + p.desc + '</p>' + stockNote +
        '<p class="shop-card__price">' + S.formatEUR(p.price) + '</p>' +
        '<div class="shop-card__actions">' +
        '<button type="button" class="btn btn-primary" data-add-to-cart="' + p.id + '">In den Warenkorb</button>' +
        '<button type="button" class="wish-btn" data-wish="' + p.id + '" aria-pressed="' + wished + '" aria-label="Auf Merkliste">' + (wished ? "♥" : "♡") + '</button>' +
        '</div></div></article>';
    }).join("");

    shopGrid.addEventListener("click", function (e) {
      var addBtn = e.target.closest("[data-add-to-cart]");
      if (addBtn) {
        var product = PRODUCTS.find(function (p) { return p.id === addBtn.getAttribute("data-add-to-cart"); });
        if (product) {
          cartAdd(product, 1);
          addBtn.textContent = "Im Warenkorb ✓";
          window.setTimeout(function () { addBtn.textContent = "In den Warenkorb"; }, 1200);
        }
      }
      var wishBtn = e.target.closest("[data-wish]");
      if (wishBtn) {
        var id = wishBtn.getAttribute("data-wish");
        var nowWished = toggleWish(id);
        wishBtn.setAttribute("aria-pressed", String(nowWished));
        wishBtn.textContent = nowWished ? "♥" : "♡";
      }
    });
  }

  /* ---------------------------------------------------------
     Warenkorb-Seite (warenkorb.html)
     --------------------------------------------------------- */
  var cartTableBody = document.getElementById("cartTableBody");
  if (cartTableBody) {
    var cartEmpty = document.getElementById("cartEmpty");
    var cartTable = document.getElementById("cartTableWrap");
    var subtotalEl = document.getElementById("cartSubtotal");
    var toCheckoutBtn = document.getElementById("toCheckoutBtn");
    var plzInput = document.getElementById("deliveryPlz");
    var plzResult = document.getElementById("deliveryResult");
    var plzCheckBtn = document.getElementById("deliveryCheckBtn");
    var fulfillmentRadios = Array.prototype.slice.call(document.querySelectorAll('input[name="fulfillment"]'));
    var pickupSlotGroup = document.getElementById("pickupSlotGroup");
    var deliveryBlock = document.getElementById("deliveryBlock");
    var pickupBlock = document.getElementById("pickupBlock");

    var fulfillmentState = { type: null, plzOk: false, slot: null, fee: 0 };

    function renderCart() {
      var items = cartRead();
      if (!items.length) {
        cartEmpty.hidden = false;
        cartTable.hidden = true;
        toCheckoutBtn.disabled = true;
        return;
      }
      cartEmpty.hidden = true;
      cartTable.hidden = false;
      cartTableBody.innerHTML = items.map(function (it) {
        return "<tr>" +
          "<td>" + S.escapeHTML(it.name) + "</td>" +
          '<td class="num"><span class="cart-qty"><button type="button" data-qty-minus="' + S.escapeHTML(it.id) + '" aria-label="Weniger">−</button>' +
          '<span>' + S.escapeHTML(it.qty) + '</span><button type="button" data-qty-plus="' + S.escapeHTML(it.id) + '" aria-label="Mehr">+</button></span></td>' +
          '<td class="num">' + S.formatEUR(it.price * it.qty) + '</td>' +
          '<td class="num"><button type="button" class="cart-remove" data-remove="' + S.escapeHTML(it.id) + '">Entfernen</button></td>' +
          "</tr>";
      }).join("");
      var subtotal = cartSubtotal(items);
      subtotalEl.textContent = S.formatEUR(subtotal + fulfillmentState.fee);
      updateCheckoutEnabled();
    }

    function updateCheckoutEnabled() {
      var items = cartRead();
      var ready = items.length > 0 && fulfillmentState.type &&
        (fulfillmentState.type === "abholung" ? !!fulfillmentState.slot : fulfillmentState.plzOk);
      toCheckoutBtn.disabled = !ready;
    }

    cartTableBody.addEventListener("click", function (e) {
      var plus = e.target.closest("[data-qty-plus]");
      var minus = e.target.closest("[data-qty-minus]");
      var remove = e.target.closest("[data-remove]");
      if (plus) { var items = cartRead(); var it = items.find(function (i) { return i.id === plus.getAttribute("data-qty-plus"); }); cartUpdateQty(it.id, it.qty + 1); }
      if (minus) { var items2 = cartRead(); var it2 = items2.find(function (i) { return i.id === minus.getAttribute("data-qty-minus"); }); cartUpdateQty(it2.id, it2.qty - 1); }
      if (remove) cartRemove(remove.getAttribute("data-remove"));
    });
    window.addEventListener("cp:cart-changed", renderCart);

    fulfillmentRadios.forEach(function (radio) {
      radio.addEventListener("change", function () {
        fulfillmentState.type = radio.value;
        deliveryBlock.hidden = radio.value !== "lieferung";
        pickupBlock.hidden = radio.value !== "abholung";
        if (radio.value === "abholung") { fulfillmentState.fee = 0; renderPickupSlots(); }
        renderCart();
      });
    });

    function renderPickupSlots() {
      var slots = ["11:00", "13:00", "15:00", "17:00"];
      pickupSlotGroup.innerHTML = "";
      slots.forEach(function (slot) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "slot-chip";
        btn.textContent = slot;
        btn.setAttribute("aria-pressed", fulfillmentState.slot === slot ? "true" : "false");
        btn.addEventListener("click", function () {
          fulfillmentState.slot = slot;
          renderPickupSlots();
          updateCheckoutEnabled();
        });
        pickupSlotGroup.appendChild(btn);
      });
    }

    if (plzCheckBtn) {
      plzCheckBtn.addEventListener("click", function () {
        var plz = plzInput.value.trim();
        if (!/^\d{5}$/.test(plz)) {
          plzResult.textContent = "Bitte eine gültige 5-stellige Postleitzahl eingeben.";
          plzResult.className = "delivery-check-result is-fail";
          return;
        }
        plzResult.textContent = "Prüfe Liefergebiet …";
        plzResult.className = "delivery-check-result";
        S.simulateApi(function () { return /^4[01]/.test(plz); }).then(function (deliverable) {
          if (deliverable) {
            fulfillmentState.plzOk = true;
            fulfillmentState.fee = 3.5;
            plzResult.textContent = "Gute Nachricht: Wir liefern an " + plz + " (Lieferpauschale 3,50 €).";
            plzResult.className = "delivery-check-result is-ok";
          } else {
            fulfillmentState.plzOk = false;
            fulfillmentState.fee = 0;
            plzResult.textContent = plz + " liegt außerhalb unseres Liefergebiets (Demo: nur PLZ 40xxx/41xxx). Bitte „Abholung“ wählen.";
            plzResult.className = "delivery-check-result is-fail";
          }
          renderCart();
        });
      });
    }

    if (toCheckoutBtn) {
      toCheckoutBtn.addEventListener("click", function () {
        S.writeJSON("pistazie-premium:fulfillment_v1", fulfillmentState);
        window.location.href = "kasse.html";
      });
    }

    renderCart();
  }

  /* ---------------------------------------------------------
     Kasse (kasse.html)
     --------------------------------------------------------- */
  var checkoutForm = document.getElementById("checkoutForm");
  if (checkoutForm) {
    var items = cartRead();
    var fulfillment = S.readJSON("pistazie-premium:fulfillment_v1", { type: "abholung", fee: 0 });
    var summaryList = document.getElementById("checkoutSummary");
    var totalEl = document.getElementById("checkoutTotal");

    if (!items.length) {
      checkoutForm.hidden = true;
      checkoutForm.addEventListener("submit", function (e) { e.preventDefault(); });
      document.getElementById("checkoutEmpty").hidden = false;
    } else {
      var subtotal = cartSubtotal(items);
      var total = subtotal + (fulfillment.fee || 0);
      summaryList.innerHTML = items.map(function (it) {
        return "<li><span>" + S.escapeHTML(it.qty) + "× " + S.escapeHTML(it.name) + "</span><span>" + S.formatEUR(it.price * it.qty) + "</span></li>";
      }).join("") +
        (fulfillment.fee ? "<li><span>Lieferpauschale</span><span>" + S.formatEUR(fulfillment.fee) + "</span></li>" : "") +
        '<li class="total"><span>Gesamtsumme</span><span>' + S.formatEUR(total) + "</span></li>";
      totalEl.textContent = S.formatEUR(total);

      var session = S.readJSON("pistazie-premium:session_v1", null);
      if (session) {
        document.getElementById("checkoutEmail").value = session.email;
        document.getElementById("checkoutName").value = session.name;
      }

      checkoutForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = document.getElementById("checkoutName");
        var email = document.getElementById("checkoutEmail");
        var ok = true;
        S.setFieldError(name, name.value.trim() ? "" : (ok = false, "Bitte gib deinen Namen an."));
        S.setFieldError(email, S.validEmail(email.value.trim()) ? "" : (ok = false, "Bitte gib eine gültige E-Mail-Adresse ein."));
        if (!ok) return;

        var payment = checkoutForm.querySelector('input[name="payment"]:checked');
        var orderNumber = "CP-" + Date.now().toString().slice(-8);
        var order = {
          orderNumber: orderNumber,
          date: new Date().toISOString(),
          items: items,
          total: total,
          fulfillment: fulfillment.type,
          slot: fulfillment.slot || null,
          payment: payment ? payment.value : "Karte",
          status: "Eingegangen",
          email: email.value.trim(),
          name: name.value.trim()
        };
        var orders = S.readJSON("pistazie-premium:orders_v1", []);
        orders.push(order);
        S.writeJSON("pistazie-premium:orders_v1", orders);
        cartWrite([]);

        checkoutForm.hidden = true;
        var confirmation = document.getElementById("checkoutConfirmation");
        confirmation.hidden = false;
        document.getElementById("checkoutOrderNumber").textContent = orderNumber;
        document.getElementById("checkoutOrderTotal").textContent = S.formatEUR(total);
        confirmation.querySelector("h2").focus();
      });
    }
  }

  /* ---------------------------------------------------------
     Gutschein (gutschein.html)
     --------------------------------------------------------- */
  var voucherForm = document.getElementById("voucherForm");
  if (voucherForm) {
    var amountChips = Array.prototype.slice.call(document.querySelectorAll(".voucher-amount-chip"));
    var customAmount = document.getElementById("voucherCustomAmount");
    var amountValue = 25;
    var previewAmount = document.getElementById("voucherPreviewAmount");
    var previewTo = document.getElementById("voucherPreviewTo");
    var previewFrom = document.getElementById("voucherPreviewFrom");
    var previewMessage = document.getElementById("voucherPreviewMessage");

    function updatePreview() {
      previewAmount.textContent = S.formatEUR(amountValue);
      previewTo.textContent = document.getElementById("voucherTo").value.trim() || "—";
      previewFrom.textContent = document.getElementById("voucherFrom").value.trim() || "—";
      previewMessage.textContent = document.getElementById("voucherMessage").value.trim() || "Für dich, mit Pistazien-Grüßen.";
    }

    amountChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        amountChips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
        chip.setAttribute("aria-pressed", "true");
        amountValue = Number(chip.getAttribute("data-amount"));
        customAmount.value = "";
        updatePreview();
      });
    });
    if (customAmount) {
      customAmount.addEventListener("input", function () {
        var v = Number(customAmount.value);
        if (v > 0) {
          amountChips.forEach(function (c) { c.setAttribute("aria-pressed", "false"); });
          amountValue = v;
          updatePreview();
        }
      });
    }
    ["voucherTo", "voucherFrom", "voucherMessage"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", updatePreview);
    });
    updatePreview();

    voucherForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = document.getElementById("voucherEmail");
      if (!S.validEmail(email.value.trim())) { S.setFieldError(email, "Bitte eine gültige E-Mail-Adresse angeben."); return; }
      S.setFieldError(email, "");
      var code = "PIST-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      var vouchers = S.readJSON("pistazie-premium:vouchers_v1", []);
      vouchers.push({ code: code, amount: amountValue, to: document.getElementById("voucherTo").value.trim(), from: document.getElementById("voucherFrom").value.trim(), date: new Date().toISOString() });
      S.writeJSON("pistazie-premium:vouchers_v1", vouchers);
      voucherForm.hidden = true;
      var confirmation = document.getElementById("voucherConfirmation");
      confirmation.hidden = false;
      document.getElementById("voucherCode").textContent = code;
      confirmation.querySelector("h2").focus();
    });

    var voucherRestart = document.getElementById("voucherRestart");
    if (voucherRestart) {
      voucherRestart.addEventListener("click", function () {
        voucherForm.reset();
        amountValue = 25;
        amountChips.forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-amount") === "25" ? "true" : "false"); });
        updatePreview();
        voucherForm.hidden = false;
        document.getElementById("voucherConfirmation").hidden = true;
      });
    }
  }

  /* ---------------------------------------------------------
     Torten-Vorbestellung: zusätzlich Status für den
     Mitgliederbereich speichern (business.js führt die
     eigentliche Validierung/Anzeige aus, läuft zuerst).
     --------------------------------------------------------- */
  var cakeFormForAccount = document.getElementById("cakeOrderForm");
  if (cakeFormForAccount) {
    cakeFormForAccount.addEventListener("submit", function () {
      window.setTimeout(function () {
        var confirmation = document.getElementById("cakeConfirmation");
        if (confirmation && !confirmation.hidden) {
          var preorders = S.readJSON("pistazie-premium:preorders_v1", []);
          preorders.push({
            ref: document.getElementById("cakeConfirmationRef").textContent,
            cake: document.getElementById("cakeSelect").value,
            date: document.getElementById("cakeDate").value,
            status: "In Vorbereitung",
            email: document.getElementById("cakeEmail").value.trim()
          });
          S.writeJSON("pistazie-premium:preorders_v1", preorders);
        }
      }, 0);
    });
  }

  /* ---------------------------------------------------------
     Mitgliederbereich (konto.html)
     --------------------------------------------------------- */
  var authSection = document.getElementById("accountAuth");
  var dashboardSection = document.getElementById("accountDashboard");
  if (authSection && dashboardSection) {
    var USERS_KEY = "pistazie-premium:users_v1";
    var SESSION_KEY = "pistazie-premium:session_v1";

    function getSession() { return S.readJSON(SESSION_KEY, null); }
    function setSession(v) { S.writeJSON(SESSION_KEY, v); }

    function showAuth() { authSection.hidden = false; dashboardSection.hidden = true; }
    function showDashboard() { authSection.hidden = true; dashboardSection.hidden = false; renderDashboard(); }

    var loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var email = document.getElementById("loginEmail").value.trim().toLowerCase();
        var password = document.getElementById("loginPassword").value;
        var users = S.readJSON(USERS_KEY, []);
        var user = users.find(function (u) { return u.email === email; });
        var msg = document.getElementById("loginMessage");
        if (!user) { msg.textContent = "Kein Konto mit dieser E-Mail gefunden — bitte registrieren."; return; }
        if (user.password !== password) { msg.textContent = "Passwort ist falsch (Demo-Hinweis: nur lokal geprüft)."; return; }
        setSession({ email: user.email, name: user.name });
        showDashboard();
      });
    }

    var registerForm = document.getElementById("registerForm");
    if (registerForm) {
      registerForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var name = document.getElementById("registerName").value.trim();
        var email = document.getElementById("registerEmail").value.trim().toLowerCase();
        var password = document.getElementById("registerPassword").value;
        var msg = document.getElementById("registerMessage");
        if (!name || !S.validEmail(email) || password.length < 4) {
          msg.textContent = "Bitte Name, gültige E-Mail und ein Passwort mit mind. 4 Zeichen angeben.";
          return;
        }
        var users = S.readJSON(USERS_KEY, []);
        if (users.some(function (u) { return u.email === email; })) { msg.textContent = "Für diese E-Mail existiert bereits ein Konto."; return; }
        users.push({ name: name, email: email, password: password, points: 40, stamps: 2 });
        S.writeJSON(USERS_KEY, users);
        setSession({ email: email, name: name });
        showDashboard();
      });
    }

    var demoLoginBtn = document.getElementById("demoLoginBtn");
    if (demoLoginBtn) {
      demoLoginBtn.addEventListener("click", function () {
        var users = S.readJSON(USERS_KEY, []);
        var demoEmail = "demo@cafe-pistazie.example";
        if (!users.some(function (u) { return u.email === demoEmail; })) {
          users.push({ name: "Mira Sander", email: demoEmail, password: "demo", points: 260, stamps: 7 });
          S.writeJSON(USERS_KEY, users);
        }
        setSession({ email: demoEmail, name: "Mira Sander" });
        showDashboard();
      });
    }

    var logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", function () { setSession(null); showAuth(); });

    function renderDashboard() {
      var session = getSession();
      if (!session) { showAuth(); return; }
      var users = S.readJSON(USERS_KEY, []);
      var user = users.find(function (u) { return u.email === session.email; }) || { points: 0, stamps: 0 };
      document.getElementById("dashboardName").textContent = session.name;
      document.getElementById("loyaltyPoints").textContent = user.points || 0;

      var stampCard = document.getElementById("stampCard");
      var stamps = Math.min(10, user.stamps || 0);
      stampCard.innerHTML = "";
      for (var i = 0; i < 10; i++) {
        var span = document.createElement("span");
        span.className = "stamp" + (i < stamps ? " is-filled" : "");
        span.textContent = i < stamps ? "★" : "";
        span.setAttribute("aria-hidden", "true");
        stampCard.appendChild(span);
      }
      document.getElementById("stampCount").textContent = stamps + " von 10 Stempeln — noch " + (10 - stamps) + " bis zum Gratis-Kaffee.";

      var orders = S.readJSON("pistazie-premium:orders_v1", []).filter(function (o) { return o.email === session.email; });
      var ordersBody = document.getElementById("ordersBody");
      var ordersEmpty = document.getElementById("ordersEmpty");
      if (!orders.length) { ordersBody.innerHTML = ""; ordersEmpty.hidden = false; }
      else {
        ordersEmpty.hidden = true;
        ordersBody.innerHTML = orders.slice().reverse().map(function (o) {
          var date = new Date(o.date).toLocaleDateString("de-DE");
          return "<tr><td>" + S.escapeHTML(o.orderNumber) + "</td><td>" + S.escapeHTML(date) + "</td><td>" + S.escapeHTML(o.items.length) + " Artikel</td><td>" + S.escapeHTML(S.formatEUR(o.total)) + '</td><td><span class="order-status">' + S.escapeHTML(o.status) + "</span></td></tr>";
        }).join("");
      }

      var preorders = S.readJSON("pistazie-premium:preorders_v1", []).filter(function (o) { return o.email === session.email; });
      var preorderBody = document.getElementById("preorderBody");
      var preorderEmpty = document.getElementById("preorderEmpty");
      if (preorderBody) {
        if (!preorders.length) { preorderBody.innerHTML = ""; preorderEmpty.hidden = false; }
        else {
          preorderEmpty.hidden = true;
          preorderBody.innerHTML = preorders.slice().reverse().map(function (o) {
            return "<tr><td>" + S.escapeHTML(o.ref) + "</td><td>" + S.escapeHTML(o.cake) + "</td><td>" + S.escapeHTML(String(o.date).split("-").reverse().join(".")) + '</td><td><span class="order-status">' + S.escapeHTML(o.status) + "</span></td></tr>";
          }).join("");
        }
      }

      var favBox = document.getElementById("favoritesGrid");
      if (favBox) {
        var ids = S.readJSON("pistazie-premium:wishlist_v1", []);
        var favProducts = PRODUCTS.filter(function (p) { return ids.indexOf(p.id) !== -1; });
        if (!favProducts.length) favBox.innerHTML = '<p>Noch nichts gemerkt. <a href="shop.html">Zum Shop</a></p>';
        else favBox.innerHTML = favProducts.map(function (p) {
          return '<article class="shop-card"><div class="shop-card__media"><img src="' + p.image + '" alt="' + p.alt + '" width="400" height="300" loading="lazy"></div><div class="shop-card__body"><h3>' + p.name + "</h3><p class=\"shop-card__price\">" + S.formatEUR(p.price) + "</p></div></article>";
        }).join("");
      }
    }

    Array.prototype.slice.call(document.querySelectorAll(".dashboard-tabs button")).forEach(function (tab) {
      tab.addEventListener("click", function () {
        Array.prototype.slice.call(document.querySelectorAll(".dashboard-tabs button")).forEach(function (t) { t.setAttribute("aria-selected", "false"); });
        tab.setAttribute("aria-selected", "true");
        Array.prototype.slice.call(document.querySelectorAll(".dashboard-panel")).forEach(function (p) { p.hidden = true; });
        var panel = document.getElementById(tab.getAttribute("aria-controls"));
        if (panel) panel.hidden = false;
      });
    });

    if (getSession()) showDashboard(); else showAuth();
  }
})();
