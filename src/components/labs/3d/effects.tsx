"use client"

import React from "react"
import { EffectComposer, Bloom } from "@react-three/postprocessing"
import { useQuality } from "./quality-manager"

export function LabPostProcessing() {
  const { postprocessing } = useQuality()

  if (!postprocessing) return null

  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        intensity={0.4}
        luminanceThreshold={0.82}
        luminanceSmoothing={0.3}
        mipmapBlur
      />
    </EffectComposer>
  )
}
