---
name: debug-systematic
description: Systematisches Debugging — reproduziere, isoliere und fixe Bugs methodisch.
argument-hint: "<fehlerbeschreibung>"
user-invocable: true
---

Systematisches Debugging für: $ARGUMENTS

Folge dem wissenschaftlichen Debug-Prozess:

1. **Reproduziere:** Was genau passiert? Was sollte passieren?
2. **Hypothesen:** Liste 3-5 mögliche Ursachen auf, sortiert nach Wahrscheinlichkeit
3. **Isoliere:** Teste jede Hypothese:
   - Lies relevanten Code
   - Suche nach: Typos, Logikfehler, Race Conditions, fehlende Null-Checks
   - Prüfe: Logs, Error Messages, Stack Traces
4. **Root Cause:** Identifiziere die tatsächliche Ursache
5. **Fix:** Implementiere die minimale Korrektur
6. **Verify:** Stelle sicher dass der Fix funktioniert und keine Regression einführt
7. **Prevent:** Schlage einen Test vor der diesen Bug in Zukunft fängt

WICHTIG: Kein "Shotgun Debugging" — nicht blind Dinge ändern. Erst verstehen, dann fixen.
