'use client'

import { useState, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatAbsoluteDate } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Calendar,
  Users,
  Clock,
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Copy,
  Check,
  Target,
  BookOpen,
  Info,
  X,
} from 'lucide-react'

interface Course {
  id: string
  name: string
  description: string | null
  content: string | null
  target_audience: string | null
  learning_goals: string[]
  next_start: string | null
  duration: string | null
  price: number | null
  installment_count: number | null
  installment_amount: number | null
  spots_available: number | null
  total_spots: number | null
  status: string
  created_at: string
  updated_at: string
}

const emptyCourse: Partial<Course> = {
  name: '',
  description: '',
  content: '',
  target_audience: '',
  learning_goals: [],
  next_start: '',
  duration: '',
  price: null,
  installment_count: null,
  installment_amount: null,
  spots_available: null,
  total_spots: null,
  status: 'active',
}

function getStatusBadge(status: string, spots: number | null) {
  if (status === 'full' || (spots !== null && spots === 0)) {
    return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Ausgebucht</Badge>
  }
  if (status === 'inactive') {
    return <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400">Inaktiv</Badge>
  }
  if (spots !== null && spots <= 3) {
    return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Wenige Plätze</Badge>
  }
  return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Verfügbar</Badge>
}

function formatPrice(price: number | null) {
  if (price === null) return '-'
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 0,
  }).format(price)
}

