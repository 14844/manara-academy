"use client"

import React, { useState, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Float } from "@react-three/drei"
import { LabCanvas, LabRoom, LabHUD, GuidedExperiment, labAudio, useLabLanguage, BillboardLabel, QualityProvider, LanguageProvider } from "./3d"
import { Layers, Eye, Sparkles, Award, Atom, Check, Info } from "lucide-react"

export type AtomElement = "H" | "C" | "O" | "N" | "Cl" | "S"

interface AtomData {
  element: AtomElement
  nameAr: string
  nameEn: string
  color: string
  radiusStick: number
  radiusSpace: number
  valence: number
  mass: number
}

const ELEMENT_SPECS: Record<AtomElement, AtomData> = {
  H: { element: "H", nameAr: "هيدروجين", nameEn: "Hydrogen", color: "#f8fafc", radiusStick: 0.11, radiusSpace: 0.22, valence: 1, mass: 1.008 },
  C: { element: "C", nameAr: "كربون", nameEn: "Carbon", color: "#334155", radiusStick: 0.19, radiusSpace: 0.38, valence: 4, mass: 12.011 },
  O: { element: "O", nameAr: "أكسجين", nameEn: "Oxygen", color: "#ef4444", radiusStick: 0.17, radiusSpace: 0.34, valence: 2, mass: 15.999 },
  N: { element: "N", nameAr: "نيتروجين", nameEn: "Nitrogen", color: "#2563eb", radiusStick: 0.18, radiusSpace: 0.36, valence: 3, mass: 14.007 },
  Cl: { element: "Cl", nameAr: "كلور", nameEn: "Chlorine", color: "#10b981", radiusStick: 0.21, radiusSpace: 0.40, valence: 1, mass: 35.45 },
  S: { element: "S", nameAr: "كبريت", nameEn: "Sulfur", color: "#eab308", radiusStick: 0.22, radiusSpace: 0.42, valence: 2, mass: 32.06 },
}

interface MoleculePreset {
  id: string
  nameAr: string
  iupac: string
  formula: string
  geometryAr: string
  bondAngle: string
  polarity: "قطبي" | "غير قطبي"
  functionalGroup?: string
  atoms: { id: string; element: AtomElement; pos: [number, number, number] }[]
  bonds: { from: string; to: string; order: 1 | 2 | 3 }[]
}

