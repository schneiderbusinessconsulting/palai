'use client'

import { useState, useEffect, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  BookOpen,
  CheckCircle,
  X,
  Loader2,
  Brain,
  TrendingUp,
  AlertCircle,
  Edit2,
  Clock,
  ArrowRight,
  CheckSquare,
  Square,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatRelativeDate } from '@/lib/utils'

interface LearningCase {
  id: string
  email_id: string
  original_draft: string
  corrected_response: string
  edit_distance: number
  difficulty_score: number
  topic_cluster: string | null
  knowledge_extracted: boolean
  status: string
  created_at: string
  incoming_emails: {
    subject: string
    from_name: string | null
    from_email: string
    email_type: string | null
  } | null
}

function EditDistanceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  if (pct < 20) return <Badge className="bg-green-500">+{pct}% geändert</Badge>
  if (pct < 50) return <Badge className="bg-amber-500">+{pct}% geändert</Badge>
  return <Badge className="bg-red-500">+{pct}% geändert</Badge>
}

function DiffView({ original, corrected }: { original: string; corrected: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
          <Brain className="h-3 w-3" /> AI Entwurf (original)
        </p>
        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
          {original}
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-green-600 mb-1.5 flex items-center gap-1">
          <Edit2 className="h-3 w-3" /> Korrigierte Version
        </p>
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap max-h-48 overflow-y-auto">
          {corrected}
        </div>
      </div>
    </div>
  )
}

