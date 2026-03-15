'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  StickyNote,
  Trash2,
  Save,
  Bookmark,
  UserCircle,
  Wand2,
  ArrowUpDown,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  CheckSquare,
  Square,
} from 'lucide-react'
import { resolveTemplateVariables, detectCourseName } from '@/lib/template-utils'
import {
  getConfidenceColor,
  getStatusBadge,
  getEmailTypeBadge,
  getBuyingIntentBadge,
} from '@/components/inbox/inbox-utils'
import { formatRelativeDate } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
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
  body_html?: string
  received_at: string
  status: string
  email_type?: 'customer_inquiry' | 'form_submission' | 'system_alert' | 'notification'
  needs_response?: boolean
  classification_reason?: string
  buying_intent_score?: number
  email_drafts?: EmailDraft[]
  assigned_agent_id?: string
  support_level?: string
  snoozed_until?: string
  tags?: string[]
  hubspot_thread_id?: string
}

interface Agent {
  id: string
  name: string
  email: string
  role: string
  specializations?: string[]
  is_active: boolean
}

interface EmailNote {
  id: string
  email_id: string
  agent_name: string
  content: string
  created_at: string
}

interface SavedView {
  id: string
  name: string
  filters: {
    status: string
    hideSent: boolean
    hideSystemMails: boolean
    searchQuery: string
    assignedAgentId: string
  }
}

interface HubSpotOwner {
  id: string
  email: string
  name: string
}

