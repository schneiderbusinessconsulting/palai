'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DashboardBriefing } from '@/components/dashboard/briefing'
import {
  Inbox,
  TrendingUp,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Target,
  Shield,
  BarChart3,
  SmilePlus,
  Frown,
  Meh,
  FileCheck,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Mail,
  MailCheck,
} from 'lucide-react'
import Link from 'next/link'
import { formatRelativeDate } from '@/lib/utils'

interface Email {
  id: string
  from_email: string
  from_name?: string
  subject: string
  received_at: string
  updated_at?: string
  status: string
  email_type?: string
  needs_response?: boolean
  buying_intent_score?: number
  priority?: string
  sla_status?: string
  tone_sentiment?: string
  tone_urgency?: string
  email_drafts?: Array<{ confidence_score: number }>
}

interface AnalyticsData {
  drafts: { total: number; approved: number; edited: number; rejected: number; avg_confidence: number }
  tone: { positive: number; neutral: number; negative: number; frustrated: number }
  daily: Array<{ day: string; total: number; sent: number; pending: number }>
}

interface HotLead {
  id: string
  from_name?: string
  from_email: string
  subject: string
  buying_intent_score?: number
  received_at: string
  status: string
}

interface SlaEmail {
  id: string
  from_name?: string
  from_email: string
  subject: string
  priority: string
  received_at: string
  deadline: Date
  remainingMs: number
}

interface SlaStats {
  doneToday: number
  dueNow: SlaEmail[]
  overdue: SlaEmail[]
  later: number
  totalTarget: number
}

interface WorkloadStats {
  backlog: number
  inbound: { today: number; week: number; month: number }
  inboundAvg: { day: number; week: number; month: number }
  resolved: { today: number; week: number; month: number }
  resolvedAvg: { day: number; week: number; month: number }
  trend: { inboundVsLastWeek: number; resolvedVsLastWeek: number }
}

interface Level1Stats {
  backlog: number
  avgResponseHours: number | null
  slaCompliance: number | null
  resolutionRate: number | null
}

const SLA_RESOLUTION_MINUTES: Record<string, number> = {
  critical: 240,   // 4h
  high: 480,       // 8h
  normal: 1440,    // 24h
  low: 2880,       // 48h
}

function computeSlaStats(allEmails: Email[]): SlaStats {
  const now = Date.now()
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999)

  const openActionable = allEmails.filter(e =>
    e.status !== 'sent' &&
    e.status !== 'rejected' &&
    e.email_type !== 'system_alert' &&
    e.email_type !== 'notification' &&
    (e.email_type !== 'form_submission' || e.needs_response)
  )

  const overdue: SlaEmail[] = []
  const dueNow: SlaEmail[] = []
  let later = 0

  for (const email of openActionable) {
    const priority = email.priority || 'normal'
    const thresholdMin = SLA_RESOLUTION_MINUTES[priority] || SLA_RESOLUTION_MINUTES.normal
    const receivedMs = new Date(email.received_at).getTime()
    const deadline = new Date(receivedMs + thresholdMin * 60000)
    const remainingMs = deadline.getTime() - now

    const slaEmail: SlaEmail = {
      id: email.id,
      from_name: email.from_name,
      from_email: email.from_email,
      subject: email.subject,
      priority,
      received_at: email.received_at,
      deadline,
      remainingMs,
    }

    if (remainingMs <= 0) {
      overdue.push(slaEmail)
    } else if (deadline <= todayEnd) {
      dueNow.push(slaEmail)
    } else {
      later++
    }
  }

  overdue.sort((a, b) => a.remainingMs - b.remainingMs)
  dueNow.sort((a, b) => a.remainingMs - b.remainingMs)

  const sentToday = allEmails.filter(e => {
    if (e.status !== 'sent') return false
    const d = new Date(e.received_at)
    return d >= todayStart
  }).length

  const totalTarget = sentToday + dueNow.length + overdue.length

  return { doneToday: sentToday, dueNow, overdue, later, totalTarget }
}

function formatSlaRemaining(ms: number): string {
  if (ms <= 0) {
    const overMs = Math.abs(ms)
    const mins = Math.floor(overMs / 60000)
    if (mins < 60) return `${mins}min überfällig`
    const hours = Math.floor(mins / 60)
    return `${hours}h überfällig`
  }
  const mins = Math.floor(ms / 60000)
  if (mins < 60) return `noch ${mins}min`
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (remMins === 0) return `noch ${hours}h`
  return `noch ${hours}h ${remMins}min`
}

