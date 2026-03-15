'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  RefreshCw,
  Users,
  Mail,
  Clock,
  CheckCircle2,
  Star,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'

interface AgentData {
  id: string
  name: string
  email: string
  role: string
  emails_assigned: number
  emails_resolved: number
  resolution_rate: number
  avg_response_minutes: number | null
  escalations_from: number
  escalations_to: number
  csat_avg: number | null
}

interface TeamTotals {
  total_agents: number
  total_emails_assigned: number
  total_emails_resolved: number
  team_resolution_rate: number
  team_avg_response_minutes: number | null
  team_csat_avg: number | null
}

interface PerformanceData {
  period: { start: string; end: string; period: string }
  team: TeamTotals
  agents: AgentData[]
}

type SortKey = 'name' | 'emails_assigned' | 'resolution_rate' | 'avg_response_minutes' | 'csat_avg'

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '--'
  if (minutes < 60) return `${Math.round(minutes)}min`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}min`
}

function getResolutionColor(rate: number): string {
  if (rate >= 80) return 'text-green-700 dark:text-green-400'
  if (rate >= 50) return 'text-amber-700 dark:text-amber-400'
  return 'text-red-700 dark:text-red-400'
}

function getResolutionBg(rate: number): string {
  if (rate >= 80) return 'bg-green-50 dark:bg-green-900/20'
  if (rate >= 50) return 'bg-amber-50 dark:bg-amber-900/20'
  return 'bg-red-50 dark:bg-red-900/20'
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
    case 'L1': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    case 'L2': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    case 'L3': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
  }
}

export default function AgentsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [data, setData] = useState<PerformanceData | null>(null)
  const [period, setPeriod] = useState<string>('30d')
  const [sortKey, setSortKey] = useState<SortKey>('emails_assigned')
  const [sortAsc, setSortAsc] = useState(false)

  const fetchData = useCallback(async (selectedPeriod: string) => {
    setIsLoading(true)
    setFetchError(null)
    try {
      const res = await fetch(`/api/agents/performance?period=${selectedPeriod}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: PerformanceData = await res.json()
      setData(json)
    } catch (error) {
      console.error('Agent performance fetch error:', error)
      setFetchError('Daten konnten nicht geladen werden. Bitte erneut versuchen.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(period)
  }, [fetchData, period])

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  const sortedAgents = data?.agents ? [...data.agents].sort((a, b) => {
    let aVal: number | string
    let bVal: number | string

    switch (sortKey) {
      case 'name':
        aVal = a.name.toLowerCase()
        bVal = b.name.toLowerCase()
        break
      case 'avg_response_minutes':
        aVal = a.avg_response_minutes ?? 999999
        bVal = b.avg_response_minutes ?? 999999
        break
      case 'csat_avg':
        aVal = a.csat_avg ?? -1
        bVal = b.csat_avg ?? -1
        break
      default:
        aVal = a[sortKey]
        bVal = b[sortKey]
    }

    if (aVal < bVal) return sortAsc ? -1 : 1
    if (aVal > bVal) return sortAsc ? 1 : -1
    return 0
  }) : []

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 text-slate-400" />
    return sortAsc
      ? <ArrowUp className="h-3 w-3 text-blue-500" />
      : <ArrowDown className="h-3 w-3 text-blue-500" />
  }

  return (
    <div className="space-y-6">
      <Header
        title="Team Performance"
        description="Agent-Leistung und Auslastung"
      />

      {/* Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          {['7d', '30d', '90d'].map(p => (
            <Button
              key={p}
              variant={period === p ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handlePeriodChange(p)}
              className={period === p ? '' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}
            >
              {p}
            </Button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(period)} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Error Banner */}
      {fetchError && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {fetchError}
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchData(period)} className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Erneut laden
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}

      {/* Team Summary Cards */}
      {!isLoading && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Total Emails */}
            <div className="p-5 rounded-xl border-2 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                {data.team.total_emails_assigned}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">E-Mails gesamt</p>
            </div>

            {/* Team Avg FRT */}
            <div className={`p-5 rounded-xl border-2 transition-all ${
              data.team.team_avg_response_minutes !== null && data.team.team_avg_response_minutes > 240
                ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
                : data.team.team_avg_response_minutes !== null && data.team.team_avg_response_minutes > 60
                  ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800'
                  : 'border-slate-200 bg-slate-50 dark:bg-slate-800/30 dark:border-slate-700'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <Clock className={`h-5 w-5 ${getFrtColor(data.team.team_avg_response_minutes)}`} />
              </div>
              <p className="text-3xl font-bold text-slate-800 dark:text-slate-200">
                {formatMinutes(data.team.team_avg_response_minutes)}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Team Ø FRT</p>
            </div>

            {/* Team Resolution Rate */}
            <div className={`p-5 rounded-xl border-2 transition-all ${
              data.team.team_resolution_rate >= 80
                ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                : data.team.team_resolution_rate >= 50
                  ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800'
                  : 'border-slate-200 bg-slate-50 dark:bg-slate-800/30 dark:border-slate-700'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <CheckCircle2 className={`h-5 w-5 ${getResolutionColor(data.team.team_resolution_rate)}`} />
              </div>
              <p className={`text-3xl font-bold ${getResolutionColor(data.team.team_resolution_rate)}`}>
                {data.team.team_resolution_rate}%
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Resolution Rate</p>
            </div>

            {/* Team CSAT */}
            <div className={`p-5 rounded-xl border-2 transition-all ${
              data.team.team_csat_avg !== null && data.team.team_csat_avg >= 4.0
                ? 'border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800'
                : data.team.team_csat_avg !== null && data.team.team_csat_avg >= 3.0
                  ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800'
                  : 'border-slate-200 bg-slate-50 dark:bg-slate-800/30 dark:border-slate-700'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <Star className={`h-5 w-5 ${getCsatColor(data.team.team_csat_avg)}`} />
              </div>
              <p className={`text-3xl font-bold ${data.team.team_csat_avg !== null ? getCsatColor(data.team.team_csat_avg) : 'text-slate-800 dark:text-slate-200'}`}>
                {data.team.team_csat_avg !== null ? data.team.team_csat_avg.toFixed(1) : '--'}
              </p>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mt-1">Team CSAT</p>
            </div>
          </div>

          {/* Agents Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-indigo-500" />
                Agents ({data.team.total_agents})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sortedAgents.length === 0 ? (
                <div className="text-center py-10">
                  <Users className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="text-sm text-slate-500">Keine aktiven Agents gefunden</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                          <th className="text-left px-4 py-3 text-xs font-medium text-slate-500">
                            <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300">
                              Agent <SortIcon column="name" />
                            </button>
                          </th>
                          <th className="text-center px-3 py-3 text-xs font-medium text-slate-500">Rolle</th>
                          <th className="text-right px-3 py-3 text-xs font-medium text-slate-500">
                            <button onClick={() => handleSort('emails_assigned')} className="flex items-center gap-1 ml-auto hover:text-slate-700 dark:hover:text-slate-300">
                              Zugewiesen <SortIcon column="emails_assigned" />
                            </button>
                          </th>
                          <th className="text-right px-3 py-3 text-xs font-medium text-slate-500">Gelöst</th>
                          <th className="text-right px-3 py-3 text-xs font-medium text-slate-500">
                            <button onClick={() => handleSort('resolution_rate')} className="flex items-center gap-1 ml-auto hover:text-slate-700 dark:hover:text-slate-300">
                              Resolution % <SortIcon column="resolution_rate" />
                            </button>
                          </th>
                          <th className="text-right px-3 py-3 text-xs font-medium text-slate-500">
                            <button onClick={() => handleSort('avg_response_minutes')} className="flex items-center gap-1 ml-auto hover:text-slate-700 dark:hover:text-slate-300">
                              Ø FRT <SortIcon column="avg_response_minutes" />
                            </button>
                          </th>
                          <th className="text-right px-3 py-3 text-xs font-medium text-slate-500">
                            <button onClick={() => handleSort('csat_avg')} className="flex items-center gap-1 ml-auto hover:text-slate-700 dark:hover:text-slate-300">
                              CSAT <SortIcon column="csat_avg" />
                            </button>
                          </th>
                          <th className="text-right px-3 py-3 text-xs font-medium text-slate-500">Eskalationen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortedAgents.map(agent => (
                          <tr key={agent.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3">
                              <div>
                                <p className="font-medium text-slate-800 dark:text-slate-200">{agent.name}</p>
                                <p className="text-xs text-slate-500 truncate">{agent.email}</p>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <Badge className={`text-xs px-2 py-0.5 ${getRoleBadgeStyle(agent.role)}`}>
                                {agent.role}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 text-right font-semibold text-slate-800 dark:text-slate-200">
                              {agent.emails_assigned}
                            </td>
                            <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">
                              {agent.emails_resolved}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${getResolutionBg(agent.resolution_rate)} ${getResolutionColor(agent.resolution_rate)}`}>
                                {agent.resolution_rate}%
                              </span>
                            </td>
                            <td className={`px-3 py-3 text-right font-medium ${getFrtColor(agent.avg_response_minutes)}`}>
                              {formatMinutes(agent.avg_response_minutes)}
                            </td>
                            <td className={`px-3 py-3 text-right font-medium ${getCsatColor(agent.csat_avg)}`}>
                              {agent.csat_avg !== null ? agent.csat_avg.toFixed(1) : '--'}
                            </td>
                            <td className="px-3 py-3 text-right text-slate-600 dark:text-slate-400">
                              <span className="text-xs">
                                {agent.escalations_from > 0 && (
                                  <span className="text-amber-600" title="Eskaliert an andere">
                                    {agent.escalations_from} ab
                                  </span>
                                )}
                                {agent.escalations_from > 0 && agent.escalations_to > 0 && ' / '}
                                {agent.escalations_to > 0 && (
                                  <span className="text-blue-600" title="Erhalten von anderen">
                                    {agent.escalations_to} an
                                  </span>
                                )}
                                {agent.escalations_from === 0 && agent.escalations_to === 0 && '--'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="lg:hidden space-y-3">
                    {sortedAgents.map(agent => (
                      <div
                        key={agent.id}
                        className="p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-200">{agent.name}</p>
                            <p className="text-xs text-slate-500">{agent.email}</p>
                          </div>
                          <Badge className={`text-xs px-2 py-0.5 ${getRoleBadgeStyle(agent.role)}`}>
                            {agent.role}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="text-xs text-slate-500">Zugewiesen</p>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{agent.emails_assigned}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Gelöst</p>
                            <p className="font-semibold text-slate-600 dark:text-slate-400">{agent.emails_resolved}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Resolution</p>
                            <p className={`font-semibold ${getResolutionColor(agent.resolution_rate)}`}>{agent.resolution_rate}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Ø FRT</p>
                            <p className={`font-semibold ${getFrtColor(agent.avg_response_minutes)}`}>{formatMinutes(agent.avg_response_minutes)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">CSAT</p>
                            <p className={`font-semibold ${getCsatColor(agent.csat_avg)}`}>{agent.csat_avg !== null ? agent.csat_avg.toFixed(1) : '--'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500">Eskalationen</p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {agent.escalations_from > 0 && <span className="text-amber-600">{agent.escalations_from} ab</span>}
                              {agent.escalations_from > 0 && agent.escalations_to > 0 && ' / '}
                              {agent.escalations_to > 0 && <span className="text-blue-600">{agent.escalations_to} an</span>}
                              {agent.escalations_from === 0 && agent.escalations_to === 0 && '--'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
