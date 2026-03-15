import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Relative date formatting: "vor wenigen Minuten", "vor 3h", "gestern", "vor 5 Tagen"
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'gerade eben'
  if (diffMins < 60) return diffMins <= 5 ? 'vor wenigen Minuten' : `vor ${diffMins} Min`
  if (diffHours < 24) return `vor ${diffHours}h`
  if (diffDays === 1) return 'gestern'
  if (diffDays < 7) return `vor ${diffDays} Tagen`
  if (diffDays < 30) return `vor ${Math.floor(diffDays / 7)} Wochen`
  return date.toLocaleDateString('de-CH')
}

/**
 * Absolute date formatting: "15. März 2026" or "15.03.2026, 14:30"
 */
export function formatAbsoluteDate(dateString: string, options?: { withTime?: boolean }): string {
  const date = new Date(dateString)
  if (options?.withTime) {
    return date.toLocaleDateString('de-CH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  return date.toLocaleDateString('de-CH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
