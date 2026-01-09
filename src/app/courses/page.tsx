'use client'

import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Users,
  Clock,
  DollarSign,
  ExternalLink,
  Copy,
} from 'lucide-react'

// Mock data - will be synced with actual course data
const courses = [
  {
    id: '1',
    name: 'Hypnose-Ausbildung',
    description: 'Umfassende Grundausbildung in klinischer Hypnose',
    nextStart: '15. März 2026',
    duration: '12 Tage (6 Monate)',
    price: 4800,
    installments: { count: 6, amount: 850 },
    spotsAvailable: 8,
    totalSpots: 16,
    status: 'active',
  },
  {
    id: '2',
    name: 'Meditation Coach',
    description: 'Zertifizierung zum professionellen Meditation Coach',
    nextStart: '1. April 2026',
    duration: '8 Tage (4 Monate)',
    price: 3600,
    installments: { count: 6, amount: 650 },
    spotsAvailable: 12,
    totalSpots: 20,
    status: 'active',
  },
  {
    id: '3',
    name: 'Life Coach Ausbildung',
    description: 'Vollständige Life Coaching Zertifizierung',
    nextStart: '10. Mai 2026',
    duration: '16 Tage (8 Monate)',
    price: 5400,
    installments: { count: 6, amount: 950 },
    spotsAvailable: 3,
    totalSpots: 14,
    status: 'active',
  },
  {
    id: '4',
    name: 'Stressmanagement Workshop',
    description: 'Kompakter Workshop für Stressbewältigung',
    nextStart: '22. Februar 2026',
    duration: '2 Tage',
    price: 890,
    installments: null,
    spotsAvailable: 0,
    totalSpots: 25,
    status: 'full',
  },
]

function getStatusBadge(status: string, spots: number) {
  if (status === 'full' || spots === 0) {
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Ausgebucht</Badge>
  }
  if (spots <= 3) {
    return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Wenige Plätze</Badge>
  }
  return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Verfügbar</Badge>
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 0,
  }).format(price)
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
}

export default function CoursesPage() {
  return (
    <div className="space-y-6">
      <Header
        title="Kurse & Preise"
        description="Übersicht aller Ausbildungen mit aktuellen Daten und Preisen"
      />

      {/* Quick Reference */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
            <DollarSign className="h-5 w-5" />
            <span className="font-medium">Alle Ausbildungen mit Ratenzahlung möglich (6 monatliche Raten, keine Zusatzkosten)</span>
          </div>
        </CardContent>
      </Card>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {courses.map((course) => (
          <Card key={course.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{course.name}</CardTitle>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {course.description}
                  </p>
                </div>
                {getStatusBadge(course.status, course.spotsAvailable)}
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="space-y-4">
                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Nächster Start</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{course.nextStart}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Dauer</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{course.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Freie Plätze</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {course.spotsAvailable} von {course.totalSpots}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Preis</p>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {formatPrice(course.price)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Installments */}
                {course.installments && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      <span className="font-medium">Ratenzahlung:</span>{' '}
                      {course.installments.count}x {formatPrice(course.installments.amount)}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2"
                    onClick={() => copyToClipboard(
                      `${course.name}\nNächster Start: ${course.nextStart}\nPreis: ${formatPrice(course.price)}\nRatenzahlung: ${course.installments ? `${course.installments.count}x ${formatPrice(course.installments.amount)}` : 'Nicht verfügbar'}`
                    )}
                  >
                    <Copy className="h-3 w-3" />
                    Kopieren
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ExternalLink className="h-3 w-3" />
                    Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Copy Section */}
      <Card>
        <CardHeader>
          <CardTitle>Schnell-Kopieren</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => copyToClipboard('Die nächste Hypnose-Ausbildung startet am 15. März 2026. Die Kosten betragen CHF 4\'800.– (Ratenzahlung möglich: 6x CHF 850.–).')}
            >
              <Copy className="h-4 w-4 flex-shrink-0" />
              <span className="text-left text-sm">Hypnose-Ausbildung Info</span>
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => copyToClipboard('Bei allen unseren Ausbildungen ist eine Ratenzahlung möglich: 6 monatliche Raten ohne Zusatzkosten. Die erste Rate ist bei der Anmeldung fällig.')}
            >
              <Copy className="h-4 w-4 flex-shrink-0" />
              <span className="text-left text-sm">Ratenzahlung Info</span>
            </Button>
            <Button
              variant="outline"
              className="justify-start gap-2 h-auto py-3"
              onClick={() => copyToClipboard('Unsere Preise 2026:\n- Hypnose-Ausbildung: CHF 4\'800.–\n- Meditation Coach: CHF 3\'600.–\n- Life Coach: CHF 5\'400.–')}
            >
              <Copy className="h-4 w-4 flex-shrink-0" />
              <span className="text-left text-sm">Preisliste 2026</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