function InboxPageContent() {
  const searchParams = useSearchParams()
  const [emails, setEmails] = useState<Email[]>([])
  const [filter, setFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [hideSent, setHideSent] = useState(true) // Hide closed/sent by default
  const [hideSystemMails, setHideSystemMails] = useState(true) // Hide system/transactional mails by default
  const [threadView, setThreadView] = useState(false) // Group by thread
  const [autoDraftEnabled, setAutoDraftEnabled] = useState(false) // Auto-draft disabled by default to save credits
  const [isLoading, setIsLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  // Inline messages replaced by toast notifications
  const [fetchError, setFetchError] = useState('')

  // Sorting
  const [sortBy, setSortBy] = useState<'date' | 'confidence' | 'status' | 'sender'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Pagination
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkActioning, setIsBulkActioning] = useState(false)

  // Dismiss confirmation
  const [dismissEmailId, setDismissEmailId] = useState<string | null>(null)

  // Detail modal state
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [editedResponse, setEditedResponse] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // saveMessage replaced by toast notifications
  const [isManualMode, setIsManualMode] = useState(false)

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
  const [isClassifying, setIsClassifying] = useState(false)

  // Save to KB state
  const [isSavingToKb, setIsSavingToKb] = useState(false)
  // kbSaveMsg replaced by toast notifications

  // Conflict detection: lock state
  const [lockWarning, setLockWarning] = useState<{ locked_by: string; locked_at: string } | null>(null)

  // Agent assignment state
  const [agents, setAgents] = useState<Agent[]>([])
  const [assignedAgentFilter, setAssignedAgentFilter] = useState<string>('all')

  // Tags state
  const [tagInput, setTagInput] = useState('')
  const [tagFilter, setTagFilter] = useState<string>('')

  // Internal notes state
  const [notes, setNotes] = useState<EmailNote[]>([])
  const [notesExpanded, setNotesExpanded] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [notesError, setNotesError] = useState('')

  // Thread history state
  const [threadEmails, setThreadEmails] = useState<Email[]>([])
  const [expandedThreadIds, setExpandedThreadIds] = useState<Set<string>>(new Set())

  // Saved views state
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [showSaveViewInput, setShowSaveViewInput] = useState(false)
  const [newViewName, setNewViewName] = useState('')

  // Agent name helper (from profile localStorage)
  const getAgentName = () => {
    try {
      const profile = localStorage.getItem('palai_profile')
      if (profile) {
        const p = JSON.parse(profile)
        return [p.firstName, p.lastName].filter(Boolean).join(' ') || 'Unbekannt'
      }
    } catch { /* ignore */ }
    return 'Unbekannt'
  }

  // Release lock helper (fire-and-forget)
  const releaseLock = (emailId: string) => {
    fetch(`/api/emails/${emailId}/lock`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_name: getAgentName() }),
    }).catch(() => {})
  }

  // Acquire lock helper (fire-and-forget, no conflict warning on open)
  const acquireLock = (emailId: string) => {
    fetch(`/api/emails/${emailId}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_name: getAgentName() }),
    }).catch(() => {})
  }

  // Lock heartbeat: refresh lock every 3 minutes while modal is open
  const lockHeartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (isDetailOpen && selectedEmail) {
      acquireLock(selectedEmail.id)
      lockHeartbeatRef.current = setInterval(() => {
        if (selectedEmail) acquireLock(selectedEmail.id)
      }, 3 * 60 * 1000)
    } else {
      if (lockHeartbeatRef.current) {
        clearInterval(lockHeartbeatRef.current)
        lockHeartbeatRef.current = null
      }
    }
    return () => {
      if (lockHeartbeatRef.current) {
        clearInterval(lockHeartbeatRef.current)
        lockHeartbeatRef.current = null
      }
    }
  }, [isDetailOpen, selectedEmail?.id])

  // Close modal and release any held lock
  const handleClose = () => {
    if (selectedEmail) releaseLock(selectedEmail.id)
    setIsDetailOpen(false)
    setLockWarning(null)
  }

  // Load auto-draft preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('autoDraftEnabled')
    if (stored !== null) {
      setAutoDraftEnabled(stored === 'true')
    }
  }, [])

  // Save auto-draft preference to localStorage
  const handleAutoDraftChange = (enabled: boolean) => {
    setAutoDraftEnabled(enabled)
    localStorage.setItem('autoDraftEnabled', String(enabled))
  }

  // Fetch emails (with optional loading indicator)
  const fetchEmails = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    try {
      const response = await fetch(`/api/emails?status=${filter}`)
      const data = await response.json()
      if (response.ok) {
        setEmails(data.emails || [])
        setFetchError('')
      } else {
        console.error('Email API error:', data)
        setFetchError(data.details ? `${data.error}: ${data.details}` : (data.error || `Fehler beim Laden (HTTP ${response.status})`))
      }
    } catch (error) {
      console.error('Failed to fetch emails:', error)
      setFetchError('Verbindung zum Server fehlgeschlagen')
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [filter])

  // Fetch agents on mount
  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents')
      if (response.ok) {
        const data = await response.json()
        setAgents(data.agents || [])
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    }
  }

  // Fetch notes for a specific email
  const fetchNotes = async (emailId: string) => {
    setNotesError('')
    try {
      const response = await fetch(`/api/emails/${emailId}/notes`)
      if (response.ok) {
        const data = await response.json()
        setNotes(data.notes || [])
      } else {
        setNotes([])
      }
    } catch {
      setNotes([])
      setNotesError('Notizen konnten nicht geladen werden')
    }
  }

  // Add a note
  const handleAddNote = async () => {
    if (!selectedEmail || !newNoteContent.trim()) return
    setIsAddingNote(true)
    try {
      const response = await fetch(`/api/emails/${selectedEmail.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNoteContent.trim(), agent_name: getAgentName() }),
      })
      if (response.ok) {
        setNewNoteContent('')
        fetchNotes(selectedEmail.id)
      } else {
        const data = await response.json()
        setNotesError(data.error || 'Fehler beim Hinzufügen')
      }
    } catch {
      setNotesError('Fehler beim Hinzufügen')
    } finally {
      setIsAddingNote(false)
    }
  }

  // Delete a note
  const handleDeleteNote = async (noteId: string) => {
    if (!selectedEmail) return
    try {
      await fetch(`/api/emails/${selectedEmail.id}/notes`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: noteId }),
      })
      fetchNotes(selectedEmail.id)
    } catch {
      setNotesError('Fehler beim Löschen')
    }
  }

  // Assign agent to email
  const handleAssignAgent = async (emailId: string, agentId: string) => {
    try {
      const response = await fetch(`/api/emails/${emailId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId || null }),
      })
      if (response.ok) {
        // Update local state
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, assigned_agent_id: agentId || undefined } : e))
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(prev => prev ? { ...prev, assigned_agent_id: agentId || undefined } : prev)
        }
        toast.success(agentId ? 'Agent zugewiesen' : 'Zuweisung entfernt')
      } else {
        toast.error('Zuweisung fehlgeschlagen')
      }
    } catch (error) {
      console.error('Failed to assign agent:', error)
      toast.error('Zuweisung fehlgeschlagen')
    }
  }

  // Snooze an email
  const handleSnooze = async (emailId: string, hours: number) => {
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
    try {
      const response = await fetch(`/api/emails/${emailId}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ until }),
      })
      if (response.ok) {
        // Remove from current view
        setEmails(prev => prev.filter(e => e.id !== emailId))
        handleClose()
      }
    } catch (error) {
      console.error('Failed to snooze email:', error)
    }
  }

  // Tag management
  const handleAddTag = async (emailId: string, tag: string) => {
    const trimmed = tag.trim().toLowerCase()
    if (!trimmed) return
    try {
      const res = await fetch(`/api/emails/${emailId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag: trimmed }),
      })
      if (res.ok) {
        const { tags } = await res.json()
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, tags } : e))
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(prev => prev ? { ...prev, tags } : prev)
        }
        setTagInput('')
      }
    } catch { /* silent */ }
  }

  const handleRemoveTag = async (emailId: string, tag: string) => {
    try {
      const res = await fetch(`/api/emails/${emailId}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag }),
      })
      if (res.ok) {
        const { tags } = await res.json()
        setEmails(prev => prev.map(e => e.id === emailId ? { ...e, tags } : e))
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(prev => prev ? { ...prev, tags } : prev)
        }
      }
    } catch { /* silent */ }
  }

  // Resolve template variables in text
  const resolveTemplateVars = (text: string): string => {
    if (!selectedEmail) return text
    const context = {
      recipientName: selectedEmail.from_name || undefined,
      recipientEmail: selectedEmail.from_email,
      senderName: getAgentName(),
      courseName: detectCourseName(selectedEmail.subject),
      subject: selectedEmail.subject,
    }
    return resolveTemplateVariables(text, context)
  }

  // Load saved views from localStorage
  const loadSavedViews = () => {
    try {
      const stored = localStorage.getItem('palai_saved_views')
      if (stored) setSavedViews(JSON.parse(stored))
    } catch { /* ignore */ }
  }

  // Save a new view
  const handleSaveView = () => {
    if (!newViewName.trim()) return
    const view: SavedView = {
      id: Date.now().toString(),
      name: newViewName.trim(),
      filters: {
        status: filter,
        hideSent,
        hideSystemMails,
        searchQuery,
        assignedAgentId: assignedAgentFilter,
      },
    }
    const updated = [...savedViews, view]
    setSavedViews(updated)
    localStorage.setItem('palai_saved_views', JSON.stringify(updated))
    setNewViewName('')
    setShowSaveViewInput(false)
  }

  // Load a saved view
  const handleLoadView = (view: SavedView) => {
    setFilter(view.filters.status)
    setHideSent(view.filters.hideSent)
    setHideSystemMails(view.filters.hideSystemMails)
    setSearchQuery(view.filters.searchQuery)
    setAssignedAgentFilter(view.filters.assignedAgentId || 'all')
  }

  // Delete a saved view
  const handleDeleteView = (viewId: string) => {
    const updated = savedViews.filter(v => v.id !== viewId)
    setSavedViews(updated)
    localStorage.setItem('palai_saved_views', JSON.stringify(updated))
  }

  // Get agent initials for avatar
  const getAgentInitials = (agentId: string): string => {
    const agent = agents.find(a => a.id === agentId)
    if (!agent) return '?'
    const parts = agent.name.split(' ')
    return parts.map(p => p[0]).join('').toUpperCase().slice(0, 2)
  }

  // Get agent name by ID
  const getAgentNameById = (agentId: string): string => {
    const agent = agents.find(a => a.id === agentId)
    return agent?.name || 'Unbekannt'
  }

  // Fetch owners on mount
  const fetchOwners = async () => {
    try {
      const response = await fetch('/api/hubspot/owners')
      if (response.ok) {
        const data = await response.json()
        setOwners(data.owners || [])
        // Auto-select owner based on profile email, fallback to first
        if (data.owners?.length > 0 && !selectedOwnerId) {
          const profile = localStorage.getItem('palai_profile')
          const profileEmail = profile ? JSON.parse(profile).email : null
          const match = profileEmail
            ? data.owners.find((o: HubSpotOwner) => o.email === profileEmail)
            : null
          setSelectedOwnerId(match?.id || data.owners[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch owners:', error)
    }
  }

  useEffect(() => {
    fetchEmails()
    fetchOwners()
    fetchAgents()
    loadSavedViews()
  }, [fetchEmails])

  // Deep-link: open email detail from ?emailId= query param (e.g. from Insights page)
  const [deepLinkHandled, setDeepLinkHandled] = useState(false)
  useEffect(() => {
    const emailId = searchParams.get('emailId')
    if (!emailId || deepLinkHandled || emails.length === 0) return
    // Temporarily disable filters to find the email
    const email = emails.find(e => e.id === emailId)
    if (email) {
      openEmailDetail(email)
      setDeepLinkHandled(true)
    } else if (!isLoading) {
      // Email might be filtered out — try fetching all emails
      setFilter('all')
      setHideSent(false)
      setHideSystemMails(false)
      setDeepLinkHandled(true)
    }
  }, [emails, searchParams, deepLinkHandled, isLoading])

  // Auto-sync every 60 seconds (background, no loading indicator)
  const isSyncingRef = useRef(false)
  useEffect(() => {
    const autoSync = async () => {
      if (isSyncingRef.current) return // Prevent concurrent syncs
      isSyncingRef.current = true
      try {
        // Get current autoDraft setting from localStorage
        const autoDraft = localStorage.getItem('autoDraftEnabled') === 'true'
        // Sync in background
        const response = await fetch(`/api/emails?autoDraft=${autoDraft}`, { method: 'POST' })
        const data = await response.json()

        // Only refresh UI if there are new emails
        if (data.imported > 0) {
          fetchEmails(false) // Silent refresh
        }
      } catch (e) {
        console.error('Auto-sync failed:', e)
      } finally {
        isSyncingRef.current = false
      }
    }

    // Initial sync (with loading on first load)
    autoSync()

    // Set up interval - every 60 seconds
    const interval = setInterval(autoSync, 60000)

    return () => clearInterval(interval)
  }, [fetchEmails])

  // Sync from HubSpot (including status sync for closed conversations)
  const handleSync = async () => {
    setIsSyncing(true)
    setFetchError('')
    try {
      // First: Import new emails (pass autoDraft setting)
      const importResponse = await fetch(`/api/emails?autoDraft=${autoDraftEnabled}`, { method: 'POST' })
      const importData = await importResponse.json()

      if (!importResponse.ok) {
        const errorMsg = importData.error || `Sync fehlgeschlagen (HTTP ${importResponse.status})`
        toast.error(errorMsg)
        setFetchError(errorMsg)
        return
      }

      // Second: Sync conversation statuses (mark closed as sent)
      const statusResponse = await fetch('/api/emails?action=sync-status', { method: 'PATCH' })
      const statusData = await statusResponse.json()

      const messages = []
      if (importData.imported > 0) {
        messages.push(`${importData.imported} neue E-Mails`)
      }
      if (statusData.closedEmails > 0) {
        messages.push(`${statusData.closedEmails} geschlossen`)
      }
      toast.success(messages.length > 0 ? messages.join(', ') : 'Alles aktuell')
      fetchEmails(false) // Silent refresh - button already shows loading state
    } catch (error) {
      console.error('Sync failed:', error)
      const msg = 'Sync fehlgeschlagen — Serververbindung prüfen'
      toast.error(msg)
      setFetchError(msg)
    } finally {
      setIsSyncing(false)
    }
  }

  // Re-classify existing emails
  const handleReclassify = async () => {
    setIsClassifying(true)
    try {
      const response = await fetch('/api/emails', { method: 'PATCH' })
      const data = await response.json()
      if (response.ok) {
        toast.success(data.message || `${data.classified || 0} klassifiziert, ${data.toneAnalyzed || 0} Tone, ${data.biScanned || 0} BI`)
        fetchEmails(false) // Silent refresh
      } else {
        toast.error(data.error || 'Klassifizierung fehlgeschlagen')
      }
    } catch (error) {
      console.error('Reclassify failed:', error)
      toast.error('Klassifizierung fehlgeschlagen')
    } finally {
      setIsClassifying(false)
    }
  }

  // Generate AI draft
  const handleGenerateDraft = async (emailId: string, regenerate = false) => {
    if (regenerate) {
      setIsRegenerating(true)
    } else {
      setIsGenerating(true)
    }

    // Acquire lock — prevent two agents from generating simultaneously
    try {
      const lockRes = await fetch(`/api/emails/${emailId}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_name: getAgentName() }),
      })
      if (lockRes.status === 409) {
        const data = await lockRes.json()
        setLockWarning({ locked_by: data.locked_by, locked_at: data.locked_at })
        setIsGenerating(false)
        setIsRegenerating(false)
        return
      }
    } catch { /* network error — proceed anyway */ }

    try {
      const response = await fetch(`/api/emails/${emailId}/generate-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formality,
          feedback: regenerate ? regenerateFeedback : undefined,
          regenerate,
          senderName: getAgentName() || undefined,
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

  // Send via Resend + HubSpot (full send pipeline)
  const handleSend = async () => {
    if (!selectedEmail) return

    const finalText = isEditing ? editedResponse : (currentDraft?.edited_response || currentDraft?.ai_generated_response || editedResponse)

    if (!finalText?.trim()) {
      toast.error('Antwort darf nicht leer sein')
      return
    }

    setIsSending(true)
    try {
      const response = await fetch(`/api/emails/${selectedEmail.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraft?.id || undefined,
          finalText,
          ownerId: selectedOwnerId || undefined,
        }),
      })

      if (response.ok) {
        toast.success('Antwort gesendet')
        releaseLock(selectedEmail.id)
        setIsDetailOpen(false)
        fetchEmails()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Senden fehlgeschlagen')
      }
    } catch (error) {
      console.error('Send failed:', error)
      toast.error('Senden fehlgeschlagen — Netzwerkfehler')
    } finally {
      setIsSending(false)
    }
  }

  // Mark as sent (just update status, no actual sending)
  const handleMarkAsSent = async () => {
    if (!selectedEmail) return

    setIsSending(true)
    try {
      const response = await fetch(`/api/emails/${selectedEmail.id}/mark-sent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          editedResponse: editedResponse || undefined,
        }),
      })

      if (response.ok) {
        if (selectedEmail) releaseLock(selectedEmail.id)
        setIsDetailOpen(false)
        fetchEmails()
      }
    } catch (error) {
      console.error('Mark as sent failed:', error)
    } finally {
      setIsSending(false)
    }
  }

  // Save current draft to Knowledge Base
  const handleSaveToKb = async () => {
    if (!selectedEmail || !currentDraft) return
    setIsSavingToKb(true)
    try {
      const text = isEditing ? editedResponse : (currentDraft.edited_response || currentDraft.ai_generated_response)
      const res = await fetch('/api/knowledge/from-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedEmail.subject,
          content: text,
          emailId: selectedEmail.id,
        }),
      })
      const data = await res.json()
      if (res.status === 409) {
        toast.warning('Bereits in der KB vorhanden.')
      } else if (res.ok) {
        toast.success('In Knowledge Base gespeichert!')
      } else {
        toast.error(data.error || 'Fehler beim Speichern.')
      }
    } catch {
      toast.error('Fehler beim Speichern.')
    } finally {
      setIsSavingToKb(false)
    }
  }

  // Save edited draft
  const handleSaveDraft = async () => {
    if (!selectedEmail) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/emails/${selectedEmail.id}/mark-sent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editedResponse }),
      })

      if (response.ok) {
        // Update local state so preview shows saved text
        setSelectedEmail((prev) => {
          if (!prev) return prev
          const updatedDrafts = prev.email_drafts?.map((d) => ({
            ...d,
            edited_response: editedResponse,
          }))
          return { ...prev, email_drafts: updatedDrafts }
        })
        toast.success('Gespeichert!')
      } else {
        toast.error('Speichern fehlgeschlagen – bitte erneut versuchen')
      }
    } catch (error) {
      console.error('Save draft failed:', error)
      toast.error('Netzwerkfehler – bitte erneut versuchen')
    } finally {
      setIsSaving(false)
    }
  }

  // Close/dismiss email - uses confirmation dialog
  const handleDismissEmail = (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDismissEmailId(emailId)
  }

  // Open email detail
  const openEmailDetail = (email: Email) => {
    setSelectedEmail(email)
    setIsDetailOpen(true)
    setIsEditing(false)
    setIsManualMode(false)
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
    setNotes([])
    setNotesExpanded(false)
    setNewNoteContent('')
    setNotesError('')
    fetchNotes(email.id)
    // Fetch thread siblings if this email has a thread ID
    setThreadEmails([])
    setExpandedThreadIds(new Set())
    if (email.hubspot_thread_id) {
      fetch(`/api/emails/thread/${encodeURIComponent(email.hubspot_thread_id)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return
          const siblings = (data.emails || []).filter((e: Email) => e.id !== email.id)
          siblings.sort((a: Email, b: Email) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime())
          setThreadEmails(siblings)
        })
        .catch(() => {})
    }
  }

  const filteredEmails = useMemo(() => emails.filter((email) => {
    // Hide snoozed emails
    if (email.snoozed_until && new Date(email.snoozed_until) > new Date()) return false
    // Hide sent/closed emails if toggle is on
    if (hideSent && email.status === 'sent') return false
    // Hide system/transactional emails if toggle is on
    if (hideSystemMails && (email.email_type === 'system_alert' || email.email_type === 'notification' || (email.email_type === 'form_submission' && !email.needs_response))) {
      return false
    }
    // Filter by assigned agent
    if (assignedAgentFilter !== 'all') {
      if (assignedAgentFilter === 'unassigned') {
        if (email.assigned_agent_id) return false
      } else {
        if (email.assigned_agent_id !== assignedAgentFilter) return false
      }
    }
    // Filter by tag
    if (tagFilter && !(email.tags || []).includes(tagFilter)) return false
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
  }), [emails, hideSent, hideSystemMails, assignedAgentFilter, tagFilter, filter, searchQuery])

  // Sort
  const sortedEmails = useMemo(() => [...filteredEmails].sort((a, b) => {
    let cmp = 0
    switch (sortBy) {
      case 'date':
        cmp = new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
        break
      case 'confidence':
        cmp = (a.email_drafts?.[0]?.confidence_score || 0) - (b.email_drafts?.[0]?.confidence_score || 0)
        break
      case 'status':
        cmp = a.status.localeCompare(b.status)
        break
      case 'sender':
        cmp = (a.from_name || a.from_email).localeCompare(b.from_name || b.from_email)
        break
    }
    return sortDir === 'desc' ? -cmp : cmp
  }), [filteredEmails, sortBy, sortDir])

  // Pagination
  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedEmails.length / PAGE_SIZE)), [sortedEmails.length])
  const paginatedEmails = useMemo(() => sortedEmails.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sortedEmails, page])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [filter, searchQuery, hideSent, hideSystemMails, sortBy, sortDir, assignedAgentFilter, tagFilter])

  // Bulk action handlers
  const toggleSelect = (emailId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(emailId)) next.delete(emailId)
      else next.add(emailId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedEmails.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedEmails.map(e => e.id)))
    }
  }

  const handleBulkClose = async () => {
    setIsBulkActioning(true)
    const results = await Promise.allSettled(
      Array.from(selectedIds).map(id =>
        fetch(`/api/emails/${id}/mark-sent`, { method: 'POST' }).then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r
        })
      )
    )
    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - succeeded
    if (failed > 0) {
      toast.error(`${failed} E-Mail(s) konnten nicht geschlossen werden`)
    }
    if (succeeded > 0) {
      toast.success(`${succeeded} E-Mail(s) geschlossen`)
    }
    setSelectedIds(new Set())
    setIsBulkActioning(false)
    fetchEmails()
  }

  // Dismiss email with confirmation
  const handleDismissConfirmed = async () => {
    if (!dismissEmailId) return
    try {
      const response = await fetch(`/api/emails/${dismissEmailId}/mark-sent`, {
        method: 'POST',
      })
      if (response.ok) {
        toast.success('E-Mail geschlossen')
        fetchEmails()
      }
    } catch (error) {
      console.error('Dismiss email failed:', error)
      toast.error('E-Mail konnte nicht geschlossen werden')
    }
    setDismissEmailId(null)
  }

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
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Suchen..."
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
        <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-background" title="E-Mails nach Konversations-Threads gruppieren">
          <Switch
            id="thread-view"
            checked={threadView}
            onCheckedChange={setThreadView}
          />
          <Label htmlFor="thread-view" className="text-sm cursor-pointer flex items-center gap-1.5">
            Thread-Ansicht
          </Label>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`flex items-center gap-2 px-3 py-2 border rounded-md ${autoDraftEnabled ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800' : 'bg-background'}`}>
                <Switch
                  id="auto-draft"
                  checked={autoDraftEnabled}
                  onCheckedChange={handleAutoDraftChange}
                  className="data-[state=checked]:bg-amber-500"
                />
                <Label htmlFor="auto-draft" className="text-sm cursor-pointer flex items-center gap-1.5">
                  <Sparkles className={`h-3.5 w-3.5 ${autoDraftEnabled ? 'text-amber-500' : ''}`} />
                  Auto-Draft
                </Label>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{autoDraftEnabled ? 'Drafts werden automatisch generiert (API Credits)' : 'Drafts manuell generieren (spart Credits)'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleSync}
          disabled={isSyncing}
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Sync...' : 'HubSpot Sync'}
        </Button>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleReclassify}
          disabled={isClassifying}
          title="E-Mails ohne Klassifikation werden automatisch analysiert"
        >
          {isClassifying ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Klassifiziere…</>
          ) : (
            <><Bot className="h-4 w-4" />Neu klassifizieren</>
          )}
        </Button>
        <Select value={assignedAgentFilter} onValueChange={setAssignedAgentFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <UserCircle className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Zugewiesen an" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Agenten</SelectItem>
            <SelectItem value="unassigned">Nicht zugewiesen</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* Tag Filter */}
        {(() => {
          const allTags = Array.from(new Set(emails.flatMap(e => e.tags || [])))
          return allTags.length > 0 ? (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Tag-Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Alle Tags</SelectItem>
                {allTags.sort().map(tag => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null
        })()}
        {/* Saved Views */}
        <div className="flex items-center gap-1">
          {savedViews.length > 0 && (
            <Select onValueChange={(viewId) => {
              const view = savedViews.find(v => v.id === viewId)
              if (view) handleLoadView(view)
            }}>
              <SelectTrigger className="w-full sm:w-40">
                <Bookmark className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Ansichten" />
              </SelectTrigger>
              <SelectContent>
                {savedViews.map((view) => (
                  <div key={view.id} className="flex items-center justify-between">
                    <SelectItem value={view.id}>{view.name}</SelectItem>
                  </div>
                ))}
              </SelectContent>
            </Select>
          )}
          {showSaveViewInput ? (
            <div className="flex items-center gap-1">
              <Input
                value={newViewName}
                onChange={(e) => setNewViewName(e.target.value)}
                placeholder="Name..."
                className="h-9 w-32"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveView() }}
                autoFocus
              />
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handleSaveView}>
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => { setShowSaveViewInput(false); setNewViewName('') }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 p-0" onClick={() => setShowSaveViewInput(true)}>
                    <Save className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Aktuelle Filter als Ansicht speichern</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {savedViews.length > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => {
                    setSavedViews([])
                    localStorage.removeItem('palai_saved_views')
                    toast.success('Alle Ansichten gelöscht')
                  }}>
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Alle Ansichten löschen</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Sort Controls + Email Count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Datum</SelectItem>
              <SelectItem value="confidence">Confidence</SelectItem>
              <SelectItem value="status">Status</SelectItem>
              <SelectItem value="sender">Absender</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            title={sortDir === 'desc' ? 'Absteigend sortiert' : 'Aufsteigend sortiert'}
          >
            {sortDir === 'desc' ? '↓ Absteigend' : '↑ Aufsteigend'}
          </Button>
        </div>
        <span className="text-xs text-slate-500">
          {sortedEmails.length} E-Mail{sortedEmails.length !== 1 ? 's' : ''}
          {sortedEmails.length !== filteredEmails.length && ` (${filteredEmails.length} total)`}
        </span>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 sticky top-0 z-10">
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            {selectedIds.size} ausgewählt
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={handleBulkClose}
            disabled={isBulkActioning}
          >
            {isBulkActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
            Schliessen
          </Button>
          <div className="flex-1" />
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setSelectedIds(new Set())}
          >
            Auswahl aufheben
          </Button>
        </div>
      )}

      {/* Error Message */}
      {fetchError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm font-medium">Fehler beim Laden der E-Mails</p>
          </div>
          <p className="text-xs text-red-600 dark:text-red-500 mt-1 ml-6">{fetchError}</p>
          <button
            onClick={() => fetchEmails()}
            className="mt-2 ml-6 text-xs text-red-700 dark:text-red-400 underline hover:no-underline"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {/* Email List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : fetchError ? (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 mx-auto text-red-300 dark:text-red-600 mb-4" />
          <p className="text-slate-500 dark:text-slate-400">
            E-Mails konnten nicht geladen werden
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Bitte prüfe die Serververbindung und Umgebungsvariablen
          </p>
        </div>
      ) : sortedEmails.length === 0 ? (
        <div className="text-center py-12">
          <Mail className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-slate-500 dark:text-slate-400">
            Keine E-Mails gefunden
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Klicke auf &quot;HubSpot Sync&quot; um E-Mails zu importieren
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Thread grouping header when thread view is enabled */}
          {threadView && (() => {
            const threadGroups = new Map<string, Email[]>()
            const noThread: Email[] = []
            for (const email of paginatedEmails) {
              if (email.hubspot_thread_id) {
                const existing = threadGroups.get(email.hubspot_thread_id) || []
                existing.push(email)
                threadGroups.set(email.hubspot_thread_id, existing)
              } else {
                noThread.push(email)
              }
            }
            const threads = [...threadGroups.entries()]
              .filter(([, emails]) => emails.length > 1)
              .sort(([, a], [, b]) => new Date(b[0].received_at).getTime() - new Date(a[0].received_at).getTime())
            if (threads.length > 0) {
              return (
                <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded px-3 py-1.5">
                  {threads.length} Threads erkannt ({filteredEmails.length - noThread.length} E-Mails gruppiert)
                </div>
              )
            }
            return null
          })()}
          {/* Select All */}
          <div className="flex items-center gap-2 px-1">
            <button
              onClick={toggleSelectAll}
              className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {selectedIds.size === paginatedEmails.length && paginatedEmails.length > 0 ? (
                <CheckSquare className="h-4 w-4 text-blue-600" />
              ) : (
                <Square className="h-4 w-4 text-slate-400" />
              )}
            </button>
            <span className="text-xs text-slate-500">Alle auf dieser Seite</span>
          </div>
          {paginatedEmails.map((email) => {
            const draft = email.email_drafts?.[0]
            const emailConfidence = draft?.confidence_score || 0

            // In thread view, show thread indicator
            const threadCount = threadView && email.hubspot_thread_id
              ? paginatedEmails.filter(e => e.hubspot_thread_id === email.hubspot_thread_id).length
              : 0

            return (
              <Card
                key={email.id}
                className={`hover:shadow-md transition-shadow cursor-pointer ${selectedIds.has(email.id) ? 'ring-2 ring-blue-400' : ''}`}
                onClick={() => openEmailDetail(email)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Bulk Checkbox */}
                    <button
                      onClick={(e) => toggleSelect(email.id, e)}
                      className="mt-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0"
                    >
                      {selectedIds.has(email.id) ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
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
                          {email.assigned_agent_id && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-medium flex-shrink-0">
                                    {getAgentInitials(email.assigned_agent_id)}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{getAgentNameById(email.assigned_agent_id)}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {email.support_level === 'L2' && (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs">Eskaliert</Badge>
                          )}
                          {getBuyingIntentBadge(email.buying_intent_score)}
                          {getEmailTypeBadge(email.email_type, email.needs_response)}
                          {getStatusBadge(email.status)}
                          {threadCount > 1 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-slate-300 dark:border-slate-600">
                              {threadCount} in Thread
                            </Badge>
                          )}
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatRelativeDate(email.received_at)}
                          </span>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => handleDismissEmail(email.id, e)}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Schliessen (ohne Antwort)</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>

                      {(email.tags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {email.tags!.map(tag => (
                            <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                Seite {page} von {totalPages} — {sortedEmails.length} E-Mails
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                >
                  <ChevronsLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={page === totalPages}
                  onClick={() => setPage(totalPages)}
                >
                  <ChevronsRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dismiss Confirmation Dialog */}
      <AlertDialog open={!!dismissEmailId} onOpenChange={(open) => { if (!open) setDismissEmailId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>E-Mail schliessen?</AlertDialogTitle>
            <AlertDialogDescription>
              Diese E-Mail wird als erledigt markiert. Du kannst sie jederzeit über den Filter &quot;Gesendet&quot; wieder anzeigen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDismissConfirmed}>Schliessen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email Detail Modal */}
      <Dialog open={isDetailOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-0">
          {/* Hidden DialogHeader for accessibility — visually replaced below */}
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedEmail?.subject}</DialogTitle>
          </DialogHeader>

          {selectedEmail && (
            <div className="flex flex-col">
              {/* Alerts — sticky at top */}
              {(lockWarning || selectedEmail.support_level === 'L2') && (
                <div className="px-6 pt-5 space-y-2">
                  {/* Conflict warning */}
                  {lockWarning && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>
                        <strong>{lockWarning.locked_by}</strong> bearbeitet diese E-Mail gerade seit{' '}
                        {new Date(lockWarning.locked_at).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button onClick={() => setLockWarning(null)} className="ml-auto flex-shrink-0">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Escalation Banner */}
                  {selectedEmail.support_level === 'L2' && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <span>Diese E-Mail wurde zu <strong>Level 2</strong> eskaliert und erfordert manuelle Bearbeitung.</span>
                    </div>
                  )}
                </div>
              )}

              {/* Subject heading — prominent, Gmail-style */}
              <div className="px-6 pt-5 pb-3">
                <h2 className="text-2xl font-normal text-slate-900 dark:text-slate-100 leading-snug">
                  {selectedEmail.subject}
                </h2>
              </div>

              {/* Sender row — Gmail style with avatar */}
              <div className="flex items-start gap-3 px-6 pb-5">
                {/* Avatar circle with initials — color derived from sender name */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{
                    backgroundColor: (() => {
                      const name = selectedEmail.from_name || selectedEmail.from_email || '?'
                      const colors = ['#1b73e8', '#d93025', '#188038', '#e37400', '#a142f4', '#007b83', '#c5221f', '#1967d2']
                      let hash = 0
                      for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
                      return colors[Math.abs(hash) % colors.length]
                    })()
                  }}
                >
                  {(selectedEmail.from_name || selectedEmail.from_email || '?')
                    .split(/[\s@]+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(w => w[0]?.toUpperCase())
                    .join('')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selectedEmail.from_name || selectedEmail.from_email}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                      {new Date(selectedEmail.received_at).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  {selectedEmail.from_name && (
                    <p className="text-xs text-slate-500 dark:text-slate-500 truncate mt-0.5">
                      {selectedEmail.from_email}
                    </p>
                  )}
                </div>
              </div>

              {/* Thin separator */}
              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* Email Body — clean, spacious, no label */}
              <div className="px-6 py-6 pl-[4.25rem]">
                {selectedEmail.body_html ? (
                  <iframe
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:'Google Sans',Roboto,system-ui,-apple-system,sans-serif;font-size:14px;color:#202124;line-height:1.75;margin:0;padding:0;word-wrap:break-word;overflow-wrap:break-word;}a{color:#1a73e8;}blockquote{border-left:3px solid #dadce0;margin:8px 0;padding-left:12px;color:#5f6368;}img{max-width:100%;height:auto;}p{margin:0 0 12px 0;}</style></head><body>${selectedEmail.body_html}</body></html>`}
                    className="w-full border-0 min-h-[120px]"
                    style={{ minHeight: '120px' }}
                    onLoad={(e) => {
                      const iframe = e.currentTarget
                      if (iframe.contentDocument?.body) {
                        iframe.style.height = Math.min(iframe.contentDocument.body.scrollHeight + 16, 600) + 'px'
                      }
                    }}
                    sandbox="allow-same-origin"
                    title="Email content"
                  />
                ) : selectedEmail.body_text ? (
                  <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {selectedEmail.body_text}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Kein Inhalt verfügbar</p>
                )}
              </div>

              {/* Thin separator */}
              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* Metadata toolbar — compact horizontal bar */}
              <div className="px-6 py-3 flex items-center gap-4 flex-wrap text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
                {/* Agent Assignment */}
                <div className="flex items-center gap-1.5">
                  <UserCircle className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <Select
                    value={selectedEmail.assigned_agent_id || 'none'}
                    onValueChange={(value) => handleAssignAgent(selectedEmail.id, value === 'none' ? '' : value)}
                  >
                    <SelectTrigger className="w-36 h-7 text-xs border-none shadow-none bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700 px-1.5">
                      <SelectValue placeholder="Nicht zugewiesen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nicht zugewiesen</SelectItem>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

                {/* Tags */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Bookmark className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  {(selectedEmail.tags || []).map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(selectedEmail.id, tag)}
                        className="hover:text-indigo-900 dark:hover:text-indigo-200"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <form
                    onSubmit={(e) => { e.preventDefault(); handleAddTag(selectedEmail.id, tagInput) }}
                    className="inline-flex"
                  >
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="+ Tag"
                      className="h-6 w-20 text-xs px-1.5 border-none shadow-none bg-transparent placeholder:text-slate-400"
                    />
                  </form>
                </div>

                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

                {/* Snooze */}
                <div className="flex items-center gap-1.5">
                  <EyeOff className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  {[
                    { label: '1h', hours: 1 },
                    { label: '4h', hours: 4 },
                    { label: 'Morgen', hours: 20 },
                    { label: '1 Woche', hours: 168 },
                  ].map(opt => (
                    <Button
                      key={opt.label}
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 px-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      onClick={() => handleSnooze(selectedEmail.id, opt.hours)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Thread History — Outlook-style conversation view */}
              {threadEmails.length > 0 && (
                <div className="space-y-2 px-6 py-4">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide px-1">
                    Gesprächsverlauf ({threadEmails.length} weitere Nachrichten)
                  </p>
                  {threadEmails.map((tEmail) => {
                    const isExpanded = expandedThreadIds.has(tEmail.id)
                    return (
                      <div key={tEmail.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        {/* Collapsed header — click to expand */}
                        <button
                          className="w-full px-4 py-2.5 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                          onClick={() => setExpandedThreadIds(prev => {
                            const next = new Set(prev)
                            next.has(tEmail.id) ? next.delete(tEmail.id) : next.add(tEmail.id)
                            return next
                          })}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`text-xs font-medium ${tEmail.status === 'sent' ? 'text-green-600' : 'text-blue-600'}`}>
                              {tEmail.status === 'sent' ? '↩ Antwort' : '→ Eingang'}
                            </span>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                              {tEmail.from_name || tEmail.from_email}
                            </span>
                            {!isExpanded && (
                              <span className="text-xs text-slate-400 truncate hidden sm:block">
                                {tEmail.body_text?.slice(0, 80) || '…'}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400 flex-shrink-0 ml-2">
                            {new Date(tEmail.received_at).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </button>
                        {/* Expanded body */}
                        {isExpanded && (
                          <div className="p-4 bg-white dark:bg-slate-900">
                            {tEmail.body_html ? (
                              <iframe
                                srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui,-apple-system,sans-serif;font-size:13px;color:#374151;line-height:1.6;margin:0;padding:0;word-wrap:break-word;}a{color:#2563eb;}blockquote{border-left:3px solid #e5e7eb;margin-left:0;padding-left:12px;color:#6b7280;}</style></head><body>${tEmail.body_html}</body></html>`}
                                className="w-full border-0"
                                style={{ minHeight: '80px' }}
                                onLoad={(e) => {
                                  const iframe = e.currentTarget
                                  if (iframe.contentDocument?.body) {
                                    iframe.style.height = Math.min(iframe.contentDocument.body.scrollHeight + 16, 400) + 'px'
                                  }
                                }}
                                sandbox="allow-same-origin"
                                title="Thread email content"
                              />
                            ) : (
                              <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {tEmail.body_text || <span className="italic text-slate-400">Kein Inhalt</span>}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* AI Draft */}
              {currentDraft ? (
                <div className="space-y-3 px-6 py-4">
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
                    <div className="space-y-2">
                      <Textarea
                        value={editedResponse}
                        onChange={(e) => setEditedResponse(e.target.value)}
                        rows={10}
                        className="font-mono text-sm"
                      />
                      <div className="flex justify-end">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs text-slate-500"
                                onClick={() => setEditedResponse(resolveTemplateVars(editedResponse))}
                              >
                                <Wand2 className="h-3 w-3" />
                                Variablen ersetzen
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{'Ersetzt {{name}}, {{email}}, {{kurs}}, {{datum}} etc.'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
                      <div className="text-sm whitespace-pre-wrap break-all max-w-full" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        {currentDraft.edited_response || currentDraft.ai_generated_response}
                      </div>
                    </div>
                  )}
                </div>
              ) : isManualMode ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Edit className="h-4 w-4 text-blue-500" />
                    <h4 className="font-medium">Manuelle Antwort</h4>
                  </div>
                  <Textarea
                    value={editedResponse}
                    onChange={(e) => setEditedResponse(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                    placeholder="Antwort hier eingeben..."
                    autoFocus
                  />
                  <div className="flex justify-end">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs text-slate-500"
                            onClick={() => setEditedResponse(resolveTemplateVars(editedResponse))}
                          >
                            <Wand2 className="h-3 w-3" />
                            Variablen ersetzen
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{'Ersetzt {{name}}, {{email}}, {{kurs}}, {{datum}} etc.'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 px-6">
                  <p className="text-slate-500 dark:text-slate-400 mb-4">
                    Noch keine Antwort verfasst
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button
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
                          AI Vorschlag
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsManualMode(true)
                        setEditedResponse('')
                      }}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Manuell antworten
                    </Button>
                  </div>
                </div>
              )}

              {/* Interne Notizen */}
              <div className="border rounded-lg mx-6 mb-4">
                <button
                  className="flex items-center gap-2 w-full p-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
                  onClick={() => setNotesExpanded(!notesExpanded)}
                >
                  {notesExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <StickyNote className="h-4 w-4" />
                  Interne Notizen
                  {notes.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{notes.length}</Badge>
                  )}
                </button>
                {notesExpanded && (
                  <div className="px-3 pb-3 space-y-3">
                    {notesError && (
                      <p className="text-xs text-amber-600">{notesError}</p>
                    )}
                    {notes.length === 0 && !notesError && (
                      <p className="text-xs text-slate-400">Noch keine Notizen vorhanden.</p>
                    )}
                    {notes.map((note) => (
                      <div key={note.id} className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{note.agent_name}</span>
                            <span className="text-xs text-slate-400">{new Date(note.created_at).toLocaleString('de-CH')}</span>
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">{note.content}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1 rounded hover:bg-yellow-100 dark:hover:bg-yellow-900/40 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Textarea
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Notiz hinzufügen..."
                        rows={2}
                        className="text-sm flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="self-end"
                        onClick={handleAddNote}
                        disabled={isAddingNote || !newNoteContent.trim()}
                      >
                        {isAddingNote ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          'Notiz hinzufügen'
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(currentDraft || isManualMode) && (
            <DialogFooter className="flex-col sm:flex-row gap-3 px-6 pb-5 pt-2">
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

              <div className="flex gap-2 w-full sm:w-auto justify-end flex-wrap items-center">
                <Button variant="outline" onClick={handleClose}>
                  Schliessen
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleSaveToKb}
                        disabled={isSavingToKb}
                      >
                        {isSavingToKb ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <BookOpen className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Antwort in die Knowledge Base speichern</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {(isEditing || isManualMode) && (
                  <Button
                    variant="outline"
                    className="border-blue-300 text-blue-600 hover:bg-blue-50"
                    onClick={handleSaveDraft}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Speichern
                  </Button>
                )}
                {currentDraft && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (isEditing) {
                        handleSaveDraft()
                      } else {
                        setEditedResponse(
                          currentDraft.edited_response || currentDraft.ai_generated_response
                        )
                      }
                      setIsEditing(!isEditing)
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {isEditing ? 'Vorschau' : 'Bearbeiten'}
                  </Button>
                )}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={handleMarkAsSent}
                        disabled={isSending}
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Nur als gesendet markieren (kein echtes Senden)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleSend}
                  disabled={isSending || (isManualMode && !editedResponse.trim())}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sende...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Senden
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

export default function InboxPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    }>
      <InboxPageContent />
    </Suspense>
  )
}
