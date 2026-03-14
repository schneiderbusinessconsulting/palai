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
} from 'lucide-react'

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

function formatRelativeDate(dateString: string) {
  const date = new Date(dateString)
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'heute'
  if (diffDays === 1) return 'gestern'
  return `vor ${diffDays}d`
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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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

  useEffect(() => { fetchCustomers() }, [])

  const handleSearch = () => {
    fetchCustomers(search)
  }

  return (
    <div className="space-y-6">
      <Header title="Kunden" description="Kundenprofile aus E-Mail-Interaktionen" />

      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Name oder E-Mail suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} variant="outline">Suchen</Button>
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
      ) : customers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Keine Kunden gefunden</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Kundenliste ({customers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {customers.map((customer) => (
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
