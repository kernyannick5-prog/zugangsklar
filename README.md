# Zugangsklar – statische Website

Reines HTML + eine CSS-Datei + kleines Vanilla-JS. Keine Frameworks, kein Build, keine externen Ressourcen. Alle Links sind relativ (läuft unter `/zugangsklar/` und auf eigener Domain).

## Vorschau
`npx --yes http-server . -p 8080` im Ordner `site/`, dann http://localhost:8080/ – mit `?mock=1` (z. B. `/?mock=1`) läuft der Schnellcheck mit `mock/check-example.json` ohne API.

## Konfiguration (`js/config.js`)
- `API_BASE` – Worker-URL (Platzhalter!)
- `PAYMENT_LINKS` – `{report, monitoring, agentur}`; leer = Rechnungs-Fallback
- `ANALYTICS = null` – bewusst kein Tracking

## Sitemap beim Domain-Launch
`sitemap.xml`, `robots.txt` und die `canonical`/`og:url`-Tags verwenden `https://zugangsklar.de/`. Wird eine andere Domain genutzt, Basis ersetzen:

```sh
# BASE ist die einzige Konstante
BASE=https://neue-domain.de/
grep -rl "https://zugangsklar.de/" --include=*.html --include=*.xml --include=*.txt . | xargs sed -i "s#https://zugangsklar.de/#$BASE#g"
```
Nach dem Domain-Wechsel ggf. eine `CNAME`-Datei mit dem Domainnamen anlegen (aktuell bewusst nicht vorhanden).

## Platzhalter
`grep -rn "\[\[PLATZHALTER" .` – alle Stellen, die vor dem Livegang ausgefüllt werden müssen.
