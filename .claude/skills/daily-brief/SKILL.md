---
name: daily-brief
description: Tagesbriefing — was steht heute an, welche Deadlines nahen, was hat sich geändert. Automatisch bei Session-Start.
user-invocable: true
---

Tagesbriefing:

1. **Datum:** Heute ist !`date +%Y-%m-%d (%A)`
2. **Lies:** MASTERPLAN.md, _HOT_MEMORY.md, ACTIVE_SESSIONS.md
3. **Deadlines:**
   - Was ist in den nächsten 7 Tagen fällig?
   - Was ist überfällig?
4. **Seit letzter Session:**
   - `git log --since="2 days ago" --oneline` — was wurde geändert?
   - Neue Dateien im Vault?
5. **Heutige Prioritäten** (basierend auf MASTERPLAN Priority Legend):
   - 🔴 P0: [must-do today]
   - 🟠 P1: [should-do if P0 clear]
   - 🟡 P2: [nice-to-have]
6. **Frage:** "Womit fangen wir an?"
