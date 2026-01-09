'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Plus,
  Copy,
  Edit,
  Trash2,
  MoreVertical,
  Star,
  StarOff,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Mock data
const mockTemplates = [
  {
    id: '1',
    title: 'Willkommen & Infos anfordern',
    content: 'Vielen Dank für Ihr Interesse an unseren Ausbildungen! Gerne sende ich Ihnen weitere Informationen zu...',
    category: 'Allgemein',
    usageCount: 45,
    isFavorite: true,
  },
  {
    id: '2',
    title: 'Ratenzahlung bestätigen',
    content: 'Ja, bei allen unseren Ausbildungen ist eine Ratenzahlung möglich. Die Standardkonditionen sind...',
    category: 'Zahlung',
    usageCount: 32,
    isFavorite: true,
  },
  {
    id: '3',
    title: 'Kurstermin zusenden',
    content: 'Gerne teile ich Ihnen die nächsten verfügbaren Kurstermine mit:\n\n- Hypnose-Ausbildung: [Datum]\n- Meditation Coach: [Datum]',
    category: 'Kurse',
    usageCount: 28,
    isFavorite: false,
  },
  {
    id: '4',
    title: 'Zertifizierung erklären',
    content: 'Unsere Ausbildungen sind vom Schweizerischen Verband für... zertifiziert und international anerkannt.',
    category: 'Zertifizierung',
    usageCount: 21,
    isFavorite: false,
  },
  {
    id: '5',
    title: 'Absage höflich formulieren',
    content: 'Vielen Dank für Ihre Anfrage. Leider können wir Ihnen in diesem Fall nicht weiterhelfen, da...',
    category: 'Allgemein',
    usageCount: 15,
    isFavorite: false,
  },
  {
    id: '6',
    title: 'Firmenbuchung anfragen',
    content: 'Für Firmenbuchungen bieten wir spezielle Konditionen an. Gerne erstelle ich Ihnen ein individuelles Angebot...',
    category: 'Firmen',
    usageCount: 12,
    isFavorite: true,
  },
]

const categories = ['Alle', 'Allgemein', 'Zahlung', 'Kurse', 'Zertifizierung', 'Firmen']

function getCategoryColor(category: string) {
  const colors: Record<string, string> = {
    Allgemein: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    Zahlung: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    Kurse: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    Zertifizierung: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Firmen: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  }
  return colors[category] || colors.Allgemein
}

export default function TemplatesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('Alle')

  const filteredTemplates = mockTemplates.filter((template) => {
    if (activeCategory !== 'Alle' && template.category !== activeCategory) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        template.title.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query)
      )
    }
    return true
  })

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // TODO: Add toast notification
  }

  return (
    <div className="space-y-6">
      <Header
        title="Templates"
        description="Vorgefertigte Antwort-Bausteine für schnelle Antworten"
      />

      {/* Search & Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Templates durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Neues Template
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map((category) => (
          <Button
            key={category}
            variant={activeCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </Button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{template.title}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {/* Toggle favorite */}}
                  >
                    {template.isFavorite ? (
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    ) : (
                      <StarOff className="h-4 w-4 text-slate-400" />
                    )}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
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
              </div>
              <Badge className={getCategoryColor(template.category)}>
                {template.category}
              </Badge>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 flex-1">
                {template.content}
              </p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {template.usageCount}x verwendet
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => copyToClipboard(template.content)}
                >
                  <Copy className="h-3 w-3" />
                  Kopieren
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">
            Keine Templates gefunden
          </p>
        </div>
      )}
    </div>
  )
}