const PRESET_MOLECULES: MoleculePreset[] = [
  {
    id: "h2o",
    nameAr: "الماء (أكسيد الهيدروجين)",
    iupac: "Oxidane (Water)",
    formula: "H₂O",
    geometryAr: "زاوي (Bent) بسبب زوجين حرين",
    bondAngle: "104.5°",
    polarity: "قطبي",
    functionalGroup: "مركب غير عضوي (مذيب قطبي)",
    atoms: [
      { id: "o", element: "O", pos: [0, 0, 0] },
      { id: "h1", element: "H", pos: [-0.46, -0.32, 0] },
      { id: "h2", element: "H", pos: [0.46, -0.32, 0] },
    ],
    bonds: [
      { from: "o", to: "h1", order: 1 },
      { from: "o", to: "h2", order: 1 },
    ],
  },
  {
    id: "co2",
    nameAr: "ثاني أكسيد الكربون",
    iupac: "Carbon Dioxide",
    formula: "CO₂",
    geometryAr: "خطي (Linear) تهجين sp",
    bondAngle: "180°",
    polarity: "غير قطبي",
    functionalGroup: "أكسيد لا فلزي غير قطبي",
    atoms: [
      { id: "c", element: "C", pos: [0, 0, 0] },
      { id: "o1", element: "O", pos: [-0.68, 0, 0] },
      { id: "o2", element: "O", pos: [0.68, 0, 0] },
    ],
    bonds: [
      { from: "c", to: "o1", order: 2 },
      { from: "c", to: "o2", order: 2 },
    ],
  },
  {
    id: "nh3",
    nameAr: "الأمونيا (النشادر)",
    iupac: "Azane (Ammonia)",
    formula: "NH₃",
    geometryAr: "هرم ثلاثي القاعدة (Trigonal Pyramidal)",
    bondAngle: "107.3°",
    polarity: "قطبي",
    functionalGroup: "قاعدة لويس غير عضوية",
    atoms: [
      { id: "n", element: "N", pos: [0, 0.15, 0] },
      { id: "h1", element: "H", pos: [-0.42, -0.18, 0.25] },
      { id: "h2", element: "H", pos: [0.42, -0.18, 0.25] },
      { id: "h3", element: "H", pos: [0, -0.18, -0.45] },
    ],
    bonds: [
      { from: "n", to: "h1", order: 1 },
      { from: "n", to: "h2", order: 1 },
      { from: "n", to: "h3", order: 1 },
    ],
  },
  {
    id: "ch4",
    nameAr: "الميثان (غاز المستنقعات)",
    iupac: "Methane",
    formula: "CH₄",
    geometryAr: "رباعي الأوجه منتظم (Tetrahedral) تهجين sp³",
    bondAngle: "109.5°",
    polarity: "غير قطبي",
    functionalGroup: "ألكان (هيدروكربون مشبع)",
    atoms: [
      { id: "c", element: "C", pos: [0, 0, 0] },
      { id: "h1", element: "H", pos: [0, 0.58, 0] },
      { id: "h2", element: "H", pos: [0.55, -0.19, 0] },
      { id: "h3", element: "H", pos: [-0.27, -0.19, 0.48] },
      { id: "h4", element: "H", pos: [-0.27, -0.19, -0.48] },
    ],
    bonds: [
      { from: "c", to: "h1", order: 1 },
      { from: "c", to: "h2", order: 1 },
      { from: "c", to: "h3", order: 1 },
      { from: "c", to: "h4", order: 1 },
    ],
  },
  {
    id: "c2h4",
    nameAr: "الإيثين (الإيثيلين)",
    iupac: "Ethene",
    formula: "C₂H₄",
    geometryAr: "مستوٍ مثلثي (Planar) تهجين sp² برابطة ثنائية",
    bondAngle: "121.3°",
    polarity: "غير قطبي",
    functionalGroup: "ألكين (هيدروكربون غير مشبع)",
    atoms: [
      { id: "c1", element: "C", pos: [-0.38, 0, 0] },
      { id: "c2", element: "C", pos: [0.38, 0, 0] },
      { id: "h1", element: "H", pos: [-0.78, 0.42, 0] },
      { id: "h2", element: "H", pos: [-0.78, -0.42, 0] },
      { id: "h3", element: "H", pos: [0.78, 0.42, 0] },
      { id: "h4", element: "H", pos: [0.78, -0.42, 0] },
    ],
    bonds: [
      { from: "c1", to: "c2", order: 2 },
      { from: "c1", to: "h1", order: 1 },
      { from: "c1", to: "h2", order: 1 },
      { from: "c2", to: "h3", order: 1 },
      { from: "c2", to: "h4", order: 1 },
    ],
  },
  {
    id: "ethanol",
    nameAr: "الإيثانول (كحول إيثيلي)",
    iupac: "Ethanol",
    formula: "C₂H₅OH",
    geometryAr: "سلسلة كربونية مع مجموعة هيدروكسيل زاوية",
    bondAngle: "109° (C), 104.5° (O)",
    polarity: "قطبي",
    functionalGroup: "كحول أحادي الهيدروكسيل (-OH)",
    atoms: [
      { id: "c1", element: "C", pos: [-0.62, 0, 0] },
      { id: "c2", element: "C", pos: [0.12, 0, 0] },
      { id: "o", element: "O", pos: [0.65, 0.38, 0] },
      { id: "ho", element: "H", pos: [1.12, 0.22, 0] },
      { id: "h1", element: "H", pos: [-0.98, 0.45, 0] },
      { id: "h2", element: "H", pos: [-0.98, -0.45, 0] },
      { id: "h3", element: "H", pos: [-0.62, 0, 0.52] },
      { id: "h4", element: "H", pos: [0.12, -0.52, 0.32] },
      { id: "h5", element: "H", pos: [0.12, -0.52, -0.32] },
    ],
    bonds: [
      { from: "c1", to: "c2", order: 1 },
      { from: "c2", to: "o", order: 1 },
      { from: "o", to: "ho", order: 1 },
      { from: "c1", to: "h1", order: 1 },
      { from: "c1", to: "h2", order: 1 },
      { from: "c1", to: "h3", order: 1 },
      { from: "c2", to: "h4", order: 1 },
      { from: "c2", to: "h5", order: 1 },
    ],
  },
  {
    id: "acetic_acid",
    nameAr: "حمض الخليك (الإيثانويك)",
    iupac: "Ethanoic Acid",
    formula: "CH₃COOH",
    geometryAr: "كربوكسيلي (كربونيل مستوٍ C=O + هيدروكسيل C-OH)",
    bondAngle: "120° (C=O), 109° (CH3)",
    polarity: "قطبي",
    functionalGroup: "حمض كربوكسيلي عضوي (-COOH)",
    atoms: [
      { id: "c1", element: "C", pos: [-0.55, 0, 0] },
      { id: "c2", element: "C", pos: [0.22, 0, 0] },
      { id: "o_double", element: "O", pos: [0.62, 0.52, 0] },
      { id: "o_single", element: "O", pos: [0.65, -0.48, 0] },
      { id: "h_acid", element: "H", pos: [1.15, -0.38, 0] },
      { id: "h1", element: "H", pos: [-0.92, 0.45, 0] },
      { id: "h2", element: "H", pos: [-0.92, -0.45, 0] },
      { id: "h3", element: "H", pos: [-0.55, 0, 0.52] },
    ],
    bonds: [
      { from: "c1", to: "c2", order: 1 },
      { from: "c2", to: "o_double", order: 2 },
      { from: "c2", to: "o_single", order: 1 },
      { from: "o_single", to: "h_acid", order: 1 },
      { from: "c1", to: "h1", order: 1 },
      { from: "c1", to: "h2", order: 1 },
      { from: "c1", to: "h3", order: 1 },
    ],
  },
]

