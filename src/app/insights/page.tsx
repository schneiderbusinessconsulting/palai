'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
} from 'lucide-react'

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
    csatAvg: number | null
    csatTrend: Array<{ week: string; avg: number; count: number }>
  }
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

function formatRelativeDate(dateString: string) {
  const date = new Date(dateString)
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'heute'
  if (diffDays === 1) return 'gestern'
  return `vor ${diffDays}d`
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInsights = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/insights')
      if (!res.ok) throw new Error('Failed to load insights')
      setData(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchInsights() }, [])

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
          <p className="text-slate-500 font-medium">Noch keine Insights verfügbar</p>
          <p className="text-sm text-slate-400 mt-1">Insights werden generiert sobald E-Mails in der Inbox verarbeitet werden.</p>
        </div>
      </div>
    )
  }

  const { summary, marketing, sales, product, sentiment } = data

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
        <Button variant="outline" size="sm" onClick={fetchInsights} disabled={loading} className="flex-shrink-0 mt-1">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={MessageSquare} label="Emails total" value={summary.totalEmails} />
        <StatCard icon={Clock} label="Ausstehend" value={summary.pendingEmails} color="text-amber-600" />
        <StatCard icon={CheckCircle} label="Beantwortet" value={summary.sentEmails} color="text-green-600" />
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
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-600">{marketing.buyingIntentDistribution.high}</p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">Hoch (61-100%)</p>
                    <p className="text-xs text-slate-500 mt-0.5">Hot Leads</p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-amber-600">{marketing.buyingIntentDistribution.medium}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400">Mittel (31-60%)</p>
                    <p className="text-xs text-slate-500 mt-0.5">Warm</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-slate-500">{marketing.buyingIntentDistribution.low}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Niedrig (0-30%)</p>
                    <p className="text-xs text-slate-500 mt-0.5">Kalt</p>
                  </div>
                </div>
                {/* Visual intent scale */}
                <div className="space-y-2">
                  {[100, 80, 60, 40, 20, 0].map((threshold, i) => {
                    const nextThreshold = [80, 60, 40, 20, 0][i] ?? 0
                    const count = sales.hotLeads.filter(h =>
                      (h.buying_intent_score || 0) >= nextThreshold &&
                      (h.buying_intent_score || 0) < (threshold === 100 ? 101 : threshold + 1)
                    ).length
                    if (threshold === 0) return null
                    return null
                  })}
                </div>
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
              <CardContent className="space-y-3">
                {Object.entries(marketing.biByCategory).length === 0 ? (
                  <p className="text-sm text-slate-500">Noch keine BI-Signale erfasst.</p>
                ) : (
                  Object.entries(marketing.biByCategory)
                    .sort(([, a], [, b]) => b - a)
                    .map(([category, count]) => (
                      <div key={category} className="flex items-center gap-3">
                        <div className="w-28 flex-shrink-0">
                          <Badge variant="outline" className={
                            category === 'buying_signal' ? 'text-green-700 border-green-300' :
                            category === 'churn_risk' ? 'text-red-700 border-red-300' :
                            'text-amber-700 border-amber-300'
                          }>
                            {category === 'buying_signal' ? 'Kaufsignal' :
                             category === 'churn_risk' ? 'Churn' : 'Einwand'}
                          </Badge>
                        </div>
                        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={
                              category === 'buying_signal' ? 'bg-green-500 h-full rounded-full' :
                              category === 'churn_risk' ? 'bg-red-500 h-full rounded-full' :
                              'bg-amber-500 h-full rounded-full'
                            }
                            style={{ width: `${totalBiSignals > 0 ? (count / totalBiSignals) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{count}</span>
                      </div>
                    ))
                )}
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
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {topTopics.map(([topic, count]) => (
                      <div key={topic} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <p className="font-medium text-sm">{topic}</p>
                        <p className="text-2xl font-bold text-blue-600">{count}</p>
                        <p className="text-xs text-slate-500">Anfragen</p>
                      </div>
                    ))}
                  </div>
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
                {sales.hotLeads.length === 0 ? (
                  <p className="text-sm text-slate-500">Keine Hot Leads aktuell.</p>
                ) : (
                  <div className="space-y-3">
                    {sales.hotLeads.slice(0, 8).map(lead => (
                      <div key={lead.id} className="p-3 border rounded-lg space-y-2">
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
                      </div>
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
                      <div key={risk.id} className="flex items-center justify-between p-3 border border-red-200 dark:border-red-800 rounded-lg">
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
                      </div>
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
                      <div key={opp.id} className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{opp.from_name || opp.from_email}</p>
                            <p className="text-xs text-slate-500 line-clamp-1">{opp.subject}</p>
                          </div>
                          <span className="text-xs text-slate-400">{formatRelativeDate(opp.received_at)}</span>
                        </div>
                        {opp.buying_intent_score && <BuyingIntentBar score={opp.buying_intent_score} />}
                      </div>
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
                      <div key={gap.id} className="flex items-center justify-between p-3 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <div>
                          <p className="text-sm font-medium line-clamp-1">{gap.subject}</p>
                          <p className="text-xs text-slate-500">{gap.from_email}</p>
                        </div>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {formatRelativeDate(gap.received_at)}
                        </span>
                      </div>
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
              <CardContent className="space-y-3">
                {topTopics.length === 0 ? (
                  <p className="text-sm text-slate-500">Noch keine Daten.</p>
                ) : (
                  topTopics.map(([topic, count]) => {
                    const maxCount = topTopics[0][1]
                    return (
                      <div key={topic} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{topic}</span>
                          <span className="text-sm text-slate-500">{count}</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-purple-500 rounded-full"
                            style={{ width: `${(count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    )
                  })
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
                <div className="grid grid-cols-2 gap-4">
                  <StatCard
                    icon={BookOpen}
                    label="Training-Einträge"
                    value={summary.kbChunkCount}
                    color="text-blue-600"
                  />
                  <StatCard
                    icon={Users}
                    label="Knowledge Gaps"
                    value={product.knowledgeGaps.length}
                    color={product.knowledgeGaps.length > 0 ? 'text-amber-600' : 'text-green-600'}
                  />
                </div>
                {product.knowledgeGaps.length > 0 && (
                  <p className="text-sm text-amber-600 dark:text-amber-400 mt-3">
                    {product.knowledgeGaps.length} Themen sollten in die Knowledge Base aufgenommen werden.
                  </p>
                )}
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
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{sentiment.distribution.positive}</p>
                    <p className="text-xs text-green-700 dark:text-green-400">Positiv</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-2xl font-bold text-slate-600">{sentiment.distribution.neutral}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Neutral</p>
                  </div>
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{sentiment.distribution.negative}</p>
                    <p className="text-xs text-red-700 dark:text-red-400">Negativ</p>
                  </div>
                </div>

                {totalSentiment > 0 && (
                  <div className="space-y-2">
                    {[
                      { key: 'positive', label: 'Positiv', color: 'bg-green-500', count: sentiment.distribution.positive },
                      { key: 'neutral', label: 'Neutral', color: 'bg-slate-400', count: sentiment.distribution.neutral },
                      { key: 'negative', label: 'Negativ', color: 'bg-red-500', count: sentiment.distribution.negative },
                    ].map(item => (
                      <div key={item.key} className="flex items-center gap-3">
                        <span className="text-sm w-16">{item.label}</span>
                        <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`${item.color} h-full rounded-full`}
                            style={{ width: `${(item.count / totalSentiment) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm text-slate-500 w-12 text-right">
                          {Math.round((item.count / totalSentiment) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
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
                    <div className="space-y-2">
                      {sentiment.csatTrend.map(week => (
                        <div key={week.week} className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 w-20">
                            {new Date(week.week).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}
                          </span>
                          <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="bg-amber-400 h-full rounded-full"
                              style={{ width: `${(week.avg / 5) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium w-8 text-right">{week.avg}</span>
                          <span className="text-xs text-slate-400">({week.count})</span>
                        </div>
                      ))}
                    </div>
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard icon={CheckCircle} label="SLA eingehalten" value={summary.slaOk} color="text-green-600" />
                  <StatCard icon={AlertTriangle} label="SLA verletzt" value={summary.slaBreached} color={summary.slaBreached > 0 ? 'text-red-500' : 'text-slate-500'} />
                  <StatCard
                    icon={BarChart3}
                    label="Compliance Rate"
                    value={summary.slaOk + summary.slaBreached > 0
                      ? `${Math.round(summary.slaOk / (summary.slaOk + summary.slaBreached) * 100)}%`
                      : '—'}
                    color="text-blue-600"
                  />
                  <StatCard icon={Clock} label="Noch offen" value={summary.pendingEmails} color="text-amber-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
