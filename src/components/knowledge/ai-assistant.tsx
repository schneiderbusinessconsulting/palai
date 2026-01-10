'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Send, Bot, User, Sparkles, Copy, Check, BookOpen, Loader2, CheckCircle, Save, Settings, MessageSquare } from 'lucide-react'

type AssistantMode = 'chat' | 'learning' | 'rules'

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

const chatMessages: Message[] = [
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

const learningMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: `📚 **Learning Mode**

Hier kannst du Wissen direkt in die Knowledge Base speichern.

**So funktioniert's:**
1. Füge Text, Stichworte oder Informationen ein
2. Ich analysiere und schlage Titel & Kategorie vor
3. Klicke "Direkt speichern"

**Beispiele:**
- Kurspreise und Termine
- FAQ Antworten
- E-Mail Vorlagen
- Policies

Los geht's! Was möchtest du speichern?`,
    timestamp: new Date(),
  },
]

const rulesMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: `⚙️ **AI Regeln & Einstellungen**

Hier kannst du das Verhalten des AI Assistenten anpassen. Diese Regeln werden bei **jeder** E-Mail-Generierung berücksichtigt.

**Beispiele für Regeln:**
- "Begrüssung immer mit 'Liebe/Lieber [Vorname]' statt 'Grüezi'"
- "Signatur: 'Herzliche Grüsse, Das Palacios Team'"
- "Niemals Rabatte versprechen ohne Rücksprache"
- "Bei Beschwerden immer Empathie zeigen und Rückruf anbieten"
- "Tonalität: Warm und persönlich, nicht zu förmlich"

Schreibe einfach eine neue Regel und ich speichere sie!`,
    timestamp: new Date(),
  },
]

function getMessagesForMode(mode: AssistantMode): Message[] {
  switch (mode) {
    case 'learning':
      return learningMessages
    case 'rules':
      return rulesMessages
    default:
      return chatMessages
  }
}

