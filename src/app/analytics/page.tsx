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
  TrendingDown,
  Users,
  Loader2,
  RefreshCw,
  BarChart3,
  AlertTriangle,
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
  daily: Array<{
    day: string
    total: number
    sent: number
    pending: number
    customer_inquiries: number
    system_mails: number
  }>
}

interface TopSender {
  sender: string
  email: string
  count: number
  answered: number
  open: number
}

interface TopicItem {
  topic: string
  count: number
}

interface AnalyticsData {
  summary: AnalyticsSummary
  topSenders: TopSender[]
  topics: TopicItem[]
}

// --- Pure SVG/CSS Chart Components ---

function BarChart({ data, maxValue }: { data: Array<{ label: string; value: number; color?: string }>; maxValue?: number }) {
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
  size = 160,
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
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="20"
            className="text-slate-100 dark:text-slate-800" />
          {total > 0 && segments.map((segment, i) => {
            const segmentLength = (segment.value / total) * circumference
            const currentOffset = offset
            offset += segmentLength
            return (
              <circle key={i} cx="80" cy="80" r={radius} fill="none"
                stroke={segment.color} strokeWidth="20"
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-currentOffset}
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{centerValue}</p>
            <p className="text-xs text-slate-500">{centerLabel}</p>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-4">
        {segments.map((segment, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {segment.label}: {segment.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SparklineChart({ data, color = 'text-blue-500' }: { data: number[]; color?: string }) {
  if (data.length === 0) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const width = 120
  const height = 32
  const padding = 2

  const points = data.map((value, i) => {
    const x = padding + (i / Math.max(data.length - 1, 1)) * (width - 2 * padding)
    const y = height - padding - ((value - min) / range) * (height - 2 * padding)
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className={color}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ConfidenceGauge({ value }: { value: number }) {
  const percentage = Math.round(value * 100)
  const color = percentage >= 85 ? '#22c55e' : percentage >= 70 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        <svg className="w-32 h-32" viewBox="0 0 120 120">
          <path d="M 10 90 A 50 50 0 1 1 110 90" fill="none" stroke="currentColor"
            strokeWidth="12" className="text-slate-100 dark:text-slate-800" strokeLinecap="round" />
          <path d="M 10 90 A 50 50 0 1 1 110 90" fill="none" stroke={color}
            strokeWidth="12" strokeLinecap="round"
            strokeDasharray={`${(percentage / 100) * 157} 157`} />
        </svg>
      </div>
      <p className="text-2xl font-bold text-slate-900 dark:text-white -mt-2">{percentage}%</p>
      <p className="text-xs text-slate-500 mt-0.5">Ø Confidence</p>
    </div>
  )
}

// --- Helper ---
function formatMinutes(minutes: number): string {
  if (minutes === 0) return '–'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

// --- Main Component ---
export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/analytics?period=${period}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')
      const result = await response.json()
      setData(result)
    } catch (err) {
      console.error('Analytics fetch error:', err)
      setError('Analytics konnten nicht geladen werden')
    } finally {
      setIsLoading(false)
    }
  }, [period])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Header title="Analytics" description="Support-Performance und AI-Nutzung" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Header title="Analytics" description="Support-Performance und AI-Nutzung" />
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

  const { summary, topSenders, topics } = data
  const { emails, drafts, daily } = summary

  // Calculate trends from daily data
  const totalTopics = topics.reduce((sum, t) => sum + t.count, 0)
  const dailyTotals = daily.map(d => d.total)
  const dailySent = daily.map(d => d.sent)

  // AI adoption rate
  const aiAdoptionRate = drafts.total > 0
    ? Math.round(((drafts.approved + drafts.edited) / drafts.total) * 100)
    : 0

  // Stats cards
  const statsCards = [
    {
      title: 'Total E-Mails',
      value: emails.total.toString(),
      subtitle: `${emails.customer_inquiries} Anfragen, ${emails.system_mails} System`,
      icon: Mail,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      sparkData: dailyTotals,
      sparkColor: 'text-blue-500',
    },
    {
      title: 'Beantwortet',
      value: emails.sent.toString(),
      subtitle: emails.total > 0 ? `${Math.round((emails.sent / emails.total) * 100)}% Abschlussrate` : 'Keine Daten',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      sparkData: dailySent,
      sparkColor: 'text-green-500',
    },
    {
      title: 'AI Übernahmerate',
      value: `${aiAdoptionRate}%`,
      subtitle: `${drafts.approved} direkt, ${drafts.edited} bearbeitet`,
      icon: Brain,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      sparkData: [],
      sparkColor: 'text-purple-500',
    },
    {
      title: 'Offen',
      value: (emails.pending + emails.draft_ready).toString(),
      subtitle: `${emails.pending} ausstehend, ${emails.draft_ready} mit Draft`,
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      sparkData: [],
      sparkColor: 'text-amber-500',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Header
          title="Analytics"
          description="Support-Performance und AI-Nutzung"
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Zeitraum" />
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-slate-500 dark:text-slate-400">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stat.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stat.subtitle}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  {stat.sparkData.length > 1 && (
                    <SparklineChart data={stat.sparkData} color={stat.sparkColor} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket Volume Chart */}
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
                {daily.slice(-14).map((day) => {
                  const maxDaily = Math.max(...daily.map(d => d.total), 1)
                  const date = new Date(day.day)
                  const label = date.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })
                  return (
                    <div key={day.day} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400 w-12 text-right font-mono">
                        {label}
                      </span>
                      <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded overflow-hidden flex">
                        <div
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${(day.customer_inquiries / maxDaily) * 100}%` }}
                          title={`${day.customer_inquiries} Anfragen`}
                        />
                        <div
                          className="h-full bg-slate-300 dark:bg-slate-600 transition-all"
                          style={{ width: `${(day.system_mails / maxDaily) * 100}%` }}
                          title={`${day.system_mails} System`}
                        />
                      </div>
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-6 text-right">
                        {day.total}
                      </span>
                    </div>
                  )
                })}
                <div className="flex items-center gap-4 mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-500" />
                    <span className="text-xs text-slate-500">Anfragen</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-slate-300 dark:bg-slate-600" />
                    <span className="text-xs text-slate-500">System</span>
                  </div>
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
            <div className="flex flex-col items-center gap-6">
              {drafts.total > 0 ? (
                <>
                  <div className="flex items-center gap-8">
                    <ConfidenceGauge value={drafts.avg_confidence} />
                    <DonutChart
                      segments={[
                        { value: drafts.approved, color: '#22c55e', label: 'Übernommen' },
                        { value: drafts.edited, color: '#f59e0b', label: 'Bearbeitet' },
                        { value: drafts.rejected, color: '#ef4444', label: 'Abgelehnt' },
                      ]}
                      centerLabel="Übernahme"
                      centerValue={`${aiAdoptionRate}%`}
                      size={140}
                    />
                  </div>
                  <div className="w-full grid grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-center">
                      <p className="text-sm text-slate-500">High ({'\u2265'}85%)</p>
                      <p className="text-lg font-semibold text-green-600">{drafts.high_confidence}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-500">Medium (70-84%)</p>
                      <p className="text-lg font-semibold text-amber-600">{drafts.medium_confidence}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-500">Low ({'<'}70%)</p>
                      <p className="text-lg font-semibold text-red-600">{drafts.low_confidence}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-center text-slate-500 py-8">Noch keine AI-Drafts generiert</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Topics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Häufigste Themen
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topics.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Keine Themen erkannt</p>
            ) : (
              <div className="space-y-3">
                {topics.map((item) => {
                  const percentage = totalTopics > 0 ? Math.round((item.count / totalTopics) * 100) : 0
                  return (
                    <div key={item.topic}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{item.topic}</span>
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {item.count} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
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
              <p className="text-center text-slate-500 py-8">Keine Absender im Zeitraum</p>
            ) : (
              <div className="space-y-3">
                {topSenders.slice(0, 8).map((sender, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {sender.sender.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {sender.sender}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{sender.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {sender.count}
                      </span>
                      {sender.open > 0 && (
                        <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">
                          {sender.open} offen
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Response Times & Email Types */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Response Times */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Antwortzeiten
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Ø Erste Antwort</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatMinutes(summary.response_times.avg_first_response_minutes)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Ø Lösungszeit</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatMinutes(summary.response_times.avg_resolution_minutes)}
                </p>
              </div>
              {summary.response_times.avg_first_response_minutes === 0 && (
                <p className="text-xs text-slate-400 italic">
                  Wird verfügbar sobald SLA-Tracking aktiv ist
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Email Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              E-Mail Typen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={[
                { label: 'Anfragen', value: emails.customer_inquiries, color: 'bg-blue-500' },
                { label: 'Formulare', value: emails.form_submissions, color: 'bg-purple-500' },
                { label: 'System', value: emails.system_mails, color: 'bg-slate-400' },
              ]}
            />
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Status-Übersicht
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={[
                { label: 'Gesendet', value: emails.sent, color: 'bg-green-500' },
                { label: 'Draft', value: emails.draft_ready, color: 'bg-blue-500' },
                { label: 'Offen', value: emails.pending, color: 'bg-amber-500' },
                { label: 'Abgelehnt', value: emails.rejected, color: 'bg-red-500' },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
