---
name: deploy-check
description: Server und JARVIS Status prüfen — Crons, Tunnel, Services, Uptime.
user-invocable: true
---

Deploy & Server Check:

1. **JARVIS/OpenClaw (46.225.14.109):**
   - Lies Infrastruktur/AGENTS.md für Agenten-Status
   - Lies Infrastruktur/CAPABILITIES.md für System-Capabilities
   - Prüfe: Cloudflare Tunnel Status
   - Prüfe: JARVIS Cron Status (23 aktiv, consecutiveErrors?)

2. **Odoo.sh (Signature Cosmetics):**
   - Letzter Build-Status
   - Letzte Deployment-Fehler

3. **GitHub Repos:**
   - Offene PRs
   - Failed Actions/Checks

4. **Report:**
   | Service | Status | Letzte Aktivität |
   |---|---|---|
   | JARVIS | | |
   | Cloudflare Tunnel | | |
   | Odoo.sh | | |
   | GitHub | | |

5. **Alerts:** Gibt es etwas das sofortige Aufmerksamkeit braucht?
