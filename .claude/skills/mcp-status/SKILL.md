---
name: mcp-status
description: MCP Server Status — alle registrierten MCPs prüfen, connected/failed/needs-auth.
user-invocable: true
---

MCP Server Status:

1. **Lies** Infrastruktur/CAPABILITIES.md für MCP-Inventar
2. **Prüfe** jeden registrierten MCP Server:

   | MCP Server | Status | Typ | Notiz |
   |---|---|---|---|
   | | 🟢 Connected / 🟡 Needs Auth / 🔴 Failed | | |

3. **Zusammenfassung:**
   - ✅ Connected: X Server
   - 🟡 Need Auth: X Server (welche Credentials fehlen?)
   - ❌ Failed: X Server (Fehlergrund?)

4. **Empfehlung:**
   - Welche MCPs sollten als nächstes eingerichtet werden?
   - Welche sind überflüssig und können entfernt werden?
