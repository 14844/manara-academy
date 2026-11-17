"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Text } from "@react-three/drei"
import { LabCanvas, LabRoom, LabHUD, GuidedExperiment, labAudio, useQuality } from "./3d"
import { Beaker, Flame, Thermometer, Scale, Droplet, Sparkles, AlertCircle, RefreshCw } from "lucide-react"

interface ReactionScenario {
  id: string
  nameAr: string
  title: string
  equation: string
  reactantsMass: number // grams
  productsMass: number // grams
  initialTemp: number // °C
  finalTemp: number
  initialPH: number
  finalPH: number
  initialColor: string
  finalColor: string
  gasType?: string
  hasPrecipitate?: boolean
  precipitateColor?: string
  curriculumNotes: string
}

const REACTION_SCENARIOS: ReactionScenario[] = [
  {
    id: "zn_hcl",
    nameAr: "الخارصين مع حمض الهيدروكلوريك",
    title: "تفاعل إحلال بسيط وتصاعد غاز الهيدروجين",
    equation: "Zn(s) + 2HCl(aq) ➔ ZnCl₂(aq) + H₂(g) ↑",
    reactantsMass: 154.20,
    productsMass: 153.85, // 0.35g of H2 escaped in open beaker
    initialTemp: 22.0,
    finalTemp: 44.5, // Exothermic +22.5°C
    initialPH: 1.0,
    finalPH: 4.5,
    initialColor: "#f1f5f9",
    finalColor: "#cbd5e1",
    gasType: "غاز الهيدروجين H₂ ↑ (يشتعل بفرقعة)",
    hasPrecipitate: false,
    curriculumNotes: "يسبق الخارصين الهيدروجين في متسلسلة النشاط الكيميائي فيحل محله مع انطلاق طاقة حرارية وفوران شديد.",
  },
  {
    id: "precipitation_agno3",
    nameAr: "نترات الفضة مع كلوريد الصوديوم",
    title: "تفاعل ترسيب وتبادل مزدوج وحفظ الكتلة",
    equation: "AgNO₃(aq) + NaCl(aq) ➔ AgCl(s) ↓ + NaNO₃(aq)",
    reactantsMass: 180.50,
    productsMass: 180.50, // Perfect conservation of mass
    initialTemp: 22.0,
    finalTemp: 22.8,
    initialPH: 6.5,
    finalPH: 6.8,
    initialColor: "#e2e8f0",
    finalColor: "#ffffff",
    hasPrecipitate: true,
    precipitateColor: "#ffffff",
    curriculumNotes: "يتكون راسب أبيض من كلوريد الفضة AgCl لا يذوب في الماء ويذوب في محلول النشادر المركز، وتظل الكتلة ثابتة بدقة.",
  },
  {
    id: "titration_naoh_hcl",
    nameAr: "معايرة حمض وقاعدة (التعادل)",
    title: "معايرة حمض الهيدروكلوريك مع الصودا الكاوية وكاشف الفينولفثالين",
    equation: "HCl(aq) + NaOH(aq) ➔ NaCl(aq) + H₂O(l)",
    reactantsMass: 165.00,
    productsMass: 165.00,
    initialTemp: 22.0,
    finalTemp: 27.2,
    initialPH: 1.5,
    finalPH: 8.4, // Phenolphthalein turns bright pink
    initialColor: "rgba(255, 255, 255, 0.2)",
    finalColor: "#f43f5e", // Bright pink/magenta
    hasPrecipitate: false,
    curriculumNotes: "تفاعل تعادل طارد للحرارة معتدل؛ عند إضافة قطرات القاعدة من السحاحة يتحول الدليل فجأة إلى الوردي عند نقطة النهاية.",
  },
  {
    id: "caco3_thermal_acid",
    nameAr: "كربونات الكالسيوم مع الحمض والحرارة",
    title: "تفاعل الكربونات مع الحمض وتصاعد غاز CO₂",
    equation: "CaCO₃(s) + 2HCl(aq) ➔ CaCl₂(aq) + H₂O(l) + CO₂(g) ↑",
    reactantsMass: 175.00,
    productsMass: 172.60, // CO2 gas escapes
    initialTemp: 22.0,
    finalTemp: 35.0,
    initialPH: 2.0,
    finalPH: 5.5,
    initialColor: "#f8fafc",
    finalColor: "#e2e8f0",
    gasType: "غاز ثاني أكسيد الكربون CO₂ ↑ (يعكر ماء الجير الرائق)",
    hasPrecipitate: false,
    curriculumNotes: "يفور الحجر الجيري بشدة مع تصاعد ثاني أكسيد الكربون، والتسخين بلهب بنزن يزيد من سرعة تصاعد الغاز.",
  },
]

