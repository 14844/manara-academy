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
  Languages,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useQuality, QualityTier } from "./quality-manager"
import { labAudio } from "./sound-effects"
import { useLabLanguage } from "./language-context"

export interface GuidedStep {
  title: string
  titleEn?: string
  instruction: string
  instructionEn?: string
  hint?: string
  hintEn?: string
  targetStateCheck?: boolean
}

export interface QuizQuestion {
  question: string
  questionEn?: string
  options: string[]
  optionsEn?: string[]
  correctIndex: number
  explanation: string
  explanationEn?: string
}

export interface GuidedExperiment {
  id: string
  title: string
  titleEn?: string
  curriculumRef: string
  curriculumRefEn?: string
  description: string
  descriptionEn?: string
  steps: GuidedStep[]
  quiz?: QuizQuestion
}

interface LabHUDProps {
  title: string
  titleEn?: string
  subjectTitle: string
  subjectTitleEn?: string
  curriculumGrade?: string
  curriculumGradeEn?: string
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
  titleEn,
  subjectTitle,
  subjectTitleEn,
  curriculumGrade = "الثانوية العامة",
  curriculumGradeEn = "Secondary School",
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
  const { lang, setLang, t, dir, isAr } = useLabLanguage()
  const [isMuted, setIsMuted] = useState(labAudio.getMuted())
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null)
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false)
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true) // Collapsed by default so 3D scene is 100% visible
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

  const toggleLanguage = () => {
    setLang(lang === "ar" ? "en" : "ar")
    labAudio.playClick(750)
  }

  const displayTitle = isAr ? title : titleEn || title
  const displaySubject = isAr ? subjectTitle : subjectTitleEn || subjectTitle
  const displayGrade = isAr ? curriculumGrade : curriculumGradeEn

  return (
    <div
      className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 md:p-5 select-none z-10"
      dir={dir}
    >
      {/* Top Floating Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Lab Title & Curriculum Tag */}
        <div className="pointer-events-auto flex items-center gap-2 glass px-3.5 py-2 rounded-2xl border border-white/10 shadow-lg">
          <div className="w-8 h-8 rounded-xl bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs md:text-sm font-black text-white">{displayTitle}</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/40 text-primary bg-primary/10">
                {displaySubject}
              </Badge>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">{t(`منهج ${displayGrade}`, `${displayGrade} Curriculum`)}</div>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="pointer-events-auto flex items-center gap-1.5 glass p-1.5 rounded-2xl border border-white/10 shadow-lg">
          {/* Mode Switcher */}
          <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5">
            <button
              onClick={() => {
                onToggleSandbox(false)
                labAudio.playClick()
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                !isSandbox ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:text-white"
              }`}
            >
              {t("تجارب موجهة", "Guided")}
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
              {t("الوضع الحر", "Sandbox")}
            </button>
          </div>

          <div className="w-[1px] h-5 bg-white/10 mx-0.5" />

          {/* Bilingual Language Switcher */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            title={t("تبديل اللغة إلى الإنجليزية", "Switch language to Arabic")}
            className="h-8 px-2.5 rounded-xl hover:bg-white/10 text-cyan-300 font-bold flex items-center gap-1.5 text-xs glass"
          >
            <Languages className="w-3.5 h-3.5" />
            <span>{lang === "ar" ? "English" : "العربية"}</span>
          </Button>

          <div className="w-[1px] h-5 bg-white/10 mx-0.5" />

          {/* Reset Camera */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onResetCamera()
              labAudio.playClick()
            }}
            title={t("إعادة ضبط زاوية الرؤية (R)", "Reset Camera View (R)")}
            className="h-8 w-8 p-0 rounded-xl hover:bg-white/10 text-slate-300"
          >
            <Compass className="w-4 h-4" />
          </Button>

          {/* Audio toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMuteToggle}
            title={isMuted ? t("تشغيل المؤثرات الصوتية", "Unmute audio") : t("كتم الصوت", "Mute audio")}
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
            title={t("إعادة ضبط التجربة", "Reset Experiment")}
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
              title={t("جودة الرسوميات", "Graphics Quality")}
              className="h-8 px-2 rounded-xl hover:bg-white/10 text-slate-300 flex items-center gap-1 text-xs"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline font-mono">
                {tier === "high"
                  ? t("عالية", "High")
                  : tier === "medium"
                  ? t("متوسطة", "Medium")
                  : t("خفيفة", "Low")}
              </span>
            </Button>
            {showQualityMenu && (
              <div className="absolute left-0 mt-2 w-36 glass border border-white/20 rounded-xl p-1 shadow-2xl flex flex-col gap-1 z-30">
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
                    {q === "high"
                      ? t("🚀 جودة عالية", "🚀 High Quality")
                      : q === "medium"
                      ? t("⚡ متوازنة", "⚡ Balanced")
                      : t("🔋 خفيفة / توفير", "🔋 Low / Battery Saver")}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear Center Viewport (Direct 3D Interaction Zone - 100% unobstructed) */}
      <div className="flex-1 pointer-events-none" />

      {/* Bottom Area: Lab Controls + Guided Box (Strictly docked at bottom, leaving center 100% clear) */}
      <div className="pointer-events-none flex flex-col items-center gap-1.5 w-full mt-auto">
        {/* Lab-Specific Custom Overlays */}
        {children && (
          <div className="pointer-events-none flex flex-col justify-end w-full">
            {children}
          </div>
        )}

        {/* Guided Experiment / Steps Overlay */}
        {!isSandbox && activeExp && (
          <div className={`pointer-events-auto w-full max-w-lg mx-auto glass rounded-2xl border border-white/15 shadow-2xl transition-all ${
            isPanelCollapsed ? "px-3 py-1.5" : "p-3.5 md:p-4"
          }`}>
            {/* Header of Guided Box */}
            <div className={`flex items-center justify-between ${!isPanelCollapsed ? "mb-2 pb-2 border-b border-white/10" : ""}`}>
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <select
                  value={activeExpIndex}
                  onChange={(e) => handleSelectExperiment(Number(e.target.value))}
                  className="bg-black/40 text-xs font-bold text-white rounded-lg px-2 py-0.5 border border-white/10 focus:outline-none focus:border-primary cursor-pointer max-w-[200px] sm:max-w-none truncate"
                >
                  {guidedExperiments.map((exp, idx) => (
                    <option key={exp.id} value={idx} className="bg-slate-900 text-white">
                      {t(`تجربة ${idx + 1}: ${exp.title}`, `Exp ${idx + 1}: ${exp.titleEn || exp.title}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-mono">
                  {t(`خطوة ${currentStepIndex + 1} / ${totalSteps}`, `Step ${currentStepIndex + 1} / ${totalSteps}`)}
                </span>
                <button
                  onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 flex items-center gap-1 text-xs"
                  title={isPanelCollapsed ? t("توسيع الشرح والخطوات", "Expand Instructions") : t("تصغير", "Collapse")}
                >
                  <span className="text-[10px] hidden sm:inline">{isPanelCollapsed ? t("عرض الشرح", "Instructions") : ""}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isPanelCollapsed ? "rotate-180" : ""}`} />
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
                    {isAr ? currentStep?.title : currentStep?.titleEn || currentStep?.title}
                  </h4>
                  <p className="text-xs md:text-sm text-slate-200 leading-relaxed">
                    {isAr ? currentStep?.instruction : currentStep?.instructionEn || currentStep?.instruction}
                  </p>
                </div>

                {/* Hint Box */}
                {(currentStep?.hint || currentStep?.hintEn) && (
                  <div>
                    <button
                      onClick={() => setShowHint(!showHint)}
                      className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>
                        {showHint
                          ? t("إخفاء التلميح", "Hide hint")
                          : t("تحتاج مساعدة؟ اعرض التلميح", "Need help? Show hint")}
                      </span>
                    </button>
                    {showHint && (
                      <div className="mt-1.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-200 leading-relaxed">
                        💡 {isAr ? currentStep?.hint : currentStep?.hintEn || currentStep?.hint}
                      </div>
                    )}
                  </div>
                )}

                {/* End-of-Experiment Quiz */}
                {currentStepIndex === totalSteps - 1 && activeExp.quiz && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2 mt-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                      <Award className="w-4 h-4" />
                      <span>{t("سؤال تثبيت الفهم المنهجي:", "Concept Check Question:")}</span>
                    </div>
                    <p className="text-xs text-slate-100 font-semibold">
                      {isAr ? activeExp.quiz.question : activeExp.quiz.questionEn || activeExp.quiz.question}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {(isAr ? activeExp.quiz.options : activeExp.quiz.optionsEn || activeExp.quiz.options).map(
                        (opt, optIdx) => {
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
                              {isQuizSubmitted && isCorrect && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              )}
                              {isQuizSubmitted && isSelected && !isCorrect && (
                                <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              )}
                            </button>
                          )
                        }
                      )}
                    </div>

                    {isQuizSubmitted && (
                      <div className="mt-2 text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-white/10 leading-relaxed">
                        <strong>{t("الشرح العلمي:", "Scientific explanation:")}</strong>{" "}
                        {isAr
                          ? activeExp.quiz.explanation
                          : activeExp.quiz.explanationEn || activeExp.quiz.explanation}
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
                    {t("السابق", "Previous")}
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
                    {t("التالي", "Next")}
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sandbox mode floating hint badge */}
      {isSandbox && (
        <div className="pointer-events-auto self-center glass px-4 py-2 rounded-full border border-primary/30 text-xs font-bold text-primary flex items-center gap-2 shadow-xl animate-fade-in">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>
            {t(
              "أنت الآن في وضع الاستكشاف والتجريب الحر (Sandbox Mode) — تفاعل مع الأجهزة بحرية!",
              "You are in Free Exploration / Sandbox Mode — interact with components freely!"
            )}
          </span>
        </div>
      )}
    </div>
  )
}