// 3D Bond Cylinder (Single, Double, or Triple)
function BondMesh({
  start,
  end,
  order = 1,
  viewMode,
}: {
  start: [number, number, number]
  end: [number, number, number]
  order: 1 | 2 | 3
  viewMode: "stick" | "space"
}) {
  if (viewMode === "space") return null // space-filling mode shows direct overlapping atom spheres

  const p1 = new THREE.Vector3(...start)
  const p2 = new THREE.Vector3(...end)
  const distance = p1.distanceTo(p2)
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)

  // Compute orientation
  const dir = new THREE.Vector3().subVectors(p2, p1).normalize()
  const up = new THREE.Vector3(0, 1, 0)
  const quat = new THREE.Quaternion().setFromUnitVectors(up, dir)

  // Normal vector perpendicular to bond for offset double/triple bonds
  const normal = new THREE.Vector3(0, 0, 1).cross(dir).normalize()
  if (normal.lengthSq() < 0.001) {
    normal.set(1, 0, 0).cross(dir).normalize()
  }

  const radius = 0.03

  if (order === 1) {
    return (
      <group position={mid} quaternion={quat}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[radius, radius, distance, 16]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.2} />
        </mesh>
      </group>
    )
  }

  if (order === 2) {
    const offset = 0.04
    const pA = mid.clone().addScaledVector(normal, offset)
    const pB = mid.clone().addScaledVector(normal, -offset)
    return (
      <group>
        <mesh position={pA} quaternion={quat} castShadow>
          <cylinderGeometry args={[radius * 0.8, radius * 0.8, distance, 16]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.3} />
        </mesh>
        <mesh position={pB} quaternion={quat} castShadow>
          <cylinderGeometry args={[radius * 0.8, radius * 0.8, distance, 16]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.3} />
        </mesh>
      </group>
    )
  }

  // Triple bond
  const offset = 0.05
  const perp2 = new THREE.Vector3().crossVectors(dir, normal).normalize()
  return (
    <group>
      <mesh position={mid} quaternion={quat} castShadow>
        <cylinderGeometry args={[radius * 0.7, radius * 0.7, distance, 16]} />
        <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={mid.clone().addScaledVector(normal, offset)} quaternion={quat} castShadow>
        <cylinderGeometry args={[radius * 0.7, radius * 0.7, distance, 16]} />
        <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={mid.clone().addScaledVector(normal, -offset)} quaternion={quat} castShadow>
        <cylinderGeometry args={[radius * 0.7, radius * 0.7, distance, 16]} />
        <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.4} />
      </mesh>
    </group>
  )
}

