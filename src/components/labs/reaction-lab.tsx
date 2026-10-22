"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Beaker,
    Flame,
    RotateCcw,
    Sparkles,
    Thermometer,
    Info,
    CheckCircle2,
    FlaskConical,
    Droplets,
    Atom,
    Plus,
    Trash2,
    Zap,
    Layers,
    BookOpen
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface Chemical {
    id: string
    nameAr: string
    formula: string
    category: "acid" | "base" | "metal" | "salt" | "indicator"
    color: string // Tailwind or hex
    liquidColor: string
    state: "liquid" | "solid" | "solution"
    ph: number
    description: string
}

const CHEMICALS_LIBRARY: Chemical[] = [
    // Acids
    { id: "hcl", nameAr: "حمض الهيدروكلوريك", formula: "HCl (aq)", category: "acid", color: "#f87171", liquidColor: "rgba(254, 202, 202, 0.7)", state: "liquid", ph: 1.0, description: "حمض قوي شديد التفاعل يذيب الفلزات" },
    { id: "h2so4", nameAr: "حمض الكبريتيك", formula: "H₂SO₄ (aq)", category: "acid", color: "#ef4444", liquidColor: "rgba(252, 165, 165, 0.8)", state: "liquid", ph: 0.5, description: "حمض قوي كاوٍ ومجفف شديد التفاعل" },
    { id: "ch3cooh", nameAr: "حمض الخليك (الخل)", formula: "CH₃COOH (aq)", category: "acid", color: "#fb923c", liquidColor: "rgba(254, 215, 170, 0.6)", state: "liquid", ph: 3.5, description: "حمض عضوي ضعيف ذو رائحة نفاذة" },

    // Bases
    { id: "naoh", nameAr: "هيدروكسيد الصوديوم (الصودا الكاوية)", formula: "NaOH (aq)", category: "base", color: "#60a5fa", liquidColor: "rgba(191, 219, 254, 0.7)", state: "liquid", ph: 13.5, description: "قلوي قوي صابوني الملمس" },
    { id: "nh4oh", nameAr: "محلول الأمونيا (النشادر)", formula: "NH₄OH (aq)", category: "base", color: "#38bdf8", liquidColor: "rgba(186, 230, 253, 0.6)", state: "liquid", ph: 11.0, description: "قاعدة ضعيفة برائحة مميزة" },

    // Metals & Solids
    { id: "zn", nameAr: "حبيبات الخارصين (الزنك)", formula: "Zn (s)", category: "metal", color: "#94a3b8", liquidColor: "#64748b", state: "solid", ph: 7.0, description: "فلز فضي يتفاعل مع الأحماض مطرداً غاز الهيدروجين" },
    { id: "mg", nameAr: "شريط المغنيسيوم", formula: "Mg (s)", category: "metal", color: "#cbd5e1", liquidColor: "#94a3b8", state: "solid", ph: 7.0, description: "فلز لامع نشط جداً يشتعل بضوء أبيض مبهر" },
    { id: "caco3", nameAr: "كربونات الكالسيوم (الحجر الجيري)", formula: "CaCO₃ (s)", category: "salt", color: "#e2e8f0", liquidColor: "#f1f5f9", state: "solid", ph: 8.0, description: "ملح أبيض يتفاعل مع الأحماض ليعطي غاز CO₂" },

    // Salts & Solutions
    { id: "cuso4", nameAr: "كبريتات النحاس الزرقاء", formula: "CuSO₄ (aq)", category: "salt", color: "#0ea5e9", liquidColor: "rgba(14, 165, 233, 0.85)", state: "solution", ph: 5.0, description: "محلول أزرق سماوي لامع" },
    { id: "agno3", nameAr: "نترات الفضة", formula: "AgNO₃ (aq)", category: "salt", color: "#a855f7", liquidColor: "rgba(233, 213, 255, 0.5)", state: "solution", ph: 6.0, description: "محلول كاشف عن أيونات الكلوريد" },
    { id: "nacl", nameAr: "كلوريد الصوديوم (ملح الطعام)", formula: "NaCl (aq)", category: "salt", color: "#e2e8f0", liquidColor: "rgba(241, 245, 249, 0.4)", state: "solution", ph: 7.0, description: "محلول ملحي متعادل شائع" },

    // Indicators
    { id: "phph", nameAr: "دليل الفينولفثالين", formula: "Phenolphthalein", category: "indicator", color: "#f43f5e", liquidColor: "rgba(255, 255, 255, 0.2)", state: "liquid", ph: 7.0, description: "كاشف عديم اللون في الوسط الحمضي ويتحول لوردي قرمزي في الوسط القاعدي" }
]

