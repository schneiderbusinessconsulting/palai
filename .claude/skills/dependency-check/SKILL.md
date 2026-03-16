---
name: dependency-check
description: Prüft Dependencies auf veraltete Versionen, Sicherheitslücken und unnötige Pakete.
user-invocable: true
---

Dependency Check:

1. **Finde** package.json, requirements.txt, Cargo.toml, etc.
2. **Prüfe:**
   - Veraltete Pakete (major/minor/patch Updates)
   - Bekannte Sicherheitslücken (npm audit, pip-audit, etc.)
   - Ungenutzte Dependencies
   - Doppelte/überlappende Pakete
3. **Erstelle Report:**
   | Paket | Aktuell | Verfügbar | Severity | Aktion |
   |---|---|---|---|---|
4. **Empfehle** Update-Reihenfolge (Security first, dann Major Updates)
