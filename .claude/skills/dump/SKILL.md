---
name: dump
description: Schneller Brain Dump — speichere einen Gedanken in die Inbox. Nutze wenn der User etwas schnell notieren will.
argument-hint: "<gedanke>"
user-invocable: true
---

Öffne 00_Inbox/Brain_Dump.md und hänge folgenden Eintrag an:

Datum: !`date +%Y-%m-%d`
Inhalt: $ARGUMENTS

Bestätige kurz dass der Eintrag gespeichert wurde.
