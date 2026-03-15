'use client'

import { useRouter } from 'next/navigation'
import { CommandPalette } from '@/components/ui/command-palette'
import { OfflineIndicator } from '@/components/ui/offline-indicator'
import {
  LayoutDashboard,
  Inbox,
  BarChart3,
  Users,
  Bot,
  MessageSquare,
  BookOpen,
  FileText,
  Settings,
  RefreshCw,
  FilePlus,
} from 'lucide-react'

export function GlobalFeatures() {
  const router = useRouter()

  const commands = [
    { id: 'nav-dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, group: 'Navigation', action: () => router.push('/') },
    { id: 'nav-inbox', label: 'Inbox', icon: <Inbox className="h-4 w-4" />, group: 'Navigation', action: () => router.push('/inbox') },
    { id: 'nav-insights', label: 'Insights', icon: <BarChart3 className="h-4 w-4" />, group: 'Navigation', action: () => router.push('/insights') },
    { id: 'nav-customers', label: 'Customers', icon: <Users className="h-4 w-4" />, group: 'Navigation', action: () => router.push('/customers') },
    { id: 'nav-agents', label: 'Agents', icon: <Bot className="h-4 w-4" />, group: 'Navigation', action: () => router.push('/agents') },
    { id: 'nav-chat', label: 'Chat', icon: <MessageSquare className="h-4 w-4" />, group: 'Navigation', action: () => router.push('/chat') },
    { id: 'nav-knowledge', label: 'Knowledge', icon: <BookOpen className="h-4 w-4" />, group: 'Navigation', action: () => router.push('/knowledge') },
    { id: 'nav-templates', label: 'Templates', icon: <FileText className="h-4 w-4" />, group: 'Navigation', action: () => router.push('/templates') },
    { id: 'nav-settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, group: 'Navigation', action: () => router.push('/settings') },
    { id: 'action-sync', label: 'E-Mails synchronisieren', icon: <RefreshCw className="h-4 w-4" />, group: 'Aktionen', action: () => router.push('/inbox') },
    { id: 'action-new-template', label: 'Neues Template', icon: <FilePlus className="h-4 w-4" />, group: 'Aktionen', action: () => router.push('/templates') },
  ]

  return (
    <>
      <CommandPalette commands={commands} />
      <OfflineIndicator />
    </>
  )
}
