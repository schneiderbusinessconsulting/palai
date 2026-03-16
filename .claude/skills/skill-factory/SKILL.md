---
name: skill-factory
description: Meta-Skill — erstellt neue Skills aus aktuellem Kontext. Nutze wenn eine Aufgabe sich als wiederverwendbar herausstellt.
argument-hint: "<skill-name> <beschreibung>"
user-invocable: true
---

## Skill Factory — Neuen Skill erstellen

Erstelle einen neuen Skill basierend auf: $ARGUMENTS

1. **Analysiere** die aktuelle Aufgabe:
   - Was wird wiederholt getan?
   - Für welchen Client/Kontext?
   - Welche Schritte sind immer gleich?

2. **Erstelle** `.claude/skills/<name>/SKILL.md` mit:
   ```yaml
   ---
   name: <name>
   description: <1 Satz — klar genug für auto-trigger>
   argument-hint: "<was der User mitgibt>"
   user-invocable: true
   ---
   ```

3. **Skill-Content:**
   - Klare Schritt-für-Schritt Anweisungen
   - Client-spezifischer Kontext (Tone of Voice, Regeln, Vorlagen)
   - Referenz zu relevanten Vault-Dateien
   - Beispiel-Output

4. **Committe** den neuen Skill
5. **Melde:** "💾 Neuen Skill erstellt: /<name> — [was er tut]"

### Naming Convention
- Client-Skills: `<client>-<funktion>` (z.B. `gabriel-mail`, `anne-karl-legal`)
- Generische Skills: `<funktion>` (z.B. `review`, `refactor`)
