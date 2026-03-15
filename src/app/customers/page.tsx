'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  Users,
  Search,
  TrendingUp,
  MessageSquare,
  Mail,
  ExternalLink,
  ArrowUpDown,
  Filter,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatRelativeDate } from '@/lib/utils'

interface Customer {
  email: string
  name: string
  totalEmails: number
  avgBuyingIntent: number
  dominantSentiment: string
  lastContact: string
  resolvedCount: number
  sentiments: Record<string, number>
}

function sentimentBadge(sentiment: string) {
  const map: Record<string, { label: string; className: string }> = {
    positive: { label: 'Positiv', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    neutral: { label: 'Neutral', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    negative: { label: 'Negativ', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    frustrated: { label: 'Frustriert', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  }
  const info = map[sentiment] || map.neutral
  return <Badge className={info.className}>{info.label}</Badge>
}

type CustomerSortField = 'name' | 'totalEmails' | 'avgBuyingIntent' | 'dominantSentiment' | 'lastContact'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<CustomerSortField>('lastContact')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [sentimentFilter, setSentimentFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const router = useRouter()

  const fetchCustomers = async (query?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('search', query)
      const res = await fetch(`/api/customers?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers || [])
      }
    } catch (e) {
      console.error('Failed to fetch customers:', e)
    } finally {
      setLoading(false)
    }
  }

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(search)
      setPage(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // Filter + sort customers
  const displayCustomers = (() => {
    const filtered = sentimentFilter === 'all'
      ? customers
      : customers.filter(c => c.dominantSentiment === sentimentFilter)

    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'name': cmp = (a.name || a.email).localeCompare(b.name || b.email); break
        case 'totalEmails': cmp = a.totalEmails - b.totalEmails; break
        case 'avgBuyingIntent': cmp = a.avgBuyingIntent - b.avgBuyingIntent; break
        case 'dominantSentiment': cmp = a.dominantSentiment.localeCompare(b.dominantSentiment); break
        case 'lastContact': cmp = new Date(a.lastContact).getTime() - new Date(b.lastContact).getTime(); break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
  })()

  return (
    <div className="space-y-6">
      <Header title="Kunden" description="Kundenprofile aus E-Mail-Interaktionen" />

      {/* Search Bar + Sort + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Name oder E-Mail suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as CustomerSortField)}>
          <SelectTrigger className="w-full sm:w-48">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastContact">Letzter Kontakt</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="totalEmails">E-Mails</SelectItem>
            <SelectItem value="avgBuyingIntent">Buying Intent</SelectItem>
            <SelectItem value="dominantSentiment">Stimmung</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="ghost"
          size="sm"
          className="h-10"
          onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
        >
          {sortDir === 'desc' ? '↓' : '↑'}
        </Button>
      </div>

      {/* Sentiment Filter Chips */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'Alle' },
          { key: 'positive', label: 'Positiv' },
          { key: 'neutral', label: 'Neutral' },
          { key: 'negative', label: 'Negativ' },
          { key: 'frustrated', label: 'Frustriert' },
        ].map(({ key, label }) => (
          <Button
            key={key}
            variant={sentimentFilter === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setSentimentFilter(key); setPage(1) }}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-sm text-slate-500">Kunden total</p>
              <p className="text-xl font-bold">{customers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-purple-500" />
            <div>
              <p className="text-sm text-slate-500">Emails total</p>
              <p className="text-xl font-bold">{customers.reduce((s, c) => s + c.totalEmails, 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-sm text-slate-500">Avg Buying Intent</p>
              <p className="text-xl font-bold">
                {customers.length > 0
                  ? Math.round(customers.reduce((s, c) => s + c.avgBuyingIntent, 0) / customers.length)
                  : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-sm text-slate-500">Beantwortet</p>
              <p className="text-xl font-bold">{customers.reduce((s, c) => s + c.resolvedCount, 0)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : displayCustomers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Keine Kunden gefunden</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Kundenliste ({displayCustomers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {displayCustomers.slice((page - 1) * 20, page * 20).map((customer) => (
                <button
                  key={customer.email}
                  onClick={() => router.push(`/customers/${encodeURIComponent(customer.email)}`)}
                  className="w-full text-left flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                        {(customer.name || customer.email).substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{customer.name}</p>
                      <p className="text-xs text-slate-500 truncate">{customer.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-medium">{customer.totalEmails} Emails</p>
                      <p className="text-xs text-slate-500">{customer.resolvedCount} beantwortet</p>
                    </div>
                    {customer.avgBuyingIntent > 0 && (
                      <Badge variant="outline" className={
                        customer.avgBuyingIntent >= 60 ? 'text-emerald-600 border-emerald-300' :
                        customer.avgBuyingIntent >= 30 ? 'text-amber-600 border-amber-300' :
                        'text-slate-500'
                      }>
                        {customer.avgBuyingIntent}% BI
                      </Badge>
                    )}
                    {sentimentBadge(customer.dominantSentiment)}
                    <span className="text-xs text-slate-400">{formatRelativeDate(customer.lastContact)}</span>
                    <ExternalLink className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100" />
                  </div>
                </button>
              ))}
            </div>
            {/* Pagination Controls */}
            {displayCustomers.length > 20 && (
              <div className="flex items-center justify-between pt-4 mt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Zurück
                </Button>
                <span className="text-sm text-slate-500">
                  Seite {page} von {Math.ceil(displayCustomers.length / 20)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(Math.ceil(displayCustomers.length / 20), p + 1))}
                  disabled={page >= Math.ceil(displayCustomers.length / 20)}
                >
                  Weiter
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
