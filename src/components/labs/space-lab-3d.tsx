"use client"

import React, { useState, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Text, OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import { LabCanvas, LabHUD, GuidedExperiment, labAudio, useQuality } from "./3d"
import {
  Globe2,
  Compass,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Sparkles,
  Award,
  Layers,
  Scale,
  Moon,
  Sun,
  Eye,
  Info,
  ChevronLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface PlanetData {
  id: string
  nameAr: string
  nameEn: string
  color: string
  ringColor?: string
  hasRings?: boolean
  radiusVisual: number
  radiusReal: number
  distanceVisual: number
  distanceReal: number
  orbitPeriodDays: number
  rotationPeriodHours: number
  axialTiltDeg: number
  gravityMps2: number
  massKg: string
  massEarthRelative: number
  radiusKm: number
  surfaceTempC: string
  moonsCount: number
  descriptionAr: string
}

const PLANETS_DATABASE: PlanetData[] = [
  {
    id: "mercury",
    nameAr: "عطارد",
    nameEn: "Mercury",
    color: "#a3a3a3",
    radiusVisual: 0.16,
    radiusReal: 0.08,
    distanceVisual: 2.2,
    distanceReal: 1.8,
    orbitPeriodDays: 88,
    rotationPeriodHours: 1407.6,
    axialTiltDeg: 0.034,
    gravityMps2: 3.7,
    massKg: "3.30 × 10²³",
    massEarthRelative: 0.055,
    radiusKm: 2439.7,
    surfaceTempC: "-180 إلى 430",
    moonsCount: 0,
    descriptionAr: "أصغر كواكب المجموعة الشمسية وأقربها إلى الشمس، سطحه مليء بالفوهات البركانية ولا يمتلك غلافاً جوياً يحميه.",
  },
  {
    id: "venus",
    nameAr: "الزهرة",
    nameEn: "Venus",
    color: "#eab308",
    radiusVisual: 0.28,
    radiusReal: 0.18,
    distanceVisual: 3.2,
    distanceReal: 2.6,
    orbitPeriodDays: 224.7,
    rotationPeriodHours: -5832.5, // retrograde
    axialTiltDeg: 177.3,
    gravityMps2: 8.87,
    massKg: "4.87 × 10²⁴",
    massEarthRelative: 0.815,
    radiusKm: 6051.8,
    surfaceTempC: "465 (أشد الكواكب حرارة)",
    moonsCount: 0,
    descriptionAr: "توأم الأرض من حيث الحجم، لكنه مغطى بسحب حمض الكبريتيك الكثيفة التي تسبب احتباساً حرارياً هائلاً، ويدور في اتجاه معاكس لبقية الكواكب.",
  },
  {
    id: "earth",
    nameAr: "الأرض",
    nameEn: "Earth",
    color: "#38bdf8",
    radiusVisual: 0.3,
    radiusReal: 0.19,
    distanceVisual: 4.3,
    distanceReal: 3.5,
    orbitPeriodDays: 365.25,
    rotationPeriodHours: 24.0,
    axialTiltDeg: 23.44,
    gravityMps2: 9.81,
    massKg: "5.97 × 10²⁴",
    massEarthRelative: 1.0,
    radiusKm: 6371.0,
    surfaceTempC: "15",
    moonsCount: 1,
    descriptionAr: "كوكب الحياة الوحيد المعروف، يتميز بوجود الماء السائل وغلاف جوي غني بالأكسجين ومجال مغناطيسي يحميه من الرياح الشمسية.",
  },
  {
    id: "mars",
    nameAr: "المريخ (الكوكب الأحمر)",
    nameEn: "Mars",
    color: "#ef4444",
    radiusVisual: 0.2,
    radiusReal: 0.11,
    distanceVisual: 5.6,
    distanceReal: 4.8,
    orbitPeriodDays: 687.0,
    rotationPeriodHours: 24.6,
    axialTiltDeg: 25.19,
    gravityMps2: 3.72,
    massKg: "6.42 × 10²³",
    massEarthRelative: 0.107,
    radiusKm: 3389.5,
    surfaceTempC: "-63",
    moonsCount: 2,
    descriptionAr: "الكوكب الأحمر لاحتواء تربته على صدأ الحديد (أكسيد الحديد)، ويضم أطول بركان في المجموعة الشمسية (جبل أوليمبوس).",
  },
  {
    id: "jupiter",
    nameAr: "المشتري (عملاق الكواكب)",
    nameEn: "Jupiter",
    color: "#d97706",
    radiusVisual: 0.65,
    radiusReal: 0.45,
    distanceVisual: 7.2,
    distanceReal: 7.5,
    orbitPeriodDays: 4332.6, // ~11.86 years
    rotationPeriodHours: 9.93,
    axialTiltDeg: 3.13,
    gravityMps2: 24.79,
    massKg: "1.90 × 10²⁷",
    massEarthRelative: 317.8,
    radiusKm: 69911.0,
    surfaceTempC: "-110",
    moonsCount: 95,
    descriptionAr: "أضخم كواكب المجموعة الشمسية وأقواها جاذبية، كوكب غازي يتميز بالبقعة الحمراء العظيمة وهي عاصفة مستمرة منذ مئات السنين.",
  },
  {
    id: "saturn",
    nameAr: "زحل (سيد الحلقات)",
    nameEn: "Saturn",
    color: "#f59e0b",
    hasRings: true,
    ringColor: "#d97706",
    radiusVisual: 0.55,
    radiusReal: 0.38,
    distanceVisual: 9.0,
    distanceReal: 10.5,
    orbitPeriodDays: 10759.2, // ~29.4 years
    rotationPeriodHours: 10.7,
    axialTiltDeg: 26.73,
    gravityMps2: 10.44,
    massKg: "5.68 × 10²⁶",
    massEarthRelative: 95.2,
    radiusKm: 58232.0,
    surfaceTempC: "-140",
    moonsCount: 146,
    descriptionAr: "كوكب غازي مذهل بنظامه الحلقي البراق المتكون من قطع جليدية وصخور فضائية تدور حوله في مستوى خط استوائه.",
  },
  {
    id: "uranus",
    nameAr: "أورانوس (العملاق الجليدي)",
    nameEn: "Uranus",
    color: "#22d3ee",
    radiusVisual: 0.42,
    radiusReal: 0.28,
    distanceVisual: 10.8,
    distanceReal: 14.0,
    orbitPeriodDays: 30685.4, // ~84 years
    rotationPeriodHours: -17.2,
    axialTiltDeg: 97.77, // sideways!
    gravityMps2: 8.69,
    massKg: "8.68 × 10²⁵",
    massEarthRelative: 14.5,
    radiusKm: 25362.0,
    surfaceTempC: "-195",
    moonsCount: 28,
    descriptionAr: "عملاق جليدي أزرق مخضر فريد من نوعه، يدور على جانبه بميل محوري يقارب 98 درجة كأنه يتدحرج على مداره.",
  },
  {
    id: "neptune",
    nameAr: "نبتون (الكوكب الأزرق)",
    nameEn: "Neptune",
    color: "#2563eb",
    radiusVisual: 0.4,
    radiusReal: 0.27,
    distanceVisual: 12.5,
    distanceReal: 17.5,
    orbitPeriodDays: 60189.0, // ~164.8 years
    rotationPeriodHours: 16.1,
    axialTiltDeg: 28.32,
    gravityMps2: 11.15,
    massKg: "1.02 × 10²⁶",
    massEarthRelative: 17.1,
    radiusKm: 24622.0,
    surfaceTempC: "-200",
    moonsCount: 16,
    descriptionAr: "أبعد كواكب المجموعة الشمسية عن الشمس، كوكب جليدي غامض ذو رياح هي الأعنف في النظام الشمسي تتجاوز سرعتها 2100 كم/ساعة.",
  },
]

// 3D Deep Space Starfield Background
function DeepSpaceStars() {
  const { particleCount } = useQuality()
  const count = Math.round(900 * particleCount)

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Distribute stars on a sphere radius 45-75m
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const r = 45 + Math.random() * 30

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)

      // Random tint: blue, white, slight amber
      const tint = Math.random()
      if (tint > 0.8) {
        col[i * 3] = 0.6
        col[i * 3 + 1] = 0.8
        col[i * 3 + 2] = 1.0
      } else if (tint > 0.6) {
        col[i * 3] = 1.0
        col[i * 3 + 1] = 0.85
        col[i * 3 + 2] = 0.7
      } else {
        col[i * 3] = 0.95
        col[i * 3 + 1] = 0.95
        col[i * 3 + 2] = 0.95
      }
    }
    return [pos, col]
  }, [count])

  const pointsRef = useRef<THREE.Points>(null)
  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.003
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.35} vertexColors transparent opacity={0.85} sizeAttenuation />
    </points>
  )
}

