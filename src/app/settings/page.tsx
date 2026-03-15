'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  User,
  Mail,
  Key,
  Database,
  Shield,
  Save,
  Plus,
  Trash2,
  Loader2,
  ShoppingCart,
  AlertOctagon,
  UserMinus,
  Clock,
  Brain,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  Circle,
  Zap,
  TrendingUp,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  MessageSquare,
  BarChart3,
  Inbox,
  Workflow,
  ScrollText,
  Bell,
  Volume2,
} from 'lucide-react'
import { AutomationTab } from '@/components/settings/automation-tab'
import { AuditTrailTab } from '@/components/settings/audit-trail-tab'
import { BusinessHoursTab } from '@/components/settings/business-hours-tab'
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

// ─── Types ───────────────────────────────────────────────────────────────────

interface TriggerWord {
  id: string
  word: string
  category: string
  weight: number
  is_active: boolean
}

interface SlaTarget {
  id: string
  name: string
  priority: string
  first_response_minutes: number
  resolution_minutes: number
}

interface Agent {
  id: string
  name: string
  email: string
  role: string
  specializations: string[]
  is_active: boolean
  max_open_tickets: number
}

interface AiInstruction {
  title: string
  content: string
  ids: string[]
  created_at: string
}

interface TrainingStats {
  email_training_count: number
  ai_instructions_count: number
}

