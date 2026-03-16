---
name: data-migration
description: Daten-Migration planen und durchführen — CSV, JSON, DB, API. Mit Validierung und Rollback-Plan.
argument-hint: "<quelle> -> <ziel>"
user-invocable: true
---

Daten-Migration: $ARGUMENTS

1. **Analyse:**
   - Quell-Format und Schema verstehen
   - Ziel-Format und Schema verstehen
   - Mapping: Welche Felder → Welche Felder?
   - Transformationen nötig? (Typen, Formate, Encoding)

2. **Plan:**
   - Schritt-für-Schritt Migrationsplan
   - Datenvolumen und geschätzte Dauer
   - Rollback-Strategie

3. **Validierung:**
   - Prüfe Quelldaten auf Anomalien vor Migration
   - Definiere Erfolgs-Kriterien (Row Count, Checksums)
   - Stichproben-Vergleich nach Migration

4. **Durchführung:**
   - Script erstellen (Python/Node)
   - Dry-Run zuerst
   - Nach Bestätigung: echte Migration
   - Validierung durchführen