// 3D The Sun with Corona Glow
function SunStar({ onClick }: { onClick: () => void }) {
  const sunMeshRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (sunMeshRef.current) {
      sunMeshRef.current.rotation.y += delta * 0.05
    }
  })

  return (
    <group onClick={onClick}>
      {/* Central Star Core */}
      <mesh ref={sunMeshRef}>
        <sphereGeometry args={[1.1, 32, 32]} />
        <meshBasicMaterial color="#fef08a" />
      </mesh>

      {/* Radiant Solar Corona Atmosphere */}
      <mesh>
        <sphereGeometry args={[1.25, 32, 32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.4} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.45, 32, 32]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.15} />
      </mesh>

      {/* Sun Light Source */}
      <pointLight color="#fffbeb" intensity={3.5} distance={50} decay={1} />
      <ambientLight intensity={0.2} color="#1e293b" />

      {/* Label */}
      <Text position={[0, 1.6, 0]} fontSize={0.2} color="#fef08a" anchorX="center">
        الشمس (The Sun)
      </Text>
    </group>
  )
}

// 3D Orbital Path Ring
function OrbitRing({ radius }: { radius: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.02, radius + 0.02, 64]} />
      <meshBasicMaterial color="#334155" side={THREE.DoubleSide} transparent opacity={0.35} />
    </mesh>
  )
}

