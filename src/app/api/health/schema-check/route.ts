import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

// Migration Guardian – Vergleicht DB-Schema mit Migrationsdateien

export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface TableSchema {
  name: string
  expectedColumns: string[]
  actualColumns: string[]
  missing: string[]
  extra: string[]
}

// SQL-Migrationsdateien parsen und erwartete Spalten extrahieren
function parseMigrations(migrationsDir: string): Record<string, Set<string>> {
  const tableColumns: Record<string, Set<string>> = {}

  if (!fs.existsSync(migrationsDir)) return tableColumns

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8')

    // CREATE TABLE Anweisungen parsen
    const createTableRegex =
      /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(([\s\S]*?)\);/gi
    let match: RegExpExecArray | null

    while ((match = createTableRegex.exec(content)) !== null) {
      const tableName = match[1]
      const columnsBlock = match[2]

      if (!tableColumns[tableName]) tableColumns[tableName] = new Set()

      // Einzelne Spalten-Definitionen extrahieren
      const lines = columnsBlock.split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        // Spaltenname ist das erste Wort (wenn es kein Keyword ist)
        const colMatch = trimmed.match(
          /^(\w+)\s+(?:uuid|text|varchar|integer|int|bigint|boolean|bool|timestamptz?|timestamp|jsonb?|float|double|numeric|smallint|serial|real)/i
        )
        if (colMatch) {
          tableColumns[tableName].add(colMatch[1])
        }
      }
    }

    // ALTER TABLE ADD COLUMN Anweisungen parsen
    const alterRegex =
      /ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+ADD\s+(?:COLUMN\s+)?(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi

    while ((match = alterRegex.exec(content)) !== null) {
      const tableName = match[1]
      const columnName = match[2]

      if (!tableColumns[tableName]) tableColumns[tableName] = new Set()
      tableColumns[tableName].add(columnName)
    }

    // ALTER TABLE DROP COLUMN berücksichtigen
    const dropColRegex =
      /ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+DROP\s+(?:COLUMN\s+)?(?:IF\s+EXISTS\s+)?(\w+)/gi

    while ((match = dropColRegex.exec(content)) !== null) {
      const tableName = match[1]
      const columnName = match[2]
      if (tableColumns[tableName]) {
        tableColumns[tableName].delete(columnName)
      }
    }
  }

  return tableColumns
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  const issues: string[] = []

  // Erwartete Spalten aus Migrationen parsen
  const expectedSchema = parseMigrations(migrationsDir)

  const tables: TableSchema[] = []

  // Für jede Tabelle: tatsächliche Spalten aus DB abfragen
  for (const [tableName, expectedCols] of Object.entries(expectedSchema)) {
    try {
      const { data: columns, error } = await supabase
        .from('information_schema.columns' as never)
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)

      // Falls information_schema nicht direkt abfragbar, RPC nutzen
      let actualColumnNames: string[] = []

      if (error || !columns) {
        // Alternativer Ansatz: RPC-Aufruf oder raw SQL über supabase
        const { data: rpcResult } = await supabase.rpc('get_table_columns' as never, {
          p_table_name: tableName,
        })

        if (rpcResult && Array.isArray(rpcResult)) {
          actualColumnNames = rpcResult.map((r: { column_name: string }) => r.column_name)
        } else {
          // Letzter Fallback: Einen leeren Select machen und Spalten aus den Keys ableiten
          const { data: sampleRow } = await supabase
            .from(tableName)
            .select('*')
            .limit(1)
            .single()

          if (sampleRow && typeof sampleRow === 'object') {
            actualColumnNames = Object.keys(sampleRow)
          } else {
            issues.push(`Konnte Spalten für Tabelle "${tableName}" nicht abfragen`)
            continue
          }
        }
      } else {
        actualColumnNames = columns.map(
          (c: { column_name: string }) => c.column_name
        )
      }

      const expectedArr = Array.from(expectedCols)
      const missing = expectedArr.filter((c) => !actualColumnNames.includes(c))
      const extra = actualColumnNames.filter((c) => !expectedCols.has(c))

      tables.push({
        name: tableName,
        expectedColumns: expectedArr.sort(),
        actualColumns: actualColumnNames.sort(),
        missing,
        extra,
      })

      if (missing.length > 0) {
        issues.push(
          `Tabelle "${tableName}": ${missing.length} Spalte(n) fehlen in DB: ${missing.join(', ')}`
        )
      }
      if (extra.length > 0) {
        // Extra-Spalten sind nicht unbedingt ein Problem (können manuell oder via Supabase Dashboard hinzugefügt worden sein)
        issues.push(
          `Tabelle "${tableName}": ${extra.length} Spalte(n) in DB aber nicht in Migrationen: ${extra.join(', ')}`
        )
      }
    } catch (err) {
      issues.push(
        `Fehler bei Tabelle "${tableName}": ${err instanceof Error ? err.message : 'Unbekannt'}`
      )
    }
  }

  return NextResponse.json({
    tables,
    migrationFiles: fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))
      : [],
    issues,
    checkedAt: new Date().toISOString(),
  })
}
