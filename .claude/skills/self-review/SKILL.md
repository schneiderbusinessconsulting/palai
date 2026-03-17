---
name: self-review
description: Automatische Selbst-Review nach jedem substantiellen Output. Prüft Vollständigkeit, Qualität und Optimierungspotential. IMMER nach Code-Änderungen, Architektur-Entscheidungen oder komplexen Antworten ausführen.
disable-model-invocation: false
user-invocable: true
---

## Self-Review Protocol — Automatisch nach jedem substantiellen Output

Führe nach JEDEM substantiellen Output (Code, Architektur, Plan, Analyse) diese 30-Sekunden-Reflexion durch:

### 1. Vollständigkeit (Was fehlt?)
- Habe ich ALLE Anforderungen des Users abgedeckt?
- Gibt es Edge Cases die ich übersehen habe?
- Fehlen Error Handling, Types, Tests?

### 2. Korrektheit (Stimmt es?)
- Logikfehler? Off-by-one? Race Conditions?
- Sind Annahmen korrekt oder habe ich geraten?
- Funktioniert es auch mit leeren/null/undefined Werten?

### 3. Qualität (Ist es gut?)
- Ist der Code lesbar und wartbar?
- Gibt es Duplikation die eliminiert werden kann?
- Sind Benennungen klar und konsistent?
- Security: Injection, XSS, Secrets exposed?

### 4. Optimierung (Geht es besser?)
- Gibt es eine einfachere Lösung?
- Performance-Bottlenecks?
- Unnötige Komplexität?

### Output Format
Zeige am Ende jeder substantiellen Antwort einen kurzen Review-Block:

```
---
**Self-Review:**
✅ [was gut ist]
⚠️ [was verbessert werden könnte] → [sofort fixen oder als TODO markieren]
💡 [Optimierungsidee falls vorhanden]
```

### Wann NICHT reviewen:
- Reine Informationsfragen ("was ist X?")
- Kurze Status-Updates
- Bestätigungen
