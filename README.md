# Festwerk Stand-App

Web-App (React + Vite) zum Zählen von Bar-Ständen pro Kühlgerät und Veranstaltung.
Läuft im Browser am Handy oder am Sunmi V2 Pro, installierbar als PWA.

## Status: funktionsfähiger MVP

Fertig und getestet (Build läuft sauber):
- Produktpalette anlegen/bearbeiten, inkl. beliebig vieler Gebinde pro Produkt (z.B. "Trag(l) 24er")
- Veranstaltungen anlegen, Produktauswahl pro Veranstaltung
- Kühlgeräte pro Veranstaltung anlegen, automatische Nummerierung K1, K2... / T1, T2...
- Zähl-Flow: ein Produkt pro Screen, groß, Touch-optimiert, Zurück/Weiter
- Live-Warnung bei Minus-Differenz zur letzten Zählung desselben Kühlgeräts (Nachtschwund-Kontrolle)
- Zusammenfassung mit allen Werten + Differenz-Anzeige
- Lokale Persistenz über IndexedDB (übersteht Browser-Neustart, Verbindungsabbruch etc.)

## Offener Punkt: Drucker-Anbindung

`src/lib/printer.js` enthält bereits eine Web-Bluetooth-ESC/POS-Anbindung, aber mit
**Platzhalter-UUIDs**, weil das genaue Bixolon-Modell noch nicht bekannt ist.

Sobald das Modell feststeht:
1. Prüfen, ob es BLE oder klassisches Bluetooth SPP nutzt (Bixolon-Datenblatt oder Typenschild)
2. Bei BLE: Service-/Characteristic-UUID per BLE-Scanner-App (z.B. "nRF Connect") auslesen
   und in `SERVICE_UUID` / `CHARACTERISTIC_UUID` in `printer.js` eintragen
3. Bei klassischem SPP: Web Bluetooth funktioniert NICHT direkt — dann Alternativen prüfen:
   Bixolon-eigene App mit Freigabe-Schnittstelle, oder eine kleine native Wrapper-App

## Setup

```bash
npm install
npm run dev      # lokaler Entwicklungsserver
npm run build    # Produktions-Build nach dist/
```

Für den Zugriff vom Handy im gleichen WLAN: `npm run dev -- --host` und die angezeigte
Netzwerk-URL am Handy öffnen.

## Nächste sinnvolle Schritte (siehe Council-Analyse)

1. Drucker-Modell klären und `printer.js` fertig verdrahten (siehe oben)
2. Testen mit echten Produktdaten und mehrtägiger Veranstaltung (Abend/Morgen-Vergleich)
3. Optional: Hosting z.B. via Vercel/Netlify, damit die App unter einer festen URL
   erreichbar ist und leichter als PWA installiert werden kann (aktuell nur lokal/im
   selben WLAN nutzbar)
4. Optional: Export/Backup der IndexedDB-Daten (z.B. als JSON), falls das Gerät gewechselt wird

## Datenmodell

- `products`: { id, name, gebinde: [{ label, units }] }
- `events`: { id, name, dateStart, dateEnd, productIds: [] }
- `fridges`: { id, eventId, type, label (auto: K1/T1...) }
- `sessions`: { id, eventId, fridgeId, timestamp, label, entries: [{ productId, productName, loose, gebindeCounts, total }] }
