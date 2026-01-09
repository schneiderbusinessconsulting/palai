'use client'

import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  TrendingUp,
  TrendingDown,
  Mail,
  MessageSquare,
  CheckCircle,
  Clock,
  Brain,
  ThumbsUp,
} from 'lucide-react'

// Mock data for analytics
const stats = [
  {
    title: 'E-Mails beantwortet',
    value: '234',
    change: '+12%',
    trend: 'up',
    icon: Mail,
  },
  {
    title: 'Chat-Konversationen',
    value: '89',
    change: '+23%',
    trend: 'up',
    icon: MessageSquare,
  },
  {
    title: 'AI Übernahmerate',
    value: '78%',
    change: '+5%',
    trend: 'up',
    icon: Brain,
  },
  {
    title: 'Ø Antwortzeit',
    value: '3.2h',
    change: '-18%',
    trend: 'down',
    icon: Clock,
  },
]

const topTopics = [
  { topic: 'Hypnose-Ausbildung', count: 67, percentage: 29 },
  { topic: 'Preise & Ratenzahlung', count: 52, percentage: 22 },
  { topic: 'Kurstermine', count: 41, percentage: 18 },
  { topic: 'Zertifizierung', count: 35, percentage: 15 },
  { topic: 'Life Coach Ausbildung', count: 24, percentage: 10 },
  { topic: 'Sonstiges', count: 15, percentage: 6 },
]

const aiPerformance = {
  totalDrafts: 234,
  approved: 156,
  edited: 62,
  rejected: 16,
}

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Header
          title="Analytics"
          description="Übersicht über Support-Performance und AI-Nutzung"
        />
        <Select defaultValue="7d">
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Zeitraum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Letzte 24h</SelectItem>
            <SelectItem value="7d">Letzte 7 Tage</SelectItem>
            <SelectItem value="30d">Letzte 30 Tage</SelectItem>
            <SelectItem value="90d">Letzte 90 Tage</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
                  <div className="flex items-center gap-1 mt-1">
                    {stat.trend === 'up' ? (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-green-500" />
                    )}
                    <span className="text-xs text-green-600 dark:text-green-400">
                      {stat.change}
                    </span>
                    <span className="text-xs text-slate-400">vs letzte Woche</span>
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                  <stat.icon className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Topics */}
        <Card>
          <CardHeader>
            <CardTitle>Häufigste Themen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topTopics.map((item) => (
                <div key={item.topic}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-700 dark:text-slate-300">
                      {item.topic}
                    </span>
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Performance */}
        <Card>
          <CardHeader>
            <CardTitle>AI Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Donut Chart Placeholder */}
              <div className="flex items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="20"
                      className="text-slate-100 dark:text-slate-800"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="20"
                      strokeDasharray={`${(aiPerformance.approved / aiPerformance.totalDrafts) * 377} 377`}
                      className="text-green-500"
                    />
                    <circle
                      cx="80"
                      cy="80"
                      r="60"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="20"
                      strokeDasharray={`${(aiPerformance.edited / aiPerformance.totalDrafts) * 377} 377`}
                      strokeDashoffset={`${-((aiPerformance.approved / aiPerformance.totalDrafts) * 377)}`}
                      className="text-amber-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {Math.round((aiPerformance.approved / aiPerformance.totalDrafts) * 100)}%
                      </p>
                      <p className="text-xs text-slate-500">Übernahme</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Übernommen</span>
                  </div>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {aiPerformance.approved}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Bearbeitet</span>
                  </div>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {aiPerformance.edited}
                  </p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Abgelehnt</span>
                  </div>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    {aiPerformance.rejected}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Zusammenfassung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <ThumbsUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Zufriedenheitsrate</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">94%</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <CheckCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">First-Contact-Resolution</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">87%</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Brain className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Ø Confidence Score</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">82%</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">Zeit gespart</p>
                <p className="text-xl font-semibold text-slate-900 dark:text-white">~45h/Woche</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