interface BulkResult {
  success: boolean
  total_emails: number
  threads: number
  extracted: number
  skipped: number
  errors: string[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  buying_signal: { label: 'Kaufsignal', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: ShoppingCart },
  objection: { label: 'Einwand', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertOctagon },
  churn_risk: { label: 'Churn-Risiko', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: UserMinus },
}

const fmtMins = (m: number) =>
  m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`

// ─── Tiny save-feedback hook ──────────────────────────────────────────────────

function useSaveFeedback() {
  const [saved, setSaved] = useState<string | null>(null)
  const showSaved = (key: string) => {
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }
  return { saved, showSaved }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { saved: savedKey, showSaved } = useSaveFeedback()

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null)

  // Unsaved changes warning
  const [isDirty, setIsDirty] = useState(false)
  const [activeTab, setActiveTab] = useState('profile')
  const [pendingTab, setPendingTab] = useState<string | null>(null)

  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  const handleTabChange = (newTab: string) => {
    if (isDirty) {
      setPendingTab(newTab)
    } else {
      setActiveTab(newTab)
    }
  }

  // Fetch data when tab changes
  useEffect(() => {
    const tabFetchers: Record<string, () => void> = {
      'ai-instructions': fetchInstructions,
      'ai-style': fetchLearningConfig,
      'sla': fetchSlaTargets,
      'bi': fetchTriggerWords,
      'team': fetchAgents,
      'training': fetchTrainingStats,
      'integrations': fetchIntegrationStatus,
    }
    tabFetchers[activeTab]?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // ── Profil ──────────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', signature: '' })
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('palai_profile')
    setProfile(
      stored
        ? JSON.parse(stored)
        : {
            firstName: 'Sandro',
            lastName: 'Palacios',
            email: 'sandro@palacios-institut.ch',
            signature: 'Herzliche Grüsse\nSandro Palacios\nPalacios Institut',
          }
    )
    setProfileLoaded(true)
  }, [])

  const handleSaveProfile = () => {
    localStorage.setItem('palai_profile', JSON.stringify(profile))
    showSaved('profile')
    setIsDirty(false)
  }

  const handleProfileChange = (field: string, value: string) => {
    setProfile(p => ({ ...p, [field]: value }))
    setIsDirty(true)
  }

  // ── AI Instructions ─────────────────────────────────────────────────────────
  const [instructions, setInstructions] = useState<AiInstruction[]>([])
  const [instrLoading, setInstrLoading] = useState(false)
  const [newInstrTitle, setNewInstrTitle] = useState('')
  const [newInstrContent, setNewInstrContent] = useState('')
  const [addingInstr, setAddingInstr] = useState(false)
  const [deletingInstr, setDeletingInstr] = useState<string | null>(null)

  const fetchInstructions = async () => {
    setInstrLoading(true)
    try {
      const res = await fetch('/api/settings/ai-instructions')
      if (res.ok) {
        const data = await res.json()
        setInstructions(data.instructions || [])
      }
    } catch (err) {
      console.error('Failed to fetch instructions:', err)
    } finally {
      setInstrLoading(false)
    }
  }

  const handleAddInstruction = async () => {
    if (!newInstrTitle.trim() || !newInstrContent.trim()) return
    setAddingInstr(true)
    try {
      const res = await fetch('/api/settings/ai-instructions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newInstrTitle, content: newInstrContent }),
      })
      if (res.ok) {
        setNewInstrTitle('')
        setNewInstrContent('')
        fetchInstructions()
        showSaved('instruction')
      }
    } finally {
      setAddingInstr(false)
    }
  }

  const handleDeleteInstruction = (title: string) => {
    setConfirmAction({
      title: 'AI-Instruktion löschen?',
      description: `"${title}" wird unwiderruflich gelöscht.`,
      onConfirm: async () => {
        setDeletingInstr(title)
        try {
          const res = await fetch('/api/settings/ai-instructions', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title }),
          })
          if (!res.ok) throw new Error('Delete failed')
          fetchInstructions()
          toast.success('Instruktion gelöscht')
        } catch {
          toast.error('Instruktion konnte nicht gelöscht werden.')
        } finally {
          setDeletingInstr(null)
        }
      },
    })
  }

  // ── AI Settings (localStorage) ───────────────────────────────────────────────
  const [aiSettings, setAiSettings] = useState({
    tonality: 'friendly',
    language: 'de-ch',
    confidenceGreen: 85,
    confidenceYellow: 70,
  })

  useEffect(() => {
    const stored = localStorage.getItem('palai_ai_settings')
    if (stored) setAiSettings(JSON.parse(stored))
  }, [])

  const updateAiSettings = (patch: Partial<typeof aiSettings>) => {
    const next = { ...aiSettings, ...patch }
    setAiSettings(next)
    localStorage.setItem('palai_ai_settings', JSON.stringify(next))
    showSaved('ai')
  }

  // ── Learning Config (app_config API) ────────────────────────────────────────
  const [learningConfig, setLearningConfig] = useState({
    minEditDistance: 0.10,
    learningEnabled: true,
    autoExtractDays: 90,
    ragMatchThreshold: 0.5,
  })
  const [learningConfigLoading, setLearningConfigLoading] = useState(false)
  const [learningConfigSaving, setLearningConfigSaving] = useState(false)

  const fetchLearningConfig = async () => {
    setLearningConfigLoading(true)
    try {
      const res = await fetch('/api/settings/config')
      if (res.ok) {
        const data = await res.json()
        const c = data.config || {}
        setLearningConfig({
          minEditDistance: parseFloat(c.learning_min_edit_distance ?? '0.10'),
          learningEnabled: (c.auto_extract_enabled ?? 'true') === 'true',
          autoExtractDays: parseInt(c.auto_extract_days ?? '90'),
          ragMatchThreshold: parseFloat(c.rag_match_threshold ?? '0.5'),
        })
      }
    } catch {
      // App_config table may not exist yet — keep defaults
    } finally {
      setLearningConfigLoading(false)
    }
  }

  const saveLearningConfig = async () => {
    setLearningConfigSaving(true)
    try {
      await fetch('/api/settings/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            learning_min_edit_distance: String(learningConfig.minEditDistance),
            auto_extract_enabled: String(learningConfig.learningEnabled),
            auto_extract_days: String(learningConfig.autoExtractDays),
            rag_match_threshold: String(learningConfig.ragMatchThreshold),
          },
        }),
      })
      showSaved('learning')
    } finally {
      setLearningConfigSaving(false)
    }
  }

  const updateLearning = (patch: Partial<typeof learningConfig>) => {
    setLearningConfig(prev => ({ ...prev, ...patch }))
  }

  // ── Integration Status ──────────────────────────────────────────────────────
  const [integrationStatus, setIntegrationStatus] = useState({ hubspot: false, openai: false, supabase: false })

  const fetchIntegrationStatus = async () => {
    try {
      const res = await fetch('/api/settings/status')
      if (res.ok) {
        setIntegrationStatus(await res.json())
      }
    } catch {
      // keep defaults (all false)
    }
  }

  // ── SLA ─────────────────────────────────────────────────────────────────────
  const [slaTargets, setSlaTargets] = useState<SlaTarget[]>([])
  const [slaLoading, setSlaLoading] = useState(false)
  const [slaSaving, setSlaSaving] = useState<string | null>(null)
  const [slaEdits, setSlaEdits] = useState<Record<string, { first: number; resolution: number }>>({})

  const fetchSlaTargets = async () => {
    setSlaLoading(true)
    try {
      const res = await fetch('/api/settings/sla')
      if (res.ok) {
        const data = await res.json()
        const targets: SlaTarget[] = data.targets || []
        setSlaTargets(targets)
        const edits: Record<string, { first: number; resolution: number }> = {}
        targets.forEach((t) => { edits[t.id] = { first: t.first_response_minutes, resolution: t.resolution_minutes } })
        setSlaEdits(edits)
      }
    } catch (err) {
      console.error('Failed to fetch SLA targets:', err)
    } finally {
      setSlaLoading(false)
    }
  }

  const handleSaveSla = async (id: string) => {
    const edit = slaEdits[id]
    if (!edit) return
    setSlaSaving(id)
    try {
      await fetch('/api/settings/sla', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, first_response_minutes: edit.first, resolution_minutes: edit.resolution }),
      })
      fetchSlaTargets()
      showSaved(`sla-${id}`)
    } finally {
      setSlaSaving(null)
    }
  }

  // ── Trigger Words ────────────────────────────────────────────────────────────
  const [triggerWords, setTriggerWords] = useState<TriggerWord[]>([])
  const [twLoading, setTwLoading] = useState(false)
  const [newWord, setNewWord] = useState('')
  const [newCategory, setNewCategory] = useState('buying_signal')
  const [addingWord, setAddingWord] = useState(false)

  const fetchTriggerWords = async () => {
    setTwLoading(true)
    try {
      const res = await fetch('/api/settings/trigger-words')
      const data = await res.json()
      setTriggerWords(data.words || [])
    } finally {
      setTwLoading(false)
    }
  }

  const handleAddWord = async () => {
    if (!newWord.trim()) return
    setAddingWord(true)
    try {
      const res = await fetch('/api/settings/trigger-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newWord, category: newCategory, weight: 1.0 }),
      })
      if (res.ok) { setNewWord(''); fetchTriggerWords() }
    } finally {
      setAddingWord(false)
    }
  }

  const handleDeleteWord = (id: string) => {
    setConfirmAction({
      title: 'Trigger-Wort löschen?',
      description: 'Das Trigger-Wort wird unwiderruflich gelöscht.',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/settings/trigger-words/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Delete failed')
          fetchTriggerWords()
          toast.success('Trigger-Wort gelöscht')
        } catch {
          toast.error('Trigger-Wort konnte nicht gelöscht werden.')
        }
      },
    })
  }

  const handleToggleWord = async (id: string, is_active: boolean) => {
    await fetch(`/api/settings/trigger-words/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    })
    fetchTriggerWords()
  }

  const groupedWords = triggerWords.reduce<Record<string, TriggerWord[]>>((acc, w) => {
    if (!acc[w.category]) acc[w.category] = []
    acc[w.category].push(w)
    return acc
  }, {})

  // ── Agents ───────────────────────────────────────────────────────────────────
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentEmail, setNewAgentEmail] = useState('')
  const [newAgentRole, setNewAgentRole] = useState('L1')
  const [addingAgent, setAddingAgent] = useState(false)

  const fetchAgents = async () => {
    setAgentsLoading(true)
    try {
      const res = await fetch('/api/agents')
      const data = await res.json()
      setAgents(data.agents || [])
    } finally {
      setAgentsLoading(false)
    }
  }

  const handleAddAgent = async () => {
    if (!newAgentName || !newAgentEmail) return
    setAddingAgent(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAgentName, email: newAgentEmail, role: newAgentRole }),
      })
      if (res.ok) { setNewAgentName(''); setNewAgentEmail(''); fetchAgents() }
    } finally {
      setAddingAgent(false)
    }
  }

  const handleDeactivateAgent = async (id: string) => {
    await fetch('/api/agents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: false }),
    })
    fetchAgents()
  }

  // ── Training (HubSpot Bulk Import) ───────────────────────────────────────────
  const [trainingStats, setTrainingStats] = useState<TrainingStats | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
  const [bulkError, setBulkError] = useState<string | null>(null)

  const fetchTrainingStats = async () => {
    try {
      const res = await fetch('/api/training/hubspot-bulk')
      const data = await res.json()
      setTrainingStats(data)
    } catch {
      // ignore
    }
  }

  // ── Insights Backfill (CSAT, Learning Cases, KB from sent emails) ─────────
  const [backfillRunning, setBackfillRunning] = useState(false)
  const [backfillResult, setBackfillResult] = useState<{ message: string; editDistanceCalculated: number; learningCasesCreated: number; csatRatingsCreated: number; knowledgeChunksCreated: number } | null>(null)
  const [backfillError, setBackfillError] = useState<string | null>(null)

  const handleBackfill = async () => {
    setBackfillRunning(true)
    setBackfillResult(null)
    setBackfillError(null)
    try {
      // Step 1: Classify + Tone + BI scan for unanalyzed emails
      await fetch('/api/emails', { method: 'PATCH' })
      // Step 2: Learning cases, CSAT, KB backfill
      const res = await fetch('/api/insights/backfill', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setBackfillError(data.error || 'Backfill fehlgeschlagen')
      } else {
        setBackfillResult(data)
        fetchTrainingStats()
      }
    } catch (e) {
      setBackfillError(String(e))
    } finally {
      setBackfillRunning(false)
    }
  }

  const handleBulkImport = async () => {
    setBulkRunning(true)
    setBulkResult(null)
    setBulkError(null)
    try {
      const res = await fetch('/api/training/hubspot-bulk', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setBulkError(data.error || 'Import fehlgeschlagen')
      } else {
        setBulkResult(data)
        fetchTrainingStats()
      }
    } catch (e) {
      setBulkError(String(e))
    } finally {
      setBulkRunning(false)
    }
  }

  // ── Historical HubSpot Import ────────────────────────────────────────────────
  const [histImportRunning, setHistImportRunning] = useState(false)
  const [showHistImportDialog, setShowHistImportDialog] = useState(false)
  const [histImportResult, setHistImportResult] = useState<{ imported: number; skipped: number; errors: number; message: string } | null>(null)
  const [histImportError, setHistImportError] = useState<string | null>(null)

  const handleHistoricalImport = async () => {
    setHistImportRunning(true)
    setHistImportResult(null)
    setHistImportError(null)
    try {
      const res = await fetch('/api/hubspot/historical-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daysBack: 365, maxEmails: 500 }),
      })
      const data = await res.json()
      if (!res.ok) {
        setHistImportError(data.error || 'Import fehlgeschlagen')
      } else {
        setHistImportResult(data)
      }
    } catch (e) {
      setHistImportError(String(e))
    } finally {
      setHistImportRunning(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <Header title="Einstellungen" description="Profil, AI, Learning und System-Konfiguration" />

      {/* Unsaved changes warning dialog */}
      <AlertDialog open={!!pendingTab} onOpenChange={(open) => !open && setPendingTab(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ungespeicherte Änderungen</AlertDialogTitle>
            <AlertDialogDescription>
              Du hast ungespeicherte Änderungen. Möchtest du wirklich den Tab wechseln? Deine Änderungen gehen verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setIsDirty(false)
              setActiveTab(pendingTab!)
              setPendingTab(null)
            }}>
              Verwerfen & wechseln
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="profile" className="gap-2"><User className="h-4 w-4" />Profil</TabsTrigger>
          <TabsTrigger value="ai-instructions" className="gap-2"><Brain className="h-4 w-4" />AI Anweisungen</TabsTrigger>
          <TabsTrigger value="ai-style" className="gap-2"><Zap className="h-4 w-4" />AI & Lernen</TabsTrigger>
          <TabsTrigger value="sla" className="gap-2"><Clock className="h-4 w-4" />SLA</TabsTrigger>
          <TabsTrigger value="bi" className="gap-2"><ShoppingCart className="h-4 w-4" />BI Trigger</TabsTrigger>
          <TabsTrigger value="team" className="gap-2"><Shield className="h-4 w-4" />Team</TabsTrigger>
          <TabsTrigger value="training" className="gap-2"><GraduationCap className="h-4 w-4" />Training</TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-2"><BookOpen className="h-4 w-4" />Onboarding</TabsTrigger>
          <TabsTrigger value="business-hours" className="gap-2"><Clock className="h-4 w-4" />Geschäftszeiten</TabsTrigger>
          <TabsTrigger value="automation" className="gap-2"><Workflow className="h-4 w-4" />Automatisierung</TabsTrigger>
          <TabsTrigger value="audit" className="gap-2"><ScrollText className="h-4 w-4" />Audit Trail</TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2"><Database className="h-4 w-4" />Integrationen</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />Benachrichtigungen</TabsTrigger>
        </TabsList>

        {/* ── PROFIL ─────────────────────────────────────────────────────────── */}
        <TabsContent value="profile" className="space-y-6">
          {profileLoaded && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Persönliche Informationen</CardTitle>
                  <CardDescription>Wird in E-Mail-Antworten und der Signatur verwendet</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Vorname</label>
                      <Input
                        value={profile.firstName}
                        onChange={(e) => handleProfileChange('firstName', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nachname</label>
                      <Input
                        value={profile.lastName}
                        onChange={(e) => handleProfileChange('lastName', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">E-Mail</label>
                    <Input
                      type="email"
                      value={profile.email}
                      onChange={(e) => handleProfileChange('email', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>E-Mail Signatur</CardTitle>
                  <CardDescription>Wird automatisch an AI-generierte Antworten angehängt</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={profile.signature}
                    onChange={(e) => handleProfileChange('signature', e.target.value)}
                    rows={5}
                    className="font-mono text-sm"
                  />
                  <Button onClick={handleSaveProfile} className="gap-2">
                    {savedKey === 'profile' ? (
                      <><CheckCircle2 className="h-4 w-4 text-green-400" />Gespeichert</>
                    ) : (
                      <><Save className="h-4 w-4" />Speichern</>
                    )}
                  </Button>
                  <p className="text-xs text-slate-400">Gespeichert im Browser (localStorage)</p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* ── AI ANWEISUNGEN ──────────────────────────────────────────────────── */}
        <TabsContent value="ai-instructions" className="space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1 flex items-center gap-2"><Brain className="h-4 w-4" />Was sind AI Anweisungen?</p>
            <p>Diese Regeln werden bei <strong>jedem</strong> AI-Entwurf automatisch berücksichtigt — unabhängig vom Thema. Ideal für feste Vorgaben wie Anrede, Stil, Do&apos;s und Don&apos;ts, Preise, USPs des Instituts.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Neue Anweisung hinzufügen</CardTitle>
              <CardDescription>Titel + Inhalt → wird als Embedding in der Knowledge Base gespeichert</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Titel, z.B. «Anrede und Tonalität»"
                value={newInstrTitle}
                onChange={(e) => setNewInstrTitle(e.target.value)}
              />
              <Textarea
                placeholder={`Inhalt der Anweisung, z.B.:\n- Immer mit «Herzliche Grüsse» abschliessen\n- Du-Form verwenden wenn Vorname bekannt\n- Nie Preise ohne Rückfrage nennen`}
                value={newInstrContent}
                onChange={(e) => setNewInstrContent(e.target.value)}
                rows={5}
                className="text-sm"
              />
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleAddInstruction}
                  disabled={addingInstr || !newInstrTitle.trim() || !newInstrContent.trim()}
                  className="gap-2"
                >
                  {addingInstr ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Anweisung speichern
                </Button>
                {savedKey === 'instruction' && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />Gespeichert
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aktive Anweisungen</CardTitle>
              <CardDescription>
                {instructions.length} Regel{instructions.length !== 1 ? 'n' : ''} — werden bei jedem Draft geladen
              </CardDescription>
            </CardHeader>
            <CardContent>
              {instrLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : instructions.length === 0 ? (
                <p className="text-center text-slate-400 py-6 text-sm">
                  Noch keine Anweisungen — oben hinzufügen
                </p>
              ) : (
                <div className="space-y-3">
                  {instructions.map((instr) => (
                    <div
                      key={instr.title}
                      className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-slate-900 dark:text-white">{instr.title}</p>
                          <p className="text-xs text-slate-500 mt-1 line-clamp-3 whitespace-pre-line">
                            {instr.content}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteInstruction(instr.title)}
                          disabled={deletingInstr === instr.title}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          {deletingInstr === instr.title ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── AI & LERNEN ─────────────────────────────────────────────────────── */}
        <TabsContent value="ai-style" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Antwort-Stil</CardTitle>
              <CardDescription>Grundeinstellungen für AI-generierte Antworten (im Browser gespeichert)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tonalität</label>
                  <Select
                    value={aiSettings.tonality}
                    onValueChange={(v) => updateAiSettings({ tonality: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formell</SelectItem>
                      <SelectItem value="friendly">Freundlich</SelectItem>
                      <SelectItem value="casual">Locker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sprache</label>
                  <Select
                    value={aiSettings.language}
                    onValueChange={(v) => updateAiSettings({ language: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="de-ch">Deutsch (Schweiz)</SelectItem>
                      <SelectItem value="de-de">Deutsch (Deutschland)</SelectItem>
                      <SelectItem value="en">Englisch</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {savedKey === 'ai' && (
                <span className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />Gespeichert
                </span>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Confidence Schwellwerte</CardTitle>
              <CardDescription>Ab welchem Score ist ein Entwurf sicher / unsicher</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-green-700 dark:text-green-400">
                    Grün-Schwelle (Sicher, direkt senden) %
                  </label>
                  <Input
                    type="number"
                    min={50}
                    max={100}
                    value={aiSettings.confidenceGreen}
                    onChange={(e) => updateAiSettings({ confidenceGreen: parseInt(e.target.value) || 85 })}
                    className="h-8"
                  />
                  <p className="text-xs text-slate-400">
                    Score &gt; {aiSettings.confidenceGreen}% → grüner Badge
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-amber-700 dark:text-amber-400">
                    Gelb-Schwelle (Review empfohlen) %
                  </label>
                  <Input
                    type="number"
                    min={30}
                    max={aiSettings.confidenceGreen - 1}
                    value={aiSettings.confidenceYellow}
                    onChange={(e) => updateAiSettings({ confidenceYellow: parseInt(e.target.value) || 70 })}
                    className="h-8"
                  />
                  <p className="text-xs text-slate-400">
                    {aiSettings.confidenceYellow}%–{aiSettings.confidenceGreen}% → gelb · &lt;{aiSettings.confidenceYellow}% → rot
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Self-Learning Konfiguration
              </CardTitle>
              <CardDescription>
                Steuert wann Korrekturen als Learning Cases erfasst werden
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Self-Learning aktiviert</p>
                  <p className="text-sm text-slate-500">Korrekturen werden automatisch erfasst und zur Review weitergeleitet</p>
                </div>
                <Switch
                  checked={learningConfig.learningEnabled}
                  onCheckedChange={(v) => updateLearning({ learningEnabled: v })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Mindest-Änderungsrate für Learning Case (0.01 – 0.50)
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={0.01}
                    max={0.50}
                    step={0.01}
                    value={learningConfig.minEditDistance}
                    onChange={(e) =>
                      updateLearning({ minEditDistance: parseFloat(e.target.value) || 0.1 })
                    }
                    className="h-8 w-28"
                  />
                  <span className="text-sm text-slate-500">
                    Aktuell: Entwürfe mit &gt;{Math.round(learningConfig.minEditDistance * 100)}% Änderungen werden erfasst
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Niedrig = mehr Cases (auch kleine Korrekturen). Hoch = nur starke Korrekturen.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Auto-Extraktion nach X Tagen (0 = deaktiviert)
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={0}
                    max={365}
                    value={learningConfig.autoExtractDays}
                    onChange={(e) =>
                      updateLearning({ autoExtractDays: parseInt(e.target.value) || 0 })
                    }
                    className="h-8 w-28"
                  />
                  <span className="text-sm text-slate-500">
                    {learningConfig.autoExtractDays === 0
                      ? 'Deaktiviert — nur manuelle Extraktion'
                      : `Cases werden nach ${learningConfig.autoExtractDays} Tagen automatisch in die Knowledge Base übernommen`}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Knowledge Base Ähnlichkeitsschwelle (0.3 – 0.9)
                </label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={0.30}
                    max={0.90}
                    step={0.05}
                    value={learningConfig.ragMatchThreshold}
                    onChange={(e) =>
                      updateLearning({ ragMatchThreshold: parseFloat(e.target.value) || 0.5 })
                    }
                    className="h-8 w-28"
                  />
                  <span className="text-sm text-slate-500">
                    {learningConfig.ragMatchThreshold >= 0.7
                      ? 'Hoch — nur sehr ähnliche Artikel werden verwendet'
                      : learningConfig.ragMatchThreshold <= 0.4
                        ? 'Niedrig — mehr Treffer, aber weniger präzise'
                        : 'Ausgewogen — guter Mittelweg (empfohlen: 0.5)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Niedrig = mehr KB-Treffer (eventuell irrelevant). Hoch = weniger aber präzisere Treffer.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={saveLearningConfig}
                  disabled={learningConfigSaving || learningConfigLoading}
                  size="sm"
                >
                  {learningConfigSaving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Speichert...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" />Speichern</>
                  )}
                </Button>
                {savedKey === 'learning' && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />Gespeichert (aktiv)
                  </span>
                )}
                {learningConfigLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── SLA ────────────────────────────────────────────────────────────── */}
        <TabsContent value="sla" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>SLA Zeiten</CardTitle>
              <CardDescription>Maximale Reaktions- und Lösungszeiten pro Priorität</CardDescription>
            </CardHeader>
            <CardContent>
              {slaLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                </div>
              ) : slaTargets.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-slate-400 text-sm">Keine SLA-Ziele — Migration 006 zuerst ausführen</p>
                  <p className="text-xs text-slate-400 mt-1">supabase/migrations/006_support_analytics.sql im Supabase SQL Editor</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {slaTargets.map((target) => {
                    const edit = slaEdits[target.id] || { first: target.first_response_minutes, resolution: target.resolution_minutes }
                    const priorityColors: Record<string, string> = {
                      critical: 'border-l-red-500',
                      high: 'border-l-amber-500',
                      normal: 'border-l-blue-500',
                      low: 'border-l-slate-400',
                    }
                    return (
                      <div key={target.id} className={`p-4 border-l-4 ${priorityColors[target.priority] || 'border-l-slate-400'} bg-slate-50 dark:bg-slate-800/50 rounded-r-lg`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-900 dark:text-white">{target.name}</span>
                            <Badge variant="outline" className="text-xs capitalize">{target.priority}</Badge>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleSaveSla(target.id)} disabled={slaSaving === target.id} className="gap-1.5">
                            {slaSaving === target.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedKey === `sla-${target.id}` ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Save className="h-3.5 w-3.5" />}
                            Speichern
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Erste Antwort (Minuten)</label>
                            <Input type="number" min={1} value={edit.first} onChange={(e) => setSlaEdits((prev) => ({ ...prev, [target.id]: { ...edit, first: parseInt(e.target.value) || 1 } }))} className="h-8 text-sm" />
                            <p className="text-xs text-slate-400">= {fmtMins(edit.first)}</p>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-500">Lösungszeit (Minuten)</label>
                            <Input type="number" min={1} value={edit.resolution} onChange={(e) => setSlaEdits((prev) => ({ ...prev, [target.id]: { ...edit, resolution: parseInt(e.target.value) || 1 } }))} className="h-8 text-sm" />
                            <p className="text-xs text-slate-400">= {fmtMins(edit.resolution)}</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prioritäts-Regeln</CardTitle>
              <CardDescription>Wie wird die Priorität einer E-Mail automatisch bestimmt</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm">
                {[
                  { priority: 'Kritisch', color: 'text-red-600', rule: 'Urgency "critical" (dringend, Notfall, sofort, asap)' },
                  { priority: 'Hoch', color: 'text-amber-600', rule: 'Customer Inquiry + Urgency "high" (rasch, baldmöglich, zeitnah)' },
                  { priority: 'Normal', color: 'text-blue-600', rule: 'Customer Inquiry oder Form Submission ohne spezielle Urgency' },
                  { priority: 'Niedrig', color: 'text-slate-500', rule: 'System-Alerts, Notifications, keine Antwort nötig' },
                ].map(({ priority, color, rule }) => (
                  <div key={priority} className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <span className={`font-medium w-20 flex-shrink-0 ${color}`}>{priority}</span>
                    <span className="text-slate-600 dark:text-slate-400">{rule}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BI TRIGGER ─────────────────────────────────────────────────────── */}
        <TabsContent value="bi" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>BI Trigger Words</CardTitle>
              <CardDescription>Schlüsselwörter die in eingehenden E-Mails erkannt werden</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Neues Schlüsselwort..."
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                  className="flex-1 min-w-48"
                />
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buying_signal">Kaufsignal</SelectItem>
                    <SelectItem value="objection">Einwand</SelectItem>
                    <SelectItem value="churn_risk">Churn-Risiko</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddWord} disabled={addingWord || !newWord.trim()} className="gap-2">
                  {addingWord ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Hinzufügen
                </Button>
              </div>

              {twLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(CATEGORY_LABELS).map(([cat, { label, color, icon: Icon }]) => {
                    const words = groupedWords[cat] || []
                    return (
                      <div key={cat}>
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{label}</span>
                          <Badge variant="outline" className="text-xs">{words.length}</Badge>
                        </div>
                        {words.length === 0 ? (
                          <p className="text-sm text-slate-400 italic ml-6">Keine Wörter definiert</p>
                        ) : (
                          <div className="flex flex-wrap gap-2 ml-6">
                            {words.map((w) => (
                              <div key={w.id} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm ${color} ${w.is_active ? '' : 'opacity-40'}`}>
                                <Switch checked={w.is_active} onCheckedChange={(v) => handleToggleWord(w.id, v)} className="scale-75 data-[state=checked]:bg-current" />
                                <span>{w.word}</span>
                                <button onClick={() => handleDeleteWord(w.id)} className="ml-1 hover:opacity-70 transition-opacity">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {triggerWords.length === 0 && !twLoading && (
                    <p className="text-center text-slate-400 py-4 text-sm">
                      Keine Trigger Words — Migration 006 ausführen oder oben hinzufügen
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TEAM ───────────────────────────────────────────────────────────── */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Support Agents</CardTitle>
              <CardDescription>L1/L2 Tiered Support — Agents verwalten und zuweisen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {agentsLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : agents.length === 0 ? (
                <p className="text-center text-slate-400 py-4 text-sm">Noch keine Agents — unten hinzufügen oder Migration 006 ausführen</p>
              ) : (
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
                          {agent.name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">{agent.name}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{agent.email}</p>
                          {agent.specializations?.length > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5">{agent.specializations.join(', ')}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={agent.role === 'L2' ? 'default' : 'secondary'}>{agent.role}</Badge>
                        <button onClick={() => handleDeactivateAgent(agent.id)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Agent hinzufügen</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input placeholder="Name" value={newAgentName} onChange={(e) => setNewAgentName(e.target.value)} />
                  <Input placeholder="E-Mail" type="email" value={newAgentEmail} onChange={(e) => setNewAgentEmail(e.target.value)} />
                  <Select value={newAgentRole} onValueChange={setNewAgentRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L1">L1 (Erstlinie)</SelectItem>
                      <SelectItem value="L2">L2 (Experte)</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddAgent} disabled={addingAgent || !newAgentName || !newAgentEmail} className="gap-2 w-full sm:w-auto">
                  {addingAgent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Agent hinzufügen
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TRAINING ───────────────────────────────────────────────────────── */}
        <TabsContent value="training" className="space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1 flex items-center gap-2"><GraduationCap className="h-4 w-4" />Was passiert beim Bulk Training?</p>
            <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-400">
              <li>Alle E-Mails werden aus HubSpot abgerufen (max. 1000)</li>
              <li>Threads mit Eingang + Antwort werden als Q&amp;A-Paare erkannt</li>
              <li>GPT-4o-mini extrahiert das Kern-Wissen aus jedem Thread</li>
              <li>Das Wissen wird mit Embedding in der Knowledge Base gespeichert</li>
              <li>Bei zukünftigen Drafts wird dieses Wissen automatisch verwendet</li>
            </ol>
          </div>

          {trainingStats && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <GraduationCap className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">E-Mail Training Chunks</p>
                    <p className="text-2xl font-bold text-purple-600">{trainingStats.email_training_count}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Brain className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">AI Anweisungen</p>
                    <p className="text-2xl font-bold text-blue-600">{trainingStats.ai_instructions_count}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>HubSpot Bulk Import</CardTitle>
              <CardDescription>
                Analysiert alle historischen E-Mail-Threads in HubSpot und extrahiert Wissen in die Knowledge Base
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleBulkImport}
                  disabled={bulkRunning}
                  className="gap-2"
                >
                  {bulkRunning ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Analysiere HubSpot Emails…</>
                  ) : (
                    <><RefreshCw className="h-4 w-4" />Bulk Import starten</>
                  )}
                </Button>
                {!bulkRunning && (
                  <p className="text-xs text-slate-500">
                    Dauert ca. 2–5 Minuten bei 100+ Threads
                  </p>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Extrahiert Wissen aus allen HubSpot E-Mail-Threads und speichert es in der Knowledge Base.</p>

              {bulkError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">Fehler</p>
                    <p>{bulkError}</p>
                  </div>
                </div>
              )}

              {bulkResult && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
                  <p className="font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />Import erfolgreich
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-700">{bulkResult.total_emails}</p>
                      <p className="text-xs text-slate-500">E-Mails geladen</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-700">{bulkResult.threads}</p>
                      <p className="text-xs text-slate-500">Threads</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-700">{bulkResult.extracted}</p>
                      <p className="text-xs text-slate-500">Wissen extrahiert</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-500">{bulkResult.skipped}</p>
                      <p className="text-xs text-slate-500">Übersprungen</p>
                    </div>
                  </div>
                  {bulkResult.errors.length > 0 && (
                    <div className="mt-2 text-xs text-red-600">
                      <p className="font-medium">Fehler ({bulkResult.errors.length}):</p>
                      {bulkResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Insights Backfill */}
          <Card>
            <CardHeader>
              <CardTitle>Insights Backfill</CardTitle>
              <CardDescription>
                Analysiert alle E-Mails und füllt Insights mit historischen Daten: Klassifikation, Tone, Buying Intent, CSAT, Learning Cases und Knowledge Base
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg text-sm text-purple-800 dark:text-purple-300">
                <p className="font-medium mb-1">Was passiert beim Backfill?</p>
                <ol className="list-decimal list-inside space-y-1 text-purple-700 dark:text-purple-400">
                  <li>Unklassifizierte E-Mails werden analysiert (Typ, Tone, Priority, BI-Scan)</li>
                  <li>Edit-Distance wird für bearbeitete Drafts berechnet</li>
                  <li>Learning Cases werden aus editierten Drafts erstellt</li>
                  <li>CSAT-Bewertungen werden aus Edit-Distance abgeleitet</li>
                  <li>Knowledge Base Einträge aus gesendeten Antworten generiert</li>
                </ol>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={handleBackfill}
                  disabled={backfillRunning}
                  className="gap-2"
                  variant="outline"
                >
                  {backfillRunning ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Backfill läuft…</>
                  ) : (
                    <><RefreshCw className="h-4 w-4" />Insights Backfill starten</>
                  )}
                </Button>
              </div>

              {backfillError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>{backfillError}</p>
                </div>
              )}

              {backfillResult && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
                  <p className="font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />{backfillResult.message}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-700">{backfillResult.editDistanceCalculated}</p>
                      <p className="text-xs text-slate-500">Edit-Distances</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-700">{backfillResult.learningCasesCreated}</p>
                      <p className="text-xs text-slate-500">Learning Cases</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-700">{backfillResult.csatRatingsCreated}</p>
                      <p className="text-xs text-slate-500">CSAT Ratings</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-700">{backfillResult.knowledgeChunksCreated}</p>
                      <p className="text-xs text-slate-500">KB Einträge</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historical HubSpot Email Import */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-indigo-500" />
                Historische E-Mails importieren
              </CardTitle>
              <CardDescription>
                Importiere alle historischen E-Mails aus HubSpot (bis 1 Jahr zurück, max. 500).
                Die Emails werden mit AI-Klassifikation, Tone-Analyse und Buying-Intent analysiert
                und füllen die Dashboard-KPIs und Trends.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={() => setShowHistImportDialog(true)}
                disabled={histImportRunning}
                className="gap-2"
              >
                {histImportRunning ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Importiere historische E-Mails…</>
                ) : (
                  <><RefreshCw className="h-4 w-4" />Historischen Import starten</>
                )}
              </Button>

              <AlertDialog open={showHistImportDialog} onOpenChange={setShowHistImportDialog}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Historische E-Mails importieren?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Es werden bis zu 500 E-Mails aus HubSpot importiert und mit AI analysiert. Dies kann einige Minuten dauern und API-Credits verbrauchen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction onClick={() => { setShowHistImportDialog(false); handleHistoricalImport(); }}>
                      Import starten
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {histImportError && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>{histImportError}</p>
                </div>
              )}

              {histImportResult && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
                  <p className="font-medium text-green-800 dark:text-green-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />{histImportResult.message}
                  </p>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-700">{histImportResult.imported}</p>
                      <p className="text-xs text-slate-500">Importiert</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-500">{histImportResult.skipped}</p>
                      <p className="text-xs text-slate-500">Übersprungen</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{histImportResult.errors}</p>
                      <p className="text-xs text-slate-500">Fehler</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ONBOARDING ─────────────────────────────────────────────────────── */}
        <TabsContent value="onboarding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Onboarding Guide für Philipp
              </CardTitle>
              <CardDescription>
                Alles was du wissen musst, um das System selbstständig zu betreiben
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Daily Workflow */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-blue-500" />
                  Täglicher Workflow
                </h3>
                <div className="space-y-2">
                  {[
                    { step: '1', title: 'Inbox öffnen', desc: 'Neue E-Mails von HubSpot werden automatisch importiert (alle 60s). Status: pending = noch nicht bearbeitet.' },
                    { step: '2', title: 'AI Draft generieren', desc: 'Klick auf «AI Entwurf generieren». Die AI nutzt die Knowledge Base + AI Anweisungen aus den Einstellungen.' },
                    { step: '3', title: 'Draft prüfen & anpassen', desc: 'Grüner Badge = direkt senden. Gelber Badge = kurz prüfen. Roter Badge = manuell schreiben.' },
                    { step: '4', title: 'Senden', desc: 'Nach dem Senden erscheint ein kurzes CSAT-Rating (1-5 ★). Das hilft der AI zu lernen.' },
                    { step: '5', title: 'AI Learning reviewen', desc: 'Falls du einen Entwurf stark geändert hast, erscheint er in «AI Learning» → dort extrahieren oder verwerfen.' },
                  ].map(({ step, title, desc }) => (
                    <div key={step} className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                        {step}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-slate-900 dark:text-white">{title}</p>
                        <p className="text-sm text-slate-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Tasks */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-green-500" />
                  Wöchentliche Aufgaben
                </h3>
                <div className="space-y-2">
                  {[
                    { title: 'AI Learning Cases reviewen', desc: 'Unter «AI Learning» ausstehende Korrekturen als Wissen extrahieren oder verwerfen.' },
                    { title: 'Analytics checken', desc: 'Unter «Analytics» Antwortzeiten, Kundenstimmung und BI Insights prüfen.' },
                    { title: 'Knowledge Base aktualisieren', desc: 'Neue Kurse, Preisänderungen oder FAQs unter «Knowledge Base» hinzufügen.' },
                    { title: 'SLA Compliance prüfen', desc: 'Im Analytics Dashboard sehen ob SLA-Ziele eingehalten wurden.' },
                  ].map(({ title, desc }) => (
                    <div key={title} className="flex gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm text-slate-900 dark:text-white">{title}</p>
                        <p className="text-sm text-slate-500">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation Guide */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-purple-500" />
                  Wo finde ich was?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: Inbox, label: 'Inbox', href: '/inbox', desc: 'Alle eingehenden Emails + AI Drafts' },
                    { icon: BookOpen, label: 'Knowledge Base', href: '/knowledge', desc: 'Wissen verwalten (Kurse, FAQs, PDFs)' },
                    { icon: Brain, label: 'AI Learning', href: '/learning', desc: 'Korrekturen reviewen und extrahieren' },
                    { icon: BarChart3, label: 'Analytics', href: '/analytics', desc: 'Kennzahlen, SLA, Stimmung' },
                    { icon: MessageSquare, label: 'Chat', href: '/chat', desc: 'Direkt mit der AI über das Institut chatten' },
                    { icon: Shield, label: 'Einstellungen → Team', href: '/settings', desc: 'Agents, SLA, BI Trigger verwalten' },
                  ].map(({ icon: Icon, label, href, desc }) => (
                    <a
                      key={href}
                      href={href}
                      className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Icon className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-slate-900 dark:text-white">{label}</p>
                        <p className="text-xs text-slate-500">{desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 flex-shrink-0" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Handoff Checklist */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-500" />
                  Übergabe-Checkliste (Rafi → Philipp)
                </h3>
                <div className="space-y-2">
                  {[
                    'Zugang zu HubSpot erhalten und bestätigt',
                    'Supabase Migration 006 wurde ausgeführt',
                    'Ersten AI-Draft generiert und gesendet',
                    'Mind. 1 AI Learning Case extrahiert',
                    'Mind. 1 Knowledge Base Eintrag hinzugefügt',
                    'AI Anweisungen (Profil, Tonalität) überprüft',
                    'SLA Zeiten auf Institut-Standards angepasst',
                    'HubSpot Bulk Training mindestens einmal ausgeführt',
                    'Analytics Dashboard verstanden',
                    'Ersten Chat mit der AI ausprobiert',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 p-2.5">
                      <Circle className="h-4 w-4 text-slate-300 flex-shrink-0" />
                      <span className="text-sm text-slate-700 dark:text-slate-300">{item}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Tipp: Drucke diese Liste aus oder kopiere sie in Notion für die Übergabe.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── INTEGRATIONEN ──────────────────────────────────────────────────── */}
        <TabsContent value="business-hours" className="space-y-6">
          <BusinessHoursTab />
        </TabsContent>

        <TabsContent value="automation" className="space-y-6">
          <AutomationTab />
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <AuditTrailTab />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" />HubSpot</CardTitle>
              <CardDescription>E-Mail Integration via Webhook + API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`flex items-center justify-between p-3 rounded-lg ${integrationStatus.hubspot ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${integrationStatus.hubspot ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium">{integrationStatus.hubspot ? 'Verbunden' : 'Nicht konfiguriert (HUBSPOT_ACCESS_TOKEN fehlt)'}</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Webhook URL</label>
                <Input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com'}/api/webhooks/hubspot`} className="font-mono text-sm" />
                <p className="text-xs text-slate-400">Diese URL in HubSpot unter Einstellungen → Integrationen → Webhooks eintragen</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-400">
                <p className="font-medium">Automatischer E-Mail Import</p>
                <p className="mt-1">Emails werden alle 60 Sekunden automatisch importiert. Für sofortigen Import: Inbox öffnen → das Polling startet automatisch.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" />OpenAI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={`flex items-center justify-between p-3 rounded-lg ${integrationStatus.openai ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${integrationStatus.openai ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium">{integrationStatus.openai ? 'API Key konfiguriert' : 'Nicht konfiguriert (OPENAI_API_KEY fehlt)'}</span>
                </div>
                {integrationStatus.openai && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">GPT-4o (Drafts)</Badge>
                  <Badge variant="outline">gpt-4o-mini (Klassifikation)</Badge>
                </div>
                )}
              </div>
              <div className="text-sm text-slate-500 space-y-1">
                <p>• Draft-Generierung: GPT-4o mit RAG (Knowledge Base)</p>
                <p>• E-Mail Klassifikation: gpt-4o-mini</p>
                <p>• Embeddings: text-embedding-3-small</p>
                <p>• Training Extraktion: gpt-4o-mini</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Supabase</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={`flex items-center justify-between p-3 rounded-lg ${integrationStatus.supabase ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${integrationStatus.supabase ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm font-medium">{integrationStatus.supabase ? 'Verbunden' : 'Nicht konfiguriert (Supabase URL/Key fehlt)'}</span>
                </div>
              </div>
              <div className="text-sm text-slate-500 space-y-1">
                <p>• PostgreSQL + pgvector (Embeddings)</p>
                <p>• Row Level Security aktiviert</p>
                <p>• Migrations: 001–006 (006 = Support Analytics)</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-400">
                Falls neue Tabellen fehlen: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">supabase/migrations/006_support_analytics.sql</code> im Supabase SQL Editor ausführen.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── BENACHRICHTIGUNGEN ────────────────────────────────────────────── */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5" />
                Ton & Benachrichtigungen
              </CardTitle>
              <CardDescription>Steuere, wie du über neue E-Mails und Ereignisse informiert wirst.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Benachrichtigungston</p>
                  <p className="text-xs text-slate-500">Spielt einen Ton ab, wenn eine neue E-Mail eingeht</p>
                </div>
                <Switch
                  defaultChecked={typeof window !== 'undefined' && localStorage.getItem('notificationSounds') !== 'false'}
                  onCheckedChange={(checked) => localStorage.setItem('notificationSounds', String(checked))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Inbox Zero Konfetti</p>
                  <p className="text-xs text-slate-500">Feiert mit Konfetti, wenn alle E-Mails bearbeitet sind</p>
                </div>
                <Switch
                  defaultChecked={typeof window !== 'undefined' && localStorage.getItem('confettiEnabled') !== 'false'}
                  onCheckedChange={(checked) => localStorage.setItem('confettiEnabled', String(checked))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Browser-Benachrichtigungen</p>
                  <p className="text-xs text-slate-500">Desktop-Push-Benachrichtigungen bei neuen E-Mails</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if ('Notification' in window) {
                      Notification.requestPermission().then(p => {
                        if (p === 'granted') toast.success('Benachrichtigungen aktiviert')
                        else toast.error('Benachrichtigungen abgelehnt')
                      })
                    }
                  }}
                >
                  Aktivieren
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Tastaturkürzel
              </CardTitle>
              <CardDescription>Tastaturkürzel für die Inbox.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-600 dark:text-slate-300">Nächste E-Mail</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">J / ↓</kbd>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-600 dark:text-slate-300">Vorherige E-Mail</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">K / ↑</kbd>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-600 dark:text-slate-300">E-Mail öffnen</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">Enter</kbd>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-600 dark:text-slate-300">Schliessen</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">E</kbd>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-600 dark:text-slate-300">Antworten</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">R</kbd>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-600 dark:text-slate-300">Zurück</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">Esc</kbd>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-600 dark:text-slate-300">Hilfe</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">?</kbd>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded">
                  <span className="text-slate-600 dark:text-slate-300">Suche</span>
                  <kbd className="px-1.5 py-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded text-xs font-mono">⌘K</kbd>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { confirmAction?.onConfirm(); setConfirmAction(null) }}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
