"use client"

import React, { useState, useMemo } from "react"
import { motion } from "framer-motion"
import { Calculator, RotateCcw, Info, Activity, LineChart, Hash, TrendingUp } from "lucide-react"

type FuncType = "linear" | "quadratic" | "sine"

export function FunctionLab() {
  const [funcType, setFuncType] = useState<FuncType>("linear")
  
  // Slider states for coefficients
  const [a, setA] = useState(1.0) // slope / vertical scale
  const [b, setB] = useState(0.0) // y-intercept / horizontal frequency
  const [c, setC] = useState(-2.0) // constant term / vertical offset

  // Helper values for sliders based on active function
  // Linear: y = ax + b
  // Quadratic: y = ax^2 + bx + c
  // Sine: y = a sin(bx) + c

  const handleReset = () => {
    if (funcType === "linear") {
      setA(1.0)
      setB(0.0)
    } else if (funcType === "quadratic") {
      setA(0.5)
      setB(0.0)
      setC(-2.0)
    } else {
      setA(2.0)
      setB(1.0)
      setC(0.0)
    }
  }

  // Handle function switch
  const handleFuncSwitch = (type: FuncType) => {
    setFuncType(type)
    if (type === "linear") {
      setA(1.0)
      setB(2.0) // acting as intercept
    } else if (type === "quadratic") {
      setA(0.5)
      setB(0.0)
      setC(-2.0)
    } else if (type === "sine") {
      setA(2.0)
      setB(1.0)
      setC(0.0)
    }
  }

  // Dimension helpers for the SVG grid
  const width = 500
  const height = 350
  const centerX = 250
  const centerY = 175
  const pixelsPerUnit = 22 // 1 unit = 22 pixels

  // Map math coordinate (x, y) to SVG screen coordinate (X, Y)
  const mapCoords = (x: number, y: number) => {
    return {
      x: centerX + x * pixelsPerUnit,
      y: centerY - y * pixelsPerUnit
    }
  }

  // Compute math y coordinate from math x coordinate
  const computeY = (x: number) => {
    if (funcType === "linear") {
      // y = a * x + b
      return a * x + b
    } else if (funcType === "quadratic") {
      // y = a * x^2 + b * x + c
      return a * (x * x) + b * x + c
    } else {
      // y = a * sin(b * x) + c
      return a * Math.sin(b * x) + c
    }
  }

  // Generate SVG path for the curve
  const curvePath = useMemo(() => {
    const points: string[] = []
    const rangeX = width / pixelsPerUnit / 2 // approx -11.3 to +11.3

    for (let x = -rangeX - 1; x <= rangeX + 1; x += 0.05) {
      const y = computeY(x)
      
      // Limit y to avoid rendering crazy paths
      if (y >= -15 && y <= 15) {
        const svgPt = mapCoords(x, y)
        points.push(`${points.length === 0 ? "M" : "L"} ${svgPt.x.toFixed(1)} ${svgPt.y.toFixed(1)}`)
      }
    }
    return points.join(" ")
  }, [funcType, a, b, c])

  // Key / Critical Points calculation
  const criticalPoints = useMemo(() => {
    const pts = []
    
    if (funcType === "linear") {
      // Y intercept: (0, b)
      pts.push({
        label: "نقطة التقاطع مع Y",
        x: 0,
        y: b,
        color: "fill-blue-400",
        strokeColor: "rgba(59, 130, 246, 0.4)"
      })

      // X intercept: (-b/a, 0) if a != 0
      if (a !== 0) {
        const xIntercept = -b / a
        pts.push({
          label: "نقطة التقاطع مع X",
          x: xIntercept,
          y: 0,
          color: "fill-emerald-400",
          strokeColor: "rgba(16, 185, 129, 0.4)"
        })
      }
    } else if (funcType === "quadratic") {
      // Vertex: x = -b / (2a), y = f(vertexX)
      if (a !== 0) {
        const vertexX = -b / (2 * a)
        const vertexY = computeY(vertexX)
        pts.push({
          label: "رأس المنحنى (Vertex)",
          x: vertexX,
          y: vertexY,
          color: "fill-purple-400",
          strokeColor: "rgba(168, 85, 247, 0.4)"
        })
      }

      // Y-intercept: (0, c)
      pts.push({
        label: "نقطة التقاطع مع Y",
        x: 0,
        y: c,
        color: "fill-blue-400",
        strokeColor: "rgba(59, 130, 246, 0.4)"
      })
    } else if (funcType === "sine") {
      // Peak 1: x = pi / (2b), y = a + c
      if (b !== 0) {
        const peakX = Math.PI / (2 * b)
        const peakY = a + c
        pts.push({
          label: "القمة العظمى الأولى",
          x: peakX,
          y: peakY,
          color: "fill-amber-400",
          strokeColor: "rgba(245, 158, 11, 0.4)"
        })
      }
      
      // Center intercept: (0, c)
      pts.push({
        label: "نقطة المركز (X = 0)",
        x: 0,
        y: c,
        color: "fill-blue-400",
        strokeColor: "rgba(59, 130, 246, 0.4)"
      })
    }

    return pts.map(pt => ({
      ...pt,
      screen: mapCoords(pt.x, pt.y)
    }))
  }, [funcType, a, b, c])

  // Background Grid render
  const gridElements = useMemo(() => {
    const lines = []
    const rangeX = Math.ceil(width / pixelsPerUnit / 2) // approx 12
    const rangeY = Math.ceil(height / pixelsPerUnit / 2) // approx 8

    // Vertical lines
    for (let x = -rangeX; x <= rangeX; x++) {
      if (x === 0) continue
      const svgPt = mapCoords(x, 0)
      lines.push(
        <g key={`v-${x}`}>
          <line x1={svgPt.x} y1="0" x2={svgPt.x} y2={height} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
          <text x={svgPt.x} y={centerY + 14} fill="rgba(255, 255, 255, 0.3)" fontSize="8" textAnchor="middle" fontWeight="bold">
            {x}
          </text>
        </g>
      )
    }

    // Horizontal lines
    for (let y = -rangeY; y <= rangeY; y++) {
      if (y === 0) continue
      const svgPt = mapCoords(0, y)
      lines.push(
        <g key={`h-${y}`}>
          <line x1="0" y1={svgPt.y} x2={width} y2={svgPt.y} stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
          <text x={centerX - 10} y={svgPt.y + 3} fill="rgba(255, 255, 255, 0.3)" fontSize="8" textAnchor="end" fontWeight="bold">
            {y}
          </text>
        </g>
      )
    }

    return lines
  }, [])

  return (
    <div className="w-full h-full flex flex-col lg:flex-row gap-6 p-4 md:p-6 select-none bg-black/20 text-white rounded-3xl overflow-auto" dir="rtl">
      
      {/* Visual Canvas (60%) */}
      <div className="flex-grow flex flex-col justify-between glass border border-white/10 rounded-2xl p-6 min-h-[350px] relative overflow-hidden">
        
        {/* Header HUD */}
        <div className="flex flex-wrap items-center justify-between gap-4 z-10">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl">
              <Calculator className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-black">
                {funcType === "linear" && "الدالة الخطية: y = ax + b"}
                {funcType === "quadratic" && "الدالة التربيعية: y = ax² + bx + c"}
                {funcType === "sine" && "الدالة الجيبية: y = a sin(bx) + c"}
              </h2>
              <p className="text-xs text-slate-400">استكشف تغير شكل الدالة لحظياً عند تحريك الثوابت</p>
            </div>
          </div>
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs font-bold hover:bg-white/20 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            إعادة تعيين
          </button>
        </div>

        {/* Dynamic Plotter Grid */}
        <div className="flex-grow flex items-center justify-center py-4 relative">
          
          <svg viewBox="0 0 500 350" className="w-full max-w-[460px] h-auto overflow-hidden rounded-xl border border-white/5 bg-white/[0.02] shadow-inner">
            {/* 1. Grid Background Lines */}
            {gridElements}

            {/* 2. Cartesian Axes */}
            {/* X Axis */}
            <line x1="0" y1={centerY} x2={width} y2={centerY} stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2" />
            {/* Y Axis */}
            <line x1={centerX} y1="0" x2={centerX} y2={height} stroke="rgba(255, 255, 255, 0.25)" strokeWidth="2" />
            {/* Center Zero label */}
            <text x={centerX - 8} y={centerY + 12} fill="rgba(255, 255, 255, 0.4)" fontSize="8" fontWeight="bold">0</text>

            {/* 3. The Function Curve Curve (Rendered as Path) */}
            <path 
              d={curvePath}
              fill="none" 
              stroke="#a855f7" 
              strokeWidth="3.5" 
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] transition-all duration-75"
            />

            {/* 4. Critical Points rendering */}
            {criticalPoints.map((pt, idx) => {
              // Only render if coordinates are reasonably within SVG frame bounds
              if (pt.screen.x < 0 || pt.screen.x > width || pt.screen.y < 0 || pt.screen.y > height) return null

              return (
                <g key={idx}>
                  {/* Glowing ring */}
                  <circle 
                    cx={pt.screen.x} 
                    cy={pt.screen.y} 
                    r="12" 
                    fill="none" 
                    stroke={pt.strokeColor.split(" ")[0]} // fetch RGB border
                    className="animate-ping"
                    style={{ animationDuration: '3s' }}
                  />
                  {/* Outer hollow highlight */}
                  <circle cx={pt.screen.x} cy={pt.screen.y} r="6" fill="rgba(255, 255, 255, 0.2)" stroke="white" strokeWidth="1" />
                  {/* Inner dot */}
                  <circle cx={pt.screen.x} cy={pt.screen.y} r="4" className={pt.color} />
                  
                  {/* Coordinate indicator tooltip */}
                  <g transform={`translate(${pt.screen.x > width - 100 ? pt.screen.x - 105 : pt.screen.x + 10}, ${pt.screen.y < 30 ? pt.screen.y + 15 : pt.screen.y - 12})`}>
                    <rect x="0" y="0" width="95" height="16" rx="4" fill="rgba(15, 23, 42, 0.85)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                    <text x="47.5" y="11" fill="#e2e8f0" fontSize="7.5" fontWeight="black" textAnchor="middle">
                      {pt.label}: ({pt.x.toFixed(1)}, {pt.y.toFixed(1)})
                    </text>
                  </g>
                </g>
              )
            })}
          </svg>

        </div>

        {/* Lower Fact bar */}
        <div className="z-10 bg-white/5 border border-white/5 rounded-2xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            {funcType === "linear" && (
              <span>
                <strong>الدالة الخطية</strong> تمثل خطاً مستقيماً. يتحكم الثابت (<span className="text-purple-400 font-bold">a</span>) بـ <strong>الميل والاتجاه</strong>، بينما يتحكم (<span className="text-blue-400 font-bold">b</span>) بموقع <strong>القطع الصادي</strong> (ارتفاع وهبوط المستقيم).
              </span>
            )}
            {funcType === "quadratic" && (
              <span>
                <strong>الدالة التربيعية</strong> ترسم مكافئاً قطعياً (Parabola). معامل ($a$) يحدد <strong>تحدب المنحنى واتجاهه</strong> (للأعلى إذا كان موجباً، والأسفل إذا كان سالباً)، بينما ($b$ و $c$) يزيحان رأس القطع.
              </span>
            )}
            {funcType === "sine" && (
              <span>
                <strong>الدالة الجيبية</strong> ترسم موجة دورية متذبذبة. المعامل (<span className="text-purple-400 font-bold">a</span>) يتحكم بـ <strong>السعة والارتفاع</strong> للموجة، في حين يتحكم (<span className="text-orange-400 font-bold">b</span>) بـ <strong>تردد الموجة</strong> (مدى تقارب القمم).
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Control Panel Panel (40%) */}
      <div className="w-full lg:w-[350px] flex flex-col gap-6 glass border border-white/10 rounded-2xl p-6 justify-between">
        
        <div className="flex flex-col gap-6">
          
          {/* Function Selector */}
          <div className="flex flex-col gap-2 pb-4 border-b border-white/10">
            <label className="text-xs font-bold text-slate-400">اختر نوع الدالة الرياضية:</label>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleFuncSwitch("linear")}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-right border transition-all cursor-pointer ${
                  funcType === "linear"
                    ? "bg-purple-500 border-purple-500 text-slate-950 font-black shadow-lg"
                    : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <LineChart className="w-4 h-4" />
                الدالة الخطية (y = ax + b)
              </button>
              
              <button
                onClick={() => handleFuncSwitch("quadratic")}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-right border transition-all cursor-pointer ${
                  funcType === "quadratic"
                    ? "bg-purple-500 border-purple-500 text-slate-950 font-black shadow-lg"
                    : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <Hash className="w-4 h-4" />
                الدالة التربيعية (y = ax² + bx + c)
              </button>

              <button
                onClick={() => handleFuncSwitch("sine")}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold text-right border transition-all cursor-pointer ${
                  funcType === "sine"
                    ? "bg-purple-500 border-purple-500 text-slate-950 font-black shadow-lg"
                    : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                الدالة الجيبية y = a sin(bx) + c
              </button>
            </div>
          </div>

          {/* Slider Coefficients */}
          <div className="flex flex-col gap-5">
            <label className="text-xs font-bold text-slate-400">تعديل معاملات الدالة (Coefficients):</label>
            
            {/* Coefficient A */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs md:text-sm font-bold">
                <span className="text-slate-300">المعامل (a) — {funcType === "sine" ? "السعة" : "الميل/التمدد"}:</span>
                <span className="text-purple-400 font-mono font-black">{a.toFixed(1)}</span>
              </div>
              <input 
                type="range"
                min={funcType === "quadratic" ? "-2.0" : "-5.0"}
                max={funcType === "quadratic" ? "2.0" : "5.0"}
                step="0.1"
                value={a}
                onChange={(e) => setA(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-purple-500"
              />
            </div>

            {/* Coefficient B */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs md:text-sm font-bold">
                <span className="text-slate-300">
                  {funcType === "linear" && "المعامل (b) — القطع الصادي:"}
                  {funcType === "quadratic" && "المعامل (b) — الإزاحة الأفقية:"}
                  {funcType === "sine" && "المعامل (b) — التردد الدوري:"}
                </span>
                <span className="text-blue-400 font-mono font-black">{b.toFixed(1)}</span>
              </div>
              <input 
                type="range"
                min={funcType === "sine" ? "0.2" : "-5.0"}
                max="5.0"
                step="0.1"
                value={b}
                onChange={(e) => setB(parseFloat(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-blue-400"
              />
            </div>

            {/* Coefficient C (Only for quadratic and sine) */}
            {(funcType === "quadratic" || funcType === "sine") && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs md:text-sm font-bold">
                  <span className="text-slate-300">المعامل (c) — الإزاحة الرأسية / الثابت:</span>
                  <span className="text-amber-400 font-mono font-black">{c.toFixed(1)}</span>
                </div>
                <input 
                  type="range"
                  min="-5.0"
                  max="5.0"
                  step="0.1"
                  value={c}
                  onChange={(e) => setC(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-amber-500"
                />
              </div>
            )}

          </div>

          {/* Equation Mathematical display box */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-4 flex flex-col gap-2 mt-2">
            <h3 className="text-xs md:text-sm font-bold text-purple-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              <span>المعادلة الممثلة حالياً:</span>
            </h3>
            
            <div className="text-center py-2 bg-black/35 rounded-xl border border-white/5 font-mono text-base md:text-lg font-black tracking-wide text-white" dir="ltr">
              {funcType === "linear" && `y = ${a.toFixed(1)}x ${b >= 0 ? `+ ${b.toFixed(1)}` : `- ${Math.abs(b).toFixed(1)}`}`}
              {funcType === "quadratic" && `y = ${a.toFixed(1)}x² ${b >= 0 ? `+ ${b.toFixed(1)}x` : `- ${Math.abs(b).toFixed(1)}x`} ${c >= 0 ? `+ ${c.toFixed(1)}` : `- ${Math.abs(c).toFixed(1)}`}`}
              {funcType === "sine" && `y = ${a.toFixed(1)} sin(${b.toFixed(1)}x) ${c >= 0 ? `+ ${c.toFixed(1)}` : `- ${Math.abs(c).toFixed(1)}`}`}
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
