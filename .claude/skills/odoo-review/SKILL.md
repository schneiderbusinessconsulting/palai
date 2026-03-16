---
name: odoo-review
description: Odoo 19 spezifische Code Review — prüft ORM-Patterns, Security, Views, Manifest, Performance. Findet die typischen Fehler die LLMs bei Odoo machen.
argument-hint: "[modul-verzeichnis oder datei]"
user-invocable: true
---

Odoo 19 Code Review für: $ARGUMENTS

Führe ein systematisches Odoo-spezifisches Code Review durch. Lies ALLE Dateien im angegebenen Modul.

## 1. Manifest Check (__manifest__.py)

| Prüfpunkt | Regel |
|---|---|
| Version | Format `19.0.X.Y.Z` — NICHT `1.0` oder `19.0` allein |
| depends | NICHT leer, mindestens `['base']` |
| data Reihenfolge | Security-Dateien VOR Views/Actions |
| Alle Dateien gelistet | Jede XML/CSV Datei im data-Array |
| license | Vorhanden (`LGPL-3` oder `OPL-1`) |
| installable | `True` gesetzt |
| category | Sinnvoller Wert, kein Leerstring |

## 2. Model Check (Python)

| Prüfpunkt | Regel |
|---|---|
| `_name` Format | Punkt-Notation: `module.model` |
| `_description` | MUSS gesetzt sein (sonst Warning) |
| Feld-Deklaration | `fields.Char()` MIT Klammern, NICHT `fields.Char` |
| Computed fields | Hat `compute=`, `@api.depends` korrekt? `store=` bewusst gesetzt? |
| `@api.depends` | ALLE Abhängigkeiten gelistet? Auch related fields? |
| `@api.constrains` | Raise `ValidationError`, NICHT `UserError` |
| `@api.onchange` | NUR für UX-Feedback, NICHT für Validierung |
| `@api.ondelete` | Statt `unlink()` Override? |
| Many2one | `comodel_name=` NICHT `comodel=` |
| One2many | Hat `inverse_name=`? |
| Many2many | Relationstabelle-Name bei Cross-Module? |
| Raw SQL | VERBOTEN außer mit `odoo.tools.SQL` Wrapper |
| `sudo()` | Nur wo nötig? Security-Implikationen bedacht? |
| `self.env.cr.commit()` | NIEMALS in Business-Logik! |
| `_inherit` vs `_name` | Erweiterung (nur `_inherit`) vs. neues Model (`_name` + optional `_inherit`) korrekt? |
| Default-Werte | Lambda für mutable defaults: `default=lambda self: ...` |
| Date/Datetime | Vergleiche nur mit `date`/`datetime` Objekten, NIE Strings |

## 3. Security Check

| Prüfpunkt | Regel |
|---|---|
| ir.model.access.csv existiert | Für JEDES Model eine Zeile |
| model_id:id Format | `model_` + `_name` mit `.` → `_` |
| Keine Leerzeichen | Nach Kommas in CSV |
| Berechtigungen | Nicht alles auf `1,1,1,1` — least privilege |
| Record Rules | Bei Multi-Company oder User-Scoping nötig? |
| `groups` auf Feldern | Sensible Felder geschützt? |
| Public Methods | Nur gewollte Methoden ohne `_` Prefix? |

## 4. Views Check (XML)

| Prüfpunkt | Regel |
|---|---|
| `<list>` NICHT `<tree>` | Odoo 17+ / 19 nutzt `<list>` Tag |
| `view_mode` | `list,form` NICHT `tree,form` |
| `type="xml"` | Bei arch Field gesetzt |
| Unique XML IDs | Keine Duplikate im Modul |
| Field existiert | Jedes `<field name="x"/>` existiert im Model |
| `<sheet>` in Form | Korrekte Form-Struktur |
| `<group>` Layout | Statt `<div>` für Formularlayout |
| xpath Expressions | Bei Vererbung: Target existiert? Position korrekt? |
| `invisible` Attribut | Odoo 17+: `invisible="field == 'value'"` (Python-like), NICHT `attrs={'invisible': ...}` |
| `readonly` Attribut | Odoo 17+: `readonly="field == 'value'"` (Python-like), NICHT `attrs={'readonly': ...}` |
| `required` Attribut | Odoo 17+: `required="field == 'value'"` (Python-like), NICHT `attrs={'required': ...}` |
| `column_invisible` | Für Spalten in `<list>`, NICHT `invisible` |
| Buttons | `type="object"` → Methode ist public? |
| Statusbar | Widget korrekt: `widget="statusbar"` |

## 5. Deployment Check (Git)

| Prüfpunkt | Regel |
|---|---|
| Version bumped | Bei Änderungen: letzte 3 Ziffern erhöht? |
| `__init__.py` komplett | Alle Python-Dateien importiert? |
| Keine `.pyc` Dateien | Im .gitignore? |
| requirements.txt | Externe Dependencies gelistet? |

## 6. Performance Check

| Prüfpunkt | Regel |
|---|---|
| N+1 Queries | `for record in records: record.related_id.field` → prefetch nutzen |
| Stored computed | Braucht es `store=True`? Index nötig? |
| `search_count` | Statt `len(search())` |
| `filtered` vs Domain | `search([domain])` ist schneller als `search([]).filtered()` |
| `mapped` | Statt Loop für Feldwerte: `records.mapped('field')` |
| Batch-Operationen | `create([vals_list])` statt Loop von `create(vals)` |

## Ausgabe-Format

Für jedes Finding:
- 🔴 **Critical** — Wird crashen oder ist ein Security-Problem
- 🟠 **Warning** — Funktioniert, aber falsch/veraltet/riskant
- 🟡 **Suggestion** — Best Practice Verbesserung
- 🟢 **Good** — Korrekt umgesetzt

Zeige konkreten Fix-Code für alle 🔴 und 🟠 Findings.

**Zusammenfassung:**
- Gesamtnote (1-10)
- Top 3 kritischste Fixes
- Deployment-Bereitschaft: ✅ Ready / ⚠️ Fixes needed / 🚫 Blocker
