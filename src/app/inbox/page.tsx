'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Sparkles,
  Send,
  X,
  Mail,
  BookOpen,
  CheckCircle,
  Edit,
  EyeOff,
  Copy,
  Check,
  FileUp,
  RotateCcw,
  MessageSquare,
  Bot,
  Bell,
  FileText,
  User,
} from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

interface EmailDraft {
  id: string
  ai_generated_response: string
  edited_response?: string
  confidence_score: number
  status: string
  formality?: 'sie' | 'du'
}

interface Email {
  id: string
  hubspot_email_id: string
  from_email: string
  from_name?: string
  subject: string
  body_text: string
  received_at: string
  status: string
  email_type?: 'customer_inquiry' | 'form_submission' | 'system_alert' | 'notification'
  needs_response?: boolean
  classification_reason?: string
  email_drafts?: EmailDraft[]
}

interface HubSpotOwner {
  id: string
  email: string
  name: string
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 0.85) return 'bg-green-500'
  if (confidence >= 0.7) return 'bg-amber-500'
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

function getEmailTypeBadge(emailType?: string, needsResponse?: boolean) {
  switch (emailType) {
    case 'system_alert':
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-300 gap-1">
          <Bell className="h-3 w-3" />
          System
        </Badge>
      )
    case 'notification':
      return (
        <Badge variant="outline" className="text-purple-600 border-purple-300 gap-1">
          <Bell className="h-3 w-3" />
          Notification
        </Badge>
      )
    case 'form_submission':
      return (
        <Badge variant="outline" className={`gap-1 ${needsResponse ? 'text-blue-600 border-blue-300' : 'text-slate-500 border-slate-300'}`}>
          <FileText className="h-3 w-3" />
          Formular
        </Badge>
      )
    case 'customer_inquiry':
    default:
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 gap-1">
          <User className="h-3 w-3" />
          Anfrage
        </Badge>
      )
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
  const [emails, setEmails] = useState<Email[]>([])
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [hideSent, setHideSent] = useState(true) // Hide closed/sent by default
  const [hideSystemMails, setHideSystemMails] = useState(true) // Hide system/transactional mails by default
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  // Detail modal state
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [editedResponse, setEditedResponse] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Owner selection
  const [owners, setOwners] = useState<HubSpotOwner[]>([])
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('')

  // Copy state
  const [isCopied, setIsCopied] = useState(false)

  // Formality and regeneration state
  const [formality, setFormality] = useState<'sie' | 'du'>('sie')
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false)
  const [regenerateFeedback, setRegenerateFeedback] = useState('')
  const [isRegenerating, setIsRegenerating] = useState(false)

  // Fetch emails
  const fetchEmails = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/emails?status=${filter}`)
      if (response.ok) {
        const data = await response.json()
        setEmails(data.emails || [])
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Fetch owners on mount
  const fetchOwners = async () => {
    try {
      const response = await fetch('/api/hubspot/owners')
      if (response.ok) {
        const data = await response.json()
        setOwners(data.owners || [])
        // Auto-select first owner if available
        if (data.owners?.length > 0 && !selectedOwnerId) {
          setSelectedOwnerId(data.owners[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch owners:', error)
    }
  }

  useEffect(() => {
    fetchEmails()
    fetchOwners()
  }, [filter])

  // Auto-sync every 30 seconds
  useEffect(() => {
    const autoSync = async () => {
      try {
        await fetch('/api/emails', { method: 'POST' })
        fetchEmails()
      } catch (e) {
        console.error('Auto-sync failed:', e)
      }
    }

    // Initial sync
    autoSync()

    // Set up interval
    const interval = setInterval(autoSync, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [])

  // Sync from HubSpot
  const handleSync = async () => {
    setIsSyncing(true)
    setSyncMessage('')
    try {
      const response = await fetch('/api/emails', { method: 'POST' })
      const data = await response.json()
      if (response.ok) {
        setSyncMessage(`${data.imported} neue E-Mails importiert`)
        fetchEmails()
      } else {
        setSyncMessage(data.error || 'Sync fehlgeschlagen')
      }
    } catch (error) {
      console.error('Sync failed:', error)
      setSyncMessage('Sync fehlgeschlagen')
    } finally {
      setIsSyncing(false)
      setTimeout(() => setSyncMessage(''), 3000)
    }
  }

  // Generate AI draft
  const handleGenerateDraft = async (emailId: string, regenerate = false) => {
    if (regenerate) {
      setIsRegenerating(true)
    } else {
      setIsGenerating(true)
    }
    try {
      const response = await fetch(`/api/emails/${emailId}/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formality,
          feedback: regenerate ? regenerateFeedback : undefined,
          regenerate,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        // Update selected email with new draft
        if (selectedEmail) {
          setSelectedEmail({
            ...selectedEmail,
            status: 'draft_ready',
            email_drafts: [data.draft],
          })
          // Update formality from detected
          if (data.detectedFormality) {
            setFormality(data.detectedFormality)
          }
        }
        fetchEmails()
        // Close regenerate dialog
        setShowRegenerateDialog(false)
        setRegenerateFeedback('')
      }
    } catch (error) {
      console.error('Generate draft failed:', error)
    } finally {
      setIsGenerating(false)
      setIsRegenerating(false)
    }
  }

  // Copy to clipboard
  const handleCopy = async () => {
    if (!selectedEmail?.email_drafts?.[0]) return
    const draft = selectedEmail.email_drafts[0]
    const text = isEditing ? editedResponse : (draft.edited_response || draft.ai_generated_response)

    await navigator.clipboard.writeText(text)
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  // Mark as sent (just update status, no actual sending)
  const handleMarkAsSent = async () => {
    if (!selectedEmail) return

    setIsSending(true)
    try {
      const response = await fetch(`/api/emails/${selectedEmail.id}/mark-sent`, {
        method: 'POST',
      })

      if (response.ok) {
        setIsDetailOpen(false)
        fetchEmails()
      }
    } catch (error) {
      console.error('Mark as sent failed:', error)
    } finally {
      setIsSending(false)
    }
  }

  // Open email detail
  const openEmailDetail = (email: Email) => {
    setSelectedEmail(email)
    setIsDetailOpen(true)
    setIsEditing(false)
    setIsCopied(false)
    setEditedResponse(email.email_drafts?.[0]?.ai_generated_response || '')
    // Set formality from draft if available
    if (email.email_drafts?.[0]?.formality) {
      setFormality(email.email_drafts[0].formality)
    } else {
      setFormality('sie') // Default to formal
    }
    setRegenerateFeedback('')
    setShowRegenerateDialog(false)
  }

  const filteredEmails = emails.filter((email) => {
    // Hide sent/closed emails if toggle is on
    if (hideSent && email.status === 'sent') return false
    // Hide system/transactional emails if toggle is on
    if (hideSystemMails && (email.email_type === 'system_alert' || email.email_type === 'notification' || (email.email_type === 'form_submission' && !email.needs_response))) {
      return false
    }
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

  const currentDraft = selectedEmail?.email_drafts?.[0]
  const confidence = currentDraft?.confidence_score || 0

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
            <SelectItem value="sent">Gesendet</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
          <Switch
            id="hide-sent"
            checked={hideSent}
            onCheckedChange={setHideSent}
          />
          <Label htmlFor="hide-sent" className="text-sm cursor-pointer flex items-center gap-1.5">
            <EyeOff className="h-3.5 w-3.5" />
            Geschlossene ausblenden
          </Label>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background">
          <Switch
            id="hide-system"
            checked={hideSystemMails}
            onCheckedChange={setHideSystemMails}
          />
          <Label htmlFor="hide-system" className="text-sm cursor-pointer flex items-center gap-1.5">
            <Bot className="h-3.5 w-3.5" />
            System-Mails ausblenden
          </Label>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sync...' : 'HubSpot Sync'}
        </Button>
      </div>

      {/* Sync Message */}
      {syncMessage && (
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-sm">
          {syncMessage}
        </div>
      )}

      {/* Email List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : filteredEmails.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-slate-500 dark:text-slate-400">
            Keine E-Mails gefunden
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Klicke auf "HubSpot Sync" um E-Mails zu importieren
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEmails.map((email) => {
            const draft = email.email_drafts?.[0]
            const emailConfidence = draft?.confidence_score || 0

            return (
              <Card
                key={email.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => openEmailDetail(email)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Confidence Indicator */}
                    <div
                      className={`w-2 h-full min-h-[60px] rounded-full ${
                        draft ? getConfidenceColor(emailConfidence) : 'bg-slate-300'
                      }`}
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
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                          {getEmailTypeBadge(email.email_type, email.needs_response)}
                          {getStatusBadge(email.status)}
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(email.received_at)}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-2">
                        {email.body_text}
                      </p>

                      {draft && (
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              AI Confidence:
                            </span>
                            <div className="flex items-center gap-1">
                              <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${getConfidenceColor(emailConfidence)}`}
                                  style={{ width: `${emailConfidence * 100}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                {Math.round(emailConfidence * 100)}%
                              </span>
                            </div>
                          </div>

                          {emailConfidence < 0.7 && (
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              Review empfohlen
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Email Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{selectedEmail?.subject}</DialogTitle>
          </DialogHeader>

          {selectedEmail && (
            <div className="space-y-4 py-4">
              {/* Email Info */}
              <div className="text-sm text-slate-500 dark:text-slate-400">
                <p>
                  <strong>Von:</strong> {selectedEmail.from_name || selectedEmail.from_email}
                  {selectedEmail.from_name && ` <${selectedEmail.from_email}>`}
                </p>
                <p>
                  <strong>Empfangen:</strong>{' '}
                  {new Date(selectedEmail.received_at).toLocaleString('de-CH')}
                </p>
              </div>

              {/* Original Message */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg overflow-hidden">
                <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Original Nachricht
                </h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words">
                  {selectedEmail.body_text}
                </p>
              </div>

              {/* AI Draft */}
              {currentDraft ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <h4 className="font-medium">AI Antwortvorschlag</h4>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Formality Toggle */}
                      <div className="flex items-center gap-2 px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md">
                        <button
                          onClick={() => setFormality('sie')}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            formality === 'sie'
                              ? 'bg-white dark:bg-slate-700 shadow-sm font-medium'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          Sie
                        </button>
                        <button
                          onClick={() => setFormality('du')}
                          className={`px-2 py-1 text-xs rounded transition-colors ${
                            formality === 'du'
                              ? 'bg-white dark:bg-slate-700 shadow-sm font-medium'
                              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                          }`}
                        >
                          Du
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500">Confidence:</span>
                        <Badge className={getConfidenceColor(confidence)}>
                          {Math.round(confidence * 100)}%
                        </Badge>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setShowRegenerateDialog(true)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Neu generieren mit Feedback</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={handleCopy}
                            >
                              {isCopied ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{isCopied ? 'Kopiert!' : 'In Zwischenablage kopieren'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Regenerate Dialog */}
                  {showRegenerateDialog && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <div className="flex items-start gap-2 mb-3">
                        <MessageSquare className="h-4 w-4 text-amber-600 mt-0.5" />
                        <div>
                          <h5 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                            Was soll verbessert werden?
                          </h5>
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            Beschreibe, was an der Antwort geändert werden soll
                          </p>
                        </div>
                      </div>
                      <Textarea
                        value={regenerateFeedback}
                        onChange={(e) => setRegenerateFeedback(e.target.value)}
                        placeholder="z.B. 'Freundlicher formulieren', 'Mehr Details zu Preisen', 'Kürzer fassen'..."
                        rows={2}
                        className="text-sm mb-3"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setShowRegenerateDialog(false)
                            setRegenerateFeedback('')
                          }}
                        >
                          Abbrechen
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleGenerateDraft(selectedEmail!.id, true)}
                          disabled={isRegenerating}
                        >
                          {isRegenerating ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Generiere...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Neu generieren
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {isEditing ? (
                    <Textarea
                      value={editedResponse}
                      onChange={(e) => setEditedResponse(e.target.value)}
                      rows={10}
                      className="font-mono text-sm"
                    />
                  ) : (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {currentDraft.edited_response || currentDraft.ai_generated_response}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Sparkles className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-slate-500 dark:text-slate-400">
                    Noch kein AI-Vorschlag generiert
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => handleGenerateDraft(selectedEmail.id)}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generiere...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        AI Vorschlag generieren
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {currentDraft && (
            <DialogFooter className="flex-col sm:flex-row gap-3">
              {/* Owner Selection */}
              {owners.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-sm text-slate-500 whitespace-nowrap">Senden als:</span>
                  <Select value={selectedOwnerId} onValueChange={setSelectedOwnerId}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Owner wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2 w-full sm:w-auto justify-end flex-wrap">
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  Schliessen
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditing(!isEditing)
                    if (!isEditing) {
                      setEditedResponse(
                        currentDraft.edited_response || currentDraft.ai_generated_response
                      )
                    }
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {isEditing ? 'Vorschau' : 'Bearbeiten'}
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={handleMarkAsSent}
                  disabled={isSending}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Markiere...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Als gesendet markieren
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
