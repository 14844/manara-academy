"use client"

import React, { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Beaker, RotateCcw, Award, CheckCircle, Info, ArrowLeft, ArrowRight, Layers } from "lucide-react"

interface AtomSpec {
  id: string
  symbol: string
  name: string
  color: string
  bgClass: string
  borderClass: string
  radius: number
}

interface MoleculeSpec {
  id: string
  name: string
  formula: string
  description: string
  facts: string[]
  atomsNeeded: { [key: string]: number } // e.g. { O: 1, H: 2 }
  slots: {
    id: string
    expectedSymbol: string
    x: number
    y: number
    label: string
  }[]
  bonds: { from: string; to: string; double?: boolean }[]
}

const ATOMS: { [key: string]: AtomSpec } = {
  H: { id: "H", symbol: "H", name: "هيدروجين", color: "#f8fafc", bgClass: "bg-slate-100", borderClass: "border-slate-300 text-slate-900", radius: 20 },
  O: { id: "O", symbol: "O", name: "أكسجين", color: "#ef4444", bgClass: "bg-red-500", borderClass: "border-red-600 text-white", radius: 32 },
  C: { id: "C", symbol: "C", name: "كربون", color: "#374151", bgClass: "bg-gray-700", borderClass: "border-gray-800 text-white", radius: 36 },
  N: { id: "N", symbol: "N", name: "نيتروجين", color: "#3b82f6", bgClass: "bg-blue-500", borderClass: "border-blue-600 text-white", radius: 34 }
}

const MOLECULES: MoleculeSpec[] = [
  {
    id: "h2o",
    name: "الماء",
    formula: "H₂O",
    description: "شريان الحياة وأشهر مركب كيميائي على وجه الأرض.",
    facts: [
      "يغطي الماء حوالي 71% من سطح الكرة الأرضية.",
      "جزيء الماء قطبي، مما يجعله مذيباً ممتازاً للمواد.",
      "يتكون الجزيء من رابطتين تساهميتين أحاديتين بين الأكسجين والهيدروجين بزاوية 104.5 درجة."
    ],
    atomsNeeded: { O: 1, H: 2 },
    slots: [
      { id: "slot-o", expectedSymbol: "O", x: 250, y: 150, label: "أكسجين (O)" },
      { id: "slot-h1", expectedSymbol: "H", x: 160, y: 220, label: "هيدروجين (H)" },
      { id: "slot-h2", expectedSymbol: "H", x: 340, y: 220, label: "هيدروجين (H)" }
    ],
    bonds: [
      { from: "slot-o", to: "slot-h1" },
      { from: "slot-o", to: "slot-h2" }
    ]
  },
  {
    id: "co2",
    name: "ثاني أكسيد الكربون",
    formula: "CO₂",
    description: "الغاز الأساسي لعملية البناء الضوئي في النبات والمسؤول عن الاحتباس الحراري.",
    facts: [
      "ينتج عن تنفس الكائنات الحية واحتراق المواد العضوية.",
      "تستخدمه النباتات لصنع الغذاء وإطلاق الأكسجين.",
      "يتميز الجزيء بشكل خطي (Linear) برابطتين تساهميتين ثنائيتين بين الكربون وكل أكسجين."
    ],
    atomsNeeded: { C: 1, O: 2 },
    slots: [
      { id: "slot-c", expectedSymbol: "C", x: 250, y: 170, label: "كربون (C)" },
      { id: "slot-o1", expectedSymbol: "O", x: 130, y: 170, label: "أكسجين (O)" },
      { id: "slot-o2", expectedSymbol: "O", x: 370, y: 170, label: "أكسجين (O)" }
    ],
    bonds: [
      { from: "slot-c", to: "slot-o1", double: true },
      { from: "slot-c", to: "slot-o2", double: true }
    ]
  },
  {
    id: "nh3",
    name: "الأمونيا (النشادر)",
    formula: "NH₃",
    description: "مركب حيوي ذو رائحة نفاذة، يمثل الركيزة الأساسية لصناعة الأسمدة.",
    facts: [
      "غاز قلوي خفيف الوزن سهل الذوبان جداً بالماء.",
      "يدخل في صناعة الأسمدة الزراعية والمتفجرات والمنظفات.",
      "يأخذ شكلاً هرمياً ثلاثياً (Trigonal Pyramidal) مع زوج إلكترونات حر على ذرة النيتروجين."
    ],
    atomsNeeded: { N: 1, H: 3 },
    slots: [
      { id: "slot-n", expectedSymbol: "N", x: 250, y: 140, label: "نيتروجين (N)" },
      { id: "slot-h1", expectedSymbol: "H", x: 160, y: 220, label: "هيدروجين (H)" },
      { id: "slot-h2", expectedSymbol: "H", x: 250, y: 240, label: "هيدروجين (H)" },
      { id: "slot-h3", expectedSymbol: "H", x: 340, y: 220, label: "هيدروجين (H)" }
    ],
    bonds: [
      { from: "slot-n", to: "slot-h1" },
      { from: "slot-n", to: "slot-h2" },
      { from: "slot-n", to: "slot-h3" }
    ]
  },
  {
    id: "ch4",
    name: "الميثان",
    formula: "CH₄",
    description: "أبسط الهيدروكربونات العضوية والمكون الرئيسي للغاز الطبيعي.",
    facts: [
      "غاز وقود فعال جداً وصديق للبيئة عند الاحتراق الكامل مقارنة بالفحم.",
      "يعتبر من غازات الدفيئة القوية جداً التي تساهم في تغير المناخ.",
      "يأخذ شكلاً رباعي الأوجه منتظم (Tetrahedral) بزاوية ارتباط 109.5 درجة."
    ],
    atomsNeeded: { C: 1, H: 4 },
    slots: [
      { id: "slot-c", expectedSymbol: "C", x: 250, y: 170, label: "كربون (C)" },
      { id: "slot-h1", expectedSymbol: "H", x: 250, y: 70, label: "هيدروجين (H)" },
      { id: "slot-h2", expectedSymbol: "H", x: 150, y: 170, label: "هيدروجين (H)" },
      { id: "slot-h3", expectedSymbol: "H", x: 250, y: 270, label: "هيدروجين (H)" },
      { id: "slot-h4", expectedSymbol: "H", x: 350, y: 170, label: "هيدروجين (H)" }
    ],
    bonds: [
      { from: "slot-c", to: "slot-h1" },
      { from: "slot-c", to: "slot-h2" },
      { from: "slot-c", to: "slot-h3" },
      { from: "slot-c", to: "slot-h4" }
    ]
  }
]

