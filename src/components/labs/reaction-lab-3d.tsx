"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { LabCanvas, LabRoom, LabHUD, GuidedExperiment, labAudio, useQuality, useLabLanguage, BillboardLabel, QualityProvider, LanguageProvider } from "./3d"
import {
  Beaker,
  Flame,
  Thermometer,
  Scale,
  Droplet,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  FlaskConical,
  Layers,
  Search,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export interface Reagent {
  id: string
  formula: string
  nameAr: string
  nameEn: string
  category: "acid" | "base" | "metal" | "salt" | "indicator" | "solvent"
  color: string
  liquidColor: string
  state: "liquid" | "solid" | "solution"
  massGrams: number // standard dose
  defaultPH: number
  descriptionAr: string
  descriptionEn: string
}

export const REAGENTS_CATALOG: Reagent[] = [
  // Acids
  {
    id: "hcl",
    formula: "HCl (aq)",
    nameAr: "حمض الهيدروكلوريك",
    nameEn: "Hydrochloric Acid",
    category: "acid",
    color: "#f87171",
    liquidColor: "rgba(254, 202, 202, 0.7)",
    state: "liquid",
    massGrams: 36.5,
    defaultPH: 1.0,
    descriptionAr: "حمض معدني قوي شديد التأين، يذيب الفلزات النشطة ويطلق الهيدروجين.",
    descriptionEn: "Strong monoprotic mineral acid that readily reacts with active metals releasing H2.",
  },
  {
    id: "h2so4",
    formula: "H₂SO₄ (aq)",
    nameAr: "حمض الكبريتيك",
    nameEn: "Sulfuric Acid",
    category: "acid",
    color: "#ef4444",
    liquidColor: "rgba(252, 165, 165, 0.8)",
    state: "liquid",
    massGrams: 49.0,
    defaultPH: 0.5,
    descriptionAr: "حمض قوي ثنائي القاعدية، كاوٍ للجلد ومجفف شديد التفاعل.",
    descriptionEn: "Dense, highly corrosive diprotic acid with strong oxidizing and dehydrating properties.",
  },
  {
    id: "ch3cooh",
    formula: "CH₃COOH (aq)",
    nameAr: "حمض الخليك (الأسيتيك)",
    nameEn: "Acetic Acid (Vinegar)",
    category: "acid",
    color: "#fb923c",
    liquidColor: "rgba(254, 215, 170, 0.6)",
    state: "liquid",
    massGrams: 30.0,
    defaultPH: 3.2,
    descriptionAr: "حمض عضوي كربوكسيلي ضعيف ذو رائحة خل نفاذة.",
    descriptionEn: "Weak organic carboxylic acid known as the main component of vinegar.",
  },

  // Bases
  {
    id: "naoh",
    formula: "NaOH (aq)",
    nameAr: "هيدروكسيد الصوديوم (صودا كاوية)",
    nameEn: "Sodium Hydroxide",
    category: "base",
    color: "#60a5fa",
    liquidColor: "rgba(191, 219, 254, 0.7)",
    state: "solution",
    massGrams: 40.0,
    defaultPH: 13.8,
    descriptionAr: "قلوي قوي صابوني الملمس، يتعادل مع الأحماض لتكوين ماء وملح.",
    descriptionEn: "Strong caustic alkali base that neutralizes acids into salt and water.",
  },
  {
    id: "nh4oh",
    formula: "NH₄OH (aq)",
    nameAr: "محلول النشادر (الأمونيا)",
    nameEn: "Ammonium Hydroxide",
    category: "base",
    color: "#38bdf8",
    liquidColor: "rgba(186, 230, 253, 0.6)",
    state: "solution",
    massGrams: 35.0,
    defaultPH: 11.2,
    descriptionAr: "قاعدة ضعيفة ذات رائحة نفاذة، تذيب رواسب الفضة.",
    descriptionEn: "Weak base with a pungent odor, used to dissolve silver chloride precipitates.",
  },

  // Metals
  {
    id: "zn",
    formula: "Zn (s)",
    nameAr: "حبيبات الخارصين (الزنك)",
    nameEn: "Zinc Granules",
    category: "metal",
    color: "#94a3b8",
    liquidColor: "#64748b",
    state: "solid",
    massGrams: 25.0,
    defaultPH: 7.0,
    descriptionAr: "فلز نشط يسبق الهيدروجين في متسلسلة النشاط، يحل محله في الأحماض.",
    descriptionEn: "Active metal higher than hydrogen in the reactivity series, producing H2 gas with acids.",
  },
  {
    id: "mg",
    formula: "Mg (s)",
    nameAr: "شريط المغنيسيوم",
    nameEn: "Magnesium Ribbon",
    category: "metal",
    color: "#cbd5e1",
    liquidColor: "#94a3b8",
    state: "solid",
    massGrams: 15.0,
    defaultPH: 7.0,
    descriptionAr: "فلز شديد النشاط يتفاعل بعنف مع الأحماض المخففة مطلقا الهيدروجين وحرارة عالية.",
    descriptionEn: "Highly reactive metal that produces rapid effervescence and heat with acids.",
  },
  {
    id: "cu",
    formula: "Cu (s)",
    nameAr: "فلز النحاس الأحمر",
    nameEn: "Copper Metal",
    category: "metal",
    color: "#ea580c",
    liquidColor: "#c2410c",
    state: "solid",
    massGrams: 20.0,
    defaultPH: 7.0,
    descriptionAr: "فلز يلي الهيدروجين في متسلسلة النشاط، لا يتفاعل مع حمض الهيدروكلوريك المخفف.",
    descriptionEn: "Metal placed below hydrogen in the electrochemical series; does not react with dilute HCl.",
  },
  {
    id: "na",
    formula: "Na (s)",
    nameAr: "قطعة صوديوم فلزي",
    nameEn: "Sodium Metal",
    category: "metal",
    color: "#f1f5f9",
    liquidColor: "#e2e8f0",
    state: "solid",
    massGrams: 10.0,
    defaultPH: 7.0,
    descriptionAr: "فلز قلوي نشط جداً يتفاعل بشدة مع الماء مطلقاً غاز الهيدروجين بحرارة كافية لاشتعاله.",
    descriptionEn: "Extremely reactive alkali metal that reacts vigorously with water releasing H2 and flame.",
  },

  // Salts & Minerals
  {
    id: "caco3",
    formula: "CaCO₃ (s)",
    nameAr: "كربونات الكالسيوم (حجر جيري)",
    nameEn: "Calcium Carbonate",
    category: "salt",
    color: "#e2e8f0",
    liquidColor: "#f8fafc",
    state: "solid",
    massGrams: 30.0,
    defaultPH: 8.5,
    descriptionAr: "مسحوق أبيض غير ذائب بالماء، يفور مع الأحماض مطلقاً غاز ثاني أكسيد الكربون.",
    descriptionEn: "Insoluble white salt that effervesces vigorously with acids releasing CO2 gas.",
  },
  {
    id: "nahco3",
    formula: "NaHCO₃ (s)",
    nameAr: "بيكربونات الصوديوم (بيكنج صودا)",
    nameEn: "Sodium Bicarbonate",
    category: "salt",
    color: "#ffffff",
    liquidColor: "#f8fafc",
    state: "solid",
    massGrams: 25.0,
    defaultPH: 8.3,
    descriptionAr: "ملح كربونات هيدروجينية يتفاعل سريعاً مع حمض الخليك لإطلاق فوران CO₂.",
    descriptionEn: "Baking soda, reacts swiftly with vinegar/acetic acid generating CO2 gas.",
  },
  {
    id: "agno3",
    formula: "AgNO₃ (aq)",
    nameAr: "نترات الفضة",
    nameEn: "Silver Nitrate",
    category: "salt",
    color: "#c084fc",
    liquidColor: "rgba(233, 213, 255, 0.6)",
    state: "solution",
    massGrams: 34.0,
    defaultPH: 6.0,
    descriptionAr: "كاشف أيونات الكلوريد، يكون راسباً أبيض حليبياً عند لقاء الكلوريد.",
    descriptionEn: "Key analytical reagent for detecting chloride ions via curdy white AgCl precipitate.",
  },
  {
    id: "nacl",
    formula: "NaCl (aq)",
    nameAr: "كلوريد الصوديوم (ملح الطعام)",
    nameEn: "Sodium Chloride",
    category: "salt",
    color: "#f1f5f9",
    liquidColor: "rgba(241, 245, 249, 0.4)",
    state: "solution",
    massGrams: 25.0,
    defaultPH: 7.0,
    descriptionAr: "محلول ملحي متعادل شائع، مصدر أيونات الكلوريد والصوديوم.",
    descriptionEn: "Neutral common table salt solution providing Na+ and Cl- ions.",
  },
  {
    id: "bacl2",
    formula: "BaCl₂ (aq)",
    nameAr: "كلوريد الباريوم",
    nameEn: "Barium Chloride",
    category: "salt",
    color: "#a7f3d0",
    liquidColor: "rgba(209, 250, 229, 0.5)",
    state: "solution",
    massGrams: 30.0,
    defaultPH: 6.5,
    descriptionAr: "كاشف عن أيونات الكبريتات، يكون راسباً أبيض غير ذائب في الحمض.",
    descriptionEn: "Reagent for sulfate ions; precipitates insoluble white BaSO4 with sulfuric acid.",
  },
  {
    id: "cuso4",
    formula: "CuSO₄ (aq)",
    nameAr: "كبريتات النحاس الزرقاء",
    nameEn: "Copper Sulfate",
    category: "salt",
    color: "#0284c7",
    liquidColor: "rgba(2, 132, 199, 0.85)",
    state: "solution",
    massGrams: 35.0,
    defaultPH: 5.2,
    descriptionAr: "محلول أزرق سماوي لامع، يرسب هيدروكسيد النحاس الأزرق عند إضافة قلوي.",
    descriptionEn: "Vivid azure blue solution; forms blue gelatinous Cu(OH)2 precipitate with NaOH.",
  },

  // Indicators & Solvents
  {
    id: "phph",
    formula: "Phenolphthalein",
    nameAr: "دليل الفينولفثالين",
    nameEn: "Phenolphthalein Indicator",
    category: "indicator",
    color: "#f43f5e",
    liquidColor: "rgba(255, 255, 255, 0.1)",
    state: "liquid",
    massGrams: 5.0,
    defaultPH: 7.0,
    descriptionAr: "دليل حمضي-قاعدي: عديم اللون في الوسط الحمضي والمتعادل، ويتحول إلى وردي في الوسط القاعدي (pH > 8.2).",
    descriptionEn: "Acid-base indicator: colorless in acid/neutral, brilliant pink/magenta in base.",
  },
  {
    id: "h2o",
    formula: "H₂O (l)",
    nameAr: "ماء مقطر نقي",
    nameEn: "Distilled Water",
    category: "solvent",
    color: "#38bdf8",
    liquidColor: "rgba(186, 230, 253, 0.4)",
    state: "liquid",
    massGrams: 50.0,
    defaultPH: 7.0,
    descriptionAr: "مذيب قطبي متعادل نقي، وسط التفاعلات المائية.",
    descriptionEn: "Pure neutral solvent forming the medium for aqueous reactions.",
  },
]

interface ReactionEvaluation {
  hasReaction: boolean
  equation: string
  equationEn: string
  titleAr: string
  titleEn: string
  typeAr: string
  typeEn: string
  color: string
  gasAr?: string
  gasEn?: string
  precipitateAr?: string
  precipitateEn?: string
  precipitateColor?: string
  tempDelta: number
  phResult: number
  explanationAr: string
  explanationEn: string
}

// Evaluate chemical reaction from user dropped combination
function evaluateReaction(activeIds: string[], hasHeat: boolean): ReactionEvaluation {
  const has = (id: string) => activeIds.includes(id)

  // 1. Zn + 2HCl
  if (has("zn") && has("hcl")) {
    return {
      hasReaction: true,
      equation: "Zn(s) + 2HCl(aq) ➔ ZnCl₂(aq) + H₂(g) ↑",
      equationEn: "Zn(s) + 2HCl(aq) ➔ ZnCl₂(aq) + H₂(g) ↑",
      titleAr: "إحلال بسيط وتصاعد غاز الهيدروجين",
      titleEn: "Single Displacement & Hydrogen Evolution",
      typeAr: "تفاعل إحلال فلز نشط محل هيدروجين الحمض",
      typeEn: "Active metal displacement of acid hydrogen",
      color: "rgba(226, 232, 240, 0.8)",
      gasAr: "غاز الهيدروجين (H₂) 💨 (يشتعل بفرقعة)",
      gasEn: "Hydrogen gas (H2) ↑ (pops with a flame)",
      tempDelta: hasHeat ? 32 : 22,
      phResult: 4.5,
      explanationAr: "يسبق الخارصين الهيدروجين في متسلسلة النشاط الكيميائي فيحل محله في الحمض مع تصاعد غاز الهيدروجين وانطلاق طاقة حرارية.",
      explanationEn: "Zinc is above hydrogen in the electrochemical series; it displaces hydrogen forming zinc chloride and H2 gas.",
    }
  }

  // 2. Mg + 2HCl
  if (has("mg") && has("hcl")) {
    return {
      hasReaction: true,
      equation: "Mg(s) + 2HCl(aq) ➔ MgCl₂(aq) + H₂(g) ↑",
      equationEn: "Mg(s) + 2HCl(aq) ➔ MgCl₂(aq) + H₂(g) ↑",
      titleAr: "تفاعل إحلال عنيف وسريع جداً",
      titleEn: "Vigorous Rapid Displacement",
      typeAr: "إحلال بسيط شديد الطرد للحرارة",
      typeEn: "Exothermic metal single replacement",
      color: "rgba(241, 245, 249, 0.9)",
      gasAr: "غاز الهيدروجين (H₂) 💨 (فوران كثيف)",
      gasEn: "Hydrogen gas (H2) ↑ (dense fizz)",
      tempDelta: 36,
      phResult: 5.0,
      explanationAr: "المغنيسيوم أنشط كيميائياً من الخارصين، فيحدث تفاعل فوري وفوران شديد مصحوباً بارتفاع حاد في درجة الحرارة.",
      explanationEn: "Magnesium reacts vigorously with dilute acid, producing dense bubbles of hydrogen and rapid thermal release.",
    }
  }

  // 3. Cu + HCl (No reaction!)
  if (has("cu") && has("hcl") && activeIds.length === 2) {
    return {
      hasReaction: false,
      equation: "Cu(s) + HCl(aq) ➔ لا يحدث تفاعل (No Reaction)",
      equationEn: "Cu(s) + HCl(aq) ➔ No Reaction",
      titleAr: "لا يحدث تفاعل (النحاس يلي الهيدروجين)",
      titleEn: "No Reaction (Copper is below Hydrogen)",
      typeAr: "عدم إمكانية الإحلال",
      typeEn: "Non-spontaneous displacement",
      color: "#ea580c",
      tempDelta: 0,
      phResult: 1.0,
      explanationAr: "النحاس يلي الهيدروجين في متسلسلة النشاط الكيميائي (أقل منه نشاطاً)، فلا يستطيع أن يحل محله في محاليل أحماضه.",
      explanationEn: "Copper lies below hydrogen in the reactivity series; it cannot displace hydrogen from dilute non-oxidizing acids.",
    }
  }

  // 4. Neutralization: HCl + NaOH
  if (has("hcl") && has("naoh")) {
    const hasIndicator = has("phph")
    return {
      hasReaction: true,
      equation: "HCl(aq) + NaOH(aq) ➔ NaCl(aq) + H₂O(l)",
      equationEn: "HCl(aq) + NaOH(aq) ➔ NaCl(aq) + H₂O(l)",
      titleAr: "تفاعل تعادل حمضي قاعدي (تكوين ملح وماء)",
      titleEn: "Acid-Base Neutralization (Salt & Water)",
      typeAr: "تعادل وتبادل مزدوج",
      typeEn: "Neutralization & Double Replacement",
      color: hasIndicator ? "#f43f5e" : "rgba(255, 255, 255, 0.3)",
      tempDelta: 8,
      phResult: hasIndicator ? 8.6 : 7.0,
      explanationAr: "تتحد أيونات الهيدروجين الموجبة H+ من الحمض مع أيونات الهيدروكسيل السالبة OH- من القلوي لتكوين جزيئات الماء المتعادلة.",
      explanationEn: "Hydrogen ions from the acid combine with hydroxide ions from the alkali to form neutral water and dissolved salt.",
    }
  }

  // 5. Precipitation: AgNO3 + NaCl
  if (has("agno3") && has("nacl")) {
    return {
      hasReaction: true,
      equation: "AgNO₃(aq) + NaCl(aq) ➔ AgCl(s) ↓ + NaNO₃(aq)",
      equationEn: "AgNO₃(aq) + NaCl(aq) ➔ AgCl(s) ↓ + NaNO₃(aq)",
      titleAr: "تفاعل ترسيب وتبادل مزدوج (راسب كلوريد الفضة)",
      titleEn: "Precipitation & Double Replacement (AgCl)",
      typeAr: "تفاعل ترسيب وحفظ تام للكتلة",
      typeEn: "Precipitation with strict mass conservation",
      color: "#ffffff",
      precipitateAr: "راسب أبيض حليبي من كلوريد الفضة (AgCl ↓)",
      precipitateEn: "White curdy precipitate of silver chloride (AgCl ↓)",
      precipitateColor: "#ffffff",
      tempDelta: 1.5,
      phResult: 6.8,
      explanationAr: "تتحد أيونات الفضة Ag+ مع أيونات الكلوريد Cl- لتكوين ملح كلوريد الفضة الأبيض شحيح الذوبان في الماء، مع ثبوت الكتلة تماماً.",
      explanationEn: "Silver and chloride ions form an insoluble white precipitate of AgCl while total mass remains strictly conserved.",
    }
  }

  // 6. Precipitation: BaCl2 + H2SO4
  if (has("bacl2") && has("h2so4")) {
    return {
      hasReaction: true,
      equation: "BaCl₂(aq) + H₂SO₄(aq) ➔ BaSO₄(s) ↓ + 2HCl(aq)",
      equationEn: "BaCl₂(aq) + H₂SO₄(aq) ➔ BaSO₄(s) ↓ + 2HCl(aq)",
      titleAr: "ترسيب كبريتات الباريوم البيضاء",
      titleEn: "Barium Sulfate White Precipitation",
      typeAr: "ترسيب وتبادل مزدوج",
      typeEn: "Precipitation & Ion Exchange",
      color: "#ffffff",
      precipitateAr: "راسب أبيض ناصع من BaSO₄ (لا يذوب في الأحماض)",
      precipitateEn: "Insoluble brilliant white BaSO4 precipitate",
      precipitateColor: "#ffffff",
      tempDelta: 4,
      phResult: 1.2,
      explanationAr: "يتكون راسب أبيض من كبريتات الباريوم لا يذوب في حمض الهيدروكلوريك المخفف، وهو الكشف المعتمد لأيون الكبريتات.",
      explanationEn: "Forms a white barium sulfate precipitate that does not dissolve in dilute HCl, standard test for sulfate ions.",
    }
  }

  // 7. Precipitation: CuSO4 + NaOH
  if (has("cuso4") && has("naoh")) {
    return {
      hasReaction: true,
      equation: "CuSO₄(aq) + 2NaOH(aq) ➔ Cu(OH)₂(s) ↓ + Na₂SO₄(aq)",
      equationEn: "CuSO₄(aq) + 2NaOH(aq) ➔ Cu(OH)₂(s) ↓ + Na₂SO₄(aq)",
      titleAr: "ترسيب هيدروكسيد النحاس الأزرق",
      titleEn: "Copper(II) Hydroxide Blue Precipitation",
      typeAr: "ترسيب قاعدة غير ذائبة",
      typeEn: "Insoluble base precipitation",
      color: "#0284c7",
      precipitateAr: "راسب أزرق جيلاتيني من Cu(OH)₂ ↓",
      precipitateEn: "Light blue gelatinous precipitate of Cu(OH)2 ↓",
      precipitateColor: "#38bdf8",
      tempDelta: 6,
      phResult: 10.5,
      explanationAr: "تترسب كاتيونات النحاس الزرقاء في صورة هيدروكسيد النحاس الثنائي الأزرق الجيلاتيني.",
      explanationEn: "Copper cations precipitate as light blue gelatinous copper(II) hydroxide.",
    }
  }

  // 8. Carbonate + Acid: CaCO3 + 2HCl
  if (has("caco3") && has("hcl")) {
    return {
      hasReaction: true,
      equation: "CaCO₃(s) + 2HCl(aq) ➔ CaCl₂(aq) + H₂O(l) + CO₂(g) ↑",
      equationEn: "CaCO₃(s) + 2HCl(aq) ➔ CaCl₂(aq) + H₂O(l) + CO₂(g) ↑",
      titleAr: "تفاعل تفكك الكربونات وتصاعد غاز CO₂",
      titleEn: "Carbonate Decomposition & CO2 Gas Release",
      typeAr: "تفاعل إحلال مزدوج مصحوب بانحلال حمض الكربونيك",
      typeEn: "Double displacement with carbonic acid breakdown",
      color: "rgba(241, 245, 249, 0.8)",
      gasAr: "غاز ثاني أكسيد الكربون (CO₂) 💨 (يعكر ماء الجير)",
      gasEn: "Carbon dioxide gas (CO2) ↑ (turns limewater milky)",
      tempDelta: hasHeat ? 16 : 8,
      phResult: 5.2,
      explanationAr: "يتفاعل الحجر الجيري مع الحمض ليعطي حمض الكربونيك غير الثابت الذي ينحل فورياً إلى ماء وغاز ثاني أكسيد الكربون مع فوران واضح.",
      explanationEn: "Limestone reacts with acid forming unstable carbonic acid which swiftly breaks down into water and effervescing CO2 gas.",
    }
  }

  // 9. Sodium + Water: 2Na + 2H2O
  if (has("na") && has("h2o")) {
    return {
      hasReaction: true,
      equation: "2Na(s) + 2H₂O(l) ➔ 2NaOH(aq) + H₂(g) ↑ + حرارة",
      equationEn: "2Na(s) + 2H₂O(l) ➔ 2NaOH(aq) + H₂(g) ↑ + Heat",
      titleAr: "تفاعل الصوديوم العنيف مع الماء",
      titleEn: "Vigorous Sodium-Water Reaction",
      typeAr: "إحلال فلز قلوي شديد النشاط",
      typeEn: "Violent alkali metal displacement",
      color: "#e2e8f0",
      gasAr: "غاز الهيدروجين (H₂) 💨 (يشتعل بلهب أصفر)",
      gasEn: "Hydrogen gas (H2) ↑ (burns with yellow flame)",
      tempDelta: 45,
      phResult: 13.5,
      explanationAr: "يتفاعل الصوديوم بشدة مع الماء مطلقاً غاز الهيدروجين، وتكون كمية الحرارة المنطلقة كافية لاشتعال الهيدروجين فور خروجه.",
      explanationEn: "Sodium violently reacts with water to form caustic NaOH, generating enough heat to ignite the evolved hydrogen gas.",
    }
  }

  // 10. Baking soda + Vinegar: NaHCO3 + CH3COOH
  if (has("nahco3") && has("ch3cooh")) {
    return {
      hasReaction: true,
      equation: "NaHCO₃(s) + CH₃COOH(aq) ➔ CH₃COONa(aq) + H₂O(l) + CO₂(g) ↑",
      equationEn: "NaHCO₃(s) + CH₃COOH(aq) ➔ CH₃COONa(aq) + H₂O(l) + CO₂(g) ↑",
      titleAr: "تفاعل بيكربونات الصوديوم مع حمض الخليك",
      titleEn: "Baking Soda & Acetic Acid Reaction",
      typeAr: "تفاعل تحضير غاز CO₂ الماص للحرارة",
      typeEn: "Endothermic CO2 generation",
      color: "#ffffff",
      gasAr: "فوران كثيف لغاز CO₂ 💨",
      gasEn: "Dense foaming of CO2 gas ↑",
      tempDelta: -4, // Endothermic cooling!
      phResult: 6.5,
      explanationAr: "تفاعل ماص للحرارة تنخفض معه درجة حرارة المحلول مع تصاعد فوران كثيف من غاز ثاني أكسيد الكربون.",
      explanationEn: "Endothermic reaction that lowers the liquid temperature while producing dense foaming CO2 effervescence.",
    }
  }

  // 11. Indicator test only
  if (has("phph") && (has("naoh") || has("nh4oh"))) {
    return {
      hasReaction: true,
      equation: "Phenolphthalein + Base ➔ Radiant Pink Color (pH > 8.2)",
      equationEn: "Phenolphthalein + Base ➔ Radiant Pink Color (pH > 8.2)",
      titleAr: "كشف قاعدية المحلول بدليل الفينولفثالين",
      titleEn: "Alkaline Detection with Phenolphthalein",
      typeAr: "تغير لوني كيميائي توازني",
      typeEn: "Chromophoric indicator transition",
      color: "#f43f5e",
      tempDelta: 0.5,
      phResult: 11.5,
      explanationAr: "في الوسط القاعدي تفقد جزيئات الفينولفثالين بروتونات ويتغير تركيبها الإلكتروني مظهرة لوناً وردياً قرمزياً زاهياً.",
      explanationEn: "In basic media, phenolphthalein molecules deprotonate into their pink conjugated resonance structure.",
    }
  }

  // Fallback: Physical mixture or single reagent
  if (activeIds.length > 1) {
    return {
      hasReaction: false,
      equation: "مزيج فيزيائي (خلط بدون تفاعل كيميائي) / Physical Mixture",
      equationEn: "Physical Mixture - No Chemical Reaction Occurs",
      titleAr: "مزيج فيزيائي (لا يحدث تفاعل كيميائي)",
      titleEn: "Physical Mixture (No Reaction)",
      typeAr: "خلط ميكانيكي فقط",
      typeEn: "Simple mixing",
      color: "rgba(226, 232, 240, 0.5)",
      tempDelta: 0,
      phResult: 7.0,
      explanationAr: "المواد المضافة لا تتفاعل كيميائياً معاً في هذه الظروف؛ تظل الجزيئات ممتزجة فيزيائياً فقط.",
      explanationEn: "The added compounds do not chemically react under these conditions; they simply coexist in physical mixture.",
    }
  }

  // Single reagent in beaker
  const single = REAGENTS_CATALOG.find((r) => r.id === activeIds[0])
  return {
    hasReaction: false,
    equation: single ? `${single.formula} في المحلول` : "الكأس فارغ / Beaker Empty",
    equationEn: single ? `${single.formula} in solution` : "Beaker is empty",
    titleAr: single ? `محلول ${single.nameAr}` : "كأس تفاعل زجاجي فارغ",
    titleEn: single ? `${single.nameEn} Solution` : "Empty Reaction Beaker",
    typeAr: "حالة ابتدائية",
    typeEn: "Initial State",
    color: single ? single.liquidColor : "transparent",
    tempDelta: 0,
    phResult: single ? single.defaultPH : 7.0,
    explanationAr: "أضف مادة ثانية من الرف لتشهد التفاعل وتتولد المعادلة الموزونة الحية.",
    explanationEn: "Add a second compound from the shelf to trigger a reaction and generate its balanced equation.",
  }
}

// 3D Gas Bubbles Mesh
function ReactionGasBubbles({ isBubbling, color = "#ffffff" }: { isBubbling: boolean; color?: string }) {
  const { particleCount } = useQuality()
  const count = Math.round(28 * particleCount)
  const groupRef = useRef<THREE.Group>(null)

  const bubbles = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 0.16,
        z: (Math.random() - 0.5) * 0.16,
        speed: 0.25 + Math.random() * 0.45,
        size: 0.007 + Math.random() * 0.009,
      })),
    [count]
  )

  useFrame((_, delta) => {
    if (!groupRef.current || !isBubbling) return
    groupRef.current.children.forEach((mesh, i) => {
      mesh.position.y += bubbles[i].speed * delta
      if (mesh.position.y > 0.26) {
        mesh.position.y = 0.02
        mesh.position.x = (Math.random() - 0.5) * 0.16
        mesh.position.z = (Math.random() - 0.5) * 0.16
      }
    })
  })

  if (!isBubbling || count === 0) return null

  return (
    <group ref={groupRef} position={[0, 0.02, 0]}>
      {bubbles.map((b, i) => (
        <mesh key={i} position={[b.x, Math.random() * 0.24, b.z]}>
          <sphereGeometry args={[b.size, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.65} />
        </mesh>
      ))}
    </group>
  )
}

