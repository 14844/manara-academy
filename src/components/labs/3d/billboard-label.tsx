"use client"

import React, { useMemo, useEffect } from "react"
import * as THREE from "three"

export interface BillboardLabelProps {
  text: string
  position?: [number, number, number]
  color?: string
  bgColor?: string
  borderColor?: string
  scale?: [number, number, number]
  fontSize?: number
}

export function BillboardLabel({
  text,
  position = [0, 0, 0],
  color = "#ffffff",
  bgColor = "rgba(15, 23, 42, 0.85)",
  borderColor = "rgba(255, 255, 255, 0.25)",
  scale = [1, 0.28, 1],
  fontSize = 28,
}: BillboardLabelProps) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null

    const width = 512
    const height = 128
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")

    if (ctx) {
      ctx.clearRect(0, 0, width, height)

      // Draw rounded background pill
      if (bgColor && bgColor !== "transparent") {
        ctx.fillStyle = bgColor
        ctx.beginPath()
        if (typeof ctx.roundRect === "function") {
          ctx.roundRect(8, 8, width - 16, height - 16, 28)
        } else {
          ctx.rect(8, 8, width - 16, height - 16)
        }
        ctx.fill()

        if (borderColor && borderColor !== "transparent") {
          ctx.strokeStyle = borderColor
          ctx.lineWidth = 4
          ctx.stroke()
        }
      }

      // Draw crisp text with native Arabic and English shaping
      const isArabic = /[\u0600-\u06FF]/.test(text)
      ctx.font = `bold ${fontSize * 2}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
      ctx.fillStyle = color
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.direction = isArabic ? "rtl" : "ltr"
      ctx.fillText(text, width / 2, height / 2 + 2)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }, [text, color, bgColor, borderColor, fontSize])

  useEffect(() => {
    return () => {
      texture?.dispose()
    }
  }, [texture])

  if (!texture) return null

  return (
    <sprite position={position} scale={scale}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  )
}
