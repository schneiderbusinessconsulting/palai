'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Calendar, Clock, Plus, User, Mail, Video } from 'lucide-react'

interface Meeting {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  customerEmail: string
  notes: string
  status: 'geplant' | 'bestätigt' | 'abgesagt'
}

const statusConfig: Record<string, { label: string; color: string }> = {
  geplant: { label: 'Geplant', color: 'bg-gold-100 text-gold-700 dark:bg-gold-900/30 dark:text-gold-400' },
  bestätigt: { label: 'Bestätigt', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  abgesagt: { label: 'Abgesagt', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}

const HOURS = Array.from({ length: 9 }, (_, i) => i + 8) // 08:00 - 16:00
const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr']

const initialMeetings: Meeting[] = [
  { id: '1', title: 'Produktdemo', date: '2026-03-16', startTime: '09:00', endTime: '10:00', customerEmail: 'anna@example.com', notes: 'Neue Features vorstellen', status: 'bestätigt' },
  { id: '2', title: 'Onboarding-Call', date: '2026-03-17', startTime: '14:00', endTime: '15:00', customerEmail: 'max@example.com', notes: 'Erstgespräch mit Neukunde', status: 'geplant' },
  { id: '3', title: 'Support-Review', date: '2026-03-18', startTime: '11:00', endTime: '12:00', customerEmail: 'lisa@example.com', notes: 'Offene Tickets besprechen', status: 'geplant' },
  { id: '4', title: 'Vertragsverhandlung', date: '2026-03-19', startTime: '10:00', endTime: '11:30', customerEmail: 'tom@example.com', notes: '', status: 'abgesagt' },
]

function getWeekDay(dateStr: string): number {
  const d = new Date(dateStr)
  const day = d.getDay()
  return day === 0 ? 6 : day - 1 // 0=Mo, 4=Fr
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>(initialMeetings)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null)

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [notes, setNotes] = useState('')

  const resetForm = () => {
    setTitle(''); setDate(''); setStartTime(''); setEndTime('')
    setCustomerEmail(''); setNotes('')
  }

  const createMeeting = () => {
    if (!title.trim() || !date || !startTime || !endTime) return
    const meeting: Meeting = {
      id: Date.now().toString(),
      title: title.trim(), date, startTime, endTime,
      customerEmail: customerEmail.trim(), notes: notes.trim(),
      status: 'geplant',
    }
    setMeetings(prev => [...prev, meeting])
    resetForm()
    setDialogOpen(false)
  }

  const upcoming = [...meetings]
    .filter(m => m.status !== 'abgesagt')
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <Header title="Termine" description="Termine planen und verwalten" />
        <Button onClick={() => setDialogOpen(true)} className="mt-1">
          <Plus className="h-4 w-4 mr-2" /> Neuer Termin
        </Button>
      </div>

      {/* Weekly Calendar Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> Wochenübersicht
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="grid grid-cols-[60px_repeat(5,1fr)] gap-px bg-slate-200 dark:bg-slate-700 rounded min-w-[600px]">
            {/* Header row */}
            <div className="bg-slate-50 dark:bg-slate-800 p-2" />
            {DAYS.map(day => (
              <div key={day} className="bg-slate-50 dark:bg-slate-800 p-2 text-center text-sm font-medium text-slate-600 dark:text-slate-300">
                {day}
              </div>
            ))}
            {/* Time slots */}
            {HOURS.map(hour => (
              <div key={hour} className="contents">
                <div className="bg-white dark:bg-slate-900 p-2 text-xs text-slate-400 text-right pr-3">
                  {`${hour}:00`}
                </div>
                {DAYS.map((_, dayIdx) => {
                  const slotMeetings = meetings.filter(m => {
                    const mDay = getWeekDay(m.date)
                    const mHour = parseInt(m.startTime.split(':')[0])
                    return mDay === dayIdx && mHour === hour
                  })
                  return (
                    <div key={dayIdx} className="bg-white dark:bg-slate-900 p-1 min-h-[40px]">
                      {slotMeetings.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setDetailMeeting(m)}
                          className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate ${
                            m.status === 'abgesagt'
                              ? 'bg-red-50 text-red-400 line-through dark:bg-red-900/20'
                              : m.status === 'bestätigt'
                              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-gold-50 text-gold-700 dark:bg-gold-900/20 dark:text-gold-400'
                          }`}
                        >
                          {m.title}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Meetings List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4" /> Anstehende Termine
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-slate-500">Keine anstehenden Termine</p>
              <p className="text-xs text-slate-400 mt-1">Erstelle einen neuen Termin mit dem Button oben rechts</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map(m => {
                const sc = statusConfig[m.status]
                return (
                  <button
                    key={m.id}
                    onClick={() => setDetailMeeting(m)}
                    className="w-full flex items-center gap-4 p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{m.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(m.date).toLocaleDateString('de-CH')}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {m.startTime} – {m.endTime}
                        </span>
                        {m.customerEmail && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {m.customerEmail}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge className={sc.color}>{sc.label}</Badge>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Meeting Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuen Termin erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="m-title">Titel</Label>
              <Input id="m-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Terminbezeichnung..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="m-date">Datum</Label>
                <Input id="m-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="m-start">Von</Label>
                  <Input id="m-start" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="m-end">Bis</Label>
                  <Input id="m-end" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="m-email">Kunden-E-Mail</Label>
              <Input id="m-email" type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="kunde@example.com" />
            </div>
            <div>
              <Label htmlFor="m-notes">Notizen</Label>
              <Textarea id="m-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Weitere Details..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false) }}>Abbrechen</Button>
            <Button onClick={createMeeting} disabled={!title.trim() || !date || !startTime || !endTime}>Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Detail Dialog */}
      <Dialog open={!!detailMeeting} onOpenChange={() => setDetailMeeting(null)}>
        <DialogContent>
          {detailMeeting && (
            <>
              <DialogHeader>
                <DialogTitle>{detailMeeting.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className={statusConfig[detailMeeting.status].color}>
                    {statusConfig[detailMeeting.status].label}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Calendar className="h-4 w-4" />
                  {new Date(detailMeeting.date).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Clock className="h-4 w-4" />
                  {detailMeeting.startTime} – {detailMeeting.endTime} Uhr
                </div>
                {detailMeeting.customerEmail && (
                  <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                    <User className="h-4 w-4" />
                    {detailMeeting.customerEmail}
                  </div>
                )}
                {detailMeeting.notes && (
                  <div className="pt-2 border-t dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-400">{detailMeeting.notes}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailMeeting(null)}>Schliessen</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
