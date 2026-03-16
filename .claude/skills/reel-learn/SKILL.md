---
name: reel-learn
description: Instagram Reel, TikTok, YouTube Short oder beliebiges Video transkribieren und Learnings extrahieren. Nutze wenn der User einen Reel/Short/TikTok Link schickt.
argument-hint: "<video-url>"
user-invocable: true
---

## Reel/Short → Learnings

Video: $ARGUMENTS

### Pipeline

1. **Plattform erkennen** (Instagram, TikTok, YouTube Short, Twitter/X)
2. **Transkript erstellen** via JARVIS Whisper Pipeline:
   ```
   ssh -i ~/.ssh/hetzner-openclaw -p 2299 root@46.225.14.109 \
     "python3 /root/scripts/reel_transcribe.py '$ARGUMENTS' --model base --json"
   ```
   Falls SSH nicht verfügbar (Cloud): Anleitung für manuellen Aufruf geben.
3. **Analysiere** das Transkript:

### Output Format:

**📱 Video:** [Plattform + URL]
**👤 Creator:** [Name wenn erkennbar]
**⏱️ Länge:** [geschätzt aus Timestamps]
**🗣️ Sprache:** [erkannt von Whisper]

**🎯 Kernaussage (1 Satz):**
[Die wichtigste Erkenntnis]

**📝 Top Learnings:**
1. [Learning 1 — konkretes Takeaway]
2. [Learning 2]
3. [Learning 3]

**💡 Relevanz für Sandro:**
- [Wie passt das zu Hausgesucht / Trust / Signature / Gabriel?]
- [Konkreter nächster Schritt]

**🔗 Verbindungen:**
- [Verknüpfung zu bestehenden Vault-Themen]

4. **Frage:** "Soll ich die Learnings in den Vault speichern? (/dump)"
