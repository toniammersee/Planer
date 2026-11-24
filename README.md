# Planer

Eine schlanke Planungs-App für **Schule, Arbeit, Lernen, Sport und Sonstiges** – installierbar auf Handy, Tablet und PC, mit **Synchronisierung über dein Google Drive**.

👉 **Einrichtung Schritt für Schritt: [ANLEITUNG-DRIVE.md](ANLEITUNG-DRIVE.md)**

## Funktionen

- **Heute** – alles für heute mit Fortschrittsbalken, überfällige Aufgaben und ein Ausblick auf die nächsten 6 Tage
- **Woche** – Wochenansicht Mo–So, vor/zurück blättern, pro Tag direkt einen Eintrag anlegen (Doppelklick hakt ab)
- **Alle** – komplette Liste nach Datum, wiederkehrende Einträge und Erledigtes getrennt
- **Statistik** – wie viel du diese Woche pro Kategorie erledigt und an Zeit eingeplant hast
- Einträge mit Kategorie, Datum, Uhrzeit von/bis, Priorität, Notizen
- **Wiederholungen**: täglich, werktags (Mo–Fr) oder wöchentlich – jeder Tag wird einzeln abgehakt
- Nach Kategorie filtern
- Hell- und Dunkelmodus
- **Google-Drive-Sync:** Daten liegen als `Planer-Daten.json` in deinem Drive und sind auf allen Geräten gleich
- Export/Import als JSON (zusätzliches Backup)
- Als App installierbar (Android, iPhone, PC) und offline nutzbar (PWA)
- Tastenkürzel: `n` = neuer Eintrag

## Starten

Einfach `index.html` im Browser öffnen. Für Installation aufs Handy und Offline-Modus über einen Webserver ausliefern, z. B.:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Für die Nutzung als App mit Drive-Sync: siehe [ANLEITUNG-DRIVE.md](ANLEITUNG-DRIVE.md) (GitHub Pages + Google Client-ID).

## Tests

```bash
node --test tests/*.test.js
```
