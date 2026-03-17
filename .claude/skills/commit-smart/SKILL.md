---
name: commit-smart
description: Intelligenter Commit — analysiert Änderungen und erstellt konventionelle Commit Message. Nutze statt manuellem git commit.
argument-hint: "[optionale beschreibung]"
user-invocable: true
---

Erstelle einen intelligenten Git Commit:

1. Führe `git diff --staged` und `git diff` aus
2. Falls nichts staged: `git add -A` (aber warnen bei .env, credentials, secrets)
3. Analysiere die Änderungen:
   - Was wurde geändert? (Dateien, Funktionen, Konfiguration)
   - Warum? (Feature, Bugfix, Refactoring, Docs, Chore)
4. Erstelle eine Commit Message im konventionellen Format:
   ```
   <type>(<scope>): <kurze beschreibung>

   <optionaler body mit details>
   ```
   Types: feat, fix, docs, style, refactor, test, chore, perf
5. Zeige die Message und frage: "Commit mit dieser Message?"
6. Nach Bestätigung: `git commit -m "<message>"`

Falls $ARGUMENTS angegeben: Nutze als Hinweis für die Message.
