'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'

interface BriefingData {
  pendingEmails: number
  draftReadyEmails: number
  sentToday: number
  sentYesterday: number
  highPriorityCount: number
  avgConfidence: number
  oldestPendingHours: number | null
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Guten Morgen'
  if (hour < 17) return 'Guten Tag'
  return 'Guten Abend'
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('de-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function getTrendIcon(current: number, previous: number) {
  if (current > previous) return <TrendingUp className="h-4 w-4 text-green-500" />
  if (current < previous) return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-slate-400" />
}

export function DashboardBriefing() {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<BriefingData>({
    pendingEmails: 0,
    draftReadyEmails: 0,
    sentToday: 0,
    sentYesterday: 0,
    highPriorityCount: 0,
    avgConfidence: 0,
    oldestPendingHours: null,
  })

  useEffect(() => {
    const fetchBriefingData = async () => {
      setIsLoading(true)
      try {
        const response = await fetch('/api/emails?limit=100')
        if (response.ok) {
          const result = await response.json()
          const emails = result.emails || []

          const now = new Date()
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

          // Calculate metrics
          const pending = emails.filter((e: { status: string }) => e.status === 'pending')
          const draftReady = emails.filter((e: { status: string }) => e.status === 'draft_ready')

          const sentToday = emails.filter((e: { status: string; updated_at?: string }) => {
            if (e.status !== 'sent') return false
            const sentDate = new Date(e.updated_at || '')
            return sentDate >= todayStart
          })

          const sentYesterday = emails.filter((e: { status: string; updated_at?: string }) => {
            if (e.status !== 'sent') return false
            const sentDate = new Date(e.updated_at || '')
            return sentDate >= yesterdayStart && sentDate < todayStart
          })

          // High priority = low confidence drafts
          const highPriority = emails.filter((e: { status: string; email_drafts?: Array<{ confidence_score: number }> }) => {
            const confidence = e.email_drafts?.[0]?.confidence_score || 0
            return (e.status === 'pending' || e.status === 'draft_ready') && confidence < 70
          })

          // Average confidence
          const emailsWithDrafts = emails.filter(
            (e: { email_drafts?: Array<{ confidence_score: number }> }) => e.email_drafts?.[0]?.confidence_score
          )
          const avgConf = emailsWithDrafts.length > 0
            ? emailsWithDrafts.reduce(
                (sum: number, e: { email_drafts?: Array<{ confidence_score: number }> }) =>
                  sum + (e.email_drafts?.[0]?.confidence_score || 0),
                0
              ) / emailsWithDrafts.length
            : 0

          // Oldest pending email
          let oldestHours: number | null = null
          if (pending.length > 0) {
            const oldestEmail = pending.reduce(
              (oldest: { received_at: string }, current: { received_at: string }) =>
                new Date(current.received_at) < new Date(oldest.received_at) ? current : oldest
            )
            const hoursOld = (now.getTime() - new Date(oldestEmail.received_at).getTime()) / (1000 * 60 * 60)
            oldestHours = Math.round(hoursOld)
          }

          setData({
            pendingEmails: pending.length,
            draftReadyEmails: draftReady.length,
            sentToday: sentToday.length,
            sentYesterday: sentYesterday.length,
            highPriorityCount: highPriority.length,
            avgConfidence: Math.round(avgConf),
            oldestPendingHours: oldestHours,
          })
        }
      } catch (error) {
        console.error('Failed to fetch briefing data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBriefingData()
  }, [])

  const getBriefingSummary = () => {
    const parts: string[] = []

    if (data.pendingEmails === 0 && data.draftReadyEmails === 0) {
      return 'Alles erledigt! Keine offenen E-Mails warten auf dich.'
    }

    if (data.draftReadyEmails > 0) {
      parts.push(`${data.draftReadyEmails} E-Mail${data.draftReadyEmails > 1 ? 's' : ''} mit Draft bereit zum Review`)
    }

    if (data.pendingEmails > 0) {
      parts.push(`${data.pendingEmails} ausstehend`)
    }

    if (data.highPriorityCount > 0) {
      parts.push(`${data.highPriorityCount} benötigen besondere Aufmerksamkeit`)
    }

    return parts.join(' - ')
  }

  const getStatusIndicator = () => {
    if (data.highPriorityCount > 0) {
      return {
        icon: AlertCircle,
        color: 'text-amber-500',
        bgColor: 'bg-amber-50 dark:bg-amber-900/20',
        borderColor: 'border-amber-200 dark:border-amber-800',
      }
    }
    if (data.pendingEmails === 0 && data.draftReadyEmails === 0) {
      return {
        icon: CheckCircle2,
        color: 'text-green-500',
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-green-200 dark:border-green-800',
      }
    }
    return {
      icon: Sparkles,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
    }
  }

  const status = getStatusIndicator()
  const StatusIcon = status.icon

  if (isLoading) {
    return (
      <Card className={`${status.bgColor} border ${status.borderColor}`}>
        <CardContent className="p-5">
          <div className="animate-pulse flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
              <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={`${status.bgColor} border ${status.borderColor}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-full ${status.bgColor}`}>
            <StatusIcon className={`h-5 w-5 ${status.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
              <span>{getGreeting()}</span>
              <span>-</span>
              <span>{formatTodayDate()}</span>
            </div>
            <p className="text-base font-medium text-slate-900 dark:text-white">
              {getBriefingSummary()}
            </p>

            {/* Quick Stats Row */}
            {(data.pendingEmails > 0 || data.draftReadyEmails > 0) && (
              <div className="flex flex-wrap gap-4 mt-3 text-sm">
                {data.sentToday > 0 && (
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    {getTrendIcon(data.sentToday, data.sentYesterday)}
                    <span>{data.sentToday} heute gesendet</span>
                  </div>
                )}
                {data.avgConfidence > 0 && (
                  <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <span>{data.avgConfidence}% AI Confidence</span>
                  </div>
                )}
                {data.oldestPendingHours !== null && data.oldestPendingHours > 24 && (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Clock className="h-4 w-4" />
                    <span>Älteste seit {data.oldestPendingHours}h</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
