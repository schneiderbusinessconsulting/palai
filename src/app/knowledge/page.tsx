'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
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
  Pencil,
  Globe,
  EyeOff,
  Plus,
  ChevronDown,
  Check,
  X,
  Brain,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { formatRelativeDate } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

interface KnowledgeItem {
  title: string
  source_type: string
  chunks: number
  updated_at: string
  ids: string[]
  published: boolean
  approved: boolean
  learning_context: string | null
  source_learning_id: string | null
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
    case 'training_material':
      return <FileText className="h-4 w-4" />
    case 'sent_response':
      return <Mail className="h-4 w-4" />
    case 'ai_instructions':
      return <Sparkles className="h-4 w-4" />
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
    training_material: {
      label: 'Skript/Methode',
      className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    },
    sent_response: {
      label: 'Gesendete Antwort',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    },
    ai_instructions: {
      label: 'AI-Regeln',
      className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    },
  }
  const { label, className } = config[type] || config.help_article
  return <Badge className={className}>{label}</Badge>
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

  // Confirmation dialog
  const [deleteConfirm, setDeleteConfirm] = useState<{ title: string; action: () => void } | null>(null)

  // AI Categorization state
  const [isCategorizing, setIsCategorizing] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<{ category: string; confidence: number; reason: string } | null>(null)

  // Edit state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<{ title: string; content: string; sourceType: string } | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editSourceType, setEditSourceType] = useState('')
  const [isLoadingEdit, setIsLoadingEdit] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

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

  // Handle delete (internal, after confirmation)
  const executeDelete = async (itemTitle: string) => {
    try {
      const response = await fetch('/api/knowledge', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: itemTitle }),
      })

      if (response.ok) {
        toast.success('Eintrag gelöscht')
        fetchItems()
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Löschen fehlgeschlagen')
    }
  }

  // Handle delete with confirmation
  const handleDelete = (itemTitle: string) => {
    setDeleteConfirm({
      title: itemTitle,
      action: () => executeDelete(itemTitle),
    })
  }

  // Handle edit - load item content
  const handleEdit = async (itemTitle: string) => {
    setIsLoadingEdit(true)
    setIsEditDialogOpen(true)

    try {
      const response = await fetch(`/api/knowledge/${encodeURIComponent(itemTitle)}`)
      if (response.ok) {
        const data = await response.json()
        setEditingItem({ title: itemTitle, content: data.content, sourceType: data.sourceType })
        setEditTitle(itemTitle)
        setEditContent(data.content)
        setEditSourceType(data.sourceType)
      } else {
        console.error('Failed to load item')
        setIsEditDialogOpen(false)
      }
    } catch (error) {
      console.error('Edit load error:', error)
      setIsEditDialogOpen(false)
    } finally {
      setIsLoadingEdit(false)
    }
  }

  // Handle update
  const handleUpdate = async () => {
    if (!editingItem || !editTitle.trim()) return

    setIsUpdating(true)

    try {
      const response = await fetch('/api/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldTitle: editingItem.title,
          newTitle: editTitle,
          content: editContent !== editingItem.content ? editContent : undefined,
          sourceType: editSourceType,
        }),
      })

      if (response.ok) {
        setIsEditDialogOpen(false)
        setEditingItem(null)
        fetchItems()
      }
    } catch (error) {
      console.error('Update error:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  // Handle publish toggle
  const handleTogglePublished = async (title: string, currentlyPublished: boolean) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.title === title ? { ...item, published: !currentlyPublished } : item
      )
    )

    try {
      const response = await fetch('/api/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldTitle: title,
          published: !currentlyPublished,
        }),
      })

      if (!response.ok) {
        // Revert on failure
        setItems((prev) =>
          prev.map((item) =>
            item.title === title ? { ...item, published: currentlyPublished } : item
          )
        )
      }
    } catch (error) {
      console.error('Toggle publish error:', error)
      // Revert on error
      setItems((prev) =>
        prev.map((item) =>
          item.title === title ? { ...item, published: currentlyPublished } : item
        )
      )
    }
  }

  // Handle approve/reject
  const handleApprove = async (itemTitle: string) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) => item.title === itemTitle ? { ...item, approved: true } : item)
    )

    try {
      const response = await fetch('/api/knowledge', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldTitle: itemTitle, approved: true }),
      })

      if (!response.ok) {
        // Revert on failure
        setItems((prev) =>
          prev.map((item) =>
            item.title === itemTitle ? { ...item, approved: false } : item
          )
        )
        toast.error('Freigabe fehlgeschlagen')
      }
    } catch (error) {
      console.error('Approve error:', error)
      // Revert on error
      setItems((prev) =>
        prev.map((item) =>
          item.title === itemTitle ? { ...item, approved: false } : item
        )
      )
      toast.error('Freigabe fehlgeschlagen')
    }
  }

  const handleReject = (itemTitle: string) => {
    setDeleteConfirm({
      title: itemTitle,
      action: () => executeDelete(itemTitle),
    })
  }

  const pendingItems: KnowledgeItem[] = []
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
    pending_approval: items.filter((i) => i.approved === false).length,
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
            <SelectItem value="training_material">Skript/Methode</SelectItem>
            <SelectItem value="sent_response">Gesendete Antworten</SelectItem>
            <SelectItem value="ai_instructions">AI-Regeln</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="gap-2" onClick={fetchItems}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700">
              <Plus className="h-4 w-4" />
              Wissen hinzufügen
              <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push('/chat?mode=learning')}>
              <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
              Via KI
              <span className="ml-2 text-xs text-slate-400">(API Credits)</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setIsDialogOpen(true)}>
              <Pencil className="h-4 w-4 mr-2 text-blue-500" />
              Manuell
              <span className="ml-2 text-xs text-slate-400">(Kostenlos)</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Pending Approval Section */}
      {pendingItems.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <Brain className="h-5 w-5" />
              Warten auf Freigabe ({pendingItems.length})
              <span className="text-xs font-normal text-amber-600/70 dark:text-amber-500/70 ml-1">
                – werden erst nach Freigabe für AI-Drafts verwendet
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-amber-100 dark:divide-amber-900/30">
              {pendingItems.map((item, index) => (
                <div
                  key={`pending-${item.title}-${index}`}
                  className="p-4 space-y-3"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 mt-0.5">
                      <Brain className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Aus Learning
                        </Badge>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {item.chunks} {item.chunks === 1 ? 'Chunk' : 'Chunks'}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatRelativeDate(item.updated_at)}
                        </span>
                      </div>
                      {item.learning_context && (
                        <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-amber-200 dark:border-amber-800 text-sm text-slate-600 dark:text-slate-300">
                          <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">Erkenntnis: </span>
                          {item.learning_context}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        className="gap-1.5 bg-green-500 hover:bg-green-600 text-white"
                        onClick={() => handleApprove(item.title)}
                      >
                        <Check className="h-3.5 w-3.5" />
                        Freigeben
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                        onClick={() => handleReject(item.title)}
                      >
                        <X className="h-3.5 w-3.5" />
                        Ablehnen
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                Klicke auf &quot;Hinzufügen&quot; um Wissen hochzuladen
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
                        Aktualisiert {formatRelativeDate(item.updated_at)}
                      </span>
                    </div>
                  </div>
                  {/* Published toggle - only show for Help Center categories */}
                  {['help_article', 'faq', 'course_info'].includes(item.source_type) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={item.published}
                              onCheckedChange={() => handleTogglePublished(item.title, item.published)}
                              className="data-[state=checked]:bg-green-500"
                            />
                            {item.published ? (
                              <Globe className="h-4 w-4 text-green-500" />
                            ) : (
                              <EyeOff className="h-4 w-4 text-slate-400" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{item.published ? 'Im Help Center sichtbar' : 'Nicht im Help Center sichtbar'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(item.title)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Bearbeiten
                      </DropdownMenuItem>
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
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                  <SelectItem value="training_material">Skript/Methode</SelectItem>
                  <SelectItem value="sent_response">Gesendete Antwort</SelectItem>
                  <SelectItem value="email">E-Mail Vorlage</SelectItem>
                  <SelectItem value="ai_instructions">AI-Regeln</SelectItem>
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
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                <span><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">**text**</code> → fett</span>
                <span><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">## text</code> → Überschrift</span>
                <span><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">- text</code> → Liste</span>
              </div>
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
                  accept=".pdf,.txt,.md"
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
                    <CheckCircle className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate max-w-[200px]" title={selectedFile.name}>{selectedFile.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-shrink-0 text-red-500 hover:text-red-600 hover:bg-red-50"
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deleteConfirm?.title}&quot; wird unwiderruflich gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { deleteConfirm?.action(); setDeleteConfirm(null) }}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Eintrag bearbeiten</DialogTitle>
          </DialogHeader>

          {isLoadingEdit ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Title */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Titel</label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </div>

              {/* Source Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Kategorie</label>
                <Select value={editSourceType} onValueChange={setEditSourceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="help_article">Help Center</SelectItem>
                    <SelectItem value="faq">FAQ</SelectItem>
                    <SelectItem value="course_info">Kurs-Info</SelectItem>
                    <SelectItem value="training_material">Skript/Methode</SelectItem>
                    <SelectItem value="sent_response">Gesendete Antwort</SelectItem>
                    <SelectItem value="email">E-Mail Vorlage</SelectItem>
                    <SelectItem value="ai_instructions">AI-Regeln</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Content */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Inhalt</label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={12}
                  className="font-mono text-sm"
                />
                <div className="text-xs text-slate-500 space-y-1">
                  <p>Hinweis: Bei Änderungen am Inhalt werden die Embeddings neu generiert.</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-slate-400">
                    <span><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">**text**</code> → fett</span>
                    <span><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">## text</code> → Überschrift</span>
                    <span><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">### text</code> → Unterüberschrift</span>
                    <span><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">- text</code> → Aufzählung</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating || isLoadingEdit}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                'Speichern'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
