---
name: explain
description: Erkläre Code — was tut er, warum, wie hängt er zusammen. Für Onboarding oder Code-Verständnis.
argument-hint: "<datei oder funktion>"
user-invocable: true
---

Erkläre: $ARGUMENTS

1. **Lies** den Code und verstehe die Gesamtstruktur
2. **Erkläre auf 3 Ebenen:**

   **High Level (1 Satz):**
   Was ist der Zweck dieses Codes?

   **Mid Level (Absatz):**
   Wie funktioniert er? Welche Hauptkomponenten gibt es?

   **Detail Level (kommentierter Code):**
   Zeige den Code mit Inline-Erklärungen für komplexe Stellen

3. **Kontext:**
   - Wer ruft diesen Code auf?
   - Welche Dependencies hat er?
   - Was passiert bei Fehlern?

4. **Diagramm** (falls komplex): ASCII-Flowchart des Kontrollflusses
