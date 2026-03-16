---
name: doc-gen
description: Dokumentation generieren — API Docs, README, Inline-Comments basierend auf Code-Analyse.
argument-hint: "<datei oder verzeichnis>"
user-invocable: true
---

Dokumentation generieren für: $ARGUMENTS

1. **Analysiere den Code:**
   - Öffentliche API / Exports
   - Funktions-Signaturen und Parameter
   - Rückgabewerte und Fehlertypen
   - Abhängigkeiten und Konfiguration

2. **Generiere je nach Kontext:**
   - **API:** Endpoint-Docs mit Request/Response Beispielen
   - **Library:** Funktions-Docs mit Parametern und Beispielen
   - **Projekt:** README mit Setup, Usage, Architecture
   - **Modul:** Inline JSDoc/Docstrings für alle öffentlichen Funktionen

3. **Stil:** Knapp, beispielreich, copy-paste-ready
4. **Zeige** Draft und frage vor dem Schreiben
