---
name: decision-log
description: Entscheidung dokumentieren — erfasst Kontext, Optionen, Begründung und trägt in MASTERPLAN ein.
argument-hint: "<entscheidung>"
user-invocable: true
---

Entscheidung dokumentieren: $ARGUMENTS

1. **Erfasse:**
   - **Datum:** !`date +%Y-%m-%d`
   - **Entscheidung:** $ARGUMENTS
   - **Kontext:** Warum stand diese Entscheidung an?
   - **Alternativen:** Welche Optionen gab es?
   - **Begründung:** Warum diese Option?
   - **Auswirkung:** Was ändert sich dadurch?

2. **Trage ein** in MASTERPLAN.md → Decision Log:
   ```
   | Datum | Entscheidung | Begründung |
   ```

3. **Aktualisiere** betroffene Projekt-Dateien falls nötig
4. **Committe** die Änderung
