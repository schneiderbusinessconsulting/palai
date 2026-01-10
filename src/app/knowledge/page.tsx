'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Search,
  RefreshCw,
  FileText,
  Mail,
  HelpCircle,
  BookOpen,
  MoreVertical,
  Trash2,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface KnowledgeItem {
  title: string
  source_type: string
  chunks: number
  updated_at: string
  ids: string[]
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
  const router = useRouter()
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')

  // Upload form state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceType, setSourceType] = useState('help_article')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // AI Categorization state
  const [isCategorizing, setIsCategorizing] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{ category: string; confidence: number; reason: string } | null>(null)

  // Fetch knowledge items
  const fetchItems = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/knowledge?source_type=${filter}`)
      if (response.ok) {
        const data = await response.json()
        setItems(data.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch knowledge:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [filter])

  // Handle upload
  const handleUpload = async () => {
    if (!title.trim()) {
      setUploadStatus('error')
      setUploadMessage('Bitte Titel eingeben')
      return
    }

    if (!content.trim() && !selectedFile) {
      setUploadStatus('error')
      setUploadMessage('Bitte Text eingeben oder Datei hochladen')
      return
    }

    setIsUploading(true)
    setUploadStatus('idle')

    try {
      const formData = new FormData()
      formData.append('title', title)
      formData.append('source_type', sourceType)

      if (selectedFile) {
        formData.append('file', selectedFile)
      } else {
        formData.append('content', content)
      }

      const response = await fetch('/api/knowledge', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setUploadStatus('success')
        setUploadMessage(`${data.chunksCreated} Chunks erstellt`)

        // Reset form
        setTimeout(() => {
          setTitle('')
          setContent('')
          setSelectedFile(null)
          setAiSuggestion(null)
          setSourceType('help_article')
          setIsDialogOpen(false)
          setUploadStatus('idle')
          fetchItems()
        }, 1500)
      } else {
        setUploadStatus('error')
        setUploadMessage(data.error || 'Upload fehlgeschlagen')
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadStatus('error')
      setUploadMessage('Upload fehlgeschlagen')
    } finally {
      setIsUploading(false)
    }
  }

  // AI Categorization
  const handleAiCategorize = async () => {
    if (!title.trim() && !content.trim()) {
      setUploadStatus('error')
      setUploadMessage('Bitte Titel oder Inhalt eingeben für AI-Kategorisierung')
      return
    }

    setIsCategorizing(true)
    setAiSuggestion(null)

    try {
      const response = await fetch('/api/knowledge/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      })

      if (response.ok) {
        const result = await response.json()
        setAiSuggestion(result)
        setSourceType(result.category)
      } else {
        setUploadStatus('error')
        setUploadMessage('AI-Kategorisierung fehlgeschlagen')
      }
    } catch (error) {
      console.error('Categorization error:', error)
      setUploadStatus('error')
      setUploadMessage('AI-Kategorisierung fehlgeschlagen')
    } finally {
      setIsCategorizing(false)
    }
  }

  // Handle delete
  const handleDelete = async (itemTitle: string) => {
    if (!confirm(`"${itemTitle}" wirklich löschen?`)) return

    try {
      const response = await fetch('/api/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: itemTitle }),
      })

      if (response.ok) {
        fetchItems()
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  const filteredItems = items.filter((item) => {
    if (searchQuery) {
      return item.title.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return true
  })

  // Calculate stats
  const stats = {
    total_chunks: items.reduce((sum, item) => sum + item.chunks, 0),
    help_articles: items.filter((i) => i.source_type === 'help_article').length,
    faqs: items.filter((i) => i.source_type === 'faq').length,
    course_info: items.filter((i) => i.source_type === 'course_info').length,
  }

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
            <p className="text-2xl font-bold text-amber-600">{stats.course_info}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Kurs-Infos
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
        <Button variant="outline" className="gap-2" onClick={fetchItems}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
        <Button
          className="gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          onClick={() => router.push('/chat?mode=learning')}
        >
          <Sparkles className="h-4 w-4" />
          Wissen hinzufügen
        </Button>
      </div>

      {/* Knowledge Items List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">
                Noch keine Einträge vorhanden
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Klicke auf "Hinzufügen" um Wissen hochzuladen
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredItems.map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
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
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDelete(item.title)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Wissen hinzufügen</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Titel *</label>
              <Input
                placeholder="z.B. Hypnose-Ausbildung Preise 2026"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Source Type with AI Categorization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Kategorie</label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                        onClick={handleAiCategorize}
                        disabled={isCategorizing}
                      >
                        {isCategorizing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        AI-Kategorisierung
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Kategorie automatisch per AI erkennen</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select value={sourceType} onValueChange={(value) => {
                setSourceType(value)
                setAiSuggestion(null) // Clear suggestion when manually changed
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="help_article">Help Center</SelectItem>
                  <SelectItem value="faq">FAQ</SelectItem>
                  <SelectItem value="course_info">Kurs-Info</SelectItem>
                  <SelectItem value="email">E-Mail Vorlage</SelectItem>
                </SelectContent>
              </Select>
              {aiSuggestion && (
                <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md text-sm">
                  <Sparkles className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-amber-700 dark:text-amber-400">
                      AI Vorschlag: <span className="font-medium">{
                        aiSuggestion.category === 'help_article' ? 'Help Center' :
                        aiSuggestion.category === 'faq' ? 'FAQ' :
                        aiSuggestion.category === 'course_info' ? 'Kurs-Info' :
                        'E-Mail Vorlage'
                      }</span>
                      <span className="opacity-70"> ({Math.round(aiSuggestion.confidence * 100)}% sicher)</span>
                    </p>
                    <p className="text-amber-600/80 dark:text-amber-500/80 text-xs mt-0.5">
                      {aiSuggestion.reason}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Content or File */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Inhalt</label>
              <Textarea
                placeholder="Text hier eingeben oder Datei hochladen..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                disabled={!!selectedFile}
              />
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Oder Datei hochladen</label>
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  selectedFile
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      setSelectedFile(file)
                      setContent('')
                    }
                  }}
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span>{selectedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedFile(null)
                      }}
                    >
                      Entfernen
                    </Button>
                  </div>
                ) : (
                  <div className="text-slate-500 dark:text-slate-400">
                    <Upload className="h-8 w-8 mx-auto mb-2" />
                    <p>PDF oder TXT Datei hier ablegen</p>
                    <p className="text-xs mt-1">oder klicken zum Auswählen</p>
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            {uploadStatus !== 'idle' && (
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${
                  uploadStatus === 'success'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                }`}
              >
                {uploadStatus === 'success' ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <span>{uploadMessage}</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleUpload} disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verarbeite...
                </>
              ) : (
                'Hochladen'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
