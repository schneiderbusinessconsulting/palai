import { Badge } from '@/components/ui/badge'
import { Bell, FileText, User, TrendingUp } from 'lucide-react'

export function getConfidenceColor(confidence: number) {
  if (confidence >= 0.85) return 'bg-green-500'
  if (confidence >= 0.7) return 'bg-amber-500'
  return 'bg-red-500'
}

export function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary">Ausstehend</Badge>
    case 'draft_ready':
      return <Badge className="bg-blue-500 hover:bg-blue-600">Draft bereit</Badge>
    case 'approved':
      return <Badge className="bg-green-500 hover:bg-green-600">Genehmigt</Badge>
    case 'sent':
      return <Badge className="bg-slate-500 hover:bg-slate-600">Gesendet</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export function getEmailTypeBadge(emailType?: string, needsResponse?: boolean) {
  switch (emailType) {
    case 'system_alert':
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-300 gap-1">
          <Bell className="h-3 w-3" />
          System
        </Badge>
      )
    case 'notification':
      return (
        <Badge variant="outline" className="text-purple-600 border-purple-300 gap-1">
          <Bell className="h-3 w-3" />
          Notification
        </Badge>
      )
    case 'form_submission':
      return (
        <Badge variant="outline" className={`gap-1 ${needsResponse ? 'text-blue-600 border-blue-300' : 'text-slate-500 border-slate-300'}`}>
          <FileText className="h-3 w-3" />
          Formular
        </Badge>
      )
    case 'customer_inquiry':
    default:
      return (
        <Badge variant="outline" className="text-green-600 border-green-300 gap-1">
          <User className="h-3 w-3" />
          Anfrage
        </Badge>
      )
  }
}

export function getBuyingIntentBadge(score?: number) {
  if (!score || score <= 0) return null
  if (score >= 70) return (
    <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1">
      <TrendingUp className="h-3 w-3" />
      {score}% Intent
    </Badge>
  )
  if (score >= 40) return (
    <Badge className="bg-amber-500 hover:bg-amber-600 gap-1">
      <TrendingUp className="h-3 w-3" />
      {score}%
    </Badge>
  )
  return null // Low intent not shown
}

const happinessEmojis: Record<number, { emoji: string; label: string; color: string }> = {
  1: { emoji: '😡', label: 'Sehr unzufrieden', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  2: { emoji: '😟', label: 'Unzufrieden', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  3: { emoji: '😐', label: 'Neutral', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
  4: { emoji: '😊', label: 'Zufrieden', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  5: { emoji: '😍', label: 'Sehr zufrieden', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
}

export function getHappinessBadge(score?: number | null, size: 'sm' | 'lg' = 'sm') {
  if (!score || score < 1 || score > 5) return null
  const h = happinessEmojis[score]
  if (size === 'lg') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${h.color}`}>
        <span className="text-base">{h.emoji}</span>
        {h.label} ({score}/5)
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${h.color}`} title={h.label}>
      {h.emoji} {score}/5
    </span>
  )
}

