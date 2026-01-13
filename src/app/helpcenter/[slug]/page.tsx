'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  BookOpen,
  HelpCircle,
  FileText,
  GraduationCap,
  Loader2,
  Calendar,
} from 'lucide-react'

interface Article {
  id: string
  title: string
  source_type: string
  content: string
  updated_at: string
}

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  help_article: {
    label: 'Allgemein',
    icon: <BookOpen className="h-4 w-4" />,
    color: 'bg-blue-100 text-blue-700',
  },
  faq: {
    label: 'Häufige Fragen',
    icon: <HelpCircle className="h-4 w-4" />,
    color: 'bg-purple-100 text-purple-700',
  },
  course_info: {
    label: 'Kurse & Ausbildungen',
    icon: <GraduationCap className="h-4 w-4" />,
    color: 'bg-amber-100 text-amber-700',
  },
  email: {
    label: 'Kontakt',
    icon: <FileText className="h-4 w-4" />,
    color: 'bg-green-100 text-green-700',
  },
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('de-CH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
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
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    )
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <HelpCircle className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {error || 'Artikel nicht gefunden'}
          </h1>
          <p className="text-slate-500 mb-8">
            Der angeforderte Artikel existiert nicht oder wurde entfernt.
          </p>
          <Link href="/helpcenter">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Zurück zum Help Center
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const config = categoryConfig[article.source_type] || categoryConfig.help_article

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link
            href="/helpcenter"
            className="inline-flex items-center text-sm text-slate-500 hover:text-amber-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Zurück zum Help Center
          </Link>
        </div>
      </div>

      {/* Article Content */}
      <article className="max-w-3xl mx-auto px-4 py-12">
        {/* Meta */}
        <div className="flex items-center gap-3 mb-6">
          <Badge className={`${config.color} gap-1`}>
            {config.icon}
            {config.label}
          </Badge>
          <span className="text-sm text-slate-500 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(article.updated_at)}
          </span>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8">
          {article.title}
        </h1>

        {/* Content */}
        <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>
      </article>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 mt-20">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-6 text-center">
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">
              War dieser Artikel hilfreich?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Falls Sie weitere Fragen haben, kontaktieren Sie uns gerne.
            </p>
            <a
              href="mailto:info@palacios-institut.ch"
              className="inline-flex items-center justify-center px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
            >
              Kontakt aufnehmen
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
