---
name: sync-status
description: Obsidian Vault Sync-Status prüfen — zeigt was sich geändert hat, Konflikte, und ausstehende Syncs.
user-invocable: true
---

Vault Sync-Status:

1. **Git Status:** `git status` + `git log --oneline -10`
2. **Prüfe:**
   - Uncommitted Changes (lokal geändert aber nicht gepusht)
   - Neue Dateien die nicht getrackt werden
   - Merge-Konflikte
   - Letzter erfolgreicher Sync (Timestamp)
3. **Zeige:**
   - 📥 Zuletzt gepullt: [datum]
   - 📤 Zuletzt gepusht: [datum]
   - 📝 Geänderte Dateien: [liste]
   - ⚠️ Konflikte: [falls vorhanden]
4. **Empfehlung:** Pull/Push nötig? Konflikte lösen?
