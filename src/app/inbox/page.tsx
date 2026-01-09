'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Filter, RefreshCw } from 'lucide-react'

// Mock data - will be replaced with Supabase
const mockEmails = [
  {
    id: '1',
    from_email: 'maria.mueller@gmail.com',
    from_name: 'Maria Müller',
    subject: 'Frage zur Hypnose-Ausbildung',
    body_text: 'Guten Tag, ich interessiere mich für die Hypnose-Ausbildung. Wann startet der nächste Kurs und was kostet er? Gibt es auch eine Ratenzahlungsmöglichkeit?',
    received_at: '2026-01-09T12:32:00Z',
    status: 'draft_ready',
    confidence: 92,
  },
  {
    id: '2',
    from_email: 'thomas.weber@bluewin.ch',
    from_name: 'Thomas Weber',
    subject: 'Ratenzahlung möglich?',
    body_text: 'Hallo, ich würde gerne wissen ob bei der Meditation Coach Ausbildung eine Ratenzahlung möglich ist.',
    received_at: '2026-01-09T09:15:00Z',
    status: 'draft_ready',
    confidence: 87,
  },
  {
    id: '3',
    from_email: 'info@firma.ch',
    from_name: 'HR Abteilung',
    subject: 'Firmenausbildung anfragen',
    body_text: 'Wir sind ein Unternehmen mit 50 Mitarbeitern und interessieren uns für eine Gruppenausbildung im Bereich Stressmanagement.',
    received_at: '2026-01-08T14:00:00Z',
    status: 'pending',
    confidence: 45,
  },
  {
    id: '4',
    from_email: 'anna.schmidt@hotmail.com',
    from_name: 'Anna Schmidt',
    subject: 'Zertifizierung Frage',
    body_text: 'Wird die Life Coach Ausbildung auch international anerkannt?',
    received_at: '2026-01-08T10:30:00Z',
    status: 'approved',
    confidence: 95,
  },
]

function getConfidenceColor(confidence: number) {
  if (confidence >= 85) return 'bg-green-500'
  if (confidence >= 70) return 'bg-amber-500'
  return 'bg-red-500'
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary">Ausstehend</Badge>
    case 'draft_ready':
      return <Badge className="bg-blue-500 hover:bg-blue-600">Draft bereit</Badge>
    case 'approved':
      return <Badge className="bg-green-500 hover:bg-green-600">Genehmigt</Badge>
    case 'sent':
      return <Badge className="bg-slate-500 hover:bg-slate-600">Gesendet</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'vor wenigen Minuten'
  if (diffHours < 24) return `vor ${diffHours}h`
  if (diffDays === 1) return 'gestern'
  return `vor ${diffDays} Tagen`
}

export default function InboxPage() {
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredEmails = mockEmails.filter((email) => {
    if (filter !== 'all' && email.status !== filter) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        email.subject.toLowerCase().includes(query) ||
        email.from_email.toLowerCase().includes(query) ||
        email.from_name?.toLowerCase().includes(query)
      )
    }
    return true
  })

  return (
    <div className="space-y-6">
      <Header
        title="Inbox"
        description="E-Mails aus HubSpot mit AI-Antwortvorschlägen"
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="E-Mails durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="pending">Ausstehend</SelectItem>
            <SelectItem value="draft_ready">Draft bereit</SelectItem>
            <SelectItem value="approved">Genehmigt</SelectItem>
            <SelectItem value="sent">Gesendet</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Sync
        </Button>
      </div>

      {/* Email List */}
      <div className="space-y-3">
        {filteredEmails.map((email) => (
          <Card
            key={email.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Confidence Indicator */}
                <div
                  className={`w-2 h-full min-h-[60px] rounded-full ${getConfidenceColor(email.confidence)}`}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        {email.subject}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {email.from_name || email.from_email}
                        {email.from_name && (
                          <span className="text-slate-400 dark:text-slate-500">
                            {' '}
                            &lt;{email.from_email}&gt;
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {getStatusBadge(email.status)}
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(email.received_at)}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
                    {email.body_text}
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        AI Confidence:
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getConfidenceColor(email.confidence)}`}
                            style={{ width: `${email.confidence}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {email.confidence}%
                        </span>
                      </div>
                    </div>

                    {email.confidence < 70 && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Review empfohlen
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredEmails.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">
            Keine E-Mails gefunden
          </p>
        </div>
      )}
    </div>
  )
}
