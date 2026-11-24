# Planer als App mit Google-Drive-Sync einrichten

Einmalig ca. 15 Minuten. Danach hast du die App auf allen Geräten (Handy, Tablet, PC) und deine Einträge liegen als Datei **Planer-Daten.json** in deinem Google Drive.

---

## Schritt 1: App online stellen (GitHub Pages)

1. Öffne <https://github.com/toniammersee/Planer> → **Settings** → links **Pages**.
2. Bei **Source** wählst du **Deploy from a branch**.
3. Bei **Branch** wählst du `claude/planning-app-tasks-sjml97` (oder `main`, falls du die Änderungen schon dorthin übernommen hast) und den Ordner `/ (root)` → **Save**.
4. Nach 1–2 Minuten ist die App erreichbar unter:
   **<https://toniammersee.github.io/Planer/>**

> Deine Einträge landen **nicht** auf GitHub – nur der Programmcode. Die Daten bleiben auf deinem Gerät und in deinem Drive.

---

## Schritt 2: Google Client-ID erstellen

Damit die App in dein Drive schreiben darf, braucht sie eine eigene „Client-ID“ von Google. Die ist kostenlos.

1. Öffne die **Google Cloud Console**: <https://console.cloud.google.com/> (mit deinem Google-Konto anmelden).
2. Oben auf die Projektauswahl klicken → **Neues Projekt** → Name `Planer` → **Erstellen**. Danach das Projekt auswählen.
3. **Google Drive API aktivieren:** Suche oben nach „Google Drive API“ → öffnen → **Aktivieren**.
4. **Anmeldebildschirm einrichten:** Suche nach „Google Auth Platform“ (oder *APIs & Dienste → OAuth-Zustimmungsbildschirm*) → **Jetzt starten**:
   - App-Name: `Planer`
   - Support-E-Mail: deine E-Mail-Adresse
   - Zielgruppe: **Extern**
   - Kontakt-E-Mail: deine E-Mail-Adresse → zustimmen → **Erstellen**
5. **Dich selbst als Testnutzer eintragen:** Links auf **Zielgruppe** → bei *Testnutzer* auf **Nutzer hinzufügen** → deine Gmail-Adresse eintragen → **Speichern**.
6. **Client erstellen:** Links auf **Clients** → **Client erstellen**:
   - Anwendungstyp: **Webanwendung**
   - Name: `Planer Web`
   - **Autorisierte JavaScript-Quellen** → **URI hinzufügen**: `https://toniammersee.github.io`
     (genau so, ohne `/Planer` und ohne `/` am Ende)
   - Weiterleitungs-URIs: leer lassen
   - **Erstellen**
7. Kopiere die angezeigte **Client-ID**. Sie sieht ungefähr so aus:
   `123456789012-abc123def456.apps.googleusercontent.com`

> Die Client-ID ist **kein Passwort** und darf öffentlich sein. Es gibt kein Client-Secret, das du brauchst.

---

## Schritt 3: In der App verbinden

1. Öffne <https://toniammersee.github.io/Planer/>.
2. Tippe oben auf **☁ Drive** (oder Menü **⋯ → Google Drive …**).
3. Füge die Client-ID ein → **Mit Google verbinden**.
4. Google zeigt ggf. **„Google hat diese App nicht überprüft“** – das ist normal, weil es deine eigene App ist: **Weiter** (bzw. *Erweitert → Zu Planer wechseln*) → Zugriff erlauben.
5. Oben erscheint **☁ ✓** – fertig. In deinem Drive liegt jetzt `Planer-Daten.json`.

**Tipp:** Damit du die Client-ID nicht auf jedem Gerät neu eintippen musst, trag sie in `config.js` ein (oder schick sie mir, dann mache ich das). Dann reicht auf jedem Gerät ein Tipp auf „Mit Google verbinden“.

---

## Schritt 4: Als App installieren

| Gerät | So geht's |
|---|---|
| **Android (Chrome)** | Seite öffnen → Menü ⋮ → **App installieren** / **Zum Startbildschirm hinzufügen** |
| **iPhone / iPad (Safari)** | Seite öffnen → Teilen-Symbol → **Zum Home-Bildschirm** |
| **PC / Mac (Chrome, Edge)** | Seite öffnen → Installieren-Symbol rechts in der Adressleiste |

Danach auf jedem Gerät einmal **☁ Drive → Mit Google verbinden**.

---

## Gut zu wissen

- **Synchronisiert wird automatisch:** beim Öffnen, kurz nach jeder Änderung, jede Minute und wenn du zur App zurückkehrst.
- **Offline geht auch:** Änderungen werden hochgeladen, sobald du wieder online bist.
- **„Verbinden“ oben?** Google erlaubt Web-Apps ohne eigenen Server nur Anmeldungen für **1 Stunde**. Danach zeigt der Knopf „Verbinden“ – ein Tipp, und es geht weiter (ohne erneute Nachfrage).
- **Datenschutz:** Die App bekommt nur das Recht „drive.file“ – sie sieht ausschließlich Dateien, die sie selbst angelegt hat, nicht den Rest deines Drives.
- **Gleichzeitig auf zwei Geräten geändert?** Unterschiedliche Einträge werden zusammengeführt. Wurde derselbe Eintrag auf beiden Geräten bearbeitet, gewinnt die neuere Änderung.
- **Trennen:** ⋯ → Google Drive → **Trennen**. Die Daten bleiben auf dem Gerät und im Drive.
- **iPhone:** Falls die Google-Anmeldung in der installierten Home-Bildschirm-App nicht klappt, verbinde einmal direkt in Safari.

### Probleme?

| Meldung | Lösung |
|---|---|
| `redirect_uri_mismatch` / `origin_mismatch` | Bei der Client-ID ist die JavaScript-Quelle falsch. Genau `https://toniammersee.github.io` eintragen. Kann ein paar Minuten dauern, bis es greift. |
| `access_denied` / „Zugriff blockiert“ | Deine Gmail-Adresse fehlt unter *Zielgruppe → Testnutzer*. |
| `Drive-Fehler 403 … API has not been used` | Die **Google Drive API** ist im Projekt nicht aktiviert (Schritt 2.3). |
| Popup erscheint nicht | Popup-Blocker für die Seite erlauben. |
