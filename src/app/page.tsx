'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Inbox,
  TrendingUp,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  BookOpen,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Target,
  Timer,
  Shield,
  BarChart3,
  ThumbsUp,
  Zap,
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
  open: { today: number; week: number; month: number }
  done: { today: number; week: number; month: number }
  avg: { dayOpen: number; dayDone: number; weekOpen: number; weekDone: number; monthOpen: number; monthDone: number }
  trend: { openVsLastWeek: number; doneVsLastWeek: number } // percentage change
}

interface DashboardStats {
  pendingEmails: number
  draftReadyEmails: number
  urgentEmails: number
  hotLeads: number
  sentToday: number
  kbChunkCount: number
}

function formatTimeAgo(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)
  if (mins < 60) return `vor ${mins} Min`
  if (hours < 24) return `vor ${hours}h`
  if (days === 1) return 'gestern'
  return `vor ${days}d`
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

  // Done today: sent emails resolved today
  const doneToday = allEmails.filter(e =>
    e.status === 'sent' &&
    e.email_type !== 'system_alert' &&
    e.email_type !== 'notification'
  ).filter(e => {
    // Use received_at as proxy since resolved_at isn't in the API response
    // Sent emails with recent activity count as done today
    return true // We'll use the sentToday stat separately
  }).length

  // Open emails with SLA deadlines
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

  // Sort: overdue by most overdue first, dueNow by soonest deadline first
  overdue.sort((a, b) => a.remainingMs - b.remainingMs)
  dueNow.sort((a, b) => a.remainingMs - b.remainingMs)

  const sentToday = allEmails.filter(e => {
    if (e.status !== 'sent') return false
    const d = new Date(e.received_at)
    return d >= todayStart // approximation
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
  if (remainingMs <= 30 * 60000) return 'text-red-500'       // < 30min
  if (remainingMs <= 2 * 3600000) return 'text-amber-600'    // < 2h
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

  // Monday of this week
  const weekStart = new Date(todayStart)
  const dow = weekStart.getDay()
  weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1))

  // 1st of this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  // Filter actionable (exclude system/notification)
  const isActionable = (e: Email) =>
    e.email_type !== 'system_alert' &&
    e.email_type !== 'notification' &&
    (e.email_type !== 'form_submission' || e.needs_response)

  const actionable = allEmails.filter(isActionable)

  // Open: currently open emails received in each period
  const openEmails = actionable.filter(e => e.status !== 'sent' && e.status !== 'rejected')
  const openToday = openEmails.filter(e => new Date(e.received_at) >= todayStart).length
  const openWeek = openEmails.filter(e => new Date(e.received_at) >= weekStart).length
  const openMonth = openEmails.filter(e => new Date(e.received_at) >= monthStart).length

  // Done: sent emails resolved in each period (use updated_at)
  const sentEmails = actionable.filter(e => e.status === 'sent')
  const doneToday = sentEmails.filter(e => {
    const d = e.updated_at ? new Date(e.updated_at) : new Date(e.received_at)
    return d >= todayStart
  }).length
  const doneWeek = sentEmails.filter(e => {
    const d = e.updated_at ? new Date(e.updated_at) : new Date(e.received_at)
    return d >= weekStart
  }).length
  const doneMonth = sentEmails.filter(e => {
    const d = e.updated_at ? new Date(e.updated_at) : new Date(e.received_at)
    return d >= monthStart
  }).length

  // Averages from analytics daily data
  const daysInData = Math.max(daily.length, 1)
  const totalIncoming = daily.reduce((s, d) => s + d.total, 0)
  const totalSent = daily.reduce((s, d) => s + d.sent, 0)
  const totalPending = daily.reduce((s, d) => s + d.pending, 0)

  const avgDayDone = Math.round((totalSent / daysInData) * 10) / 10
  const avgDayOpen = Math.round((totalPending / daysInData) * 10) / 10
  const weeksInData = Math.max(daysInData / 7, 1)
  const monthsInData = Math.max(daysInData / 30, 1)

  // Trend: compare this week vs last week using daily data
  const todayStr = now.toISOString().split('T')[0]
  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)
  const lastWeekEnd = new Date(weekStart)
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1)

  const thisWeekDaily = daily.filter(d => d.day >= weekStart.toISOString().split('T')[0] && d.day <= todayStr)
  const lastWeekDaily = daily.filter(d => d.day >= lastWeekStart.toISOString().split('T')[0] && d.day <= lastWeekEnd.toISOString().split('T')[0])

  const thisWeekSent = thisWeekDaily.reduce((s, d) => s + d.sent, 0)
  const lastWeekSent = lastWeekDaily.reduce((s, d) => s + d.sent, 0)
  const thisWeekPending = thisWeekDaily.reduce((s, d) => s + d.pending, 0)
  const lastWeekPending = lastWeekDaily.reduce((s, d) => s + d.pending, 0)

  const doneVsLastWeek = lastWeekSent > 0 ? Math.round(((thisWeekSent - lastWeekSent) / lastWeekSent) * 100) : 0
  const openVsLastWeek = lastWeekPending > 0 ? Math.round(((thisWeekPending - lastWeekPending) / lastWeekPending) * 100) : 0

  return {
    open: { today: openToday, week: openWeek, month: openMonth },
    done: { today: doneToday, week: doneWeek, month: doneMonth },
    avg: {
      dayOpen: avgDayOpen,
      dayDone: avgDayDone,
      weekOpen: Math.round(totalPending / weeksInData),
      weekDone: Math.round(totalSent / weeksInData),
      monthOpen: Math.round(totalPending / monthsInData),
      monthDone: Math.round(totalSent / monthsInData),
    },
    trend: { openVsLastWeek, doneVsLastWeek },
  }
}

