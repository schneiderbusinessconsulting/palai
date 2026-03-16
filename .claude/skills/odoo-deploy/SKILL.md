---
name: odoo-deploy
description: Odoo 19 Deployment via Git — Version bumpen, Manifest prüfen, Git push, Auto-Upgrade Checklist.
argument-hint: "[modul-verzeichnis]"
user-invocable: true
---

Odoo 19 Deployment via Git für: $ARGUMENTS

## Pre-Deployment Checklist

Gehe diese Punkte systematisch durch BEVOR du pushst:

### 1. Code-Qualität

- [ ] Führe `/odoo-review $ARGUMENTS` aus (oder manuell prüfen)
- [ ] Keine `print()` oder `pdb` Statements im Code
- [ ] Keine `self.env.cr.commit()` in Business-Logik
- [ ] Kein hardcodierter `sudo()` ohne Grund
- [ ] Logging statt print: `_logger = logging.getLogger(__name__)`

### 2. Manifest & Version

```python
# Version MUSS gebumpt werden für Auto-Upgrade!
# Format: 19.0.MAJOR.MINOR.PATCH
# Beispiel: '19.0.1.0.0' → '19.0.1.0.1' (Patch)
#           '19.0.1.0.0' → '19.0.1.1.0' (Minor Feature)
#           '19.0.1.0.0' → '19.0.2.0.0' (Major Change)
```

Prüfe und bumpe die Version:
1. Lies die aktuelle `__manifest__.py`
2. Erhöhe die Version (letzten 3 Ziffern)
3. Bestätige mit User welcher Bump-Typ (Patch/Minor/Major)

### 3. Datei-Vollständigkeit

Prüfe automatisch:
- [ ] **__init__.py Chain**: Root → models/ → jede .py Datei importiert?
- [ ] **__manifest__.py data**: Jede XML/CSV Datei gelistet?
- [ ] **Security**: `ir.model.access.csv` für jedes Model vorhanden?
- [ ] **Neue Felder/Models**: Migration Script nötig? (bei bestehenden Installationen)

### 4. Abhängigkeiten

- [ ] `depends` in Manifest: Alle genutzten Module gelistet?
- [ ] Externe Python-Libs: In `requirements.txt` im Repo-Root?
- [ ] Keine zirkulären Abhängigkeiten zwischen eigenen Modulen?

### 5. Daten-Migration (bei Schema-Änderungen)

Falls Felder umbenannt, entfernt oder Typen geändert wurden:
- [ ] Pre-Migration Script erstellt? (`migrations/19.0.X.Y.Z/pre-migrate.py`)
- [ ] Post-Migration Script erstellt? (`migrations/19.0.X.Y.Z/post-migrate.py`)
- [ ] Migration auf Staging getestet?

### 6. Git Deployment

```bash
# 1. Status prüfen
git status
git diff

# 2. Gezielte Dateien stagen (NICHT git add .)
git add <module_name>/

# 3. Commit mit klarer Message
git commit -m "feat(<module_name>): <was geändert wurde>

Version: 19.0.X.Y.Z"

# 4. Push zum Deployment-Branch
git push -u origin <branch-name>
```

### 7. Post-Deployment Prüfung

Nach dem Push:
- [ ] Build-Status prüfen (Odoo.sh: Dashboard / Custom: CI/CD Pipeline)
- [ ] Modul-Update wurde getriggert? (Version-Bump erkennt Odoo.sh automatisch)
- [ ] Im Odoo Backend: Apps → Update App List → Modul suchen
- [ ] Modul installieren/upgraden
- [ ] Basis-Funktionalität testen:
  - Menüpunkt sichtbar?
  - Listenansicht lädt?
  - Formular öffnet/speichert?
  - Berechtigungen korrekt?

### 8. Rollback-Plan

Falls etwas schiefgeht:
```bash
# Git revert (sicher, erstellt neuen Commit)
git revert HEAD
git push -u origin <branch-name>

# Auf Odoo.sh: Branch auf vorherigen Commit zurücksetzen
# Oder: Staging-Build von Backup wiederherstellen
```

## Automatisierte Prüfung

Führe folgende Checks automatisch aus:

1. **Grep** nach `print(`, `pdb`, `import pdb`, `breakpoint()` im Modul
2. **Grep** nach `cr.commit()` im Modul
3. **Vergleiche** Model `_name` Werte mit `ir.model.access.csv` Einträgen
4. **Prüfe** ob alle `.py` Dateien in `__init__.py` importiert werden
5. **Prüfe** ob alle `.xml`/`.csv` Dateien in `__manifest__.py` data stehen
6. **Zeige** die aktuelle Version und schlage die neue Version vor

## Ausgabe

```
📦 Deployment Report: <module_name>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Version:  19.0.X.Y.Z → 19.0.X.Y.Z+1
Status:   ✅ Ready / ⚠️ Warnings / 🚫 Blocked

Pre-Flight Checks:
  ✅ __init__.py chain complete
  ✅ Manifest data files complete
  ✅ Security files present
  ⚠️ print() found in models/sale.py:42
  ✅ No cr.commit()
  ✅ Version bumped

Action: [Git commands to execute]
```
