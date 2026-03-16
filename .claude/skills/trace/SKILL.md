---
name: trace
description: Verfolge wie sich eine Idee über Zeit im Vault entwickelt hat. Zeigt Evolution und Wendepunkte.
argument-hint: "<thema>"
user-invocable: true
---

Trace: Verfolge wie sich eine Idee über Zeit im Vault entwickelt hat.

Thema: $ARGUMENTS

Schritte:
1. Durchsuche alle Dateien im Vault nach dem Thema "$ARGUMENTS"
2. Sortiere die Erwähnungen chronologisch (nach Datei-Erstellungsdatum oder Datum im Inhalt)
3. Identifiziere: erste Erwähnung, Wendepunkte, Widersprüche, Entwicklung
4. Zeige: Zeitstrahl der Ideen-Evolution mit konkreten Zitaten aus den Dateien
5. Schluss: Wo steht die Idee heute? Was ist noch ungelöst?
