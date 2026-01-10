'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Send,
  Bot,
  User,
  Sparkles,
  BookOpen,
  Settings,
  MessageSquare,
  Save,
  Loader2,
  CheckCircle,
  Upload,
  FileText,
  X,
} from 'lucide-react'

type AssistantMode = 'chat' | 'learning' | 'rules'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  timestamp: Date
  suggestion?: {
    title?: string
    category?: string
  }
  savedToKnowledge?: boolean
  originalContent?: string
}

const chatMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: `Hallo! Ich bin der Palacios AI Assistent. Ich kann dir bei Fragen zu unseren Ausbildungen, Preisen, Kursdaten und allgemeinen Informationen helfen.

Was möchtest du wissen?`,
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
3. Klicke "Speichern" um es der AI beizubringen

**Du kannst auch PDFs hochladen** - diese werden automatisch verarbeitet.

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

function ChatPageContent() {
  const searchParams = useSearchParams()
  const initialMode = (searchParams.get('mode') as AssistantMode) || 'chat'

  const [mode, setMode] = useState<AssistantMode>(initialMode)
  const [messages, setMessages] = useState<Message[]>(getMessagesForMode(initialMode))
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState<string | null>(null)
  const [lastUserContent, setLastUserContent] = useState<string>('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleModeChange = (newMode: AssistantMode) => {
    setMode(newMode)
    setMessages(getMessagesForMode(newMode))
    setLastUserContent('')
    setSelectedFile(null)
  }

  // Handle file upload
  const handleFileUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `📎 Datei hochgeladen: ${selectedFile.name}`,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('title', selectedFile.name.replace(/\.[^/.]+$/, ''))
      formData.append('source_type', 'help_article')

      const response = await fetch('/api/knowledge', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `✅ **Datei erfolgreich verarbeitet!**

"${selectedFile.name}" wurde zur Knowledge Base hinzugefügt.
- ${data.chunksCreated} Chunk(s) erstellt
- Die AI kann jetzt darauf zugreifen

Du kannst weitere Dateien hochladen oder Text eingeben!`,
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, assistantMessage])
      } else {
        throw new Error(data.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ **Fehler beim Hochladen**

Bitte versuche es erneut oder verwende ein anderes Format (PDF, TXT).`,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsUploading(false)
      setSelectedFile(null)
    }
  }

  // Save to knowledge base
  const handleSaveToKnowledge = async (messageId: string, suggestion: Message['suggestion'], content: string) => {
    if (!suggestion?.title || !content) return

    setIsSaving(messageId)
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

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, savedToKnowledge: true } : msg
        )
      )

      const categoryLabel = sourceType === 'ai_instructions' ? 'AI Regel' :
        sourceType === 'help_article' ? 'Help Center' :
        sourceType === 'faq' ? 'FAQ' :
        sourceType === 'course_info' ? 'Kurs-Info' : 'E-Mail Vorlage'

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

    setLastUserContent(userContent)
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // For rules mode, generate suggestion without API
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

    // For learning mode, analyze and suggest
    if (mode === 'learning') {
      try {
        const response = await fetch('/api/knowledge/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userContent }),
        })

        if (response.ok) {
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
        } else {
          throw new Error('API error')
        }
      } catch (error) {
        console.error('Learning error:', error)
        // Generate local suggestion
        const title = userContent.length > 50 ? userContent.substring(0, 47) + '...' : userContent
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Ich habe deinen Text analysiert:

**Titelvorschlag:** "${title}"
**Kategorie:** Help Center

Klicke auf "Speichern" um dieses Wissen zur Knowledge Base hinzuzufügen.`,
          timestamp: new Date(),
          suggestion: { title, category: 'help_article' },
          originalContent: userContent,
        }
        setMessages((prev) => [...prev, assistantMessage])
      } finally {
        setIsLoading(false)
      }
      return
    }

    // Normal chat mode
    try {
      const response = await fetch('/api/chat', {
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
        sources: data.sources?.map((s: { title: string }) => s.title) || [],
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Entschuldigung, es gab einen Fehler. Bitte versuche es erneut.`,
        timestamp: new Date(),
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

  const getModeConfig = () => {
    switch (mode) {
      case 'learning':
        return { icon: BookOpen, color: 'from-green-500 to-green-600', label: 'Learning', textColor: 'text-green-600' }
      case 'rules':
        return { icon: Settings, color: 'from-purple-500 to-purple-600', label: 'AI Regeln', textColor: 'text-purple-600' }
      default:
        return { icon: MessageSquare, color: 'from-amber-500 to-amber-600', label: 'Chat', textColor: 'text-amber-600' }
    }
  }

  const modeConfig = getModeConfig()

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <Header
        title="AI Assistent"
        description="Chat, Wissen hinzufügen oder AI-Regeln definieren"
      />

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Mode Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-700 p-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1 max-w-md mx-auto">
            <button
              onClick={() => handleModeChange('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'chat'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Chat
            </button>
            <button
              onClick={() => handleModeChange('learning')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'learning'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-green-600'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              Learning
            </button>
            <button
              onClick={() => handleModeChange('rules')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                mode === 'rules'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-purple-600'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Settings className="h-4 w-4" />
              AI Regeln
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4">
          <div className="space-y-4 max-w-3xl mx-auto pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-blue-600'
                      : `bg-gradient-to-br ${modeConfig.color}`
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className="h-4 w-4 text-white" />
                  ) : (
                    <Bot className="h-4 w-4 text-white" />
                  )}
                </div>

                <div className={`flex-1 max-w-[80%] ${message.role === 'user' ? 'text-right' : ''}`}>
                  <div
                    className={`inline-block p-3 rounded-lg text-left ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    }`}
                  >
                    <div className={`text-sm prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2 ${
                      message.role === 'user'
                        ? '[&_*]:!text-white [&_strong]:!text-white [&_p]:!text-white'
                        : 'dark:prose-invert'
                    }`}>
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Sources */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <BookOpen className="h-3 w-3 text-slate-400" />
                      {message.sources.map((source, i) => (
                        <span
                          key={i}
                          className="text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded"
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Suggestion Save Actions */}
                  {message.suggestion && !message.savedToKnowledge && (
                    <div className={`mt-2 p-3 rounded-lg border ${
                      mode === 'rules'
                        ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
                        : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        {mode === 'rules' ? (
                          <Settings className="h-4 w-4 text-purple-600" />
                        ) : (
                          <BookOpen className="h-4 w-4 text-green-600" />
                        )}
                        <span className={`text-sm font-medium ${mode === 'rules' ? 'text-purple-700' : 'text-green-700'}`}>
                          {mode === 'rules' ? 'Neue Regel' : 'Bereit zum Speichern'}
                        </span>
                      </div>

                      {message.suggestion.title && (
                        <p className="text-xs text-slate-600 mb-2">
                          <strong>{mode === 'rules' ? 'Regel:' : 'Titel:'}</strong> {message.suggestion.title}
                        </p>
                      )}

                      <Button
                        size="sm"
                        className={`w-full gap-2 ${
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
                            {mode === 'rules' ? 'Regel speichern' : 'Zur Knowledge Base hinzufügen'}
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {message.savedToKnowledge && (
                    <div className="mt-2 flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm">Gespeichert!</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br ${modeConfig.color} flex items-center justify-center`}>
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Sparkles className={`h-4 w-4 animate-pulse ${modeConfig.textColor}`} />
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {mode === 'rules' ? 'Verarbeite Regel...' :
                       mode === 'learning' ? 'Analysiere...' : 'Denke nach...'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <CardContent className="border-t border-slate-200 dark:border-slate-700 p-4">
          {/* File Upload (only in learning mode) */}
          {mode === 'learning' && (
            <div className="max-w-3xl mx-auto mb-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setSelectedFile(file)
                }}
              />

              {selectedFile ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600" />
                  <span className="flex-1 text-sm text-green-700 dark:text-green-400 truncate">
                    {selectedFile.name}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 gap-2"
                    onClick={handleFileUpload}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Hochladen
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:border-green-300 hover:text-green-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  PDF oder TXT Datei hochladen
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === 'rules' ? "Schreibe eine neue Regel für den AI Assistenten..." :
                  mode === 'learning' ? "Füge Wissen, Stichworte oder Infos zum Speichern ein..." :
                  "Stelle eine Frage..."
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
        </CardContent>
      </Card>
    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full" />
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  )
}
