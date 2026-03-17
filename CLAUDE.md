# Claude Code Projekt-Konfiguration

## Berechtigungen
Dieses Projekt erlaubt automatisch:
- Git-Operationen (commit, push, pull, checkout, branch)
- npm/yarn Befehle (install, run, build)
- TypeScript/Next.js Befehle

## Projekt-Info
- Next.js 15 App mit TypeScript
- Supabase als Backend
- Deployment auf Railway

## Wichtige Pfade
- `/src/app` - Next.js App Router Seiten
- `/src/components` - React Komponenten
- `/src/lib` - Utilities und API-Helfer
- `/supabase` - Datenbank-Schema

---


---

# CLAUDE.md – Globale Projekt-Instruktionen

## Sprache
- Kommuniziere auf Deutsch, wenn der User Deutsch spricht
- Code-Kommentare und Commit-Messages auf Englisch

## Code-Stil
- Bevorzuge einfache, lesbare Lösungen
- Keine unnötigen Abstraktionen
- Tests schreiben wo sinnvoll

## Git
- Commit-Messages: konventionelle Commits (feat:, fix:, docs:, chore:)
- Kleine, fokussierte Commits

## Projekte & Stack
- Hauptsprachen: TypeScript, Python, Bash
- Infrastruktur: Hetzner VPS, Docker, SSH
- Integrationen: Discord Webhooks, Twilio, YouTube API, Odoo
- Hauptprojekt: OpenClaw (JARVIS) — läuft auf 46.225.14.109
- Notizen: Obsidian mit Git-Sync (SSOT)
- Monitoring: Uptime-Checks via Cron + Discord Alerts

## Obsidian – Single Source of Truth (SSOT)
- **Status:** Verbunden und aktiv (seit 2026-03-10)
- **Vault-Pfad lokal:** `C:\Users\sandr\Desktop\Claude\Obsidian`
- **Repo:** `schneiderbusinessconsulting/default` → Branch `claude/cloud-config-setup-WXahR`
- **Sync:** Obsidian Git Plugin — Auto Push/Pull alle 5 Min
- Obsidian ist die zentrale Wissens- und Notiz-Plattform
- Claude kann Dateien direkt ins Repo pushen → erscheinen automatisch in Obsidian
- Änderungen in Obsidian werden automatisch ins Repo gepusht

## Standard-Routine bei Session-Start
Bei jeder neuen Session MUSS Claude folgendes tun:
1. **Obsidian Vault lesen** — `obsidian-vault/` auf neue/geänderte Dateien prüfen
2. **Projekt-Übersicht prüfen** — `obsidian-vault/Projekt-Übersicht.md` lesen und auf Aktualität prüfen
3. **CLAUDE.md prüfen** — eigene Instruktionen auf Aktualität prüfen
4. **Updates pushen** — falls Änderungen nötig sind, Projekt-Übersicht und relevante Dateien aktualisieren und pushen
5. **Kurze Zusammenfassung** — dem User mitteilen, was sich seit der letzten Session geändert hat

---

## WORKFLOW-FIRST RULE — MANDATORY

**Before EVERY response**, Claude MUST:
1. Analyze the user's prompt
2. Determine which skills are relevant
3. Show the workflow plan as first line: `📋 Workflow: /skill-1 → /skill-2 → /skill-3`
4. Execute the chain step by step
5. If no skills needed: `📋 Direct response — no skill chain needed`

**NEVER skip this step. NEVER respond without showing the workflow line first.**

See `/workflow-planner` skill for standard chains and templates.

## Skills Reference — AUTO-TRIGGER RULES

Claude MUST use skills from `.claude/skills/` automatically. No user prompt needed.

**Always invoke relevant skills before doing anything manually.**

### Auto-Trigger Matrix

| Situation | Skill to trigger | Priority |
|---|---|---|
| Session starts | `/daily-brief` | ALWAYS |
| Code was changed | `/review` | ALWAYS |
| Before any commit | `/test-runner` | ALWAYS |
| Architecture decision made | `/architect` | ALWAYS |
| Odoo code changed | `/odoo-review` | ALWAYS |
| Odoo module deploy | `/odoo-deploy` | ALWAYS |
| Bug found | `/debug-systematic` | ALWAYS |
| Security-relevant code | `/security-audit` | ALWAYS |
| Repeatable pattern detected | `/skill-factory` | ALWAYS |
| Performance concern | `/performance` | ON DEMAND |

### Skills by Domain

