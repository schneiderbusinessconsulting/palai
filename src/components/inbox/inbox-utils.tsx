import { Badge } from '@/components/ui/badge'
import { Bell, FileText, User, TrendingUp, ShieldAlert, Tag } from 'lucide-react'

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
      return <Badge className="bg-gold-500 hover:bg-gold-600">Draft bereit</Badge>
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
        <Badge variant="outline" className={`gap-1 ${needsResponse ? 'text-gold-600 border-gold-300' : 'text-slate-500 border-slate-300'}`}>
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

// Topic tag color mapping
const topicTagColors: Record<string, string> = {
  'Anfrage': 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:border-teal-800',
  'Beschwerde': 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800',
  'Bestellung': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800',
  'Stornierung': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
  'Zertifikat': 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800',
  'Kurs': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800',
  'Feedback': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
  'Rechnung': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  'Terminanfrage': 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-800',
  'Anmeldung': 'bg-gold-50 text-gold-700 border-gold-200 dark:bg-gold-900/20 dark:text-gold-400 dark:border-gold-800',
  'Produkt': 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
  'Kooperation': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
}

export function getTopicTagBadges(tags?: string[] | null) {
  if (!tags || tags.length === 0) return null
  return (
    <div className="inline-flex items-center gap-1 flex-wrap">
      {tags.map(tag => (
        <span
          key={tag}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-medium ${
            topicTagColors[tag] || 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
          }`}
        >
          <Tag className="h-2.5 w-2.5" />
          {tag}
        </span>
      ))}
    </div>
  )
}

export function getSpamBadge(isSpam?: boolean, spamScore?: number) {
  if (!isSpam) return null
  return (
    <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 gap-1">
      <ShieldAlert className="h-3 w-3" />
      Spam {spamScore ? `(${spamScore}%)` : ''}
    </Badge>
  )
}