// 3D Atom Sphere
function AtomSphere({
  element,
  position,
  viewMode,
  isHovered,
  onPointerOver,
  onPointerOut,
}: {
  element: AtomElement
  position: [number, number, number]
  viewMode: "stick" | "space"
  isHovered: boolean
  onPointerOver?: () => void
  onPointerOut?: () => void
}) {
  const spec = ELEMENT_SPECS[element]
  const radius = viewMode === "stick" ? spec.radiusStick : spec.radiusSpace

  return (
    <group position={position} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshStandardMaterial
          color={spec.color}
          roughness={viewMode === "stick" ? 0.2 : 0.4}
          metalness={0.1}
          emissive={isHovered ? spec.color : "#000000"}
          emissiveIntensity={isHovered ? 0.4 : 0}
        />
      </mesh>

      {/* Floating element symbol in ball-and-stick view */}
      {viewMode === "stick" && (
        <BillboardLabel
          position={[0, radius + 0.08, 0]}
          text={element}
          color={spec.color === "#f8fafc" ? "#94a3b8" : spec.color}
          bgColor="rgba(15, 23, 42, 0.75)"
          scale={[0.16, 0.06, 1]}
          fontSize={18}
        />
      )}
    </group>
  )
}

// Reagent Atom Stand on the Lab Bench
function AtomReagentTray({ onSelectAtom }: { onSelectAtom: (el: AtomElement) => void }) {
  const elements: AtomElement[] = ["H", "C", "O", "N", "Cl"]

  return (
    <group position={[0, 0.82, -0.6]}>
      {/* Acrylic tray base */}
      <mesh receiveShadow position={[0, 0.02, 0]}>
        <boxGeometry args={[1.5, 0.04, 0.35]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.5} />
      </mesh>

      {/* Element sample slots */}
      {elements.map((el, i) => {
        const x = -0.55 + i * 0.28
        const spec = ELEMENT_SPECS[el]
        return (
          <group
            key={el}
            position={[x, 0.08, 0]}
            onClick={(e) => {
              e.stopPropagation()
              onSelectAtom(el)
              labAudio.playSnap()
            }}
          >
            {/* Recessed well ring */}
            <mesh position={[0, -0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.07, 0.09, 24]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            {/* Showcase atom */}
            <mesh castShadow>
              <sphereGeometry args={[0.065, 24, 24]} />
              <meshStandardMaterial color={spec.color} roughness={0.25} />
            </mesh>
            {/* Label */}
            <BillboardLabel
              position={[0, 0.1, 0]}
              text={`${spec.element} (${spec.nameAr})`}
              color="#f8fafc"
              bgColor="rgba(15, 23, 42, 0.85)"
              scale={[0.22, 0.06, 1]}
              fontSize={16}
            />
          </group>
        )
      })}
    </group>
  )
}

// 4 Guided Experiments for Molecules Lab
const MOLECULES_GUIDED_EXPERIMENTS: GuidedExperiment[] = [
  {
    id: "vsepr-water-co2",
    title: "هندسة الجزيئات ونظرية VSEPR (الماء مقابل CO₂)",
    curriculumRef: "الكيمياء - الباب الثالث: الروابط الكيميائية والأشكال الفراغية",
    description: "قارن بين شكل جزيء الماء الزاوي وشكل جزيء ثاني أكسيد الكربون الخطي وتأثير أزواج الإلكترونات الحرة.",
    steps: [
      {
        title: "اختر جزيء الماء (H₂O)",
        instruction: "لاحظ الرابطتين الأحاديين وشكل الجزيء الزاوي بزاوية 104.5° نتيجة تنافر الزوجين الحرين على ذرة الأكسجين.",
        hint: "الأزواج الحرة تشغل حيزاً فراغياً أكبر فتضغط على الروابط وتقلل الزاوية عن 109.5°.",
      },
      {
        title: "انتقل إلى ثاني أكسيد الكربون (CO₂)",
        instruction: "اختر جزيء CO₂ من القائمة: لاحظ الشكل الخطي المستقيم 180° نتيجة عدم وجود أزواج حرة على ذرة الكربون المركزية.",
        hint: "الرابطتان الثنائيتان تكونان في أقصى تباعد فراغي (180 درجة) لتقليل قوى التنافر لأدنى حد.",
      },
    ],
    quiz: {
      question: "الزاوية بين الروابط في جزيء الماء (104.5°) أقل من الزاوية في جزيء الميثان (109.5°) بسبب:",
      options: [
        "وجود زوجين من الإلكترونات الحرة على ذرة الأكسجين",
        "كبر حجم ذرة الأكسجين مقارنة بالكربون",
        "قوة الرابطة الهيدروجينية داخل الجزيء",
        "اختلاف نوع التهجين sp عن sp³",
      ],
      correctIndex: 0,
      explanation: "تنافر (زوج حر - زوج حر) و(زوج حر - زوج رابط) أكبر من تنافر (زوج رابط - زوج رابط)، مما يضغط الروابط التساهمية ويقلل الزاوية إلى 104.5°.",
    },
  },
  {
    id: "hybridization-shapes",
    title: "التهجين والأشكال الفراغية (الميثان والإيثين)",
    curriculumRef: "الكيمياء - التهجين في ذرة الكربون (sp³, sp², sp)",
    description: "استكشف كيف يحدد نوع التهجين الشكل الفراغي للمركبات الهيدروكربونية وزواياها.",
    steps: [
      {
        title: "جزيء الميثان (CH₄) وتهجين sp³",
        instruction: "استعرض جزيء الميثان: يحتوي على 4 أوربيتالات مهجنة متكافئة من نوع sp³ موجهة نحو رؤوس هرم رباعي الأوجه 109.5°.",
        hint: "جميع الروابط في الميثان من النوع سيجما (σ) القوية صعبة الكسر المتكونة بالتداخل الرأسي.",
      },
      {
        title: "جزيء الإيثين (C₂H₄) وتهجين sp²",
        instruction: "اختر الإيثين: لاحظ الرابطة المزدوجة بين ذرتي الكربون المكونة من رابطة سيجما (σ) ورابطة باي (π) الضعيفة، وزاوية 120°.",
        hint: "تداخل الأوربيتالات بالتوازي يكوّن رابطة باي الأسهل في الكسر، مما يجعل الإيثين نشطاً كيميائياً.",
      },
    ],
    quiz: {
      question: "نوع التهجين في ذرتي الكربون بجزيء الإيثين (C₂H₄) والشكل الفراغي الناتج هو:",
      options: [
        "تهجين sp² ومستوٍ مثلثي (زاوية 120°)",
        "تهجين sp³ وهرم رباعي الأوجه (زاوية 109.5°)",
        "تهجين sp وشكل خطي (زاوية 180°)",
        "تهجين dsp² وشكل مربع مستوٍ",
      ],
      correctIndex: 0,
      explanation: "في الإيثين تتحد أوربيتال 2s مع أوربيتالين 2p لإنتاج 3 أوربيتالات مهجنة sp² بزوايا 120° لتقليل التنافر في المستوى الأفقي.",
    },
  },
  {
    id: "organic-functional-groups",
    title: "الكيمياء العضوية: المجموعات الوظيفية (الكحولات والأحماض)",
    curriculumRef: "الكيمياء العضوية - مشتقات الهيدروكربونات",
    description: "التعرف على مجموعة الهيدروكسيل (-OH) ومجموعة الكربوكسيل (-COOH) وتأثيرهما على الخواص.",
    steps: [
      {
        title: "فحص جزيء الإيثانول (C₂H₅OH)",
        instruction: "اختر الإيثانول: ميّز مجموعة الهيدروكسيل (-OH) القطبية المرتبطة بشق الإيثيل، والتي تمنحه قابلية الامتزاج بالماء وتكوين روابط هيدروجينية.",
        hint: "تمنح مجموعة الهيدروكسيل الكحول درجات غليان أعلى مقارنة بالألكانات المماثلة في الكتلة.",
      },
      {
        title: "فحص حمض الخليك (CH₃COOH)",
        instruction: "اختر حمض الخليك: لاحظ مجموعة الكربوكسيل المركبة من كربونيل (C=O) وهيدروكسيل (-OH) مع هيدروجين بدول.",
        hint: "تأثير مجموعة الكربونيل الساحبة للإلكترونات يضعف الرابطة بين O و H فيسهل انفصال بروتون الهيدروجين الحامضي.",
      },
    ],
    quiz: {
      question: "تتكون مجموعة الكربوكسيل المميزة للأحماض العضوية من اتحاد مجموعتين هما:",
      options: [
        "مجموعة الكربونيل (C=O) ومجموعة الهيدروكسيل (-OH)",
        "مجموعة الأمينو (-NH₂) ومجموعة الألكيل (-R)",
        "مجموعة الإيثر (-O-) ومجموعة الإستر (-COO-)",
        "مجموعة الألدهيد (-CHO) ومجموعة الكيتون (C=O)",
      ],
      correctIndex: 0,
      explanation: "اسم 'كربوكسيل' منحوت من (كربونيل + هيدروكسيل)، حيث ترتبط مجموعة الهيدروكسيل مباشرة بذرة كربون مجموعة الكربونيل.",
    },
  },
  {
    id: "polarity-dipole",
    title: "قطبية الجزيئات وعزم الازدواج القطبي",
    curriculumRef: "الكيمياء - الرابطة التساهمية القطبية والعزم ثنائي القطب",
    description: "لماذا يعد جزيء الماء قطبياً بينما ثاني أكسيد الكربون غير قطبي رغم قطبية روابطه؟",
    steps: [
      {
        title: "محصلة العزم القطبي في CO₂",
        instruction: "في CO₂، الرابطتان C=O قطبيتان، ولكن بما أن الجزيء خطي، فإن عزمي الرابطتين متساويان في المقدار ومتعاكسان في الاتجاه، فيلغي كل منهما الآخر (μ = 0).",
        hint: "الشكل الفراغي المتماثل يلغي القطبية الكلية للجزيء.",
      },
      {
        title: "محصلة العزم القطبي في H₂O",
        instruction: "في الماء، الجزيء زاوي (104.5°)، لذلك لا تلغي الرابطتان بعضهما، بل تكون لهما محصلة عزم قطبي قوية تتجه نحو الأكسجين الأكثر سالبية.",
        hint: "هذه القطبية تجعل الماء مذيباً عاماً للمركبات الأيونية والقطبية.",
      },
    ],
    quiz: {
      question: "جزيء ثاني أكسيد الكربون (CO₂) غير قطبي بالرغم من احتوائه على روابط تساهمية قطبية لأن:",
      options: [
        "شكله الفراغي الخطي يجعل محصلة عزم الازدواج القطبي تساوي صفراً",
        "فرق السالبية الكهربية بين الكربون والأكسجين معدوم",
        "الرابطة الثنائية دائماً غير قطبية",
        "الأكسجين يكتسب إلكترونات الكربون بالكامل مكوناً رابطة أيونية",
      ],
      correctIndex: 0,
      explanation: "الشكل الخطي (180°) يؤدي إلى أن عزم الرابطة الأولى يلغي عزم الرابطة الثانية في الاتجاه المقابل، فتكون المحصلة المتجهة للعزم ثنائي القطب صفر.",
    },
  },
]

export function MoleculeLab() {
  const [selectedMoleculeIndex, setSelectedMoleculeIndex] = useState(0)
  const [viewMode, setViewMode] = useState<"stick" | "space">("stick")
  const [isRotating, setIsRotating] = useState(true)
  const [hoveredAtomId, setHoveredAtomId] = useState<string | null>(null)

  // Guided Experiments HUD
  const [activeExpIndex, setActiveExpIndex] = useState(0)
  const [isSandbox, setIsSandbox] = useState(false)
  const [cameraResetSignal, setCameraResetSignal] = useState(0)

  const currentMolecule = PRESET_MOLECULES[selectedMoleculeIndex]

  // Molecular weight calculation
  const molecularWeight = useMemo(() => {
    return currentMolecule.atoms
      .reduce((acc, atom) => acc + ELEMENT_SPECS[atom.element].mass, 0)
      .toFixed(2)
  }, [currentMolecule])

  // Continuous gentle rotation of the molecule in scene
  const moleculeGroupRef = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (moleculeGroupRef.current && isRotating) {
      moleculeGroupRef.current.rotation.y += delta * 0.45
    }
  })

  const handleSelectPreset = (idx: number) => {
    setSelectedMoleculeIndex(idx)
    labAudio.playSnap()
  }

  const handleResetLab = () => {
    setSelectedMoleculeIndex(0)
    setViewMode("stick")
    setIsRotating(true)
    setCameraResetSignal((prev) => prev + 1)
  }

  const { lang, t, isAr } = useLabLanguage()

  return (
    <QualityProvider>
      <LanguageProvider>
        <div className="relative w-full h-full min-h-[480px] flex-1">
          <LabCanvas
            camera={{ position: [0, 2.0, 2.8], fov: 42, far: 100 }}
            onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
          >
        <LabRoom cameraResetSignal={cameraResetSignal} defaultCameraPosition={[0, 2.0, 2.8]} defaultTarget={[0, 1.25, 0]}>
          {/* Main 3D Molecule Displayed Floating Above Table */}
          <group position={[0, 1.25, 0]}>
            <group ref={moleculeGroupRef}>
              {/* Bonds */}
              {currentMolecule.bonds.map((bond, idx) => {
                const atom1 = currentMolecule.atoms.find((a) => a.id === bond.from)
                const atom2 = currentMolecule.atoms.find((a) => a.id === bond.to)
                if (!atom1 || !atom2) return null
                return (
                  <BondMesh
                    key={idx}
                    start={atom1.pos}
                    end={atom2.pos}
                    order={bond.order}
                    viewMode={viewMode}
                  />
                )
              })}

              {/* Atoms */}
              {currentMolecule.atoms.map((atom) => (
                <AtomSphere
                  key={atom.id}
                  element={atom.element}
                  position={atom.pos}
                  viewMode={viewMode}
                  isHovered={hoveredAtomId === atom.id}
                  onPointerOver={() => setHoveredAtomId(atom.id)}
                  onPointerOut={() => setHoveredAtomId(null)}
                />
              ))}
            </group>
          </group>

          {/* Reagent Tray of Atoms on Bench Tabletop */}
          <AtomReagentTray
            onSelectAtom={(el) => {
              const matchIdx = PRESET_MOLECULES.findIndex((m) => m.atoms.some((a) => a.element === el))
              if (matchIdx !== -1) {
                setSelectedMoleculeIndex(matchIdx)
              }
            }}
          />
        </LabRoom>
      </LabCanvas>

      {/* 2D Interactive HUD Overlay */}
      <LabHUD
        title="مختبر بناء الجزيئات والروابط ثلاثي الأبعاد"
        titleEn="3D Molecule Construction & VSEPR Laboratory"
        subjectTitle="الكيمياء الفراغية والعضوية"
        subjectTitleEn="Stereochemistry & Organic Chemistry"
        curriculumGrade="الثانوية العامة"
        curriculumGradeEn="Secondary Chemistry"
        guidedExperiments={MOLECULES_GUIDED_EXPERIMENTS}
        activeExpIndex={activeExpIndex}
        onSelectExp={setActiveExpIndex}
        isSandbox={isSandbox}
        onToggleSandbox={setIsSandbox}
        onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
        onResetExperiment={handleResetLab}
      >
        {/* Molecule Information Card & Selector */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pointer-events-auto max-w-4xl mx-auto w-full px-2">
          {/* Compound Selector Dropdown */}
          <div className="glass px-3.5 py-2 rounded-xl border border-white/10 flex items-center gap-2 shadow-lg">
            <Atom className="w-4 h-4 text-emerald-400" />
            <select
              value={selectedMoleculeIndex}
              onChange={(e) => handleSelectPreset(Number(e.target.value))}
              className="bg-black/50 text-xs md:text-sm font-bold text-white rounded-lg px-2.5 py-1 border border-white/10 focus:outline-none focus:border-primary cursor-pointer"
            >
              {PRESET_MOLECULES.map((m, idx) => (
                <option key={m.id} value={idx} className="bg-slate-900 text-white">
                  {isAr ? m.nameAr : m.iupac} ({m.formula})
                </option>
              ))}
            </select>
          </div>

          {/* View Mode & Rotation Controls */}
          <div className="flex items-center gap-2 glass p-1.5 rounded-xl border border-white/10 shadow-lg">
            {/* Ball-and-Stick vs Space-Filling */}
            <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5 text-xs">
              <button
                onClick={() => {
                  setViewMode("stick")
                  labAudio.playClick()
                }}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  viewMode === "stick" ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {t("كرة وعصا", "Ball & Stick")}
              </button>
              <button
                onClick={() => {
                  setViewMode("space")
                  labAudio.playClick()
                }}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                  viewMode === "space" ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {t("ملء الفراغ", "Space-Filling")}
              </button>
            </div>

            <div className="w-[1px] h-4 bg-white/10" />

            {/* Rotation toggle */}
            <button
              onClick={() => setIsRotating(!isRotating)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border border-white/10 transition-colors ${
                isRotating ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-slate-400"
              }`}
            >
              {isRotating ? t("دوران نشط", "Auto-Rotate ON") : t("إيقاف الدوران", "Rotate OFF")}
            </button>
          </div>

          {/* Scientific Info Badges */}
          <div className="glass px-3.5 py-1.5 rounded-xl border border-white/10 flex items-center gap-3 text-xs shadow-lg">
            <div>
              <span className="text-slate-400">{t("الشكل:", "Geometry:")} </span>
              <span className="font-bold text-blue-300">{currentMolecule.geometryAr}</span>
            </div>
            <div className="w-[1px] h-3 bg-white/10" />
            <div>
              <span className="text-slate-400">{t("الزاوية:", "Angle:")} </span>
              <span className="font-mono font-bold text-amber-300">{currentMolecule.bondAngle}</span>
            </div>
            <div className="w-[1px] h-3 bg-white/10" />
            <div>
              <span className="text-slate-400">{t("الكتلة:", "Mass:")} </span>
              <span className="font-mono font-bold text-emerald-300">{molecularWeight} g/mol</span>
            </div>
          </div>
        </div>
      </LabHUD>
        </div>
      </LanguageProvider>
    </QualityProvider>
  )
}
