---
name: todo-extract
description: Extrahiere alle TODOs, FIXMEs, HACKs und offene Punkte aus der Codebase.
user-invocable: true
---

TODO Extraction:

1. **Suche** in der gesamten Codebase nach:
   - `TODO`, `FIXME`, `HACK`, `XXX`, `BUG`, `WORKAROUND`
   - Kommentare mit "should", "needs", "temporary", "later"

2. **Kategorisiere:**
   | Typ | Datei:Zeile | Inhalt | Alter |
   |---|---|---|---|
   | TODO | | | |
   | FIXME | | | |
   | HACK | | | |

3. **Priorisiere:**
   - 🔴 FIXME/BUG → sofort angehen
   - 🟠 HACK/WORKAROUND → bei nächster Gelegenheit
   - 🟡 TODO → in Backlog aufnehmen

4. **Frage:** Soll ich einen der FIXMEs direkt beheben?