function getPriorityColor(email: Email) {
  if ((email.buying_intent_score ?? 0) >= 60) return 'border-l-emerald-500'
  if (email.email_drafts?.[0]?.confidence_score === 0 || !email.email_drafts?.length) return 'border-l-amber-400'
  return 'border-l-blue-400'
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [urgentEmails, setUrgentEmails] = useState<Email[]>([])
  const [hotLeads, setHotLeads] = useState<HotLead[]>([])
  const [slaStats, setSlaStats] = useState<SlaStats>({ doneToday: 0, dueNow: [], overdue: [], later: 0, totalTarget: 0 })
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [priorityDist, setPriorityDist] = useState<Record<string, number>>({})
  const [sentimentDist, setSentimentDist] = useState<Record<string, number>>({})
  const [urgencyDist, setUrgencyDist] = useState<Record<string, number>>({})
  const [avgResponseHours, setAvgResponseHours] = useState<number | null>(null)
  const [workload, setWorkload] = useState<WorkloadStats | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    pendingEmails: 0,
    draftReadyEmails: 0,
    urgentEmails: 0,
    hotLeads: 0,
    sentToday: 0,
    kbChunkCount: 0,
  })

  const fetchData = async () => {
    setIsLoading(true)
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

        // Filter actionable emails (exclude system/notification, exclude sent)
        const actionable = all.filter(e =>
          e.status !== 'sent' &&
          e.email_type !== 'system_alert' &&
          e.email_type !== 'notification' &&
          (e.email_type !== 'form_submission' || e.needs_response)
        )

        const pending = actionable.filter(e => e.status === 'pending').length
        const draftReady = actionable.filter(e => e.status === 'draft_ready').length
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const sentToday = all.filter(e =>
          e.status === 'sent' && new Date(e.received_at) >= today
        ).length

        // Top urgent: no draft yet, sorted by recency
        const noDraft = actionable
          .filter(e => e.status === 'pending' && !e.email_drafts?.length)
          .sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime())
          .slice(0, 4)

        // Compute distributions from all emails
        const pDist: Record<string, number> = { critical: 0, high: 0, normal: 0, low: 0 }
        const sDist: Record<string, number> = { positive: 0, neutral: 0, negative: 0, frustrated: 0 }
        const uDist: Record<string, number> = { high: 0, medium: 0, low: 0 }
        const responseTimes: number[] = []

        for (const e of all) {
          if (e.email_type === 'system_alert' || e.email_type === 'notification') continue
          // Priority
          const p = e.priority || 'normal'
          pDist[p] = (pDist[p] || 0) + 1
          // Sentiment
          if (e.tone_sentiment) sDist[e.tone_sentiment] = (sDist[e.tone_sentiment] || 0) + 1
          // Urgency
          if (e.tone_urgency) uDist[e.tone_urgency] = (uDist[e.tone_urgency] || 0) + 1
          // Response time for sent emails
          if (e.status === 'sent' && e.updated_at) {
            const received = new Date(e.received_at).getTime()
            const resolved = new Date(e.updated_at).getTime()
            if (resolved > received) responseTimes.push(resolved - received)
          }
        }

        setPriorityDist(pDist)
        setSentimentDist(sDist)
        setUrgencyDist(uDist)
        setAvgResponseHours(
          responseTimes.length > 0
            ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length / 3600000) * 10) / 10
            : null
        )

        setUrgentEmails(noDraft)
        setSlaStats(computeSlaStats(all))
        setStats(prev => ({ ...prev, pendingEmails: pending, draftReadyEmails: draftReady, urgentEmails: noDraft.length, sentToday }))
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

      // Compute workload from emails + analytics daily
      if (allEmails.length > 0 || dailyData.length > 0) {
        setWorkload(computeWorkload(allEmails, dailyData))
      }

      if (insightsRes.ok) {
        const ins = await insightsRes.json()
        const leads: HotLead[] = ins.sales?.hotLeads?.slice(0, 5) || []
        setHotLeads(leads)
        setStats(prev => ({
          ...prev,
          hotLeads: leads.length,
          kbChunkCount: ins.summary?.kbChunkCount || 0,
        }))
      }
    } catch (error) {
      console.error('Dashboard fetch error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Guten Morgen'
    if (h < 18) return 'Guten Tag'
    return 'Guten Abend'
  })()

  const totalOpen = stats.pendingEmails + stats.draftReadyEmails

  return (
    <div className="space-y-6">
      <Header
        title={`${greeting}, Philipp`}
        description="Hier ist dein heutiger Stand auf einen Blick."
      />

      {/* Refresh */}
      <div className="flex justify-end -mt-4">
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Today's Status Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'Offen',
            value: totalOpen,
            sub: `${stats.draftReadyEmails} mit Draft`,
            icon: Inbox,
            color: totalOpen > 0 ? 'text-blue-600' : 'text-green-600',
            bg: totalOpen > 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-green-50 dark:bg-green-900/20',
            href: '/inbox',
          },
          {
            label: 'Kein Draft',
            value: stats.urgentEmails,
            sub: 'brauchen AI',
            icon: Sparkles,
            color: stats.urgentEmails > 0 ? 'text-amber-600' : 'text-slate-400',
            bg: stats.urgentEmails > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800/30',
            href: '/inbox',
          },
          {
            label: 'Hot Leads',
            value: stats.hotLeads,
            sub: 'Kaufabsicht ≥60%',
            icon: TrendingUp,
            color: stats.hotLeads > 0 ? 'text-emerald-600' : 'text-slate-400',
            bg: stats.hotLeads > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-50 dark:bg-slate-800/30',
            href: '/insights',
          },
          {
            label: 'Heute gesendet',
            value: stats.sentToday,
            sub: 'bereits beantwortet',
            icon: CheckCircle2,
            color: 'text-green-600',
            bg: 'bg-green-50 dark:bg-green-900/20',
            href: '/inbox',
          },
          {
            label: 'KB Einträge',
            value: stats.kbChunkCount,
            sub: 'Wissens-Chunks',
            icon: BookOpen,
            color: 'text-purple-600',
            bg: 'bg-purple-50 dark:bg-purple-900/20',
            href: '/knowledge',
          },
        ].map(item => (
          <Link key={item.label} href={item.href}>
            <div className={`p-4 rounded-xl border border-transparent ${item.bg} hover:border-slate-200 dark:hover:border-slate-700 transition-all cursor-pointer`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">{item.label}</p>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <p className={`text-2xl font-bold ${item.color}`}>
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : item.value}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{item.sub}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Workload Overview */}
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
              {/* Left: Noch Offen */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Noch offen</h3>
                </div>

                {/* Absolute values */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Heute', value: workload.open.today, color: workload.open.today > 5 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200' },
                    { label: 'Diese Woche', value: workload.open.week, color: workload.open.week > 20 ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200' },
                    { label: 'Dieser Monat', value: workload.open.month, color: 'text-slate-700 dark:text-slate-200' },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                      <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                      <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Averages */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Durchschnitt (30 Tage)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Ø Tag', value: workload.avg.dayOpen },
                      { label: 'Ø Woche', value: workload.avg.weekOpen },
                      { label: 'Ø Monat', value: workload.avg.monthOpen },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                        <span className="text-xs text-slate-500">{item.label}</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trend */}
                <div className={`flex items-center gap-2 p-2.5 rounded-lg ${
                  workload.trend.openVsLastWeek > 0 ? 'bg-red-50 dark:bg-red-900/10' :
                  workload.trend.openVsLastWeek < 0 ? 'bg-green-50 dark:bg-green-900/10' :
                  'bg-slate-50 dark:bg-slate-800/30'
                }`}>
                  {workload.trend.openVsLastWeek > 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-red-500" />
                  ) : workload.trend.openVsLastWeek < 0 ? (
                    <ArrowDownRight className="h-4 w-4 text-green-500" />
                  ) : (
                    <Minus className="h-4 w-4 text-slate-400" />
                  )}
                  <span className={`text-sm font-medium ${
                    workload.trend.openVsLastWeek > 0 ? 'text-red-600' :
                    workload.trend.openVsLastWeek < 0 ? 'text-green-600' :
                    'text-slate-500'
                  }`}>
                    {workload.trend.openVsLastWeek > 0 ? '+' : ''}{workload.trend.openVsLastWeek}% vs. letzte Woche
                  </span>
                </div>
              </div>

              {/* Right: Erledigt */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MailCheck className="h-4 w-4 text-green-500" />
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Erledigt</h3>
                </div>

                {/* Absolute values */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Heute', value: workload.done.today },
                    { label: 'Diese Woche', value: workload.done.week },
                    { label: 'Dieser Monat', value: workload.done.month },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-lg bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20">
                      <p className="text-xs text-slate-500 mb-1">{item.label}</p>
                      <p className="text-xl font-bold text-green-700 dark:text-green-400">{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Averages */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Durchschnitt (30 Tage)</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Ø Tag', value: workload.avg.dayDone },
                      { label: 'Ø Woche', value: workload.avg.weekDone },
                      { label: 'Ø Monat', value: workload.avg.monthDone },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800/50">
                        <span className="text-xs text-slate-500">{item.label}</span>
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trend */}
                <div className={`flex items-center gap-2 p-2.5 rounded-lg ${
                  workload.trend.doneVsLastWeek > 0 ? 'bg-green-50 dark:bg-green-900/10' :
                  workload.trend.doneVsLastWeek < 0 ? 'bg-red-50 dark:bg-red-900/10' :
                  'bg-slate-50 dark:bg-slate-800/30'
                }`}>
                  {workload.trend.doneVsLastWeek > 0 ? (
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                  ) : workload.trend.doneVsLastWeek < 0 ? (
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                  ) : (
                    <Minus className="h-4 w-4 text-slate-400" />
                  )}
                  <span className={`text-sm font-medium ${
                    workload.trend.doneVsLastWeek > 0 ? 'text-green-600' :
                    workload.trend.doneVsLastWeek < 0 ? 'text-red-600' :
                    'text-slate-500'
                  }`}>
                    {workload.trend.doneVsLastWeek > 0 ? '+' : ''}{workload.trend.doneVsLastWeek}% vs. letzte Woche
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SLA Tagesziel */}
      {!isLoading && (slaStats.totalTarget > 0 || slaStats.overdue.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                SLA Tagesziel
              </span>
              <span className="text-sm font-normal text-slate-500">
                {slaStats.doneToday} von {slaStats.totalTarget} erledigt
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-2">
              <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    slaStats.overdue.length > 0 ? 'bg-gradient-to-r from-green-500 to-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${slaStats.totalTarget > 0 ? Math.round((slaStats.doneToday / slaStats.totalTarget) * 100) : 0}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {slaStats.totalTarget > 0 ? Math.round((slaStats.doneToday / slaStats.totalTarget) * 100) : 0}% erreicht
                </span>
                {slaStats.later > 0 && (
                  <span className="text-slate-400">+ {slaStats.later} morgen/später</span>
                )}
              </div>
            </div>

            {/* Status counters */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20">
                <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">{slaStats.doneToday}</p>
                  <p className="text-xs text-green-600 dark:text-green-500">erledigt</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 p-2.5 rounded-lg ${slaStats.dueNow.length > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-slate-50 dark:bg-slate-800/30'}`}>
                <Timer className={`h-4 w-4 flex-shrink-0 ${slaStats.dueNow.length > 0 ? 'text-amber-600' : 'text-slate-400'}`} />
                <div>
                  <p className={`text-lg font-bold ${slaStats.dueNow.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'}`}>{slaStats.dueNow.length}</p>
                  <p className={`text-xs ${slaStats.dueNow.length > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-slate-400'}`}>fällig heute</p>
                </div>
              </div>
              <div className={`flex items-center gap-2 p-2.5 rounded-lg ${slaStats.overdue.length > 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-800/30'}`}>
                <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${slaStats.overdue.length > 0 ? 'text-red-600 animate-pulse' : 'text-slate-400'}`} />
                <div>
                  <p className={`text-lg font-bold ${slaStats.overdue.length > 0 ? 'text-red-700 dark:text-red-400' : 'text-slate-400'}`}>{slaStats.overdue.length}</p>
                  <p className={`text-xs ${slaStats.overdue.length > 0 ? 'text-red-600 dark:text-red-500' : 'text-slate-400'}`}>überfällig</p>
                </div>
              </div>
            </div>

            {/* Overdue + due soon list */}
            {(slaStats.overdue.length > 0 || slaStats.dueNow.length > 0) && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {slaStats.overdue.length > 0 ? 'Dringend beantworten' : 'Als nächstes fällig'}
                </p>
                {[...slaStats.overdue, ...slaStats.dueNow].slice(0, 4).map(email => (
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
                {(slaStats.overdue.length + slaStats.dueNow.length) > 4 && (
                  <Link href="/inbox">
                    <p className="text-xs text-slate-500 text-center pt-1 hover:text-blue-500 transition-colors">
                      + {slaStats.overdue.length + slaStats.dueNow.length - 4} weitere fällig →
                    </p>
                  </Link>
                )}
              </div>
            )}

            {/* All clear state */}
            {slaStats.overdue.length === 0 && slaStats.dueNow.length === 0 && slaStats.doneToday > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <Shield className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">Alle SLA-Ziele eingehalten</p>
                  <p className="text-xs text-green-600 dark:text-green-500">{slaStats.doneToday} E-Mails heute beantwortet — keine Deadline offen.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Heute erledigen */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Heute erledigen
              </span>
              {totalOpen > 0 && (
                <Link href="/inbox">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs">
                    Alle {totalOpen} <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : urgentEmails.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-400 mb-2" />
                <p className="text-slate-500 dark:text-slate-400 font-medium">Alles erledigt!</p>
                <p className="text-sm text-slate-400 mt-1">Keine offenen Mails ohne Draft.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {urgentEmails.map(email => (
                  <Link key={email.id} href="/inbox">
                    <div className={`flex items-center gap-3 p-3 rounded-lg border-l-4 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer ${getPriorityColor(email)}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{email.subject}</p>
                        <p className="text-xs text-slate-500 truncate">{email.from_name || email.from_email}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(email.buying_intent_score ?? 0) >= 40 && (
                          <Badge className="bg-emerald-500 text-xs px-1.5 py-0.5">
                            {email.buying_intent_score}%
                          </Badge>
                        )}
                        <span className="text-xs text-slate-400">{formatTimeAgo(email.received_at)}</span>
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      </div>
                    </div>
                  </Link>
                ))}
                {stats.pendingEmails > urgentEmails.length && (
                  <Link href="/inbox">
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center pt-1 hover:text-blue-500 transition-colors">
                      + {stats.pendingEmails - urgentEmails.length} weitere offen →
                    </p>
                  </Link>
                )}
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
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : hotLeads.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-slate-500 dark:text-slate-400">Keine Hot Leads aktuell</p>
                <p className="text-sm text-slate-400 mt-1">Anfragen mit Kaufabsicht ≥60% erscheinen hier.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {hotLeads.map(lead => (
                  <Link key={lead.id} href="/inbox">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{lead.from_name || lead.from_email}</p>
                        <p className="text-xs text-slate-500 truncate">{lead.subject}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right">
                          <div className="flex items-center gap-1">
                            <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full"
                                style={{ width: `${lead.buying_intent_score || 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 w-7">
                              {lead.buying_intent_score}%
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">{formatTimeAgo(lead.received_at)}</p>
                        </div>
                        {lead.status !== 'sent' && (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team Performance KPIs */}
      {!isLoading && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-500" />
            Team Performance
            <span className="text-xs font-normal text-slate-400">(letzte 30 Tage)</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* Avg Response Time */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Ø Antwortzeit</p>
                    <p className="text-xl font-bold text-slate-800 dark:text-slate-200">
                      {avgResponseHours !== null ? (
                        avgResponseHours < 1 ? `${Math.round(avgResponseHours * 60)}min` : `${avgResponseHours}h`
                      ) : '—'}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">
                  {avgResponseHours !== null
                    ? avgResponseHours <= 4 ? 'Gut — unter 4h Ziel' : avgResponseHours <= 24 ? 'Im SLA-Rahmen' : 'Über SLA-Ziel'
                    : 'Noch keine Daten'
                  }
                </p>
              </CardContent>
            </Card>

            {/* Sentiment Overview */}
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
                        { label: 'Positiv', value: sentimentDist.positive || 0, color: 'bg-green-500', icon: SmilePlus },
                        { label: 'Neutral', value: sentimentDist.neutral || 0, color: 'bg-slate-400', icon: Meh },
                        { label: 'Negativ', value: (sentimentDist.negative || 0) + (sentimentDist.frustrated || 0), color: 'bg-red-400', icon: Frown },
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

            {/* Draft Acceptance Rate */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                    <FileCheck className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-xs text-slate-500">Draft Akzeptanz</p>
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
                        <span className="text-red-500">{d.rejected} abgelehnt</span>
                      </div>
                      <p className="text-xs text-slate-400">Ø Konfidenz: {Math.round(d.avg_confidence * 100)}%</p>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Priority Distribution */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                    <Zap className="h-4 w-4 text-orange-600" />
                  </div>
                  <p className="text-xs text-slate-500">Prioritätsverteilung</p>
                </div>
                {(() => {
                  const total = Object.values(priorityDist).reduce((a, b) => a + b, 0)
                  if (total === 0) return <p className="text-xs text-slate-400">Noch keine Daten</p>
                  return (
                    <div className="space-y-1.5">
                      {[
                        { key: 'critical', label: 'Kritisch', color: 'bg-red-500' },
                        { key: 'high', label: 'Hoch', color: 'bg-orange-500' },
                        { key: 'normal', label: 'Normal', color: 'bg-blue-500' },
                        { key: 'low', label: 'Niedrig', color: 'bg-slate-400' },
                      ].filter(p => (priorityDist[p.key] || 0) > 0).map(p => (
                        <div key={p.key} className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 w-14">{p.label}</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${p.color}`} style={{ width: `${Math.round(((priorityDist[p.key] || 0) / total) * 100)}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-6 text-right">{priorityDist[p.key] || 0}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Urgency Distribution */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="text-xs text-slate-500">Dringlichkeit</p>
                </div>
                {(() => {
                  const total = Object.values(urgencyDist).reduce((a, b) => a + b, 0)
                  if (total === 0) return <p className="text-xs text-slate-400">Noch keine Daten</p>
                  return (
                    <div className="space-y-1.5">
                      {[
                        { key: 'high', label: 'Hoch', color: 'bg-red-500' },
                        { key: 'medium', label: 'Mittel', color: 'bg-amber-500' },
                        { key: 'low', label: 'Niedrig', color: 'bg-green-500' },
                      ].filter(u => (urgencyDist[u.key] || 0) > 0).map(u => (
                        <div key={u.key} className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 w-14">{u.label}</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${u.color}`} style={{ width: `${Math.round(((urgencyDist[u.key] || 0) / total) * 100)}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 w-6 text-right">{urgencyDist[u.key] || 0}</span>
                        </div>
                      ))}
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
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-200 dark:bg-blue-800" />Eingegangen</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Beantwortet</span>
                      </div>
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

          </div>
        </div>
      )}
    </div>
  )
}
