'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  ArrowLeft,
  Mail,
  Clock,
  CheckCircle2,
  Star,
  AlertTriangle,
  RefreshCw,
  Users,
  TrendingUp,
  UserCheck,
} from 'lucide-react'

interface AgentDetail {
  agent: {
    id: string
    name: string
    email: string
    role: string
    specializations: string[]
    is_active: boolean
    max_open_tickets: number
  }
  period: { start: string; end: string; label: string }
  stats: {
    emails_assigned: number
    emails_resolved: number
    resolution_rate: number
    avg_response_minutes: number | null
    avg_response_formatted: string
    csat_avg: number | null
    escalations_given: number
    open_queue_count: number
  }
  openQueue: {
    id: string
    from_email: string
    from_name: string | null
    subject: string
    received_at: string
    sla_status: string | null
    topic_cluster: string | null
  }[]
  escalationTopics: { topic: string | null; count: number }[]
  csatVerbatim: {
    rating: number
    comment: string | null
    subject: string
    from_name: string
    created_at: string
  }[]
  weeklyTrend: { week: string; emails: number; resolution_rate: number }[]
}

interface AgentOption {
  id: string
  name: string
  email: string
}

function getResolutionColor(rate: number): string {
  if (rate >= 80) return 'text-green-700 dark:text-green-400'
  if (rate >= 50) return 'text-amber-700 dark:text-amber-400'
  return 'text-red-700 dark:text-red-400'
}

function getResolutionBg(rate: number): string {
  if (rate >= 80) return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
  if (rate >= 50) return 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
  return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
}

function getFrtColor(minutes: number | null): string {
  if (minutes === null) return 'text-slate-500'
  if (minutes <= 60) return 'text-green-700 dark:text-green-400'
  if (minutes <= 240) return 'text-amber-700 dark:text-amber-400'
  return 'text-red-700 dark:text-red-400'
}

function getCsatColor(score: number | null): string {
  if (score === null) return 'text-slate-500'
  if (score >= 4.0) return 'text-green-700 dark:text-green-400'
  if (score >= 3.0) return 'text-amber-700 dark:text-amber-400'
  return 'text-red-700 dark:text-red-400'
}

function getRoleBadgeStyle(role: string): string {
  switch (role) {
    case 'L1': return 'bg-gold-100 text-gold-700 dark:bg-gold-900/30 dark:text-gold-400'
    case 'L2': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'L3': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  }
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)
  if (diffMin < 1) return 'gerade eben'
  if (diffMin < 60) return `vor ${diffMin}min`
  if (diffH < 24) return `vor ${diffH}h`
  if (diffD === 1) return 'gestern'
  return `vor ${diffD} Tagen`
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400 text-sm">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i}>{i < rating ? '★' : '☆'}</span>
      ))}
    </span>
  )
}

