'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Search,
  BookOpen,
  HelpCircle,
  GraduationCap,
  ChevronRight,
  Loader2,
  FileText,
  Clock,
} from 'lucide-react'

interface HelpArticle {
  id: string
  title: string
  source_type: string
  content: string
  updated_at: string
}

const categoryConfig: Record<string, {
  label: string
  description: string
  icon: React.ReactNode
  color: string
  bgColor: string
}> = {
  help_article: {
    label: 'Allgemeine Hilfe',
    description: 'Grundlegende Informationen und Anleitungen',
    icon: <BookOpen className="h-6 w-6" />,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30',
  },
  faq: {
    label: 'Häufige Fragen',
    description: 'Antworten auf die meistgestellten Fragen',
    icon: <HelpCircle className="h-6 w-6" />,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  course_info: {
    label: 'Kurse & Ausbildungen',
    description: 'Informationen zu unseren Angeboten',
    icon: <GraduationCap className="h-6 w-6" />,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
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

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-CH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getExcerpt(content: string, maxLength: number = 120): string {
  const cleaned = content.replace(/[#*_`]/g, '').replace(/\n+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  return cleaned.substring(0, maxLength).trim() + '...'
}

function HelpCenterContent() {
  const searchParams = useSearchParams()
  const categoryFilter = searchParams.get('category')

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

  // Filter articles
  const filteredArticles = articles.filter((article) => {
    // Category filter
    if (categoryFilter && article.source_type !== categoryFilter) {
      return false
    }
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        article.title.toLowerCase().includes(query) ||
        article.content.toLowerCase().includes(query)
      )
    }
    return true
  })

  // Group articles by category
  const articlesByCategory = filteredArticles.reduce((acc, article) => {
    const category = article.source_type
    if (!acc[category]) acc[category] = []
    acc[category].push(article)
    return acc
  }, {} as Record<string, HelpArticle[]>)

  // Get active category info
  const activeCategoryInfo = categoryFilter ? categoryConfig[categoryFilter] : null

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            {activeCategoryInfo ? activeCategoryInfo.label : 'Wie können wir helfen?'}
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
            {activeCategoryInfo
              ? activeCategoryInfo.description
              : 'Durchsuchen Sie unsere Hilfeartikel oder nutzen Sie die Suche, um schnell Antworten zu finden.'}
          </p>

          {/* Search */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="search"
              placeholder="Artikel durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 text-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-shadow"
            />
          </div>
        </div>
      </div>

      {/* Category Cards (only show on main page without category filter) */}
      {!categoryFilter && !searchQuery && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {Object.entries(categoryConfig).map(([key, config]) => {
              const count = articles.filter(a => a.source_type === key).length
              return (
                <Link
                  key={key}
                  href={`/helpcenter?category=${key}`}
                  className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-amber-200 dark:hover:border-amber-800 transition-all"
                >
                  <div className={`inline-flex p-3 rounded-lg ${config.bgColor} ${config.color} mb-4`}>
                    {config.icon}
                  </div>
                  <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors">
                    {config.label}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {count} {count === 1 ? 'Artikel' : 'Artikel'}
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <h2 className="text-xl font-medium text-slate-900 dark:text-white mb-2">
              {searchQuery ? 'Keine Ergebnisse gefunden' : 'Noch keine Artikel vorhanden'}
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              {searchQuery
                ? 'Versuchen Sie einen anderen Suchbegriff'
                : 'Artikel werden bald hinzugefügt'}
            </p>
            {(searchQuery || categoryFilter) && (
              <Link
                href="/helpcenter"
                className="inline-flex items-center mt-4 text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400"
              >
                Alle Artikel anzeigen
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            )}
          </div>
        ) : categoryFilter || searchQuery ? (
          // List view for filtered results
          <div className="max-w-3xl mx-auto">
            {categoryFilter && (
              <Link
                href="/helpcenter"
                className="inline-flex items-center mb-6 text-sm text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-500"
              >
                <ChevronRight className="h-4 w-4 mr-1 rotate-180" />
                Zurück zur Übersicht
              </Link>
            )}
            <div className="space-y-3">
              {filteredArticles.map((article) => (
                <Link
                  key={article.id}
                  href={`/helpcenter/${slugify(article.title)}-${article.id.slice(0, 8)}`}
                  className="group block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 hover:border-amber-200 dark:hover:border-amber-800 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors">
                        {article.title}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {getExcerpt(article.content)}
                      </p>
                      <div className="flex items-center gap-2 mt-3 text-xs text-slate-400 dark:text-slate-500">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Aktualisiert {formatDate(article.updated_at)}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-amber-500 transition-colors flex-shrink-0 mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          // Grouped view for main page
          <div className="space-y-12 mt-8">
            {Object.entries(articlesByCategory).map(([category, categoryArticles]) => {
              const config = categoryConfig[category] || categoryConfig.help_article

              return (
                <section key={category}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.bgColor} ${config.color}`}>
                        {config.icon}
                      </div>
                      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                        {config.label}
                      </h2>
                    </div>
                    <Link
                      href={`/helpcenter?category=${category}`}
                      className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 flex items-center gap-1"
                    >
                      Alle anzeigen
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {categoryArticles.slice(0, 6).map((article) => (
                      <Link
                        key={article.id}
                        href={`/helpcenter/${slugify(article.title)}-${article.id.slice(0, 8)}`}
                        className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 hover:border-amber-200 dark:hover:border-amber-800 hover:shadow-sm transition-all"
                      >
                        <h3 className="font-medium text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors line-clamp-2">
                          {article.title}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                          {getExcerpt(article.content, 80)}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>

      {/* CTA Section */}
      <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
            Nicht gefunden, was Sie suchen?
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-xl mx-auto">
            Unser Team hilft Ihnen gerne persönlich weiter.
          </p>
          <a
            href="mailto:info@palacios-institut.ch"
            className="inline-flex items-center justify-center px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg transition-colors"
          >
            Kontakt aufnehmen
          </a>
        </div>
      </div>
    </div>
  )
}

// Loading fallback for Suspense
function HelpCenterLoading() {
  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white mb-4">
            Wie können wir helfen?
          </h1>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        </div>
      </div>
    </div>
  )
}

// Main export with Suspense boundary for useSearchParams
export default function HelpCenterPage() {
  return (
    <Suspense fallback={<HelpCenterLoading />}>
      <HelpCenterContent />
    </Suspense>
  )
}
