'use client'

import { useState, useRef, useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User, Sparkles, BookOpen } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  timestamp: Date
}

// Mock messages for demo
const initialMessages: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: 'Hallo! Ich bin der Palacios AI Assistent. Ich kann dir bei Fragen zu unseren Ausbildungen, Preisen, Kursdaten und allgemeinen Informationen helfen. Was möchtest du wissen?',
    timestamp: new Date(),
  },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.content }),
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
      // Fallback to simulated response if API fails
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getSimulatedResponse(userMessage.content),
        sources: [],
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <Header
        title="Chat"
        description="AI Assistent für das Palacios Institut"
      />

      <Card className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <ScrollArea ref={scrollRef} className="flex-1 p-4">
          <div className="space-y-4 max-w-3xl mx-auto">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                {/* Avatar */}
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

                {/* Message Content */}
                <div
                  className={`flex-1 max-w-[80%] ${
                    message.role === 'user' ? 'text-right' : ''
                  }`}
                >
                  <div
                    className={`inline-block p-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
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
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Denke nach...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <CardContent className="border-t border-slate-200 dark:border-slate-700 p-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex gap-3">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Stelle eine Frage..."
                className="min-h-[44px] max-h-32 resize-none"
                rows={1}
              />
              <Button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-4"
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

// Simulated responses for demo
function getSimulatedResponse(input: string): string {
  const lowerInput = input.toLowerCase()

  if (lowerInput.includes('hypnose') && lowerInput.includes('ausbildung')) {
    return `Die Hypnose-Ausbildung am Palacios Institut ist eine umfassende Grundausbildung.

**Nächster Start:** 15. März 2026
**Kosten:** CHF 4'800.–
**Ratenzahlung:** Möglich (6 x CHF 850.–)
**Dauer:** 12 Tage, verteilt auf 6 Monate

Die Ausbildung umfasst:
- Grundlagen der Hypnose
- Induktions- und Vertiefungstechniken
- Praktische Übungen in Kleingruppen
- Zertifizierung nach Abschluss

Soll ich dir weitere Details senden?`
  }

  if (lowerInput.includes('preis') || lowerInput.includes('kosten')) {
    return `Hier eine Übersicht unserer Ausbildungspreise:

**Hypnose-Ausbildung:** CHF 4'800.–
**Meditation Coach:** CHF 3'600.–
**Life Coach:** CHF 5'400.–

Bei allen Ausbildungen ist eine Ratenzahlung möglich. Für Gruppen- oder Firmenbuchungen gibt es Sonderkonditionen.

Zu welcher Ausbildung möchtest du mehr erfahren?`
  }

  if (lowerInput.includes('ratenzahlung')) {
    return `Ja, bei allen unseren Ausbildungen ist eine Ratenzahlung möglich!

**Standardkonditionen:**
- 6 monatliche Raten
- Keine Zusatzkosten
- Erste Rate bei Anmeldung

Beispiel Hypnose-Ausbildung:
- Gesamtpreis: CHF 4'800.–
- 6 Raten à CHF 850.–

Bei Fragen zur individuellen Zahlungsvereinbarung kann ich dich gerne mit unserem Team verbinden.`
  }

  return `Danke für deine Frage! Ich bin der AI-Assistent des Palacios Instituts und kann dir bei Fragen zu unseren Ausbildungen helfen.

Ich kann dir Informationen geben zu:
- **Hypnose-Ausbildung** - Kurse, Daten, Preise
- **Meditation Coach** - Zertifizierung, Inhalte
- **Life Coaching** - Programme, Voraussetzungen
- **Allgemeine Infos** - Zahlungsoptionen, Standort

Was möchtest du genauer wissen?`
}
