import { useEffect, useState } from 'react'

const THEME_KEY = 'myshop-theme'

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getPreference() {
  const saved = window.localStorage.getItem(THEME_KEY)
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

export default function useTheme() {
  const [preference, setPreference] = useState(getPreference)
  const [isDark, setIsDark] = useState(() =>
    preference === 'system' ? getSystemTheme() : preference === 'dark'
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSystemThemeChange = (event) => {
      if (preference === 'system') setIsDark(event.matches)
    }
    media.addEventListener('change', onSystemThemeChange)
    return () => media.removeEventListener('change', onSystemThemeChange)
  }, [preference])

  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light'
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light'
  }, [isDark])

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== THEME_KEY) return
      const next = event.newValue === 'light' || event.newValue === 'dark'
        ? event.newValue
        : 'system'
      setPreference(next)
      setIsDark(next === 'system' ? getSystemTheme() : next === 'dark')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    window.localStorage.setItem(THEME_KEY, next)
    setPreference(next)
    setIsDark(next === 'dark')
  }

  return { isDark, toggleTheme }
}
