'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Search, Mail, AlertTriangle, TrendingUp, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  icon: 'mail' | 'alert' | 'trending' | 'clock'
  title: string
  description: string
  time: string
  read: boolean
}

const iconMap = {
  mail: Mail,
  alert: AlertTriangle,
  trending: TrendingUp,
  clock: Clock,
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Gerade eben'
  if (mins < 60) return `vor ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `vor ${hours}h`
  const days = Math.floor(hours / 24)
  return `vor ${days}d`
}

interface HeaderProps {
  title: string
  description?: string
}

export function Header({ title, description }: HeaderProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const loadNotifications = useCallback(async () => {
    try {
      const supabase = createClient()

      // Fetch recent unread emails as notifications
      const { data: emails } = await supabase
        .from('incoming_emails')
        .select('id, subject, from_email, created_at, status')
        .order('created_at', { ascending: false })
        .limit(5)

      const notifs: Notification[] = []

      // New emails waiting for response
      const openEmails = emails?.filter(e => e.status === 'open') || []
      if (openEmails.length > 0) {
        openEmails.slice(0, 3).forEach(email => {
          const ago = getTimeAgo(email.created_at)
          notifs.push({
            id: `email-${email.id}`,
            icon: 'mail',
            title: email.subject || 'Neue E-Mail',
            description: email.from_email || 'Unbekannt',
            time: ago,
            read: false,
          })
        })
      }

      // Check for SLA warnings (breached or at-risk emails)
      const { data: slaEmails } = await supabase
        .from('incoming_emails')
        .select('id, subject, sla_status')
        .in('status', ['pending', 'draft_ready'])
        .in('sla_status', ['breached', 'at_risk'])
        .order('received_at', { ascending: true })
        .limit(2)

      slaEmails?.forEach(email => {
        notifs.push({
          id: `sla-${email.id}`,
          icon: 'clock',
          title: email.sla_status === 'breached' ? 'SLA Verletzt' : 'SLA Warnung',
          description: email.subject || 'E-Mail nahe SLA-Deadline',
          time: email.sla_status === 'breached' ? 'Überfällig' : 'Bald fällig',
          read: false,
        })
      })

      // Check for high buying intent
      const { data: biEmails } = await supabase
        .from('incoming_emails')
        .select('id, subject, buying_intent_score')
        .gte('buying_intent_score', 70)
        .order('created_at', { ascending: false })
        .limit(2)

      biEmails?.forEach(email => {
        notifs.push({
          id: `bi-${email.id}`,
          icon: 'trending',
          title: 'Hot Lead erkannt',
          description: email.subject || 'Hohe Kaufabsicht',
          time: `Score: ${email.buying_intent_score}`,
          read: false,
        })
      })

      setNotifications(notifs)
      setUnreadCount(notifs.filter(n => !n.read).length)
    } catch {
      // Silently fail - notifications are non-critical
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications()
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="pt-12 lg:pt-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Suchen..."
            aria-label="Suche"
            className="pl-9 w-64 bg-white dark:bg-slate-800"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const query = (e.target as HTMLInputElement).value.trim()
                if (query) router.push(`/inbox?search=${encodeURIComponent(query)}`)
              }
            }}
          />
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative" aria-label="Benachrichtigungen">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] font-medium text-white flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>Benachrichtigungen</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-normal"
                >
                  Alle gelesen
                </button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifications.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                Keine neuen Benachrichtigungen
              </div>
            ) : (
              notifications.map(notif => {
                const Icon = iconMap[notif.icon]
                return (
                  <DropdownMenuItem key={notif.id} className="flex items-start gap-3 p-3 cursor-pointer">
                    <div className={`mt-0.5 p-1.5 rounded-full ${
                      notif.icon === 'alert' ? 'bg-amber-100 text-amber-600' :
                      notif.icon === 'trending' ? 'bg-green-100 text-green-600' :
                      notif.icon === 'clock' ? 'bg-red-100 text-red-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${notif.read ? 'text-slate-600' : 'font-medium text-slate-900 dark:text-white'}`}>
                        {notif.title}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{notif.description}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap mt-0.5">{notif.time}</span>
                  </DropdownMenuItem>
                )
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="rounded-full" aria-label="Benutzermenu">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-600 text-white text-sm">
                  MP
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mein Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              Profil
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              Einstellungen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600"
              onClick={async () => {
                const supabase = createClient()
                await supabase.auth.signOut()
                router.push('/auth')
              }}
            >
              Abmelden
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