// Animated Gas Bubbles rising from reaction liquid
function GasBubbles({ isBubbling, color = "#ffffff" }: { isBubbling: boolean; color?: string }) {
  const { particleCount } = useQuality()
  const count = Math.round(25 * particleCount)
  const groupRef = useRef<THREE.Group>(null)

  const bubbles = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 0.18,
        z: (Math.random() - 0.5) * 0.18,
        speed: 0.2 + Math.random() * 0.4,
        size: 0.006 + Math.random() * 0.008,
      })),
    [count]
  )

  useFrame((_, delta) => {
    if (!groupRef.current || !isBubbling) return
    groupRef.current.children.forEach((mesh, i) => {
      mesh.position.y += bubbles[i].speed * delta
      if (mesh.position.y > 0.28) {
        mesh.position.y = 0.02
        mesh.position.x = (Math.random() - 0.5) * 0.18
        mesh.position.z = (Math.random() - 0.5) * 0.18
      }
    })
  })

  if (!isBubbling || count === 0) return null

  return (
    <group ref={groupRef} position={[0, 0.02, 0]}>
      {bubbles.map((b, i) => (
        <mesh key={i} position={[b.x, Math.random() * 0.25, b.z]}>
          <sphereGeometry args={[b.size, 8, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.65} />
        </mesh>
      ))}
    </group>
  )
}

// 3D Bunsen Burner with Toggleable Flame
function BunsenBurner({
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
      {/* Heavy cast iron hexagonal/circular base */}
      <mesh position={[0, 0.015, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.12, 0.14, 0.03, 24]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.4} />
      </mesh>

      {/* Gas inlet pipe */}
      <mesh position={[-0.09, 0.025, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 0.1, 16]} />
        <meshStandardMaterial color="#ca8a04" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Upright metal chimney tube */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.3, 24]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Air collar ring */}
      <mesh position={[0, 0.07, 0]}>
        <cylinderGeometry args={[0.026, 0.026, 0.03, 16]} />
        <meshStandardMaterial color="#ca8a04" metalness={0.8} />
      </mesh>

      {/* Bunsen Flame (Double cone: hot blue inner cone, subtle outer sheath) */}
      {isOn && (
        <group ref={flameRef} position={[0, 0.33, 0]}>
          {/* Inner hot blue cone */}
          <mesh position={[0, 0.06, 0]}>
            <coneGeometry args={[0.02, 0.12, 16]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.95} />
          </mesh>
          {/* Outer luminous flame */}
          <mesh position={[0, 0.09, 0]}>
            <coneGeometry args={[0.035, 0.18, 16]} />
            <meshBasicMaterial color="#60a5fa" transparent opacity={0.65} />
          </mesh>
          {/* Flame illumination */}
          <pointLight color="#38bdf8" intensity={1.5} distance={1.8} decay={2} />
        </group>
      )}

      {/* Status Label */}
      <Text position={[0, -0.01, 0.14]} fontSize={0.03} color={isOn ? "#38bdf8" : "#94a3b8"} anchorX="center">
        لهب بنزن: {isOn ? "مشتعل (اضغط للإطفاء)" : "مطفأ (اضغط للإشعال)"}
      </Text>
    </group>
  )
}

