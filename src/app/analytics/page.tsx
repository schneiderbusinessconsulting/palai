'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Mail,
  MessageSquare,
  CheckCircle,
  Clock,
  Brain,
  TrendingUp,
  Users,
  Loader2,
  RefreshCw,
  BarChart3,
  AlertTriangle,
  ShoppingCart,
  AlertOctagon,
  UserMinus,
  BookOpen,
  Smile,
  Frown,
  Meh,
  ZapOff,
} from 'lucide-react'

// Types
interface AnalyticsSummary {
  period: { start: string; end: string; days: number }
  emails: {
    total: number
    sent: number
    pending: number
    draft_ready: number
    rejected: number
    customer_inquiries: number
    form_submissions: number
    system_mails: number
    needs_response: number
  }
  drafts: {
    total: number
    approved: number
    edited: number
    rejected: number
    avg_confidence: number
    high_confidence: number
    medium_confidence: number
    low_confidence: number
  }
  response_times: {
    avg_first_response_minutes: number
    avg_resolution_minutes: number
  }
  sla: { ok: number; at_risk: number; breached: number }
  tone: { positive: number; neutral: number; negative: number; frustrated: number }
  daily: Array<{
    day: string
    total: number
    sent: number
    pending: number
    customer_inquiries: number
    system_mails: number
  }>
}

interface AnalyticsData {
  summary: AnalyticsSummary
  topSenders: Array<{ sender: string; email: string; count: number; answered: number; open: number }>
  topics: Array<{ topic: string; count: number }>
  biInsights: { buying_signals: number; objections: number; churn_risk: number; total: number }
  learning: { total: number; pending: number; extracted: number; avg_edit_distance: number }
}

// --- Pure CSS/SVG Chart Components ---