// 3D Planet Mesh with Keplerian Orbit & Axial Tilt
function PlanetBody({
  data,
  isRealScale,
  timeMultiplier,
  isPaused,
  onSelect,
}: {
  data: PlanetData
  isRealScale: boolean
  timeMultiplier: number
  isPaused: boolean
  onSelect: () => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const planetMeshRef = useRef<THREE.Mesh>(null)

  const radius = isRealScale ? data.radiusReal : data.radiusVisual
  const distance = isRealScale ? data.distanceReal : data.distanceVisual

  // Orbit speed based on Kepler: v proportional to 1 / sqrt(r)
  const orbitSpeed = (365 / data.orbitPeriodDays) * 0.15

  const currentAngleRef = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    if (!isPaused) {
      currentAngleRef.current += delta * orbitSpeed * timeMultiplier
      const x = Math.cos(currentAngleRef.current) * distance
      const z = Math.sin(currentAngleRef.current) * distance

      if (groupRef.current) {
        groupRef.current.position.set(x, 0, z)
      }

      if (planetMeshRef.current) {
        // Spin around tilted axis
        const spinSpeed = (24 / Math.abs(data.rotationPeriodHours)) * 0.6
        planetMeshRef.current.rotation.y += delta * spinSpeed * (data.rotationPeriodHours < 0 ? -1 : 1)
      }
    }
  })

  const tiltRad = (data.axialTiltDeg * Math.PI) / 180

  return (
    <>
      {/* Orbital Trail Ring */}
      <OrbitRing radius={distance} />

      {/* Orbiting Planet Group */}
      <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onSelect(); labAudio.playClick(800) }}>
        {/* Tilted Axis Group */}
        <group rotation={[0, 0, tiltRad]}>
          <mesh ref={planetMeshRef} castShadow receiveShadow>
            <sphereGeometry args={[radius, 32, 32]} />
            <meshStandardMaterial color={data.color} roughness={0.7} metalness={0.1} />
          </mesh>

          {/* Saturn's Rings */}
          {data.hasRings && (
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[radius * 1.35, radius * 2.3, 48]} />
              <meshStandardMaterial
                color={data.ringColor || "#d97706"}
                side={THREE.DoubleSide}
                transparent
                opacity={0.8}
                roughness={0.4}
              />
            </mesh>
          )}

          {/* Earth's Moon */}
          {data.id === "earth" && (
            <group position={[radius * 1.8, 0, 0]}>
              <mesh castShadow receiveShadow>
                <sphereGeometry args={[radius * 0.27, 16, 16]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
              </mesh>
              <Text position={[0, radius * 0.45, 0]} fontSize={0.07} color="#94a3b8" anchorX="center">
                القمر
              </Text>
            </group>
          )}
        </group>

        {/* Floating Planet Label */}
        <Text
          position={[0, radius + 0.18, 0]}
          fontSize={0.13}
          color="#f8fafc"
          anchorX="center"
          anchorY="bottom"
        >
          {data.nameAr}
        </Text>
      </group>
    </>
  )
}

