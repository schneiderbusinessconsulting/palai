import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Inbox,
  MessageSquare,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
} from 'lucide-react'
import Link from 'next/link'

const stats = [
  {
    title: 'Offene E-Mails',
    value: '12',
    change: '+3 heute',
    icon: Inbox,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  {
    title: 'Chat-Anfragen',
    value: '8',
    change: '+5 heute',
    icon: MessageSquare,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  {
    title: 'Beantwortet heute',
    value: '24',
    change: '92% AI-assisted',
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
  },
  {
    title: 'Ø Antwortzeit',
    value: '4.2h',
    change: '-12% vs letzte Woche',
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
  },
]

const recentEmails = [
  {
    id: 1,
    from: 'maria.mueller@gmail.com',
    subject: 'Frage zur Hypnose-Ausbildung',
    time: 'vor 2h',
    confidence: 92,
  },
  {
    id: 2,
    from: 'thomas.weber@bluewin.ch',
    subject: 'Ratenzahlung möglich?',
    time: 'vor 5h',
    confidence: 87,
  },
  {
    id: 3,
    from: 'info@firma.ch',
    subject: 'Firmenausbildung anfragen',
    time: 'vor 1d',
    confidence: 45,
  },
]

function getConfidenceColor(confidence: number) {
  if (confidence >= 85) return 'bg-green-500'
  if (confidence >= 70) return 'bg-amber-500'
  return 'bg-red-500'
}

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <Header
        title="Dashboard"
        description="Willkommen zurück! Hier ist dein Überblick."
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                    {stat.value}
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
            <div className="space-y-3">
              {recentEmails.map((email) => (
                <Link
                  key={email.id}
                  href="/inbox"
                  className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <div
                    className={`w-2 h-2 rounded-full ${getConfidenceColor(email.confidence)}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {email.subject}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {email.from}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {email.time}
                    </p>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {email.confidence}%
                    </p>
                  </div>
                </Link>
              ))}
            </div>
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
                  12 ausstehend
                </p>
              </Link>
              <Link
                href="/chat"
                className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-left"
              >
                <MessageSquare className="h-6 w-6 text-purple-600 mb-2" />
                <p className="font-medium text-slate-900 dark:text-white">
                  Chat starten
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  AI Assistent
                </p>
              </Link>
              <Link
                href="/templates"
                className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors text-left"
              >
                <CheckCircle2 className="h-6 w-6 text-green-600 mb-2" />
                <p className="font-medium text-slate-900 dark:text-white">
                  Templates
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  23 verfügbar
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
                  127 Einträge
                </p>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
