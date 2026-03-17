---
name: test-runner
description: Tests schreiben und ausführen. Erkennt automatisch das Test-Framework und schlägt fehlende Tests vor.
argument-hint: "[datei oder funktion]"
user-invocable: true
---

Test Runner für: $ARGUMENTS

1. **Erkenne das Projekt:**
   - package.json → Jest/Vitest/Mocha
   - pytest.ini/pyproject.toml → pytest
   - Cargo.toml → cargo test
   - Andere → frage nach

2. **Falls Tests existieren:** Führe sie aus und zeige Ergebnisse
3. **Falls Tests fehlen für $ARGUMENTS:**
   - Analysiere den Code
   - Schreibe Tests für: Happy Path, Edge Cases, Error Cases
   - Nutze das bestehende Test-Pattern des Projekts
   - Führe die neuen Tests aus

4. **Zeige Ergebnis:**
   - ✅ Passed / ❌ Failed mit Details
   - Coverage-Hinweis falls verfügbar
   - Vorschläge für weitere Tests
