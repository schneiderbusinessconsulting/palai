'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Loader2, Clock, Save } from 'lucide-react'

interface BusinessHour {
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
}

const DAY_NAMES = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

const DEFAULT_HOURS: BusinessHour[] = [
  { day_of_week: 0, start_time: '08:00', end_time: '17:00', is_active: false },
  { day_of_week: 1, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 2, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 3, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 4, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 5, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 6, start_time: '08:00', end_time: '17:00', is_active: false },
]

export function BusinessHoursTab() {
  const [hours, setHours] = useState<BusinessHour[]>(DEFAULT_HOURS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const fetchHours = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/business-hours')
      if (res.ok) {
        const data = await res.json()
        if (data.hours?.length > 0) {
          // Merge with defaults to ensure all 7 days exist
          const merged = DEFAULT_HOURS.map(d => {
            const existing = data.hours.find((h: BusinessHour) => h.day_of_week === d.day_of_week)
            return existing || d
          })
          setHours(merged)
        }
      }
    } catch { /* use defaults */ }
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchHours()
  }, [])

  const updateHour = (dayOfWeek: number, field: keyof BusinessHour, value: string | boolean) => {
    setHours(prev => prev.map(h =>
      h.day_of_week === dayOfWeek ? { ...h, [field]: value } : h
    ))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/settings/business-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      })
      if (res.ok) {
        setMessage('Gespeichert!')
        setTimeout(() => setMessage(''), 2000)
      } else {
        setMessage('Fehler beim Speichern')
        setTimeout(() => setMessage(''), 3000)
      }
    } catch {
      setMessage('Netzwerkfehler')
      setTimeout(() => setMessage(''), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Geschäftszeiten
        </CardTitle>
        <CardDescription>
          SLA-Berechnung berücksichtigt nur Geschäftszeiten. Zeitzone: Europe/Zurich
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hours.map(h => (
          <div key={h.day_of_week} className="flex items-center gap-4">
            <div className="w-28 flex items-center gap-2">
              <Switch
                checked={h.is_active}
                onCheckedChange={(checked) => updateHour(h.day_of_week, 'is_active', checked)}
              />
              <Label className={`text-sm ${h.is_active ? 'font-medium' : 'text-slate-400'}`}>
                {DAY_NAMES[h.day_of_week]}
              </Label>
            </div>
            {h.is_active ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={h.start_time}
                  onChange={(e) => updateHour(h.day_of_week, 'start_time', e.target.value)}
                  className="w-28 h-8 text-sm"
                />
                <span className="text-slate-400">–</span>
                <Input
                  type="time"
                  value={h.end_time}
                  onChange={(e) => updateHour(h.day_of_week, 'end_time', e.target.value)}
                  className="w-28 h-8 text-sm"
                />
              </div>
            ) : (
              <span className="text-sm text-slate-400">Geschlossen</span>
            )}
          </div>
        ))}

        <div className="flex items-center gap-3 pt-3 border-t">
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Speichern
          </Button>
          {message && (
            <span className={`text-sm ${message.includes('Fehler') || message.includes('Netzwerk') ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