interface ReactionRule {
    reactants: string[]
    requiresHeat?: boolean
    equation: string
    title: string
    type: string
    color: string
    gas?: string
    precipitate?: string
    tempDelta: number
    phResult: number
    explanation: string
}

const REACTION_RULES: ReactionRule[] = [
    // 1. Zn + HCl -> ZnCl2 + H2
    {
        reactants: ["zn", "hcl"],
        equation: "Zn(s) + 2HCl(aq) ➔ ZnCl₂(aq) + H₂(g) ↑",
        title: "إحلال بسيط (فلز نشط يحل محل هيدروجين الحمض)",
        type: "تفاعل إحلال وتصاعد غاز الهيدروجين",
        color: "rgba(226, 232, 240, 0.8)",
        gas: "غاز الهيدروجين (H₂) 💨 (يشتعل بفرقعة)",
        tempDelta: 18,
        phResult: 3.5,
        explanation: "يحل الخارصين محل الهيدروجين في حمض الهيدروكلوريك لأنه يسبقه في متسلسلة النشاط الكيميائي، وينطلق غاز الهيدروجين مع فوران شديد وارتفاع في درجة الحرارة."
    },
    // 2. Mg + HCl -> MgCl2 + H2
    {
        reactants: ["mg", "hcl"],
        equation: "Mg(s) + 2HCl(aq) ➔ MgCl₂(aq) + H₂(g) ↑",
        title: "تفاعل إحلال عنيف وسريع جداً",
        type: "إحلال بسيط طارد للحرارة",
        color: "rgba(241, 245, 249, 0.9)",
        gas: "غاز الهيدروجين (H₂) 💨 (تصاعد كثيف)",
        tempDelta: 28,
        phResult: 4.0,
        explanation: "المغنيسيوم أكثر نشاطاً من الخارصين، فيحدث تفاعل سريع جداً مصحوباً بفوران قوي وتصاعد مستمر لغاز الهيدروجين."
    },
    // 3. HCl + NaOH -> NaCl + H2O
    {
        reactants: ["hcl", "naoh"],
        equation: "HCl(aq) + NaOH(aq) ➔ NaCl(aq) + H₂O(l)",
        title: "تفاعل التعادل (حمض + قلوي ➔ ملح + ماء)",
        type: "تعادل طارد للحرارة",
        color: "rgba(224, 242, 254, 0.5)",
        tempDelta: 12,
        phResult: 7.0,
        explanation: "يتحد أيون الهيدروجين الموجب (H⁺) من الحمض مع أيون الهيدروكسيد السالب (OH⁻) من القلوي ليتكون الماء ويتعادل المحلول تماماً."
    },
    // 4. Neutralization with Phenolphthalein (NaOH + Phenolphthalein -> Pink)
    {
        reactants: ["naoh", "phph"],
        equation: "NaOH(aq) + Ph.Ph ➔ [Na⁺ + In⁻] (لون وردي قرمزي)",
        title: "الكشف عن القواعد بواسطة دليل الفينولفثالين",
        type: "تغير لوني في الوسط القاعدي",
        color: "rgba(244, 63, 94, 0.85)",
        tempDelta: 0,
        phResult: 12.5,
        explanation: "يتلون دليل الفينولفثالين باللون الوردي القرمزي الزاهي في الوسط القاعدي لأن قيمة الرقم الهيدروجيني pH أكبر من 8.2."
    },
    // 5. NaOH + HCl + Phenolphthalein -> Decolorization (End of Titration)
    {
        reactants: ["naoh", "hcl", "phph"],
        equation: "NaOH + HCl + Ph.Ph ➔ NaCl + H₂O (يختفي اللون الوردي)",
        title: "نقطة نهاية المعايرة (اختفاء اللون)",
        type: "معايرة حمض وقاعدة",
        color: "rgba(248, 250, 252, 0.3)",
        tempDelta: 10,
        phResult: 7.0,
        explanation: "عند إضافة الحمض للقلوي المحتوي على الفينولفثالين، يتعادل الوسط ويختفي اللون الوردي ليصبح المحلول شفافاً تماماً عند نقطة التكافؤ."
    },
    // 6. AgNO3 + NaCl -> AgCl (white ppt) + NaNO3
    {
        reactants: ["agno3", "nacl"],
        equation: "AgNO₃(aq) + NaCl(aq) ➔ AgCl(s) ↓ + NaNO₃(aq)",
        title: "تفاعل ترسيب (تبادل مزدوج)",
        type: "تكوين راسب أبيض من كلوريد الفضة",
        color: "rgba(255, 255, 255, 0.95)",
        precipitate: "راسب أبيض ناصع (AgCl) يتحول للبنفسجي في الضوء",
        tempDelta: 2,
        phResult: 6.5,
        explanation: "تتحد أيونات الفضة (Ag⁺) مع أيونات الكلوريد (Cl⁻) لتكوين راسب أبيض غير قابل للذوبان في الماء من كلوريد الفضة يذوب في محلول النشادر."
    },
    // 7. CaCO3 + HCl -> CaCl2 + H2O + CO2
    {
        reactants: ["caco3", "hcl"],
        equation: "CaCO₃(s) + 2HCl(aq) ➔ CaCl₂(aq) + H₂O(l) + CO₂(g) ↑",
        title: "تفاعل الكربونات وتصاعد غاز ثاني أكسيد الكربون",
        type: "كشف عن الكربونات",
        color: "rgba(241, 245, 249, 0.7)",
        gas: "غاز ثاني أكسيد الكربون (CO₂) 💨 (يعكر ماء الجير الرائق)",
        tempDelta: 8,
        phResult: 5.5,
        explanation: "يتفاعل الحجر الجيري مع حمض الهيدروكلوريك مع فوران شديد وتصاعد غاز ثاني أكسيد الكربون الذي يعكر ماء الجير الرائق عند مروره فيه لفترة قصيرة."
    },
    // 8. CuSO4 + NaOH -> Cu(OH)2 (Blue jelly ppt) + Na2SO4
    {
        reactants: ["cuso4", "naoh"],
        equation: "CuSO₄(aq) + 2NaOH(aq) ➔ Cu(OH)₂(s) ↓ + Na₂SO₄(aq)",
        title: "تفاعل ترسيب هيدروكسيد النحاس الأزرق",
        type: "كشف عن كاتيون النحاس II",
        color: "rgba(2, 132, 199, 0.9)",
        precipitate: "راسب أزرق جيلاتيني (Cu(OH)₂) يسود بالتسخين",
        tempDelta: 4,
        phResult: 8.5,
        explanation: "يتكون راسب أزرق من هيدروكسيد النحاس الثنائي، وعند تسخينه يتحول للون الأسود بسبب تكون أكسيد النحاس CuO."
    },
    // 9. CuSO4 + Heat -> Dehydration
    {
        reactants: ["cuso4"],
        requiresHeat: true,
        equation: "CuSO₄·5H₂O(s) + Heat ➔ CuSO₄(s) + 5H₂O(g) ↑",
        title: "التفكك والتحلل الحراري لكبريتات النحاس المائية",
        type: "انفصال ماء التبلر",
        color: "rgba(248, 250, 252, 0.95)",
        gas: "بخار ماء (H₂O) ♨️",
        tempDelta: 45,
        phResult: 6.0,
        explanation: "عند تسخين بلورات كبريتات النحاس الزرقاء، تفقد ماء التبلر وتتحول إلى كبريتات نحاس لا مائية بيضاء اللون."
    }
]

