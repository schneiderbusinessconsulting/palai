'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Inbox,
  MessageSquare,
  BookOpen,
  FileText,
  GraduationCap,
  BarChart3,
  Settings,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ChevronsUpDown,
  Check,
  Users,
  UserCog,
  ClipboardList,
  Briefcase,
} from 'lucide-react'
import { useTheme } from '@/components/providers/theme-provider'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const dashboards = [
  { name: 'Intelligence', href: '/', current: true },
]

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Inbox', href: '/inbox', icon: Inbox, badgeKey: 'pendingEmails' },
  { name: 'Aufgaben', href: '/tasks', icon: ClipboardList, badgeKey: 'openTasks' },
  { name: 'Insights', href: '/insights', icon: BarChart3, badgeKey: 'escalations' },
  { name: 'Deals', href: '/deals', icon: Briefcase },
  { name: 'Kunden', href: '/customers', icon: Users },
  { name: 'Team', href: '/agents', icon: UserCog },
  { name: 'Chat', href: '/chat', icon: MessageSquare },
  { name: 'Knowledge Base', href: '/knowledge', icon: BookOpen },
  { name: 'AI Learning', href: '/learning', icon: GraduationCap, badgeKey: 'learningPending' },
  { name: 'Templates', href: '/templates', icon: FileText },
  { name: 'Kurse & Preise', href: '/courses', icon: GraduationCap },
  { name: 'Einstellungen', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { theme, themeMode, toggleTheme, setThemeMode } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [badges, setBadges] = useState<Record<string, number>>({})

  // Fetch pending email count + learning cases count
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [emailRes, learningRes, tasksRes] = await Promise.all([
          fetch('/api/emails?limit=100'),
          fetch('/api/learning?status=pending'),
          fetch('/api/tasks?status=open'),
        ])

        const newBadges: Record<string, number> = {}

        if (emailRes.ok) {
          const data = await emailRes.json()
          const emails = data.emails || []
          const actionable = emails.filter((e: { status: string; email_type?: string; needs_response?: boolean }) =>
            e.email_type !== 'system_alert' &&
            e.email_type !== 'notification' &&
            (e.email_type !== 'form_submission' || e.needs_response)
          )
          const pending = actionable.filter((e: { status: string }) =>
            e.status === 'pending' || e.status === 'draft_ready'
          ).length
          newBadges.pendingEmails = pending

          // Escalation count (L2 + still open)
          const escalated = actionable.filter((e: { status: string; support_level?: string }) =>
            e.support_level === 'L2' && e.status !== 'sent' && e.status !== 'rejected'
          ).length
          newBadges.escalations = escalated
        }

        if (learningRes.ok) {
          const data = await learningRes.json()
          newBadges.learningPending = data.pending || 0
        }

        if (tasksRes.ok) {
          const data = await tasksRes.json()
          newBadges.openTasks = (data.tasks || []).length
        }

        setBadges(newBadges)
      } catch (error) {
        console.error('Failed to fetch sidebar counts:', error)
      }
    }

    fetchCounts()
    // Refresh every 30 seconds
    const interval = setInterval(fetchCounts, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Navigation öffnen"
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm"
      >
        <Menu className="h-5 w-5 text-slate-600 dark:text-slate-300" />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 flex h-screen flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300',
          collapsed ? 'w-20' : 'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo & Dashboard Switcher */}
        <div className="relative px-3 py-4 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => !collapsed && setSwitcherOpen(!switcherOpen)}
            className={cn(
              'flex items-center gap-3 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
              collapsed ? 'p-2 justify-center' : 'px-3 py-2.5'
            )}
          >
            <div
              className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
              style={{ backgroundColor: '#B9965A' }}
            >
              <span
                className="text-white text-lg font-bold"
                style={{ fontFamily: 'Georgia, Times, serif' }}
              >
                P
              </span>
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">
                      Intelligence
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500 text-white rounded">
                      BETA
                    </span>
                  </div>
                </div>
                <ChevronsUpDown className="h-4 w-4 text-slate-400" />
              </>
            )}
          </button>

          {/* Switcher Dropdown */}
          {switcherOpen && !collapsed && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setSwitcherOpen(false)}
              />
              <div className="absolute left-3 right-3 top-full mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden">
                {dashboards.map((dashboard) => (
                  <a
                    key={dashboard.name}
                    href={dashboard.href}
                    onClick={() => setSwitcherOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors',
                      dashboard.current && 'bg-slate-50 dark:bg-slate-700/50'
                    )}
                  >
                    <div
                      className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: '#B9965A' }}
                    >
                      <span
                        className="text-white text-lg font-bold"
                        style={{ fontFamily: 'Georgia, Times, serif' }}
                      >
                        P
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white text-sm">
                          {dashboard.name}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500 text-white rounded">
                          BETA
                        </span>
                      </div>
                    </div>
                    {dashboard.current && (
                      <Check className="h-4 w-4 text-blue-500" />
                    )}
                  </a>
                ))}
              </div>
            </>
          )}

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden absolute top-4 right-3 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {(() => {
            const groups = [
              { label: 'Support', items: ['Dashboard', 'Inbox', 'Aufgaben'] },
              { label: 'Insights', items: ['Insights', 'Deals', 'Kunden', 'Team'] },
              { label: 'Wissen', items: ['Knowledge Base', 'Chat', 'AI Learning', 'Templates', 'Kurse & Preise'] },
              { label: 'System', items: ['Einstellungen'] },
            ]

            return groups.map((group) => {
              const groupNavItems = navigation.filter(item => group.items.includes(item.name))
              if (groupNavItems.length === 0) return null

              return (
                <div key={group.label}>
                  {!collapsed && (
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-600 px-3 mb-1 mt-4 block font-medium">
                      {group.label}
                    </span>
                  )}
                  <ul className="space-y-1">
                    {groupNavItems.map((item) => {
                      const isActive = pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(item.href))

                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            onClick={() => setMobileOpen(false)}
                            {...(isActive ? { 'aria-current': 'page' as const } : {})}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                              isActive
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                            )}
                          >
                            <item.icon className="h-5 w-5 flex-shrink-0" />
                            {!collapsed && (
                              <>
                                <span className="flex-1">{item.name}</span>
                                {item.badgeKey && badges[item.badgeKey] > 0 && (
                                  <span
                                    className={cn(
                                      'px-2 py-0.5 text-xs font-medium rounded-full',
                                      isActive
                                        ? 'bg-white/20 text-white'
                                        : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                    )}
                                  >
                                    {badges[item.badgeKey]}
                                  </span>
                                )}
                              </>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          })()}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-2">
          {/* Theme Toggle */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className={cn(
                'flex items-center gap-3 flex-1 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
                collapsed && 'justify-center'
              )}
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
              {!collapsed && (
                <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
              )}
            </button>
            {!collapsed && (
              <button
                onClick={() => setThemeMode(themeMode === 'auto' ? 'manual' : 'auto')}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-medium transition-colors',
                  themeMode === 'auto'
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                )}
                title={themeMode === 'auto' ? 'Automatisch (20-07 Uhr dunkel)' : 'Klick für Auto-Modus'}
              >
                Auto
              </button>
            )}
          </div>

          {/* Collapse Toggle (Desktop only) */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Sidebar ausklappen' : 'Sidebar einklappen'}
            className="hidden lg:flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5 mx-auto" />
            ) : (
              <>
                <ChevronLeft className="h-5 w-5" />
                <span>Einklappen</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Spacer for main content */}
      <div
        className={cn(
          'hidden lg:block flex-shrink-0 transition-all duration-300',
          collapsed ? 'w-20' : 'w-64'
        )}
      />
    </>
  )
}