// 3D Glass Beaker on Analytical Balance
function ReactionBeakerOnBalance({
  position,
  volumeMl,
  liquidColor,
  isBubbling,
  hasPrecipitate,
  massGrams,
  temperatureC,
  ph,
}: {
  position: [number, number, number]
  volumeMl: number
  liquidColor: string
  isBubbling: boolean
  hasPrecipitate: boolean
  massGrams: number
  temperatureC: number
  ph: number
}) {
  const liquidHeight = THREE.MathUtils.clamp((volumeMl / 250) * 0.28, 0.02, 0.28)

  return (
    <group position={position}>
      {/* 1. Analytical Balance Unit */}
      <group position={[0, 0, 0]}>
        {/* Balance Main Body */}
        <mesh position={[0, 0.04, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.42, 0.08, 0.38]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Stainless Steel Weighing Pan */}
        <mesh position={[0, 0.085, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.01, 32]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
        </mesh>

        {/* Digital LED Display on Front */}
        <mesh position={[0, 0.045, 0.192]}>
          <planeGeometry args={[0.22, 0.05]} />
          <meshBasicMaterial color="#020617" />
        </mesh>
        <Text
          position={[0, 0.045, 0.194]}
          fontSize={0.035}
          color="#10b981"
          font="/fonts/inter.ttf"
          anchorX="center"
          anchorY="middle"
        >
          {`${massGrams.toFixed(2)} g`}
        </Text>
        <Text position={[0, 0.015, 0.194]} fontSize={0.018} color="#94a3b8" anchorX="center">
          ميزان حساس / قانون حفظ الكتلة
        </Text>
      </group>

      {/* 2. Glass Beaker (Sitting on balance pan) */}
      <group position={[0, 0.09, 0]}>
        {/* Glass Outer Wall */}
        <mesh position={[0, 0.15, 0]} castShadow>
          <cylinderGeometry args={[0.11, 0.11, 0.3, 32, 1, true]} />
          <meshPhysicalMaterial
            color="#ffffff"
            roughness={0.05}
            transmission={0.92}
            thickness={0.03}
            transparent
            opacity={0.35}
          />
        </mesh>

        {/* Glass Bottom */}
        <mesh position={[0, 0.005, 0]}>
          <cylinderGeometry args={[0.11, 0.11, 0.01, 32]} />
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
              <cylinderGeometry args={[0.106, 0.106, liquidHeight, 32]} />
              <meshStandardMaterial
                color={liquidColor}
                roughness={0.2}
                transparent
                opacity={0.85}
              />
            </mesh>
            {/* Top liquid surface meniscus */}
            <mesh position={[0, liquidHeight, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.106, 32]} />
              <meshStandardMaterial color={liquidColor} roughness={0.1} />
            </mesh>

            {/* Rising gas bubbles */}
            <GasBubbles isBubbling={isBubbling} />

            {/* Precipitate settling at bottom */}
            {hasPrecipitate && (
              <mesh position={[0, 0.01, 0]}>
                <cylinderGeometry args={[0.104, 0.104, 0.02, 32]} />
                <meshStandardMaterial color="#ffffff" roughness={0.8} />
              </mesh>
            )}
          </group>
        )}

        {/* Graduation Markings on Glass */}
        {[-0.04, 0, 0.04, 0.08].map((y, i) => (
          <mesh key={i} position={[0, 0.14 + y, 0.108]}>
            <planeGeometry args={[0.04, 0.004]} />
            <meshBasicMaterial color="#ffffff" opacity={0.6} transparent />
          </mesh>
        ))}
      </group>

      {/* 3. Submersible Digital Thermometer Probe */}
      <group position={[0.08, 0.09, 0.04]} rotation={[0, 0, -0.15]}>
        {/* Metal probe shaft dipped into liquid */}
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.32, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Digital gauge head */}
        <mesh position={[0, 0.34, 0]}>
          <boxGeometry args={[0.08, 0.05, 0.03]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <Text position={[0, 0.34, 0.017]} fontSize={0.022} color="#38bdf8" anchorX="center">
          {`${temperatureC.toFixed(1)}°C`}
        </Text>
      </group>

      {/* 4. Submersible pH Sensor Probe */}
      <group position={[-0.08, 0.09, 0.04]} rotation={[0, 0, 0.15]}>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.3, 16]} />
          <meshStandardMaterial color="#2563eb" roughness={0.3} />
        </mesh>
        {/* Glass bulb tip */}
        <mesh position={[0, 0.01, 0]}>
          <sphereGeometry args={[0.01, 16, 16]} />
          <meshStandardMaterial color="#93c5fd" transparent opacity={0.7} />
        </mesh>
        {/* Head display */}
        <mesh position={[0, 0.33, 0]}>
          <boxGeometry args={[0.08, 0.05, 0.03]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <Text position={[0, 0.33, 0.017]} fontSize={0.022} color="#a855f7" anchorX="center">
          {`pH ${ph.toFixed(1)}`}
        </Text>
      </group>
    </group>
  )
}

