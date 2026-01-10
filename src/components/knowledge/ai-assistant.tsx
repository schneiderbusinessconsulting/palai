'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Send, Bot, User, Sparkles, Copy, Check, BookOpen, Loader2, CheckCircle, Save } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  suggestion?: {
    title?: string
    category?: string
    summary?: string
  }
  savedToKnowledge?: boolean
  originalContent?: string // Store original user content for saving
}

interface KnowledgeAIAssistantProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplySuggestion?: (suggestion: { title?: string; category?: string; content?: string }) => void
}

const initialMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: `Hallo! Ich bin dein Knowledge Base Assistent. Ich kann dir helfen bei:

• **Titel vorschlagen** - Füge deinen Text ein und ich schlage einen passenden Titel vor
• **Kategorisieren** - Ich helfe dir die richtige Kategorie zu wählen
• **Zusammenfassen** - Lange Texte kann ich für dich zusammenfassen
• **Formatieren** - Ich helfe beim Strukturieren von Inhalten

Füge einfach deinen Text ein oder stelle mir eine Frage!`,
    timestamp: new Date(),
  },
]

const learningModeMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: `🎓 **Learning Mode aktiv!**

Ich helfe dir, Wissen direkt in die Knowledge Base zu speichern.

**So funktioniert's:**
1. Füge Text, Stichworte oder Informationen ein
2. Ich analysiere den Inhalt und schlage Titel & Kategorie vor
3. Klicke auf "Direkt speichern" um es in die Knowledge Base aufzunehmen

**Tipp:** Du kannst auch Stichworte oder unformatierte Notizen einfügen - ich formatiere sie automatisch.

Los geht's! Was möchtest du speichern?`,
    timestamp: new Date(),
  },
]

export function KnowledgeAIAssistant({ open, onOpenChange, onApplySuggestion }: KnowledgeAIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState<string | null>(null) // Track which message is being saved
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [learningMode, setLearningMode] = useState(false)
  const [lastUserContent, setLastUserContent] = useState<string>('') // Store last user input for saving
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Handle learning mode toggle
  const handleLearningModeToggle = (enabled: boolean) => {
    setLearningMode(enabled)
    setMessages(enabled ? learningModeMessages : initialMessages)
    setLastUserContent('')
  }

  // Save content directly to knowledge base
  const handleSaveToKnowledge = async (messageId: string, suggestion: Message['suggestion'], content: string) => {
    if (!suggestion?.title || !content) return

    setIsSaving(messageId)

    try {
      const formData = new FormData()
      formData.append('title', suggestion.title)
      formData.append('content', content)
      formData.append('source_type', suggestion.category || 'help_article')

      const response = await fetch('/api/knowledge', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) throw new Error('Failed to save')

      const data = await response.json()

      // Update the message to show it was saved
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, savedToKnowledge: true } : msg
        )
      )

      // Add success message
      const successMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ **Erfolgreich gespeichert!**

"${suggestion.title}" wurde zur Knowledge Base hinzugefügt.
- ${data.chunksCreated} Chunk(s) erstellt
- Kategorie: ${
          suggestion.category === 'help_article' ? 'Help Center' :
          suggestion.category === 'faq' ? 'FAQ' :
          suggestion.category === 'course_info' ? 'Kurs-Info' :
          'E-Mail Vorlage'
        }

