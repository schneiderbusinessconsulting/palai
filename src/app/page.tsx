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
} from 'lucide-react'
import Link from 'next/link'

interface Email {
  id: string
  from_email: string
  from_name?: string
  subject: string
  received_at: string
  status: string
  email_type?: string
  needs_response?: boolean
  buying_intent_score?: number
  email_drafts?: Array<{ confidence_score: number }>
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

function getPriorityColor(email: Email) {
  if ((email.buying_intent_score ?? 0) >= 60) return 'border-l-emerald-500'
  if (email.email_drafts?.[0]?.confidence_score === 0 || !email.email_drafts?.length) return 'border-l-amber-400'
  return 'border-l-blue-400'
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [urgentEmails, setUrgentEmails] = useState<Email[]>([])
  const [hotLeads, setHotLeads] = useState<HotLead[]>([])
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
      const [emailRes, insightsRes] = await Promise.all([
        fetch('/api/emails?limit=200'),
        fetch('/api/insights'),
      ])

      if (emailRes.ok) {
        const data = await emailRes.json()
        const all: Email[] = data.emails || []

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

        setUrgentEmails(noDraft)
        setStats(prev => ({ ...prev, pendingEmails: pending, draftReadyEmails: draftReady, urgentEmails: noDraft.length, sentToday }))
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
    </div>
  )
}
