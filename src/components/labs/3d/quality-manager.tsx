"use client"

import { useState, useEffect, createContext, useContext } from "react"

export type QualityTier = "high" | "medium" | "low"

export interface QualitySettings {
  tier: QualityTier
  dpr: number
  shadows: boolean
  postprocessing: boolean
  particleCount: number
  isMobile: boolean
  isLowPower: boolean
  setTier: (tier: QualityTier) => void
}

const QualityContext = createContext<QualitySettings>({
  tier: "high",
  dpr: 1.5,
  shadows: true,
  postprocessing: true,
  particleCount: 1,
  isMobile: false,
  isLowPower: false,
  setTier: () => {},
})

export function QualityProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTierState] = useState<QualityTier>("high")
  const [isMobile, setIsMobile] = useState<boolean>(false)
  const [isLowPower, setIsLowPower] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    // Detect mobile or low concurrency
    const mobileCheck =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      window.innerWidth < 768
    setIsMobile(mobileCheck)

    const concurrency = navigator.hardwareConcurrency || 4
    const lowPower = mobileCheck || concurrency <= 4
    setIsLowPower(lowPower)

    // Check user preference for reduced motion
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

    // Default tier: low for weak mobile, medium for standard mobile, high for desktop
    if (prefersReducedMotion || (mobileCheck && concurrency <= 4)) {
      setTierState("low")
    } else if (mobileCheck) {
      setTierState("medium")
    } else {
      setTierState("high")
    }
  }, [])

  const setTier = (newTier: QualityTier) => {
    setTierState(newTier)
  }

  // Derive settings based on tier
  const dpr = tier === "high" ? Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 2 : 2, 2) : tier === "medium" ? 1.25 : 1
  const shadows = tier === "high" || (tier === "medium" && !isMobile)
  const postprocessing = tier === "high" && !isMobile
  const particleCount = tier === "high" ? 1 : tier === "medium" ? 0.6 : 0.3

  return (
    <QualityContext.Provider
      value={{
        tier,
        dpr,
        shadows,
        postprocessing,
        particleCount,
        isMobile,
        isLowPower,
        setTier,
      }}
    >
      {children}
    </QualityContext.Provider>
  )
}

export function useQuality() {
  return useContext(QualityContext)
}
