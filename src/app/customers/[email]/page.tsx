'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  ArrowLeft,
  Mail,
  TrendingUp,
  MessageSquare,
  ExternalLink,
  CheckCircle,
  Clock,
} from 'lucide-react'

interface CustomerDetail {
  email: string
  name: string
  totalEmails: number
  avgBuyingIntent: number
  dominantSentiment: string
  sentiments: Record<string, number>
  resolvedCount: number
  firstContact: string
  lastContact: string
}

interface CustomerEmail {
  id: string
  from_email: string
  from_name?: string
  subject: string
  received_at: string
  status: string
  tone_sentiment?: string
  buying_intent_score?: number
  priority?: string
}

interface TimelineEntry {
  date: string
  sentiment: string
  buyingIntent: number
  subject: string
  status: string
}

function sentimentColor(sentiment: string) {
  const map: Record<string, string> = {
    positive: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    negative: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    frustrated: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  }
  return map[sentiment] || map.neutral
}

function sentimentLabel(sentiment: string) {
  const map: Record<string, string> = {
    positive: 'Positiv',
    neutral: 'Neutral',
    negative: 'Negativ',
    frustrated: 'Frustriert',
  }
  return map[sentiment] || sentiment
}

export default function CustomerDetailPage({ params }: { params: Promise<{ email: string }> }) {
  const { email } = use(params)
  const decodedEmail = decodeURIComponent(email)
  const router = useRouter()
  const [customer, setCustomer] = useState<CustomerDetail | null>(null)
  const [emails, setEmails] = useState<CustomerEmail[]>([])
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const res = await fetch(`/api/customers/${encodeURIComponent(decodedEmail)}`)
        if (res.ok) {
          const data = await res.json()
          setCustomer(data.customer)
          setEmails(data.emails || [])
          setTimeline(data.timeline || [])
        }
      } catch (e) {
        console.error('Failed to fetch customer:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchCustomer()
  }, [decodedEmail])

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Kundenprofil" description="Laden..." />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="space-y-6">
        <Header title="Kundenprofil" description="Nicht gefunden" />
        <div className="text-center py-12">
          <p className="text-slate-500">Kein Kunde mit dieser E-Mail gefunden.</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <Header title={customer.name} description={customer.email} />
        <Button variant="outline" size="sm" onClick={() => router.push('/customers')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Zurück
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-slate-500">Emails total</p>
              <p className="text-xl font-bold">{customer.totalEmails}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm text-slate-500">Beantwortet</p>
              <p className="text-xl font-bold">{customer.resolvedCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-sm text-slate-500">Avg Buying Intent</p>
              <p className="text-xl font-bold">{customer.avgBuyingIntent}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm text-slate-500">Erster Kontakt</p>
              <p className="text-sm font-medium">{new Date(customer.firstContact).toLocaleDateString('de-CH')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sentiment Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stimmungsverteilung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(customer.sentiments).map(([sentiment, count]) => (
              <Badge key={sentiment} className={sentimentColor(sentiment)}>
                {sentimentLabel(sentiment)}: {count}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sentiment & BI Timeline */}
      {timeline.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Interaktions-Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {timeline.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="text-xs text-slate-400 w-20 flex-shrink-0">
                    {new Date(entry.date).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit' })}
                  </span>
                  <Badge className={`${sentimentColor(entry.sentiment)} text-xs`}>
                    {sentimentLabel(entry.sentiment)}
                  </Badge>
                  {entry.buyingIntent > 0 && (
                    <Badge variant="outline" className="text-xs">
                      BI: {entry.buyingIntent}%
                    </Badge>
                  )}
                  <span className="truncate text-slate-600 dark:text-slate-400">{entry.subject}</span>
                  {entry.status === 'sent' && (
                    <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-4 w-4" />
            E-Mail-Verlauf ({emails.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {emails.map(email => (
              <button
                key={email.id}
                onClick={() => router.push(`/inbox?emailId=${email.id}`)}
                className="w-full text-left flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{email.subject}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(email.received_at).toLocaleString('de-CH', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {email.tone_sentiment && (
                    <Badge className={`${sentimentColor(email.tone_sentiment)} text-xs`}>
                      {sentimentLabel(email.tone_sentiment)}
                    </Badge>
                  )}
                  {(email.buying_intent_score ?? 0) > 0 && (
                    <Badge variant="outline" className="text-xs">{email.buying_intent_score}% BI</Badge>
                  )}
                  <Badge variant={email.status === 'sent' ? 'default' : 'secondary'} className="text-xs">
                    {email.status === 'sent' ? 'Beantwortet' : email.status === 'draft_ready' ? 'Entwurf' : 'Offen'}
                  </Badge>
                  <ExternalLink className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