// 3D Reaction Beaker on Precision Balance
function InteractiveBeakerOnScale({
  position,
  volumeMl,
  liquidColor,
  isBubbling,
  precipitateColor,
  massGrams,
  temperatureC,
  ph,
}: {
  position: [number, number, number]
  volumeMl: number
  liquidColor: string
  isBubbling: boolean
  precipitateColor?: string
  massGrams: number
  temperatureC: number
  ph: number
}) {
  const liquidHeight = THREE.MathUtils.clamp((volumeMl / 250) * 0.26, 0.02, 0.26)

  return (
    <group position={position}>
      {/* 1. Analytical Balance Unit */}
      <group position={[0, 0, 0]}>
        {/* Balance Base */}
        <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.44, 0.08, 0.4]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Steel Pan */}
        <mesh position={[0, 0.085, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.01, 32]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
        </mesh>

        {/* LED Digital Display */}
        <BillboardLabel
          position={[0, 0.045, 0.205]}
          text={`${massGrams.toFixed(2)} g`}
          color="#10b981"
          bgColor="#020617"
          borderColor="rgba(16, 185, 129, 0.3)"
          scale={[0.24, 0.06, 1]}
          fontSize={22}
        />
        <BillboardLabel
          position={[0, 0.015, 0.205]}
          text="ميزان حساس • Mass Scale"
          color="#94a3b8"
          bgColor="transparent"
          borderColor="transparent"
          scale={[0.28, 0.04, 1]}
          fontSize={14}
        />
      </group>

      {/* 2. Glass Reaction Beaker */}
      <group position={[0, 0.09, 0]}>
        {/* Glass Outer Wall */}
        <mesh position={[0, 0.15, 0]} castShadow>
          <cylinderGeometry args={[0.115, 0.115, 0.3, 32, 1, true]} />
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.05}
            transmission={0.92}
            thickness={0.03}
            transparent
            opacity={0.35}
          />
        </mesh>

        {/* Glass Base */}
        <mesh position={[0, 0.005, 0]}>
          <cylinderGeometry args={[0.115, 0.115, 0.01, 32]} />
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.05}
            transmission={0.9}
            transparent
            opacity={0.4}
          />
        </mesh>

        {/* Liquid Volume Inside Beaker */}
        {volumeMl > 0 && (
          <group position={[0, 0.005, 0]}>
            <mesh position={[0, liquidHeight / 2, 0]}>
              <cylinderGeometry args={[0.111, 0.111, liquidHeight, 32]} />
              <meshStandardMaterial
                color={liquidColor}
                roughness={0.2}
                transparent
                opacity={0.85}
              />
            </mesh>
            {/* Top liquid meniscus */}
            <mesh position={[0, liquidHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.111, 32]} />
              <meshStandardMaterial color={liquidColor} roughness={0.1} />
            </mesh>

            {/* Rising gas bubbles */}
            <ReactionGasBubbles isBubbling={isBubbling} />

            {/* Precipitate settling at bottom */}
            {precipitateColor && (
              <mesh position={[0, 0.01, 0]}>
                <cylinderGeometry args={[0.108, 0.108, 0.02, 32]} />
                <meshStandardMaterial color={precipitateColor} roughness={0.8} />
              </mesh>
            )}
          </group>
        )}

        {/* Beaker Volume Graduations */}
        {[-0.04, 0, 0.04, 0.08].map((y, i) => (
          <mesh key={i} position={[0, 0.14 + y, 0.113]}>
            <planeGeometry args={[0.04, 0.004]} />
            <meshBasicMaterial color="#ffffff" opacity={0.6} transparent />
          </mesh>
        ))}
      </group>

      {/* 3. Thermometer Probe */}
      <group position={[0.09, 0.09, 0.04]} rotation={[0, 0, -0.15]}>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.32, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.34, 0]}>
          <boxGeometry args={[0.08, 0.05, 0.03]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <BillboardLabel
          position={[0, 0.34, 0.02]}
          text={`${temperatureC.toFixed(1)}°C`}
          color="#38bdf8"
          bgColor="transparent"
          borderColor="transparent"
          scale={[0.16, 0.05, 1]}
          fontSize={18}
        />
      </group>

      {/* 4. pH Probe */}
      <group position={[-0.09, 0.09, 0.04]} rotation={[0, 0, 0.15]}>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.3, 16]} />
          <meshStandardMaterial color="#2563eb" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.01, 0]}>
          <sphereGeometry args={[0.01, 16, 16]} />
          <meshStandardMaterial color="#93c5fd" transparent opacity={0.7} />
        </mesh>
        <mesh position={[0, 0.33, 0]}>
          <boxGeometry args={[0.08, 0.05, 0.03]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <BillboardLabel
          position={[0, 0.33, 0.02]}
          text={`pH ${ph.toFixed(1)}`}
          color="#a855f7"
          bgColor="transparent"
          borderColor="transparent"
          scale={[0.16, 0.05, 1]}
          fontSize={18}
        />
      </group>
    </group>
  )
}

