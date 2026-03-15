'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Search,
  Plus,
  Copy,
  Edit,
  Trash2,
  MoreVertical,
  Star,
  StarOff,
  Loader2,
  X,
  Check,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'

interface Template {
  id: string
  title: string
  content: string
  category: string
  usage_count: number
  is_favorite: boolean
  created_at: string
  updated_at: string
}

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
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('Alle')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formContent, setFormContent] = useState('')
  const [formCategory, setFormCategory] = useState('Allgemein')
  const [saving, setSaving] = useState(false)

  // Delete dialog state
  const [deleteTemplate, setDeleteTemplate] = useState<Template | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch {
      console.error('Failed to fetch templates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const filteredTemplates = templates.filter((template) => {
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

  const copyToClipboard = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const toggleFavorite = async (template: Template) => {
    const newValue = !template.is_favorite
    // Optimistic update
    setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, is_favorite: newValue } : t))

    const res = await fetch('/api/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: template.id, is_favorite: newValue }),
    })
    if (!res.ok) {
      // Revert on error
      setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, is_favorite: !newValue } : t))
    }
  }

  const openNewDialog = () => {
    setEditingTemplate(null)
    setFormTitle('')
    setFormContent('')
    setFormCategory('Allgemein')
    setDialogOpen(true)
  }

  const openEditDialog = (template: Template) => {
    setEditingTemplate(template)
    setFormTitle(template.title)
    setFormContent(template.content)
    setFormCategory(template.category)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formTitle.trim() || !formContent.trim()) return
    setSaving(true)

    try {
      if (editingTemplate) {
        const res = await fetch('/api/templates', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingTemplate.id,
            title: formTitle,
            content: formContent,
            category: formCategory,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? data.template : t))
        }
      } else {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formTitle,
            content: formContent,
            category: formCategory,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setTemplates(prev => [data.template, ...prev])
        }
      }
      setDialogOpen(false)
    } catch {
      toast.error('Template konnte nicht gespeichert werden')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTemplate) return
    setDeleting(true)

    try {
      const res = await fetch('/api/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTemplate.id }),
      })
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== deleteTemplate.id))
      }
    } catch {
      toast.error('Template konnte nicht gelöscht werden')
    } finally {
      setDeleting(false)
      setDeleteTemplate(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Templates" description="Vorgefertigte Antwort-Bausteine für schnelle Antworten" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    )
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
        <Button className="gap-2" onClick={openNewDialog}>
          <Plus className="h-4 w-4" />
          Neues Template
        </Button>
      </div>

      {/* Template Variables Help */}
      <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Verfügbare Template-Variablen</p>
          <div className="flex flex-wrap gap-2">
            {[
              { var: '{{name}}', desc: 'Kundenname' },
              { var: '{{email}}', desc: 'Kunden-E-Mail' },
              { var: '{{absender}}', desc: 'Absendername' },
              { var: '{{kurs}}', desc: 'Kursname' },
              { var: '{{datum}}', desc: 'Heutiges Datum' },
              { var: '{{betreff}}', desc: 'E-Mail-Betreff' },
            ].map(v => (
              <Badge key={v.var} variant="outline" className="text-xs text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700">
                <code className="mr-1">{v.var}</code> — {v.desc}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-blue-600/70 dark:text-blue-400/50 mt-2">Variablen werden beim Einfügen in die Inbox automatisch ersetzt.</p>
        </CardContent>
      </Card>

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
                    onClick={() => toggleFavorite(template)}
                  >
                    {template.is_favorite ? (
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
                      <DropdownMenuItem onClick={() => openEditDialog(template)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Bearbeiten
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => setDeleteTemplate(template)}
                      >
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
              <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3 flex-1 whitespace-pre-line">
                {template.content}
              </p>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {template.usage_count}x verwendet
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => copyToClipboard(template.id, template.content)}
                >
                  {copiedId === template.id ? (
                    <>
                      <Check className="h-3 w-3 text-green-500" />
                      Kopiert
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Kopieren
                    </>
                  )}
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Template bearbeiten' : 'Neues Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="title">Titel</Label>
              <Input
                id="title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="z.B. Willkommen & Infos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Kategorie</Label>
              <div className="flex gap-2 flex-wrap">
                {categories.filter(c => c !== 'Alle').map((cat) => (
                  <Button
                    key={cat}
                    type="button"
                    variant={formCategory === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFormCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Inhalt</Label>
              <Textarea
                id="content"
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Template-Text eingeben..."
                rows={6}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !formTitle.trim() || !formContent.trim()}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {editingTemplate ? 'Speichern' : 'Erstellen'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTemplate} onOpenChange={(open) => { if (!open) setDeleteTemplate(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Template löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteTemplate?.title}&quot; wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
