# Kickbox Fortschritts-Tracker (Online)

Web-App zum Abhaken von Techniken, Gürtelgraduierung und Anwesenheit für
Kinder- und Erwachsenentraining. Läuft komplett im Browser — es gibt **keinen
Server und keine Datenbank**. Über GitHub Pages ist die App von überall aus
dem Internet erreichbar.

## Wo liegen die Daten?

**Alle eingegebenen Daten (Mitglieder, Technik-Fortschritt, Anwesenheit)
werden ausschließlich im `localStorage` des jeweiligen Browsers/Geräts
gespeichert.** Es gibt keinen Abgleich zwischen Geräten/Browsern — wer auf
mehreren Geräten einträgt, muss den Stand manuell über den JSON-Export/-Import
(Tab "Daten/Archiv") synchronisieren.

**Wichtig:** Wird der Browser-Speicher gelöscht (z.B. "Browserdaten löschen"),
ein anderer Browser/privater Modus benutzt, oder (bei iOS Safari) die Seite
länger als 7 Tage nicht geöffnet, können die Daten verloren gehen. Deshalb
regelmäßig ein Archiv exportieren!

## Bedienung

- **Nach Kind / Erwachsene:** Mitglied suchen/antippen, Gürtel, Status,
  Wettkämpfer/Sparring-Flags pflegen, Techniken für die nächste Graduierung
  abhaken. Über "➕ Neues … anlegen" lassen sich auch ohne Excel-Import neue
  Mitglieder erfassen.
- **Nach Technik:** eine Technik wählen, dann für die ganze (gefilterte)
  Gruppe abhaken.
- **Übersicht:** Matrix aller Mitglieder x Techniken, anklickbar.
- **Trainingsplan:** 24-Wochen-Plan je Gürtelfarbe (Kind/Erwachsener),
  statischer Inhalt ohne Personendaten.
- **Anwesenheit:** Trainingstermine anlegen/löschen (automatischer Vorschlag
  für Di/Do unter Berücksichtigung bayerischer Feiertage), Anwesenheit je
  Termin abhaken, Monatsübersicht.
- **Mitglieder aktualisieren (Excel):** liest eine `Mitglieder.xlsx` (gleiches
  Format wie bisher) direkt im Browser ein und gleicht sie mit dem aktuellen
  Stand ab (neue Mitglieder ergänzen, ausgetretene inaktiv setzen).
- **Offline-Liste exportieren/importieren:** Excel-Checkliste zum
  handschriftlichen Abhaken ohne Internet, danach wieder einlesen.
- **Mitgliederliste exportieren/importieren (Massenänderung):** Excel zum
  Bearbeiten von Status/Gürtel/Trainingsgruppe für mehrere Mitglieder auf
  einmal.
- **Daten/Archiv:** Exportiert/importiert **den kompletten Datenstand**
  (alle Mitglieder, jedes einzelne abgehakte Technik-Häkchen, alle
  Anwesenheitsdaten) als eine JSON-Datei — zur Sicherung oder Übertragung auf
  ein anderes Gerät.

## Lokal testen

Kein Build-Schritt nötig, aber `fetch()` der statischen JSON-Dateien
funktioniert nicht über `file://`. Einen einfachen lokalen Server starten:

```
npx serve public
```

oder

```
cd public && python -m http.server 8080
```

und dann `http://localhost:…` im Browser öffnen.

## Auf GitHub Pages veröffentlichen

1. Repo auf GitHub anlegen (muss **öffentlich** sein, damit GitHub Pages
   kostenlos funktioniert — siehe Datenschutz-Hinweis unten).
2. Dieses Projekt pushen (siehe Schritte, die euch im Chat mitgeteilt wurden).
3. In den Repo-Einstellungen unter "Pages" als Quelle **"GitHub Actions"**
   wählen — der Workflow unter `.github/workflows/pages.yml` deployt dann bei
   jedem Push auf `main` automatisch den Ordner `public/`.
4. Nach dem ersten erfolgreichen Workflow-Lauf zeigt der Reiter "Actions" bzw.
   die Pages-Einstellungen die Live-URL an (Format
   `https://<username>.github.io/<repo>/`).

## Datenschutz — unbedingt beachten

Dieses Repo enthält **keine echten Mitgliederdaten** (keine Namen,
Geburtsdaten o.ä.) — nur den Techniken-Katalog und die Trainingspläne, die
keine Personendaten sind. Die App startet daher leer.

Um euren echten, bisherigen Datenstand (aus der alten Server-Version) zu
übernehmen: einmalig als JSON-Archiv exportieren/konvertieren und über
"Daten/Archiv → Daten importieren" **direkt im Browser** einspielen. Diese
Daten verlassen danach euer Gerät nicht mehr automatisch — sie werden **nicht**
committet oder hochgeladen. Ladet niemals eine Datei mit echten
Mitgliederdaten (Excel oder JSON) ins Repo hoch.

## Statische Trainingsdaten neu erzeugen

Falls sich der Trainingsplan ändert (`Kinder-Anfänger-Training.xlsx` /
`Erwachsene-Training.xlsx`, außerhalb dieses Repos gepflegt):

```
npm install
npm run generate-static-data
```

Das Skript erwartet die beiden Excel-Dateien im übergeordneten Ordner
(gleiche Struktur wie beim bisherigen Server-Projekt) und schreibt
`public/data/techniques.json`, `public/data/trainingsplan-kind.json` und
`public/data/trainingsplan-erwachsener.json` neu. Anschließend committen.

## Browser-Kompatibilität / Einschränkungen

- Keine Synchronisierung zwischen Geräten — siehe oben.
- Excel-Import/Export läuft über [SheetJS](https://sheetjs.com) direkt im
  Browser (per CDN eingebunden).
- Für `Mitglieder.xlsx`-Import muss die Datei dasselbe Spaltenformat wie
  bisher haben (Spalte "Nr." als Kopfzeile der Mitgliedertabelle).