// 3D Bunsen Burner with Flame
function InteractiveBunsenBurner({
  position,
  isOn,
  onToggle,
}: {
  position: [number, number, number]
  isOn: boolean
  onToggle: () => void
}) {
  const flameRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (flameRef.current && isOn) {
      const t = clock.getElapsedTime() * 12
      flameRef.current.scale.y = 1 + Math.sin(t) * 0.08
      flameRef.current.scale.x = 1 + Math.cos(t * 1.5) * 0.06
    }
  })

  return (
    <group position={position} onClick={onToggle}>
      {/* Heavy base */}
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.03, 24]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.4} />
      </mesh>
      {/* Gas inlet pipe */}
      <mesh position={[-0.09, 0.025, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.1, 16]} />
        <meshStandardMaterial color="#ca8a04" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Burner tube */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.3, 24]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Flame */}
      {isOn && (
        <group ref={flameRef} position={[0, 0.33, 0]}>
          <mesh position={[0, 0.06, 0]}>
            <coneGeometry args={[0.02, 0.12, 16]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.95} />
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <coneGeometry args={[0.035, 0.18, 16]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.65} />
          </mesh>
          <pointLight color="#38bdf8" intensity={1.5} distance={1.8} decay={2} />
        </group>
      )}

      {/* Label */}
      <BillboardLabel
        position={[0, -0.01, 0.16]}
        text={isOn ? "لهب بنزن (نشط)" : "لهب بنزن (مغلق)"}
        color={isOn ? "#38bdf8" : "#94a3b8"}
        bgColor="rgba(15, 23, 42, 0.85)"
        scale={[0.26, 0.06, 1]}
        fontSize={16}
      />
    </group>
  )
}

