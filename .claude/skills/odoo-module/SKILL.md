---
name: odoo-module
description: Neues Odoo 19 Modul scaffolden — korrekte Struktur, Manifest, Security, Views, Models. Verhindert die typischen LLM-Fehler.
argument-hint: "<module_name> [kurze Beschreibung]"
user-invocable: true
---

Erstelle ein neues Odoo 19 Modul: $ARGUMENTS

## Schritt 1: Modulstruktur anlegen

Erstelle exakt diese Verzeichnisstruktur:

```
<module_name>/
├── __init__.py              # importiert models/, controllers/, wizards/
├── __manifest__.py          # Modul-Manifest (siehe Template unten)
├── models/
│   ├── __init__.py          # importiert alle Model-Dateien
│   └── <model_name>.py     # Hauptmodel
├── views/
│   └── <model_name>_views.xml   # Form + Tree + Search + Action + Menu
├── security/
│   └── ir.model.access.csv      # Access Rights — NIEMALS vergessen!
├── data/                         # Optional: Seed-Daten
└── static/
    └── description/
        └── icon.png              # Optional: Modul-Icon
```

## Schritt 2: __manifest__.py Template

```python
{
    'name': '<Modul Name>',
    'version': '19.0.1.0.0',
    'category': '<Category>',
    'summary': '<Kurze Beschreibung>',
    'description': """<Längere Beschreibung>""",
    'author': '<Author>',
    'website': '<Website>',
    'license': 'LGPL-3',
    'depends': ['base'],  # IMMER mindestens 'base'
    'data': [
        'security/ir.model.access.csv',  # IMMER ZUERST laden!
        'views/<model_name>_views.xml',
    ],
    'demo': [],
    'installable': True,
    'auto_install': False,
    'application': False,
}
```

### KRITISCHE REGELN für __manifest__.py:
- `version`: Format MUSS `19.0.X.Y.Z` sein (Odoo-Version prefix!)
- `depends`: NIEMALS leere Liste. Mindestens `['base']`
- `data`: Security-Datei MUSS VOR Views kommen (Ladereihenfolge!)
- `license`: Immer angeben (`'LGPL-3'` oder `'OPL-1'`)

## Schritt 3: Model erstellen

```python
from odoo import models, fields, api
from odoo.exceptions import ValidationError

class <ModelClass>(models.Model):
    _name = '<module>.<model>'          # Punkt-Notation, lowercase
    _description = '<Beschreibung>'     # IMMER setzen!
    _order = 'id desc'                  # Optional: Default-Sortierung

    name = fields.Char(string='Name', required=True)
    # ... weitere Felder
```

### KRITISCHE REGELN für Models:
- `_name` MUSS Punkt-Notation sein: `module.model` (NICHT underscore!)
- `_description` IMMER setzen — sonst Warning im Log
- Felder IMMER als Funktionsaufrufe: `fields.Char()` NICHT `fields.Char`
- `string=` Parameter ist optional (Odoo generiert aus Feldname)
- Computed fields MÜSSEN `compute=` UND `store=True/False` haben
- `@api.depends` bei computed fields — ALLE Abhängigkeiten listen!
- `@api.constrains` statt `@api.onchange` für Validierungen
- `@api.ondelete` statt `unlink()` Override für Delete-Schutz
- Many2one: `comodel_name=` NICHT `comodel=`
- One2many: braucht IMMER `inverse_name=`
- Kein raw SQL — IMMER ORM verwenden (Security!)

## Schritt 4: Security (ir.model.access.csv)

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_<module>_<model>_user,<module>.<model> User,model_<module_underscored>_<model_underscored>,base.group_user,1,1,1,0
access_<module>_<model>_manager,<module>.<model> Manager,model_<module_underscored>_<model_underscored>,base.group_system,1,1,1,1
```

### KRITISCHE REGELN für Security:
- `model_id:id` Format: `model_` + `_name` mit Punkte durch `_` ersetzt
  - Beispiel: `_name = 'estate.property'` → `model_estate_property`
- IMMER mindestens eine Zeile pro Model!
- Erste Spalte `id` MUSS unique sein
- Keine Leerzeichen nach Kommas!
- Ohne diese Datei: "Access Denied" Fehler im UI

## Schritt 5: Views (XML)

```xml
<?xml version="1.0" encoding="utf-8"?>
<odoo>
    <!-- Tree View -->
    <record id="<model>_view_tree" model="ir.ui.view">
        <field name="name"><module>.<model>.tree</field>
        <field name="model"><module>.<model></field>
        <field name="arch" type="xml">
            <list>
                <field name="name"/>
            </list>
        </field>
    </record>

    <!-- Form View -->
    <record id="<model>_view_form" model="ir.ui.view">
        <field name="name"><module>.<model>.form</field>
        <field name="model"><module>.<model></field>
        <field name="arch" type="xml">
            <form string="<Model Name>">
                <sheet>
                    <group>
                        <group>
                            <field name="name"/>
                        </group>
                    </group>
                </sheet>
            </form>
        </field>
    </record>

    <!-- Search View -->
    <record id="<model>_view_search" model="ir.ui.view">
        <field name="name"><module>.<model>.search</field>
        <field name="model"><module>.<model></field>
        <field name="arch" type="xml">
            <search>
                <field name="name"/>
            </search>
        </field>
    </record>

    <!-- Action -->
    <record id="<model>_action" model="ir.actions.act_window">
        <field name="name"><Model Name></field>
        <field name="res_model"><module>.<model></field>
        <field name="view_mode">list,form</field>
    </record>

    <!-- Menu -->
    <menuitem id="<module>_menu_root" name="<Module Name>"/>
    <menuitem id="<module>_menu_<model>" name="<Model Name>"
              parent="<module>_menu_root"
              action="<model>_action"/>
</odoo>
```

### KRITISCHE REGELN für Views:
- Odoo 19 verwendet `<list>` NICHT `<tree>` für Listenansichten!
- `view_mode`: `list,form` NICHT `tree,form` (Odoo 17+)
- Immer `type="xml"` beim `arch` Field
- XML IDs MÜSSEN unique innerhalb des Moduls sein
- `<group>` Tags für Layout — NICHT `<div>` verwenden
- `<sheet>` innerhalb `<form>` für korrektes Layout
- Buttons: `<button type="object" name="method_name"/>` — Methode MUSS public sein

## Schritt 6: __init__.py Dateien

Root `__init__.py`:
```python
from . import models
```

`models/__init__.py`:
```python
from . import <model_file_name>
```

### KRITISCHE REGEL:
- JEDE neue Python-Datei MUSS in der entsprechenden `__init__.py` importiert werden!
- Vergessener Import = Model wird nicht registriert = kein Fehler, einfach unsichtbar!

## Schritt 7: Validierung

Nach dem Erstellen, prüfe:
1. Alle `__init__.py` Dateien importieren alle Python-Module
2. `__manifest__.py` listet ALLE data/XML Dateien
3. `ir.model.access.csv` hat Einträge für JEDES Model
4. Model `_name` stimmt mit Security `model_id:id` überein
5. XML View `model` Feld stimmt mit Model `_name` überein
6. Keine Tippfehler in Feldnamen zwischen Model und Views

Zeige am Ende eine Zusammenfassung:
- Erstellte Dateien
- Model(s) mit Feldern
- Security-Konfiguration
- Nächste Schritte (Installation, Tests)
