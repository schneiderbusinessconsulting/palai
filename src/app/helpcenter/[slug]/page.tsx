'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import {
  ChevronRight,
  BookOpen,
  HelpCircle,
  GraduationCap,
  Loader2,
  Clock,
  FileText,
} from 'lucide-react'
import { formatAbsoluteDate } from '@/lib/utils'

interface Article {
  id: string
  title: string
  source_type: string
  content: string
  updated_at: string
}

const categoryConfig: Record<string, {
  label: string
  href: string
  icon: React.ReactNode
  color: string
  bgColor: string
}> = {
  help_article: {
    label: 'Allgemeine Hilfe',
    href: '/helpcenter?category=help_article',
    icon: <BookOpen className="h-4 w-4" />,
    color: 'text-gold-600 dark:text-gold-400',
    bgColor: 'bg-gold-100 dark:bg-gold-900/30',
  },
  faq: {
    label: 'Häufige Fragen',
    href: '/helpcenter?category=faq',
    icon: <HelpCircle className="h-4 w-4" />,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
  },
  course_info: {
    label: 'Kurse & Ausbildungen',
    href: '/helpcenter?category=course_info',
    icon: <GraduationCap className="h-4 w-4" />,
    color: 'text-[#B9965A] dark:text-[#C4AA6A]',
    bgColor: 'bg-[#B9965A]/10 dark:bg-[#B9965A]/20',
  },
}

export default function ArticlePage() {
  const params = useParams()
  const slug = params.slug as string
  const [article, setArticle] = useState<Article | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchArticle = async () => {
      try {
        // Extract ID from slug (last 8 characters after the last dash)
        const parts = slug.split('-')
        const id = parts[parts.length - 1]

        const response = await fetch(`/api/helpcenter/${id}`)
        if (response.ok) {
          const data = await response.json()
          setArticle(data.article)
        } else {
          setError('Artikel nicht gefunden')
        }
      } catch (err) {
        console.error('Failed to fetch article:', err)
        setError('Fehler beim Laden des Artikels')
      } finally {
        setIsLoading(false)
      }
    }

    if (slug) {
      fetchArticle()
    }
  }, [slug])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#B9965A]" />
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <FileText className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {error || 'Artikel nicht gefunden'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Der angeforderte Artikel existiert nicht oder wurde entfernt.
          </p>
          <Link
            href="/helpcenter"
            className="inline-flex items-center justify-center px-6 py-3 bg-[#B9965A] hover:bg-[#B9965A] text-white font-medium rounded-lg transition-colors"
          >
            Zurück zum Hilfe-Center
          </Link>
        </div>
      </div>
    )
  }

  const config = categoryConfig[article.source_type] || categoryConfig.help_article

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Breadcrumb */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/helpcenter"
              className="text-slate-500 hover:text-[#B9965A] dark:text-slate-400 dark:hover:text-[#B9965A] transition-colors"
            >
              Hilfe-Center
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <Link
              href={config.href}
              className="text-slate-500 hover:text-[#B9965A] dark:text-slate-400 dark:hover:text-[#B9965A] transition-colors"
            >
              {config.label}
            </Link>
            <ChevronRight className="h-4 w-4 text-slate-400" />
            <span className="text-slate-900 dark:text-white font-medium truncate max-w-[200px]">
              {article.title}
            </span>
          </nav>
        </div>
      </div>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <header className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}>
              {config.icon}
              {config.label}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mb-4">
            {article.title}
          </h1>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Clock className="h-4 w-4" />
            <span>Zuletzt aktualisiert am {formatAbsoluteDate(article.updated_at)}</span>
          </div>
        </header>

        {/* Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none
          prose-headings:font-semibold
          prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
          prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
          prose-p:text-slate-600 dark:prose-p:text-slate-300 prose-p:leading-relaxed
          prose-a:text-[#B9965A] dark:prose-a:text-[#B9965A] prose-a:no-underline hover:prose-a:underline
          prose-strong:text-slate-900 dark:prose-strong:text-white
          prose-ul:my-4 prose-li:my-1
          prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
          prose-pre:bg-slate-900 dark:prose-pre:bg-slate-800 prose-pre:border prose-pre:border-slate-200 dark:prose-pre:border-slate-700
        ">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>
      </article>

      {/* Related / Help Footer */}
      <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              War dieser Artikel hilfreich?
            </h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Falls Sie weitere Fragen haben, kontaktieren Sie uns gerne.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="mailto:kontakt@palacios-relations.ch"
                className="inline-flex items-center justify-center px-6 py-3 bg-[#B9965A] hover:bg-[#9A7D4A] text-white font-medium rounded-lg transition-colors"
              >
                Kontakt aufnehmen
              </a>
              <Link
                href="/helpcenter"
                className="inline-flex items-center justify-center px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-medium rounded-lg transition-colors"
              >
                Weitere Artikel
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
