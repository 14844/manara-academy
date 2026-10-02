"use client"

import React, { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Zap, RotateCcw, HelpCircle, Eye, EyeOff, Bolt, Activity } from "lucide-react"

export function CircuitLab() {
  const [voltage, setVoltage] = useState(9) // 0V to 24V
  const [resistance, setResistance] = useState(15) // 1 Ohm to 100 Ohm
  const [isSwitchOpen, setIsSwitchOpen] = useState(false)
  const [isSchematic, setIsSchematic] = useState(false)

  // Calculations
  const current = useMemo(() => {
    if (isSwitchOpen) return 0
    return Number((voltage / resistance).toFixed(2))
  }, [voltage, resistance, isSwitchOpen])

  const power = useMemo(() => {
    if (isSwitchOpen) return 0
    return Number((voltage * current).toFixed(2))
  }, [voltage, current, isSwitchOpen])

  // Reset function
  const handleReset = () => {
    setVoltage(9)
    setResistance(15)
    setIsSwitchOpen(false)
  }

  // Speed of electrons based on current (lower duration = faster speed)
  const animationDuration = useMemo(() => {
    if (current === 0) return 0
    return Math.max(0.4, 8 / current) // cap duration between 0.4s and 8s
  }, [current])

  return (
    <div className="w-full h-full flex flex-col lg:flex-row gap-6 p-4 md:p-6 select-none bg-black/20 text-white rounded-3xl overflow-auto" dir="rtl">
      
      {/* Simulation Screen (60%) */}
      <div className="flex-grow flex flex-col justify-between glass border border-white/10 rounded-2xl p-6 min-h-[350px] relative overflow-hidden">
        
        {/* Style definitions for electron flow animation */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes flow-reverse {
            from { stroke-dashoffset: 0; }
            to { stroke-dashoffset: 40; }
          }
          .electron-path {
            stroke-dasharray: 6 14;
            animation: flow-reverse var(--duration, 2s) linear infinite;
          }
        `}} />

        {/* Top Info Bar */}
        <div className="flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <span className="flex h-3.5 w-3.5 items-center justify-center relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isSwitchOpen ? "bg-red-400" : "bg-emerald-400"} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isSwitchOpen ? "bg-red-500" : "bg-emerald-500"}`}></span>
            </span>
            <span className="text-xs md:text-sm font-bold text-slate-300">
              حالة الدائرة: {isSwitchOpen ? "مفتوحة (لا يوجد تيار)" : "مغلقة (نشطة)"}
            </span>
          </div>
          <button 
            onClick={() => setIsSchematic(!isSchematic)} 
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs font-bold hover:bg-white/20 transition-all cursor-pointer"
          >
            <Bolt className="w-3.5 h-3.5" />
            {isSchematic ? "عرض واقعي" : "عرض تخطيطي ⏦"}
          </button>
        </div>

        {/* Visual Circuit Canvas */}
        <div className="flex-grow flex items-center justify-center py-6 relative">
          <svg viewBox="0 0 500 350" className="w-full max-w-[460px] h-auto drop-shadow-xl">
            {/* 1. Main Circuit Wire Loop (Rounded Rectangle) */}
            <rect 
              x="50" 
              y="50" 
              width="400" 
              height="250" 
              rx="24" 
              fill="none" 
              stroke="#475569" 
              strokeWidth="6" 
              strokeLinecap="round"
            />

            {/* 2. Electron Flow (Only animates if current > 0) */}
            {!isSwitchOpen && current > 0 && (
              <rect 
                x="50" 
                y="50" 
                width="400" 
                height="250" 
                rx="24" 
                fill="none" 
                stroke="#60a5fa" 
                strokeWidth="4" 
                strokeLinecap="round"
                className="electron-path"
                style={{ "--duration": `${animationDuration}s` } as React.CSSProperties}
              />
            )}

            {/* Component: Resistor (Left side: x = 50, y = 140 to 200) */}
            <g transform="translate(50, 140)">
              {/* Wire cutout background */}
              <rect x="-10" y="0" width="20" height="70" fill="#18181b" />
              {isSchematic ? (
                // Schematic Resistor symbol (Zig-zag)
                <path 
                  d="M 0 0 L 0 15 L -12 20 L 12 28 L -12 36 L 12 44 L -12 52 L 0 57 L 0 70" 
                  fill="none" 
                  stroke="#ef4444" 
                  strokeWidth="4"
                  strokeLinejoin="miter"
                />
              ) : (
                // Realistic Resistor
                <g>
                  <rect x="-8" y="10" width="16" height="50" rx="6" fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
                  {/* Colored bands (Resistance lines) */}
                  <rect x="-8" y="20" width="16" height="4" fill="#8b5cf6" /> {/* Violet */}
                  <rect x="-8" y="30" width="16" height="4" fill="#3b82f6" /> {/* Blue */}
                  <rect x="-8" y="40" width="16" height="4" fill="#ef4444" /> {/* Red */}
                  <rect x="-8" y="50" width="16" height="4" fill="#eab308" /> {/* Gold */}
                </g>
              )}
              {/* Text label */}
              <text x="-45" y="40" fill="#cbd5e1" fontSize="13" fontWeight="bold" textAnchor="middle">
                {resistance} Ω
              </text>
            </g>

            {/* Component: Switch (Right side: x = 450, y = 140 to 200) */}
            <g transform="translate(450, 140)" className="cursor-pointer" onClick={() => setIsSwitchOpen(!isSwitchOpen)}>
              {/* Wire cutout background */}
              <rect x="-10" y="0" width="20" height="70" fill="#18181b" />
              
              {/* Connection Dots */}
              <circle cx="0" cy="15" r="6" fill="#94a3b8" />
              <circle cx="0" cy="55" r="6" fill="#94a3b8" />
              
              {/* Switch Blade lever */}
              {isSwitchOpen ? (
                // Open Switch (rotated at 45 deg)
                <line x1="0" y1="55" x2="25" y2="25" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" />
              ) : (
                // Closed Switch
                <line x1="0" y1="55" x2="0" y2="15" stroke="#10b981" strokeWidth="5" strokeLinecap="round" />
              )}
              
              {/* Text label */}
              <text x="50" y="40" fill="#cbd5e1" fontSize="13" fontWeight="bold" textAnchor="middle">
                {isSwitchOpen ? "مفتوح" : "مغلق"}
              </text>
            </g>

            {/* Component: Lightbulb (Top side: x = 250, y = 50) */}
            <g transform="translate(250, 50)">
              {/* Wire cutout background */}
              <rect x="-35" y="-10" width="70" height="20" fill="#18181b" />

              {/* Dynamic Bulb Glow Shadow (Realistic only) */}
              {!isSchematic && !isSwitchOpen && power > 0 && (
                <circle 
                  cx="0" 
                  cy="-15" 
                  r={Math.min(30 + power * 0.8, 80)} 
                  fill="#eab308" 
                  opacity={Math.min(0.1 + (power / 40), 0.65)} 
                  className="transition-all duration-300 blur-xl"
                />
              )}

              {isSchematic ? (
                // Schematic Bulb (Circle with X)
                <g>
                  <circle cx="0" cy="0" r="18" fill="#18181b" stroke="#eab308" strokeWidth="4" />
                  <line x1="-11" y1="-11" x2="11" y2="11" stroke="#eab308" strokeWidth="3" />
                  <line x1="11" y1="-11" x2="-11" y2="11" stroke="#eab308" strokeWidth="3" />
                </g>
              ) : (
                // Realistic Bulb
                <g>
                  {/* Screw base */}
                  <rect x="-8" y="-6" width="16" height="12" fill="#94a3b8" rx="2" />
                  <rect x="-6" y="6" width="12" height="4" fill="#475569" />
                  {/* Glass shell */}
                  <circle 
                    cx="0" 
                    cy="-18" 
                    r="18" 
                    fill={isSwitchOpen || power === 0 ? "#475569" : "#fef08a"} 
                    stroke={isSwitchOpen || power === 0 ? "#64748b" : "#eab308"} 
                    strokeWidth="3"
                    className="transition-all duration-300"
                  />
                  {/* Filament */}
                  <path 
                    d="M -7 -10 Q -3 -25 0 -18 Q 3 -25 7 -10" 
                    fill="none" 
                    stroke={isSwitchOpen || power === 0 ? "#334155" : "#f97316"} 
                    strokeWidth="2.5" 
                  />
                </g>
              )}
              {/* Text label */}
              <text x="0" y="-45" fill="#cbd5e1" fontSize="13" fontWeight="bold" textAnchor="middle">
                مصباح ({power} واط)
              </text>
            </g>

            {/* Component: Battery (Bottom side: x = 250, y = 300) */}
            <g transform="translate(250, 300)">
              {/* Wire cutout background */}
              <rect x="-40" y="-10" width="80" height="20" fill="#18181b" />

              {isSchematic ? (
                // Schematic DC Source (Long line / Short line)
                <g>
                  {/* Positive terminal (Long thin line) */}
                  <line x1="-8" y1="-18" x2="-8" y2="18" stroke="#3b82f6" strokeWidth="4" />
                  {/* Negative terminal (Short thick line) */}
                  <line x1="8" y1="-10" x2="8" y2="10" stroke="#ef4444" strokeWidth="8" />
                  {/* Labels */}
                  <text x="-20" y="-5" fill="#3b82f6" fontSize="14" fontWeight="bold">+</text>
                  <text x="22" y="-5" fill="#ef4444" fontSize="14" fontWeight="bold">-</text>
                </g>
              ) : (
                // Realistic Battery
                <g>
                  {/* Battery body */}
                  <rect x="-25" y="-12" width="50" height="24" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="2" />
                  {/* Negative Side (Left in SVG layout) */}
                  <rect x="-25" y="-12" width="15" height="24" fill="#ef4444" rx="2" />
                  <text x="-17" y="5" fill="white" fontSize="11" fontWeight="extrabold" textAnchor="middle">-</text>
                  {/* Positive Side (Right in SVG layout) */}
                  <rect x="10" y="-12" width="15" height="24" fill="#3b82f6" rx="2" />
                  <text x="17" y="5" fill="white" fontSize="10" fontWeight="extrabold" textAnchor="middle">+</text>
                  {/* Battery Cap */}
                  <rect x="25" y="-6" width="3" height="12" fill="#94a3b8" rx="1" />
                </g>
              )}
              {/* Text label */}
              <text x="0" y="32" fill="#cbd5e1" fontSize="13" fontWeight="bold" textAnchor="middle">
                بطارية ({voltage} فولت)
              </text>
            </g>
          </svg>
        </div>

        {/* Real-time Dials and Meters (Bottom HUD) */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 z-10">
          
          {/* Voltmeter */}
          <div className="glass bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-[10px] md:text-xs font-bold text-blue-400 mb-1 flex items-center justify-center gap-1">
              <span>⚡ الجهد الكهربائي (V)</span>
            </div>
            <div className="text-lg md:text-2xl font-black font-mono tracking-tight text-white">
              {voltage.toFixed(1)} <span className="text-xs md:text-sm font-normal text-slate-400">فولت</span>
            </div>
          </div>

          {/* Ammeter */}
          <div className="glass bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-[10px] md:text-xs font-bold text-emerald-400 mb-1 flex items-center justify-center gap-1">
              <span>📈 شدة التيار (I)</span>
            </div>
            <div className="text-lg md:text-2xl font-black font-mono tracking-tight text-white">
              {current.toFixed(2)} <span className="text-xs md:text-sm font-normal text-slate-400">أمبير</span>
            </div>
          </div>

          {/* Resistor State */}
          <div className="glass bg-white/5 border border-white/10 rounded-xl p-3 text-center">
            <div className="text-[10px] md:text-xs font-bold text-violet-400 mb-1 flex items-center justify-center gap-1">
              <span>🌀 المقاومة (R)</span>
            </div>
            <div className="text-lg md:text-2xl font-black font-mono tracking-tight text-white">
              {resistance} <span className="text-xs md:text-sm font-normal text-slate-400">أوم</span>
            </div>
          </div>

        </div>

      </div>

      {/* Control Panel Panel (40%) */}
      <div className="w-full lg:w-[350px] flex flex-col gap-6 glass border border-white/10 rounded-2xl p-6 justify-between">
        
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-2 pb-4 border-b border-white/10">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">لوحة التحكم الكهربائية</h2>
              <p className="text-xs text-slate-400">تحكم بقيم الدائرة واكتشف النتائج</p>
            </div>
          </div>

          {/* Voltage Slider */}
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between text-xs md:text-sm font-bold">
              <span className="text-slate-300">الجهد الكهربائي (القوة الدافعة):</span>
              <span className="text-blue-400 font-mono">{voltage} فولت</span>
            </div>
            <div className="relative flex items-center">
              <input 
                type="range" 
                min="0" 
                max="24" 
                step="0.5"
                value={voltage} 
                onChange={(e) => setVoltage(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-blue-500"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>0 فولت</span>
              <span>12 فولت</span>
              <span>24 فولت</span>
            </div>
          </div>

          {/* Resistance Slider */}
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between text-xs md:text-sm font-bold">
              <span className="text-slate-300">مقاومة السلك (المقاوم R):</span>
              <span className="text-violet-400 font-mono">{resistance} أوم</span>
            </div>
            <div className="relative flex items-center">
              <input 
                type="range" 
                min="1" 
                max="100" 
                value={resistance} 
                onChange={(e) => setResistance(parseInt(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-700 accent-violet-500"
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>1 أوم</span>
              <span>50 أوم</span>
              <span>100 أوم</span>
            </div>
          </div>

          {/* Interactive Switch Trigger */}
          <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between mt-2">
            <div>
              <h3 className="text-sm font-bold text-white">مفتاح الدائرة</h3>
              <p className="text-[10px] text-slate-400">اضغط لقطع أو توصيل التيار</p>
            </div>
            <button
              onClick={() => setIsSwitchOpen(!isSwitchOpen)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 cursor-pointer ${
                !isSwitchOpen ? "bg-emerald-500" : "bg-red-500"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-all duration-300 ${
                  !isSwitchOpen ? "-translate-x-6" : "-translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Ohm's Law Explanation Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 flex flex-col gap-2">
            <h3 className="text-xs md:text-sm font-bold text-blue-300 flex items-center gap-1.5">
              <Activity className="w-4 h-4" />
              <span>معادلة قانون أوم: I = V / R</span>
            </h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              ينص قانون أوم على أن شدة التيار الكهربائي (<span className="text-emerald-400 font-bold">I</span>) المار في موصل تتناسب طردياً مع فرق الجهد (<span className="text-blue-400 font-bold">V</span>) وعكسياً مع المقاومة (<span className="text-violet-400 font-bold">R</span>).
            </p>
            <div className="flex items-center gap-2 mt-1 pt-2 border-t border-white/10 text-[10px] text-slate-400">
              <span>القدرة الكهربائية المستهلكة:</span>
              <span className="text-yellow-400 font-mono font-bold">{power} واط</span>
            </div>
          </div>

        </div>

        {/* Reset Trigger */}
        <button
          onClick={handleReset}
          className="w-full mt-4 h-11 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/10 rounded-xl text-xs font-bold transition-all cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          إعادة تعيين المعمل
        </button>

      </div>

    </div>
  )
}