function formatDate(dateString: string | null) {
  if (!dateString) return '-'
  return formatAbsoluteDate(dateString)
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<Partial<Course> | null>(null)
  const [deleteConfirmCourse, setDeleteConfirmCourse] = useState<Course | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<Partial<Course>>(emptyCourse)
  const [newLearningGoal, setNewLearningGoal] = useState('')

  // Fetch courses
  const fetchCourses = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/courses')
      if (response.ok) {
        const data = await response.json()
        setCourses(data.courses || [])
      }
    } catch (error) {
      console.error('Failed to fetch courses:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchCourses()
  }, [])

  // Open dialog for new course
  const openNewCourseDialog = () => {
    setEditingCourse(null)
    setFormData({ ...emptyCourse })
    setNewLearningGoal('')
    setIsDialogOpen(true)
  }

  // Open dialog for editing
  const openEditDialog = (course: Course) => {
    setEditingCourse(course)
    setFormData({
      ...course,
      next_start: course.next_start ? course.next_start.split('T')[0] : '',
    })
    setNewLearningGoal('')
    setIsDialogOpen(true)
  }

  // Handle form field change
  const handleFieldChange = (field: keyof Course, value: string | number | null | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Add learning goal
  const addLearningGoal = () => {
    if (!newLearningGoal.trim()) return
    const goals = [...(formData.learning_goals || []), newLearningGoal.trim()]
    handleFieldChange('learning_goals', goals)
    setNewLearningGoal('')
  }

  // Remove learning goal
  const removeLearningGoal = (index: number) => {
    const goals = [...(formData.learning_goals || [])]
    goals.splice(index, 1)
    handleFieldChange('learning_goals', goals)
  }

  // Save course
  const handleSave = async () => {
    if (!formData.name?.trim()) {
      toast.error('Bitte geben Sie einen Kursnamen ein')
      return
    }

    setIsSaving(true)
    try {
      const method = editingCourse ? 'PATCH' : 'POST'
      const body = editingCourse ? { id: editingCourse.id, ...formData } : formData

      const response = await fetch('/api/courses', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (response.ok) {
        setIsDialogOpen(false)
        fetchCourses()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Fehler beim Speichern')
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Fehler beim Speichern')
    } finally {
      setIsSaving(false)
    }
  }

  // Delete course
  const handleDelete = async () => {
    if (!deleteConfirmCourse) return

    try {
      const response = await fetch(`/api/courses?id=${deleteConfirmCourse.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setDeleteConfirmCourse(null)
        fetchCourses()
      }
    } catch (error) {
      console.error('Delete error:', error)
    }
  }

  // Copy course info
  const copyToClipboard = (course: Course) => {
    const text = `${course.name}
${course.description || ''}

Preis: ${formatPrice(course.price)}
${course.installment_count ? `Ratenzahlung: ${course.installment_count}x ${formatPrice(course.installment_amount)}` : ''}
Dauer: ${course.duration || '-'}
Nächster Start: ${formatDate(course.next_start)}`

    navigator.clipboard.writeText(text)
    setCopiedId(course.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="space-y-6">
      <Header
        title="Kurse & Preise"
        description="Übersicht aller Ausbildungen mit aktuellen Daten und Preisen"
      />

      {/* Actions */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          <Info className="inline h-4 w-4 mr-1" />
          Kursdaten werden automatisch der AI als Wissen zur Verfügung gestellt
        </p>
        <Button onClick={openNewCourseDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Neuer Kurs
        </Button>
      </div>

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
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <BookOpen className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">Noch keine Kurse angelegt</p>
            <Button onClick={openNewCourseDialog} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Ersten Kurs anlegen
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {courses.map((course) => (
            <Card key={course.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <CardTitle className="truncate">{course.name}</CardTitle>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {course.description || 'Keine Beschreibung'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(course.status, course.spots_available)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(course)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
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
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {formatDate(course.next_start)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Dauer</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {course.duration || '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-400" />
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Freie Plätze</p>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {course.spots_available !== null && course.total_spots
                            ? `${course.spots_available} von ${course.total_spots}`
                            : '-'}
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
                  {course.installment_count && course.installment_amount && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                      <p className="text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-medium">Ratenzahlung:</span>{' '}
                        {course.installment_count}x {formatPrice(course.installment_amount)}
                      </p>
                    </div>
                  )}

                  {/* Learning Goals Preview */}
                  {course.learning_goals && course.learning_goals.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Target className="h-4 w-4 text-slate-400 mt-0.5" />
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-medium">{course.learning_goals.length} Lernziele</span>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => copyToClipboard(course)}
                    >
                      {copiedId === course.id ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      {copiedId === course.id ? 'Kopiert!' : 'Kopieren'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteConfirmCourse(course)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCourse ? 'Kurs bearbeiten' : 'Neuer Kurs'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Info box */}
            <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
              <Info className="inline h-3 w-3 mr-1" />
              Bestehende Texte können bearbeitet werden. Änderungen werden automatisch für die AI verfügbar.
            </div>

            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Titel *</label>
              <Input
                placeholder="z.B. Hypnose-Ausbildung"
                value={formData.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
              />
            </div>

            {/* Description (short) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Kurzbeschreibung</label>
              <Input
                placeholder="Kurze Beschreibung für die Übersicht"
                value={formData.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
              />
            </div>

            {/* Content (long) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Inhalt / Beschreibung</label>
              <Textarea
                placeholder="Ausführliche Beschreibung des Kurses..."
                rows={4}
                value={formData.content || ''}
                onChange={(e) => handleFieldChange('content', e.target.value)}
              />
            </div>

            {/* Target Audience */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Zielgruppe</label>
              <Textarea
                placeholder="Für wen ist dieser Kurs geeignet?"
                rows={2}
                value={formData.target_audience || ''}
                onChange={(e) => handleFieldChange('target_audience', e.target.value)}
              />
              <p className="text-xs text-slate-500">Für wen ist dieser Kurs geeignet?</p>
            </div>

            {/* Learning Goals */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Lernziele</label>
              <div className="space-y-2">
                {(formData.learning_goals || []).map((goal, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-sm text-slate-500 w-6">{index + 1}.</span>
                    <div className="flex-1 p-2 bg-slate-50 dark:bg-slate-800 rounded text-sm">
                      {goal}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-600"
                      onClick={() => removeLearningGoal(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Input
                    placeholder="Neues Lernziel hinzufügen..."
                    value={newLearningGoal}
                    onChange={(e) => setNewLearningGoal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addLearningGoal()
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={addLearningGoal}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Price & Installments */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Preis (CHF)</label>
                <Input
                  type="number"
                  placeholder="4800"
                  value={formData.price || ''}
                  onChange={(e) => handleFieldChange('price', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Raten (Anzahl)</label>
                <Input
                  type="number"
                  placeholder="6"
                  value={formData.installment_count || ''}
                  onChange={(e) => handleFieldChange('installment_count', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ratenbetrag (CHF)</label>
                <Input
                  type="number"
                  placeholder="850"
                  value={formData.installment_amount || ''}
                  onChange={(e) => handleFieldChange('installment_amount', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>

            {/* Duration & Start */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Dauer</label>
                <Input
                  placeholder="z.B. 12 Tage (6 Monate)"
                  value={formData.duration || ''}
                  onChange={(e) => handleFieldChange('duration', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nächster Start</label>
                <Input
                  type="date"
                  value={formData.next_start || ''}
                  onChange={(e) => handleFieldChange('next_start', e.target.value)}
                />
              </div>
            </div>

            {/* Spots & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Freie Plätze</label>
                <Input
                  type="number"
                  placeholder="8"
                  value={formData.spots_available ?? ''}
                  onChange={(e) => handleFieldChange('spots_available', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Total Plätze</label>
                <Input
                  type="number"
                  placeholder="16"
                  value={formData.total_spots ?? ''}
                  onChange={(e) => handleFieldChange('total_spots', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select
                  value={formData.status || 'active'}
                  onValueChange={(value) => handleFieldChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktiv</SelectItem>
                    <SelectItem value="full">Ausgebucht</SelectItem>
                    <SelectItem value="inactive">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Speichern...
                </>
              ) : (
                'Speichern'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirmCourse} onOpenChange={() => setDeleteConfirmCourse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kurs löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Kurs &quot;{deleteConfirmCourse?.name}&quot; wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
