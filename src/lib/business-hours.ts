/**
 * Business hours utilities for SLA calculations.
 * Default: Monday-Friday 08:00-17:00 Europe/Zurich
 */

export interface BusinessHoursConfig {
  day_of_week: number  // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string   // "08:00"
  end_time: string     // "17:00"
  is_active: boolean
}

const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig[] = [
  { day_of_week: 1, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 2, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 3, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 4, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 5, start_time: '08:00', end_time: '17:00', is_active: true },
]

function parseTime(time: string): { hours: number; minutes: number } {
  const [hours, minutes] = time.split(':').map(Number)
  return { hours, minutes }
}

export function isWithinBusinessHours(
  date: Date,
  hours: BusinessHoursConfig[] = DEFAULT_BUSINESS_HOURS
): boolean {
  const dayConfig = hours.find(h => h.day_of_week === date.getDay() && h.is_active)
  if (!dayConfig) return false

  const start = parseTime(dayConfig.start_time)
  const end = parseTime(dayConfig.end_time)
  const current = date.getHours() * 60 + date.getMinutes()

  return current >= (start.hours * 60 + start.minutes) && current <= (end.hours * 60 + end.minutes)
}

/**
 * Calculate business minutes between two dates.
 * Only counts minutes during business hours (Mon-Fri 08:00-17:00 by default).
 */
export function calculateBusinessMinutes(
  startDate: Date,
  endDate: Date,
  hours: BusinessHoursConfig[] = DEFAULT_BUSINESS_HOURS
): number {
  if (endDate <= startDate) return 0

  const activeHours = hours.filter(h => h.is_active)
  if (activeHours.length === 0) {
    // No business hours configured — fall back to calendar minutes
    return (endDate.getTime() - startDate.getTime()) / (1000 * 60)
  }

  let totalMinutes = 0
  const current = new Date(startDate)

  // Cap at 30 days to prevent infinite loops
  const maxDate = new Date(startDate)
  maxDate.setDate(maxDate.getDate() + 30)
  const effectiveEnd = endDate < maxDate ? endDate : maxDate

  while (current < effectiveEnd) {
    const dayConfig = activeHours.find(h => h.day_of_week === current.getDay())

    if (dayConfig) {
      const start = parseTime(dayConfig.start_time)
      const end = parseTime(dayConfig.end_time)
      const dayStart = start.hours * 60 + start.minutes
      const dayEnd = end.hours * 60 + end.minutes

      // Check if current day is the start day or end day
      const isStartDay = current.toDateString() === startDate.toDateString()
      const isEndDay = current.toDateString() === effectiveEnd.toDateString()

      let effectiveStart = dayStart
      let effectiveEndMin = dayEnd

      if (isStartDay) {
        const currentMinutes = current.getHours() * 60 + current.getMinutes()
        effectiveStart = Math.max(dayStart, currentMinutes)
      }

      if (isEndDay) {
        const endMinutes = effectiveEnd.getHours() * 60 + effectiveEnd.getMinutes()
        effectiveEndMin = Math.min(dayEnd, endMinutes)
      }

      if (effectiveEndMin > effectiveStart) {
        totalMinutes += effectiveEndMin - effectiveStart
      }
    }

    // Move to start of next day
    current.setDate(current.getDate() + 1)
    current.setHours(0, 0, 0, 0)
  }

  return totalMinutes
}

export { DEFAULT_BUSINESS_HOURS }
