# IRONHAUS – Paket Basic (89 €)

Demo-Website der Trainingshalle IRONHAUS im **Basic-Paket**: 1–3 Seiten,
modernes Design, Kontaktformular, mobil optimiert, einfacher Content.

## Seiten

- `index.html` – Hero, Trainingsbereiche, Mitgliedschaft als einfache
  Preisübersicht (ohne Umschalter), Coaches-Teaser (statisches Bildraster)
- `kurse.html` – Statischer Kursüberblick nach Wochentag, ohne Filter
  und ohne Online-Buchung
- `kontakt.html` – Kontakt-/Probetraining-Formular mit Validierung,
  Adresse und Öffnungszeiten

## Funktionen

- Client-seitige Formularvalidierung (Pflichtfelder, E-Mail-Format,
  Datum nicht in der Vergangenheit) mit Erfolgsanzeige
- Sticky Header, mobiles Vollbildmenü, Scroll-Reveal, Statistik-Zähler
  (aus `../ironhaus-shared/shared.js`)
- Keine Kursfilterung, kein Buchungstool, keine Mitgliederbereich –
  bewusst einfach gehalten gemäß Basic-Paket

## Struktur

- `../ironhaus-shared/base.css` – Design/Layout (identisch zu allen Paketen)
- `../ironhaus-shared/components.css` – kleine Zusatzkomponenten (Seitenkopf,
  Paket-Umschalter im Footer)
- `../ironhaus-shared/shared.js` – Header/Menü/Reveal/Formular-Helfer
- `basic.css` / `basic.js` – nur für dieses Paket (Kontaktformular-Logik,
  Coach-Teaser-Grid, Kursübersicht-Layout)

## Hinweis

Fiktives Beispielprojekt. Alle Namen, Adressen und Kontaktdaten sind frei
erfunden (`.example`-Domain). Diese Demo dient dem Vergleich der drei
Website-Pakete (Basic/Business/Premium) am selben Beispielkunden.