// 3D Reagent Erlenmeyer Flask with Pouring Tilt Animation
function ReagentFlask({
  position,
  color,
  label,
  isPouring,
  onPour,
}: {
  position: [number, number, number]
  color: string
  label: string
  isPouring: boolean
  onPour: () => void
}) {
  const flaskRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!flaskRef.current) return
    const targetZRot = isPouring ? Math.PI / 3.2 : 0
    flaskRef.current.rotation.z = THREE.MathUtils.lerp(flaskRef.current.rotation.z, targetZRot, delta * 6)
  })

  return (
    <group position={position} onClick={onPour}>
      <group ref={flaskRef}>
        {/* Flask conical body */}
        <mesh position={[0, 0.09, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.09, 0.18, 32]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transmission={0.9}
            thickness={0.03}
            roughness={0.1}
            transparent
            opacity={0.4}
          />
        </mesh>
        {/* Flask neck */}
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.08, 24]} />
          <meshPhysicalMaterial
            color="#ffffff"
            transmission={0.9}
            thickness={0.02}
            transparent
            opacity={0.4}
          />
        </mesh>
        {/* Liquid inside flask */}
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.028, 0.082, 0.11, 32]} />
          <meshStandardMaterial color={color} transparent opacity={0.8} />
        </mesh>
      </group>

      {/* Stream of poured liquid when tilted */}
      {isPouring && (
        <mesh position={[-0.12, 0.16, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.22, 8]} />
          <meshBasicMaterial color={color} transparent opacity={0.85} />
        </mesh>
      )}

      {/* Label and pour button indicator */}
      <Text position={[0, 0.3, 0]} fontSize={0.032} color="#f8fafc" anchorX="center">
        {label} (اضغط للسكب)
      </Text>
    </group>
  )
}

