---
name: ghost
description: Beantworte eine Frage so wie Sandro es würde — basierend auf Vault-Analyse seiner Denkmuster.
argument-hint: "<frage>"
user-invocable: true
---

Ghost: Beantworte eine Frage so wie Sandro es würde.

Frage: $ARGUMENTS

Schritte:
1. Lies CLAUDE.md, MASTERPLAN.md, Personal/Sandro_Profile.md und Projektdateien
2. Extrahiere Sandros Denkmuster: Wie entscheidet er? Was priorisiert er? Welche Werte zeigen sich?
3. Beantworte die Frage "$ARGUMENTS" in Sandros Stimme und Perspektive
4. Evaluiere danach: "War das wirklich deine Perspektive oder habe ich etwas verfehlt?"
5. Optional: Zeige welche Vault-Dateien die Antwort informiert haben
