'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  BookOpen,
  HelpCircle,
  FileText,
  GraduationCap,
  ChevronRight,
  Loader2,
} from 'lucide-react'

interface HelpArticle {
  id: string
  title: string
  source_type: string
  content: string
  updated_at: string
}

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  help_article: {
    label: 'Allgemein',
    icon: <BookOpen className="h-5 w-5" />,
    color: 'bg-blue-500',
  },
  faq: {
    label: 'Häufige Fragen',
    icon: <HelpCircle className="h-5 w-5" />,
    color: 'bg-purple-500',
  },
  course_info: {
    label: 'Kurse & Ausbildungen',
    icon: <GraduationCap className="h-5 w-5" />,
    color: 'bg-amber-500',
  },
  email: {
    label: 'Kontakt',
    icon: <FileText className="h-5 w-5" />,
    color: 'bg-green-500',
  },
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äàáâ]/g, 'a')
    .replace(/[öòóô]/g, 'o')
    .replace(/[üùúû]/g, 'u')
    .replace(/[ëèéê]/g, 'e')
    .replace(/[ïìíî]/g, 'i')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export default function HelpCenterPage() {
  const [articles, setArticles] = useState<HelpArticle[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const response = await fetch('/api/helpcenter')
        if (response.ok) {
          const data = await response.json()
          setArticles(data.articles || [])
        }
      } catch (error) {
        console.error('Failed to fetch articles:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchArticles()
  }, [])

  // Filter articles by search
  const filteredArticles = articles.filter((article) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      article.title.toLowerCase().includes(query) ||
      article.content.toLowerCase().includes(query)
    )
  })

  // Group articles by category
  const articlesByCategory = filteredArticles.reduce((acc, article) => {
    const category = article.source_type
    if (!acc[category]) acc[category] = []
    acc[category].push(article)
    return acc
  }, {} as Record<string, HelpArticle[]>)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">Palacios Institut Help Center</h1>
          <p className="text-amber-100 text-lg mb-8">
            Finden Sie Antworten zu unseren Ausbildungen, Kursen und mehr
          </p>

          {/* Search */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              type="search"
              placeholder="Suchen Sie nach Themen, Kursen, Fragen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-6 text-lg bg-white text-slate-900 border-0 shadow-lg rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-20">
            <HelpCircle className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <h2 className="text-xl font-medium text-slate-600 dark:text-slate-400">
              {searchQuery ? 'Keine Ergebnisse gefunden' : 'Noch keine Artikel vorhanden'}
            </h2>
            <p className="text-slate-500 mt-2">
              {searchQuery
                ? 'Versuchen Sie einen anderen Suchbegriff'
                : 'Artikel werden bald hinzugefügt'}
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {Object.entries(articlesByCategory).map(([category, categoryArticles]) => {
              const config = categoryConfig[category] || categoryConfig.help_article

              return (
                <section key={category}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`p-2 rounded-lg ${config.color} text-white`}>
                      {config.icon}
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">
                      {config.label}
                    </h2>
                    <Badge variant="secondary" className="ml-2">
                      {categoryArticles.length} Artikel
                    </Badge>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {categoryArticles.map((article) => (
                      <Link
                        key={article.id}
                        href={`/helpcenter/${slugify(article.title)}-${article.id.slice(0, 8)}`}
                      >
                        <Card className="h-full hover:shadow-lg hover:border-amber-200 transition-all cursor-pointer group">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                                  {article.title}
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                  {article.content.substring(0, 150)}...
                                </p>
                              </div>
                              <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-amber-500 transition-colors flex-shrink-0" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 mt-20">
        <div className="max-w-5xl mx-auto px-4 py-8 text-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Palacios Institut. Alle Rechte vorbehalten.</p>
          <p className="mt-2">
            Brauchen Sie weitere Hilfe?{' '}
            <a href="mailto:info@palacios-institut.ch" className="text-amber-600 hover:underline">
              Kontaktieren Sie uns
            </a>
          </p>
        </div>
      </footer>
    </div>
  )
}