// 4 Guided Experiments for Reactions Lab
const REACTIONS_GUIDED_EXPERIMENTS: GuidedExperiment[] = [
  {
    id: "zn-acid-h2",
    title: "إحلال الخارصين في الحمض وتصاعد الهيدروجين",
    curriculumRef: "الكيمياء - متسلسلة النشاط الكيميائي وتفاعلات الإحلال البسيط",
    description: "تفاعل فلز الخارصين مع حمض الهيدروكلوريك وملاحظة انطلاق غاز الهيدروجين وتغير الحرارة.",
    steps: [
      {
        title: "إضافة الحمض إلى الخارصين",
        instruction: "اضغط على الدورق المخروطي (Reagent Flask) لسكب الحمض على حبيبات الخارصين في الكأس الزجاجي.",
        hint: "شاهد فوران المحلول وتصاعد فقاعات غاز الهيدروجين بسرعة نحو الأعلى.",
      },
      {
        title: "مراقبة التغير الحراري والميزان الحساس",
        instruction: "راقب قراءة الترمومتر الرقمي: التفاعل طارد للحرارة فترتفع درجة الحرارة، ونقصان طفيف في الميزان لهروب غاز الهيدروجين الخفيف.",
        hint: "في وعاء مفتوح: كتلة الوعاء تقل بمقدار كتلة الغاز المتطاير، لكن الكتلة الكلية للنظام المغلق تظل محفوظة.",
      },
    ],
    quiz: {
      question: "يحل الخارصين محل هيدروجين الحمض المخفف بينما لا يحل النحاس محله لأن:",
      options: [
        "الخارصين يسبق الهيدروجين في متسلسلة النشاط بينما النحاس يليه",
        "النحاس يتفاعل مع الماء فقط",
        "الخارصين فلز لا فلزي النزعة",
        "حمض الهيدروكلوريك يذيب جميع الفلزات دون استثناء",
      ],
      correctIndex: 0,
      explanation: "العناصر التي تسبق الهيدروجين في متسلسلة الجهود الكهربية تكون أكثر نشاطاً وأسهل أكسدة فتطرد الهيدروجين من محاليل أحماضه.",
    },
  },
  {
    id: "precipitation-mass-conservation",
    title: "تفاعل الترسيب والتحقق من قانون بقاء الكتلة",
    curriculumRef: "الكيمياء - تفاعلات الترسيب والاتزان الأيوني",
    description: "خلط نترات الفضة مع ملح الطعام لتكوين راسب أبيض من AgCl والتحقق من ثبوت الكتلة على الميزان.",
    steps: [
      {
        title: "خلط المحلولين معاً",
        instruction: "اسكب محلول نترات الفضة في الكأس المحتوي على كلوريد الصوديوم لمشاهدة تكون الراسب الأبيض.",
        hint: "يتكون راسب أبيض حليبي من كلوريد الفضة غير القابل للذوبان في الماء.",
      },
      {
        title: "التحقق من قراءة الميزان الرقمي",
        instruction: "لاحظ أن قراءة الميزان الحساس بقيت ثابتة تماماً بالملليجرام (180.50g)، مما يثبت قانون بقاء المادة.",
        hint: "مجموع كتل المواد المتفاعلة يساوي تماماً مجموع كتل المواد الناتجة لأن التفاعل لا يصاحبه تصاعد غازات.",
      },
    ],
    quiz: {
      question: "عند إضافة محلول نترات الفضة إلى محلول كلوريد الصوديوم، يتكون راسب أبيض من AgCl يتميز بأنه:",
      options: [
        "يذوب في محلول النشادر المركز (هيدروكسيد الأمونيوم)",
        "يذوب في الماء الساخن فقط",
        "لا يذوب في أي كاشف كيميائي إطلاقاً",
        "يتحول للون الأصفر عند إضافة حمض النيتريك",
      ],
      correctIndex: 0,
      explanation: "راسب كلوريد الفضة الأبيض يذوب بسهولة وسرعة في محلول النشادر المركز لتكوين متراكب فضة أمونياتي ذائب [Ag(NH3)2]+.",
    },
  },
  {
    id: "acid-base-titration",
    title: "معايرة حمض وقاعدة ودليل الفينولفثالين",
    curriculumRef: "الكيمياء - التحليل الحجمي وتفاعلات التعادل",
    description: "تعيين نقطة نهاية التفاعل (Endpoint) بين حمض قوي وقاعدة قوية باستخدام كاشف لوني حساس.",
    steps: [
      {
        title: "التنقيط التدريجي للقاعدة",
        instruction: "اضغط على قارورة القاعدة لتقطير هيدروكسيد الصوديوم داخل الكأس الحامضي المزود بقطرات الفينولفثالين.",
        hint: "يكون الفينولفثالين عديم اللون تماماً في الوسط الحامضي (pH < 7).",
      },
      {
        title: "الوصول لنقطة التعادل ونقطة النهاية",
        instruction: "شاهد كيف يقفز الـ pH فجأة عند استهلاك كل الحمض ويتحول المحلول إلى اللون الوردي القرمزي المضيء.",
        hint: "نقطة النهاية هي النقطة التي يتغير عندها لون الدليل مشيرة لانتهاء المعايرة.",
      },
    ],
    quiz: {
      question: "يصلح دليل الفينولفثالين في التمييز بين:",
      options: [
        "محلول حمضي ومحلول قاعدي",
        "محلول حمضي والماء النقي",
        "محلولين كلاهما قاعدي",
        "محلول كلوريد الأمونيوم والماء المقطر",
      ],
      correctIndex: 0,
      explanation: "الفينولفثالين عديم اللون في الوسط الحامضي والمتعادل، ويتحول إلى وردي في الوسط القاعدي، لذا يميز بوضوح بين الحمض والقاعدة.",
    },
  },
  {
    id: "caco3-burner-heat",
    title: "أثر الحرارة ولهب بنزن على تفكك الكربونات",
    curriculumRef: "الكيمياء - العوامل المؤثرة على سرعة التفاعل الكيميائي",
    description: "استخدام لهب بنزن لتسريع تفكك كربونات الكالسيوم وملاحظة فوران غاز CO₂.",
    steps: [
      {
        title: "إشعال لهب بنزن",
        instruction: "اضغط على لهب بنزن (Bunsen Burner) لإشعال الشعلة الزرقاء الفعالة لرفع حرارة التفاعل.",
        hint: "رفع درجة الحرارة يزيد من طاقة حركة الجزيئات وعدد التصادمات الفعالة متجاوزة طاقة التنشيط.",
      },
      {
        title: "إضافة الحمض ومشاهدة الفوران المضاعف",
        instruction: "اسكب الحمض على الكربونات وشاهد الفوران السريع وانطلاق فقاعات غاز ثاني أكسيد الكربون.",
        hint: "الغاز المتصاعد يعكر ماء الجير الرائق لتكوين كربونات الكالسيوم غير الذائبة لفترة قصيرة.",
      },
    ],
    quiz: {
      question: "رفع درجة حرارة وسط التفاعل يزيد من سرعة التفاعل الكيميائي بشكل رئيسي نتيجة:",
      options: [
        "زيادة نسبة الجزيئات التي تمتلك طاقة التنشيط أو تفوقها",
        "تقليل التركيز المولي للمتفاعلات",
        "تغيير نوع الروابط في المواد الناتجة",
        "زيادة حجم الوعاء التفاعلي",
      ],
      correctIndex: 0,
      explanation: "وفق نظرية التصادم: زيادة الحرارة ترفع الطاقة الحركية للجزيئات، فتزداد نسبة الجزيئات المنشطة التي تمتلك طاقة التنشيط اللازمة لبدء التفاعل.",
    },
  },
]