// 4 Guided Experiments for Space & Planets Lab
const SPACE_GUIDED_EXPERIMENTS: GuidedExperiment[] = [
  {
    id: "kepler-laws",
    title: "حركة الكواكب وقوانين كبلر الثلاثة",
    curriculumRef: "الفيزياء - قوانين الجاذبية الكونية وحركة الأجرام السماوية",
    description: "التحقق من أن مدارات الكواكب إهليلجية، وأن سرعة الكوكب تزداد كلما اقترب من الشمس.",
    steps: [
      {
        title: "مقارنة سرعة عطارد ونبتون",
        instruction: "لاحظ سرعة دوران عطارد (القريب من الشمس: 88 يوماً) مقارنة بنبتون (الأبعد: 165 سنة).",
        hint: "وفق قانون كبلر الثالث: مربع زمن الدورة المدارية يتناسب طردياً مع مكعب نصف القطر (T² ∝ r³).",
      },
      {
        title: "تسريع المحاكاة لملاحظة الدورات",
        instruction: "استخدم زر التسريع (20x) لمشاهدة اكتمال دورات الكواكب الداخلية السريعة حول الشمس.",
        hint: "الشمس تقع في إحدى بؤرتي المدار البيضاوي وفق قانون كبلر الأول.",
      },
    ],
    quiz: {
      question: "وفقاً لقانون كبلر الثاني (قانون المساحات)، تكون سرعة الكوكب في مداره أكبر ما يمكن عندما يكون:",
      options: [
        "في نقطة الحضيض (أقرب نقطة إلى الشمس)",
        "في نقطة الأوج (أبعد نقطة عن الشمس)",
        "سرعة الكوكب ثابتة لا تتغير في أي نقطة",
        "عندما يتعامد محوره مع مستوى المدار",
      ],
      correctIndex: 0,
      explanation: "الخط الوهمي الواصل بين الشمس والكوكب يمسح مساحات متساوية في أزمنة متساوية، لذا يتحرك الكوكب أسرع ما يمكن عند اقترابه من الشمس في الحضيض.",
    },
  },
  {
    id: "gravitational-weight",
    title: "الجاذبية الكونية وحساب الأوزان على الكواكب",
    curriculumRef: "الفيزياء - قانون الجذب العام لنيوتن وحساب شدة مجال الجاذبية",
    description: "استكشف كيف يتغير وزنك على أسطح الكواكب بناءً على كتلة الكوكب ونصف قطره (g = GM/R²).",
    steps: [
      {
        title: "حساب الوزن على المشتري",
        instruction: "افتح حاسبة الأوزان واضغط على المشتري: ستلاحظ أن وزنك يتضاعف بحوالي 2.5 مرة نتيجة كتلته الهائلة.",
        hint: "تسارع جاذبية المشتري 24.8 م/ث² مقارنة بـ 9.8 م/ث² على الأرض.",
      },
      {
        title: "حساب الوزن على القمر والمريخ",
        instruction: "قارن وزنك على القمر (سُدس وزنك على الأرض g ≈ 1.6) وعلى المريخ (g ≈ 3.7).",
        hint: "الكتلة تظل ثابتة في أي مكان في الكون، بينما الوزن يتغير بتغير عجلة الجاذبية المحلية.",
      },
    ],
    quiz: {
      question: "إذا كانت كتلة رائد فضاء 70 kg على سطح الأرض، فإن كتلته على سطح القمر تساوي:",
      options: ["70 kg (ثابتة لا تتغير)", "11.6 kg", "420 kg", "صفر بسبب انعدام الوزن"],
      correctIndex: 0,
      explanation: "الكتلة هي مقدار ما يحتويه الجسم من مادة وهي خاصية ثابتة لا تتغير، أما وزنه (W = mg) فهو الذي يقل على القمر إلى السدس.",
    },
  },
  {
    id: "moon-phases-eclipse",
    title: "أطوار القمر وظاهرة الكسوف والخسوف",
    curriculumRef: "الفلك والفيزياء - أطوار القمر وحجب الضوء الفضائي",
    description: "فهم سبب ظهور القمر بأشكال مختلفة (محاق، هلال، تربيع، بدر) وحالات الكسوف والخسوف.",
    steps: [
      {
        title: "فحص موقع القمر بالنسبة للشمس والأرض",
        instruction: "لاحظ أن نصف القمر المواجه للشمس مضاء دائماً، لكن الجزء الذي نراه من الأرض يتغير باستمرار خلال دورته الشهرية (29.5 يوماً).",
        hint: "عندما يكون القمر بين الأرض والشمس يكون في طور 'المحاق' ولا نرى جانبه المضاء.",
      },
      {
        title: "الفرق بين كسوف الشمس وخسوف القمر",
        instruction: "الكسوف الشمسي يحدث عندما يقع القمر تماماً بين الشمس والأرض فيحجب ضوءها، بينما الخسوف يحدث عندما تقع الأرض بين الشمس والقمر فتلقي بظلها عليه.",
        hint: "الكسوف يحدث نهاراً في طور المحاق، والخسوف يحدث ليلاً في طور البدر.",
      },
    ],
    quiz: {
      question: "تحدث ظاهرة خسوف القمر (Lunar Eclipse) عندما:",
      options: [
        "تقع الأرض بين الشمس والقمر على استقامة واحدة (في طور البدر)",
        "يقع القمر بين الشمس والأرض على استقامة واحدة (في طور المحاق)",
        "يتعامد مدار القمر مع مدار الأرض",
        "تصل سرعة دوران القمر لضعف سرعة الأرض",
      ],
      correctIndex: 0,
      explanation: "عندما تقع الأرض بين الشمس والقمر، تحجب الأرض أشعة الشمس عن القمر ويلقي كوكبنا بظله على سطح القمر، ويكون ذلك منتصف الشهر القمري (طور البدر).",
    },
  },
  {
    id: "orbital-escape-velocity",
    title: "السرعة المدارية وسرعة الإفلات (Orbital & Escape Velocity)",
    curriculumRef: "الفيزياء - الأقمار الصناعية وحركة الصواريخ الفضائية",
    description: "تطبيق قوانين نيوتن لمعرفة السرعة المطلوبة لوضع قمر صناعي في مدار مستقر أو الهروب من الجاذبية.",
    steps: [
      {
        title: "السرعة المدارية الأولى (First Cosmic Velocity)",
        instruction: "لحساب السرعة المدارية للأقمار الصناعية نطبق القانون v = √(GM/r)، وتبلغ حوالي 7.9 كم/ث بالقرب من سطح الأرض.",
        hint: "عند هذه السرعة تتعادل القوة الجاذبة المركزية مع وزن القمر الصناعي فيدور في مدار دائري دون أن يسقط.",
      },
      {
        title: "سرعة الإفلات من الجاذبية (Escape Velocity)",
        instruction: "لكي تفلت مركبة فضائية من جاذبية الأرض دون عودة، يجب أن تصل لسرعة v_esc = √(2GM/r) ≈ 11.2 كم/ث.",
        hint: "سرعة الإفلات تساوي دائماً الجذر التربيعي لـ 2 مضروباً في السرعة المدارية (v_esc = √2 × v_orbit).",
      },
    ],
    quiz: {
      question: "النسبة بين سرعة الإفلات من جاذبية كوكب إلى السرعة المدارية لقمر يدور بالقرب من سطحه هي:",
      options: ["√2 : 1 (حوالي 1.414)", "2 : 1", "1 : 2", "4 : 1"],
      correctIndex: 0,
      explanation: "سرعة الإفلات v_esc = √(2GM/R) بينما السرعة المدارية v = √(GM/R)، وبقسمتهما تكون النسبة √2 إلى 1.",
    },
  },
]

