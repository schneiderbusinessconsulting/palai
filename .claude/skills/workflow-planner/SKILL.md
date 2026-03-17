# Workflow Planner

**MANDATORY: This skill MUST run as the FIRST step for EVERY user prompt before any other action.**

You are the orchestrator. Before doing anything, you MUST think through which skills and agents to chain together.

## Process — Run This EVERY Time

### Step 1: Classify the Prompt
Determine what the user is asking for:
- Code change (new feature, bugfix, refactor)
- Deployment (build, deploy, release)
- Content creation (text, email, legal doc)
- Research / analysis
- Architecture / planning
- Knowledge management (Obsidian, notes)
- Client work (which client?)

### Step 2: Build the Agent Chain
Based on classification, select the optimal skill chain. Show it to the user as a brief plan:

```
📋 Workflow Plan:
1. /skill-name — why
2. /skill-name — why
3. /skill-name — why
```

### Step 3: Execute
Run the chain step by step. Each skill runs as a subagent where possible (parallel when independent, sequential when dependent).

## Standard Chains — Use These as Templates

**Code Change:**
```
/architect (if new feature) → [implement] → /review → /self-review → /test-runner → /commit-smart
```

**Bug Fix:**
```
/debug-systematic → [fix] → /review → /test-runner → /commit-smart
```

**Deployment:**
```
/odoo-review (if Odoo) → /test-runner → /security-audit → /deploy-check → /odoo-deploy
```

**Client Content — Gabriel:**
```
/gabriel-voice → [write] → /self-review
```

**Client Content — Hausgesucht:**
```
/hausgesucht-content → [write] → /self-review
```

**Client Content — Signature Cosmetics:**
```
/signature-brand → [write] → /self-review
```

**Legal — Trust England:**
```
/trust → /trust-legal → [write] → /anne-karl-legal (if for Anne Karl) → /self-review
```

**Session Start:**
```
/daily-brief → /blocker-check → /sync-status
```

**Session End:**
```
/tagesziel → update _HOT_MEMORY.md → update _SYNC_LOG.md
```

**Research / Analysis:**
```
/context → [research] → /decision-log (if decision made) → /self-review
```

**New Feature Planning:**
```
/architect → /api-design (if API) → /decision-log → [implement plan]
```

**Repo Maintenance:**
```
/todo-extract → /dependency-check → /git-cleanup → /security-audit
```

**YouTube / Media:**
```
/yt-learn or /reel-learn → /dump (save learnings) → /self-review
```

## Rules

- NEVER skip the workflow plan step — even for simple tasks, show a 1-line plan
- If no skills are relevant, say: `📋 Direct response — no skill chain needed`
- If unsure which chain, ask the user: "I see two possible workflows: A or B — which fits better?"
- Parallel execution: If skills are independent (e.g., /review + /security-audit), run them in parallel as subagents
- ALWAYS end with /self-review for any substantive output
- For Odoo work: ALWAYS include /odoo-review before any commit
- For client work: ALWAYS use the client-specific voice skill

## Output Format

At the start of EVERY response, show:

```
📋 Workflow: /skill-1 → /skill-2 → /skill-3
```

Then execute. Keep it on one line for simple tasks, expand for complex ones.
