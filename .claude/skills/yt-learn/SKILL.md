---
name: yt-learn
description: YouTube Video zusammenfassen und Learnings extrahieren. Nutze wenn der User einen YouTube Link schickt oder ein Video zusammengefasst haben will.
argument-hint: "<youtube-url>"
user-invocable: true
---

## YouTube → Learnings

Video: $ARGUMENTS

1. **Transkript holen** via YouTube Transcript MCP (get_transcript)
2. **Analysiere** das Transkript:

### Output Format:

**📺 Video:** [Titel]
**👤 Creator:** [Name]
**⏱️ Länge:** [Minuten]

**🎯 Kernaussage (1 Satz):**
[Die wichtigste Erkenntnis]

**📝 Top Learnings:**
1. [Learning 1 — konkretes Takeaway]
2. [Learning 2]
3. [Learning 3]
4. [Learning 4]
5. [Learning 5]

**💡 Relevanz für Sandro:**
- [Wie passt das zu Hausgesucht / Trust / Signature / Gabriel?]
- [Konkreter nächster Schritt]

**🔗 Verbindungen:**
- [Verknüpfung zu bestehenden Vault-Themen]

3. **Frage:** "Soll ich die Learnings in den Vault speichern? (/dump)"
