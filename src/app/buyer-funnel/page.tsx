'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Loader2,
  RefreshCw,
  Users,
  Eye,
  MousePointerClick,
  TrendingUp,
  ArrowRight,
  Globe,
  Link2,
  Megaphone,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface AttributionBucket {
  source: string
  count: number
  percentage: number
  contacts: Array<{ id: string; name: string; email: string }>
}

interface Attribution {
  bySource: AttributionBucket[]
  byCampaign: AttributionBucket[]
  byUrl: AttributionBucket[]
  byReferrer: AttributionBucket[]
}

interface FunnelStage {
  name: string
  count: number
  contacts: Array<{ id: string; name: string; email: string; date: string | null }>
}

interface ContactRow {
  id: string
  name: string
  email: string
  lifecyclestage: string
  source: string
  firstUrl: string
  lastUrl: string
  firstTouchCampaign: string
  lastTouchCampaign: string
  firstConversion: string
  recentConversion: string
  firstConversionDate: string
  recentConversionDate: string
  pageViews: number
  visits: number
  createdate: string
}

interface BuyerFunnelData {
  formName: string
  totalContacts: number
  conversionEvents: string[]
  summary: {
    totalContacts: number
    avgPageViews: number
    avgVisits: number
    avgConversions: number
  }
  lifecycleFunnel: FunnelStage[]
  firstTouch: Attribution
  lastTouch: Attribution
  conversionTimeline: Array<{ month: string; count: number }>
  contacts: ContactRow[]
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

function AttributionBar({ buckets, color }: { buckets: AttributionBucket[]; color: string }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? buckets : buckets.slice(0, 6)

  if (buckets.length === 0) {
    return <p className="text-sm text-slate-500">Keine Daten vorhanden.</p>
  }

  const maxCount = buckets[0]?.count || 1

  return (
    <div className="space-y-2">
      {shown.map((bucket) => (
        <div key={bucket.source} className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate max-w-[60%]" title={bucket.source}>
              {bucket.source}
            </span>
            <span className="text-sm text-slate-500">
              {bucket.count} ({bucket.percentage}%)
            </span>
          </div>
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${color} rounded-full transition-all`}
              style={{ width: `${(bucket.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {buckets.length > 6 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full text-slate-500"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" /> Weniger anzeigen
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" /> {buckets.length - 6} weitere anzeigen
            </>
          )}
        </Button>
      )}
    </div>
  )
}

function FunnelVisualization({ stages }: { stages: FunnelStage[] }) {
  if (stages.length === 0) return null
  const maxCount = stages[0]?.count || 1

  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => {
        const width = Math.max(20, (stage.count / maxCount) * 100)
        const conversionRate = idx > 0 && stages[idx - 1].count > 0
          ? Math.round((stage.count / stages[idx - 1].count) * 100)
          : 100

        return (
          <div key={stage.name} className="space-y-1">
            {idx > 0 && (
              <div className="flex items-center gap-2 pl-4 text-xs text-slate-400">
                <ArrowRight className="h-3 w-3" />
                <span>{conversionRate}% Conversion</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="w-44 flex-shrink-0 text-right">
                <span className="text-sm font-medium">{stage.name}</span>
              </div>
              <div className="flex-1 relative">
                <div
                  className="h-10 bg-gradient-to-r from-blue-500 to-blue-400 rounded-lg flex items-center justify-end pr-3 transition-all"
                  style={{ width: `${width}%` }}
                >
                  <span className="text-white text-sm font-bold">{stage.count}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AttributionSection({
  title,
  description,
  attribution,
}: {
  title: string
  description: string
  attribution: Attribution
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Source */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5 text-blue-500" />
              Nach Quelle
            </CardTitle>
            <CardDescription>Traffic-Quellen der Kontakte</CardDescription>
          </CardHeader>
          <CardContent>
            <AttributionBar buckets={attribution.bySource} color="bg-blue-500" />
          </CardContent>
        </Card>

        {/* By Referrer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-5 w-5 text-purple-500" />
              Nach Referrer
            </CardTitle>
            <CardDescription>Verweisende Websites</CardDescription>
          </CardHeader>
          <CardContent>
            <AttributionBar buckets={attribution.byReferrer} color="bg-purple-500" />
          </CardContent>
        </Card>

        {/* By Campaign */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="h-5 w-5 text-emerald-500" />
              Nach Kampagne
            </CardTitle>
            <CardDescription>Converting Campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <AttributionBar buckets={attribution.byCampaign} color="bg-emerald-500" />
          </CardContent>
        </Card>

        {/* By URL */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MousePointerClick className="h-5 w-5 text-amber-500" />
              Nach Landing Page
            </CardTitle>
            <CardDescription>{title === 'First Touch' ? 'Erste besuchte Seite' : 'Letzte besuchte Seite vor Conversion'}</CardDescription>
          </CardHeader>
          <CardContent>
            <AttributionBar buckets={attribution.byUrl} color="bg-amber-500" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function formatDate(dateString: string) {
  if (!dateString) return '—'
  return new Date(dateString).toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function getLifecycleBadgeColor(stage: string): string {
  const colors: Record<string, string> = {
    subscriber: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    lead: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    marketingqualifiedlead: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    salesqualifiedlead: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    opportunity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    customer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  }
  return colors[stage] || 'bg-slate-100 text-slate-700'
}

function getLifecycleLabel(stage: string): string {
  const labels: Record<string, string> = {
    subscriber: 'Subscriber',
    lead: 'Lead',
    marketingqualifiedlead: 'MQL',
    salesqualifiedlead: 'SQL',
    opportunity: 'Opportunity',
    customer: 'Customer',
  }
  return labels[stage] || stage || '—'
}

export default function BuyerFunnelPage() {
  const [data, setData] = useState<BuyerFunnelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/hubspot/buyer-funnel?form=eignungscheck')
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setData(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Buyer Funnel" description="Eignungscheck Käufer — First Touch & Last Touch Analyse" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          <span className="ml-3 text-slate-500">Lade HubSpot-Daten...</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Header title="Buyer Funnel" description="Eignungscheck Käufer — First Touch & Last Touch Analyse" />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500 mb-4">{error || 'Fehler beim Laden der Daten'}</p>
            <Button onClick={fetchData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" /> Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <Header
          title="Buyer Funnel"
          description="Eignungscheck Käufer — First Touch & Last Touch Analyse"
        />
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="flex-shrink-0 mt-1">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={Users}
          label="Kontakte gesamt"
          value={data.summary.totalContacts}
          color="text-blue-600"
        />
        <StatCard
          icon={Eye}
          label="Avg. Seitenaufrufe"
          value={data.summary.avgPageViews}
          color="text-purple-600"
        />
        <StatCard
          icon={MousePointerClick}
          label="Avg. Besuche"
          value={data.summary.avgVisits}
          color="text-emerald-600"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg. Conversions"
          value={data.summary.avgConversions}
          color="text-amber-600"
        />
      </div>

      {/* Conversion Events Info */}
      {data.conversionEvents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Gefundene Conversion Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.conversionEvents.map(event => (
                <Badge key={event} variant="outline" className="text-xs">
                  {event}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="first_touch" className="space-y-6">
        <TabsList>
          <TabsTrigger value="first_touch" className="gap-2">
            <Globe className="h-4 w-4" />
            First Touch
          </TabsTrigger>
          <TabsTrigger value="last_touch" className="gap-2">
            <MousePointerClick className="h-4 w-4" />
            Last Touch
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Lifecycle Funnel
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2">
            <Users className="h-4 w-4" />
            Kontakte
          </TabsTrigger>
        </TabsList>

        {/* First Touch Tab */}
        <TabsContent value="first_touch" className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              <strong>First Touch Attribution</strong> zeigt, welcher Kanal den Kontakt zum allerersten Mal auf eure Website gebracht hat — unabhaengig davon, wann die Conversion stattfand.
            </p>
          </div>
          <AttributionSection
            title="First Touch"
            description="Erster Kontaktpunkt"
            attribution={data.firstTouch}
          />
        </TabsContent>

        {/* Last Touch Tab */}
        <TabsContent value="last_touch" className="space-y-6">
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <p className="text-sm text-purple-800 dark:text-purple-300">
              <strong>Last Touch Attribution</strong> zeigt den letzten Kanal/Touchpoint direkt vor der Conversion (Formular-Einreichung). Dieser Kanal hat den Kontakt zum Handeln bewegt.
            </p>
          </div>
          <AttributionSection
            title="Last Touch"
            description="Letzter Kontaktpunkt vor Conversion"
            attribution={data.lastTouch}
          />
        </TabsContent>

        {/* Lifecycle Funnel Tab */}
        <TabsContent value="funnel" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                  Lifecycle Funnel
                </CardTitle>
                <CardDescription>
                  Wie weit sind die Eignungscheck-Kontakte im Verkaufsprozess fortgeschritten?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FunnelVisualization stages={data.lifecycleFunnel} />
              </CardContent>
            </Card>

            {/* Conversion Timeline */}
            {data.conversionTimeline.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    Conversion Timeline
                  </CardTitle>
                  <CardDescription>Eignungscheck-Einreichungen pro Monat</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.conversionTimeline.map(item => {
                      const maxCount = Math.max(...data.conversionTimeline.map(t => t.count))
                      const monthLabel = new Date(item.month + '-01').toLocaleDateString('de-CH', {
                        month: 'long',
                        year: 'numeric',
                      })
                      return (
                        <div key={item.month} className="flex items-center gap-3">
                          <span className="text-sm text-slate-500 w-32 flex-shrink-0 text-right">
                            {monthLabel}
                          </span>
                          <div className="flex-1 h-6 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full flex items-center justify-end pr-2 transition-all"
                              style={{ width: `${Math.max(8, (item.count / maxCount) * 100)}%` }}
                            >
                              <span className="text-xs text-white font-medium">{item.count}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Eignungscheck Kontakte
                <Badge className="bg-blue-500">{data.contacts.length}</Badge>
              </CardTitle>
              <CardDescription>
                Alle Kontakte die den Eignungscheck ausgefuellt haben (max. 50 angezeigt)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.contacts.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  Keine Kontakte mit Eignungscheck-Conversion gefunden.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700">
                        <th className="text-left py-3 px-2 font-medium text-slate-500">Name</th>
                        <th className="text-left py-3 px-2 font-medium text-slate-500">Lifecycle</th>
                        <th className="text-left py-3 px-2 font-medium text-slate-500">Quelle</th>
                        <th className="text-left py-3 px-2 font-medium text-slate-500">First Conversion</th>
                        <th className="text-left py-3 px-2 font-medium text-slate-500">Besuche</th>
                        <th className="text-left py-3 px-2 font-medium text-slate-500">Seiten</th>
                        <th className="text-left py-3 px-2 font-medium text-slate-500">Erstellt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.contacts.map(contact => (
                        <tr
                          key={contact.id}
                          className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          <td className="py-3 px-2">
                            <div>
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-xs text-slate-400">{contact.email}</p>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <Badge
                              variant="outline"
                              className={getLifecycleBadgeColor(contact.lifecyclestage)}
                            >
                              {getLifecycleLabel(contact.lifecyclestage)}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                            {contact.source}
                          </td>
                          <td className="py-3 px-2">
                            <span className="text-xs text-slate-500 truncate max-w-[200px] block" title={contact.firstConversion}>
                              {contact.firstConversion || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-center">{contact.visits}</td>
                          <td className="py-3 px-2 text-center">{contact.pageViews}</td>
                          <td className="py-3 px-2 text-slate-500 text-xs">
                            {formatDate(contact.createdate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
