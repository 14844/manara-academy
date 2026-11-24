"use client"

import React, { useState, useEffect, Suspense, Component, ErrorInfo } from "react"
import { Canvas } from "@react-three/fiber"
import { QualityProvider, useQuality } from "./quality-manager"
import { WebGLFallback } from "./webgl-fallback"
import { Loader2 } from "lucide-react"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback: (error: Error, reset: () => void) => React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class CanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.warn("Canvas WebGL error caught:", error, errorInfo)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.error || new Error("WebGL context error"), this.reset)
    }
    return this.props.children
  }
}

function InCanvasLoader() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 z-20 backdrop-blur-sm pointer-events-none transition-opacity duration-300">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <span className="text-sm font-bold text-slate-200">جاري تحميل بيئة المختبر ثلاثية الأبعاد...</span>
      </div>
    </div>
  )
}

function InnerCanvas({
  children,
  camera = { position: [0, 2.2, 3.8], fov: 45, far: 1000 },
  onResetCamera,
}: {
  children: React.ReactNode
  camera?: { position: [number, number, number]; fov?: number; far?: number }
  onResetCamera?: () => void
}) {
  const { dpr, shadows } = useQuality()

  // Global keyboard shortcuts within the lab container
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      if (e.key === "r" || e.key === "R" || e.key === "ق") {
        onResetCamera?.()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onResetCamera])

  return (
    <Canvas
      shadows={shadows}
      dpr={dpr}
      camera={{
        position: camera.position,
        fov: camera.fov || 45,
        near: 0.1,
        far: camera.far || 1000,
      }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        alpha: false,
        stencil: false,
        depth: true,
      }}
      className="absolute inset-0 w-full h-full touch-none select-none"
    >
      {children}
    </Canvas>
  )
}

interface LabCanvasProps {
  children: React.ReactNode
  camera?: { position: [number, number, number]; fov?: number; far?: number }
  onResetCamera?: () => void
  className?: string
}

export function LabCanvas({ children, camera, onResetCamera, className = "" }: LabCanvasProps) {
  const [hasWebGL, setHasWebGL] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    try {
      const testCanvas = document.createElement("canvas")
      const gl = testCanvas.getContext("webgl2") || testCanvas.getContext("webgl")
      setHasWebGL(Boolean(gl))
    } catch {
      setHasWebGL(false)
    }

    const timer = setTimeout(() => setIsLoading(false), 300)
    return () => clearTimeout(timer)
  }, [])

  if (hasWebGL === false) {
    return <WebGLFallback onRetry={() => setHasWebGL(true)} />
  }

  return (
    <div className={`absolute inset-0 w-full h-full overflow-hidden bg-slate-950 select-none ${className}`}>
      {isLoading && <InCanvasLoader />}
      <CanvasErrorBoundary fallback={(err, reset) => <WebGLFallback errorMessage={err.message} onRetry={reset} />}>
        <InnerCanvas camera={camera} onResetCamera={onResetCamera}>
          {children}
        </InnerCanvas>
      </CanvasErrorBoundary>
    </div>
  )
}