function BarChart({ data, maxValue }: {
  data: Array<{ label: string; value: number; color?: string }>
  maxValue?: number
}) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1)
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400 w-20 truncate text-right">
            {item.label}
          </span>
          <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden">
            <div
              className={`h-full rounded-md transition-all duration-500 ${item.color || 'bg-blue-500'}`}
              style={{ width: `${Math.max((item.value / max) * 100, 2)}%` }}
            />
          </div>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 w-8 text-right">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function DonutChart({
  segments,
  centerLabel,
  centerValue,
  size = 140,
}: {
  segments: Array<{ value: number; color: string; label: string }>
  centerLabel: string
  centerValue: string
  size?: number
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  const radius = 60
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="20"
            className="text-slate-100 dark:text-slate-800" />
          {total > 0 && segments.map((segment, i) => {
            const len = (segment.value / total) * circumference
            const cur = offset
            offset += len
            return (
              <circle key={i} cx="80" cy="80" r={radius} fill="none"
                stroke={segment.color} strokeWidth="20"
                strokeDasharray={`${len} ${circumference - len}`}
                strokeDashoffset={-cur}
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xl font-bold text-slate-900 dark:text-white">{centerValue}</p>
            <p className="text-[10px] text-slate-500">{centerLabel}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-slate-500 dark:text-slate-400">{seg.label}: {seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SparklineChart({ data, color = 'text-blue-500' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const W = 100; const H = 28; const P = 2
  const pts = data.map((v, i) => {
    const x = P + (i / (data.length - 1)) * (W - 2 * P)
    const y = H - P - ((v - min) / range) * (H - 2 * P)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={W} height={H} className={color}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ConfidenceGauge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 85 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-14 overflow-hidden">
        <svg className="w-28 h-28" viewBox="0 0 120 120">
          <path d="M 10 90 A 50 50 0 1 1 110 90" fill="none" stroke="currentColor"
            strokeWidth="12" className="text-slate-100 dark:text-slate-800" strokeLinecap="round" />
          <path d="M 10 90 A 50 50 0 1 1 110 90" fill="none" stroke={color}
            strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * 157} 157`} />
        </svg>
      </div>
      <p className="text-xl font-bold text-slate-900 dark:text-white -mt-1">{pct}%</p>
      <p className="text-xs text-slate-500">Ø Confidence</p>
    </div>
  )
}

function StatCard({
  title, value, subtitle, icon: Icon, color, bgColor, trend,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ElementType
  color: string
  bgColor: string
  trend?: number[]
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className={`p-2 rounded-lg ${bgColor}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            {trend && trend.length > 1 && <SparklineChart data={trend} color={color.replace('text-', 'text-')} />}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function formatMinutes(m: number): string {
  if (m === 0) return '–'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${m % 60 > 0 ? `${m % 60}m` : ''}`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

// --- Main Page ---
export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/analytics?period=${period}`)
      if (!res.ok) throw new Error('Failed to fetch analytics')
      setData(await res.json())
    } catch (err) {
      console.error(err)
      setError('Analytics konnten nicht geladen werden')
    } finally {
      setIsLoading(false)
    }
  }, [period])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header title="Analytics" description="Support-Performance, AI-Nutzung und Business Intelligence" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Header title="Analytics" description="Support-Performance, AI-Nutzung und Business Intelligence" />
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-3" />
            <p className="text-slate-600 dark:text-slate-400">{error || 'Keine Daten verfügbar'}</p>
            <Button variant="outline" className="mt-4" onClick={fetchAnalytics}>
              <RefreshCw className="h-4 w-4 mr-2" /> Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { summary, topSenders, topics, biInsights, learning } = data
  const { emails, drafts, daily, sla, tone } = summary

  const dailyTotals = daily.map(d => d.total)
  const dailySent = daily.map(d => d.sent)

  const aiAdoptionRate = drafts.total > 0
    ? Math.round(((drafts.approved + drafts.edited) / drafts.total) * 100)
    : 0

  const totalTopics = topics.reduce((s, t) => s + t.count, 0)
  const totalSla = sla.ok + sla.at_risk + sla.breached
  const totalTone = (tone?.positive || 0) + (tone?.neutral || 0) + (tone?.negative || 0) + (tone?.frustrated || 0)

  return (
    <div className="space-y-6">
      {/* Header + Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Header title="Analytics" description="Support-Performance, AI-Nutzung und Business Intelligence" />
        <div className="flex items-center gap-3 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Letzte 24h</SelectItem>
              <SelectItem value="7d">Letzte 7 Tage</SelectItem>
              <SelectItem value="30d">Letzte 30 Tage</SelectItem>
              <SelectItem value="90d">Letzte 90 Tage</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total E-Mails" value={emails.total.toString()}
          subtitle={`${emails.customer_inquiries} Anfragen, ${emails.system_mails} System`}
          icon={Mail} color="text-blue-600" bgColor="bg-blue-100 dark:bg-blue-900/30"
          trend={dailyTotals} />
        <StatCard title="Beantwortet" value={emails.sent.toString()}
          subtitle={emails.total > 0 ? `${Math.round((emails.sent / emails.total) * 100)}% Abschlussrate` : '–'}
          icon={CheckCircle} color="text-green-600" bgColor="bg-green-100 dark:bg-green-900/30"
          trend={dailySent} />
        <StatCard title="AI Übernahmerate" value={`${aiAdoptionRate}%`}
          subtitle={`${drafts.approved} direkt, ${drafts.edited} bearbeitet`}
          icon={Brain} color="text-purple-600" bgColor="bg-purple-100 dark:bg-purple-900/30" />
        <StatCard title="Offen" value={(emails.pending + emails.draft_ready).toString()}
          subtitle={`${emails.pending} ausstehend, ${emails.draft_ready} mit Draft`}
          icon={Clock} color="text-amber-600" bgColor="bg-amber-100 dark:bg-amber-900/30" />
      </div>

      {/* Phase 3: BI Insights Row */}
      <div>
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
          Business Intelligence
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <ShoppingCart className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Kaufsignale</p>
                  <p className="text-2xl font-bold text-green-600">{biInsights.buying_signals}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">Kunden zeigen Kaufinteresse</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <AlertOctagon className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Einwände</p>
                  <p className="text-2xl font-bold text-amber-600">{biInsights.objections}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">Preiseinwände oder Bedenken</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <UserMinus className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Churn-Risiko</p>
                  <p className="text-2xl font-bold text-red-600">{biInsights.churn_risk}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-2">Kunden drohen abzuspringen</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Phase 2: Learning + Tone Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Self-Learning */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              AI Self-Learning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{learning.total}</p>
                <p className="text-xs text-slate-500 mt-1">Korrekturen total</p>
              </div>
              <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <p className="text-2xl font-bold text-amber-600">{learning.pending}</p>
                <p className="text-xs text-slate-500 mt-1">Review ausstehend</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{learning.extracted}</p>
                <p className="text-xs text-slate-500 mt-1">Als Wissen extrahiert</p>
              </div>
            </div>
            {learning.total > 0 && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Ø Änderungsgrad pro Korrektur:{' '}
                  <span className="font-semibold">{learning.avg_edit_distance}%</span>
                  {learning.avg_edit_distance < 20 && (
                    <span className="ml-2 text-green-600 text-xs">AI trifft es gut!</span>
                  )}
                  {learning.avg_edit_distance >= 20 && learning.avg_edit_distance < 50 && (
                    <span className="ml-2 text-amber-600 text-xs">Kleine Korrekturen</span>
                  )}
                  {learning.avg_edit_distance >= 50 && (
                    <span className="ml-2 text-red-600 text-xs">Viele Umschreibungen</span>
                  )}
                </p>
              </div>
            )}
            {learning.total === 0 && (
              <p className="text-center text-slate-400 text-sm mt-4">
                Noch keine Korrekturen im Zeitraum
              </p>
            )}
          </CardContent>
        </Card>

        {/* Phase 5: Tone Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Meh className="h-5 w-5" />
              Kundenstimmung
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalTone > 0 ? (
              <div className="space-y-3">
                {[
                  { label: 'Positiv', value: tone.positive, color: 'bg-green-500', icon: Smile, textColor: 'text-green-600' },
                  { label: 'Neutral', value: tone.neutral, color: 'bg-slate-400', icon: Meh, textColor: 'text-slate-500' },
                  { label: 'Negativ', value: tone.negative, color: 'bg-amber-500', icon: Frown, textColor: 'text-amber-600' },
                  { label: 'Frustriert', value: tone.frustrated, color: 'bg-red-500', icon: ZapOff, textColor: 'text-red-600' },
                ].map(({ label, value, color, icon: Icon, textColor }) => {
                  const pct = totalTone > 0 ? Math.round((value / totalTone) * 100) : 0
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${textColor}`} />
                          <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {value} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${color} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-center text-slate-400 text-sm py-4">
                Tone-Analyse ab dem nächsten Import verfügbar
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Volume + AI Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Volume */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Ticket-Volumen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {daily.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Keine Daten im Zeitraum</p>
            ) : (
              <div className="space-y-1">
                {daily.slice(-14).map(day => {
                  const maxD = Math.max(...daily.map(d => d.total), 1)
                  const label = new Date(day.day).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })
                  return (
                    <div key={day.day} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 w-12 text-right font-mono">{label}</span>
                      <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden flex">
                        <div className="h-full bg-blue-500" style={{ width: `${(day.customer_inquiries / maxD) * 100}%` }} />
                        <div className="h-full bg-slate-300 dark:bg-slate-600" style={{ width: `${(day.system_mails / maxD) * 100}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-6 text-right">{day.total}</span>
                    </div>
                  )
                })}
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500" /><span className="text-xs text-slate-500">Anfragen</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-600" /><span className="text-xs text-slate-500">System</span></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              AI Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {drafts.total > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-around">
                  <ConfidenceGauge value={drafts.avg_confidence} />
                  <DonutChart
                    segments={[
                      { value: drafts.approved, color: '#22c55e', label: 'Direkt' },
                      { value: drafts.edited, color: '#f59e0b', label: 'Bearbeitet' },
                      { value: drafts.rejected, color: '#ef4444', label: 'Abgelehnt' },
                    ]}
                    centerLabel="Übernahme"
                    centerValue={`${aiAdoptionRate}%`}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                  <div className="text-center">
                    <p className="text-xs text-slate-500">High ≥85%</p>
                    <p className="text-lg font-semibold text-green-600">{drafts.high_confidence}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Med 70–84%</p>
                    <p className="text-lg font-semibold text-amber-600">{drafts.medium_confidence}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Low &lt;70%</p>
                    <p className="text-lg font-semibold text-red-600">{drafts.low_confidence}</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-slate-500 py-8">Noch keine AI-Drafts generiert</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Topics + Senders + SLA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Topics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Häufigste Themen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topics.length === 0 ? (
              <p className="text-center text-slate-500 py-6">Keine Themen erkannt</p>
            ) : (
              <div className="space-y-3">
                {topics.map(item => {
                  const pct = totalTopics > 0 ? Math.round((item.count / totalTopics) * 100) : 0
                  return (
                    <div key={item.topic}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{item.topic}</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white ml-2 flex-shrink-0">{item.count}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Senders */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Absender
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSenders.length === 0 ? (
              <p className="text-center text-slate-500 py-6">Keine Absender im Zeitraum</p>
            ) : (
              <div className="space-y-3">
                {topSenders.slice(0, 7).map((sender, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {sender.sender.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{sender.sender}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-sm font-semibold">{sender.count}</span>
                      {sender.open > 0 && (
                        <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">
                          {sender.open}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Phase 4: SLA + Response Times */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              SLA & Zeiten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {totalSla > 0 ? (
                <>
                  <DonutChart
                    segments={[
                      { value: sla.ok, color: '#22c55e', label: 'OK' },
                      { value: sla.at_risk, color: '#f59e0b', label: 'Gefährdet' },
                      { value: sla.breached, color: '#ef4444', label: 'Verletzt' },
                    ]}
                    centerLabel="SLA"
                    centerValue={totalSla > 0 ? `${Math.round((sla.ok / totalSla) * 100)}%` : '–'}
                    size={120}
                  />
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Ø Erste Antwort</span>
                      <span className="font-medium">{formatMinutes(summary.response_times.avg_first_response_minutes)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Ø Lösungszeit</span>
                      <span className="font-medium">{formatMinutes(summary.response_times.avg_resolution_minutes)}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <BarChart
                    data={[
                      { label: 'Gesendet', value: emails.sent, color: 'bg-green-500' },
                      { label: 'Draft', value: emails.draft_ready, color: 'bg-blue-500' },
                      { label: 'Offen', value: emails.pending, color: 'bg-amber-500' },
                    ]}
                  />
                  <p className="text-xs text-slate-400 italic text-center">
                    SLA-Tracking aktiv nach Migration 006
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