export default function LearningPage() {
  const [cases, setCases] = useState<LearningCase[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'extracted' | 'dismissed' | 'all'>('pending')

  const [extractingId, setExtractingId] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)

  // Batch selection
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set())
  const [isBatchExtracting, setIsBatchExtracting] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })

  // Extract dialog
  const [extractDialogCase, setExtractDialogCase] = useState<LearningCase | null>(null)
  const [extractTitle, setExtractTitle] = useState('')
  const [extractContext, setExtractContext] = useState('')

  const fetchCases = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/learning?status=${filter}`)
      const data = await res.json()
      setCases(data.cases || [])
      setStats({ total: data.total || 0, pending: data.pending || 0 })
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchCases() }, [fetchCases])

  const handleExtract = async () => {
    if (!extractDialogCase) return
    setExtractingId(extractDialogCase.id)
    try {
      const res = await fetch(`/api/learning/${extractDialogCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extract', title: extractTitle, learning_context: extractContext || null }),
      })
      if (res.ok) {
        setExtractDialogCase(null)
        setExtractContext('')
        fetchCases()
      }
    } catch (err) {
      console.error(err)
      toast.error('Extraktion fehlgeschlagen')
    } finally {
      setExtractingId(null)
    }
  }

  const toggleSelectCase = (id: string) => {
    setSelectedCaseIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllPending = () => {
    const pendingIds = cases.filter(c => c.status === 'pending').map(c => c.id)
    if (pendingIds.every(id => selectedCaseIds.has(id))) {
      setSelectedCaseIds(new Set())
    } else {
      setSelectedCaseIds(new Set(pendingIds))
    }
  }

  const handleBatchExtract = async () => {
    const selectedCases = cases.filter(c => selectedCaseIds.has(c.id) && c.status === 'pending')
    if (selectedCases.length === 0) return

    setIsBatchExtracting(true)
    setBatchProgress({ current: 0, total: selectedCases.length })

    let succeeded = 0
    for (let i = 0; i < selectedCases.length; i++) {
      const lc = selectedCases[i]
      setBatchProgress({ current: i + 1, total: selectedCases.length })
      try {
        const res = await fetch(`/api/learning/${lc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'extract',
            title: `Gelernt: ${lc.incoming_emails?.subject || 'Antwortkorrektur'}`,
            learning_context: null,
          }),
        })
        if (res.ok) succeeded++
      } catch (err) {
        console.error('Batch extract error:', err)
      }
    }

    setIsBatchExtracting(false)
    setSelectedCaseIds(new Set())
    toast.success(`${succeeded}/${selectedCases.length} Korrekturen extrahiert`)
    fetchCases()
  }

  const handleDismiss = async (id: string) => {
    setDismissingId(id)
    try {
      const res = await fetch(`/api/learning/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      })
      if (res.ok) {
        fetchCases()
      } else {
        console.error('Dismiss failed:', res.status)
      }
    } catch (err) {
      console.error(err)
      toast.error('Aktion fehlgeschlagen')
    } finally {
      setDismissingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <Header
        title="AI Learning"
        description="Korrekturen reviewen und als Wissen für die AI extrahieren"
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Review ausstehend</p>
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Brain className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Korrekturen</p>
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Wie es funktioniert</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Korrektur → Review → Knowledge Base
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Explanation */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
        <p className="font-medium mb-1">So lernt die AI:</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-400">
          <li>Du bearbeitest einen AI-Entwurf in der Inbox → wird hier automatisch erfasst</li>
          <li>Du klickst &quot;Als Wissen extrahieren&quot; → Korrektur wird in die Knowledge Base gespeichert</li>
          <li>Beim nächsten ähnlichen Thema nutzt die AI diese Information für bessere Antworten</li>
        </ol>
      </div>

      {/* Filter + Batch Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['pending', 'extracted', 'dismissed', 'all'] as const).map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setFilter(f); setSelectedCaseIds(new Set()) }}
          >
            {f === 'pending' ? 'Ausstehend' : f === 'extracted' ? 'Extrahiert' : f === 'dismissed' ? 'Verworfen' : 'Alle'}
            {f === 'pending' && stats.pending > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-amber-500 text-white rounded-full">
                {stats.pending}
              </span>
            )}
          </Button>
        ))}
        <div className="flex-1" />
        {filter === 'pending' && cases.filter(c => c.status === 'pending').length > 0 && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={toggleSelectAllPending}
            >
              {cases.filter(c => c.status === 'pending').every(c => selectedCaseIds.has(c.id)) ? (
                <CheckSquare className="h-3.5 w-3.5" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              Alle auswählen
            </Button>
            {selectedCaseIds.size > 0 && (
              <Button
                size="sm"
                className="gap-1.5 bg-green-600 hover:bg-green-700"
                onClick={handleBatchExtract}
                disabled={isBatchExtracting}
              >
                {isBatchExtracting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Extrahiere {batchProgress.current}/{batchProgress.total}...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-3.5 w-3.5" />
                    {selectedCaseIds.size} extrahieren
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Cases List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-12">
          <Brain className="h-12 w-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400">
            {filter === 'pending' ? 'Keine Korrekturen zum Review' : 'Keine Einträge gefunden'}
          </p>
          {filter === 'pending' && (
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Korrekturen erscheinen hier sobald du in der Inbox AI-Drafts bearbeitest
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {cases.map(lc => (
            <Card key={lc.id} className={selectedCaseIds.has(lc.id) ? 'ring-2 ring-green-400' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  {lc.status === 'pending' && (
                    <button
                      onClick={() => toggleSelectCase(lc.id)}
                      className="mt-1 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0"
                    >
                      {selectedCaseIds.has(lc.id) ? (
                        <CheckSquare className="h-4 w-4 text-green-600" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {lc.incoming_emails?.subject || 'Kein Betreff'}
                    </CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {lc.incoming_emails?.from_name || lc.incoming_emails?.from_email} ·{' '}
                      {formatRelativeDate(lc.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {lc.edit_distance != null && (
                      <EditDistanceBadge value={lc.edit_distance} />
                    )}
                    {lc.status === 'extracted' && (
                      <Badge className="bg-green-500">Extrahiert</Badge>
                    )}
                    {lc.status === 'dismissed' && (
                      <Badge variant="secondary">Verworfen</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <DiffView
                  original={lc.original_draft}
                  corrected={lc.corrected_response}
                />

                {lc.status === 'pending' && (
                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      className="gap-2 bg-green-600 hover:bg-green-700"
                      size="sm"
                      onClick={() => {
                        setExtractDialogCase(lc)
                        setExtractTitle(`Gelernt: ${lc.incoming_emails?.subject || 'Antwortkorrektur'}`)
                        setExtractContext('')
                      }}
                      disabled={extractingId === lc.id}
                    >
                      {extractingId === lc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <BookOpen className="h-4 w-4" />
                      )}
                      Als Wissen extrahieren
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-slate-500"
                      onClick={() => handleDismiss(lc.id)}
                      disabled={dismissingId === lc.id}
                    >
                      {dismissingId === lc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      Verwerfen
                    </Button>
                  </div>
                )}

                {lc.status === 'extracted' && (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <Clock className="h-4 w-4" />
                    In KB gespeichert – wartet auf Freigabe
                    <a href="/knowledge" className="flex items-center gap-0.5 underline underline-offset-2 hover:text-amber-700">
                      KB öffnen <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Extract Dialog */}
      <Dialog open={!!extractDialogCase} onOpenChange={() => setExtractDialogCase(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Als Wissen extrahieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Die korrigierte Antwort wird in der Knowledge Base gespeichert und muss dort freigegeben werden, bevor sie für AI-Antworten verwendet wird.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Titel für den Knowledge-Eintrag
              </label>
              <Input
                value={extractTitle}
                onChange={(e) => setExtractTitle(e.target.value)}
                placeholder="z.B. Gelernt: Antwort zu Hypnose-Ausbildung"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Was war die Erkenntnis? <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <Textarea
                value={extractContext}
                onChange={(e) => setExtractContext(e.target.value)}
                placeholder="z.B. Kunde fragte nach Ratenzahlung – AI hatte nur Vollpreis genannt. Korrekt ist: 3 Raten à CHF 600 möglich."
                rows={3}
              />
              <p className="text-xs text-slate-400">Wird in der Knowledge Base als Kontext angezeigt, damit du beim Freigeben weißt, warum dieser Eintrag erstellt wurde.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtractDialogCase(null)}>
              Abbrechen
            </Button>
            <Button
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={handleExtract}
              disabled={!extractTitle || extractingId !== null}
            >
              {extractingId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookOpen className="h-4 w-4" />
              )}
              Extrahieren & Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
