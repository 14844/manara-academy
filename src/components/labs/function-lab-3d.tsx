"use client"

import React, { useState, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { LabCanvas, LabRoom, LabHUD, GuidedExperiment, labAudio, useLabLanguage, BillboardLabel, QualityProvider, LanguageProvider } from "./3d"
import { Calculator, TrendingUp, Sliders, Hash, Move, Sparkles, Activity } from "lucide-react"

type FunctionFamily = "quadratic" | "absolute" | "cubic" | "rational" | "sine" | "linear"

interface FunctionDef {
  id: FunctionFamily
  nameAr: string
  formulaTemplate: string
  evaluate: (x: number, a: number, h: number, k: number, b: number) => number
  derivative: (x: number, a: number, h: number, k: number, b: number) => number
  curriculumNotes: string
}

const FUNCTIONS_REGISTRY: Record<FunctionFamily, FunctionDef> = {
  quadratic: {
    id: "quadratic",
    nameAr: "الدالة التربيعية (Parabola)",
    formulaTemplate: "f(x) = a(x - h)² + k",
    evaluate: (x, a, h, k) => a * Math.pow(x - h, 2) + k,
    derivative: (x, a, h) => 2 * a * (x - h),
    curriculumNotes: "رأس المنحنى عند النقطة (h, k)، ومحور التماثل س = h. المنحنى مفتوح لأعلى إذا كانت a > 0 ولأسفل إذا كانت a < 0.",
  },
  absolute: {
    id: "absolute",
    nameAr: "دالة المقياس (القيمة المطلقة)",
    formulaTemplate: "f(x) = a|x - h| + k",
    evaluate: (x, a, h, k) => a * Math.abs(x - h) + k,
    derivative: (x, a, h) => (x === h ? 0 : x > h ? a : -a),
    curriculumNotes: "نقطة التماثل وانكسار المنحنى عند (h, k). تكون الدالة تناقصية قبل h وتزايدية بعدها (عند a > 0).",
  },
  cubic: {
    id: "cubic",
    nameAr: "الدالة التكعيبية (Cubic)",
    formulaTemplate: "f(x) = a(x - h)³ + k",
    evaluate: (x, a, h, k) => a * Math.pow(x - h, 3) + k,
    derivative: (x, a, h) => 3 * a * Math.pow(x - h, 2),
    curriculumNotes: "نقطة تماثل المنحنى وانقلابه عند (h, k). الدالة فردية التماثل حول نقطة التماثل.",
  },
  rational: {
    id: "rational",
    nameAr: "الدالة الكسرية (Rational)",
    formulaTemplate: "f(x) = a/(x - h) + k",
    evaluate: (x, a, h, k) => {
      const denom = x - h
      if (Math.abs(denom) < 0.08) return NaN
      return a / denom + k
    },
    derivative: (x, a, h) => {
      const denom = x - h
      if (Math.abs(denom) < 0.08) return 0
      return -a / Math.pow(denom, 2)
    },
    curriculumNotes: "خط التقارب الرأسي س = h وخط التقارب الأفقي ص = k، ونقطة التماثل هي (h, k). المجال ح - {h} والمدى ح - {k}.",
  },
  sine: {
    id: "sine",
    nameAr: "دالة الجيب المثلثية (Sine Wave)",
    formulaTemplate: "f(x) = a · sin(b(x - h)) + k",
    evaluate: (x, a, h, k, b) => a * Math.sin(b * (x - h)) + k,
    derivative: (x, a, h, _k, b) => a * b * Math.cos(b * (x - h)),
    curriculumNotes: "سعة الدالة (Amplitude) تساوي |a|، ودورتها الزمنية (Period) تساوي 2π/b، ومداها [-|a|+k, |a|+k].",
  },
  linear: {
    id: "linear",
    nameAr: "الدالة الخطية (Linear)",
    formulaTemplate: "f(x) = ax + k",
    evaluate: (x, a, _h, k) => a * x + k,
    derivative: (_x, a) => a,
    curriculumNotes: "معادلة خط مستقيم ميله الثابت a والجزء المقطوع من محور الصادات هو k.",
  },
}

// 3D Graphing Holographic Easel Board
function GraphingBoard({
  funcFamily,
  a,
  h,
  k,
  b,
  tangentX,
  showTangent,
  showArea,
  integralBounds,
}: {
  funcFamily: FunctionFamily
  a: number
  h: number
  k: number
  b: number
  tangentX: number
  showTangent: boolean
  showArea: boolean
  integralBounds: [number, number]
}) {
  const currentDef = FUNCTIONS_REGISTRY[funcFamily]

  // Coordinate conversion scale
  // Board dimensions: 2.2m wide, 1.4m high
  // Mapping math coordinate [-6, 6] -> board local X [-1.0, 1.0]
  // Mapping math coordinate [-4, 4] -> board local Y [-0.65, 0.65]
  const scaleX = 0.17
  const scaleY = 0.16

  // Generate 3D curve vertices
  const curvePoints = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let x = -6; x <= 6; x += 0.08) {
      const y = currentDef.evaluate(x, a, h, k, b)
      if (!isNaN(y) && y >= -4.5 && y <= 4.5) {
        pts.push(new THREE.Vector3(x * scaleX, y * scaleY, 0.015))
      }
    }
    return pts
  }, [currentDef, a, h, k, b, scaleX, scaleY])

  // Tangent line calculations at tangentX
  const tangentData = useMemo(() => {
    const y0 = currentDef.evaluate(tangentX, a, h, k, b)
    const slope = currentDef.derivative(tangentX, a, h, k, b)
    if (isNaN(y0) || y0 < -4.5 || y0 > 4.5) return null

    const dx = 1.6
    const xA = tangentX - dx
    const yA = y0 - slope * dx
    const xB = tangentX + dx
    const yB = y0 + slope * dx

    return {
      p0: new THREE.Vector3(tangentX * scaleX, y0 * scaleY, 0.022),
      pA: new THREE.Vector3(xA * scaleX, yA * scaleY, 0.02),
      pB: new THREE.Vector3(xB * scaleX, yB * scaleY, 0.02),
      slope,
      y0,
    }
  }, [currentDef, tangentX, a, h, k, b, scaleX, scaleY])

  // Area under curve shaded ribbon / geometry
  const areaGeo = useMemo(() => {
    if (!showArea) return null
    const [p, q] = integralBounds
    const minX = Math.min(p, q)
    const maxX = Math.max(p, q)

    const geom = new THREE.BufferGeometry()
    const vertices: number[] = []

    const step = 0.1
    for (let x = minX; x < maxX; x += step) {
      const nextX = Math.min(x + step, maxX)
      const y1 = currentDef.evaluate(x, a, h, k, b)
      const y2 = currentDef.evaluate(nextX, a, h, k, b)

      if (isNaN(y1) || isNaN(y2)) continue

      const x1Sc = x * scaleX
      const x2Sc = nextX * scaleX
      const y1Sc = THREE.MathUtils.clamp(y1, -4, 4) * scaleY
      const y2Sc = THREE.MathUtils.clamp(y2, -4, 4) * scaleY

      // Triangle 1
      vertices.push(x1Sc, 0, 0.012)
      vertices.push(x1Sc, y1Sc, 0.012)
      vertices.push(x2Sc, 0, 0.012)

      // Triangle 2
      vertices.push(x2Sc, 0, 0.012)
      vertices.push(x1Sc, y1Sc, 0.012)
      vertices.push(x2Sc, y2Sc, 0.012)
    }

    geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3))
    geom.computeVertexNormals()
    return geom
  }, [showArea, integralBounds, currentDef, a, h, k, b, scaleX, scaleY])

  return (
    <group position={[0, 1.45, -0.1]}>
      {/* Wooden / Aluminum Studio Easel Stand */}
      <group position={[0, -0.65, 0]}>
        {/* Front tripod legs */}
        <mesh position={[-0.7, 0, -0.2]} rotation={[0.1, 0, -0.15]} castShadow>
          <boxGeometry args={[0.04, 1.3, 0.04]} />
          <meshStandardMaterial color="#334155" metalness={0.6} />
        </mesh>
        <mesh position={[0.7, 0, -0.2]} rotation={[0.1, 0, 0.15]} castShadow>
          <boxGeometry args={[0.04, 1.3, 0.04]} />
          <meshStandardMaterial color="#334155" metalness={0.6} />
        </mesh>
        {/* Rear brace */}
        <mesh position={[0, 0, -0.6]} rotation={[-0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.04, 1.35, 0.04]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} />
        </mesh>
      </group>

      {/* Main Glass / High-Tech Graphing Panel */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.3, 1.5, 0.03]} />
        <meshStandardMaterial color="#020617" roughness={0.1} metalness={0.8} />
      </mesh>

      {/* Futuristic Frame Border */}
      <mesh position={[0, 0, 0.016]}>
        <ringGeometry args={[1.05, 1.08, 4]} />
        <meshBasicMaterial color="#38bdf8" />
      </mesh>

      {/* Grid Lines on the Board */}
      {/* Vertical grid lines */}
      {[-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].map((gx) => (
        <mesh key={`gx-${gx}`} position={[gx * scaleX, 0, 0.005]}>
          <planeGeometry args={[0.002, 1.3]} />
          <meshBasicMaterial color="#1e293b" />
        </mesh>
      ))}
      {/* Horizontal grid lines */}
      {[-3, -2, -1, 1, 2, 3].map((gy) => (
        <mesh key={`gy-${gy}`} position={[0, gy * scaleY, 0.005]}>
          <planeGeometry args={[2.1, 0.002]} />
          <meshBasicMaterial color="#1e293b" />
        </mesh>
      ))}

      {/* X and Y Main Axes */}
      {/* X-Axis */}
      <mesh position={[0, 0, 0.008]}>
        <planeGeometry args={[2.1, 0.008]} />
        <meshBasicMaterial color="#64748b" />
      </mesh>
      <BillboardLabel position={[1.08, 0, 0.015]} text="X (س)" color="#94a3b8" bgColor="transparent" borderColor="transparent" scale={[0.14, 0.05, 1]} fontSize={18} />

      {/* Y-Axis */}
      <mesh position={[0, 0, 0.008]}>
        <planeGeometry args={[0.008, 1.35]} />
        <meshBasicMaterial color="#64748b" />
      </mesh>
      <BillboardLabel position={[0, 0.72, 0.015]} text="Y (ص)" color="#94a3b8" bgColor="transparent" borderColor="transparent" scale={[0.14, 0.05, 1]} fontSize={18} />

      {/* Shaded Area Under Curve (Integral) */}
      {areaGeo && (
        <mesh geometry={areaGeo}>
          <meshBasicMaterial color="#10b981" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Dynamic 3D Function Curve */}
      {curvePoints.length > 1 && (
        <group>
          {curvePoints.slice(0, -1).map((pt, i) => {
            const next = curvePoints[i + 1]
            const dist = pt.distanceTo(next)
            const mid = new THREE.Vector3().addVectors(pt, next).multiplyScalar(0.5)
            const dir = new THREE.Vector3().subVectors(next, pt).normalize()
            const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)

            return (
              <mesh key={i} position={mid} quaternion={quat}>
                <cylinderGeometry args={[0.008, 0.008, dist, 8]} />
                <meshBasicMaterial color="#38bdf8" />
              </mesh>
            )
          })}
        </group>
      )}

      {/* Tangent Line & Tangent Contact Point */}
      {showTangent && tangentData && (
        <group>
          {/* Tangent Line */}
          {(() => {
            const { pA, pB } = tangentData
            const dist = pA.distanceTo(pB)
            const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5)
            const dir = new THREE.Vector3().subVectors(pB, pA).normalize()
            const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
            return (
              <mesh position={mid} quaternion={quat}>
                <cylinderGeometry args={[0.006, 0.006, dist, 8]} />
                <meshBasicMaterial color="#f59e0b" />
              </mesh>
            )
          })()}

          {/* Contact Point P */}
          <mesh position={tangentData.p0}>
            <sphereGeometry args={[0.022, 16, 16]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>

          {/* Floating slope badge on point */}
          <BillboardLabel
            position={[tangentData.p0.x, tangentData.p0.y + 0.06, 0.03]}
            text={`الميل m = ${tangentData.slope.toFixed(2)}`}
            color="#fbbf24"
            bgColor="rgba(15, 23, 42, 0.85)"
            borderColor="rgba(251, 191, 36, 0.4)"
            scale={[0.28, 0.06, 1]}
            fontSize={16}
          />
        </group>
      )}
    </group>
  )
}

