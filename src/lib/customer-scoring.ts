export function calculateHealthScore(
  avgHappiness: number,
  totalEmails: number,
  responseRate: number,
  daysSinceLastContact: number
): number {
  let score = 50
  // Happiness: 1-5 mapped to -30 to +30
  score += (avgHappiness - 3) * 15
  // Activity: more emails = more engaged
  score += Math.min(totalEmails * 2, 20)
  // Response rate bonus
  score += responseRate * 10
  // Recency penalty
  if (daysSinceLastContact > 90) score -= 20
  else if (daysSinceLastContact > 30) score -= 10
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function determineSegment(
  healthScore: number,
  totalEmails: number,
  daysSinceLastContact: number,
  avgBuyingIntent: number
): string {
  if (healthScore >= 80 && avgBuyingIntent >= 60) return 'vip'
  if (healthScore < 30 || daysSinceLastContact > 90) return 'churned'
  if (healthScore < 50) return 'at_risk'
  if (totalEmails <= 2 && daysSinceLastContact < 30) return 'new'
  return 'active'
}

export function getSegmentConfig(segment: string) {
  const configs: Record<string, { label: string; color: string; icon: string }> = {
    vip: { label: 'VIP', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: '⭐' },
    at_risk: { label: 'Gefährdet', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: '⚠️' },
    new: { label: 'Neu', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: '🆕' },
    churned: { label: 'Abgewandert', color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400', icon: '💤' },
    active: { label: 'Aktiv', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: '✅' },
  }
  return configs[segment] || configs.active
}
