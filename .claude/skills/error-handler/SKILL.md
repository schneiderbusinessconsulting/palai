---
name: error-handler
description: Fehlerbehandlung verbessern — fügt robustes Error Handling, Logging und Recovery hinzu.
argument-hint: "<datei>"
user-invocable: true
---

Error Handling verbessern für: $ARGUMENTS

1. **Analysiere** den Code auf:
   - Unbehandelte Exceptions / Promise Rejections
   - Fehlende try/catch Blöcke
   - Generische catch-all ohne spezifische Behandlung
   - Fehlende Validierung von Inputs
   - Fehlende Null/Undefined Checks

2. **Verbessere** mit:
   - Spezifische Error-Typen (nicht nur `Error`)
   - Sinnvolle Error Messages (was ging schief, was tun?)
   - Graceful Degradation wo möglich
   - Logging mit Kontext (nicht nur die Message)
   - Retry-Logik für transiente Fehler (API Calls, DB)

3. **Zeige** VORHER → NACHHER für jede Änderung
4. **Stelle sicher** dass Error Handling nicht die Lesbarkeit ruiniert
