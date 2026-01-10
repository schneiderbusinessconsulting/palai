'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Inbox,
  MessageSquare,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface Email {
  id: string
  from_email: string
  subject: string
  received_at: string
  status: string
  email_drafts?: Array<{
    confidence_score: number
  }>
}

interface DashboardStats {
  pendingEmails: number
  draftReadyEmails: number
  sentEmails: number
  totalEmails: number
  avgConfidence: number
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 85) return 'bg-green-500'
  if (confidence >= 70) return 'bg-amber-500'
  return 'bg-red-500'
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 60) return `vor ${diffMins} Min`
  if (diffHours < 24) return `vor ${diffHours}h`
  if (diffDays === 1) return 'gestern'
  return `vor ${diffDays} Tagen`
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [emails, setEmails] = useState<Email[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    pendingEmails: 0,
    draftReadyEmails: 0,
    sentEmails: 0,
    totalEmails: 0,
    avgConfidence: 0,
  })

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/emails?limit=100')
      if (response.ok) {
        const data = await response.json()
        const allEmails: Email[] = data.emails || []

        // Calculate stats
        const pending = allEmails.filter(e => e.status === 'pending').length
        const draftReady = allEmails.filter(e => e.status === 'draft_ready').length
        const sent = allEmails.filter(e => e.status === 'sent').length

        // Calculate average confidence
        const emailsWithDrafts = allEmails.filter(e => e.email_drafts?.[0]?.confidence_score)
        const avgConf = emailsWithDrafts.length > 0
          ? emailsWithDrafts.reduce((sum, e) => sum + (e.email_drafts?.[0]?.confidence_score || 0), 0) / emailsWithDrafts.length
          : 0

        setStats({
          pendingEmails: pending,
          draftReadyEmails: draftReady,
          sentEmails: sent,
          totalEmails: allEmails.length,
          avgConfidence: Math.round(avgConf),
        })

        setEmails(allEmails.slice(0, 5)) // Only show first 5
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const statsCards = [
    {
      title: 'Offene E-Mails',
      value: stats.pendingEmails.toString(),
      change: `${stats.draftReadyEmails} mit Draft`,
      icon: Inbox,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      title: 'Gesendet',
      value: stats.sentEmails.toString(),
      change: `von ${stats.totalEmails} total`,
      icon: CheckCircle2,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
    },
    {
      title: 'Ø Confidence',
      value: `${stats.avgConfidence}%`,
      change: 'AI Sicherheit',
      icon: MessageSquare,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    },
    {
      title: 'Total E-Mails',
      value: stats.totalEmails.toString(),
      change: 'letzte 30 Tage',
      icon: Clock,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
  ]

  return (
    <div className="space-y-6">
      <Header
        title="Dashboard"
        description="Willkommen zurück! Hier ist dein Überblick."
      />

      {/* Refresh Button */}
      <div className="flex justify-end -mt-4">
        <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {isLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    ) : (
                      stat.value
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {stat.change}
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Emails */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Neueste E-Mails
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            ) : emails.length === 0 ? (
              <p className="text-center text-slate-500 py-8">Keine E-Mails vorhanden</p>
            ) : (
              <div className="space-y-3">
                {emails.map((email) => {
                  const confidence = email.email_drafts?.[0]?.confidence_score || 0
                  return (
                    <Link
                      key={email.id}
                      href="/inbox"
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${getConfidenceColor(confidence)}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {email.subject || 'Kein Betreff'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {email.from_email}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {formatTimeAgo(email.received_at)}
                        </p>
                        {confidence > 0 && (
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                            {Math.round(confidence)}%
                          </p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Schnellzugriff
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/inbox"
                className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
              >
                <Inbox className="h-6 w-6 text-blue-600 mb-2" />
                <p className="font-medium text-slate-900 dark:text-white">
                  Inbox öffnen
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {stats.pendingEmails} offen
                </p>
              </Link>
              <Link
                href="/chat"
                className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-left"
              >
                <MessageSquare className="h-6 w-6 text-purple-600 mb-2" />
                <p className="font-medium text-slate-900 dark:text-white">
                  AI Chat
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Chat & Learning
                </p>
              </Link>
              <Link
                href="/chat?mode=learning"
                className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-left"
              >
                <CheckCircle2 className="h-6 w-6 text-green-600 mb-2" />
                <p className="font-medium text-slate-900 dark:text-white">
                  Wissen hinzufügen
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  AI trainieren
                </p>
              </Link>
              <Link
                href="/knowledge"
                className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors text-left"
              >
                <Users className="h-6 w-6 text-amber-600 mb-2" />
                <p className="font-medium text-slate-900 dark:text-white">
                  Knowledge Base
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Übersicht
                </p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
