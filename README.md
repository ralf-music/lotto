# Lotto Zentrale v1.0.0

Statische HTML/CSS/JavaScript-Webseite mit Netlify Function für Live-Ziehungsdaten.

## Enthalten
- LOTTO 6aus49 Generator
- Eurojackpot Generator
- 1–6 Tipps
- Statistik-Einfluss 0–100 %
- Wiederholungen zwischen Tipps reduzieren / vermeiden
- 2er-Zahlenfolgen vermeiden
- Musterfilter
- Gerade/Ungerade- und Hoch/Niedrig-Balance
- Tipp-Fixierung
- Hot/Normal/Cold Übersicht
- aktuelle + letzte 5 Ziehungen UI
- lokale Speicherung der Einstellungen
- Versionsanzeige + Changelog

## Dateien
- index.html
- styles.css
- app.js
- netlify.toml
- netlify/functions/lotto-data.js

## Netlify
Ordnerinhalt unverändert in ein GitHub-Repository legen und mit Netlify deployen.
Die Function ist unter `/.netlify/functions/lotto-data` erreichbar.

## Hinweis zu V1
Die aktuelle Ziehung wird über offizielle Webseiten abgefragt. Historische Häufigkeitswerte
sind in V1 als lokale, leicht gewichtete Fallback-Werte eingebaut. Die Architektur ist so
getrennt, dass in einem Folgeupdate ein stabiler Statistikfeed ergänzt werden kann, ohne
den Generator neu zu schreiben.

Historische Häufigkeiten verändern die mathematische Chance einer zukünftigen Ziehung nicht.