export default function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [data, setData] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('30d')
  const [allAgents, setAllAgents] = useState<AgentOption[]>([])
  const [reassigning, setReassigning] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [openReassignId, setOpenReassignId] = useState<string | null>(null)

  const fetchData = useCallback(async (selectedPeriod: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${id}?period=${selectedPeriod}`)
      if (res.status === 404) {
        setError('Agent nicht gefunden.')
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: AgentDetail = await res.json()
      setData(json)
    } catch {
      setError('Daten konnten nicht geladen werden.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchData(period)
  }, [fetchData, period])

  // Load agent list for reassign dropdown
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/agents/performance?period=7d')
        if (res.ok) {
          const json = await res.json()
          setAllAgents((json.agents || []).map((a: { id: string; name: string; email: string }) => ({
            id: a.id,
            name: a.name,
            email: a.email,
          })))
        }
      } catch { /* ignore */ }
    }
    load()
  }, [])

  const handleReassign = async (emailId: string, targetAgentId: string, targetName: string) => {
    if (!data) return
    setReassigning(emailId)
    setOpenReassignId(null)
    try {
      const res = await fetch(`/api/emails/${emailId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: targetAgentId }),
      })
      if (res.ok) {
        // Optimistic: remove from queue
        setData(prev => prev ? {
          ...prev,
          openQueue: prev.openQueue.filter(e => e.id !== emailId),
          stats: { ...prev.stats, open_queue_count: prev.stats.open_queue_count - 1 },
        } : prev)
        setToast(`Zugewiesen an ${targetName}`)
        setTimeout(() => setToast(null), 3000)
      }
    } catch { /* ignore */ } finally {
      setReassigning(null)
    }
  }

  const agentInitials = data?.agent.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  const maxEscalationCount = data?.escalationTopics[0]?.count || 1
  const maxTrendRate = Math.max(...(data?.weeklyTrend.map(w => w.resolution_rate) || [100]), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/agents')}
          className="mt-1 flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Team
        </Button>
        {data && (
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
              <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">{agentInitials}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{data.agent.name}</h1>
                <Badge className={`text-xs px-2 py-0.5 ${getRoleBadgeStyle(data.agent.role)}`}>
                  {data.agent.role}
                </Badge>
                {data.agent.is_active ? (
                  <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                    Aktiv
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">Inaktiv</span>
                )}
              </div>
              <p className="text-sm text-slate-500 truncate">{data.agent.email}</p>
              {data.agent.specializations?.length > 0 && (
                <p className="text-xs text-slate-400 mt-0.5">{data.agent.specializations.join(', ')}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      {!loading && data && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            {[
              { value: '7d', label: '7 Tage' },
              { value: '30d', label: '30 Tage' },
              { value: '90d', label: '90 Tage' },
            ].map(p => (
              <Button
                key={p.value}
                variant={period === p.value ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setPeriod(p.value)}
                className={period === p.value ? '' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchData(period)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gold-500" />
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg bg-green-600 text-white text-sm font-medium shadow-lg">
          <UserCheck className="h-4 w-4" />
          {toast}
        </div>
      )}

      {!loading && data && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-5 rounded-xl border-2 border-gold-200 bg-gold-50 dark:bg-gold-900/20 dark:border-gold-800">
              <Mail className="h-5 w-5 text-gold-600 mb-2" />
              <p className="text-3xl font-bold text-gold-700 dark:text-gold-400">{data.stats.emails_assigned}</p>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Zugewiesen</p>
              <p className="text-xs text-slate-400 mt-0.5">{data.stats.emails_resolved} gelöst</p>
            </div>

            <div className={`p-5 rounded-xl border-2 transition-all ${getResolutionBg(data.stats.resolution_rate)}`}>
              <CheckCircle2 className={`h-5 w-5 mb-2 ${getResolutionColor(data.stats.resolution_rate)}`} />
              <p className={`text-3xl font-bold ${getResolutionColor(data.stats.resolution_rate)}`}>
                {data.stats.resolution_rate}%
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Lösungsrate</p>
            </div>

            <div className="p-5 rounded-xl border-2 border-slate-200 bg-slate-50 dark:bg-slate-800/30 dark:border-slate-700">
              <Clock className={`h-5 w-5 mb-2 ${getFrtColor(data.stats.avg_response_minutes)}`} />
              <p className={`text-3xl font-bold ${getFrtColor(data.stats.avg_response_minutes)}`}>
                {data.stats.avg_response_formatted}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Ø Erstantwort</p>
            </div>

            <div className="p-5 rounded-xl border-2 border-slate-200 bg-slate-50 dark:bg-slate-800/30 dark:border-slate-700">
              <Star className={`h-5 w-5 mb-2 ${getCsatColor(data.stats.csat_avg)}`} />
              <p className={`text-3xl font-bold ${data.stats.csat_avg !== null ? getCsatColor(data.stats.csat_avg) : 'text-slate-800 dark:text-slate-200'}`}>
                {data.stats.csat_avg !== null ? data.stats.csat_avg.toFixed(1) : '--'}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">CSAT</p>
            </div>
          </div>

          {/* Queue + CSAT Verbatim */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Open Queue */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Mail className="h-4 w-4 text-amber-500" />
                  Offene Queue
                  <span className="ml-auto text-sm font-normal text-slate-500">{data.stats.open_queue_count} offen</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.openQueue.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-8 w-8 mx-auto text-green-400 mb-2" />
                    <p className="text-sm font-medium text-slate-500">Queue ist sauber</p>
                    <p className="text-xs text-slate-400 mt-1">Keine offenen E-Mails</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {data.openQueue.map(email => (
                      <div
                        key={email.id}
                        className="group flex items-start justify-between gap-2 p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {email.sla_status === 'breached' && (
                              <span title="SLA verletzt">
                              <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                            </span>
                            )}
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                              {email.from_name || email.from_email}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{email.subject}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-400">{formatRelativeDate(email.received_at)}</span>
                            {email.topic_cluster && (
                              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                                {email.topic_cluster}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Reassign */}
                        <div className="relative flex-shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            disabled={reassigning === email.id}
                            onClick={() => setOpenReassignId(openReassignId === email.id ? null : email.id)}
                          >
                            {reassigning === email.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Reassign'
                            )}
                          </Button>
                          {openReassignId === email.id && (
                            <div className="absolute right-0 top-8 z-20 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1">
                              {allAgents
                                .filter(a => a.id !== data.agent.id)
                                .map(a => (
                                  <button
                                    key={a.id}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors truncate"
                                    onClick={() => handleReassign(email.id, a.id, a.name)}
                                  >
                                    {a.name}
                                  </button>
                                ))}
                              {allAgents.filter(a => a.id !== data.agent.id).length === 0 && (
                                <p className="px-3 py-2 text-xs text-slate-400">Keine anderen Agents</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CSAT Verbatim */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="h-4 w-4 text-amber-400" />
                  CSAT Verbatim
                  <span className="ml-auto text-sm font-normal text-slate-500">
                    {data.stats.csat_avg !== null ? `Ø ${data.stats.csat_avg.toFixed(1)}` : '--'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.csatVerbatim.length === 0 ? (
                  <div className="text-center py-8">
                    <Star className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm font-medium text-slate-500">Noch keine Bewertungen</p>
                    <p className="text-xs text-slate-400 mt-1">im gewählten Zeitraum</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.csatVerbatim.map((c, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                        <div className="flex items-center justify-between mb-1">
                          <StarRating rating={c.rating} />
                          <span className="text-xs text-slate-400">{formatRelativeDate(c.created_at)}</span>
                        </div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{c.from_name}</p>
                        <p className="text-xs text-slate-500 truncate">{c.subject}</p>
                        {c.comment && (
                          <p className="text-xs text-slate-400 italic mt-1.5 line-clamp-2">&ldquo;{c.comment}&rdquo;</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Escalation Topics + Weekly Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Escalation Topics */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  Eskalierte Themen
                  <span className="ml-auto text-sm font-normal text-slate-500">
                    {data.stats.escalations_given} gesamt
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.escalationTopics.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm font-medium text-slate-500">Keine Eskalationen</p>
                    <p className="text-xs text-slate-400 mt-1">im gewählten Zeitraum</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {data.escalationTopics.map((t, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-700 dark:text-slate-300 truncate">
                            {t.topic || 'Sonstiges'}
                          </span>
                          <span className="text-xs font-medium text-slate-500 ml-2 flex-shrink-0">{t.count}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded-full transition-all"
                            style={{ width: `${(t.count / maxEscalationCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Weekly Trend */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-indigo-500" />
                  Wochen-Trend
                  <span className="ml-auto text-sm font-normal text-slate-500">Lösungsrate</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.weeklyTrend.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="h-8 w-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-sm font-medium text-slate-500">Keine Daten</p>
                  </div>
                ) : (
                  <div className="flex items-end gap-3 h-32">
                    {data.weeklyTrend.map((w, i) => {
                      const heightPct = maxTrendRate > 0 ? (w.resolution_rate / maxTrendRate) * 100 : 0
                      const barColor = w.resolution_rate >= 80
                        ? 'bg-green-400'
                        : w.resolution_rate >= 50
                          ? 'bg-amber-400'
                          : 'bg-red-400'
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {w.resolution_rate}%
                          </span>
                          <div className="w-full flex items-end" style={{ height: '80px' }}>
                            <div
                              className={`w-full rounded-t ${barColor} transition-all`}
                              style={{ height: `${Math.max(heightPct, 4)}%` }}
                              title={`${w.week}: ${w.emails} Mails, ${w.resolution_rate}% gelöst`}
                            />
                          </div>
                          <span className="text-xs text-slate-400">{w.week}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
