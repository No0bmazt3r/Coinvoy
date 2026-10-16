import { useEffect, useState, type ReactNode } from 'react'
import { I18nContext, translate, type Lang } from './t'

const STORAGE_KEY = 'coinvoy.lang'

function savedLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ms'
  } catch {
    return 'ms'
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(savedLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // private mode: the choice just won't persist
    }
  }, [lang])

  return (
    <I18nContext.Provider value={{ lang, setLang, t: (key, vars) => translate(lang, key, vars) }}>
      {children}
    </I18nContext.Provider>
  )
}
