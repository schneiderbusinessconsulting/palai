'use client'

import { useCallback, useRef } from 'react'

/**
 * Hook for playing notification sounds.
 * Uses Web Audio API for a simple chime — no external audio files needed.
 */
export function useNotificationSound() {
  const audioContextRef = useRef<AudioContext | null>(null)

  const play = useCallback(() => {
    try {
      // Check user preference
      if (localStorage.getItem('notificationSounds') === 'false') return

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext()
      }
      const ctx = audioContextRef.current

      // Simple two-tone chime
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(880, ctx.currentTime) // A5
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(1108.73, ctx.currentTime) // C#6

      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(ctx.currentTime)
      osc2.start(ctx.currentTime + 0.1)
      osc1.stop(ctx.currentTime + 0.3)
      osc2.stop(ctx.currentTime + 0.4)
    } catch {
      // Audio not available, silently skip
    }
  }, [])

  const setEnabled = useCallback((enabled: boolean) => {
    localStorage.setItem('notificationSounds', String(enabled))
  }, [])

  const isEnabled = useCallback(() => {
    return localStorage.getItem('notificationSounds') !== 'false'
  }, [])

  return { play, setEnabled, isEnabled }
}
