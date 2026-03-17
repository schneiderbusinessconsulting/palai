import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// UX Auditor – Prüft page.tsx-Dateien auf Barrierefreiheit und Lokalisierungsprobleme

export const dynamic = 'force-dynamic'

// Englische Strings, die in einer deutschen App nicht auftauchen sollten
const ENGLISH_STRINGS = [
  'Loading',
  'Error',
  'Submit',
  'Cancel',
  'Delete',
  'Save',
  'Close',
  'Confirm',
  'Success',
  'Failed',
  'No data',
  'No results',
  'Try again',
  'Something went wrong',
  'Are you sure',
]

interface Finding {
  file: string
  line: number
  issue: string
  severity: 'high' | 'medium' | 'low'
}

function findPageFiles(dir: string): string[] {
  const results: string[] = []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...findPageFiles(fullPath))
      } else if (entry.name === 'page.tsx') {
        results.push(fullPath)
      }
    }
  } catch {
    // Verzeichnis nicht lesbar – ignorieren
  }
  return results
}

function auditFile(filePath: string): Finding[] {
  const findings: Finding[] = []
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  // Relativer Pfad für bessere Lesbarkeit
  const relPath = filePath.replace(process.cwd() + '/', '')

  lines.forEach((line, idx) => {
    const lineNum = idx + 1

    // Button ohne aria-label prüfen (Icon-Only Buttons)
    const buttonMatch = line.match(/<(?:B|b)utton/)
    if (buttonMatch) {
      // Prüfen ob in den nächsten paar Zeilen ein aria-label folgt
      const context = lines.slice(idx, Math.min(idx + 3, lines.length)).join(' ')
      const hasAriaLabel = /aria-label/i.test(context)
      const hasTextContent = />[\w\s]+<\/(?:B|b)utton>/.test(context)
      const hasOnlyIcon =
        (/<(?:Icon|Lucide|[\w]+Icon)/.test(context) || /icon/i.test(context)) &&
        !hasTextContent

      if (!hasAriaLabel && hasOnlyIcon) {
        findings.push({
          file: relPath,
          line: lineNum,
          issue: 'Button mit Icon aber ohne aria-label',
          severity: 'high',
        })
      }
    }

    // Icon-Button ohne Tooltip-Wrapper
    if (/<Button.*variant.*ghost|icon/.test(line) || /<button.*className.*icon/.test(line)) {
      const surroundingLines = lines
        .slice(Math.max(0, idx - 2), Math.min(idx + 3, lines.length))
        .join(' ')
      if (!/Tooltip|title=/.test(surroundingLines)) {
        findings.push({
          file: relPath,
          line: lineNum,
          issue: 'Icon-Button ohne Tooltip-Wrapper',
          severity: 'medium',
        })
      }
    }

    // Englische Strings in Ausgabe (nicht in imports/comments)
    if (!line.trim().startsWith('import') && !line.trim().startsWith('//')) {
      for (const eng of ENGLISH_STRINGS) {
        // Nur in JSX-Strings oder Templatestrings suchen
        const patterns = [
          new RegExp(`["'\`]${eng}["'\`]`, 'i'),
          new RegExp(`>${eng}<`, 'i'),
          new RegExp(`\\{["'\`]${eng}["'\`]\\}`, 'i'),
        ]
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            findings.push({
              file: relPath,
              line: lineNum,
              issue: `Englischer String gefunden: "${eng}" – sollte auf Deutsch sein`,
              severity: 'low',
            })
            break // Nur einmal pro String pro Zeile melden
          }
        }
      }
    }

    // Leere States ohne hilfreichen Text
    if (/empty|no.?data|no.?results|keine/i.test(line)) {
      const context = lines.slice(idx, Math.min(idx + 5, lines.length)).join(' ')
      if (!/button|Button|href|onClick|action/i.test(context)) {
        findings.push({
          file: relPath,
          line: lineNum,
          issue: 'Leerer Zustand ohne handlungsfähigen Text/Button',
          severity: 'medium',
        })
      }
    }
  })

  return findings
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret')
  if (secret && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const appDir = path.join(process.cwd(), 'src', 'app')
  const pageFiles = findPageFiles(appDir)
  const allFindings: Finding[] = []

  for (const file of pageFiles) {
    allFindings.push(...auditFile(file))
  }

  // Duplikate entfernen (gleiche Datei + Zeile + Issue)
  const uniqueFindings = allFindings.filter(
    (f, i, arr) =>
      arr.findIndex(
        (x) => x.file === f.file && x.line === f.line && x.issue === f.issue
      ) === i
  )

  const summary = {
    high: uniqueFindings.filter((f) => f.severity === 'high').length,
    medium: uniqueFindings.filter((f) => f.severity === 'medium').length,
    low: uniqueFindings.filter((f) => f.severity === 'low').length,
    filesScanned: pageFiles.length,
  }

  return NextResponse.json({
    findings: uniqueFindings,
    summary,
    checkedAt: new Date().toISOString(),
  })
}
