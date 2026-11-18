"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

export type LabLanguage = "ar" | "en"

interface LanguageContextType {
  lang: LabLanguage
  setLang: (lang: LabLanguage) => void
  t: (ar: string, en: string) => string
  dir: "rtl" | "ltr"
  isAr: boolean
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "ar",
  setLang: () => {},
  t: (ar) => ar,
  dir: "rtl",
  isAr: true,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<LabLanguage>("ar")

  const t = (ar: string, en: string) => (lang === "ar" ? ar : en)
  const dir = lang === "ar" ? "rtl" : "ltr"
  const isAr = lang === "ar"

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir, isAr }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLabLanguage() {
  return useContext(LanguageContext)
}
