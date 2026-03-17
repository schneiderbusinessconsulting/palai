---
name: refactor
description: Systematisches Refactoring mit Begründung. Verbessert Code-Qualität ohne Funktionsänderung.
argument-hint: "<datei oder funktion>"
user-invocable: true
---

Refactoring für: $ARGUMENTS

1. **Lies den Code** und identifiziere Refactoring-Kandidaten:
   - Duplizierter Code (DRY-Verletzung)
   - Zu lange Funktionen (>30 Zeilen)
   - Zu viele Parameter (>4)
   - Verschachtelte Conditionals (>3 Ebenen)
   - Magic Numbers / Strings
   - Unklare Benennung
   - Fehlende Typisierung

2. **Priorisiere** nach Impact: Was bringt die größte Verbesserung?

3. **Für jeden Refactoring-Schritt:**
   - Zeige VORHER → NACHHER
   - Erkläre WARUM (welches Prinzip)
   - Stelle sicher: Verhalten ändert sich NICHT

4. **Führe durch** nach Bestätigung, Schritt für Schritt
5. **Verifiziere** dass Tests noch grün sind (falls vorhanden)
