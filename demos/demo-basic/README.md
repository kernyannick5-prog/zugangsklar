# Demo · Paket Basic (89 €) — Café Pistazie

Eigenständige 3-Seiten-Demo auf Basis von [`10-cafe/`](../../10-cafe/) (Café
Pistazie), die den Leistungsumfang von **Paket Basic** zeigt: 1–3 Seiten,
modernes Design, Kontaktformular, mobil optimiert, einfacher Content.
Kein Buchungs-/Bestelltool, keine Newsletter-Integration, kein Shop.

## Seiten

- **`index.html` (Start)** — Hero mit Live-Öffnungsstatus-Pill, kurze
  Vorstellung, Vitrinen-Teaser (3 Produkte mit Link zur ganzen Karte) und
  eine kompakte Öffnungszeiten-Tabelle.
- **`angebot.html` (Angebot)** — vollständige Vitrine mit Kategoriefilter
  (Alle/Macarons/Tartes/Kaffee), Brunch-Menü am Wochenende und die drei
  Kaffee-Ursprünge. Reiner Informationscharakter, keine Bestellfunktion.
- **`kontakt.html` (Kontakt)** — Kontaktformular (Name, E-Mail, Nachricht)
  mit clientseitiger Validierung, Adresse & Öffnungszeiten sowie eine
  statische, selbstgezeichnete Kartenskizze (SVG) zur groben Orientierung.

Header, Navigation (inkl. mobilem Slide-down-Menü und `aria-current="page"`
für die aktive Seite) und Footer mit Impressum-/Datenschutz-Dialog sind auf
allen drei Seiten identisch eingebunden.

## Wo sich die Basic-Merkmale zeigen

| Merkmal | Seite(n) |
|---|---|
| 1–3 Seiten | `index.html`, `angebot.html`, `kontakt.html` |
| Modernes Design | Pastell-Farbwelt, DM Serif Display/Nunito Sans, weiche Formen (aus `10-cafe` übernommen) |
| Kontaktformular | `kontakt.html` — Name/E-Mail/Nachricht, clientseitige Validierung, keine echte Übertragung |
| Mobil optimiert | Alle Seiten — Hamburger-Menü unter 760 px, responsive Grids (getestet 375/768/1440 px) |
| Einfacher Content | Kurze Texte, keine Instagram-Galerie, kein Vorbestell-/Buchungsformular, keine Newsletter-Anmeldung |

## Entfernt gegenüber `10-cafe/`

- Torten-Vorbestellformular (Kalender-Mindestdatum, Kuchenauswahl) —
  durch das einfache Kontaktformular ersetzt.
- Instagram-artige Foto-Galerie.
- „Tisch reservieren“-Mailto-CTA im Brunch-Abschnitt — verweist stattdessen
  auf die Kontaktseite.

## Demo-Kennzeichnung

Jede Seite bindet `../shared/paket-badge.css` ein und zeigt unten links das
Badge „Demo · Paket Basic · 89 €“ mit Link zum Pakete-Vergleich
(`../index.html#vergleich`). Der Footer hat dafür zusätzlichen
Bottom-Padding, damit nichts verdeckt wird.

## Start

Kein Build-Schritt nötig — `index.html` direkt im Browser öffnen.
