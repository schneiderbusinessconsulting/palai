---
name: git-cleanup
description: Git Repository aufräumen — merged Branches löschen, große Dateien finden, History analysieren.
user-invocable: true
---

Git Cleanup:

1. **Branch Cleanup:**
   - Liste alle lokalen Branches die bereits gemerged sind
   - Liste remote Branches die stale sind (>30 Tage kein Commit)
   - Frage vor dem Löschen

2. **Große Dateien:**
   - Finde die 10 größten Dateien im Repo
   - Prüfe ob Binärdateien im Git sind die dort nicht hingehören

3. **Gitignore Check:**
   - Sind .env, node_modules, __pycache__, .DS_Store etc. ignoriert?
   - Sind Build-Artefakte ignoriert?

4. **Report** mit konkreten Cleanup-Vorschlägen