// 4 Guided Experiments (Bilingual)
export const REACTIONS_GUIDED_EXPERIMENTS: GuidedExperiment[] = [
  {
    id: "zn-acid-h2",
    title: "إحلال الخارصين في الحمض وتصاعد الهيدروجين",
    titleEn: "Zinc Displacement of Acid & Hydrogen Evolution",
    curriculumRef: "الكيمياء - متسلسلة النشاط الكيميائي وتفاعلات الإحلال البسيط",
    curriculumRefEn: "Chemistry - Metal Reactivity Series & Single Replacement",
    description: "تفاعل فلز الخارصين مع حمض الهيدروكلوريك وملاحظة انطلاق غاز الهيدروجين وتغير الحرارة.",
    descriptionEn: "Reaction of zinc granules with hydrochloric acid releasing hydrogen gas and heat.",
    steps: [
      {
        title: "إضافة حمض الهيدروكلوريك (HCl)",
        titleEn: "Add Hydrochloric Acid (HCl)",
        instruction: "اسحب أو اضغط على 'حمض الهيدروكلوريك (HCl)' من الرف لإضافته إلى كأس التفاعل.",
        instructionEn: "Drag or click 'Hydrochloric Acid (HCl)' from the shelf to add it to the beaker.",
        hint: "الحمض هو الوسط المتفاعل الأيوني الذي يحتوي على بروتونات H+.",
        hintEn: "The acid supplies the active H+ hydronium ions for the reaction.",
      },
      {
        title: "إضافة حبيبات الخارصين (Zn)",
        titleEn: "Add Zinc Granules (Zn)",
        instruction: "اسحب أو اضغط على 'حبيبات الخارصين (Zn)' وشاهد الفوران وتولد المعادلة الموزونة فوراً.",
        instructionEn: "Drag or click 'Zinc Granules (Zn)' and watch the effervescence and live balanced equation.",
        hint: "الخارصين يسبق الهيدروجين في متسلسلة النشاط فيحل محله مع تصاعد فقاعات H₂ وارتفاع الحرارة.",
        hintEn: "Zinc sits above hydrogen in the reactivity series, displacing it with vigorous H2 bubbling and heat.",
      },
    ],
    quiz: {
      question: "يحل الخارصين محل هيدروجين الحمض المخفف بينما لا يحل النحاس محله لأن:",
      questionEn: "Zinc displaces hydrogen from dilute acid while copper does not because:",
      options: [
        "الخارصين يسبق الهيدروجين في متسلسلة النشاط بينما النحاس يليه",
        "النحاس يتفاعل مع الماء فقط",
        "الخارصين فلز لا فلزي النزعة",
        "حمض الهيدروكلوريك يذيب جميع الفلزات دون استثناء",
      ],
      optionsEn: [
        "Zinc precedes hydrogen in the reactivity series while copper follows it",
        "Copper only reacts with water",
        "Zinc is non-metallic in nature",
        "Hydrochloric acid dissolves all metals unconditionally",
      ],
      correctIndex: 0,
      explanation: "العناصر التي تسبق الهيدروجين في متسلسلة الجهود الكهربية تكون أكثر نشاطاً وأسهل أكسدة فتطرد الهيدروجين من محاليل أحماضه.",
      explanationEn: "Metals above hydrogen have higher oxidation potentials and readily displace hydrogen ions from solution.",
    },
  },
  {
    id: "precipitation-mass-conservation",
    title: "تفاعل الترسيب والتحقق من قانون بقاء الكتلة",
    titleEn: "Precipitation & Conservation of Mass",
    curriculumRef: "الكيمياء - تفاعلات الترسيب والاتزان الأيوني",
    curriculumRefEn: "Chemistry - Precipitation & Ionic Equilibrium",
    description: "خلط نترات الفضة مع ملح الطعام لتكوين راسب أبيض من AgCl والتحقق من ثبوت الكتلة على الميزان.",
    descriptionEn: "Mix silver nitrate with table salt to form white AgCl precipitate and verify mass conservation.",
    steps: [
      {
        title: "إضافة نترات الفضة (AgNO₃)",
        titleEn: "Add Silver Nitrate (AgNO3)",
        instruction: "أضف 'نترات الفضة' إلى الكأس، ولاحظ قراءة الميزان الحساس.",
        instructionEn: "Add 'Silver Nitrate' into the beaker and observe the balance reading.",
      },
      {
        title: "إضافة كلوريد الصوديوم (NaCl)",
        titleEn: "Add Sodium Chloride (NaCl)",
        instruction: "أضف 'كلوريد الصوديوم' ولاحظ تكون الراسب الأبيض فوراً مع ثبوت مجموع الكتل تماماً.",
        instructionEn: "Add 'Sodium Chloride' and watch the instant curdy white precipitate while total mass is strictly conserved.",
        hint: "لا تتطاير أي غازات، لذا تظل قراءة الميزان الحساس مطابقة تماماً لمجموع كتل المتفاعلات.",
        hintEn: "No gases escape, so the scale displays the exact sum of reactant masses.",
      },
    ],
    quiz: {
      question: "عند إضافة محلول نترات الفضة إلى محلول كلوريد الصوديوم، يتكون راسب أبيض من AgCl يتميز بأنه:",
      questionEn: "When silver nitrate is added to sodium chloride, the resulting white precipitate of AgCl:",
      options: [
        "يذوب في محلول النشادر المركز (هيدروكسيد الأمونيوم)",
        "يذوب في الماء الساخن فقط",
        "لا يذوب في أي كاشف كيميائي إطلاقاً",
        "يتحول للون الأصفر عند إضافة حمض النيتريك",
      ],
      optionsEn: [
        "Dissolves in concentrated aqueous ammonia (NH4OH)",
        "Dissolves only in boiling water",
        "Does not dissolve in any chemical reagent",
        "Turns yellow upon adding nitric acid",
      ],
      correctIndex: 0,
      explanation: "راسب كلوريد الفضة الأبيض يذوب بسهولة وسرعة في محلول النشادر المركز لتكوين متراكب فضة أمونياتي ذائب [Ag(NH3)2]+.",
      explanationEn: "AgCl dissolves readily in concentrated ammonia forming the soluble diamminesilver(I) complex [Ag(NH3)2]+.",
    },
  },
  {
    id: "acid-base-titration",
    title: "معايرة حمض وقاعدة ودليل الفينولفثالين",
    titleEn: "Acid-Base Neutralization with Phenolphthalein",
    curriculumRef: "الكيمياء - التحليل الحجمي وتفاعلات التعادل",
    curriculumRefEn: "Chemistry - Volumetric Analysis & Neutralization",
    description: "تعيين نقطة نهاية التفاعل (Endpoint) بين حمض قوي وقاعدة قوية باستخدام كاشف لوني حساس.",
    descriptionEn: "Determine the titration endpoint between strong acid and strong base with color change.",
    steps: [
      {
        title: "وضع الحمض والكاشف في الكأس",
        titleEn: "Place Acid and Indicator in Beaker",
        instruction: "أضف 'حمض الهيدروكلوريك (HCl)' ثم أضف قطرات من 'دليل الفينولفثالين'.",
        instructionEn: "Add 'Hydrochloric Acid (HCl)' then add drops of 'Phenolphthalein Indicator'.",
        hint: "الفينولفثالين عديم اللون في الوسط الحمضي.",
        hintEn: "Phenolphthalein remains completely colorless in acidic media.",
      },
      {
        title: "إضافة هيدروكسيد الصوديوم (NaOH)",
        titleEn: "Add Sodium Hydroxide (NaOH)",
        instruction: "أضف 'هيدروكسيد الصوديوم' لمشاهدة تحول اللون فجأة إلى الوردي القرمزي عند نقطة التعادل وقراءة الـ pH.",
        instructionEn: "Add 'Sodium Hydroxide' and watch the instant leap to bright pink at the equivalence endpoint.",
      },
    ],
    quiz: {
      question: "يصلح دليل الفينولفثالين في التمييز بين:",
      questionEn: "Phenolphthalein indicator can distinguish between:",
      options: [
        "محلول حمضي ومحلول قاعدي",
        "محلول حمضي والماء النقي",
        "محلولين كلاهما قاعدي",
        "محلول كلوريد الأمونيوم والماء المقطر",
      ],
      optionsEn: [
        "An acidic solution and a basic solution",
        "An acidic solution and pure water",
        "Two basic solutions",
        "Ammonium chloride solution and distilled water",
      ],
      correctIndex: 0,
      explanation: "الفينولفثالين عديم اللون في الوسط الحامضي والمتعادل، ويتحول إلى وردي في الوسط القاعدي، لذا يميز بوضوح بين الحمض والقاعدة.",
      explanationEn: "Colorless in acidic and neutral conditions, but turns vibrant pink in alkaline media (pH > 8.2).",
    },
  },
  {
    id: "caco3-burner-heat",
    title: "أثر الحرارة ولهب بنزن على تفكك الكربونات",
    titleEn: "Heat Effect & Carbonate Thermal Breakdown",
    curriculumRef: "الكيمياء - العوامل المؤثرة على سرعة التفاعل الكيميائي",
    curriculumRefEn: "Chemistry - Factors Influencing Reaction Rates",
    description: "استخدام لهب بنزن لتسريع تفكك كربونات الكالسيوم وملاحظة فوران غاز CO₂.",
    descriptionEn: "Use the Bunsen burner flame to accelerate CaCO3 acid breakdown releasing CO2 gas.",
    steps: [
      {
        title: "إضافة كربونات الكالسيوم والحمض",
        titleEn: "Add Calcium Carbonate and Acid",
        instruction: "أضف 'كربونات الكالسيوم (CaCO₃)' ثم 'حمض الهيدروكلوريك (HCl)' لمشاهدة فوران غاز CO₂.",
        instructionEn: "Add 'Calcium Carbonate (CaCO3)' then 'Hydrochloric Acid (HCl)' to observe effervescence.",
      },
      {
        title: "إشعال لهب بنزن",
        titleEn: "Ignite Bunsen Burner",
        instruction: "اضغط على لهب بنزن لإشعال الشعلة الزرقاء ولاحظ قفزة درجة الحرارة وتسارع الفوران.",
        instructionEn: "Click the Bunsen burner to ignite the flame and watch the accelerated reaction rate.",
      },
    ],
    quiz: {
      question: "رفع درجة حرارة وسط التفاعل يزيد من سرعة التفاعل الكيميائي بشكل رئيسي نتيجة:",
      questionEn: "Increasing reaction temperature speeds up the reaction rate primarily by:",
      options: [
        "زيادة نسبة الجزيئات التي تمتلك طاقة التنشيط أو تفوقها",
        "تقليل التركيز المولي للمتفاعلات",
        "تغيير نوع الروابط في المواد الناتجة",
        "زيادة حجم الوعاء التفاعلي",
      ],
      optionsEn: [
        "Increasing the fraction of colliding molecules with energy ≥ activation energy",
        "Reducing reactant molar concentrations",
        "Changing bond types in the products",
        "Increasing vessel volume",
      ],
      correctIndex: 0,
      explanation: "وفق نظرية التصادم: زيادة الحرارة ترفع الطاقة الحركية للجزيئات، فتزداد نسبة الجزيئات المنشطة التي تمتلك طاقة التنشيط اللازمة لبدء التفاعل.",
      explanationEn: "Higher temperatures raise the average kinetic energy, drastically increasing collisions that exceed the activation energy threshold.",
    },
  },
]

