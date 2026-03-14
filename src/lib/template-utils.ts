/**
 * Template variable resolution for email templates.
 * Supports: {{name}}, {{email}}, {{absender}}, {{kurs}}, {{datum}}, {{betreff}}
 */

export interface TemplateContext {
  recipientName?: string
  recipientEmail?: string
  senderName?: string
  courseName?: string
  subject?: string
}

const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g

const VARIABLE_MAP: Record<string, (ctx: TemplateContext) => string> = {
  name: (ctx) => ctx.recipientName || ctx.recipientEmail || '',
  email: (ctx) => ctx.recipientEmail || '',
  absender: (ctx) => ctx.senderName || '',
  kurs: (ctx) => ctx.courseName || '',
  datum: () => new Date().toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  betreff: (ctx) => ctx.subject || '',
}

export function resolveTemplateVariables(template: string, context: TemplateContext): string {
  return template.replace(VARIABLE_PATTERN, (match, varName: string) => {
    const resolver = VARIABLE_MAP[varName.toLowerCase()]
    if (!resolver) return match // keep unknown variables as-is
    const value = resolver(context)
    return value || match // keep placeholder if value is empty
  })
}

export function getAvailableVariables(): Array<{ variable: string; description: string }> {
  return [
    { variable: '{{name}}', description: 'Name des Empfaengers' },
    { variable: '{{email}}', description: 'E-Mail des Empfaengers' },
    { variable: '{{absender}}', description: 'Ihr Name (aus Profil)' },
    { variable: '{{kurs}}', description: 'Kursname (aus Betreff erkannt)' },
    { variable: '{{datum}}', description: 'Heutiges Datum' },
    { variable: '{{betreff}}', description: 'E-Mail Betreff' },
  ]
}

/**
 * Try to detect a course name from the email subject.
 * Matches known course keywords.
 */
export function detectCourseName(subject: string): string | undefined {
  const courseKeywords: Record<string, string> = {
    'hypnose': 'Hypnose-Ausbildung',
    'hypnotis': 'Hypnose-Ausbildung',
    'meditation': 'Meditation',
    'meditier': 'Meditation',
    'coaching': 'Life Coaching',
    'coach': 'Life Coaching',
    'stress': 'Stressmanagement',
  }
  const lower = subject.toLowerCase()
  for (const [keyword, name] of Object.entries(courseKeywords)) {
    if (lower.includes(keyword)) return name
  }
  return undefined
}
