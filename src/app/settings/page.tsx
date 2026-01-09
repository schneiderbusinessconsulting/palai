'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
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
  Bell,
  Palette,
  Database,
  Shield,
  Save,
} from 'lucide-react'

export default function SettingsPage() {
  const [signature, setSignature] = useState(`Herzliche Grüsse
Max Mustermann
Palacios Institut`)

  return (
    <div className="space-y-6">
      <Header
        title="Einstellungen"
        description="Verwalte dein Profil und App-Einstellungen"
      />

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="h-4 w-4" />
            Profil
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Palette className="h-4 w-4" />
            AI Einstellungen
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Database className="h-4 w-4" />
            Integrationen
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Shield className="h-4 w-4" />
            Team
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Persönliche Informationen</CardTitle>
              <CardDescription>
                Diese Informationen werden in E-Mail-Antworten verwendet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Vorname
                  </label>
                  <Input defaultValue="Max" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Nachname
                  </label>
                  <Input defaultValue="Mustermann" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  E-Mail
                </label>
                <Input type="email" defaultValue="max@palacios-institut.ch" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>E-Mail Signatur</CardTitle>
              <CardDescription>
                Wird automatisch an AI-generierte Antworten angehängt
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                rows={4}
                className="font-mono text-sm"
              />
              <Button className="gap-2">
                <Save className="h-4 w-4" />
                Speichern
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Settings Tab */}
        <TabsContent value="ai" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>AI Antwort-Stil</CardTitle>
              <CardDescription>
                Passe an, wie AI-generierte Antworten klingen sollen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tonalität
                </label>
                <Select defaultValue="friendly">
                  <SelectTrigger>
                    <SelectValue placeholder="Wähle Tonalität" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formell</SelectItem>
                    <SelectItem value="friendly">Freundlich</SelectItem>
                    <SelectItem value="casual">Locker</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Sprache
                </label>
                <Select defaultValue="de-ch">
                  <SelectTrigger>
                    <SelectValue placeholder="Wähle Sprache" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="de-ch">Deutsch (Schweiz)</SelectItem>
                    <SelectItem value="de-de">Deutsch (Deutschland)</SelectItem>
                    <SelectItem value="en">Englisch</SelectItem>
                    <SelectItem value="fr">Französisch</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Antwortlänge
                </label>
                <Select defaultValue="medium">
                  <SelectTrigger>
                    <SelectValue placeholder="Wähle Länge" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Kurz & knapp</SelectItem>
                    <SelectItem value="medium">Ausgewogen</SelectItem>
                    <SelectItem value="detailed">Ausführlich</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Confidence Schwellwerte</CardTitle>
              <CardDescription>
                Definiere, wann Antworten als sicher gelten
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Grün (Sicher)</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Kann direkt gesendet werden</p>
                </div>
                <Badge className="bg-green-500">&gt; 85%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Gelb (Prüfen)</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Review empfohlen</p>
                </div>
                <Badge className="bg-amber-500">70-85%</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Rot (Unsicher)</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Manuelle Prüfung nötig</p>
                </div>
                <Badge className="bg-red-500">&lt; 70%</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                HubSpot
              </CardTitle>
              <CardDescription>
                E-Mail Integration und Knowledge Base Sync
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">Verbunden</span>
                </div>
                <Button variant="outline" size="sm">Trennen</Button>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Webhook URL
                </label>
                <Input
                  readOnly
                  value="https://your-domain.com/api/webhooks/hubspot"
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                OpenAI
              </CardTitle>
              <CardDescription>
                AI Modell für Antwortgenerierung
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">API Key konfiguriert</span>
                </div>
                <Badge variant="outline">GPT-4o</Badge>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Modell
                </label>
                <Select defaultValue="gpt-4o">
                  <SelectTrigger>
                    <SelectValue placeholder="Wähle Modell" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o (Empfohlen)</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Supabase
              </CardTitle>
              <CardDescription>
                Datenbank und Vektor-Speicher
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">Verbunden</span>
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-400">127 Knowledge Chunks</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Team Mitglieder</CardTitle>
              <CardDescription>
                Verwalte Zugriff und Berechtigungen
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: 'Max Mustermann', email: 'max@palacios-institut.ch', role: 'Admin' },
                  { name: 'Anna Schmidt', email: 'anna@palacios-institut.ch', role: 'Member' },
                  { name: 'Peter Meier', email: 'peter@palacios-institut.ch', role: 'Member' },
                ].map((member) => (
                  <div
                    key={member.email}
                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-medium">
                        {member.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{member.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{member.email}</p>
                      </div>
                    </div>
                    <Badge variant={member.role === 'Admin' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="mt-4 w-full">
                + Mitglied einladen
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
