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
} from 'lucide-react'

interface TriggerWord {
  id: string
  word: string
  category: string
  weight: number
  is_active: boolean
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

const CATEGORY_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  buying_signal: { label: 'Kaufsignal', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: ShoppingCart },
  objection: { label: 'Einwand', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertOctagon },
  churn_risk: { label: 'Churn-Risiko', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: UserMinus },
}

export default function SettingsPage() {
  const [signature, setSignature] = useState(`Herzliche Grüsse
Max Mustermann
Palacios Institut`)

  // Trigger Words state
  const [triggerWords, setTriggerWords] = useState<TriggerWord[]>([])
  const [twLoading, setTwLoading] = useState(false)
  const [newWord, setNewWord] = useState('')
  const [newCategory, setNewCategory] = useState('buying_signal')
  const [addingWord, setAddingWord] = useState(false)

  // Agents state
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(false)
  const [newAgentName, setNewAgentName] = useState('')
  const [newAgentEmail, setNewAgentEmail] = useState('')
  const [newAgentRole, setNewAgentRole] = useState('L1')
  const [addingAgent, setAddingAgent] = useState(false)

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

  const handleAddWord = async () => {
    if (!newWord.trim()) return
    setAddingWord(true)
    try {
      const res = await fetch('/api/settings/trigger-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: newWord, category: newCategory, weight: 1.0 }),
      })
      if (res.ok) {
        setNewWord('')
        fetchTriggerWords()
      }
    } finally {
      setAddingWord(false)
    }
  }

  const handleDeleteWord = async (id: string) => {
    await fetch(`/api/settings/trigger-words/${id}`, { method: 'DELETE' })
    fetchTriggerWords()
  }

  const handleToggleWord = async (id: string, is_active: boolean) => {
    await fetch(`/api/settings/trigger-words/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active }),
    })
    fetchTriggerWords()
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
      if (res.ok) {
        setNewAgentName('')
        setNewAgentEmail('')
        fetchAgents()
      }
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

  const groupedWords = triggerWords.reduce<Record<string, TriggerWord[]>>((acc, w) => {
    if (!acc[w.category]) acc[w.category] = []
    acc[w.category].push(w)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <Header title="Einstellungen" description="Verwalte dein Profil und App-Einstellungen" />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Key className="h-4 w-4" />
            AI
          </TabsTrigger>
          <TabsTrigger value="bi" className="gap-2" onClick={fetchTriggerWords}>
            <ShoppingCart className="h-4 w-4" />
            BI Trigger
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2" onClick={fetchAgents}>
            <Shield className="h-4 w-4" />
            Team
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Database className="h-4 w-4" />
            Integrationen
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Persönliche Informationen</CardTitle>
              <CardDescription>Diese Informationen werden in E-Mail-Antworten verwendet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Vorname</label>
                  <Input defaultValue="Max" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nachname</label>
                  <Input defaultValue="Mustermann" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">E-Mail</label>
                <Input type="email" defaultValue="max@palacios-institut.ch" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>E-Mail Signatur</CardTitle>
              <CardDescription>Wird automatisch an AI-generierte Antworten angehängt</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea value={signature} onChange={(e) => setSignature(e.target.value)} rows={4} className="font-mono text-sm" />
              <Button className="gap-2"><Save className="h-4 w-4" />Speichern</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings Tab */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Antwort-Stil</CardTitle>
              <CardDescription>Passe an, wie AI-generierte Antworten klingen sollen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tonalität</label>
                <Select defaultValue="friendly">
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
                <Select defaultValue="de-ch">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de-ch">Deutsch (Schweiz)</SelectItem>
                    <SelectItem value="de-de">Deutsch (Deutschland)</SelectItem>
                    <SelectItem value="en">Englisch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Confidence Schwellwerte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div><p className="font-medium">Grün (Sicher)</p><p className="text-sm text-slate-500">Kann direkt gesendet werden</p></div>
                <Badge className="bg-green-500">&gt; 85%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <div><p className="font-medium">Gelb (Prüfen)</p><p className="text-sm text-slate-500">Review empfohlen</p></div>
                <Badge className="bg-amber-500">70–85%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div><p className="font-medium">Rot (Unsicher)</p><p className="text-sm text-slate-500">Manuelle Prüfung nötig</p></div>
                <Badge className="bg-red-500">&lt; 70%</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* BI Trigger Words Tab */}
        <TabsContent value="bi" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>BI Trigger Words</CardTitle>
              <CardDescription>
                Schlüsselwörter die in eingehenden E-Mails erkannt werden. Neue Emails werden automatisch gescannt.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Add new word */}
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Neues Schlüsselwort..."
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                  className="flex-1 min-w-48"
                />
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
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
                            {words.map(w => (
                              <div
                                key={w.id}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm ${color} ${w.is_active ? '' : 'opacity-40'}`}
                              >
                                <Switch
                                  checked={w.is_active}
                                  onCheckedChange={(v) => handleToggleWord(w.id, v)}
                                  className="scale-75 data-[state=checked]:bg-current"
                                />
                                <span>{w.word}</span>
                                <button
                                  onClick={() => handleDeleteWord(w.id)}
                                  className="ml-1 hover:opacity-70 transition-opacity"
                                >
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

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Support Agents</CardTitle>
              <CardDescription>
                L1/L2 Tiered Support — Agents verwalten und zuweisen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {agentsLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
              ) : agents.length === 0 ? (
                <p className="text-center text-slate-400 py-4 text-sm">
                  Noch keine Agents — unten hinzufügen oder Migration 006 ausführen
                </p>
              ) : (
                <div className="space-y-3">
                  {agents.map(agent => (
                    <div key={agent.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium text-sm">
                          {agent.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
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
                        <Badge variant={agent.role === 'L2' ? 'default' : 'secondary'}>
                          {agent.role}
                        </Badge>
                        <button
                          onClick={() => handleDeactivateAgent(agent.id)}
                          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Agent */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Agent hinzufügen</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input placeholder="Name" value={newAgentName} onChange={e => setNewAgentName(e.target.value)} />
                  <Input placeholder="E-Mail" type="email" value={newAgentEmail} onChange={e => setNewAgentEmail(e.target.value)} />
                  <Select value={newAgentRole} onValueChange={setNewAgentRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L1">L1 (Erstlinie)</SelectItem>
                      <SelectItem value="L2">L2 (Experte)</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleAddAgent}
                  disabled={addingAgent || !newAgentName || !newAgentEmail}
                  className="gap-2 w-full sm:w-auto"
                >
                  {addingAgent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Agent hinzufügen
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />HubSpot
              </CardTitle>
              <CardDescription>E-Mail Integration und Knowledge Base Sync</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium">Verbunden</span>
                </div>
                <Button variant="outline" size="sm">Trennen</Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Webhook URL</label>
                <Input readOnly value="https://your-domain.com/api/webhooks/hubspot" className="font-mono text-sm" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />OpenAI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium">API Key konfiguriert</span>
                </div>
                <Badge variant="outline">GPT-4o</Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />Supabase
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium">Verbunden</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
