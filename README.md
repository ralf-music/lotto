# Lotto Zentrale v1.2.0

Responsive Lotto-Dashboard für LOTTO 6aus49 und Eurojackpot.

## Neu in v1.1.0
- vollständiges Dashboard-Redesign
- SVG-Logo + Favicon + Web-App-Manifest
- beide Lotterien mit ihren zwei Wochenziehungen sichtbar
- LOTTO-6aus49-Liveparser überarbeitet
- mobile Ansicht neu aufgebaut
- Zahlenfolgenfilter: aus / 2er vermeiden / nur längere vermeiden

## Dateien
- index.html
- styles.css
- app.js
- logo.svg
- favicon.svg
- manifest.webmanifest
- netlify.toml
- netlify/functions/lotto-data.js
- README.md

## Ziehungsrhythmus
- LOTTO 6aus49: Mittwoch 18:25 Uhr und Samstag 19:25 Uhr
- Eurojackpot: Dienstag und Freitag

## v1.1.1
- LOTTO-6aus49-Liveabruf mit LOTTO.de-News-Fallback
- nächste Ziehung inklusive Datum
- aktueller Jackpot je Lotterie
- Maximalgewinn: 50 Mio. € bei LOTTO 6aus49, 120 Mio. € beim Eurojackpot

## v1.1.2
- Smart-Fortwo-II-Vergleich für die Jackpot-Wahrscheinlichkeit
- ca. 140 Mio. Fahrzeuge × 2,70 m ≈ 378.000 km
- Vergleich mit ca. 384.400 km mittlerer Mondentfernung
- gleiche Jackpot-Chance 1:139.838.160 bei LOTTO 6aus49 und Eurojackpot erklärt

## v1.2.0
- ZDFtext 556/557 als Primärquelle für aktuelle LOTTO-6aus49-Ziehungen
- WestLotto als Fallback und Jackpot-Quelle
- Eurojackpot.de bleibt Primärquelle für Eurojackpot
- lokale Speicherung der zuletzt geladenen Ziehungen
- Wahrscheinlichkeitsvergleich einklappbar
- Footer: © 2026 Lotto Zentrale by Snikki
