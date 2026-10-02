# IRONHAUS – Paket Business (179 €)

Demo-Website der Trainingshalle IRONHAUS im **Business-Paket**: bis zu 8
Seiten, individuelles Design, Buchungstool, Basic-SEO, Drittanbieter-
Integrationen (Kalender/Newsletter) und Support nach Launch inklusive.

## Seiten

- `index.html` – Start mit Hero, Feature-Teaser, Bewertungs-Widget, Newsletter
- `training.html` – Alle Trainingsbereiche im Detail
- `kursplan.html` – Filterbarer Kursplan **inkl. Online-Buchung** (Modal mit
  Name/E-Mail) und **.ics-Download** für den Kalender; zeigt freie Plätze
- `mitgliedschaft.html` – 3 Pläne mit **Monatlich/Jährlich-Umschalter**
- `coaches.html` – Vollständige Coach-Profile mit Spezialisierungen
- `probetraining.html` – Terminbuchung mit **Datums- und Uhrzeitwahl**
  (simulierte Auslastung), Bestätigung + Kalender-Download
- `kontakt.html` – Kontaktformular + **einwilligungsbasierter Karten-
  Platzhalter** (DSGVO-Demo: Karte wird erst nach Zustimmung "geladen")
- `blog.html` – 3 Beispiel-Artikel (optional laut Paketbeschreibung)

## Funktionen & Integrationen

- Kursbuchung mit Bestätigung + „Zum Kalender hinzufügen" (.ics, clientseitig
  erzeugt – kein externer Kalenderdienst nötig)
- Newsletter-Anmeldung (Demo, keine echte Zustellung)
- Bewertungs-Widget mit Durchschnitt und Einzelbewertungen
- Kontaktformular mit Validierung, Karten-Consent-Schalter
- Alles läuft vollständig clientseitig (localStorage für Buchungen), keine
  Server-Anfragen nötig – funktioniert offline per Doppelklick auf `index.html`

## SEO (Basic-SEO laut Paket)

- Pro Seite eigener `<title>`, `<meta description>`, `<link rel="canonical">`
- Open-Graph-Tags auf der Startseite
- JSON-LD (`ExerciseGym`) mit Adresse und Öffnungszeiten
- `sitemap.xml` und `robots.txt` im Projektordner

## Struktur

- `../ironhaus-shared/base.css`, `components.css` – gemeinsames Design/Layout
- `../ironhaus-shared/shared.js` – Header/Menü/Reveal/Formular-Helfer
- `../ironhaus-shared/data.js` – gemeinsame Kurs-/Coach-/Bewertungsdaten
- `business.css` / `business.js` – nur für dieses Paket (Buchung, Kursfilter,
  Mitgliedschafts-Umschalter, Probetraining-Slots, Kontakt-Consent, Newsletter,
  Bewertungs-Widget)

## Hinweis

Fiktives Beispielprojekt. Alle Namen, Adressen und Kontaktdaten sind frei
erfunden (`.example`-Domain). Diese Demo dient dem Vergleich der drei
Website-Pakete (Basic/Business/Premium) am selben Beispielkunden.