export function SpaceLab() {
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(null)
  const [isRealScale, setIsRealScale] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [timeMultiplier, setTimeMultiplier] = useState(1)

  // Weight calculator state
  const [studentMass, setStudentMass] = useState(70) // 70 kg default
  const [showWeightCalc, setShowWeightCalc] = useState(false)

  // Guided Experiments HUD
  const [activeExpIndex, setActiveExpIndex] = useState(0)
  const [isSandbox, setIsSandbox] = useState(false)
  const [cameraResetSignal, setCameraResetSignal] = useState(0)

  const controlsRef = useRef<OrbitControlsImpl>(null)

  const handleSelectPlanet = (planet: PlanetData) => {
    setSelectedPlanet(planet)
    labAudio.playClick(900)
  }

  const handleResetLab = () => {
    setSelectedPlanet(null)
    setIsRealScale(false)
    setIsPaused(false)
    setTimeMultiplier(1)
    setCameraResetSignal((prev) => prev + 1)
  }

  return (
    <div className="relative w-full h-full min-h-[480px]">
      <LabCanvas
        camera={{ position: [0, 16, 22], fov: 45 }}
        onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
      >
        {/* Custom Orbit Controls for deep space solar navigation */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.06}
          minDistance={2.5}
          maxDistance={45}
          maxPolarAngle={Math.PI / 2 + 0.15}
        />

        {/* Deep Space Background Stars */}
        <DeepSpaceStars />

        {/* The Central Sun */}
        <SunStar onClick={() => setSelectedPlanet(null)} />

        {/* The 8 Planets */}
        {PLANETS_DATABASE.map((planet) => (
          <PlanetBody
            key={planet.id}
            data={planet}
            isRealScale={isRealScale}
            timeMultiplier={timeMultiplier}
            isPaused={isPaused}
            onSelect={() => handleSelectPlanet(planet)}
          />
        ))}
      </LabCanvas>

      {/* 2D Interactive HUD Overlay */}
      <LabHUD
        title="مختبر الفضاء والمجموعة الشمسية ثلاثي الأبعاد"
        subjectTitle="الفيزياء الفلكية والميكانيكا السماوية"
        curriculumGrade="الثانوية العامة"
        guidedExperiments={SPACE_GUIDED_EXPERIMENTS}
        activeExpIndex={activeExpIndex}
        onSelectExp={setActiveExpIndex}
        isSandbox={isSandbox}
        onToggleSandbox={setIsSandbox}
        onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
        onResetExperiment={handleResetLab}
      >
        {/* Space Lab Global Control Bar */}
        <div className="flex flex-col gap-2.5 pointer-events-auto max-w-4xl mx-auto w-full px-2">
          {/* Controls: Time & Scale Toggle */}
          <div className="glass px-4 py-2 rounded-2xl border border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-3">
            {/* Time Controls: Play/Pause and Speed Multipliers */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsPaused(!isPaused)
                  labAudio.playClick()
                }}
                className="h-8 px-2.5 rounded-xl glass font-bold text-xs"
              >
                {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400 ml-1" /> : <Pause className="w-3.5 h-3.5 text-amber-400 ml-1" />}
                {isPaused ? "تشغيل" : "إيقاف مؤقت"}
              </Button>

              <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5 text-xs">
                {[1, 5, 20, 100].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => {
                      setTimeMultiplier(speed)
                      labAudio.playClick()
                    }}
                    className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                      timeMultiplier === speed ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Scale Mode Switcher */}
            <div className="flex items-center gap-2">
              <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5 text-xs">
                <button
                  onClick={() => {
                    setIsRealScale(false)
                    labAudio.playClick()
                  }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    !isRealScale ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  مقياس مرئي تعليمي
                </button>
                <button
                  onClick={() => {
                    setIsRealScale(true)
                    labAudio.playClick()
                  }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    isRealScale ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  مقياس نسبي حقيقي
                </button>
              </div>

              {/* Weight calculator toggle button */}
              <button
                onClick={() => {
                  setShowWeightCalc(!showWeightCalc)
                  labAudio.playClick()
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                  showWeightCalc ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300" : "glass border-white/10 text-slate-300"
                }`}
              >
                <Scale className="w-3.5 h-3.5" />
                <span>احسب وزنك على الكواكب</span>
              </button>
            </div>
          </div>

          {/* Planet Selection Fast Carousel Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {PLANETS_DATABASE.map((p) => {
              const isSelected = selectedPlanet?.id === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectPlanet(p)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 border ${
                    isSelected
                      ? "bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105"
                      : "glass text-slate-300 border-white/10 hover:border-white/30"
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span>{p.nameAr}</span>
                </button>
              )
            })}
          </div>

          {/* Selected Planet Arabic Dossier Card Modal/Panel */}
          {selectedPlanet && (
            <div className="glass p-4 rounded-2xl border border-cyan-500/30 bg-slate-950/85 shadow-2xl animate-fade-in space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: selectedPlanet.color }} />
                  <h3 className="text-sm md:text-base font-black text-white">
                    كوكب {selectedPlanet.nameAr} ({selectedPlanet.nameEn})
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedPlanet(null)}
                  className="text-xs text-slate-400 hover:text-white font-bold px-2 py-0.5 rounded-lg bg-white/5"
                >
                  إغلاق ✕
                </button>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{selectedPlanet.descriptionAr}</p>

              {/* Data Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <div className="text-slate-400 text-[10px]">عجلة الجاذبية (g):</div>
                  <div className="font-mono font-bold text-cyan-300">{selectedPlanet.gravityMps2} m/s²</div>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <div className="text-slate-400 text-[10px]">نصف القطر:</div>
                  <div className="font-mono font-bold text-white">{selectedPlanet.radiusKm.toLocaleString()} km</div>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <div className="text-slate-400 text-[10px]">طول السنة (المدار):</div>
                  <div className="font-mono font-bold text-amber-300">{selectedPlanet.orbitPeriodDays.toLocaleString()} يوم</div>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <div className="text-slate-400 text-[10px]">درجة الحرارة:</div>
                  <div className="font-mono font-bold text-rose-300">{selectedPlanet.surfaceTempC}°C</div>
                </div>
              </div>
            </div>
          )}

          {/* Weight on Other Planets Calculator Drawer */}
          {showWeightCalc && (
            <div className="glass p-4 rounded-2xl border border-cyan-500/30 bg-slate-950/90 shadow-2xl space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                  <Scale className="w-4 h-4" />
                  <span>حاسبة وزنك على أسطح الكواكب (W = m · g)</span>
                </div>
                <button onClick={() => setShowWeightCalc(false)} className="text-xs text-slate-400 hover:text-white">
                  ✕
                </button>
              </div>

              {/* Input for student weight */}
              <div className="flex items-center gap-3 text-xs">
                <span className="text-slate-300">أدخل كتلتك على الأرض بالكيلوجرام:</span>
                <input
                  type="number"
                  min="20"
                  max="150"
                  value={studentMass}
                  onChange={(e) => setStudentMass(Math.max(1, parseFloat(e.target.value) || 0))}
                  className="w-20 bg-black/60 border border-white/20 rounded-lg px-2 py-1 text-center font-mono font-bold text-white"
                />
                <span className="text-slate-400 font-bold">kg</span>
              </div>

              {/* Weight on All Planets Table */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                {PLANETS_DATABASE.map((p) => {
                  const weightNewtons = studentMass * p.gravityMps2
                  const apparentKg = (weightNewtons / 9.81).toFixed(1)
                  return (
                    <div key={p.id} className="bg-white/5 p-2 rounded-xl border border-white/5 flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-300 font-semibold mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <span>{p.nameAr}</span>
                      </div>
                      <div className="font-mono font-bold text-cyan-300 text-sm">
                        {apparentKg} <span className="text-[10px] text-slate-400">kg</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        ({weightNewtons.toFixed(0)} نيوتن)
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </LabHUD>
    </div>
  )
}
