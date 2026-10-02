# Demo · Paket Premium (299 €) — Café Pistazie

Baut auf [`../pistazie-business/`](../pistazie-business/) (Paket Business, 179 €)
auf und ergänzt den vollen Leistungsumfang von **Paket Premium**: Online-Shop
mit Click & Collect/Lieferung, Gutscheine, Mitgliederbereich mit
Stempelkarte, simulierte Live-API-Widgets, Cookie-Consent mit Kategorien,
DE/EN-Umschalter und priorisierter Support-Chat.

Reservierung, Torten-Vorbestellung, Events-Kalender und Karten-Einwilligung
laufen unverändert über [`../pistazie-business/business.js`](../pistazie-business/business.js)
(gleiches Markup, gleiche IDs) — hier nur um Premium-Zusatzfunktionen ergänzt
(z. B. Vorbestellstatus im Konto). Gemeinsame Bausteine (Kalender, `.ics`,
Formular-Helfer) kommen aus [`../pistazie-shared/`](../pistazie-shared/),
Basis-Styles/-Skript unverändert aus `../demo-basic/`.

## Seiten (12)

- **`index.html`** — Hero, Live-Widgets („Aktuelle Wartezeit“, „Heute frisch,
  knapp“ via simulierter API mit Promise-Latenz), Feature-Teaser, Bewertungen.
- **`angebot.html`** — Karte mit Filter (wie Business) + Verweis auf Shop.
- **`shop.html`** — Produktkatalog aus `data.js` (JS-Array), „Heute frisch,
  knapp“-Hinweise, Merkliste (Herz-Icon), „In den Warenkorb“.
- **`warenkorb.html`** — Mengenänderung, Abholung vs. Lieferung, PLZ-Prüfung
  fürs Liefergebiet (simulierte API, nur PLZ 40xxx/41xxx), Abholzeitfenster.
- **`kasse.html`** — Bestellübersicht, Zahlungsart (PayPal/Karte/Klarna,
  Demo), Bestellbestätigung mit Bestellnummer.
- **`gutschein.html`** — Betrag wählen (Chips oder frei), Empfänger/Absender/
  Nachricht, Live-Vorschau im „PDF-Look“.
- **`reservieren.html`**, **`vorbestellen.html`**, **`events.html`**,
  **`ueber-uns.html`** — wie Paket Business, mit Premium-Chrome (Sprache,
  Cookie-Banner, Chat).
- **`konto.html`** — Login/Registrierung (Demo, `localStorage`), digitale
  Stempelkarte, Bonuspunkte, Bestellhistorie, Torten-Vorbestellstatus,
  Favoriten.
- **`kontakt.html`** — Kontaktformular, Standort, zweistufige
  Karten-Einwilligung.

Auf jeder Seite: Cookie-Banner (unten, volle Breite, Kategorien Notwendig/Statistik/
Marketing), Sprachumschalter DE/EN im Nav (übersetzt Navigation, Hero und
Footer-Kernbereiche — Demo, nicht die komplette Seite), Chat-Widget unten
rechts („Priorisierter Support“), Warenkorb-Zähler im Nav, Demo-Badge unten
links.

## Wo sich die Premium-Merkmale zeigen

| Merkmal | Seite(n) |
|---|---|
| Unbegrenzte Seiten | 12 Seiten in dieser Demo |
| Shop, Click & Collect/Lieferung | `shop.html`, `warenkorb.html`, `kasse.html` |
| Gutscheine | `gutschein.html` |
| Mitgliederbereich (Stempelkarte, Punkte, Historie, Favoriten, Vorbestellstatus) | `konto.html` |
| Live-Widgets über simulierte API | `index.html` (Wartezeit, „Heute frisch“) |
| Cookie-Consent mit Kategorien | Banner auf allen Seiten |
| DE/EN-Umschalter | Header-Nav auf allen Seiten |
| Priorisierter Support | Chat-Widget unten rechts + Footer-Hinweis |
| Vollständige SEO (Canonical, OG, hreflang, JSON-LD, Sitemap, Robots) | Kopfbereich jeder Seite, `sitemap.xml`, `robots.txt` |

## Technik & Datenhaltung

- Kein Build-Schritt, funktioniert per Doppelklick (`file://`).
- Produktkatalog liegt als JS-Array in `data.js` (kein Fetch nötig).
- Warenkorb, Bestellungen, Gutscheine, Konten und Cookie-Zustimmung liegen
  in `localStorage` — **alle Schlüssel sind mit `pistazie-premium:` prefixt**,
  damit sie sich unter `file://` (gemeinsamer Origin für alle Demo-Ordner)
  nicht mit Basic, Business oder anderen Beispiel-Demos im Repo überschneiden.
- „Verfügbarkeit“/PLZ-Prüfung/Live-Widgets laufen über eine kleine
  `simulateApi()`-Hilfsfunktion (`../pistazie-shared/shared.js`): ein Promise
  mit künstlicher Verzögerung, ganz ohne echten Server.
- Demo-Login: Passwörter werden nur lokal (Klartext, `localStorage`)
  geprüft — ausdrücklich kein Sicherheitskonzept, nur Veranschaulichung.

## Start

`index.html` direkt im Browser öffnen. Für den vollen Rundgang: Produkt in
den Warenkorb legen → Warenkorb (Abholung oder PLZ prüfen) → Kasse
abschließen → im Konto (Demo-Zugang) die Bestellung in der Historie sehen.