function getSlaUrgencyColor(remainingMs: number): string {
  if (remainingMs <= 0) return 'text-red-600'
  if (remainingMs <= 30 * 60000) return 'text-red-500'
  if (remainingMs <= 2 * 3600000) return 'text-amber-600'
  return 'text-green-600'
}

function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'critical': return 'Kritisch'
    case 'high': return 'Hoch'
    case 'low': return 'Niedrig'
    default: return 'Normal'
  }
}

function getPriorityBadgeColor(priority: string): string {
  switch (priority) {
    case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
    case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    case 'low': return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
    default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
  }
}

function computeWorkload(
  allEmails: Email[],
  daily: Array<{ day: string; total: number; sent: number; pending: number }>
): WorkloadStats {
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(todayStart)
  const dow = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const isActionable = (e: Email) =>
    e.email_type !== 'system_alert' &&
    e.email_type !== 'notification' &&
    (e.email_type !== 'form_submission' || e.needs_response)

  const actionable = allEmails.filter(isActionable)
  const backlog = actionable.filter(e => e.status !== 'sent' && e.status !== 'rejected').length

  const inboundToday = actionable.filter(e => new Date(e.received_at) >= todayStart).length
  const inboundWeek = actionable.filter(e => new Date(e.received_at) >= weekStart).length
  const inboundMonth = actionable.filter(e => new Date(e.received_at) >= monthStart).length

  const sentEmails = actionable.filter(e => e.status === 'sent')
  const resolvedToday = sentEmails.filter(e => {
    const d = e.updated_at ? new Date(e.updated_at) : new Date(e.received_at)
    return d >= todayStart
  }).length
  const resolvedWeek = sentEmails.filter(e => {
    const d = e.updated_at ? new Date(e.updated_at) : new Date(e.received_at)
    return d >= weekStart
  }).length
  const resolvedMonth = sentEmails.filter(e => {
    const d = e.updated_at ? new Date(e.updated_at) : new Date(e.received_at)
    return d >= monthStart
  }).length

  const daysInData = Math.max(daily.length, 1)
  const totalIncoming = daily.reduce((s, d) => s + d.total, 0)
  const totalSent = daily.reduce((s, d) => s + d.sent, 0)
  const weeksInData = Math.max(daysInData / 7, 1)
  const monthsInData = Math.max(daysInData / 30, 1)

  const todayStr = now.toISOString().split('T')[0]
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const lastWeekEnd = new Date(weekStart)
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)

  const thisWeekDaily = daily.filter(d => d.day >= weekStartStr && d.day <= todayStr)
  const lastWeekDaily = daily.filter(d => d.day >= lastWeekStart.toISOString().split('T')[0] && d.day <= lastWeekEnd.toISOString().split('T')[0])

  const thisWeekInbound = thisWeekDaily.reduce((s, d) => s + d.total, 0)
  const lastWeekInbound = lastWeekDaily.reduce((s, d) => s + d.total, 0)
  const thisWeekResolved = thisWeekDaily.reduce((s, d) => s + d.sent, 0)
  const lastWeekResolved = lastWeekDaily.reduce((s, d) => s + d.sent, 0)

  const inboundVsLastWeek = lastWeekInbound > 0 ? Math.round(((thisWeekInbound - lastWeekInbound) / lastWeekInbound) * 100) : 0
  const resolvedVsLastWeek = lastWeekResolved > 0 ? Math.round(((thisWeekResolved - lastWeekResolved) / lastWeekResolved) * 100) : 0

  return {
    backlog,
    inbound: { today: inboundToday, week: inboundWeek, month: inboundMonth },
    inboundAvg: {
      day: Math.round((totalIncoming / daysInData) * 10) / 10,
      week: Math.round(totalIncoming / weeksInData),
      month: Math.round(totalIncoming / monthsInData),
    },
    resolved: { today: resolvedToday, week: resolvedWeek, month: resolvedMonth },
    resolvedAvg: {
      day: Math.round((totalSent / daysInData) * 10) / 10,
      week: Math.round(totalSent / weeksInData),
      month: Math.round(totalSent / monthsInData),
    },
    trend: { inboundVsLastWeek, resolvedVsLastWeek },
  }
}

