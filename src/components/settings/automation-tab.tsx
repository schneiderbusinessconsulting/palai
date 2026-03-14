'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import { Plus, Trash2, Loader2, Zap, Play, AlertCircle } from 'lucide-react'

interface AutomationRule {
  id: string
  name: string
  description?: string
  trigger: string
  conditions: { field: string; operator: string; value: string | string[] }[]
  actions: { type: string; value: string | Record<string, string> }[]
  is_active: boolean
  priority: number
  run_count: number
}

const TRIGGERS = [
  { value: 'email_received', label: 'E-Mail empfangen' },
  { value: 'sla_at_risk', label: 'SLA gefährdet' },
  { value: 'sla_breached', label: 'SLA verletzt' },
  { value: 'tag_added', label: 'Tag hinzugefügt' },
]

const CONDITION_FIELDS = [
  { value: 'from_email', label: 'Absender-E-Mail' },
  { value: 'subject', label: 'Betreff' },
  { value: 'priority', label: 'Priorität' },
  { value: 'tone_sentiment', label: 'Stimmung' },
  { value: 'buying_intent_score', label: 'Buying Intent' },
  { value: 'email_type', label: 'E-Mail-Typ' },
]

const OPERATORS = [
  { value: 'eq', label: 'ist gleich' },
  { value: 'neq', label: 'ist nicht gleich' },
  { value: 'contains', label: 'enthält' },
  { value: 'not_contains', label: 'enthält nicht' },
  { value: 'gt', label: 'größer als' },
  { value: 'lt', label: 'kleiner als' },
  { value: 'in', label: 'ist eines von' },
]

const ACTION_TYPES = [
  { value: 'set_priority', label: 'Priorität setzen' },
  { value: 'assign_agent', label: 'Agent zuweisen' },
  { value: 'add_tag', label: 'Tag hinzufügen' },
  { value: 'set_status', label: 'Status setzen' },
  { value: 'escalate', label: 'Eskalieren' },
]

export function AutomationTab() {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [trigger, setTrigger] = useState('email_received')
  const [conditions, setConditions] = useState<{ field: string; operator: string; value: string }[]>([])
  const [actions, setActions] = useState<{ type: string; value: string }[]>([])

  const fetchRules = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/automation')
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules || [])
        if (data.tableExists === false) setTableExists(false)
      }
    } catch (e) {
      console.error('Failed to fetch automation rules:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRules() }, [])

  const openNewDialog = () => {
    setEditingRule(null)
    setName('')
    setDescription('')
    setTrigger('email_received')
    setConditions([])
    setActions([])
    setDialogOpen(true)
  }

  const openEditDialog = (rule: AutomationRule) => {
    setEditingRule(rule)
    setName(rule.name)
    setDescription(rule.description || '')
    setTrigger(rule.trigger)
    setConditions(rule.conditions.map(c => ({
      field: c.field,
      operator: c.operator,
      value: Array.isArray(c.value) ? c.value.join(', ') : String(c.value),
    })))
    setActions(rule.actions.map(a => ({
      type: a.type,
      value: typeof a.value === 'object' ? JSON.stringify(a.value) : String(a.value),
    })))
    setDialogOpen(true)
  }

  const saveRule = async () => {
    setSaving(true)
    try {
      const body = {
        id: editingRule?.id,
        name,
        description: description || null,
        trigger,
        conditions: conditions.map(c => ({
          field: c.field,
          operator: c.operator,
          value: c.operator === 'in' ? c.value.split(',').map(v => v.trim()) : c.value,
        })),
        actions: actions.map(a => ({
          type: a.type,
          value: a.type === 'escalate' ? { to_level: a.value || 'L2' } : a.value,
        })),
      }

      const res = await fetch('/api/automation', {
        method: editingRule ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        setDialogOpen(false)
        fetchRules()
      }
    } catch (e) {
      console.error('Failed to save rule:', e)
    } finally {
      setSaving(false)
    }
  }

  const toggleRule = async (rule: AutomationRule) => {
    await fetch('/api/automation', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
    })
    fetchRules()
  }

  const deleteRule = async (id: string) => {
    await fetch(`/api/automation?id=${id}`, { method: 'DELETE' })
    fetchRules()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!tableExists) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Automation-Tabelle nicht gefunden</p>
              <p className="text-sm text-slate-500">
                Die Tabelle &quot;automation_rules&quot; existiert nicht in der Datenbank.
                Führen Sie die Migration 009_team_readiness.sql aus, um Automatisierungen zu aktivieren.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Automatisierungsregeln
              </CardTitle>
              <CardDescription>
                Automatische Aktionen bei bestimmten Ereignissen
              </CardDescription>
            </div>
            <Button onClick={openNewDialog} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Neue Regel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Zap className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p>Keine Automatisierungsregeln vorhanden</p>
              <p className="text-sm mt-1">Erstellen Sie Ihre erste Regel, um Workflows zu automatisieren.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={() => toggleRule(rule)}
                    />
                    <button onClick={() => openEditDialog(rule)} className="text-left min-w-0">
                      <p className="font-medium text-sm truncate">{rule.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">
                          {TRIGGERS.find(t => t.value === rule.trigger)?.label || rule.trigger}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {rule.conditions.length} Bedingung{rule.conditions.length !== 1 ? 'en' : ''} → {rule.actions.length} Aktion{rule.actions.length !== 1 ? 'en' : ''}
                        </span>
                      </div>
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      <Play className="h-3 w-3 mr-1" />
                      {rule.run_count}×
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => deleteRule(rule.id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule Editor Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'Regel bearbeiten' : 'Neue Automatisierungsregel'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name & Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="z.B. VIP-Kunden priorisieren" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Beschreibung (optional)</label>
              <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Was macht diese Regel?" />
            </div>

            {/* Trigger */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Auslöser</label>
              <Select value={trigger} onValueChange={setTrigger}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRIGGERS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Bedingungen</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConditions([...conditions, { field: 'priority', operator: 'eq', value: '' }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Bedingung
                </Button>
              </div>
              {conditions.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={c.field} onValueChange={v => {
                    const newC = [...conditions]; newC[i] = { ...newC[i], field: v }; setConditions(newC)
                  }}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONDITION_FIELDS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={c.operator} onValueChange={v => {
                    const newC = [...conditions]; newC[i] = { ...newC[i], operator: v }; setConditions(newC)
                  }}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1"
                    value={c.value}
                    onChange={e => {
                      const newC = [...conditions]; newC[i] = { ...newC[i], value: e.target.value }; setConditions(newC)
                    }}
                    placeholder="Wert"
                  />
                  <Button variant="ghost" size="sm" onClick={() => setConditions(conditions.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Aktionen</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActions([...actions, { type: 'set_priority', value: '' }])}
                >
                  <Plus className="h-3 w-3 mr-1" /> Aktion
                </Button>
              </div>
              {actions.map((a, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={a.type} onValueChange={v => {
                    const newA = [...actions]; newA[i] = { ...newA[i], type: v }; setActions(newA)
                  }}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPES.map(at => (
                        <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    className="flex-1"
                    value={a.value}
                    onChange={e => {
                      const newA = [...actions]; newA[i] = { ...newA[i], value: e.target.value }; setActions(newA)
                    }}
                    placeholder={a.type === 'escalate' ? 'L2' : a.type === 'set_priority' ? 'high' : 'Wert'}
                  />
                  <Button variant="ghost" size="sm" onClick={() => setActions(actions.filter((_, j) => j !== i))}>
                    <Trash2 className="h-3 w-3 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={saveRule} disabled={saving || !name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? 'Speichern' : 'Erstellen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
