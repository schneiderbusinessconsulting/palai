import { describe, it, expect } from 'vitest'
import { isWithinBusinessHours, calculateBusinessMinutes, BusinessHoursConfig } from '../business-hours'

const defaultHours: BusinessHoursConfig[] = [
  { day_of_week: 1, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 2, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 3, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 4, start_time: '08:00', end_time: '17:00', is_active: true },
  { day_of_week: 5, start_time: '08:00', end_time: '17:00', is_active: true },
]

describe('isWithinBusinessHours', () => {
  it('should return true during business hours on weekday', () => {
    // Wednesday 2026-03-11 at 10:00
    const date = new Date(2026, 2, 11, 10, 0, 0)
    expect(date.getDay()).toBe(3) // Wednesday
    expect(isWithinBusinessHours(date, defaultHours)).toBe(true)
  })

  it('should return false on weekend', () => {
    // Saturday 2026-03-14 at 10:00
    const date = new Date(2026, 2, 14, 10, 0, 0)
    expect(date.getDay()).toBe(6) // Saturday
    expect(isWithinBusinessHours(date, defaultHours)).toBe(false)
  })

  it('should return false before business hours', () => {
    // Monday at 07:00
    const date = new Date(2026, 2, 9, 7, 0, 0)
    expect(date.getDay()).toBe(1) // Monday
    expect(isWithinBusinessHours(date, defaultHours)).toBe(false)
  })

  it('should return false after business hours', () => {
    // Monday at 18:00
    const date = new Date(2026, 2, 9, 18, 0, 0)
    expect(isWithinBusinessHours(date, defaultHours)).toBe(false)
  })

  it('should return true at boundary (start)', () => {
    // Monday at 08:00
    const date = new Date(2026, 2, 9, 8, 0, 0)
    expect(isWithinBusinessHours(date, defaultHours)).toBe(true)
  })

  it('should return true at boundary (end)', () => {
    // Monday at 17:00
    const date = new Date(2026, 2, 9, 17, 0, 0)
    expect(isWithinBusinessHours(date, defaultHours)).toBe(true)
  })
})

describe('calculateBusinessMinutes', () => {
  it('should calculate minutes within same business day', () => {
    // Monday 08:00 to Monday 10:00 = 120 minutes
    const start = new Date(2026, 2, 9, 8, 0, 0)
    const end = new Date(2026, 2, 9, 10, 0, 0)
    expect(calculateBusinessMinutes(start, end, defaultHours)).toBe(120)
  })

  it('should ignore time outside business hours on start day', () => {
    // Monday 06:00 to Monday 10:00 = 120 minutes (only 08:00-10:00 counts)
    const start = new Date(2026, 2, 9, 6, 0, 0)
    const end = new Date(2026, 2, 9, 10, 0, 0)
    expect(calculateBusinessMinutes(start, end, defaultHours)).toBe(120)
  })

  it('should cap end time at business hours close', () => {
    // Monday 15:00 to Monday 20:00 = 120 minutes (only 15:00-17:00 counts)
    const start = new Date(2026, 2, 9, 15, 0, 0)
    const end = new Date(2026, 2, 9, 20, 0, 0)
    expect(calculateBusinessMinutes(start, end, defaultHours)).toBe(120)
  })

  it('should span across weekend with zero weekend minutes', () => {
    // Friday 16:00 to Monday 09:00 = 60 + 60 = 120 minutes
    // Friday: 16:00-17:00 = 60 min
    // Saturday + Sunday: 0 min
    // Monday: 08:00-09:00 = 60 min
    const start = new Date(2026, 2, 13, 16, 0, 0) // Friday
    const end = new Date(2026, 2, 16, 9, 0, 0) // Monday
    expect(calculateBusinessMinutes(start, end, defaultHours)).toBe(120)
  })

  it('should calculate full business day as 540 minutes', () => {
    // Monday 08:00 to Monday 17:00 = 540 minutes (9 hours)
    const start = new Date(2026, 2, 9, 8, 0, 0)
    const end = new Date(2026, 2, 9, 17, 0, 0)
    expect(calculateBusinessMinutes(start, end, defaultHours)).toBe(540)
  })

  it('should return 0 when end is before start', () => {
    const start = new Date(2026, 2, 9, 12, 0, 0)
    const end = new Date(2026, 2, 9, 10, 0, 0)
    expect(calculateBusinessMinutes(start, end, defaultHours)).toBe(0)
  })

  it('should return 0 when entirely on weekend', () => {
    const start = new Date(2026, 2, 14, 10, 0, 0) // Saturday
    const end = new Date(2026, 2, 14, 14, 0, 0) // Saturday
    expect(calculateBusinessMinutes(start, end, defaultHours)).toBe(0)
  })

  it('should span multiple days correctly', () => {
    // Monday 08:00 to Wednesday 17:00 = 3 * 540 = 1620 minutes
    const start = new Date(2026, 2, 9, 8, 0, 0) // Monday
    const end = new Date(2026, 2, 11, 17, 0, 0) // Wednesday
    expect(calculateBusinessMinutes(start, end, defaultHours)).toBe(1620)
  })
})
