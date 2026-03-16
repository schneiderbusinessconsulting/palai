---
name: review
description: Code Review mit Best Practices. Prüft Qualität, Security, Performance und Wartbarkeit. Nutze nach Code-Änderungen.
argument-hint: "[datei oder verzeichnis]"
user-invocable: true
---

Code Review für: $ARGUMENTS

Führe ein systematisches Code Review durch:

1. **Lies den Code** — $ARGUMENTS (oder die zuletzt geänderten Dateien falls kein Argument)
2. **Prüfe auf diese Kategorien:**

| Kategorie | Prüfe auf |
|---|---|
| **Korrektheit** | Logikfehler, Edge Cases, Off-by-one, Null-Checks |
| **Security** | Injection, XSS, CSRF, Secrets im Code, OWASP Top 10 |
| **Performance** | N+1 Queries, unnötige Loops, Memory Leaks, fehlende Indizes |
| **Wartbarkeit** | Naming, DRY, Komplexität, fehlende Types |
| **Error Handling** | Unbehandelte Exceptions, fehlende Validierung |

3. **Bewerte** mit Severity: 🔴 Critical / 🟠 Warning / 🟡 Suggestion / 🟢 Good
4. **Zeige** konkrete Fixes für alle 🔴 und 🟠 Findings
5. **Zusammenfassung:** Gesamtnote (1-10) + Top 3 Verbesserungen
