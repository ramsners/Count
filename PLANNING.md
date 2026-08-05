# Festwerk Stand-App — Spezifikation für nächste Ausbaustufe

Dieses Dokument fasst alle Anforderungen zusammen, die über den aktuellen MVP
hinausgehen (siehe README.md für den bereits umgesetzten Stand). Gedacht als
Übergabe an Claude Code für die Weiterentwicklung.

## 1. Zugriffskonzept

- **Owner-Account (Simon)**: einziger echter Login mit E-Mail/Passwort (z.B. über
  Supabase Auth). Voller Zugriff auf alle Veranstaltungen, Produkte, Kühlgeräte,
  Zählungen, Fotos.
- **Team-Zugang ohne Account**: pro Veranstaltung und Tag generiert der Owner einen
  QR-Code. Wer den Code scannt, kommt direkt in die Veranstaltung hinein und kann
  **alle** Kühlgeräte der Veranstaltung zählen (keine Einschränkung auf bestimmte
  Geräte) — es ist ein reiner Tages-/Event-Zugangscode, keine granulare Zuweisung.
- Der QR-Code / Link läuft automatisch ab, sobald der Tag bzw. die Veranstaltung
  vorbei ist.
- **Sperre "ein offenes Kühlgerät gleichzeitig"**: Damit sich nicht zwei Leute
  gleichzeitig am selben Kühlgerät verzählen oder Daten überschreiben, darf pro
  Veranstaltung immer nur **ein** Kühlgerät gleichzeitig "in Bearbeitung" sein.
  - Sobald jemand ein Kühlgerät zum Zählen öffnet, wird es serverseitig als
    "gesperrt" markiert (z.B. mit User-/Session-Kennung + Zeitstempel).
  - Andere sehen in der Kühlgeräte-Liste sofort "Wird gerade von [Name/Gerät]
    gezählt" und können es nicht gleichzeitig öffnen.
  - Die Sperre löst sich automatisch, wenn die Zählung abgeschlossen wird, der
    Nutzer abbricht, oder nach einem Timeout (z.B. 20 Minuten Inaktivität), damit
    ein abgebrochener Vorgang nicht dauerhaft blockiert.

## 2. Anfangsstand / Endstand statt reiner Zeitstempel-Logik

- Vor jedem Zähl-Flow wählt man explizit: **Anfangsstand** oder **Endstand**.
- Der Nachtschwund-Vergleich verwendet nicht mehr "letzte Zählung egal welcher
  Art", sondern konkret: letzter **Endstand** eines Kühlgeräts → Basis für den
  nächsten **Anfangsstand** desselben Geräts.

## 3. Korrektur-Modus statt Doppel-Zählung

- Existiert für ein Kühlgerät am heutigen Tag bereits eine Zählung desselben Typs
  (z.B. schon ein Anfangsstand erfasst) und der Typ wird nochmal gewählt, öffnet
  sich **kein** kompletter Zähl-Flow von neuem, sondern:
  1. Frage: "Möchtest du ein Produkt korrigieren?"
  2. Liste aller bereits gezählten Produkte dieser Session
  3. Auswahl des einen Produkts, direkter Sprung zu dessen Zähl-Screen
  4. Korrektur wird gespeichert, Rest der Session bleibt unverändert

## 4. Foto-Dokumentation pro Zählung

- Nach Abschluss eines Zähl-Vorgangs: Hinweis/Prompt "Foto vom Kühlgerät machen?"
- Foto wird mit der jeweiligen Session verknüpft und in der Datenbank/im Storage
  gespeichert (z.B. Supabase Storage, referenziert über session_id).
- Beim nächsten Zählen desselben Kühlgeräts kann das Foto der letzten Zählung
  direkt zum Vergleich angezeigt werden (nebeneinander oder zum Aufklappen), damit
  man visuell prüfen kann, ob z.B. eine ganze Produktreihe fehlt — nicht nur über
  die reine Zahlen-Differenz.

## 5. Backend-Umstellung (Voraussetzung für 1., 3., 4. und Mehrgeräte-Zählen)

Der aktuelle MVP speichert alles rein lokal in IndexedDB im Browser — das reicht
nicht mehr, sobald mehrere Personen gleichzeitig von verschiedenen Geräten aus
zählen sollen (Simon + Team via QR-Code).

Empfehlung: **Supabase** (Postgres + Auth + Storage), da:
- Auth für den Owner-Login bereits eingebaut ist
- Row Level Security sich gut eignet, um Owner-Rechte vs. QR-Zugriff sauber zu
  trennen
- Storage für die Fotos direkt mitkommt
- Realtime-Subscriptions sich anbieten, um die "Kühlgerät gesperrt"-Anzeige live
  zu synchronisieren, ohne Polling

Migrationsschritte (grob):
1. Supabase-Projekt aufsetzen, Tabellen analog zum bestehenden IndexedDB-Schema
   anlegen (products, events, fridges, sessions + neu: fridge_locks, session_photos,
   event_access_codes)
2. `src/lib/db.js` auf Supabase-Client umstellen (Funktionssignaturen möglichst
   gleich lassen, damit die Seiten-Komponenten kaum angepasst werden müssen)
3. Auth-Flow für den Owner ergänzen (Login-Screen, geschützte Routen)
4. QR-Code-Generierung + öffentliche, zeitlich begrenzte Zugriffs-Route ohne Login
   für Team-Mitglieder ergänzen
5. Foto-Upload in den Zähl-Abschluss-Flow einbauen
6. Sperr-Mechanismus für Kühlgeräte (Lock beim Öffnen, Freigabe beim
   Abschließen/Timeout) mit Supabase Realtime für Live-Anzeige

## 6. Bereits im MVP vorhanden (nicht mehr offen)

Siehe README.md — Produktpalette, Veranstaltungen, Kühlgeräte-Anlage mit K/T-
Nummerierung, Zähl-Flow mit Zurück/Weiter, Live-Minus-Warnung, Zusammenfassung.
Die Drucker-Anbindung (Bixolon, ESC/POS über Web Bluetooth) ist vorbereitet in
`src/lib/printer.js`, wartet aber noch auf das genaue Gerätemodell.
