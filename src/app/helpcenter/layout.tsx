'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { Menu, X, BookOpen, HelpCircle, GraduationCap, ChevronRight } from 'lucide-react'

const navigation = [
  { name: 'Alle Artikel', href: '/helpcenter', icon: BookOpen },
  { name: 'Häufige Fragen', href: '/helpcenter?category=faq', icon: HelpCircle },
  { name: 'Kurse & Ausbildungen', href: '/helpcenter?category=course_info', icon: GraduationCap },
]

// Environment variables
const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL || 'https://palacios-relations.ch/'
const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export default function HelpCenterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()

  // Set document title for Help Center (overrides default "P Intelligence" title)
  // Use MutationObserver to persist the title even if Next.js tries to override it
  useEffect(() => {
    const targetTitle = 'Palacios Hilfe-Center'
    document.title = targetTitle

    // Watch for title changes and revert them
    const observer = new MutationObserver(() => {
      if (document.title !== targetTitle) {
        document.title = targetTitle
      }
    })

    const titleElement = document.querySelector('title')
    if (titleElement) {
      observer.observe(titleElement, { childList: true, characterData: true, subtree: true })
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 antialiased flex flex-col">
      {/* Google Analytics */}
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}

      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-8">
              <Link href="/helpcenter" className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C4AA6A 0%, #B9965A 100%)' }}>
                  <span className="text-white font-bold text-lg font-serif">P</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-900 dark:text-white">Hilfe-Center</span>
                  <span className="hidden sm:inline text-slate-400 dark:text-slate-500 ml-2 text-sm">Palacios Institut</span>
                </div>
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden md:flex items-center gap-1">
                {navigation.map((item) => {
                  const isActive = item.href === '/helpcenter'
                    ? pathname === '/helpcenter' && !pathname.includes('?')
                    : pathname + (typeof window !== 'undefined' ? window.location.search : '') === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-[#B9965A]/10 text-[#B9965A]'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800'
                      }`}
                    >
                      {item.name}
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-4">
              <a
                href={WEBSITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1 text-sm text-slate-600 hover:text-[#B9965A] dark:text-slate-400 dark:hover:text-[#C4AA6A] transition-colors"
              >
                Zur Website
                <ChevronRight className="h-4 w-4" />
              </a>

              {/* Mobile menu button */}
              <button
                type="button"
                className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-4">
            <div className="space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <a
                href={WEBSITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400"
              >
                Zur Website
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C4AA6A 0%, #B9965A 100%)' }}>
                  <span className="text-white font-bold text-lg font-serif">P</span>
                </div>
                <span className="font-semibold text-slate-900 dark:text-white">Palacios Relations</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Hypnose-Ausbildungen und Weiterbildungen für Therapeuten und Coaches.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Schnellzugriff</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="/helpcenter" className="text-slate-500 hover:text-[#B9965A] dark:text-slate-400 dark:hover:text-[#C4AA6A]">
                    Alle Hilfeartikel
                  </Link>
                </li>
                <li>
                  <Link href="/helpcenter?category=faq" className="text-slate-500 hover:text-[#B9965A] dark:text-slate-400 dark:hover:text-[#C4AA6A]">
                    Häufige Fragen
                  </Link>
                </li>
                <li>
                  <Link href="/helpcenter?category=course_info" className="text-slate-500 hover:text-[#B9965A] dark:text-slate-400 dark:hover:text-[#C4AA6A]">
                    Kursinformationen
                  </Link>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white mb-4">Kontakt</h3>
              <ul className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                <li>
                  <a href="mailto:kontakt@palacios-relations.ch" className="hover:text-[#B9965A] dark:hover:text-[#C4AA6A]">
                    kontakt@palacios-relations.ch
                  </a>
                </li>
                <li>
                  <a href={WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="hover:text-[#B9965A] dark:hover:text-[#C4AA6A]">
                    palacios-relations.ch
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
            <p>© {new Date().getFullYear()} Palacios Relations. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