export function MoleculeLab() {
  const [activeMolIndex, setActiveMolIndex] = useState(0)
  const [selectedAtom, setSelectedAtom] = useState<string | null>(null)
  
  // State for atoms currently placed in slots: { [slotId]: symbol }
  const [placedAtoms, setPlacedAtoms] = useState<{ [key: string]: string }>({})
  const [isSuccess, setIsSuccess] = useState(false)

  const currentMolecule = MOLECULES[activeMolIndex]

  // Reset current builder state
  const handleReset = () => {
    setPlacedAtoms({})
    setIsSuccess(false)
    setSelectedAtom(null)
  }

  // Handle molecule switch
  const handleSelectMolecule = (index: number) => {
    setActiveMolIndex(index)
    setPlacedAtoms({})
    setIsSuccess(false)
    setSelectedAtom(null)
  }

  // Handle slot click to place atom
  const handleSlotClick = (slotId: string, expectedSymbol: string) => {
    if (isSuccess) return

    if (!selectedAtom) {
      // If slot is occupied, clicking it removes the atom
      if (placedAtoms[slotId]) {
        const nextPlaced = { ...placedAtoms }
        delete nextPlaced[slotId]
        setPlacedAtoms(nextPlaced)
      }
      return
    }

    if (selectedAtom === expectedSymbol) {
      // Place the correct atom
      const nextPlaced = { ...placedAtoms, [slotId]: selectedAtom }
      setPlacedAtoms(nextPlaced)
      setSelectedAtom(null) // clear selection after successful placement
    } else {
      // Visual feedback or warning could go here. Let's auto-reset selection
      setSelectedAtom(null)
    }
  }

  // Check if molecule is built successfully
  useEffect(() => {
    let success = true
    currentMolecule.slots.forEach(slot => {
      if (placedAtoms[slot.id] !== slot.expectedSymbol) {
        success = false
      }
    })

    if (success && currentMolecule.slots.length > 0) {
      setIsSuccess(true)
    }
  }, [placedAtoms, currentMolecule])

  return (
    <div className="w-full h-full flex flex-col lg:flex-row gap-6 p-4 md:p-6 select-none bg-black/20 text-white rounded-3xl overflow-auto" dir="rtl">
      
      {/* Workspace Panel (60%) */}
      <div className="flex-grow flex flex-col justify-between glass border border-white/10 rounded-2xl p-6 min-h-[380px] relative overflow-hidden">
        
        {/* Top bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 z-10">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Beaker className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-black">{currentMolecule.name} ({currentMolecule.formula})</h2>
              <p className="text-xs text-slate-400">{currentMolecule.description}</p>
            </div>
          </div>
          <button 
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 text-xs font-bold hover:bg-white/20 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            إعادة البدء
          </button>
        </div>

        {/* Builder Board */}
        <div className="flex-grow flex items-center justify-center py-6 relative">
          
          <AnimatePresence mode="wait">
            {isSuccess ? (
              // Success Screen with 3D rotating molecule
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", damping: 15 }}
                className="flex flex-col items-center justify-center text-center p-6 z-10"
              >
                {/* Floating Success Sparkle */}
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/30 animate-bounce">
                  <Award className="w-8 h-8" />
                </div>

                <h3 className="text-2xl font-black text-emerald-400 mb-2">تم بناء المركب بنجاح!</h3>
                <p className="text-xs text-slate-300 max-w-sm mb-6">لقد نجحت في تجميع الروابط التساهمية لجزيء {currentMolecule.name} بنسبة 100%.</p>

                {/* Simulated rotating molecule structure */}
                <div className="relative w-48 h-48 flex items-center justify-center mb-6">
                  <div className="absolute inset-0 bg-emerald-500/5 rounded-full blur-2xl animate-pulse" />
                  
                  {/* Rotating wrapper */}
                  <div className="w-full h-full animate-[spin_12s_linear_infinite] relative">
                    <svg viewBox="0 0 400 400" className="w-full h-full">
                      {/* Render completed bonds */}
                      {currentMolecule.bonds.map((bond, idx) => {
                        const fromSlot = currentMolecule.slots.find(s => s.id === bond.from)!
                        const toSlot = currentMolecule.slots.find(s => s.id === bond.to)!
                        
                        // Rescale coordinates from 500x350 to 400x400 space for success rendering
                        const scaleCoords = (x: number, y: number) => ({
                          x: (x - 250) * 0.8 + 200,
                          y: (y - 170) * 0.8 + 200
                        })
                        
                        const p1 = scaleCoords(fromSlot.x, fromSlot.y)
                        const p2 = scaleCoords(toSlot.x, toSlot.y)

                        if (bond.double) {
                          return (
                            <g key={idx}>
                              <line x1={p1.x - 4} y1={p1.y - 4} x2={p2.x - 4} y2={p2.y - 4} stroke="#cbd5e1" strokeWidth="5" />
                              <line x1={p1.x + 4} y1={p1.y + 4} x2={p2.x + 4} y2={p2.y + 4} stroke="#cbd5e1" strokeWidth="5" />
                            </g>
                          )
                        }

                        return (
                          <line key={idx} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#cbd5e1" strokeWidth="5" />
                        )
                      })}

                      {/* Render completed atoms */}
                      {currentMolecule.slots.map(slot => {
                        const atomSpec = ATOMS[slot.expectedSymbol]
                        // Rescale coordinates
                        const sx = (slot.x - 250) * 0.8 + 200
                        const sy = (slot.y - 170) * 0.8 + 200

                        return (
                          <g key={slot.id}>
                            <circle cx={sx} cy={sy} r={atomSpec.radius * 0.9} fill={atomSpec.color} stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                            <text 
                              x={sx} 
                              y={sy + 5} 
                              fill={slot.expectedSymbol === "H" ? "#0f172a" : "white"} 
                              fontSize="16" 
                              fontWeight="bold" 
                              textAnchor="middle"
                            >
                              {slot.expectedSymbol}
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                </div>

                <div className="flex gap-3">
                  {activeMolIndex < MOLECULES.length - 1 ? (
                    <button
                      onClick={() => handleSelectMolecule(activeMolIndex + 1)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-xs font-bold flex items-center gap-2 cursor-pointer text-slate-900"
                    >
                      الجزيء التالي
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSelectMolecule(0)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-xs font-bold flex items-center gap-2 cursor-pointer text-slate-900"
                    >
                      إعادة اللعب من البداية
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>

              </motion.div>
            ) : (
              // Active Builder Board
              <motion.div 
                key={currentMolecule.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full max-w-[460px] relative aspect-[4/3] flex items-center justify-center"
              >
                <svg viewBox="0 0 500 350" className="w-full h-full overflow-visible">
                  {/* Background circuit grid */}
                  <defs>
                    <radialGradient id="radialGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  
                  <rect x="0" y="0" width="500" height="350" fill="url(#radialGlow)" rx="20" />

                  {/* 1. Render bonds that are connected (Only if the slots on both sides are filled correctly) */}
                  {currentMolecule.bonds.map((bond, idx) => {
                    const fromSlot = currentMolecule.slots.find(s => s.id === bond.from)!
                    const toSlot = currentMolecule.slots.find(s => s.id === bond.to)!
                    const isFromFilled = placedAtoms[bond.from] === fromSlot.expectedSymbol
                    const isToFilled = placedAtoms[bond.to] === toSlot.expectedSymbol

                    if (!isFromFilled || !isToFilled) return null

                    // If double bond, draw two parallel lines
                    if (bond.double) {
                      // Offset vector
                      const dx = toSlot.x - fromSlot.x
                      const dy = toSlot.y - fromSlot.y
                      const len = Math.sqrt(dx * dx + dy * dy)
                      const ox = (-dy / len) * 4.5
                      const oy = (dx / len) * 4.5

                      return (
                        <motion.g 
                          key={idx}
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                        >
                          <line x1={fromSlot.x + ox} y1={fromSlot.y + oy} x2={toSlot.x + ox} y2={toSlot.y + oy} stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" />
                          <line x1={fromSlot.x - ox} y1={fromSlot.y - oy} x2={toSlot.x - ox} y2={toSlot.y - oy} stroke="#e2e8f0" strokeWidth="5" strokeLinecap="round" />
                        </motion.g>
                      )
                    }

                    return (
                      <motion.line 
                        key={idx}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.4 }}
                        x1={fromSlot.x} 
                        y1={fromSlot.y} 
                        x2={toSlot.x} 
                        y2={toSlot.y} 
                        stroke="#cbd5e1" 
                        strokeWidth="4" 
                        strokeLinecap="round"
                      />
                    )
                  })}

                  {/* 2. Render target slots */}
                  {currentMolecule.slots.map(slot => {
                    const isFilled = placedAtoms[slot.id] === slot.expectedSymbol
                    const atomSpec = ATOMS[slot.expectedSymbol]
                    const isTargetedForSelection = selectedAtom === slot.expectedSymbol && !isFilled

                    return (
                      <g 
                        key={slot.id} 
                        transform={`translate(${slot.x}, ${slot.y})`}
                        onClick={() => handleSlotClick(slot.id, slot.expectedSymbol)}
                        className="cursor-pointer group"
                      >
                        {isFilled ? (
                          // Renders placed atom
                          <motion.g
                            initial={{ scale: 0.3, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 12 }}
                          >
                            {/* Atom Sphere */}
                            <circle 
                              cx="0" 
                              cy="0" 
                              r={atomSpec.radius} 
                              fill={atomSpec.color} 
                              stroke="rgba(255,255,255,0.15)" 
                              strokeWidth="2" 
                              className="drop-shadow-lg"
                            />
                            {/* Reflex highlight */}
                            <circle 
                              cx={-atomSpec.radius * 0.3} 
                              cy={-atomSpec.radius * 0.3} 
                              r={atomSpec.radius * 0.25} 
                              fill="white" 
                              opacity="0.3" 
                            />
                            {/* Label */}
                            <text 
                              x="0" 
                              y="5" 
                              fill={slot.expectedSymbol === "H" ? "#0f172a" : "white"} 
                              fontSize={atomSpec.radius > 25 ? "16" : "12"} 
                              fontWeight="extrabold" 
                              textAnchor="middle"
                            >
                              {slot.expectedSymbol}
                            </text>
                          </motion.g>
                        ) : (
                          // Renders empty slot slot placeholder
                          <g>
                            {/* Pulsing ring if selection matches expectations */}
                            {isTargetedForSelection && (
                              <circle 
                                cx="0" 
                                cy="0" 
                                r={atomSpec.radius + 8} 
                                fill="none" 
                                stroke="#10b981" 
                                strokeWidth="2" 
                                strokeDasharray="4 4"
                                className="animate-spin"
                                style={{ animationDuration: '6s' }}
                              />
                            )}
                            {/* Standard slot container */}
                            <circle 
                              cx="0" 
                              cy="0" 
                              r={atomSpec.radius} 
                              fill="rgba(255,255,255,0.03)" 
                              stroke={isTargetedForSelection ? "#10b981" : "rgba(255,255,255,0.2)"} 
                              strokeWidth="2.5" 
                              strokeDasharray={isTargetedForSelection ? "none" : "5 5"}
                              className="group-hover:stroke-white/40 transition-colors"
                            />
                            <text 
                              x="0" 
                              y="4" 
                              fill={isTargetedForSelection ? "#10b981" : "rgba(255,255,255,0.3)"} 
                              fontSize="11" 
                              fontWeight="bold" 
                              textAnchor="middle"
                            >
                              {slot.expectedSymbol}
                            </text>
                            {/* Description tooltip hover */}
                            <text 
                              x="0" 
                              y={atomSpec.radius + 16} 
                              fill="rgba(255,255,255,0.5)" 
                              fontSize="10" 
                              fontWeight="bold" 
                              textAnchor="middle"
                              className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                            >
                              {slot.label}
                            </text>
                          </g>
                        )}
                      </g>
                    )
                  })}
                </svg>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* Bottom instructions */}
        <div className="z-10 bg-white/5 border border-white/5 rounded-2xl p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            {isSuccess ? (
              <strong>مدهش!</strong>
            ) : (
              <span>
                <strong>كيف تلعب؟</strong> اختر ذرة من <strong>مخزن الذرات</strong> على اليمين بالضغط عليها، ثم اضغط على <strong>الهالة المناسبة لها</strong> في لوحة البناء لتشكيل الروابط التساهمية للمركب.
              </span>
            )}
            {/* Show dynamic progress */}
            {!isSuccess && (
              <div className="flex gap-3 mt-2 text-[10px] text-slate-400">
                <span>التقدم:</span>
                <span>{Object.keys(placedAtoms).length} من {currentMolecule.slots.length} ذرات مضافة.</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Sidebar Control Panel (40%) */}
      <div className="w-full lg:w-[350px] flex flex-col gap-6 glass border border-white/10 rounded-2xl p-6 justify-between">
        
        <div className="flex flex-col gap-6">
          
          {/* Target Selector */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-400">اختر الجزيء المراد تجميعه:</label>
            <div className="grid grid-cols-2 gap-2">
              {MOLECULES.map((mol, idx) => (
                <button
                  key={mol.id}
                  onClick={() => handleSelectMolecule(idx)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold text-center border transition-all cursor-pointer ${
                    activeMolIndex === idx 
                      ? "bg-emerald-500 border-emerald-500 text-slate-950 font-black shadow-lg" 
                      : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {mol.name}
                </button>
              ))}
            </div>
          </div>

          {/* Atoms Inventory */}
          <div className="flex flex-col gap-3 pb-4 border-b border-white/10">
            <label className="text-xs font-bold text-slate-400">مخزن الذرات (انقر للاختيار):</label>
            
            <div className="flex flex-col gap-2">
              {Object.values(ATOMS).map(atom => {
                // Count how many atoms of this type are needed vs placed
                const totalNeeded = currentMolecule.atomsNeeded[atom.symbol] || 0
                const currentPlaced = Object.values(placedAtoms).filter(s => s === atom.symbol).length
                const remaining = Math.max(0, totalNeeded - currentPlaced)

                return (
                  <button
                    key={atom.id}
                    disabled={remaining === 0 || isSuccess}
                    onClick={() => setSelectedAtom(selectedAtom === atom.symbol ? null : atom.symbol)}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      remaining === 0 
                        ? "bg-white/2 border-white/2 opacity-40 cursor-not-allowed" 
                        : selectedAtom === atom.symbol
                          ? "bg-emerald-500/20 border-emerald-400 text-white scale-[1.02] shadow-md"
                          : "bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Round chemical sphere */}
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border font-bold text-sm ${atom.bgClass} ${atom.borderClass}`}>
                        {atom.symbol}
                      </div>
                      <div className="text-right">
                        <h4 className="text-xs font-bold">{atom.name}</h4>
                        <p className="text-[9px] text-slate-400">العدد الذري: {atom.symbol === "H" ? 1 : atom.symbol === "C" ? 6 : atom.symbol === "N" ? 7 : 8}</p>
                      </div>
                    </div>
                    
                    <div className="text-left">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                        متبقي: {remaining}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Educational Facts (Card) */}
          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-4 flex flex-col gap-2.5">
            <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>حقائق علمية تفاعلية:</span>
            </h3>
            
            <ul className="flex flex-col gap-2">
              {currentMolecule.facts.map((fact, idx) => (
                <li key={idx} className="text-[10.5px] text-slate-300 leading-relaxed flex items-start gap-1">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Selected status indicator */}
        {selectedAtom && (
          <div className="text-center text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/10 py-2.5 rounded-xl animate-pulse">
            ذرة ({ATOMS[selectedAtom].name}) محددة. انقر على مكانها في المخطط!
          </div>
        )}

      </div>

    </div>
  )
}