// 4 Guided Experiments for Math Functions Lab
const FUNCTIONS_GUIDED_EXPERIMENTS: GuidedExperiment[] = [
  {
    id: "quadratic-transformations",
    title: "التحويلات الهندسية للدالة التربيعية f(x) = a(x - h)² + k",
    curriculumRef: "الرياضيات - فرع الجبر: الدوال الحقيقية ورسم المنحنيات",
    description: "استكشف كيف تؤثر الإزاحات الأفقية والرأسية والتمدد والانعكاس على منحنى الدالة التربيعية.",
    steps: [
      {
        title: "دراسة الإزاحة الأفقية (h)",
        instruction: "حرك شريط الإزاحة الأفقية (h): لاحظ انتقال رأس المنحنى يميناً (إذا كانت h موجبة) ويساراً (إذا كانت h سالبة).",
        hint: "القيمة داخل القوس (x - h) تعكس الاتجاه؛ فـ (x - 2)² تنقل المنحنى وحدتين جهة اليمين.",
      },
      {
        title: "دراسة الإزاحة الرأسية (k) ومعامل التمدد (a)",
        instruction: "عدّل قيمة k لنقل المنحنى لأعلى ولأسفل، ثم اجعل a سالبة لمشاهدة انعكاس المنحنى على محور السينات.",
        hint: "رأس المنحنى دائماً هو النقطة (h, k)، ويكون قيمة عظمى إذا كانت a < 0 وقيمة صغرى إذا كانت a > 0.",
      },
    ],
    quiz: {
      question: "رأس منحنى الدالة f(x) = -(x - 3)² + 5 هو النقطة:",
      options: ["(3, 5) وهي نقطة نهاية عظمى", "(3, 5) وهي نقطة نهاية صغرى", "(-3, 5) وهي نقطة نهاية عظمى", "(3, -5) وهي نقطة نهاية صغرى"],
      correctIndex: 0,
      explanation: "الإحداثي السيني للرأس هو h = 3 والصادي هو k = 5. وبما أن معامل القوس سالب (-1)، فالمنحنى مفتوح لأسفل والرأس نقطة نهاية عظمى.",
    },
  },
  {
    id: "absolute-value",
    title: "دالة المقياس f(x) = a|x - h| + k ونقطة الانكسار",
    curriculumRef: "الرياضيات - دالة القيمة المطلقة وخواصها",
    description: "فهم نقطة تماثل المقياس، المدى، وبحث إشارة الدالة وفترات التزايد والتناقص.",
    steps: [
      {
        title: "اختيار دالة المقياس وملاحظة نقطة الانكسار",
        instruction: "اختر 'دالة المقياس' من القائمة: لاحظ شكل حرف V الذي ينكسر عند النقطة (h, k).",
        hint: "الدالة متماثلة تماماً حول الخط المستقيم الرأسي س = h.",
      },
      {
        title: "تحديد المدى والاضطراد",
        instruction: "لاحظ أن مدى الدالة يبدأ من k ويمتد إلى مالانهاية [k, ∞) عندما تكون a موجبة.",
        hint: "الدالة تناقصية في المجال (-∞, h] وتزايدية في المجال [h, ∞).",
      },
    ],
    quiz: {
      question: "مدى الدالة f(x) = |x + 2| - 4 هو:",
      options: ["[-4, ∞)", "[-2, ∞)", "(-∞, -4]", "ح (مجموعة الأعداد الحقيقية)"],
      correctIndex: 0,
      explanation: "أقل قيمة لدالة المقياس هي صفر (عند س = -2)، وبالتالي أقل قيمة للدالة f(x) هي 0 - 4 = -4، فيكون المدى [-4, ∞).",
    },
  },
  {
    id: "tangent-derivative",
    title: "المفهوم الهندسي للمشتقة الأولى وميل المماس",
    curriculumRef: "الرياضيات - فرع التفاضل: المعنى الهندسي للمشتقة",
    description: "تحريك نقطة التماس على المنحنى لملاحظة تغير ميل المماس ومتى ينعدم عند القمم والقيعان.",
    steps: [
      {
        title: "تفعيل أداة المماس (Tangent Tool)",
        instruction: "اضغط على زر 'عرض المماس' وحرك موضع س لمشاهدة الخط الأصفر المماس للمنحنى عند النقطة الحمراء.",
        hint: "المشتقة الأولى f'(x) عند أي نقطة تمثل بالضبط ظل الزاوية التي يصنعها المماس مع الاتجاه الموجب لمحور السينات.",
      },
      {
        title: "انعدام الميل عند النقطة الحرجة",
        instruction: "حرك المماس حتى يصل إلى رأس المنحنى (قمة أو قاع): لاحظ أن ميل المماس يصبح صفراً (m = 0) ويكون أفقياً موازياً لمحور السينات.",
        hint: "عند القيم العظمى والصغرى المحلية يكون المماس أفقياً f'(x) = 0.",
      },
    ],
    quiz: {
      question: "إذا كان المماس لمنحنى الدالة عند نقطة ما موازياً لمحور السينات، فإن قيمة المشتقة الأولى عند تلك النقطة تساوي:",
      options: ["صفر", "1", "-1", "غير معرفة (مالانهاية)"],
      correctIndex: 0,
      explanation: "ميل أي مستقيم يوازي محور السينات يساوي صفر، وحيث أن المشتقة الأولى هي ميل المماس، فإن f'(x) = 0.",
    },
  },
  {
    id: "definite-integral-area",
    title: "التكامل المحدد وحساب المساحة تحت المنحنى",
    curriculumRef: "الرياضيات - فرع التكامل: المساحات في المستوى والتكامل المحدد",
    description: "حساب المساحة الهندسية المحصورة بين منحنى الدالة ومحور السينات في فترة محددة [a, b].",
    steps: [
      {
        title: "تفعيل أداة المساحة والتكامل",
        instruction: "فعّل خيار 'المساحة تحت المنحنى' لمشاهدة المنطقة الخضراء المظللة التي تمثل قيمة التكامل المحدد.",
        hint: "التكامل المحدد يجمع شرائح مستطيلات ريمان اللانهائية للحصول على المساحة الدقيقة تحت المنحنى.",
      },
      {
        title: "مفهوم التراكم والمساحة الصافية",
        instruction: "لاحظ أن المناطق الواقعة فوق محور السينات تكون موجبة، بينما المناطق الواقعة تحت محور السينات تكون سالبة في التكامل الجبري.",
        hint: "لحساب المساحة الهندسية الحقيقية نأخذ القيمة المطلقة للمناطق الواقعة أسفل المحور.",
      },
    ],
    quiz: {
      question: "المساحة المحصورة بين منحنى الدالة f(x) = 2x ومحور السينات في الفترة [0, 3] تساوي:",
      options: ["9 وحدات مربعة", "6 وحدات مربعة", "12 وحدة مربعة", "3 وحدات مربعة"],
      correctIndex: 0,
      explanation: "التكامل المحدد لـ 2x من 0 إلى 3 هو [x²] من 0 إلى 3 = (3)² - (0)² = 9 وحدات مربعة (أو مساحة مثلث قاعدته 3 وارتفاعه 6: 0.5 × 3 × 6 = 9).",
    },
  },
]

