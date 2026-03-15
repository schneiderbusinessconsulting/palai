'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
type ThemeMode = 'manual' | 'auto' // auto = follow schedule

interface ThemeContextType {
  theme: Theme
  themeMode: ThemeMode
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
  setThemeMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  themeMode: 'manual',
  toggleTheme: () => {},
  setTheme: () => {},
  setThemeMode: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [themeMode, setThemeModeState] = useState<ThemeMode>('manual')
  const [mounted, setMounted] = useState(false)

  // Auto dark mode: dark between 20:00-07:00
  const getAutoTheme = (): Theme => {
    const hour = new Date().getHours()
    return (hour >= 20 || hour < 7) ? 'dark' : 'light'
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const storedMode = localStorage.getItem('themeMode') as ThemeMode | null
    if (storedMode === 'auto') {
      setThemeModeState('auto')
      setThemeState(getAutoTheme())
    } else {
      const stored = localStorage.getItem('theme') as Theme | null
      if (stored === 'dark') setThemeState('dark')
    }
  }, [])

  // Schedule check every minute in auto mode
  useEffect(() => {
    if (!mounted || themeMode !== 'auto') return
    const interval = setInterval(() => {
      setThemeState(getAutoTheme())
    }, 60_000)
    return () => clearInterval(interval)
  }, [mounted, themeMode])

  useEffect(() => {
    if (!mounted) return
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme, mounted])

  const toggleTheme = () => {
    setThemeModeState('manual')
    localStorage.setItem('themeMode', 'manual')
    setThemeState(prev => prev === 'light' ? 'dark' : 'light')
  }

  const setTheme = (newTheme: Theme) => {
    setThemeModeState('manual')
    localStorage.setItem('themeMode', 'manual')
    setThemeState(newTheme)
  }

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode)
    localStorage.setItem('themeMode', mode)
    if (mode === 'auto') setThemeState(getAutoTheme())
  }

  // Prevent flash by not rendering until mounted
  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, themeMode, toggleTheme, setTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
