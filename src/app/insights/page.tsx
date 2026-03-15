'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Loader2,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  UserMinus,
  Star,
  BarChart3,
  MessageSquare,
  BookOpen,
  RefreshCw,
  Lightbulb,
  Users,
  CheckCircle,
  Clock,
  ExternalLink,
  Download,
} from 'lucide-react'
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend,
  LineChart, Line,
  AreaChart, Area,
  ResponsiveContainer,
} from 'recharts'
import { formatRelativeDate } from '@/lib/utils'

const COLORS = {
  green: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
  gray: '#94a3b8',
  purple: '#8b5cf6',
}

const darkTooltipStyle = {
  contentStyle: { backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#e2e8f0' },
  itemStyle: { color: '#e2e8f0' },
  labelStyle: { color: '#e2e8f0' },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel({ name, percent }: any) {
  return `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`
}

interface InsightsData {
  summary: {
    totalEmails: number
    pendingEmails: number
    sentEmails: number
    kbChunkCount: number
    csatAvg: number | null
    slaOk: number
    slaBreached: number
  }
  marketing: {
    biByCategory: Record<string, number>
    buyingIntentDistribution: { low: number; medium: number; high: number }
    topicCounts: Record<string, number>
  }
  sales: {
    hotLeads: Array<{
      id: string
      from_name?: string
      from_email: string
      subject: string
      buying_intent_score?: number
      received_at: string
      status: string
    }>
    churnRisks: Array<{
      id: string
      from_name?: string
      from_email: string
      subject: string
      received_at: string
      status: string
    }>
    upsellOpportunities: Array<{
      id: string
      from_name?: string
      from_email: string
      subject: string
      received_at: string
      buying_intent_score?: number
    }>
  }
  product: {
    knowledgeGaps: Array<{
      id: string
      subject: string
      from_email: string
      received_at: string
    }>
    topicCounts: Record<string, number>
  }
  sentiment: {
    distribution: { positive: number; neutral: number; negative: number }
    emails: Record<string, DrilldownEmail[]>
    csatAvg: number | null
    csatTrend: Array<{ week: string; avg: number; count: number }>
  }
  drilldown: {
    slaOk: DrilldownEmail[]
    slaBreached: DrilldownEmail[]
    pending: DrilldownEmail[]
    sent: DrilldownEmail[]
  }
}

interface DrilldownEmail {
  id: string
  from_name?: string
  from_email: string
  subject: string
  received_at: string
}

function BuyingIntentBar({ score }: { score: number }) {
  const color =
    score >= 70 ? 'bg-emerald-500' :
    score >= 40 ? 'bg-amber-500' :
    'bg-slate-300 dark:bg-slate-600'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-medium w-8 text-right">{score}%</span>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  color = 'text-slate-700 dark:text-slate-200',
  sub,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  color?: string
  sub?: string
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  )
}

// formatRelativeDate imported from @/lib/utils

function DrilldownDialog({
  open,
  onOpenChange,
  title,
  emails,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  emails: DrilldownEmail[]
}) {
  const router = useRouter()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto space-y-2 flex-1">
          {emails.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">Keine E-Mails vorhanden.</p>
          ) : (
            emails.map(email => (
              <button
                key={email.id}
                onClick={() => router.push(`/inbox?emailId=${email.id}`)}
                className="w-full text-left p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{email.from_name || email.from_email}</p>
                    <p className="text-xs text-slate-500 truncate">{email.subject}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400">{formatRelativeDate(email.received_at)}</span>
                    <ExternalLink className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<string>('30d')
  const [drilldown, setDrilldown] = useState<{ title: string; emails: DrilldownEmail[] } | null>(null)
  const router = useRouter()

  const fetchInsights = useCallback(async (selectedPeriod: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/insights?period=${selectedPeriod}`)
      if (!res.ok) throw new Error('Failed to load insights')
      setData(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchInsights(period) }, [fetchInsights, period])

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Insights" description="Marketing, Sales, Product & Kundenstimmung" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Header title="Insights" description="Marketing, Sales, Product & Kundenstimmung" />
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          {error ? (
            <>
              <p className="text-slate-700 dark:text-slate-300 font-medium">Insights konnten nicht geladen werden</p>
              <p className="text-sm text-slate-400 mt-1">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchInsights(period)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Erneut laden
              </Button>
            </>
          ) : (
            <>
              <p className="text-slate-500 font-medium">Noch keine Insights verfügbar</p>
              <p className="text-sm text-slate-400 mt-1">Insights werden generiert sobald E-Mails in der Inbox verarbeitet werden.</p>
            </>
          )}
        </div>
      </div>
    )
  }

  const { summary, marketing, sales, product, sentiment, drilldown: dd } = data

  const openDrilldown = (title: string, emails: DrilldownEmail[]) => {
    setDrilldown({ title, emails })
  }

  const totalBiSignals = Object.values(marketing.biByCategory).reduce((a, b) => a + b, 0)
  const totalSentiment = sentiment.distribution.positive + sentiment.distribution.neutral + sentiment.distribution.negative
  const topTopics = Object.entries(marketing.topicCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <Header
          title="Insights"
          description="Marketing, Sales, Product & Kundenstimmung"
        />
        <div className="flex gap-2 flex-shrink-0 mt-1 items-center">
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => window.open('/api/reports/export?type=emails&format=csv', '_blank')}>
                Emails als CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open('/api/reports/export?type=emails&format=json', '_blank')}>
                Emails als JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open('/api/reports/export?type=insights&format=csv', '_blank')}>
                Insights als CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => window.open('/api/reports/export?type=insights&format=json', '_blank')}>
                Insights als JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => fetchInsights(period)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={MessageSquare} label="Emails total" value={summary.totalEmails} />
        <button onClick={() => openDrilldown('Ausstehende E-Mails', dd.pending)} className="text-left hover:ring-2 hover:ring-amber-200 rounded-lg transition-all">
          <StatCard icon={Clock} label="Ausstehend" value={summary.pendingEmails} color="text-amber-600" />
        </button>
        <button onClick={() => openDrilldown('Beantwortete E-Mails', dd.sent)} className="text-left hover:ring-2 hover:ring-green-200 rounded-lg transition-all">
          <StatCard icon={CheckCircle} label="Beantwortet" value={summary.sentEmails} color="text-green-600" />
        </button>
        <StatCard icon={BookOpen} label="KB Einträge" value={summary.kbChunkCount} color="text-blue-600" />
        <StatCard
          icon={Star}
          label="CSAT Ø"
          value={summary.csatAvg ? `${summary.csatAvg}/5` : '—'}
          color="text-amber-500"
        />
        <StatCard
          icon={CheckCircle}
          label="SLA ok"
          value={summary.slaOk + summary.slaBreached > 0
            ? `${Math.round(summary.slaOk / (summary.slaOk + summary.slaBreached) * 100)}%`
            : '—'}
          color={summary.slaBreached > 0 ? 'text-red-500' : 'text-green-600'}
          sub={summary.slaBreached > 0 ? `${summary.slaBreached} verletzt` : undefined}
        />
      </div>

      <Tabs defaultValue="marketing" className="space-y-6">
        <TabsList>
          <TabsTrigger value="marketing" className="gap-2">
            <TrendingUp className="h-4 w-4" />Marketing
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <ShoppingCart className="h-4 w-4" />Sales
          </TabsTrigger>
          <TabsTrigger value="product" className="gap-2">
            <Lightbulb className="h-4 w-4" />Product
          </TabsTrigger>
          <TabsTrigger value="sentiment" className="gap-2">
            <Star className="h-4 w-4" />Kundenstimmung
          </TabsTrigger>
        </TabsList>

        {/* ── MARKETING ─────────────────────────────────────────────────────── */}
        <TabsContent value="marketing" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Buying Intent Scale */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Buying Intent Verteilung
                </CardTitle>
                <CardDescription>Kaufabsicht über alle Kundenanfragen</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const biPieData = [
                    { name: 'Hoch', value: marketing.buyingIntentDistribution.high },
                    { name: 'Mittel', value: marketing.buyingIntentDistribution.medium },
                    { name: 'Niedrig', value: marketing.buyingIntentDistribution.low },
                  ].filter(d => d.value > 0)
                  const biPieColors = [COLORS.green, COLORS.amber, COLORS.gray]
                  return biPieData.length === 0 ? (
                    <p className="text-sm text-slate-500">Noch keine Daten verfügbar.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={biPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          label={renderPieLabel}
                        >
                          {biPieData.map((_, idx) => (
                            <Cell key={idx} fill={biPieColors[idx]} />
                          ))}
                        </Pie>
                        <Tooltip {...darkTooltipStyle} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )
                })()}
              </CardContent>
            </Card>

            {/* BI Signals */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  BI Signal Typen
                </CardTitle>
                <CardDescription>{totalBiSignals} Signale total erkannt</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const biBarData = Object.entries(marketing.biByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count]) => ({
                      name: category === 'buying_signal' ? 'Kaufsignal' : category === 'churn_risk' ? 'Churn' : 'Einwand',
                      count,
                      fill: category === 'buying_signal' ? COLORS.green : category === 'churn_risk' ? COLORS.red : COLORS.amber,
                    }))
                  return biBarData.length === 0 ? (
                    <p className="text-sm text-slate-500">Noch keine BI-Signale erfasst.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={biBarData} layout="vertical" margin={{ left: 20, right: 20, top: 5, bottom: 5 }}>
                        <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} width={80} />
                        <Tooltip {...darkTooltipStyle} />
                        <Bar dataKey="count" name="Signale" radius={[0, 4, 4, 0]}>
                          {biBarData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Top Topics */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-500" />
                  Top Themen
                </CardTitle>
                <CardDescription>Häufigste Themen in Kundenanfragen</CardDescription>
              </CardHeader>
              <CardContent>
                {topTopics.length === 0 ? (
                  <p className="text-sm text-slate-500">Noch keine Daten verfügbar.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={topTopics.length * 44 + 20}>
                    <BarChart
                      data={topTopics.map(([topic, count]) => ({ name: topic, count }))}
                      layout="vertical"
                      margin={{ left: 20, right: 30, top: 5, bottom: 5 }}
                    >
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} width={120} />
                      <Tooltip {...darkTooltipStyle} />
                      <Bar dataKey="count" name="Anfragen" fill={COLORS.purple} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── SALES ─────────────────────────────────────────────────────────── */}
        <TabsContent value="sales" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Hot Leads */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  Hot Leads
                  {sales.hotLeads.length > 0 && (
                    <Badge className="bg-emerald-500">{sales.hotLeads.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>Offene Anfragen mit Buying Intent &gt; 60%</CardDescription>
              </CardHeader>
              <CardContent>
                {sales.hotLeads.length > 1 && (
                  <div className="mb-4">
                    <ResponsiveContainer width="100%" height={100}>
                      <AreaChart
                        data={(() => {
                          const byDate: Record<string, number> = {}
                          sales.hotLeads.forEach(l => {
                            const d = new Date(l.received_at).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })
                            byDate[d] = (byDate[d] || 0) + 1
                          })
                          return Object.entries(byDate).map(([date, count]) => ({ date, count }))
                        })()}
                        margin={{ top: 5, right: 5, bottom: 0, left: -20 }}
                      >
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} allowDecimals={false} />
                        <Tooltip {...darkTooltipStyle} />
                        <Area type="monotone" dataKey="count" name="Leads" stroke={COLORS.green} fill={COLORS.green} fillOpacity={0.2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {sales.hotLeads.length === 0 ? (
                  <p className="text-sm text-slate-500">Keine Hot Leads aktuell.</p>
                ) : (
                  <div className="space-y-3">
                    {sales.hotLeads.slice(0, 8).map(lead => (
                      <button
                        key={lead.id}
                        onClick={() => router.push(`/inbox?emailId=${lead.id}`)}
                        className="w-full text-left p-3 border rounded-lg space-y-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm">{lead.from_name || lead.from_email}</p>
                            <p className="text-xs text-slate-500 line-clamp-1">{lead.subject}</p>
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {formatRelativeDate(lead.received_at)}
                          </span>
                        </div>
                        <BuyingIntentBar score={lead.buying_intent_score || 0} />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Churn Risks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserMinus className="h-5 w-5 text-red-500" />
                  Churn-Risiken
                  {sales.churnRisks.length > 0 && (
                    <Badge className="bg-red-500">{sales.churnRisks.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>Kunden mit Abwanderungs-Signalen</CardDescription>
              </CardHeader>
              <CardContent>
                {sales.churnRisks.length === 0 ? (
                  <p className="text-sm text-slate-500">Keine Churn-Risiken erkannt.</p>
                ) : (
                  <div className="space-y-2">
                    {sales.churnRisks.map(risk => (
                      <button
                        key={risk.id}
                        onClick={() => router.push(`/inbox?emailId=${risk.id}`)}
                        className="w-full text-left flex items-center justify-between p-3 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-sm">{risk.from_name || risk.from_email}</p>
                          <p className="text-xs text-slate-500 line-clamp-1">{risk.subject}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{formatRelativeDate(risk.received_at)}</span>
                          <Badge variant="outline" className="text-red-600 border-red-300">
                            {risk.status === 'sent' ? 'Beantwortet' : 'Offen'}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Upsell Opportunities */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                  Upsell Möglichkeiten
                </CardTitle>
                <CardDescription>Bereits beantwortete Anfragen mit Kaufsignal — Nachfass-Potential</CardDescription>
              </CardHeader>
              <CardContent>
                {sales.upsellOpportunities.length === 0 ? (
                  <p className="text-sm text-slate-500">Keine Upsell-Möglichkeiten erkannt.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sales.upsellOpportunities.map(opp => (
                      <button
                        key={opp.id}
                        onClick={() => router.push(`/inbox?emailId=${opp.id}`)}
                        className="w-full text-left p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{opp.from_name || opp.from_email}</p>
                            <p className="text-xs text-slate-500 line-clamp-1">{opp.subject}</p>
                          </div>
                          <span className="text-xs text-slate-400">{formatRelativeDate(opp.received_at)}</span>
                        </div>
                        {opp.buying_intent_score && <BuyingIntentBar score={opp.buying_intent_score} />}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── PRODUCT ───────────────────────────────────────────────────────── */}
        <TabsContent value="product" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Knowledge Gaps */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Knowledge Gaps
                </CardTitle>
                <CardDescription>
                  E-Mails bei denen der Entwurf stark nachbearbeitet wurde — Knowledge Base fehlt Infos
                </CardDescription>
              </CardHeader>
              <CardContent>
                {product.knowledgeGaps.length === 0 ? (
                  <p className="text-sm text-slate-500">Keine Knowledge Gaps erkannt.</p>
                ) : (
                  <div className="space-y-2">
                    {product.knowledgeGaps.map(gap => (
                      <button
                        key={gap.id}
                        onClick={() => router.push(`/inbox?emailId=${gap.id}`)}
                        className="w-full text-left flex items-center justify-between p-3 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium line-clamp-1">{gap.subject}</p>
                          <p className="text-xs text-slate-500">{gap.from_email}</p>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {formatRelativeDate(gap.received_at)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Topic Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-purple-500" />
                  Themenverteilung
                </CardTitle>
                <CardDescription>Was fragen Kunden am häufigsten?</CardDescription>
              </CardHeader>
              <CardContent>
                {topTopics.length === 0 ? (
                  <p className="text-sm text-slate-500">Noch keine Daten.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={topTopics.length * 44 + 20}>
                    <BarChart
                      data={topTopics.map(([topic, count]) => ({ name: topic, count }))}
                      layout="vertical"
                      margin={{ left: 20, right: 20, top: 5, bottom: 5 }}
                    >
                      <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} width={100} />
                      <Tooltip {...darkTooltipStyle} />
                      <Bar dataKey="count" name="Anfragen" fill={COLORS.purple} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* KB Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-blue-500" />
                  Knowledge Base Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const kbPieData = [
                    { name: 'Abgedeckt', value: summary.kbChunkCount },
                    { name: 'Gaps', value: product.knowledgeGaps.length },
                  ].filter(d => d.value > 0)
                  const kbColors = [COLORS.blue, COLORS.amber]
                  return kbPieData.length === 0 ? (
                    <p className="text-sm text-slate-500">Noch keine KB-Daten.</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={kbPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={75}
                            paddingAngle={3}
                            dataKey="value"
                            label={renderPieLabel}
                          >
                            {kbPieData.map((_, idx) => (
                              <Cell key={idx} fill={kbColors[idx]} />
                            ))}
                          </Pie>
                          <Tooltip {...darkTooltipStyle} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                      {product.knowledgeGaps.length > 0 && (
                        <p className="text-sm text-amber-600 dark:text-amber-400 mt-3 text-center">
                          {product.knowledgeGaps.length} Themen sollten in die Knowledge Base aufgenommen werden.
                        </p>
                      )}
                    </>
                  )
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── SENTIMENT / CSAT ──────────────────────────────────────────────── */}
        <TabsContent value="sentiment" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Sentiment Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-500" />
                  Kundenstimmung
                </CardTitle>
                <CardDescription>Sentiment-Analyse aller Anfragen</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Clickable summary counters */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <button
                    onClick={() => openDrilldown('Positive Kundenstimmen', sentiment.emails?.positive || [])}
                    className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg hover:ring-2 hover:ring-green-300 transition-all cursor-pointer"
                  >
                    <p className="text-2xl font-bold text-green-600">{sentiment.distribution.positive}</p>
                    <p className="text-xs text-green-700 dark:text-green-400">Positiv</p>
                  </button>
                  <button
                    onClick={() => openDrilldown('Neutrale Kundenstimmen', sentiment.emails?.neutral || [])}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:ring-2 hover:ring-slate-300 transition-all cursor-pointer"
                  >
                    <p className="text-2xl font-bold text-slate-600">{sentiment.distribution.neutral}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Neutral</p>
                  </button>
                  <button
                    onClick={() => openDrilldown('Negative Kundenstimmen', sentiment.emails?.negative || [])}
                    className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg hover:ring-2 hover:ring-red-300 transition-all cursor-pointer"
                  >
                    <p className="text-2xl font-bold text-red-600">{sentiment.distribution.negative}</p>
                    <p className="text-xs text-red-700 dark:text-red-400">Negativ</p>
                  </button>
                </div>

                {totalSentiment > 0 && (() => {
                  const sentimentPieData = [
                    { name: 'Positiv', value: sentiment.distribution.positive, color: COLORS.green },
                    { name: 'Neutral', value: sentiment.distribution.neutral, color: COLORS.gray },
                    { name: 'Negativ', value: sentiment.distribution.negative, color: COLORS.red },
                  ].filter(d => d.value > 0)
                  return (
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={sentimentPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                          label={renderPieLabel}
                        >
                          {sentimentPieData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip {...darkTooltipStyle} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )
                })()}
              </CardContent>
            </Card>

            {/* CSAT */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  CSAT — Kundenzufriedenheit
                </CardTitle>
                <CardDescription>Bewertungen der AI-Entwürfe durch das Team</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-5xl font-bold text-amber-500">
                    {sentiment.csatAvg ? sentiment.csatAvg.toFixed(1) : '—'}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">von 5 Sternen</p>
                  <div className="flex justify-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span
                        key={star}
                        className={`text-2xl ${star <= Math.round(sentiment.csatAvg || 0) ? 'text-amber-400' : 'text-slate-200 dark:text-slate-700'}`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>

                {sentiment.csatTrend.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Wochentrend</p>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart
                        data={sentiment.csatTrend.map(w => ({
                          date: new Date(w.week).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' }),
                          avg: w.avg,
                          count: w.count,
                        }))}
                        margin={{ top: 5, right: 10, bottom: 5, left: -10 }}
                      >
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <YAxis domain={[0, 5]} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <Tooltip
                          {...darkTooltipStyle}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(value: any, name: any) => [
                            name === 'avg' ? `${value}/5` : value,
                            name === 'avg' ? 'CSAT' : 'Bewertungen',
                          ]}
                        />
                        <Line type="monotone" dataKey="avg" name="avg" stroke={COLORS.amber} strokeWidth={2} dot={{ fill: COLORS.amber, r: 4 }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {sentiment.csatTrend.length === 0 && !sentiment.csatAvg && (
                  <p className="text-sm text-slate-500 text-center">
                    Noch keine CSAT-Bewertungen vorhanden.
                    <br />
                    <span className="text-xs">Werden beim Senden von Antworten gesammelt.</span>
                  </p>
                )}
              </CardContent>
            </Card>

            {/* SLA Summary */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  SLA Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SLA PieChart */}
                  {(summary.slaOk > 0 || summary.slaBreached > 0) && (() => {
                    const slaPieData = [
                      { name: 'Eingehalten', value: summary.slaOk, color: COLORS.green },
                      { name: 'Verletzt', value: summary.slaBreached, color: COLORS.red },
                    ].filter(d => d.value > 0)
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={slaPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={85}
                            paddingAngle={3}
                            dataKey="value"
                            label={renderPieLabel}
                          >
                            {slaPieData.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip {...darkTooltipStyle} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )
                  })()}
                  {/* Stat buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => openDrilldown('SLA eingehalten', dd.slaOk)} className="text-left hover:ring-2 hover:ring-green-200 rounded-lg transition-all">
                      <StatCard icon={CheckCircle} label="SLA eingehalten" value={summary.slaOk} color="text-green-600" />
                    </button>
                    <button onClick={() => openDrilldown('SLA verletzt', dd.slaBreached)} className="text-left hover:ring-2 hover:ring-red-200 rounded-lg transition-all">
                      <StatCard icon={AlertTriangle} label="SLA verletzt" value={summary.slaBreached} color={summary.slaBreached > 0 ? 'text-red-500' : 'text-slate-500'} />
                    </button>
                    <StatCard
                      icon={BarChart3}
                      label="Compliance Rate"
                      value={summary.slaOk + summary.slaBreached > 0
                        ? `${Math.round(summary.slaOk / (summary.slaOk + summary.slaBreached) * 100)}%`
                        : '—'}
                      color="text-blue-600"
                    />
                    <button onClick={() => openDrilldown('Noch offen', dd.pending)} className="text-left hover:ring-2 hover:ring-amber-200 rounded-lg transition-all">
                      <StatCard icon={Clock} label="Noch offen" value={summary.pendingEmails} color="text-amber-600" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <DrilldownDialog
        open={!!drilldown}
        onOpenChange={(open) => !open && setDrilldown(null)}
        title={drilldown?.title || ''}
        emails={drilldown?.emails || []}
      />
    </div>
  )
}
