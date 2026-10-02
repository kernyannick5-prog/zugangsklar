# IRONHAUS – Paket Premium (299 €)

Demo-Website der Trainingshalle IRONHAUS im **Premium-Paket**: unbegrenzt
Seiten, individuelles Design, Shop, Mitgliederbereich, SEO-Vollausbau,
Tool-/API-Integrationen (simuliert) und Priority Support.

## Seiten

Alle Seiten aus dem Business-Paket, zusätzlich erweitert:

- `index.html` – Start mit Live-Auslastungs-Widget, Feature-Teaser, Bewertungen, Newsletter
- `training.html` – Trainingsbereiche + Live-Auslastung
- `kursplan.html` – Kursplan mit **simulierter Live-Kapazität** (asynchrone
  Anfrage mit künstlicher Latenz) und **Warteliste** bei ausgebuchten Kursen
- `mitgliedschaft.html` – 3 Pläne, Monatlich/Jährlich-Umschalter
- `coaches.html` – Vollständige Coach-Profile
- `probetraining.html` – Terminbuchung mit Datum/Uhrzeit + Kalender-Download
- `kontakt.html` – Formular + Karten-Consent
- `blog.html` – Beispiel-Artikel
- `mitglieder.html` – **Mitgliederbereich** (Demo-Login via `localStorage`):
  Dashboard mit gebuchten Kursen, Check-in-Verlauf, Trainingsstatistik als
  SVG-Balkendiagramm, Mitgliedschafts-/Vertragsinfo, Rechnungen (Demo-Download)
  und Wearable-/App-Sync-Demo (Garmin/Apple Health)
- `shop.html` – **Shop** mit Produktraster, Warenkorb (persistiert in
  `localStorage`), Mengenanpassung und Checkout-Demo mit Zahlungsmethodenwahl
  und Bestellbestätigung

## Premium-spezifische Funktionen

- Simulierte Live-Kapazität im Kursplan (Promise + künstliche Latenz statt
  echtem Server) inkl. Wartelisten-Buchung
- Live-Auslastungs-Widget ("Auslastung jetzt: … %") mit periodischer
  Aktualisierung (Demo-Zufallswerte)
- Mitgliederbereich mit Login-Simulation, Trainingsstatistik-Diagramm (Inline-
  SVG), Rechnungs-Demo-Downloads, Wearable-Sync-Umschalter
- Shop mit Warenkorb, Mengenänderung, Checkout mit Zahlungsmethodenauswahl,
  Bestellbestätigung mit Bestellnummer
- Cookie-Consent-Banner mit Kategorien (Notwendig/Statistik/Marketing),
  Entscheidung wird nur lokal gespeichert
- Priority-Support-Chat-Widget unten rechts (Demo-Antworten)
- Alles läuft vollständig clientseitig (localStorage, `Promise` + `setTimeout`
  statt `fetch`) – funktioniert offline per Doppelklick auf `index.html`

## SEO (voller Ausbau laut Paket)

- Pro Seite `<title>`, `<meta description>`, `<link rel="canonical">`,
  `hreflang`-Alternates
- JSON-LD `ExerciseGym`/`LocalBusiness` (Start) und `BreadcrumbList` (Shop)
- `sitemap.xml` und `robots.txt`; `mitglieder.html` bewusst per `noindex` /
  `Disallow` ausgeschlossen (Login-Bereich)

## Struktur

- `../ironhaus-shared/base.css`, `components.css` – gemeinsames Design/Layout
- `../ironhaus-shared/shared.js` – Header/Menü/Reveal/Formular-Helfer
- `../ironhaus-shared/data.js` – gemeinsame Kurs-/Coach-/Bewertungs-/Produktdaten
- `premium.css` / `premium.js` – nur für dieses Paket (Kursplan mit Live-
  Kapazität &amp; Warteliste, Mitgliederbereich, Shop/Warenkorb/Checkout,
  Cookie-Consent, Chat-Widget, Auslastungs-Widget)

## Bekannte Einschränkungen (Demo)

- Login, Zahlungen, Kalender- und Wearable-Sync sind reine Frontend-Demos
  ohne echten Server/Backend – Daten liegen nur in `localStorage` des Browsers.
- Rechnungs-Downloads erzeugen einfache `.txt`-Dateien statt echter PDFs.

## Hinweis

Fiktives Beispielprojekt. Alle Namen, Adressen und Kontaktdaten sind frei
erfunden (`.example`-Domain). Diese Demo dient dem Vergleich der drei
Website-Pakete (Basic/Business/Premium) am selben Beispielkunden.
