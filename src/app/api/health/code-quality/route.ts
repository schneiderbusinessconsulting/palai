import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// Code Simplifier – Scannt die Codebasis auf Qualitätsprobleme

export const dynamic = 'force-dynamic'

interface LargeFile {
  path: string
  lines: number
}

function getAllTsFiles(dir: string): string[] {
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
        results.push(...getAllTsFiles(fullPath))
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        results.push(fullPath)
      }
    }
  } catch {
    // Verzeichnis nicht lesbar
  }
  return results
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cwd = process.cwd()
  const scanDirs = [
    path.join(cwd, 'src', 'app'),
    path.join(cwd, 'src', 'lib'),
    path.join(cwd, 'src', 'components'),
  ]

  const allFiles: string[] = []
  for (const dir of scanDirs) {
    if (fs.existsSync(dir)) {
      allFiles.push(...getAllTsFiles(dir))
    }
  }

  const largeFiles: LargeFile[] = []
  const findings: string[] = []
  let todoCount = 0
  let fixmeCount = 0

  // Import-Tracking für Duplikat-Erkennung
  const importMap: Record<string, string[]> = {}

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const relPath = filePath.replace(cwd + '/', '')

    // Große Dateien erkennen
    if (lines.length > 500) {
      largeFiles.push({ path: relPath, lines: lines.length })
    }

    // TODO/FIXME zählen
    for (const line of lines) {
      if (/\/\/\s*TODO/i.test(line)) todoCount++
      if (/\/\/\s*FIXME/i.test(line)) fixmeCount++
    }

    // Imports sammeln
    for (const line of lines) {
      const importMatch = line.match(/^import\s+.*from\s+['"]([^'"]+)['"]/)
      if (importMatch) {
        const importSource = importMatch[1]
        if (!importMap[importSource]) importMap[importSource] = []
        importMap[importSource].push(relPath)
      }
    }
  }

  // Duplikate: gleicher Import in vielen Dateien (möglicher Kandidat für Re-Export)
  const duplicateImports: Array<{ source: string; usedIn: number }> = []
  for (const [source, files] of Object.entries(importMap)) {
    if (files.length >= 5 && !source.startsWith('react') && !source.startsWith('next')) {
      duplicateImports.push({ source, usedIn: files.length })
    }
  }

  // Ergebnisse zusammenstellen
  if (largeFiles.length > 0) {
    findings.push(
      `${largeFiles.length} Datei(en) mit über 500 Zeilen – Kandidaten für Aufteilung`
    )
  }

  if (todoCount > 0) {
    findings.push(`${todoCount} TODO-Kommentar(e) im Code`)
  }
  if (fixmeCount > 0) {
    findings.push(`${fixmeCount} FIXME-Kommentar(e) im Code`)
  }

  if (duplicateImports.length > 0) {
    findings.push(
      `${duplicateImports.length} Import(s) werden in 5+ Dateien verwendet – Re-Export erwägen`
    )
  }

  // API-Routen mit ähnlichem Pattern prüfen
  const apiDir = path.join(cwd, 'src', 'app', 'api')
  const apiRoutes = getAllTsFiles(apiDir).filter((f) => f.endsWith('route.ts'))
  const routePatterns: Record<string, string[]> = {}

  for (const routeFile of apiRoutes) {
    const content = fs.readFileSync(routeFile, 'utf-8')
    const relPath = routeFile.replace(cwd + '/', '')

    // Gemeinsame Muster erkennen
    if (/getSupabaseAdmin/.test(content)) {
      if (!routePatterns['getSupabaseAdmin-Pattern']) routePatterns['getSupabaseAdmin-Pattern'] = []
      routePatterns['getSupabaseAdmin-Pattern'].push(relPath)
    }
    if (/createClient.*server/.test(content)) {
      if (!routePatterns['server-client-Pattern']) routePatterns['server-client-Pattern'] = []
      routePatterns['server-client-Pattern'].push(relPath)
    }
  }

  for (const [pattern, files] of Object.entries(routePatterns)) {
    if (files.length >= 3) {
      findings.push(
        `${pattern} wird in ${files.length} API-Routen verwendet – Shared-Utility erwägen`
      )
    }
  }

  // Sortierung: größte Dateien zuerst
  largeFiles.sort((a, b) => b.lines - a.lines)

  return NextResponse.json({
    largeFiles,
    duplicateImports: duplicateImports.sort((a, b) => b.usedIn - a.usedIn),
    stats: {
      totalFiles: allFiles.length,
      todoCount,
      fixmeCount,
    },
    findings,
    checkedAt: new Date().toISOString(),
  })
}
