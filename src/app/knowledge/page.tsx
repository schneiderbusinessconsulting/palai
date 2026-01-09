'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Plus,
  RefreshCw,
  FileText,
  Mail,
  HelpCircle,
  BookOpen,
  MoreVertical,
  Trash2,
  Edit,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Mock data
const mockKnowledgeItems = [
  {
    id: '1',
    title: 'Hypnose-Ausbildung Übersicht',
    source_type: 'help_article',
    chunks: 3,
    updated_at: '2026-01-07T10:00:00Z',
  },
  {
    id: '2',
    title: 'Preisliste 2026',
    source_type: 'faq',
    chunks: 5,
    updated_at: '2026-01-02T14:30:00Z',
  },
  {
    id: '3',
    title: 'Support-Antwort: Ratenzahlung',
    source_type: 'email',
    chunks: 1,
    updated_at: '2026-01-06T09:15:00Z',
  },
  {
    id: '4',
    title: 'Meditation Coach Ausbildung',
    source_type: 'help_article',
    chunks: 4,
    updated_at: '2026-01-04T16:45:00Z',
  },
  {
    id: '5',
    title: 'Life Coach Zertifizierung',
    source_type: 'course_info',
    chunks: 6,
    updated_at: '2026-01-01T11:00:00Z',
  },
  {
    id: '6',
    title: 'Anmeldeprozess FAQ',
    source_type: 'faq',
    chunks: 2,
    updated_at: '2025-12-28T08:00:00Z',
  },
]

const stats = {
  total_chunks: 127,
  help_articles: 45,
  faqs: 23,
  emails: 59,
}

function getSourceIcon(type: string) {
  switch (type) {
    case 'help_article':
      return <BookOpen className="h-4 w-4" />
    case 'faq':
      return <HelpCircle className="h-4 w-4" />
    case 'email':
      return <Mail className="h-4 w-4" />
    case 'course_info':
      return <FileText className="h-4 w-4" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

function getSourceBadge(type: string) {
  const config: Record<string, { label: string; className: string }> = {
    help_article: {
      label: 'Help Center',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    },
    faq: {
      label: 'FAQ',
      className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    },
    email: {
      label: 'E-Mail',
      className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    course_info: {
      label: 'Kurs-Info',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    },
  }
  const { label, className } = config[type] || config.help_article
  return <Badge className={className}>{label}</Badge>
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'heute'
  if (diffDays === 1) return 'gestern'
  if (diffDays < 7) return `vor ${diffDays} Tagen`
  if (diffDays < 30) return `vor ${Math.floor(diffDays / 7)} Wochen`
  return date.toLocaleDateString('de-CH')
}

export default function KnowledgePage() {
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredItems = mockKnowledgeItems.filter((item) => {
    if (filter !== 'all' && item.source_type !== filter) return false
    if (searchQuery) {
      return item.title.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return true
  })

  return (
    <div className="space-y-6">
      <Header
        title="Knowledge Base"
        description="Verwalte die Wissensbasis für AI-Antworten"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats.total_chunks}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Gesamt Chunks
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.help_articles}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Help Artikel
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.faqs}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              FAQ Einträge
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.emails}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              E-Mail Vorlagen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Knowledge Base durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Alle Quellen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Quellen</SelectItem>
            <SelectItem value="help_article">Help Center</SelectItem>
            <SelectItem value="faq">FAQ</SelectItem>
            <SelectItem value="email">E-Mail</SelectItem>
            <SelectItem value="course_info">Kurs-Info</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          HubSpot Sync
        </Button>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Hinzufügen
        </Button>
      </div>

      {/* Knowledge Items List */}
      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                  {getSourceIcon(item.source_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-900 dark:text-white truncate">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {getSourceBadge(item.source_type)}
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {item.chunks} Chunks
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Aktualisiert {formatDate(item.updated_at)}
                    </span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit className="h-4 w-4 mr-2" />
                      Bearbeiten
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">
            Keine Einträge gefunden
          </p>
        </div>
      )}

      {/* Sync Info */}
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
        Letzter HubSpot Sync: vor 6 Stunden
      </p>
    </div>
  )
}
