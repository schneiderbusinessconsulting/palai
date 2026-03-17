---
name: performance
description: Performance-Analyse — identifiziert Bottlenecks und optimiert Code/Queries/Architektur.
argument-hint: "<datei oder beschreibung>"
user-invocable: true
---

Performance-Analyse für: $ARGUMENTS

1. **Identifiziere Bottlenecks:**
   - N+1 Queries
   - Unnötige Loops / O(n²) Algorithmen
   - Fehlende Caching
   - Zu große Payloads
   - Synchrone Operationen die async sein könnten
   - Memory Leaks / unnötige Kopien

2. **Messe** (falls möglich):
   - Execution Time vor/nach
   - Memory Usage
   - Query Count

3. **Optimiere** mit minimalem Eingriff:
   - Zeige VORHER → NACHHER mit erwartetem Impact
   - Bevorzuge: Caching > Algorithmus > Architektur-Change

4. **Verifiziere** dass Funktionalität erhalten bleibt