function TrendPill({ value, invertColor }: { value: number; invertColor?: boolean }) {
  const positive = invertColor ? value < 0 : value > 0
  const negative = invertColor ? value > 0 : value < 0
  return (
    <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-medium ${
      positive ? 'bg-green-50 dark:bg-green-900/20 text-green-600' :
      negative ? 'bg-red-50 dark:bg-red-900/20 text-red-600' :
      'bg-slate-50 dark:bg-slate-800/30 text-slate-500'
    }`}>
      {value > 0 ? <ArrowUpRight className="h-3 w-3" /> :
       value < 0 ? <ArrowDownRight className="h-3 w-3" /> :
       <Minus className="h-3 w-3" />}
      {value > 0 ? '+' : ''}{value}%
    </span>
  )
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [hotLeads, setHotLeads] = useState<HotLead[]>([])
  const [slaStats, setSlaStats] = useState<SlaStats>({ doneToday: 0, dueNow: [], overdue: [], later: 0, totalTarget: 0 })
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [sentimentDist, setSentimentDist] = useState<Record<string, number>>({})
  const [workload, setWorkload] = useState<WorkloadStats | null>(null)
  const [level1, setLevel1] = useState<Level1Stats>({ backlog: 0, avgResponseHours: null, slaCompliance: null, resolutionRate: null })
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchData = async () => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const [emailRes, insightsRes, analyticsRes] = await Promise.all([
        fetch('/api/emails?limit=200'),
        fetch('/api/insights'),
        fetch('/api/analytics?period=30d'),
      ])

      let allEmails: Email[] = []

      if (emailRes.ok) {
        const data = await emailRes.json()
        const all: Email[] = data.emails || []
        allEmails = all

        const isActionable = (e: Email) =>
          e.email_type !== 'system_alert' &&
          e.email_type !== 'notification' &&
          (e.email_type !== 'form_submission' || e.needs_response)

        const actionable = all.filter(isActionable)
        const backlog = actionable.filter(e => e.status !== 'sent' && e.status !== 'rejected').length

        // Sentiment
        const sDist: Record<string, number> = { positive: 0, neutral: 0, negative: 0, frustrated: 0 }
        const responseTimes: number[] = []

        for (const e of all) {
          if (!isActionable(e)) continue
          if (e.tone_sentiment) sDist[e.tone_sentiment] = (sDist[e.tone_sentiment] || 0) + 1
          if (e.status === 'sent' && e.updated_at) {
            const received = new Date(e.received_at).getTime()
            const resolved = new Date(e.updated_at).getTime()
            if (resolved > received) responseTimes.push(resolved - received)
          }
        }

        setSentimentDist(sDist)
        setSlaStats(computeSlaStats(all))

        // SLA compliance from sla_status field
        const withSla = actionable.filter(e => e.sla_status)
        const slaOk = withSla.filter(e => e.sla_status === 'ok' || e.sla_status === 'at_risk').length
        const slaBreached = withSla.filter(e => e.sla_status === 'breached').length
        const slaCompliance = (slaOk + slaBreached) > 0 ? Math.round((slaOk / (slaOk + slaBreached)) * 100) : null

        // Resolution rate: resolved today / (resolved today + still open today)
        const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
        const inboundToday = actionable.filter(e => new Date(e.received_at) >= todayStart)
        const resolvedToday = inboundToday.filter(e => e.status === 'sent').length
        const resolutionRate = inboundToday.length > 0 ? Math.round((resolvedToday / inboundToday.length) * 100) : null

        const avgResponseHours = responseTimes.length > 0
          ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 3600000) * 10) / 10
          : null

        setLevel1({ backlog, avgResponseHours, slaCompliance, resolutionRate })
      }

      let dailyData: Array<{ day: string; total: number; sent: number; pending: number }> = []
      if (analyticsRes.ok) {
        const analyticsJson = await analyticsRes.json()
        dailyData = analyticsJson.summary?.daily || []
        setAnalyticsData({
          drafts: analyticsJson.summary?.drafts || { total: 0, approved: 0, edited: 0, rejected: 0, avg_confidence: 0 },
          tone: analyticsJson.summary?.tone || { positive: 0, neutral: 0, negative: 0, frustrated: 0 },
          daily: dailyData,
        })
      }

      if (allEmails.length > 0 || dailyData.length > 0) {
        setWorkload(computeWorkload(allEmails, dailyData))
      }

      if (insightsRes.ok) {
        const ins = await insightsRes.json()
        const leads: HotLead[] = ins.sales?.hotLeads?.slice(0, 5) || []
        setHotLeads(leads)
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error)
      setFetchError('Daten konnten nicht geladen werden. Bitte Seite aktualisieren.')
    } finally {
      setIsLoading(false)
      setLastUpdated(new Date())
    }
  }

  useEffect(() => { fetchData() }, [])

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 120_000)
    return () => clearInterval(interval)
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  })()

  return (
    <div className="space-y-6">
      <Header
        title={`${greeting}, Philipp`}
        description="Hier ist dein heutiger Stand auf einen Blick."
      />

      {/* Daily Briefing */}
      <DashboardBriefing />

      {/* Error Banner */}
      {fetchError && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {fetchError}
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Erneut laden
          </Button>
        </div>
      )}

      {/* Refresh */}
      <div className="flex items-center justify-end gap-3 -mt-4">
        {lastUpdated && (
          <span className="text-xs text-slate-400">
            Zuletzt: {formatRelativeDate(lastUpdated.toISOString())}
          </span>
        )}
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* ═══════════════════════════════════════════════════
          LEVEL 1 — Blick (3 Sekunden): Wie stehen wir?
          ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Backlog */}
        <Link href="/inbox">
          <div className={`p-5 rounded-xl border-2 transition-all cursor-pointer ${
            level1.backlog > 10 ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700' :
            level1.backlog > 0 ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800' :
            'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
          } hover:shadow-md`}>
            <div className="flex items-center justify-between mb-2">
              <Inbox className={`h-5 w-5 ${level1.backlog > 10 ? 'text-amber-600' : level1.backlog > 0 ? 'text-blue-600' : 'text-green-600'}`} />
              {workload && <TrendPill value={workload.trend.inboundVsLastWeek} invertColor />}
            </div>
            <p className={`text-3xl font-bold ${level1.backlog > 10 ? 'text-amber-700 dark:text-amber-400' : level1.backlog > 0 ? 'text-blue-700 dark:text-blue-400' : 'text-green-700 dark:text-green-400'}`}>
              {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : level1.backlog}
            </p>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Backlog</p>
          </div>
        </Link>

        {/* Ø Antwortzeit */}
        <div className={`p-5 rounded-xl border-2 transition-all ${
          level1.avgResponseHours !== null && level1.avgResponseHours > 24 ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800' :
          level1.avgResponseHours !== null && level1.avgResponseHours > 4 ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800' :
          'border-slate-200 bg-slate-50 dark:bg-slate-800/30 dark:border-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <Clock className={`h-5 w-5 ${
              level1.avgResponseHours !== null && level1.avgResponseHours > 24 ? 'text-red-600' :
              level1.avgResponseHours !== null && level1.avgResponseHours > 4 ? 'text-amber-600' :
              'text-blue-600'
            }`} />
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> :
              level1.avgResponseHours !== null ? (
                level1.avgResponseHours < 1 ? `${Math.round(level1.avgResponseHours * 60)}m` : `${level1.avgResponseHours}h`
              ) : '—'}
          </p>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Ø Antwortzeit</p>
        </div>

        {/* SLA Quote */}
        <div className={`p-5 rounded-xl border-2 transition-all ${
          level1.slaCompliance !== null && level1.slaCompliance < 80 ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800' :
          level1.slaCompliance !== null && level1.slaCompliance < 95 ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800' :
          'border-slate-200 bg-slate-50 dark:bg-slate-800/30 dark:border-slate-700'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <Shield className={`h-5 w-5 ${
              level1.slaCompliance !== null && level1.slaCompliance >= 95 ? 'text-green-600' :
              level1.slaCompliance !== null && level1.slaCompliance >= 80 ? 'text-amber-600' :
              'text-slate-500'
            }`} />
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> :
              level1.slaCompliance !== null ? `${level1.slaCompliance}%` : '—'}
          </p>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">SLA Quote</p>
        </div>

        {/* Resolution Rate */}
        <div className="p-5 rounded-xl border-2 border-slate-200 bg-slate-50 dark:bg-slate-800/30 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle2 className={`h-5 w-5 ${
              level1.resolutionRate !== null && level1.resolutionRate >= 80 ? 'text-green-600' :
              level1.resolutionRate !== null && level1.resolutionRate >= 50 ? 'text-amber-600' :
              'text-slate-500'
            }`} />
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">
            {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> :
              level1.resolutionRate !== null ? `${level1.resolutionRate}%` : '—'}
          </p>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Heute gelöst</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          LEVEL 2 — Check (30s): Was braucht Aufmerksamkeit?
          ═══════════════════════════════════════════════════ */}
      {!isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* SLA Deadlines */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-500" />
                  SLA Deadlines
                </span>
                <span className="text-sm font-normal text-slate-500">
                  {slaStats.overdue.length > 0 && (
                    <span className="text-red-600 font-semibold">{slaStats.overdue.length} überfällig</span>
                  )}
                  {slaStats.overdue.length > 0 && slaStats.dueNow.length > 0 && ' · '}
                  {slaStats.dueNow.length > 0 && (
                    <span className="text-amber-600">{slaStats.dueNow.length} fällig</span>
                  )}
                  {slaStats.overdue.length === 0 && slaStats.dueNow.length === 0 && (
                    <span className="text-green-600">Alles im Rahmen</span>
                  )}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(slaStats.overdue.length > 0 || slaStats.dueNow.length > 0) ? (
                <div className="space-y-1.5">
                  {[...slaStats.overdue, ...slaStats.dueNow].slice(0, 5).map(email => (
                    <Link key={email.id} href="/inbox">
                      <div className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${
                        email.remainingMs <= 0
                          ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{email.subject}</p>
                          <p className="text-xs text-slate-500 truncate">{email.from_name || email.from_email}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={`text-xs px-1.5 py-0.5 ${getPriorityBadgeColor(email.priority)}`}>
                            {getPriorityLabel(email.priority)}
                          </Badge>
                          <span className={`text-xs font-medium ${getSlaUrgencyColor(email.remainingMs)}`}>
                            {formatSlaRemaining(email.remainingMs)}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {(slaStats.overdue.length + slaStats.dueNow.length) > 5 && (
                    <Link href="/inbox">
                      <p className="text-xs text-slate-500 text-center pt-1 hover:text-blue-500 transition-colors">
                        + {slaStats.overdue.length + slaStats.dueNow.length - 5} weitere →
                      </p>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <Shield className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">Alle SLA-Ziele eingehalten</p>
                    <p className="text-xs text-green-600 dark:text-green-500">Keine Deadline offen.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Hot Leads */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Hot Leads
                  {hotLeads.length > 0 && (
                    <span className="text-sm font-normal text-emerald-600">{hotLeads.length}</span>
                  )}
                </span>
                {hotLeads.length > 0 && (
                  <Link href="/insights?tab=sales">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs">
                      Insights <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hotLeads.length === 0 ? (
                <div className="text-center py-6">
                  <TrendingUp className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm text-slate-400">Keine Hot Leads aktuell</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {hotLeads.map(lead => (
                    <Link key={lead.id} href="/inbox">
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{lead.subject}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {lead.from_name || lead.from_email}
                            <span className="mx-1.5 text-slate-300">·</span>
                            {formatRelativeDate(lead.received_at)}
                            {lead.status !== 'sent' && (
                              <span className="ml-1.5 text-amber-500 font-medium">offen</span>
                            )}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex-shrink-0">{lead.buying_intent_score}%</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════
          LEVEL 3 — Review (2 Min): Wie entwickeln wir uns?
          ═══════════════════════════════════════════════════ */}
      {!isLoading && workload && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-500" />
              Workload Übersicht
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Eingang */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-500" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Eingang</h3>
                  </div>
                  <TrendPill value={workload.trend.inboundVsLastWeek} invertColor />
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Zeitraum</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">Absolut</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">Ø Schnitt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {[
                        { label: 'Heute', abs: workload.inbound.today, avg: `${workload.inboundAvg.day} /Tag` },
                        { label: 'Diese Woche', abs: workload.inbound.week, avg: `${workload.inboundAvg.week} /Wo` },
                        { label: 'Dieser Monat', abs: workload.inbound.month, avg: `${workload.inboundAvg.month} /Mo` },
                      ].map(row => (
                        <tr key={row.label}>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{row.label}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-800 dark:text-slate-200">{row.abs}</td>
                          <td className="px-3 py-2.5 text-right text-slate-500 dark:text-slate-400">{row.avg}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Beantwortet */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MailCheck className="h-4 w-4 text-green-500" />
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Beantwortet</h3>
                  </div>
                  <TrendPill value={workload.trend.resolvedVsLastWeek} />
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50">
                        <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Zeitraum</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">Absolut</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">Ø Schnitt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {[
                        { label: 'Heute', abs: workload.resolved.today, avg: `${workload.resolvedAvg.day} /Tag` },
                        { label: 'Diese Woche', abs: workload.resolved.week, avg: `${workload.resolvedAvg.week} /Wo` },
                        { label: 'Dieser Monat', abs: workload.resolved.month, avg: `${workload.resolvedAvg.month} /Mo` },
                      ].map(row => (
                        <tr key={row.label}>
                          <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{row.label}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-green-700 dark:text-green-400">{row.abs}</td>
                          <td className="px-3 py-2.5 text-right text-slate-500 dark:text-slate-400">{row.avg}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* AI & Stimmung */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Sentiment */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-900/20">
                  <SmilePlus className="h-4 w-4 text-violet-600" />
                </div>
                <p className="text-xs text-slate-500">Kunden-Stimmung</p>
              </div>
              {(() => {
                const total = (sentimentDist.positive || 0) + (sentimentDist.neutral || 0) + (sentimentDist.negative || 0) + (sentimentDist.frustrated || 0)
                if (total === 0) return <p className="text-xs text-slate-400">Noch keine Daten</p>
                const pct = (v: number) => Math.round((v / total) * 100)
                return (
                  <div className="space-y-1.5">
                    {[
                      { label: 'Positiv', value: sentimentDist.positive || 0, color: 'bg-green-500' },
                      { label: 'Neutral', value: sentimentDist.neutral || 0, color: 'bg-slate-400' },
                      { label: 'Negativ', value: (sentimentDist.negative || 0) + (sentimentDist.frustrated || 0), color: 'bg-red-400' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 w-14">{s.label}</span>
                        <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${s.color}`} style={{ width: `${pct(s.value)}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-8 text-right">{pct(s.value)}%</span>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* Draft Acceptance */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                  <FileCheck className="h-4 w-4 text-emerald-600" />
                </div>
                <p className="text-xs text-slate-500">AI Draft Akzeptanz</p>
              </div>
              {(() => {
                const d = analyticsData?.drafts
                if (!d || d.total === 0) return <p className="text-xs text-slate-400">Noch keine Daten</p>
                const acceptRate = Math.round(((d.approved + d.edited) / d.total) * 100)
                return (
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{acceptRate}%</span>
                      <span className="text-xs text-slate-400">akzeptiert</span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <span className="text-green-600">{d.approved} direkt</span>
                      <span className="text-amber-600">{d.edited} bearbeitet</span>
                      <span className="text-red-500">{d.rejected} verworfen</span>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* 7-Day Trend */}
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                </div>
                <p className="text-xs text-slate-500">7-Tage Trend</p>
              </div>
              {(() => {
                const daily = analyticsData?.daily || []
                const last7 = daily.slice(-7)
                if (last7.length === 0) return <p className="text-xs text-slate-400">Noch keine Daten</p>
                const maxVal = Math.max(...last7.map(d => d.total), 1)
                return (
                  <div className="space-y-2">
                    <div className="flex items-end gap-1 h-16">
                      {last7.map((d, i) => {
                        const h = Math.max((d.total / maxVal) * 100, 4)
                        const sentH = d.sent > 0 ? Math.max((d.sent / maxVal) * 100, 2) : 0
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                            <div className="w-full relative" style={{ height: `${h}%` }}>
                              <div className="absolute bottom-0 w-full bg-blue-200 dark:bg-blue-800 rounded-t" style={{ height: '100%' }} />
                              {sentH > 0 && (
                                <div className="absolute bottom-0 w-full bg-green-500 rounded-t" style={{ height: `${sentH}%` }} />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-1">
                      {last7.map((d, i) => (
                        <span key={i} className="flex-1 text-center text-[10px] text-slate-400">
                          {new Date(d.day).toLocaleDateString('de', { weekday: 'short' }).slice(0, 2)}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-200 dark:bg-blue-800" />Eingang</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Beantwortet</span>
                    </div>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  )
}
