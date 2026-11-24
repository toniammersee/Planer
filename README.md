# Planer

Eine schlanke Planungs-App für **Schule, Arbeit, Lernen, Sport und Sonstiges** – ohne Anmeldung, ohne Server. Alle Daten bleiben auf deinem Gerät (im Browser gespeichert).

## Funktionen

- **Heute** – alles für heute mit Fortschrittsbalken, überfällige Aufgaben und ein Ausblick auf die nächsten 6 Tage
- **Woche** – Wochenansicht Mo–So, vor/zurück blättern, pro Tag direkt einen Eintrag anlegen (Doppelklick hakt ab)
- **Alle** – komplette Liste nach Datum, wiederkehrende Einträge und Erledigtes getrennt
- **Statistik** – wie viel du diese Woche pro Kategorie erledigt und an Zeit eingeplant hast
- Einträge mit Kategorie, Datum, Uhrzeit von/bis, Priorität, Notizen
- **Wiederholungen**: täglich, werktags (Mo–Fr) oder wöchentlich – jeder Tag wird einzeln abgehakt
- Nach Kategorie filtern
- Hell- und Dunkelmodus
- Export/Import als JSON (Backup oder Umzug auf ein anderes Gerät)
- Auf dem Handy installierbar und offline nutzbar (PWA)
- Tastenkürzel: `n` = neuer Eintrag

## Starten

Einfach `index.html` im Browser öffnen. Für Installation aufs Handy und Offline-Modus über einen Webserver ausliefern, z. B.:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Oder kostenlos mit **GitHub Pages** veröffentlichen: Repository → *Settings* → *Pages* → Branch auswählen → Speichern. Danach die Seite auf dem Handy öffnen und „Zum Startbildschirm hinzufügen“ wählen.

> Hinweis: Die Daten liegen im Browser des jeweiligen Geräts. Nutze „Daten exportieren“ im Menü (⋯) für Backups.
