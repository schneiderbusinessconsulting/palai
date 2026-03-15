/**
 * Shared email filtering and classification utilities.
 * Used by Dashboard, Sidebar, Briefing, and Inbox.
 */

interface EmailBase {
  email_type?: string
  needs_response?: boolean
  status?: string
}

/**
 * Checks if an email is actionable (requires human attention).
 * Excludes system alerts, notifications, and form submissions without comments.
 */
export function isActionableEmail(e: EmailBase): boolean {
  return (
    e.email_type !== 'system_alert' &&
    e.email_type !== 'notification' &&
    (e.email_type !== 'form_submission' || !!e.needs_response)
  )
}

/**
 * Counts pending emails that need attention (actionable + pending status).
 */
export function countPendingEmails(emails: EmailBase[]): number {
  return emails.filter(e => isActionableEmail(e) && e.status === 'pending').length
}
