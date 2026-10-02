# Demo · Paket Business (179 €) — Café Pistazie

Ausbaustufe von [`../demo-basic/`](../demo-basic/) (Paket Basic, 89 €):
dieselbe Marke, dieselben Design-Tokens, Header/Hero/Komponenten — aber mit
dem vollen Leistungsumfang von **Paket Business**: individuelles Design,
bis zu 8 Seiten, Buchungstool, Drittanbieter-Integrationen (Kalender/
Newsletter), Basic-SEO und Support nach Launch.

Gemeinsame Bausteine (Kalender-Widget, .ics-Export, Formular-Helfer,
Newsletter, Bewertungs-Widget) liegen in [`../pistazie-shared/`](../pistazie-shared/)
und werden hier sowie in `../pistazie-premium/` wiederverwendet. Styles und
Basis-Skript (Menü, Öffnungszeiten-Pill, Kontaktformular, Impressum/
Datenschutz-Dialoge, Vitrinen-Filter, Scroll-Reveal) kommen unverändert aus
`../demo-basic/styles.css` und `../demo-basic/script.js`.

## Seiten (7)

- **`index.html` (Start)** — Hero, Kurzvorstellung, Teaser für die drei
  neuen Online-Services, Vitrinen-Teaser, Bewertungs-Widget, Öffnungszeiten.
- **`angebot.html` (Angebot/Karte)** — vollständige Vitrine mit Kategorie-
  filter, Brunch-Menü mit Link zur Reservierung, Kaffee-Ursprünge.
- **`reservieren.html` (Brunch &amp; Tischreservierung)** — Buchungstool in
  4 Schritten: Kalender mit Verfügbarkeit, Uhrzeit-Slots, Personenzahl,
  Kontaktdaten, Übersicht, Bestätigung mit Referenznummer und `.ics`-Download.
- **`vorbestellen.html` (Torten vorbestellen)** — Konfigurator (Torte,
  Größe, Anzahl, Abholdatum ab +2 Tagen) mit automatischer Live-
  Preisberechnung und Bestätigungsseite.
- **`events.html` (Events/Workshops)** — Kalenderansicht mit markierten
  Terminen, Liste der Workshops mit „Zum Kalender hinzufügen (.ics)“.
- **`ueber-uns.html` (Über uns/Galerie)** — Geschichte, Team, Fotogalerie
  (aus `10-cafe` übernommene Bilder).
- **`kontakt.html` (Kontakt)** — Kontaktformular, Standort/Öffnungszeiten,
  zweistufige Einwilligung für die Kartenvorschau (Datenschutz).

Footer auf allen Seiten: Newsletter-Anmeldung (Demo-Double-Opt-in „wie bei
Brevo“), Hinweis „Support inklusive“, Paket-Umschalter (Basic · Business ·
Premium) und Demo-Badge.

## Wo sich die Business-Merkmale zeigen

| Merkmal | Seite(n) |
|---|---|
| Individuelles Design, bis zu 8 Seiten | alle 7 Seiten, eigene Komponenten in `../pistazie-shared/shared.css` |
| Kontaktformular / Buchungstool | `kontakt.html`, `reservieren.html` |
| Drittanbieter-Integration Kalender (.ics) | `reservieren.html`, `events.html` |
| Drittanbieter-Integration Newsletter | Footer aller Seiten (`newsletter-form`) |
| Basic-SEO (Title/Meta/Canonical/OG/JSON-LD, Sitemap, Robots) | Kopfbereich jeder Seite, `sitemap.xml`, `robots.txt` |
| Support nach Launch | Footer-Hinweis „Support inklusive“ |

## Technik

- Kein Build-Schritt, funktioniert per Doppelklick (`file://`).
- Kalender, Preisberechnung, Formularvalidierung und `.ics`-Export laufen
  vollständig clientseitig (`business.js` + `../pistazie-shared/shared.js`).
  Es werden keine echten Daten übertragen oder gespeichert (außer den
  Cookie-Consent-/Warenkorb-Fällen im Paket Premium).
- „Verfügbarkeit“ bei Reservierung und Terminen ist ein deterministisches
  Demo-Muster (kein Zufall bei jedem Rendern), damit sich das Verhalten beim
  Testen nachvollziehen lässt.

## Start

`index.html` direkt im Browser öffnen.
