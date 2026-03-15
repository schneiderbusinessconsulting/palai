/**
 * Company-wide constants. Centralizes hardcoded values used across API routes.
 */

/** Internal company email addresses (excluded from customer lists, insights, etc.) */
export const OWN_EMAILS = [
  'info@palacios-relations.ch',
  'rafael@palacios-relations.ch',
  'philipp@palacios-relations.ch',
  'noreply@palacios-relations.ch',
]

/** Supabase PostgREST filter string for excluding own emails */
export const OWN_EMAILS_FILTER = `(${OWN_EMAILS.map(e => `"${e}"`).join(',')})`