export function ReactionLab() {
    const [beakerContents, setBeakerContents] = useState<Chemical[]>([])
    const [isHeating, setIsHeating] = useState(false)
    const [temperature, setTemperature] = useState(25)
    const [currentReaction, setCurrentReaction] = useState<ReactionRule | null>(null)
    const [bubbles, setBubbles] = useState<{ id: number; left: number; size: number }[]>([])

    // Check for matching reactions whenever beaker contents or heat state changes
    useEffect(() => {
        const addedIds = beakerContents.map(c => c.id)

        // Find best reaction matching current chemicals
        const matched = REACTION_RULES.find(rule => {
            const hasAllReactants = rule.reactants.every(r => addedIds.includes(r))
            if (!hasAllReactants) return false
            if (rule.requiresHeat && !isHeating) return false
            return true
        })

        if (matched) {
            setCurrentReaction(matched)
            setTemperature(25 + matched.tempDelta + (isHeating ? 35 : 0))
        } else {
            setCurrentReaction(null)
            setTemperature(25 + (isHeating ? 40 : 0))
        }
    }, [beakerContents, isHeating])

    // Generate bubbles when reaction produces gas or during boiling
    useEffect(() => {
        let interval: any
        if (currentReaction?.gas || (isHeating && beakerContents.length > 0)) {
            interval = setInterval(() => {
                setBubbles(prev => [
                    ...prev.slice(-15),
                    {
                        id: Math.random(),
                        left: Math.random() * 70 + 15,
                        size: Math.random() * 8 + 4
                    }
                ])
            }, 180)
        } else {
            setBubbles([])
        }
        return () => clearInterval(interval)
    }, [currentReaction, isHeating, beakerContents.length])

    const handleAddChemical = (chemical: Chemical) => {
        if (beakerContents.some(c => c.id === chemical.id)) return // Already in beaker
        setBeakerContents(prev => [...prev, chemical])
    }

    const handleReset = () => {
        setBeakerContents([])
        setIsHeating(false)
        setTemperature(25)
        setCurrentReaction(null)
        setBubbles([])
    }

    // Determine current visual liquid color in the beaker
    const currentLiquidColor = currentReaction
        ? currentReaction.color
        : beakerContents.length > 0
        ? beakerContents[beakerContents.length - 1].liquidColor
        : "rgba(224, 242, 254, 0.15)"

    const currentPH = currentReaction
        ? currentReaction.phResult
        : beakerContents.length > 0
        ? (beakerContents.reduce((acc, c) => acc + c.ph, 0) / beakerContents.length).toFixed(1)
        : 7.0

    return (
        <div className="w-full h-full flex flex-col lg:flex-row gap-4 p-4 font-arabic select-none overflow-y-auto lg:overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white rounded-3xl border border-white/10 shadow-2xl">
            {/* Left Shelf: Reagent & Chemical Selector */}
            <div className="w-full lg:w-80 flex flex-col bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <FlaskConical className="h-5 w-5 text-emerald-400" />
                        <h3 className="font-bold text-sm">رف المواد الكيميائية</h3>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30">
                        {CHEMICALS_LIBRARY.length} مادة
                    </Badge>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                    اضغط على أي مادة أو اسحبها لإضافتها إلى الكأس المعياري وبدء التفاعل:
                </p>

                {/* Categories and Chemical Cards */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar max-h-[380px] lg:max-h-none">
                    {CHEMICALS_LIBRARY.map((chem) => {
                        const isAdded = beakerContents.some(c => c.id === chem.id)
                        return (
                            <motion.button
                                key={chem.id}
                                whileHover={{ scale: isAdded ? 1 : 1.02 }}
                                whileTap={{ scale: isAdded ? 1 : 0.98 }}
                                onClick={() => handleAddChemical(chem)}
                                disabled={isAdded}
                                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-right transition-all ${
                                    isAdded
                                        ? "bg-white/5 border-white/5 opacity-40 cursor-not-allowed"
                                        : "bg-white/5 hover:bg-white/10 border-white/10 hover:border-emerald-500/50 shadow-sm"
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className="h-7 w-7 rounded-lg flex items-center justify-center font-bold text-xs shadow-inner"
                                        style={{ backgroundColor: chem.color, color: "#18181b" }}
                                    >
                                        <Droplets className="h-3.5 w-3.5" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-zinc-200">{chem.nameAr}</div>
                                        <div className="text-[10px] font-mono text-zinc-400">{chem.formula}</div>
                                    </div>
                                </div>
                                {isAdded ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                                ) : (
                                    <Plus className="h-4 w-4 text-zinc-400 group-hover:text-emerald-400 shrink-0" />
                                )}
                            </motion.button>
                        )
                    })}
                </div>
            </div>

            {/* Center Area: Interactive 3D/Physics Laboratory Table */}
            <div className="flex-1 flex flex-col bg-zinc-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-6 relative overflow-hidden justify-between min-h-[420px]">
                {/* Top Metrics Bar */}
                <div className="flex items-center justify-between gap-3 z-10 flex-wrap">
                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
                        <Thermometer className={`h-4 w-4 ${temperature > 40 ? "text-red-400 animate-pulse" : "text-blue-400"}`} />
                        <span>الحرارة: <strong>{temperature}°C</strong></span>
                    </div>
                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 text-xs">
                        <Atom className="h-4 w-4 text-purple-400" />
                        <span>الرقم الهيدروجيني: <strong className={Number(currentPH) < 7 ? "text-red-400" : Number(currentPH) > 7 ? "text-blue-400" : "text-green-400"}>pH {currentPH}</strong></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={isHeating ? "destructive" : "secondary"}
                            size="sm"
                            className="h-8 text-xs gap-1.5 rounded-xl font-bold shadow-lg"
                            onClick={() => setIsHeating(!isHeating)}
                        >
                            <Flame className={`h-3.5 w-3.5 ${isHeating ? "text-amber-300 animate-bounce" : ""}`} />
                            {isHeating ? "إطفاء اللهب 🔥" : "موقد بنسن (تسخين)"}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5 rounded-xl font-bold bg-white/5 hover:bg-white/10 border-white/10"
                            onClick={handleReset}
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            تفريغ الكأس
                        </Button>
                    </div>
                </div>

                {/* Central Beaker & Realistic Liquid Simulation */}
                <div className="relative flex-1 flex flex-col items-center justify-center my-4">
                    {/* Floating Gas Cloud animation */}
                    {currentReaction?.gas && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: [0.3, 0.9, 0.3], y: [-10, -50] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="absolute -top-6 text-xs bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 text-emerald-300 font-bold flex items-center gap-1.5 shadow-xl z-20"
                        >
                            <Zap className="h-3.5 w-3.5 text-amber-300 animate-spin" />
                            {currentReaction.gas}
                        </motion.div>
                    )}

                    {/* Realistic 3D Glass Beaker */}
                    <div className="relative w-52 h-64 border-4 border-t-0 border-white/30 rounded-b-3xl bg-white/5 backdrop-blur-sm shadow-2xl flex flex-col justify-end overflow-hidden">
                        {/* Graduated Beaker Markings */}
                        <div className="absolute right-2 inset-y-4 flex flex-col justify-between text-[9px] text-white/30 font-mono select-none pointer-events-none">
                            <span>- 250ml</span>
                            <span>- 200ml</span>
                            <span>- 150ml</span>
                            <span>- 100ml</span>
                            <span>- 50ml</span>
                        </div>

                        {/* Liquid Layer with Dynamic Height & Color Transition */}
                        <motion.div
                            className="w-full relative transition-colors duration-700 ease-out"
                            style={{
                                backgroundColor: currentLiquidColor,
                                height: beakerContents.length === 0 ? "0%" : `${Math.min(beakerContents.length * 28 + 20, 85)}%`,
                                boxShadow: "inset 0 4px 12px rgba(255,255,255,0.2)"
                            }}
                            initial={false}
                            animate={{
                                height: beakerContents.length === 0 ? "0%" : `${Math.min(beakerContents.length * 28 + 20, 85)}%`
                            }}
                            transition={{ duration: 0.5 }}
                        >
                            {/* Surface Wave Effect */}
                            <div className="absolute top-0 inset-x-0 h-2 bg-white/30 rounded-full blur-[1px]" />

                            {/* Precipitate bottom layer if present */}
                            {currentReaction?.precipitate && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: "25%" }}
                                    className="absolute bottom-0 inset-x-0 bg-white/90 border-t border-white shadow-inner flex items-center justify-center text-[9px] font-bold text-zinc-900"
                                >
                                    {currentReaction.precipitate}
                                </motion.div>
                            )}

                            {/* Animated Rising Bubbles */}
                            {bubbles.map(b => (
                                <motion.div
                                    key={b.id}
                                    className="absolute rounded-full bg-white/60 border border-white/80"
                                    style={{
                                        width: b.size,
                                        height: b.size,
                                        left: `${b.left}%`,
                                        bottom: 0
                                    }}
                                    animate={{
                                        bottom: "100%",
                                        opacity: [0.8, 1, 0],
                                        x: [0, (Math.random() - 0.5) * 15]
                                    }}
                                    transition={{ duration: 1.2, ease: "easeOut" }}
                                />
                            ))}
                        </motion.div>
                    </div>

                    {/* Bunsen Burner Flame Base */}
                    {isHeating && (
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: [0.95, 1.05, 0.98], opacity: 1 }}
                            transition={{ repeat: Infinity, duration: 0.4 }}
                            className="mt-1 flex flex-col items-center"
                        >
                            <div className="w-10 h-12 bg-gradient-to-t from-blue-600 via-amber-400 to-amber-200 rounded-t-full blur-[2px] shadow-lg shadow-amber-500/50" />
                            <div className="w-16 h-3 bg-zinc-700 rounded-full border border-zinc-500" />
                        </motion.div>
                    )}
                </div>

                {/* Added Chemicals Tags */}
                <div className="flex items-center gap-2 overflow-x-auto py-1 z-10">
                    <span className="text-xs text-zinc-400 font-bold shrink-0">محتويات الكأس:</span>
                    {beakerContents.length === 0 ? (
                        <span className="text-xs text-zinc-500 italic">الكأس فارغ حالياً</span>
                    ) : (
                        beakerContents.map(c => (
                            <Badge
                                key={c.id}
                                variant="secondary"
                                className="text-xs gap-1 py-1 px-2.5 bg-white/10 text-zinc-200 border-white/20 shrink-0"
                            >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                                {c.nameAr} ({c.formula})
                            </Badge>
                        ))
                    )}
                </div>
            </div>

            {/* Right: Dynamic Equation Board & Scientific Explanation */}
            <div className="w-full lg:w-96 flex flex-col bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 gap-4 justify-between">
                <div>
                    <div className="flex items-center gap-2 pb-3 border-b border-white/10">
                        <BookOpen className="h-5 w-5 text-amber-400" />
                        <h3 className="font-bold text-sm">لوحة المعادلات والتحليل العلمي</h3>
                    </div>

                    {currentReaction ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4 mt-4"
                        >
                            <div className="bg-emerald-500/10 border border-emerald-500/30 p-3.5 rounded-xl space-y-1.5">
                                <Badge className="bg-emerald-500 text-zinc-950 font-bold text-[10px]">
                                    {currentReaction.type}
                                </Badge>
                                <h4 className="font-black text-sm text-emerald-300">{currentReaction.title}</h4>
                            </div>

                            {/* Balanced Chemical Equation Box */}
                            <div className="space-y-1.5">
                                <span className="text-[11px] text-zinc-400 font-bold">المعادلة الكيميائية الموزونة:</span>
                                <div className="p-3 bg-black/60 rounded-xl border border-white/10 font-mono text-sm text-center text-amber-300 font-bold tracking-wide shadow-inner overflow-x-auto dir-ltr">
                                    {currentReaction.equation}
                                </div>
                            </div>

                            {/* Scientific Explanation */}
                            <div className="space-y-1.5">
                                <span className="text-[11px] text-zinc-400 font-bold">المشاهدة والتفسير العلمي:</span>
                                <p className="text-xs text-zinc-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                                    {currentReaction.explanation}
                                </p>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex flex-col items-center justify-center text-center p-8 space-y-3 text-zinc-500 h-[260px]">
                            <Beaker className="h-10 w-10 text-zinc-600 animate-pulse" />
                            <p className="text-xs leading-relaxed">
                                قم بإضافة مادتين أو أكثر تتفاعلان معاً لرؤية التفاعل والمعادلة الكيميائية الموزونة فوراً.
                            </p>
                            <div className="text-[10px] text-zinc-400 bg-white/5 p-2 rounded-lg border border-white/5">
                                💡 تجارب مقترحة: (حمض + خارصين) أو (حمض + صودا كاوية) أو (نترات فضة + ملح طعام)
                            </div>
                        </div>
                    )}
                </div>

                {/* Safety Badge */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>محاكاة آمنة 100% مطابقة لمعايير مناهج الكيمياء للثانوية العامة.</span>
                </div>
            </div>
        </div>
    )
}