#### Development & Code Quality
| Skill | Trigger | What it does |
|---|---|---|
| `/review` | After code changes | Code review — quality, security, performance |
| `/test-runner` | Before commits | Run tests, suggest missing tests |
| `/refactor` | When code smells detected | Systematic refactoring with justification |
| `/explain` | When onboarding or understanding code | Explain what code does and why |
| `/debug-systematic` | When bugs found | Reproduce, isolate, fix bugs methodically |
| `/security-audit` | Security-relevant changes | OWASP Top 10, secrets, vulnerabilities |
| `/performance` | Bottleneck suspected | Identify and optimize bottlenecks |
| `/error-handler` | Missing error handling | Add robust error handling and logging |
| `/search-replace` | Rename/replace across codebase | Intelligent search-replace with preview |
| `/todo-extract` | Codebase audit | Find all TODOs, FIXMEs, HACKs |
| `/dependency-check` | Dependency audit | Check for outdated/vulnerable packages |
| `/self-review` | After EVERY substantive output | Auto quality check |

#### Architecture & Planning
| Skill | Trigger | What it does |
|---|---|---|
| `/architect` | Architecture decisions | Analyze options, trade-offs, recommendation |
| `/api-design` | API design needed | REST/GraphQL design with schemas |
| `/doc-gen` | Documentation needed | Generate API docs, README, inline comments |
| `/decision-log` | Decision made | Document context, options, rationale |

#### Git & Deployment
| Skill | Trigger | What it does |
|---|---|---|
| `/commit-smart` | Ready to commit | Analyze changes, create conventional commit |
| `/pr-create` | PR needed | Analyze commits, write description, create PR |
| `/git-cleanup` | Repo maintenance | Clean merged branches, find large files |
| `/deploy-check` | Before/after deploy | Check server, crons, tunnels, services |
| `/data-migration` | Data migration needed | Plan migration with validation and rollback |

#### Odoo 19
| Skill | Trigger | What it does |
|---|---|---|
| `/odoo-module <name>` | New module needed | Scaffold with correct Odoo 19 structure |
| `/odoo-review` | Odoo code changed | Check ORM, security, views, manifest |
| `/odoo-deploy` | Odoo deploy needed | Version bump, manifest check, git push |

#### Client-Specific Voice & Content
| Skill | Trigger | What it does |
|---|---|---|
| `/gabriel-voice` | Gabriel content needed | Texts, posts, bios in Gabriel's voice |
| `/gabriel-mail` | Gabriel email needed | Business, booking, partner emails |
| `/hausgesucht-content` | Hausgesucht content | SEO, listings, blog in brand voice |
| `/signature-brand` | Signature Cosmetics content | Product texts, social media, e-commerce |
| `/trust-legal` | Trust England legal docs | Claims, briefs, lawyer correspondence |
| `/anne-karl-legal` | Anne Karl communication | Legal context, formal but clear |

#### Obsidian & Knowledge Management
| Skill | Trigger | What it does |
|---|---|---|
| `/dump` | Quick thought to capture | Save to Brain Dump inbox |
| `/organisiere` | Inbox has items | Categorize and move to correct folders |
| `/graduate` | Daily notes have ideas | Promote ideas to standalone notes |
| `/connect` | Find connections | Link unrelated topics via vault graph |
| `/trace` | Track idea evolution | Show how an idea developed over time |
| `/challenge` | Question an assumption | Test belief against vault history |
| `/emerge` | Find latent patterns | Ideas the vault implies but never states |
| `/ghost` | Answer as Sandro would | Based on vault analysis of thinking patterns |
| `/drift` | Reality check | Compare intentions vs actual behavior |
| `/deep` | Cross-domain analysis | 30-day pattern recognition across vault |
| `/context` | Context missing | Load full context from Obsidian vault |
| `/sync-status` | Check sync state | Show changes, conflicts, pending syncs |

#### Session & Project Management
| Skill | Trigger | What it does |
|---|---|---|
| `/daily-brief` | Session start | What's today, deadlines, changes |
| `/heute` | Morning planning | Prioritized top-3 tasks from MASTERPLAN |
| `/tagesziel` | End of day | Process open tasks, plan tomorrow |
| `/weekly-review` | Weekly | Update status, check blockers, plan week |
| `/blocker-check` | Blocker suspected | Extract all blockers across all projects |
| `/client-status` | Client meeting prep | Summarize client project status |
| `/trust` | Trust England update | Quick briefing on £192M+ claim |
| `/mcp-status` | Tool issues | Check all MCP servers status |
| `/skill-factory` | Repeatable pattern found | Create new skill from current context |

#### Learning & Media
| Skill | Trigger | What it does |
|---|---|---|
| `/yt-learn` | YouTube link shared | Summarize video, extract learnings |
| `/reel-learn` | Reel/TikTok/Short shared | Transcribe and extract learnings |

### Orchestrator Pattern — Agent Chains

When a task spans multiple domains, Claude MUST chain skills automatically:

```
Deploy Workflow:  /odoo-review → /test-runner → /security-audit → /odoo-deploy
Code Change:      [edit] → /review → /self-review → /test-runner → /commit-smart
New Feature:      /architect → [implement] → /review → /test-runner → /doc-gen
Client Delivery:  /client-status → [work] → /review → /deploy-check
Session Start:    /daily-brief → /blocker-check → /sync-status
Session End:      /tagesziel → update _HOT_MEMORY.md → update _SYNC_LOG.md
```
