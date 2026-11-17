"use client"

import React, { useState } from "react"
import {
  Compass,
  RotateCcw,
  Volume2,
  VolumeX,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Sparkles,
  Layers,
  Settings2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  BookOpen,
  Award,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useQuality, QualityTier } from "./quality-manager"
import { labAudio } from "./sound-effects"

export interface GuidedStep {
  title: string
  instruction: string
  hint?: string
  targetStateCheck?: boolean
}

export interface QuizQuestion {
  question: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface GuidedExperiment {
  id: string
  title: string
  curriculumRef: string
  description: string
  steps: GuidedStep[]
  quiz?: QuizQuestion
}

interface LabHUDProps {
  title: string
  subjectTitle: string
  curriculumGrade?: string
  guidedExperiments: GuidedExperiment[]
  activeExpIndex: number
  onSelectExp: (index: number) => void
  isSandbox: boolean
  onToggleSandbox: (sandbox: boolean) => void
  onResetCamera: () => void
  onResetExperiment: () => void
  children?: React.ReactNode // Extra lab-specific controls/instrument HUDs
}

export function LabHUD({
  title,
  subjectTitle,
  curriculumGrade = "الثانوية العامة",
  guidedExperiments,
  activeExpIndex,
  onSelectExp,
  isSandbox,
  onToggleSandbox,
  onResetCamera,
  onResetExperiment,
  children,
}: LabHUDProps) {
  const { tier, setTier } = useQuality()
  const [isMuted, setIsMuted] = useState(labAudio.getMuted())
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null)
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false)
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  const [showQualityMenu, setShowQualityMenu] = useState(false)

  const activeExp = guidedExperiments[activeExpIndex]
  const currentStep = activeExp?.steps[currentStepIndex]
  const totalSteps = activeExp?.steps.length || 1

  const handleMuteToggle = () => {
    const nextMuted = !isMuted
    setIsMuted(nextMuted)
    labAudio.setMuted(nextMuted)
    if (!nextMuted) labAudio.playClick()
  }

  const handleSelectExperiment = (index: number) => {
    onSelectExp(index)
    setCurrentStepIndex(0)
    setShowHint(false)
    setSelectedQuizAnswer(null)
    setIsQuizSubmitted(false)
    labAudio.playClick()
  }

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1)
      setShowHint(false)
      labAudio.playClick(900)
    }
  }

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1)
      setShowHint(false)
      labAudio.playClick(750)
    }
  }

  const handleQuizSubmit = (optIndex: number) => {
    if (isQuizSubmitted) return
    setSelectedQuizAnswer(optIndex)
    setIsQuizSubmitted(true)
    if (activeExp?.quiz && optIndex === activeExp.quiz.correctIndex) {
      labAudio.playSuccess()
    } else {
      labAudio.playClick(400)
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 md:p-5 select-none z-10" dir="rtl">
      {/* Top Floating Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Lab Title & Curriculum Tag */}
        <div className="pointer-events-auto flex items-center gap-2 glass px-3.5 py-2 rounded-2xl border border-white/10 shadow-lg">
          <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs md:text-sm font-black text-white">{title}</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/40 text-primary bg-primary/10">
                {subjectTitle}
              </Badge>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">منهج {curriculumGrade}</div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="pointer-events-auto flex items-center gap-1.5 glass p-1.5 rounded-2xl border border-white/10 shadow-lg">
          {/* Mode Switcher */}
          <div className="flex bg-black/40 p-0.5 rounded-xl border border-white/5">
            <button
              onClick={() => {
                onToggleSandbox(false)
                labAudio.playClick()
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                !isSandbox ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              تجارب موجهة
            </button>
            <button
              onClick={() => {
                onToggleSandbox(true)
                labAudio.playClick()
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                isSandbox ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              الوضع الحر
            </button>
          </div>

          <div className="w-[1px] h-5 bg-white/10 mx-0.5" />

          {/* Reset Camera */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onResetCamera()
              labAudio.playClick()
            }}
            title="إعادة ضبط زاوية الرؤية (R)"
            className="h-8 w-8 p-0 rounded-xl hover:bg-white/10 text-slate-300"
          >
            <Compass className="w-4 h-4" />
          </Button>

          {/* Audio toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMuteToggle}
            title={isMuted ? "تشغيل المؤثرات الصوتية" : "كتم الصوت"}
            className="h-8 w-8 p-0 rounded-xl hover:bg-white/10 text-slate-300"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </Button>

          {/* Reset Lab Simulation */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onResetExperiment()
              labAudio.playClick()
            }}
            title="إعادة ضبط التجربة"
            className="h-8 w-8 p-0 rounded-xl hover:bg-white/10 text-slate-300"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          {/* Quality Settings Dropdown */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQualityMenu(!showQualityMenu)}
              title="جودة الرسوميات"
              className="h-8 px-2 rounded-xl hover:bg-white/10 text-slate-300 flex items-center gap-1 text-xs"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-mono">
                {tier === "high" ? "عالية" : tier === "medium" ? "متوسطة" : "خفيفة"}
              </span>
            </Button>
            {showQualityMenu && (
              <div className="absolute left-0 mt-2 w-32 glass border border-white/20 rounded-xl p-1 shadow-2xl flex flex-col gap-1 z-30">
                {(["high", "medium", "low"] as QualityTier[]).map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setTier(q)
                      setShowQualityMenu(false)
                      labAudio.playClick()
                    }}
                    className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      tier === q ? "bg-primary text-white" : "text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {q === "high" ? "🚀 جودة عالية" : q === "medium" ? "⚡ متوازنة" : "🔋 خفيفة / توفير"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lab-Specific Custom Instrument / Live HUD Overlays (Center/Sides) */}
      <div className="flex-1 pointer-events-none flex flex-col justify-end md:justify-center py-2">
        {children}
      </div>

      {/* Bottom Area: Guided Experiment / Steps Overlay */}
      {!isSandbox && activeExp && (
        <div className="pointer-events-auto w-full max-w-xl mx-auto glass p-3.5 md:p-4 rounded-2xl border border-white/15 shadow-2xl transition-all">
          {/* Header of Guided Box */}
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <select
                value={activeExpIndex}
                onChange={(e) => handleSelectExperiment(Number(e.target.value))}
                className="bg-black/40 text-xs md:text-sm font-bold text-white rounded-lg px-2 py-1 border border-white/10 focus:outline-none focus:border-primary cursor-pointer"
              >
                {guidedExperiments.map((exp, idx) => (
                  <option key={exp.id} value={idx} className="bg-slate-900 text-white">
                    تجربة {idx + 1}: {exp.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-mono">
                خطوة {currentStepIndex + 1} / {totalSteps}
              </span>
              <button
                onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                className="text-slate-400 hover:text-white p-1"
                title={isPanelCollapsed ? "توسيع" : "تصغير"}
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${isPanelCollapsed ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>

          {/* Collapsible Content */}
          {!isPanelCollapsed && (
            <div className="space-y-3">
              {/* Step Title & Instruction */}
              <div>
                <h4 className="text-xs md:text-sm font-bold text-blue-300 mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  {currentStep?.title}
                </h4>
                <p className="text-xs md:text-sm text-slate-200 leading-relaxed">
                  {currentStep?.instruction}
                </p>
              </div>

              {/* Hint Box */}
              {currentStep?.hint && (
                <div>
                  <button
                    onClick={() => setShowHint(!showHint)}
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>{showHint ? "إخفاء التلميح" : "تحتاج مساعدة؟ اعرض التلميح"}</span>
                  </button>
                  {showHint && (
                    <div className="mt-1.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 leading-relaxed">
                      💡 {currentStep.hint}
                    </div>
                  )}
                </div>
              )}

              {/* End-of-Experiment Quiz (shown on last step if quiz exists) */}
              {currentStepIndex === totalSteps - 1 && activeExp.quiz && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2 mt-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <Award className="w-4 h-4" />
                    <span>سؤال تثبيت الفهم المنهجي:</span>
                  </div>
                  <p className="text-xs text-slate-100 font-semibold">{activeExp.quiz.question}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                    {activeExp.quiz.options.map((opt, optIdx) => {
                      const isCorrect = optIdx === activeExp.quiz?.correctIndex
                      const isSelected = selectedQuizAnswer === optIdx
                      let btnStyle = "bg-white/5 border-white/10 hover:bg-white/15 text-slate-200"

                      if (isQuizSubmitted) {
                        if (isCorrect) {
                          btnStyle = "bg-emerald-500/20 border-emerald-500/60 text-emerald-300"
                        } else if (isSelected) {
                          btnStyle = "bg-rose-500/20 border-rose-500/60 text-rose-300"
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={isQuizSubmitted}
                          onClick={() => handleQuizSubmit(optIdx)}
                          className={`text-right p-2 rounded-lg border text-xs font-medium transition-all flex items-center justify-between ${btnStyle}`}
                        >
                          <span>{opt}</span>
                          {isQuizSubmitted && isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          {isQuizSubmitted && isSelected && !isCorrect && <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>

                  {isQuizSubmitted && (
                    <div className="mt-2 text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-white/10 leading-relaxed">
                      <strong>الشرح العلمي:</strong> {activeExp.quiz.explanation}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation buttons */}
              <div className="flex items-center justify-between pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handlePrevStep}
                  disabled={currentStepIndex === 0}
                  className="h-7 text-xs px-2.5 rounded-lg glass disabled:opacity-40"
                >
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  السابق
                </Button>

                <div className="flex gap-1">
                  {activeExp.steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentStepIndex(i)
                        setShowHint(false)
                        labAudio.playClick()
                      }}
                      className={`w-2 h-2 rounded-full transition-all ${
                        currentStepIndex === i ? "bg-primary w-4" : "bg-white/20 hover:bg-white/40"
                      }`}
                    />
                  ))}
                </div>

                <Button
                  size="sm"
                  onClick={handleNextStep}
                  disabled={currentStepIndex >= totalSteps - 1}
                  className="h-7 text-xs px-2.5 rounded-lg disabled:opacity-40"
                >
                  التالي
                  <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sandbox mode floating hint badge */}
      {isSandbox && (
        <div className="pointer-events-auto self-center glass px-4 py-2 rounded-full border border-primary/30 text-xs font-bold text-primary flex items-center gap-2 shadow-xl animate-fade-in">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>أنت الآن في وضع الاستكشاف والتجريب الحر (Sandbox Mode) — تفاعل مع الأجهزة بحرية!</span>
        </div>
      )}
    </div>
  )
}
