'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ScrollText, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'

interface AuditEntry {
  id: string
  action: string
  resource_type?: string
  resource_id?: string
  details?: Record<string, unknown>
  agent_name?: string
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  send_email: 'E-Mail gesendet',
  assign_email: 'E-Mail zugewiesen',
  generate_draft: 'Entwurf generiert',
  edit_draft: 'Entwurf bearbeitet',
  classify_email: 'E-Mail klassifiziert',
  sync_emails: 'E-Mails synchronisiert',
  create_template: 'Template erstellt',
  update_template: 'Template aktualisiert',
  delete_template: 'Template gelöscht',
  update_knowledge: 'Wissensbasis aktualisiert',
  mark_as_sent: 'Als gesendet markiert',
  dismiss_email: 'E-Mail ausgeblendet',
}

const ACTION_COLORS: Record<string, string> = {
  send_email: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  assign_email: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  generate_draft: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  classify_email: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  sync_emails: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  dismiss_email: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

export function AuditTrailTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tableExists, setTableExists] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [actionFilter, setActionFilter] = useState('all')
  const limit = 25

  const fetchAudit = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(page * limit),
      })
      if (actionFilter !== 'all') params.set('action', actionFilter)

      const res = await fetch(`/api/audit?${params}`)
      if (res.ok) {
        const data = await res.json()
        setEntries(data.entries || [])
        setTotal(data.total || 0)
        if (data.tableExists === false) setTableExists(false)
      }
    } catch (e) {
      console.error('Failed to fetch audit log:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAudit() }, [page, actionFilter])

  if (!tableExists) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">Audit-Log-Tabelle nicht gefunden</p>
              <p className="text-sm text-slate-500">
                Die Tabelle &quot;audit_log&quot; existiert nicht in der Datenbank.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5" />
                Audit Trail
              </CardTitle>
              <CardDescription>
                Protokoll aller Systemaktionen ({total} Einträge)
              </CardDescription>
            </div>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0) }}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Alle Aktionen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Aktionen</SelectItem>
                {Object.entries(ACTION_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <ScrollText className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p>Keine Audit-Einträge gefunden</p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {entries.map(entry => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 text-sm"
                  >
                    <span className="text-xs text-slate-400 w-32 flex-shrink-0">
                      {new Date(entry.created_at).toLocaleString('de-CH', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    <Badge className={`${ACTION_COLORS[entry.action] || 'bg-slate-100 text-slate-700'} text-xs`}>
                      {ACTION_LABELS[entry.action] || entry.action}
                    </Badge>
                    {entry.agent_name && (
                      <span className="text-xs text-slate-500">{entry.agent_name}</span>
                    )}
                    {entry.resource_type && (
                      <span className="text-xs text-slate-400 truncate">
                        {entry.resource_type}
                        {entry.resource_id && `: ${entry.resource_id.substring(0, 8)}...`}
                      </span>
                    )}
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <span className="text-xs text-slate-400 truncate ml-auto">
                        {JSON.stringify(entry.details).substring(0, 60)}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-slate-500">
                  {page * limit + 1}–{Math.min((page + 1) * limit, total)} von {total}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={(page + 1) * limit >= total}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
