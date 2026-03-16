---
name: search-replace
description: Intelligentes Suchen und Ersetzen über die gesamte Codebase — mit Kontext und Vorschau.
argument-hint: "<suche> -> <ersetze>"
user-invocable: true
---

Search & Replace: $ARGUMENTS

1. **Parse** das Argument: "alt -> neu" oder "alt → neu"
2. **Suche** in der gesamten Codebase nach allen Vorkommen
3. **Zeige** jeden Fund mit Kontext (3 Zeilen davor/danach):
   ```
   datei.ts:42  alt → neu
   datei.ts:87  alt → neu
   ```
4. **Frage:** "Alle X Vorkommen ersetzen? Oder einzeln bestätigen?"
5. **Ersetze** nach Bestätigung
6. **Verifiziere** dass nichts kaputt ist (Syntax-Check, Tests falls vorhanden)