export function ReactionLab() {
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0)
  const [isBurnerOn, setIsBurnerOn] = useState(false)
  const [isPouring, setIsPouring] = useState(false)
  const [hasReacted, setHasReacted] = useState(false)

  // Guided Experiments HUD
  const [activeExpIndex, setActiveExpIndex] = useState(0)
  const [isSandbox, setIsSandbox] = useState(false)
  const [cameraResetSignal, setCameraResetSignal] = useState(0)

  const scenario = REACTION_SCENARIOS[selectedScenarioIndex]

  // Live dynamic values based on reaction progress
  const currentMass = hasReacted ? scenario.productsMass : scenario.reactantsMass
  const currentTemp = hasReacted ? scenario.finalTemp + (isBurnerOn ? 18 : 0) : scenario.initialTemp + (isBurnerOn ? 15 : 0)
  const currentPH = hasReacted ? scenario.finalPH : scenario.initialPH
  const currentLiquidColor = hasReacted ? scenario.finalColor : scenario.initialColor

  // Pour reagent handler
  const handlePour = () => {
    if (isPouring) return
    setIsPouring(true)
    labAudio.playPour()

    setTimeout(() => {
      setIsPouring(false)
      setHasReacted(true)
      if (scenario.gasType) {
        labAudio.playBubble()
      } else {
        labAudio.playClick(600)
      }
    }, 1200)
  }

  const handleToggleBurner = () => {
    setIsBurnerOn(!isBurnerOn)
    labAudio.playClick(isBurnerOn ? 400 : 850)
  }

  const handleResetLab = () => {
    setHasReacted(false)
    setIsPouring(false)
    setIsBurnerOn(false)
    setCameraResetSignal((prev) => prev + 1)
  }

  const handleSelectScenario = (idx: number) => {
    setSelectedScenarioIndex(idx)
    setHasReacted(false)
    setIsPouring(false)
    labAudio.playClick(700)
  }

  return (
    <div className="relative w-full h-full min-h-[480px]">
      <LabCanvas
        camera={{ position: [0, 2.2, 3.2], fov: 42 }}
        onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
      >
        <LabRoom cameraResetSignal={cameraResetSignal} defaultCameraPosition={[0, 2.2, 3.2]} defaultTarget={[0, 0.95, 0]}>
          {/* 1. Main Beaker on Analytical Balance */}
          <ReactionBeakerOnBalance
            position={[-0.2, 0.82, 0]}
            volumeMl={hasReacted ? 180 : 100}
            liquidColor={currentLiquidColor}
            isBubbling={hasReacted && Boolean(scenario.gasType)}
            hasPrecipitate={hasReacted && Boolean(scenario.hasPrecipitate)}
            massGrams={currentMass}
            temperatureC={currentTemp}
            ph={currentPH}
          />

          {/* 2. Reagent Erlenmeyer Flask */}
          <ReagentFlask
            position={[0.65, 0.82, 0.15]}
            color={scenario.initialColor}
            label="محلول المتفاعل"
            isPouring={isPouring}
            onPour={handlePour}
          />

          {/* 3. Bunsen Burner */}
          <BunsenBurner
            position={[-0.95, 0.82, -0.2]}
            isOn={isBurnerOn}
            onToggle={handleToggleBurner}
          />
        </LabRoom>
      </LabCanvas>

      {/* 2D Interactive HUD Overlay */}
      <LabHUD
        title="مختبر التفاعلات الكيميائية والمعادلات الموزونة"
        subjectTitle="الكيمياء الفيزيائية والتحليلية"
        curriculumGrade="الثانوية العامة"
        guidedExperiments={REACTIONS_GUIDED_EXPERIMENTS}
        activeExpIndex={activeExpIndex}
        onSelectExp={setActiveExpIndex}
        isSandbox={isSandbox}
        onToggleSandbox={setIsSandbox}
        onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
        onResetExperiment={handleResetLab}
      >
        {/* Live Balanced Equation Banner & Scenario Selector */}
        <div className="flex flex-col items-center gap-2 pointer-events-auto max-w-4xl mx-auto w-full px-2">
          {/* Reaction Equation Box */}
          <div className="glass px-4 py-2.5 rounded-2xl border border-emerald-500/30 bg-slate-950/80 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs text-slate-400 font-bold">المعادلة الموزونة:</span>
              <span className="text-xs md:text-sm font-mono font-black text-emerald-300">
                {scenario.equation}
              </span>
            </div>

            {/* Quick Action Button: Pour Reagent */}
            <button
              onClick={handlePour}
              disabled={isPouring}
              className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              <Droplet className="w-3.5 h-3.5" />
              <span>{hasReacted ? "إعادة سكب الكاشف" : "سكب المتفاعل وبدء التفاعل"}</span>
            </button>
          </div>

          {/* Instrument Dials Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 w-full text-xs">
            {/* Scenario selector */}
            <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5">
              <span className="text-slate-400 font-bold">التفاعل:</span>
              <select
                value={selectedScenarioIndex}
                onChange={(e) => handleSelectScenario(Number(e.target.value))}
                className="bg-black/50 text-xs font-bold text-white rounded-lg px-2 py-0.5 border border-white/10 focus:outline-none focus:border-primary cursor-pointer"
              >
                {REACTION_SCENARIOS.map((s, idx) => (
                  <option key={s.id} value={idx} className="bg-slate-900 text-white">
                    {s.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Readings */}
            <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">الكتلة:</span>
                <span className="font-mono font-bold text-white">{currentMass.toFixed(2)} g</span>
              </div>
              <div className="w-[1px] h-3 bg-white/10" />
              <div className="flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400">الحرارة:</span>
                <span className="font-mono font-bold text-amber-300">{currentTemp.toFixed(1)}°C</span>
              </div>
              <div className="w-[1px] h-3 bg-white/10" />
              <div className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-slate-400">الرقم الهيدروجيني:</span>
                <span className="font-mono font-bold text-purple-300">pH {currentPH.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      </LabHUD>
    </div>
  )
}