Du kannst jetzt weiteren Content hinzufügen!`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, successMessage])
    } catch (error) {
      console.error('Save error:', error)
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ **Fehler beim Speichern**

Bitte versuche es erneut oder nutze das manuelle Upload-Formular.`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsSaving(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userContent = input.trim()
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userContent,
      timestamp: new Date(),
    }

    // Store user content for potential saving
    setLastUserContent(userContent)
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/knowledge/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userContent }),
      })

      if (!response.ok) throw new Error('API error')

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        suggestion: data.suggestion,
        originalContent: userContent, // Store for saving
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Assistant error:', error)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getLocalResponse(userContent),
        timestamp: new Date(),
        originalContent: userContent,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleApplySuggestion = (suggestion: Message['suggestion']) => {
    if (suggestion && onApplySuggestion) {
      onApplySuggestion({
        title: suggestion.title,
        category: suggestion.category,
        content: suggestion.summary,
      })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                learningMode
                  ? 'bg-gradient-to-br from-green-500 to-green-600'
                  : 'bg-gradient-to-br from-amber-500 to-amber-600'
              }`}>
                {learningMode ? (
                  <BookOpen className="h-4 w-4 text-white" />
                ) : (
                  <Bot className="h-4 w-4 text-white" />
                )}
              </div>
              {learningMode ? 'Learning Mode' : 'Knowledge Base Assistent'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="learning-mode" className="text-xs text-slate-500">
                Learning Mode
              </Label>
              <Switch
                id="learning-mode"
                checked={learningMode}
                onCheckedChange={handleLearningModeToggle}
              />
            </div>
          </div>
        </DialogHeader>

        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 px-6 py-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-blue-600'
                      : 'bg-gradient-to-br from-amber-500 to-amber-600'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>

                <div className={`flex-1 max-w-[85%] ${message.role === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`inline-block p-3 rounded-lg text-left ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  </div>

                  {/* Suggestion Actions */}
                  {message.suggestion && (
                    <div className={`mt-2 p-3 rounded-lg border ${
                      message.savedToKnowledge
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : learningMode
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {message.savedToKnowledge ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">
                              Gespeichert
                            </span>
                          </>
                        ) : learningMode ? (
                          <>
                            <BookOpen className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">
                              Bereit zum Speichern
                            </span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                              Vorschlag
                            </span>
                          </>
                        )}
                      </div>

                      {message.suggestion.title && (
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs text-slate-500">Titel:</span>
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-white dark:bg-slate-700 px-2 py-0.5 rounded">
                              {message.suggestion.title}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => copyToClipboard(message.suggestion!.title!, message.id + '-title')}
                            >
                              {copiedId === message.id + '-title' ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}

                      {message.suggestion.category && (
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs text-slate-500">Kategorie:</span>
                          <code className="text-xs bg-white dark:bg-slate-700 px-2 py-0.5 rounded">
                            {message.suggestion.category === 'help_article' ? 'Help Center' :
                             message.suggestion.category === 'faq' ? 'FAQ' :
                             message.suggestion.category === 'course_info' ? 'Kurs-Info' :
                             'E-Mail Vorlage'}
                          </code>
                        </div>
                      )}

                      {!message.savedToKnowledge && (
                        learningMode ? (
                          <Button
                            size="sm"
                            className="w-full mt-2 gap-2 bg-green-600 hover:bg-green-700"
                            onClick={() => handleSaveToKnowledge(
                              message.id,
                              message.suggestion,
                              message.originalContent || lastUserContent
                            )}
                            disabled={isSaving === message.id}
                          >
                            {isSaving === message.id ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Speichern...
                              </>
                            ) : (
                              <>
                                <Save className="h-3.5 w-3.5" />
                                Direkt speichern
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="w-full mt-2 gap-2"
                            onClick={() => handleApplySuggestion(message.suggestion)}
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Vorschlag übernehmen
                          </Button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  learningMode
                    ? 'bg-gradient-to-br from-green-500 to-green-600'
                    : 'bg-gradient-to-br from-amber-500 to-amber-600'
                }`}>
                  {learningMode ? (
                    <BookOpen className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className={`h-4 w-4 animate-spin ${
                      learningMode ? 'text-green-500' : 'text-amber-500'
                    }`} />
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {learningMode ? 'Verarbeite...' : 'Analysiere...'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4">
          <form onSubmit={handleSubmit}>
            <div className="flex gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={learningMode
                  ? "Füge Wissen, Stichworte oder Infos zum Speichern ein..."
                  : "Füge Text ein oder stelle eine Frage..."
                }
                className={`min-h-[44px] max-h-32 resize-none text-sm ${
                  learningMode ? 'border-green-300 focus:border-green-500' : ''
                }`}
                rows={2}
              />
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`px-4 ${learningMode ? 'bg-green-600 hover:bg-green-700' : ''}`}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-400 mt-2 text-center">
              Enter zum Senden, Shift+Enter für neue Zeile
            </p>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Local fallback responses
function getLocalResponse(input: string): string {
  const lowerInput = input.toLowerCase()

  if (input.length > 200) {
    // Assume it's content to analyze
    return `Ich habe deinen Text analysiert. Hier meine Vorschläge:

**Titelvorschlag:** "${generateTitleFromContent(input)}"

**Kategorie-Empfehlung:** Basierend auf dem Inhalt würde ich "${suggestCategory(input)}" empfehlen.

**Zusammenfassung:** ${summarizeContent(input)}

Möchtest du diese Vorschläge übernehmen?`
  }

  if (lowerInput.includes('titel') || lowerInput.includes('title')) {
    return `Um einen guten Titel vorzuschlagen, brauche ich den Inhalt. Bitte füge den Text ein, den du hochladen möchtest.

Ein guter Titel sollte:
• Kurz und prägnant sein (3-7 Wörter)
• Den Hauptinhalt beschreiben
• Suchbar sein für spätere Verwendung`
  }

  if (lowerInput.includes('kategorie') || lowerInput.includes('category')) {
    return `Die Knowledge Base hat 4 Kategorien:

• **Help Center** - Anleitungen, How-Tos, allgemeine Hilfe
• **FAQ** - Häufig gestellte Fragen mit Antworten
• **Kurs-Info** - Preise, Termine, Ausbildungsdetails
• **E-Mail Vorlage** - Standardantworten, Textbausteine

Füge deinen Inhalt ein und ich helfe dir bei der Einordnung!`
  }

  return `Ich kann dir bei folgenden Aufgaben helfen:

1. **Text einfügen** → Ich analysiere und schlage Titel + Kategorie vor
2. **"Zusammenfassen"** → Ich kürze lange Texte
3. **"Formatieren"** → Ich strukturiere Inhalte besser

Einfach den Text einfügen und ich mache Vorschläge!`
}

function generateTitleFromContent(content: string): string {
  const words = content.split(/\s+/).slice(0, 30)
  const firstSentence = content.split(/[.!?]/)[0]
  if (firstSentence.length < 60) return firstSentence.trim()
  return words.slice(0, 6).join(' ') + '...'
}

function suggestCategory(content: string): string {
  const lower = content.toLowerCase()
  if (lower.includes('frage') || lower.includes('antwort') || lower.includes('?')) return 'FAQ'
  if (lower.includes('preis') || lower.includes('chf') || lower.includes('kurs') || lower.includes('ausbildung')) return 'Kurs-Info'
  if (lower.includes('e-mail') || lower.includes('grüezi') || lower.includes('grüsse')) return 'E-Mail Vorlage'
  return 'Help Center'
}

function summarizeContent(content: string): string {
  const sentences = content.split(/[.!?]/).filter(s => s.trim().length > 10)
  if (sentences.length <= 2) return content.substring(0, 200)
  return sentences.slice(0, 2).join('. ').trim() + '.'
}
