---
name: pr-create
description: Pull Request erstellen — analysiert alle Commits, schreibt Beschreibung und erstellt PR via gh CLI.
argument-hint: "[base-branch]"
user-invocable: true
---

Pull Request erstellen:

1. **Analysiere** alle Commits seit Branch-Divergenz:
   ```
   git log main..HEAD --oneline
   git diff main...HEAD --stat
   ```

2. **Erstelle PR:**
   - Titel: Kurz (<70 Zeichen), beschreibend
   - Body: Summary (Bullet Points) + Test Plan

3. **Format:**
   ```
   ## Summary
   - <was wurde geändert und warum>

   ## Test Plan
   - [ ] <wie wurde getestet>
   ```

4. **Push** falls nötig: `git push -u origin <branch>`
5. **Erstelle** via `gh pr create`
6. **Zeige** den PR Link
