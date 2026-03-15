'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Download,
  Loader2,
  BarChart3,
  Clock,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'

const reportTemplates = [
  {
    id: 'email-overview',
    title: 'Email-Übersicht',
    description: 'Alle ein- und ausgehenden E-Mails nach Zeitraum',
    icon: FileText,
  },
  {
    id: 'sla',
    title: 'SLA Report',
    description: 'SLA-Einhaltung und Reaktionszeiten',
    icon: Clock,
  },
  {
    id: 'csat',
    title: 'Kundenzufriedenheit',
    description: 'CSAT- und Happiness-Scores im Überblick',
    icon: Star,
  },
  {
    id: 'buying-intent',
    title: 'Buying Intent',
    description: 'Heiße Leads und Intent-Scores',
    icon: TrendingUp,
  },
  {
    id: 'team-performance',
    title: 'Team Performance',
    description: 'Antwortzeiten und Auslastung pro Agent',
    icon: Users,
  },
]

const periods = [
  { label: '7 Tage', value: '7d' },
  { label: '30 Tage', value: '30d' },
  { label: '90 Tage', value: '90d' },
]

interface ReportRow {
  [key: string]: string | number
}

export default function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportRow[]>([])

  async function generateReport(reportId: string) {
    setActiveReport(reportId)
    setLoading(true)
    setReportData([])

    try {
      const res = await fetch(`/api/insights?type=${reportId}&period=${selectedPeriod}`)
      if (!res.ok) throw new Error('Fehler beim Laden')
      const data = await res.json()
      setReportData(Array.isArray(data) ? data : data.rows ?? [])
    } catch {
      setReportData([])
    } finally {
      setLoading(false)
    }
  }

  const columns = reportData.length > 0 ? Object.keys(reportData[0]) : []

  return (
    <div className="space-y-6">
      <Header title="Reports" description="Berichte erstellen und exportieren" />

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500 mr-1">Zeitraum:</span>
        {periods.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={selectedPeriod === p.value ? 'default' : 'outline'}
            onClick={() => setSelectedPeriod(p.value)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Report Template Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportTemplates.map((tpl) => {
          const Icon = tpl.icon
          const isActive = activeReport === tpl.id

          return (
            <Card key={tpl.id} className={isActive ? 'ring-2 ring-blue-500' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                    <Icon className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{tpl.title}</CardTitle>
                    <CardDescription className="text-sm">{tpl.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{selectedPeriod}</Badge>
                  <Button
                    size="sm"
                    onClick={() => generateReport(tpl.id)}
                    disabled={loading && activeReport === tpl.id}
                  >
                    {loading && activeReport === tpl.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <BarChart3 className="h-4 w-4 mr-1" />
                    )}
                    Generieren
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Report Result */}
      {activeReport && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {reportTemplates.find((t) => t.id === activeReport)?.title ?? 'Report'}
              </CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href={`/api/reports/export?type=${activeReport}&format=csv&period=${selectedPeriod}`}>
                    <Download className="h-4 w-4 mr-1" />
                    CSV
                  </a>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={`/api/reports/export?type=${activeReport}&format=json&period=${selectedPeriod}`}>
                    <Download className="h-4 w-4 mr-1" />
                    JSON
                  </a>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                <span className="ml-2 text-sm text-slate-500">Report wird generiert...</span>
              </div>
            ) : reportData.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-500">
                Keine Daten für den gewählten Zeitraum vorhanden.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {columns.map((col) => (
                        <th key={col} className="text-left py-2 px-3 font-medium text-slate-600">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-slate-50">
                        {columns.map((col) => (
                          <td key={col} className="py-2 px-3 text-slate-700">
                            {String(row[col] ?? '—')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
