'use client'

import { useState, useEffect, useCallback } from 'react'
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
import {
  Loader2,
  Plus,
  Calendar,
  User,
  Mail,
} from 'lucide-react'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  assigned_agent_id: string | null
  related_email_id: string | null
  related_customer_email: string | null
  due_date: string | null
  completed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface Agent {
  id: string
  name: string
  email: string
}

const statusConfig: Record<string, { label: string; color: string; next: string }> = {
  open: { label: 'Offen', color: 'bg-gold-100 text-gold-700 dark:bg-gold-900/30 dark:text-gold-400', next: 'in_progress' },
  in_progress: { label: 'In Bearbeitung', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', next: 'done' },
  done: { label: 'Erledigt', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', next: 'open' },
}

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Niedrig', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400' },
  normal: { label: 'Normal', color: 'bg-gold-100 text-gold-600 dark:bg-gold-900/30 dark:text-gold-400' },
  high: { label: 'Hoch', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  urgent: { label: 'Dringend', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // New task form
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPriority, setNewPriority] = useState('normal')
  const [newAgent, setNewAgent] = useState('')
  const [newDueDate, setNewDueDate] = useState('')

  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/tasks?${params}`)
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks || [])
      }
    } catch (e) {
      console.error('Failed to fetch tasks:', e)
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      if (res.ok) {
        const data = await res.json()
        setAgents(data.agents || [])
      }
    } catch (e) {
      console.error('Failed to fetch agents:', e)
    }
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const cycleStatus = async (task: Task) => {
    const nextStatus = statusConfig[task.status]?.next || 'open'
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, status: nextStatus }),
      })
      if (res.ok) {
        setTasks(prev =>
          prev.map(t =>
            t.id === task.id
              ? { ...t, status: nextStatus, completed_at: nextStatus === 'done' ? new Date().toISOString() : null }
              : t
          )
        )
      }
    } catch (e) {
      console.error('Failed to update task:', e)
    }
  }

  const createTask = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const body: Record<string, string> = {
        title: newTitle.trim(),
        priority: newPriority,
      }
      if (newDescription.trim()) body.description = newDescription.trim()
      if (newAgent && newAgent !== 'none') body.assigned_agent_id = newAgent
      if (newDueDate) body.due_date = new Date(newDueDate).toISOString()

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setDialogOpen(false)
        setNewTitle('')
        setNewDescription('')
        setNewPriority('normal')
        setNewAgent('')
        setNewDueDate('')
        fetchTasks()
      }
    } catch (e) {
      console.error('Failed to create task:', e)
    } finally {
      setCreating(false)
    }
  }

  const filteredTasks = tasks.filter(t => {
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  const getAgentName = (agentId: string | null) => {
    if (!agentId) return null
    const agent = agents.find(a => a.id === agentId)
    return agent?.name || null
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <Header title="Aufgaben" description="Aufgaben verwalten und nachverfolgen" />
        <Button onClick={() => setDialogOpen(true)} className="mt-1">
          <Plus className="h-4 w-4 mr-2" /> Neue Aufgabe
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="open">Offen</SelectItem>
            <SelectItem value="in_progress">In Bearbeitung</SelectItem>
            <SelectItem value="done">Erledigt</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Priorität" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prioritäten</SelectItem>
            <SelectItem value="low">Niedrig</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="high">Hoch</SelectItem>
            <SelectItem value="urgent">Dringend</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-slate-500">Keine Aufgaben gefunden</p>
            {statusFilter === 'all' && priorityFilter === 'all' ? (
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Erste Aufgabe erstellen
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => { setStatusFilter('all'); setPriorityFilter('all') }}>
                Filter zurücksetzen
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map(task => {
            const sc = statusConfig[task.status] || statusConfig.open
            const pc = priorityConfig[task.priority] || priorityConfig.normal
            const agentName = getAgentName(task.assigned_agent_id)

            return (
              <Card key={task.id} className="py-0">
                <CardContent className="p-4 flex items-center gap-4">
                  {/* Status badge (clickable) */}
                  <button
                    onClick={() => cycleStatus(task)}
                    title={`Status wechseln → ${statusConfig[sc.next]?.label || 'Offen'}`}
                    aria-label={`Status: ${sc.label}. Klicken um zu ${statusConfig[sc.next]?.label || 'Offen'} zu wechseln`}
                  >
                    <Badge className={`${sc.color} cursor-pointer hover:opacity-80 transition-opacity`}>
                      {sc.label}
                    </Badge>
                  </button>

                  {/* Title & description */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${task.status === 'done' ? 'line-through text-slate-400' : ''}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{task.description}</p>
                    )}
                  </div>

                  {/* Priority */}
                  <Badge className={`${pc.color} text-xs`}>{pc.label}</Badge>

                  {/* Due date */}
                  {task.due_date && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                      <Calendar className="h-3 w-3" />
                      {new Date(task.due_date).toLocaleDateString('de-CH')}
                    </span>
                  )}

                  {/* Assigned agent */}
                  {agentName && (
                    <span className="flex items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                      <User className="h-3 w-3" />
                      {agentName}
                    </span>
                  )}

                  {/* Related email */}
                  {task.related_customer_email && (
                    <span className="flex items-center gap-1 text-xs text-slate-400" title={`Verknüpfte E-Mail: ${task.related_customer_email}`}>
                      <Mail className="h-3 w-3" />
                      <span className="hidden sm:inline truncate max-w-[120px]">{task.related_customer_email}</span>
                    </span>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neue Aufgabe erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Titel</Label>
              <Input
                id="task-title"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="Aufgabe beschreiben..."
              />
            </div>
            <div>
              <Label htmlFor="task-desc">Beschreibung</Label>
              <Textarea
                id="task-desc"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                placeholder="Weitere Details..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priorität</Label>
                <Select value={newPriority} onValueChange={setNewPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Niedrig</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">Hoch</SelectItem>
                    <SelectItem value="urgent">Dringend</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Zuweisen an</Label>
                <Select value={newAgent} onValueChange={setNewAgent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Agent wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Keiner</SelectItem>
                    {agents.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="task-due">Fällig am</Label>
              <Input
                id="task-due"
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Abbrechen</Button>
            <Button onClick={createTask} disabled={creating || !newTitle.trim()}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Erstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
