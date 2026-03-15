'use client'

import { useState, useEffect, useCallback, type DragEvent } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { Loader2, Plus } from 'lucide-react'

interface Deal {
  id: string
  title: string
  customer_email: string | null
  stage: string
  value: number
  currency: string
  probability: number
  assigned_agent_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

const stages = [
  { key: 'lead', label: 'Lead', color: 'bg-slate-50 dark:bg-slate-800/50', headerColor: 'bg-slate-200 dark:bg-slate-700', textColor: 'text-slate-700 dark:text-slate-300' },
  { key: 'qualified', label: 'Qualifiziert', color: 'bg-blue-50 dark:bg-blue-900/20', headerColor: 'bg-blue-200 dark:bg-blue-800', textColor: 'text-blue-700 dark:text-blue-300' },
  { key: 'proposal', label: 'Angebot', color: 'bg-indigo-50 dark:bg-indigo-900/20', headerColor: 'bg-indigo-200 dark:bg-indigo-800', textColor: 'text-indigo-700 dark:text-indigo-300' },
  { key: 'negotiation', label: 'Verhandlung', color: 'bg-amber-50 dark:bg-amber-900/20', headerColor: 'bg-amber-200 dark:bg-amber-800', textColor: 'text-amber-700 dark:text-amber-300' },
  { key: 'won', label: 'Gewonnen', color: 'bg-green-50 dark:bg-green-900/20', headerColor: 'bg-green-200 dark:bg-green-800', textColor: 'text-green-700 dark:text-green-300' },
  { key: 'lost', label: 'Verloren', color: 'bg-red-50 dark:bg-red-900/20', headerColor: 'bg-red-200 dark:bg-red-800', textColor: 'text-red-700 dark:text-red-300' },
]

function formatCHF(value: number): string {
  return new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF', minimumFractionDigits: 0 }).format(value)
}

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  // New deal form
  const [newTitle, setNewTitle] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newProbability, setNewProbability] = useState('10')
  const [newStage, setNewStage] = useState('lead')
  const [newNotes, setNewNotes] = useState('')

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch('/api/deals')
      if (res.ok) {
        const data = await res.json()
        setDeals(data.deals || [])
      }
    } catch (e) {
      console.error('Failed to fetch deals:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDeals()
  }, [fetchDeals])

  const moveDeal = async (dealId: string, newStage: string) => {
    // Optimistic update
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage } : d))
    try {
      await fetch('/api/deals', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dealId, stage: newStage }),
      })
    } catch (e) {
      console.error('Failed to move deal:', e)
      fetchDeals() // Revert on failure
    }
  }

  const handleDragStart = (e: DragEvent<HTMLDivElement>, dealId: string) => {
    e.dataTransfer.setData('text/plain', dealId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>, stageKey: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverStage(stageKey)
  }

  const handleDragLeave = () => {
    setDragOverStage(null)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>, stageKey: string) => {
    e.preventDefault()
    setDragOverStage(null)
    const dealId = e.dataTransfer.getData('text/plain')
    if (dealId) {
      moveDeal(dealId, stageKey)
    }
  }

  const createDeal = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const body: Record<string, string | number> = {
        title: newTitle.trim(),
        stage: newStage,
        value: parseFloat(newValue) || 0,
        probability: parseInt(newProbability) || 0,
      }
      if (newCustomerEmail.trim()) body.customer_email = newCustomerEmail.trim()
      if (newNotes.trim()) body.notes = newNotes.trim()

      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setDialogOpen(false)
        setNewTitle('')
        setNewCustomerEmail('')
        setNewValue('')
        setNewProbability('10')
        setNewStage('lead')
        setNewNotes('')
        fetchDeals()
      }
    } catch (e) {
      console.error('Failed to create deal:', e)
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Deals" description="Pipeline verwalten" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <Header title="Deals" description="Pipeline und Opportunities verwalten" />
        <Button onClick={() => setDialogOpen(true)} className="mt-1">
          <Plus className="h-4 w-4 mr-2" /> Neuer Deal
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stages.map(stage => {
          const stageDeals = deals.filter(d => d.stage === stage.key)
          const totalValue = stageDeals.reduce((sum, d) => sum + (d.value || 0), 0)

          return (
            <div
              key={stage.key}
              className={`rounded-lg border transition-colors ${
                dragOverStage === stage.key
                  ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
              onDragOver={(e) => handleDragOver(e, stage.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.key)}
            >
              {/* Column Header */}
              <div className={`${stage.headerColor} rounded-t-lg px-3 py-2`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${stage.textColor}`}>{stage.label}</span>
                  <Badge variant="secondary" className="text-xs">{stageDeals.length}</Badge>
                </div>
                {totalValue > 0 && (
                  <p className={`text-xs mt-0.5 ${stage.textColor} opacity-80`}>{formatCHF(totalValue)}</p>
                )}
              </div>

              {/* Deal Cards */}
              <div className={`${stage.color} rounded-b-lg p-2 space-y-2 min-h-[120px]`}>
                {stageDeals.map(deal => (
                  <Card
                    key={deal.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, deal.id)}
                    className="cursor-grab active:cursor-grabbing py-0 hover:shadow-md transition-shadow"
                  >
                    <CardContent className="p-3 space-y-1.5">
                      <p className="font-medium text-sm leading-tight">{deal.title}</p>
                      {deal.customer_email && (
                        <p className="text-xs text-slate-500 truncate">{deal.customer_email}</p>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {formatCHF(deal.value)}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {deal.probability}%
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Deal erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="deal-title">Titel</Label>
              <Input
                id="deal-title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Deal-Titel..."
              />
            </div>
            <div>
              <Label htmlFor="deal-email">Kunden-Email</Label>
              <Input
                id="deal-email"
                type="email"
                value={newCustomerEmail}
                onChange={e => setNewCustomerEmail(e.target.value)}
                placeholder="kunde@example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deal-value">Wert (CHF)</Label>
                <Input
                  id="deal-value"
                  type="number"
                  value={newValue}
                  onChange={e => setNewValue(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="100"
                />
              </div>
              <div>
                <Label htmlFor="deal-prob">Wahrscheinlichkeit (%)</Label>
                <Input
                  id="deal-prob"
                  type="number"
                  value={newProbability}
                  onChange={e => setNewProbability(e.target.value)}
                  placeholder="10"
                  min="0"
                  max="100"
                />
              </div>
            </div>
            <div>
              <Label>Phase</Label>
              <Select value={newStage} onValueChange={setNewStage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map(s => (
                    <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="deal-notes">Notizen</Label>
              <Textarea
                id="deal-notes"
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="Weitere Informationen..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={createDeal} disabled={creating || !newTitle.trim()}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