export function KnowledgeAIAssistant({ open, onOpenChange, onApplySuggestion }: KnowledgeAIAssistantProps) {
  const [mode, setMode] = useState<AssistantMode>('chat')
  const [messages, setMessages] = useState<Message[]>(chatMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [lastUserContent, setLastUserContent] = useState<string>('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Handle mode change
  const handleModeChange = (newMode: AssistantMode) => {
    setMode(newMode)
    setMessages(getMessagesForMode(newMode))
    setLastUserContent('')
  }

  // Save content directly to knowledge base
  const handleSaveToKnowledge = async (messageId: string, suggestion: Message['suggestion'], content: string) => {
    if (!suggestion?.title || !content) return

    setIsSaving(messageId)

    // For rules mode, always save as ai_instructions
    const sourceType = mode === 'rules' ? 'ai_instructions' : (suggestion.category || 'help_article')

    try {
      const formData = new FormData()
      formData.append('title', suggestion.title)
      formData.append('content', content)
      formData.append('source_type', sourceType)

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
      const categoryLabel = sourceType === 'ai_instructions' ? 'AI Regel' :
        sourceType === 'help_article' ? 'Help Center' :
        sourceType === 'faq' ? 'FAQ' :
        sourceType === 'course_info' ? 'Kurs-Info' :
        'E-Mail Vorlage'

      const successMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: mode === 'rules'
          ? `✅ **Regel gespeichert!**

"${suggestion.title}" wird ab sofort bei jeder E-Mail-Generierung berücksichtigt.

Du kannst weitere Regeln hinzufügen!`
          : `✅ **Erfolgreich gespeichert!**

"${suggestion.title}" wurde zur Knowledge Base hinzugefügt.
- ${data.chunksCreated} Chunk(s) erstellt
- Kategorie: ${categoryLabel}

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

Bitte versuche es erneut.`,
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

    // For rules mode, generate a simple suggestion without API call
    if (mode === 'rules') {
      const ruleTitle = userContent.length > 50
        ? userContent.substring(0, 47) + '...'
        : userContent

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Ich habe deine Regel analysiert:

**"${userContent}"**

Diese Regel wird bei jeder E-Mail-Generierung berücksichtigt. Klicke auf "Regel speichern" um sie zu aktivieren.`,
        timestamp: new Date(),
        suggestion: {
          title: ruleTitle,
          category: 'ai_instructions',
        },
        originalContent: userContent,
      }
      setMessages((prev) => [...prev, assistantMessage])
      setIsLoading(false)
      return
    }

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
        originalContent: userContent,
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

  // Get icon and color based on mode
  const getModeConfig = () => {
    switch (mode) {
      case 'learning':
        return { icon: BookOpen, color: 'from-green-500 to-green-600', label: 'Learning' }
      case 'rules':
        return { icon: Settings, color: 'from-purple-500 to-purple-600', label: 'AI Regeln' }
      default:
        return { icon: MessageSquare, color: 'from-amber-500 to-amber-600', label: 'Chat' }
    }
  }

  const modeConfig = getModeConfig()
  const ModeIcon = modeConfig.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b space-y-3">
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${modeConfig.color} flex items-center justify-center`}>
              <ModeIcon className="h-4 w-4 text-white" />
            </div>
            Knowledge Base Assistent
          </DialogTitle>

          {/* Mode Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => handleModeChange('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                mode === 'chat'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Chat
            </button>
            <button
              onClick={() => handleModeChange('learning')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                mode === 'learning'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-green-600'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Learning
            </button>
            <button
              onClick={() => handleModeChange('rules')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                mode === 'rules'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              AI Regeln
            </button>
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
                        : mode === 'rules'
                        ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                        : mode === 'learning'
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {message.savedToKnowledge ? (
                          <>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">
                              {mode === 'rules' ? 'Regel aktiv' : 'Gespeichert'}
                            </span>
                          </>
                        ) : mode === 'rules' ? (
                          <>
                            <Settings className="h-4 w-4 text-purple-600" />
                            <span className="text-sm font-medium text-purple-700 dark:text-purple-400">
                              Neue Regel
                            </span>
                          </>
                        ) : mode === 'learning' ? (
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
                          <span className="text-xs text-slate-500">{mode === 'rules' ? 'Regel:' : 'Titel:'}</span>
                          <div className="flex items-center gap-1">
                            <code className="text-xs bg-white dark:bg-slate-700 px-2 py-0.5 rounded max-w-[200px] truncate">
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

                      {message.suggestion.category && mode !== 'rules' && (
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs text-slate-500">Kategorie:</span>
                          <code className="text-xs bg-white dark:bg-slate-700 px-2 py-0.5 rounded">
                            {message.suggestion.category === 'help_article' ? 'Help Center' :
                             message.suggestion.category === 'faq' ? 'FAQ' :
                             message.suggestion.category === 'course_info' ? 'Kurs-Info' :
                             message.suggestion.category === 'ai_instructions' ? 'AI Regel' :
                             'E-Mail Vorlage'}
                          </code>
                        </div>
                      )}

                      {!message.savedToKnowledge && (
                        mode !== 'chat' ? (
                          <Button
                            size="sm"
                            className={`w-full mt-2 gap-2 ${
                              mode === 'rules'
                                ? 'bg-purple-600 hover:bg-purple-700'
                                : 'bg-green-600 hover:bg-green-700'
                            }`}
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
                                {mode === 'rules' ? 'Regel speichern' : 'Direkt speichern'}
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
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-br ${modeConfig.color}`}>
                  <ModeIcon className="h-4 w-4 text-white" />
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Loader2 className={`h-4 w-4 animate-spin ${
                      mode === 'rules' ? 'text-purple-500' :
                      mode === 'learning' ? 'text-green-500' : 'text-amber-500'
                    }`} />
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {mode === 'rules' ? 'Speichere...' :
                       mode === 'learning' ? 'Verarbeite...' : 'Analysiere...'}
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
                placeholder={
                  mode === 'rules' ? "Schreibe eine neue Regel für den AI Assistenten..." :
                  mode === 'learning' ? "Füge Wissen, Stichworte oder Infos zum Speichern ein..." :
                  "Füge Text ein oder stelle eine Frage..."
                }
                className={`min-h-[44px] max-h-32 resize-none text-sm ${
                  mode === 'rules' ? 'border-purple-300 focus:border-purple-500' :
                  mode === 'learning' ? 'border-green-300 focus:border-green-500' : ''
                }`}
                rows={2}
              />
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`px-4 ${
                  mode === 'rules' ? 'bg-purple-600 hover:bg-purple-700' :
                  mode === 'learning' ? 'bg-green-600 hover:bg-green-700' : ''
                }`}
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