export function ReactionLab() {
  const [activeReagents, setActiveReagents] = useState<string[]>([])
  const [isBurnerOn, setIsBurnerOn] = useState(false)
  const [isPouring, setIsPouring] = useState(false)
  const [pouredReagentName, setPouredReagentName] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>("all")

  // Guided Experiments HUD
  const [activeExpIndex, setActiveExpIndex] = useState(0)
  const [isSandbox, setIsSandbox] = useState(false)
  const [cameraResetSignal, setCameraResetSignal] = useState(0)

  const { lang, t, isAr } = useLabLanguage()

  // Evaluate reaction
  const reaction = useMemo(
    () => evaluateReaction(activeReagents, isBurnerOn),
    [activeReagents, isBurnerOn]
  )

  // Calculate live mass
  const baseBeakerMass = 120.0 // tare weight of glass beaker
  const reagentsMass = useMemo(() => {
    return activeReagents.reduce((sum, id) => {
      const r = REAGENTS_CATALOG.find((item) => item.id === id)
      return sum + (r?.massGrams || 0)
    }, 0)
  }, [activeReagents])

  // If gas produced and open system, subtract slight escaped gas mass
  const totalMass = baseBeakerMass + reagentsMass - (reaction.gasAr ? 0.45 : 0)

  // Live temperature
  const currentTemp = 22.0 + reaction.tempDelta + (isBurnerOn ? 18.0 : 0)

  // Volume in ml
  const totalVolume = Math.min(activeReagents.length * 45, 240)

  // Handle adding reagent to beaker (Drag & Drop or One-Click Pour)
  const handleAddReagent = (reagent: Reagent) => {
    if (activeReagents.includes(reagent.id)) return

    setIsPouring(true)
    setPouredReagentName(isAr ? reagent.nameAr : reagent.nameEn)
    labAudio.playPour()

    setTimeout(() => {
      setIsPouring(false)
      setPouredReagentName(null)
      setActiveReagents((prev) => [...prev, reagent.id])

      if (reagent.category === "metal" || reagent.category === "salt") {
        labAudio.playSnap()
      } else {
        labAudio.playBubble()
      }
    }, 600)
  }

  const handleRemoveReagent = (id: string) => {
    setActiveReagents((prev) => prev.filter((item) => item !== id))
    labAudio.playClick(600)
  }

  const handleEmptyBeaker = () => {
    setActiveReagents([])
    setIsBurnerOn(false)
    labAudio.playClick(500)
  }

  const handleResetLab = () => {
    setActiveReagents([])
    setIsBurnerOn(false)
    setCameraResetSignal((prev) => prev + 1)
  }

  const filteredReagents = useMemo(() => {
    if (filterCategory === "all") return REAGENTS_CATALOG
    return REAGENTS_CATALOG.filter((r) => r.category === filterCategory)
  }, [filterCategory])

  return (
    <QualityProvider>
      <LanguageProvider>
        <div className="relative w-full h-full min-h-[480px] flex-1">
          <LabCanvas
            camera={{ position: [0, 2.3, 3.4], fov: 42, far: 100 }}
            onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
          >
        <LabRoom cameraResetSignal={cameraResetSignal} defaultCameraPosition={[0, 2.3, 3.4]} defaultTarget={[0, 0.95, 0]}>
          {/* Main Reaction Beaker on Analytical Balance */}
          <InteractiveBeakerOnScale
            position={[-0.2, 0.82, 0]}
            volumeMl={totalVolume}
            liquidColor={reaction.color}
            isBubbling={Boolean(reaction.gasAr)}
            precipitateColor={reaction.precipitateColor}
            massGrams={totalMass}
            temperatureC={currentTemp}
            ph={reaction.phResult}
          />

          {/* Bunsen Burner */}
          <InteractiveBunsenBurner
            position={[-0.95, 0.82, -0.2]}
            isOn={isBurnerOn}
            onToggle={() => {
              setIsBurnerOn(!isBurnerOn)
              labAudio.playClick(isBurnerOn ? 400 : 850)
            }}
          />

          {/* Pouring stream visual in scene */}
          {isPouring && (
            <group position={[0.2, 1.25, 0]}>
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.008, 0.008, 0.35, 8]} />
                <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
              </mesh>
            </group>
          )}
        </LabRoom>
      </LabCanvas>

      {/* 2D Interactive HUD Overlay */}
      <LabHUD
        title="مختبر التفاعلات الكيميائية وتوليد المعادلات"
        titleEn="3D Chemical Reactions & Equation Generator Lab"
        subjectTitle="الكيمياء التفاعلية"
        subjectTitleEn="Interactive Chemistry"
        curriculumGrade="الثانوية العامة"
        curriculumGradeEn="Secondary Chemistry"
        guidedExperiments={REACTIONS_GUIDED_EXPERIMENTS}
        activeExpIndex={activeExpIndex}
        onSelectExp={setActiveExpIndex}
        isSandbox={isSandbox}
        onToggleSandbox={setIsSandbox}
        onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
        onResetExperiment={handleResetLab}
      >
        <div className="flex flex-col gap-2 pointer-events-auto max-w-5xl mx-auto w-full px-2">
          {/* Live Chemical Equation Banner */}
          <div className="glass px-4 py-2.5 rounded-2xl border border-emerald-500/40 bg-slate-950/85 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
              <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="text-xs text-slate-400 font-bold shrink-0">
                {t("المعادلة الناتجة:", "Resulting Equation:")}
              </span>
              <span className="text-xs md:text-sm font-mono font-black text-emerald-300 whitespace-nowrap" dir="ltr">
                {isAr ? reaction.equation : reaction.equationEn}
              </span>
            </div>

            {/* Empty Beaker / Reset Button */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={handleEmptyBeaker}
                className="h-8 px-2.5 rounded-xl glass text-rose-300 border-rose-500/30 hover:bg-rose-500/20 text-xs font-bold"
              >
                <Trash2 className="w-3.5 h-3.5 ml-1" />
                {t("إفراغ الكأس", "Empty Beaker")}
              </Button>
            </div>
          </div>

          {/* Active Reagents currently in beaker pills */}
          {activeReagents.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-400 font-bold shrink-0">
                {t("المواد داخل الكأس:", "In Beaker:")}
              </span>
              {activeReagents.map((id) => {
                const r = REAGENTS_CATALOG.find((item) => item.id === id)
                if (!r) return null
                return (
                  <span
                    key={id}
                    className="glass px-2.5 py-1 rounded-xl border border-white/20 text-white font-mono flex items-center gap-1.5 shrink-0 bg-white/5"
                  >
                    <span>{r.formula}</span>
                    <button
                      onClick={() => handleRemoveReagent(id)}
                      className="text-slate-400 hover:text-rose-400 ml-1 font-bold"
                    >
                      ×
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {/* Live Instrument Readouts Bar */}
          <div className="glass px-3.5 py-1.5 rounded-xl border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
            {/* Reaction Title & Type */}
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-slate-200">
                {isAr ? reaction.titleAr : reaction.titleEn}
              </span>
              {reaction.gasAr && (
                <Badge variant="outline" className="text-[10px] bg-sky-500/10 border-sky-500/40 text-sky-300">
                  {isAr ? reaction.gasAr : reaction.gasEn}
                </Badge>
              )}
              {reaction.precipitateAr && (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 border-amber-500/40 text-amber-300">
                  {isAr ? reaction.precipitateAr : reaction.precipitateEn}
                </Badge>
              )}
            </div>

            {/* Scale, Temp, pH */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">{t("الكتلة:", "Mass:")}</span>
                <span className="font-mono font-bold text-white">{totalMass.toFixed(2)} g</span>
              </div>
              <div className="w-[1px] h-3 bg-white/10" />
              <div className="flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400">{t("الحرارة:", "Temp:")}</span>
                <span className="font-mono font-bold text-amber-300">{currentTemp.toFixed(1)}°C</span>
              </div>
              <div className="w-[1px] h-3 bg-white/10" />
              <div className="flex items-center gap-1">
                <span className="text-purple-400 font-bold text-[11px]">pH</span>
                <span className="font-mono font-bold text-purple-300">{reaction.phResult.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Interactive Reagents Shelf / Catalog (Drag & Drop or Click to Add) */}
          <div className="glass p-3 rounded-2xl border border-white/15 shadow-2xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                <FlaskConical className="w-4 h-4 text-primary" />
                <span>{t("رف المواد الكيميائية (اضغط لإضافة المركب للكأس):", "Chemical Shelf (Click to add to beaker):")}</span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 text-[11px]">
                {[
                  { id: "all", ar: "الكل", en: "All" },
                  { id: "acid", ar: "أحماض", en: "Acids" },
                  { id: "base", ar: "قلويات", en: "Bases" },
                  { id: "metal", ar: "فلزات", en: "Metals" },
                  { id: "salt", ar: "أملاح", en: "Salts" },
                  { id: "indicator", ar: "كواشف", en: "Indicators" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCategory(cat.id)}
                    className={`px-2 py-0.5 rounded-lg font-semibold transition-all ${
                      filterCategory === cat.id ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {isAr ? cat.ar : cat.en}
                  </button>
                ))}
              </div>
            </div>

            {/* Reagents Grid / Shelf */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {filteredReagents.map((r) => {
                const isAdded = activeReagents.includes(r.id)
                return (
                  <button
                    key={r.id}
                    disabled={isAdded || isPouring}
                    onClick={() => handleAddReagent(r)}
                    className={`p-2 rounded-xl border text-right transition-all flex flex-col justify-between h-16 ${
                      isAdded
                        ? "bg-white/5 border-emerald-500/50 text-slate-400 opacity-60"
                        : "bg-white/5 border-white/10 hover:border-primary/50 hover:bg-primary/10 text-slate-200 cursor-pointer active:scale-95"
                    }`}
                    title={isAr ? r.descriptionAr : r.descriptionEn}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-mono font-bold text-xs text-white" dir="ltr">
                        {r.formula}
                      </span>
                      {isAdded ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <Plus className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-300 truncate w-full">
                      {isAr ? r.nameAr : r.nameEn}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </LabHUD>
        </div>
      </LanguageProvider>
    </QualityProvider>
  )
}