export function FunctionLab() {
  const [funcFamily, setFuncFamily] = useState<FunctionFamily>("quadratic")
  const [a, setA] = useState(1.0)
  const [h, setH] = useState(0.0)
  const [k, setK] = useState(-1.0)
  const [b, setB] = useState(1.0)

  // Calculus tools
  const [showTangent, setShowTangent] = useState(true)
  const [tangentX, setTangentX] = useState(1.5)
  const [showArea, setShowArea] = useState(false)
  const [integralBounds, setIntegralBounds] = useState<[number, number]>([0, 2])

  // Guided Experiments HUD
  const [activeExpIndex, setActiveExpIndex] = useState(0)
  const [isSandbox, setIsSandbox] = useState(false)
  const [cameraResetSignal, setCameraResetSignal] = useState(0)

  const { lang, t, isAr } = useLabLanguage()

  const currentDef = FUNCTIONS_REGISTRY[funcFamily]

  // Calculate approximate numerical definite integral for display
  const integralValue = useMemo(() => {
    const [p, q] = integralBounds
    const min = Math.min(p, q)
    const max = Math.max(p, q)
    let sum = 0
    const n = 100
    const step = (max - min) / n
    for (let i = 0; i < n; i++) {
      const mid = min + (i + 0.5) * step
      const val = currentDef.evaluate(mid, a, h, k, b)
      if (!isNaN(val)) sum += val * step
    }
    return sum.toFixed(2)
  }, [integralBounds, currentDef, a, h, k, b])

  const handleResetLab = () => {
    setFuncFamily("quadratic")
    setA(1.0)
    setH(0.0)
    setK(-1.0)
    setB(1.0)
    setTangentX(1.5)
    setShowTangent(true)
    setShowArea(false)
    setCameraResetSignal((prev) => prev + 1)
  }

  return (
    <QualityProvider>
      <LanguageProvider>
        <div className="relative w-full h-full min-h-[480px] flex-1">
          <LabCanvas
            camera={{ position: [0, 1.8, 3.2], fov: 42, far: 100 }}
            onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
          >
        <LabRoom cameraResetSignal={cameraResetSignal} defaultCameraPosition={[0, 1.8, 3.2]} defaultTarget={[0, 1.45, -0.1]}>
          {/* Main 3D Graphing Easel Board */}
          <GraphingBoard
            funcFamily={funcFamily}
            a={a}
            h={h}
            k={k}
            b={b}
            tangentX={tangentX}
            showTangent={showTangent}
            showArea={showArea}
            integralBounds={integralBounds}
          />
        </LabRoom>
      </LabCanvas>

      {/* 2D Interactive HUD Overlay */}
      <LabHUD
        title="مختبر الدوال والتحويلات الهندسية والتفاضل"
        titleEn="3D Functions, Calculus & Geometric Graphing Lab"
        subjectTitle="الرياضيات والتفاضل"
        subjectTitleEn="Mathematics & Calculus"
        curriculumGrade="الثانوية العامة"
        curriculumGradeEn="Secondary Mathematics"
        guidedExperiments={FUNCTIONS_GUIDED_EXPERIMENTS}
        activeExpIndex={activeExpIndex}
        onSelectExp={setActiveExpIndex}
        isSandbox={isSandbox}
        onToggleSandbox={setIsSandbox}
        onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
        onResetExperiment={handleResetLab}
      >
        {/* Interactive Sliders & Calculus Tool Controls */}
        <div className="flex flex-col gap-2.5 pointer-events-auto max-w-4xl mx-auto w-full px-2">
          {/* Top Row: Function Picker & Formula Display */}
          <div className="glass px-4 py-2 rounded-2xl border border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-purple-400" />
              <select
                value={funcFamily}
                onChange={(e) => {
                  setFuncFamily(e.target.value as FunctionFamily)
                  labAudio.playClick()
                }}
                className="bg-black/50 text-xs md:text-sm font-bold text-white rounded-lg px-2.5 py-1 border border-white/10 focus:outline-none focus:border-primary cursor-pointer"
              >
                {Object.values(FUNCTIONS_REGISTRY).map((f) => (
                  <option key={f.id} value={f.id} className="bg-slate-900 text-white">
                    {f.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Live Formula Display */}
            <div className="font-mono text-xs md:text-sm font-bold text-purple-300 bg-black/40 px-3 py-1 rounded-xl border border-white/5" dir="ltr">
              f(x) = {a !== 1 ? a.toFixed(1) : ""}
              {funcFamily === "quadratic" && `(x ${h >= 0 ? `- ${h.toFixed(1)}` : `+ ${Math.abs(h).toFixed(1)}`})²`}
              {funcFamily === "absolute" && `|x ${h >= 0 ? `- ${h.toFixed(1)}` : `+ ${Math.abs(h).toFixed(1)}`}|`}
              {funcFamily === "cubic" && `(x ${h >= 0 ? `- ${h.toFixed(1)}` : `+ ${Math.abs(h).toFixed(1)}`})³`}
              {funcFamily === "rational" && `1/(x ${h >= 0 ? `- ${h.toFixed(1)}` : `+ ${Math.abs(h).toFixed(1)}`})`}
              {funcFamily === "sine" && `sin(${b !== 1 ? b.toFixed(1) : ""}x)`}
              {funcFamily === "linear" && "x"}
              {k !== 0 && ` ${k > 0 ? "+" : "-"} ${Math.abs(k).toFixed(1)}`}
            </div>

            {/* Toggle Tools */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => {
                  setShowTangent(!showTangent)
                  labAudio.playClick()
                }}
                className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
                  showTangent ? "bg-amber-500/20 border-amber-500/50 text-amber-300" : "bg-white/5 border-white/10 text-slate-400"
                }`}
              >
                {t("المماس f'(x)", "Tangent f'(x)")}
              </button>
              <button
                onClick={() => {
                  setShowArea(!showArea)
                  labAudio.playClick()
                }}
                className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
                  showArea ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "bg-white/5 border-white/10 text-slate-400"
                }`}
              >
                {t("المساحة والتكامل ∫", "Area & Integral ∫")}
              </button>
            </div>
          </div>

          {/* Bottom Row: Parameter Sliders Grid */}
          <div className="glass p-3 rounded-2xl border border-white/10 shadow-xl grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {/* Slider a */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 font-semibold">
                <span>{t("معامل التمدد (a):", "Stretch / Scale (a):")}</span>
                <span className="font-mono text-white font-bold">{a.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.2"
                value={a}
                onChange={(e) => setA(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Slider h */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 font-semibold">
                <span>{t("الإزاحة الأفقية (h):", "Horiz. Shift (h):")}</span>
                <span className="font-mono text-white font-bold">{h.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-4"
                max="4"
                step="0.5"
                value={h}
                onChange={(e) => setH(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Slider k */}
            <div className="space-y-1">
              <div className="flex justify-between text-slate-400 font-semibold">
                <span>{t("الإزاحة الرأسية (k):", "Vert. Shift (k):")}</span>
                <span className="font-mono text-white font-bold">{k.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.5"
                value={k}
                onChange={(e) => setK(parseFloat(e.target.value))}
                className="w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Tangent Position / Area Readout */}
            {showTangent ? (
              <div className="space-y-1">
                <div className="flex justify-between text-amber-400 font-semibold">
                  <span>{t("نقطة التماس (x₀):", "Tangent Point (x₀):")}</span>
                  <span className="font-mono text-amber-300 font-bold">{tangentX.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="-4"
                  max="4"
                  step="0.2"
                  value={tangentX}
                  onChange={(e) => setTangentX(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            ) : showArea ? (
              <div className="flex flex-col justify-center items-center bg-emerald-500/10 rounded-xl p-1.5 border border-emerald-500/30">
                <span className="text-[10px] text-emerald-400 font-semibold">{t("المساحة تحت المنحنى ∫:", "Area Under Curve ∫:")}</span>
                <span className="font-mono text-sm font-black text-emerald-300">{integralValue} {t("وحدة²", "sq units")}</span>
              </div>
            ) : (
              <div className="flex items-center justify-center text-slate-400 text-center">
                {t("حرّك المنزلقات للتحويل الفوري", "Move sliders to transform")}
              </div>
            )}
          </div>
        </div>
      </LabHUD>
        </div>
      </LanguageProvider>
    </QualityProvider>
  )
}
