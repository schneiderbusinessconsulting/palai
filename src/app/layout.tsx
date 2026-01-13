import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { Sidebar } from '@/components/layout/sidebar'

// Help Center domains - these don't show the sidebar
const HELP_CENTER_DOMAINS = ['help.palacios-institut.ch', 'help.palacios-institut.com']

export const metadata: Metadata = {
  title: 'P Intelligence - AI Support Dashboard',
  description: 'Internes Support-Dashboard für das Palacios Institut',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const headersList = await headers()
  const host = headersList.get('host') || ''

  // Check if this is the Help Center domain
  const isHelpCenterDomain = HELP_CENTER_DOMAINS.some(domain =>
    host.includes(domain) || host.startsWith('help.')
  )

  // Help Center domain - no sidebar, full width
  if (isHelpCenterDomain) {
    return (
      <html lang="de" suppressHydrationWarning>
        <head>
          <title>Palacios Hilfe-Center</title>
          <meta name="description" content="Finden Sie Antworten zu Hypnose-Ausbildungen, Kursen und mehr." />
          {/* Open Graph tags for link previews */}
          <meta property="og:title" content="Palacios Hilfe-Center" />
          <meta property="og:description" content="Finden Sie Antworten zu Hypnose-Ausbildungen, Kursen und mehr." />
          <meta property="og:site_name" content="Palacios Hilfe-Center" />
          <meta property="og:type" content="website" />
        </head>
        <body className="font-sans antialiased">
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </body>
      </html>
    )
  }

  // Dashboard domain - with sidebar
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider>
          <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
            <Sidebar />
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
