"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import * as THREE from "three"
import { useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import { LabCanvas, LabHUD, GuidedExperiment, labAudio, useQuality, useLabLanguage, BillboardLabel, QualityProvider, LanguageProvider } from "./3d"
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
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export interface PlanetData {
  id: string
  nameAr: string
  nameEn: string
  color: string
  textureUrl: string
  ringColor?: string
  ringTextureUrl?: string
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
  surfaceTempCEn: string
  moonsCount: number
  descriptionAr: string
  descriptionEn: string
  featuresAr: string[]
  featuresEn: string[]
}

export const PLANETS_DATABASE: PlanetData[] = [
  {
    id: "mercury",
    nameAr: "عطارد",
    nameEn: "Mercury",
    color: "#94a3b8",
    textureUrl: "/textures/planets/mercury.jpg",
    radiusVisual: 0.22,
    radiusReal: 0.1,
    distanceVisual: 2.8,
    distanceReal: 2.0,
    orbitPeriodDays: 88,
    rotationPeriodHours: 1407.6,
    axialTiltDeg: 0.034,
    gravityMps2: 3.7,
    massKg: "3.30 × 10²³",
    massEarthRelative: 0.055,
    radiusKm: 2439.7,
    surfaceTempC: "-180 إلى 430",
    surfaceTempCEn: "-180 to 430",
    moonsCount: 0,
    descriptionAr: "أصغر كواكب المجموعة الشمسية وأقربها إلى الشمس، سطحه مليء بالفوهات الصدمية ولا يمتلك غلافاً جوياً يحميه.",
    descriptionEn: "The smallest planet in the Solar System and closest to the Sun. Its heavily cratered surface lacks a protective atmosphere.",
    featuresAr: ["أسرع كوكب دوراناً حول الشمس (88 يوماً)", "تقلبات حرارية هي الأعنف في النظام الشمسي", "نواة حديدية ضخمة تمثل 75% من قطره"],
    featuresEn: ["Fastest orbit around the Sun (88 days)", "Extreme temperature swings", "Massive metallic iron core (75% of diameter)"],
  },
  {
    id: "venus",
    nameAr: "الزهرة",
    nameEn: "Venus",
    color: "#eab308",
    textureUrl: "/textures/planets/venus.jpg",
    radiusVisual: 0.35,
    radiusReal: 0.22,
    distanceVisual: 4.0,
    distanceReal: 3.2,
    orbitPeriodDays: 224.7,
    rotationPeriodHours: -5832.5, // retrograde
    axialTiltDeg: 177.3,
    gravityMps2: 8.87,
    massKg: "4.87 × 10²⁴",
    massEarthRelative: 0.815,
    radiusKm: 6051.8,
    surfaceTempC: "465 (أشد الكواكب حرارة)",
    surfaceTempCEn: "465 (Hottest planet)",
    moonsCount: 0,
    descriptionAr: "توأم الأرض حجماً، مغطى بسحب حمض الكبريتيك الكثيفة التي تسبب احتباساً حرارياً جامحاً، ويدور في اتجاه معاكس لبقية الكواكب.",
    descriptionEn: "Earth's twin in size, shrouded in thick sulfuric acid clouds that trap heat in a runaway greenhouse effect, rotating in reverse.",
    featuresAr: ["درجة حرارة تكفي لصهر الرصاص (465°C)", "دوران تراجعي بطيء (يومه أطول من سنته)", "ضغط جوي يعادل 90 ضعف ضغط الأرض"],
    featuresEn: ["Surface hot enough to melt lead (465°C)", "Retrograde rotation (day is longer than its year)", "Surface pressure 90 times greater than Earth's"],
  },
  {
    id: "earth",
    nameAr: "الأرض",
    nameEn: "Earth",
    color: "#38bdf8",
    textureUrl: "/textures/planets/2k_earth.jpg",
    radiusVisual: 0.38,
    radiusReal: 0.24,
    distanceVisual: 5.5,
    distanceReal: 4.4,
    orbitPeriodDays: 365.25,
    rotationPeriodHours: 24.0,
    axialTiltDeg: 23.44,
    gravityMps2: 9.81,
    massKg: "5.97 × 10²⁴",
    massEarthRelative: 1.0,
    radiusKm: 6371.0,
    surfaceTempC: "15",
    surfaceTempCEn: "15",
    moonsCount: 1,
    descriptionAr: "واحة الحياة الوحيدة في الكون المعروف، تتميز بمحيطات الماء السائل وغلاف جوي غني بالأكسجين ومجال مغناطيسي واقٍ.",
    descriptionEn: "The only known haven for life in the universe, featuring liquid oceans, a protective magnetic shield, and an oxygen-rich atmosphere.",
    featuresAr: ["تغطي المياه السائلة 71% من مساحتها", "ميل محوري 23.4° ينتج الفصول الأربعة", "يتبعها قمر طبيعي ينظم المد والجزر واستقرار المحور"],
    featuresEn: ["Liquid water covers 71% of surface", "Axial tilt of 23.4° produces four seasons", "Large moon stabilizes axial wobble and tides"],
  },
  {
    id: "mars",
    nameAr: "المريخ",
    nameEn: "Mars",
    color: "#ef4444",
    textureUrl: "/textures/planets/mars.jpg",
    radiusVisual: 0.28,
    radiusReal: 0.15,
    distanceVisual: 7.0,
    distanceReal: 6.0,
    orbitPeriodDays: 687.0,
    rotationPeriodHours: 24.6,
    axialTiltDeg: 25.19,
    gravityMps2: 3.72,
    massKg: "6.42 × 10²³",
    massEarthRelative: 0.107,
    radiusKm: 3389.5,
    surfaceTempC: "-63",
    surfaceTempCEn: "-63",
    moonsCount: 2,
    descriptionAr: "الكوكب الأحمر المثير للاهتمام، يحتوي على صدأ الحديد في تربته، ويضم بركان أوليمبوس الهائل وأدلة على مياه قديمة متدفقة.",
    descriptionEn: "The dusty Red Planet, colored by iron oxide. Home to Olympus Mons, the tallest volcano, and evidence of ancient running water.",
    featuresAr: ["جبل أوليمبوس: أعلى بركان في المجموعة الشمسية (21 كم)", "وادي مارينر: أطول وأعمق أخدود فضائي", "قمران صغيران: فوبوس وديموس"],
    featuresEn: ["Olympus Mons: tallest volcano in the Solar System (21 km)", "Valles Marineris: colossal canyon system", "Two moons: Phobos and Deimos"],
  },
  {
    id: "jupiter",
    nameAr: "المشتري",
    nameEn: "Jupiter",
    color: "#d97706",
    textureUrl: "/textures/planets/jupiter.jpg",
    radiusVisual: 0.8,
    radiusReal: 0.55,
    distanceVisual: 9.2,
    distanceReal: 9.0,
    orbitPeriodDays: 4332.6, // ~11.86 years
    rotationPeriodHours: 9.93,
    axialTiltDeg: 3.13,
    gravityMps2: 24.79,
    massKg: "1.90 × 10²⁷",
    massEarthRelative: 317.8,
    radiusKm: 69911.0,
    surfaceTempC: "-110",
    surfaceTempCEn: "-110",
    moonsCount: 95,
    descriptionAr: "سيد الكواكب وأضخمها على الإطلاق، كوكب غازي عملاق يتميز بالبقعة الحمراء العظيمة وهي عاصفة مستعرة تتسع لكوكب الأرض بأكمله.",
    descriptionEn: "The king of planets and largest of all. A gas giant marked by the iconic Great Red Spot, a swirling storm larger than Earth.",
    featuresAr: ["كتلته تفوق مجموع كتل باقي الكواكب بمرتين ونصف", "أسرع الكواكب دوراناً حول محوره (يومه 10 ساعات)", "يضم 95 قمراً من أشهرها أقمار غاليليو الأربعة"],
    featuresEn: ["More than twice as massive as all other planets combined", "Fastest rotation period (10-hour day)", "Hosts 95 moons including the four Galilean moons"],
  },
  {
    id: "saturn",
    nameAr: "زحل",
    nameEn: "Saturn",
    color: "#f59e0b",
    textureUrl: "/textures/planets/saturn.jpg",
    hasRings: true,
    ringColor: "#d97706",
    ringTextureUrl: "/textures/planets/saturn_ring.png",
    radiusVisual: 0.7,
    radiusReal: 0.48,
    distanceVisual: 11.5,
    distanceReal: 12.5,
    orbitPeriodDays: 10759.2, // ~29.4 years
    rotationPeriodHours: 10.7,
    axialTiltDeg: 26.73,
    gravityMps2: 10.44,
    massKg: "5.68 × 10²⁶",
    massEarthRelative: 95.2,
    radiusKm: 58232.0,
    surfaceTempC: "-140",
    surfaceTempCEn: "-140",
    moonsCount: 146,
    descriptionAr: "جوهرة المجموعة الشمسية بنظامه الحلقي البراق الرائع المكون من مليارات القطع الجليدية والصخور الفضائية التي تدور في انسجام مذهل.",
    descriptionEn: "The jewel of our Solar System, adorned with thousands of majestic ringlets made of ice crystals and space dust.",
    featuresAr: ["كثافته أقل من كثافة الماء (يطفو فوق محيط شاسع)", "حلقات ممتدة لآلاف الكيلومترات لكن سمكها أمتار قليلة", "يتبعه قمر تيتان ذو الغلاف الجوي الكثيف وبحيرات الميثان"],
    featuresEn: ["Lower density than liquid water", "Rings span hundreds of thousands of km but only meters thick", "Titan moon has a thick nitrogen atmosphere and methane seas"],
  },
  {
    id: "uranus",
    nameAr: "أورانوس",
    nameEn: "Uranus",
    color: "#22d3ee",
    textureUrl: "/textures/planets/uranus.jpg",
    radiusVisual: 0.5,
    radiusReal: 0.35,
    distanceVisual: 13.8,
    distanceReal: 16.5,
    orbitPeriodDays: 30685.4, // ~84 years
    rotationPeriodHours: -17.2,
    axialTiltDeg: 97.77, // sideways!
    gravityMps2: 8.69,
    massKg: "8.68 × 10²⁵",
    massEarthRelative: 14.5,
    radiusKm: 25362.0,
    surfaceTempC: "-195",
    surfaceTempCEn: "-195",
    moonsCount: 28,
    descriptionAr: "عملاق جليدي أزرق مخضر ساحر، يدور على جانبه بميل محوري فريد (98 درجة) كأنه يتدحرج على مداره الشمسي.",
    descriptionEn: "A serene cyan ice giant that orbits tilted almost completely on its side (98°), essentially rolling along its orbital path.",
    featuresAr: ["ميلانه الفريد يسبب نهاراً يستمر 42 سنة وليلاً يستمر 42 سنة", "غلاف جوي غني بالميثان يمنحه لونه الفيروزي المميز", "يضم 13 حلقة رقيقة معتمة"],
    featuresEn: ["Extreme 98° tilt produces 42-year polar daylight/darkness", "Atmospheric methane absorbs red light giving cyan color", "Surrounded by 13 faint, dark rings"],
  },
  {
    id: "neptune",
    nameAr: "نبتون",
    nameEn: "Neptune",
    color: "#2563eb",
    textureUrl: "/textures/planets/neptune.jpg",
    radiusVisual: 0.48,
    radiusReal: 0.34,
    distanceVisual: 16.0,
    distanceReal: 20.0,
    orbitPeriodDays: 60189.0, // ~164.8 years
    rotationPeriodHours: 16.1,
    axialTiltDeg: 28.32,
    gravityMps2: 11.15,
    massKg: "1.02 × 10²⁶",
    massEarthRelative: 17.1,
    radiusKm: 24622.0,
    surfaceTempC: "-200",
    surfaceTempCEn: "-200",
    moonsCount: 16,
    descriptionAr: "أبعد كواكب النظام الشمسي، كوكب أزرق جليدي غامض تعصف به أسرع رياح فوق صوتية مسجلة في الفضاء تتجاوز 2100 كم/ساعة.",
    descriptionEn: "The outermost planet, a vivid cobalt blue world whipped by supersonic winds exceeding 2,100 km/h.",
    featuresAr: ["أسرع رياح عاصفة في النظام الشمسي", "سنة نبتون تعادل 165 سنة أرضية كاملة", "قمره العملاق تريتون يدور في مدار تراجعي ويطلق ينابيع جليدية"],
    featuresEn: ["Fastest planetary winds in the Solar System", "One year equals 165 Earth years", "Moon Triton orbits backward with active cryogeysers"],
  },
]

// Safe asynchronous texture loader that never leaves meshes black
function useTextureSafe(url: string | undefined): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null)
  useEffect(() => {
    if (!url || typeof window === "undefined") return
    let isMounted = true
    const loader = new THREE.TextureLoader()
    loader.load(
      url,
      (loadedTex) => {
        if (!isMounted) return
        loadedTex.colorSpace = THREE.SRGBColorSpace
        loadedTex.needsUpdate = true
        setTexture(loadedTex)
      },
      undefined,
      (err) => {
        console.warn(`[SpaceLab] Texture fallback for ${url}:`, err)
      }
    )
    return () => {
      isMounted = false
    }
  }, [url])
  return texture
}

// 3D Asteroid Belt between Mars and Jupiter
function AsteroidBelt({ innerRadius = 7.8, outerRadius = 8.6, count = 120 }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const asteroids = useMemo(() => {
    return Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2
      const dist = innerRadius + Math.random() * (outerRadius - innerRadius)
      const y = (Math.random() - 0.5) * 0.4
      const scale = 0.025 + Math.random() * 0.045
      const rotSpeed = (Math.random() - 0.5) * 0.8
      return { angle, dist, y, scale, rotSpeed }
    })
  }, [count, innerRadius, outerRadius])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    asteroids.forEach((a, i) => {
      a.angle += delta * 0.03 * (8 / a.dist)
      dummy.position.set(Math.cos(a.angle) * a.dist, a.y, Math.sin(a.angle) * a.dist)
      dummy.rotation.x += delta * a.rotSpeed
      dummy.rotation.y += delta * a.rotSpeed
      dummy.scale.setScalar(a.scale)
      dummy.updateMatrix()
      meshRef.current?.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#64748b" roughness={0.9} metalness={0.2} />
    </instancedMesh>
  )
}

// 3D Starfield Galaxy Background
function DeepSpaceGalaxy() {
  const { particleCount } = useQuality()
  const count = Math.round(1800 * particleCount)

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const r = 50 + Math.random() * 35

      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i * 3 + 2] = r * Math.cos(phi)

      const tint = Math.random()
      if (tint > 0.85) {
        col[i * 3] = 0.4
        col[i * 3 + 1] = 0.8
        col[i * 3 + 2] = 1.0 // cyan blue star
      } else if (tint > 0.7) {
        col[i * 3] = 1.0
        col[i * 3 + 1] = 0.85
        col[i * 3 + 2] = 0.6 // golden star
      } else {
        col[i * 3] = 0.95
        col[i * 3 + 1] = 0.95
        col[i * 3 + 2] = 0.95 // white star
      }
    }
    return [pos, col]
  }, [count])

  const pointsRef = useRef<THREE.Points>(null)
  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.002
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={1.2} vertexColors transparent opacity={0.9} sizeAttenuation />
    </points>
  )
}

// 3D The Sun with Pulsing Corona & Dynamic Photosphere Texture
function CentralSun({ onClick }: { onClick: () => void }) {
  const sunMeshRef = useRef<THREE.Mesh>(null)
  const coronaRef = useRef<THREE.Mesh>(null)
  const sunTexture = useTextureSafe("/textures/planets/sun.jpg")

  useFrame(({ clock }, delta) => {
    if (sunMeshRef.current) {
      sunMeshRef.current.rotation.y += delta * 0.04
    }
    if (coronaRef.current) {
      const t = clock.getElapsedTime()
      coronaRef.current.scale.setScalar(1 + Math.sin(t * 1.5) * 0.04)
    }
  })

  return (
    <group onClick={onClick}>
      {/* Sun Stellar Core with Real Solar Photosphere or Radiant Fallback */}
      <mesh ref={sunMeshRef}>
        <sphereGeometry args={[1.35, 36, 36]} />
        {sunTexture ? (
          <meshBasicMaterial map={sunTexture} />
        ) : (
          <meshBasicMaterial color="#fef08a" />
        )}
      </mesh>

      {/* Pulsing Solar Corona */}
      <mesh ref={coronaRef}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.38} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.75, 32, 32]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.15} />
      </mesh>

      {/* Radiant Solar Lights */}
      <pointLight color="#fffbeb" intensity={8.0} distance={160} decay={0.5} />
      <ambientLight intensity={0.65} color="#e2e8f0" />
      <hemisphereLight intensity={0.45} color="#38bdf8" groundColor="#0f172a" />
    </group>
  )
}

// Orbital Path Ring
function OrbitTrack({ radius }: { radius: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.015, radius + 0.015, 64]} />
      <meshBasicMaterial color="#475569" side={THREE.DoubleSide} transparent opacity={0.35} />
    </mesh>
  )
}

// 3D Planet Component with Keplerian Motion, Detailed Surface Textures & Rotation
function Planet3D({
  data,
  isRealScale,
  timeMultiplier,
  isPaused,
  isFocused,
  onSelect,
  onPositionUpdate,
}: {
  data: PlanetData
  isRealScale: boolean
  timeMultiplier: number
  isPaused: boolean
  isFocused: boolean
  onSelect: (pos: THREE.Vector3) => void
  onPositionUpdate?: (id: string, pos: THREE.Vector3) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const planetMeshRef = useRef<THREE.Mesh>(null)
  const atmosphereRef = useRef<THREE.Mesh>(null)

  const radius = isRealScale ? data.radiusReal : data.radiusVisual
  const distance = isRealScale ? data.distanceReal : data.distanceVisual

  // Safe async texture loaders with instant procedural fallbacks
  const planetTexture = useTextureSafe(data.textureUrl)
  const ringTexture = useTextureSafe(data.ringTextureUrl)
  const moonTexture = useTextureSafe("/textures/planets/moon.jpg")

  // Keplerian angular speed: v proportional to 1 / sqrt(r)
  const orbitSpeed = (365 / data.orbitPeriodDays) * 0.14
  const currentAngleRef = useRef(Math.random() * Math.PI * 2)

  useFrame((_, delta) => {
    if (!isPaused && !isFocused) {
      currentAngleRef.current += delta * orbitSpeed * timeMultiplier
      const x = Math.cos(currentAngleRef.current) * distance
      const z = Math.sin(currentAngleRef.current) * distance

      if (groupRef.current) {
        groupRef.current.position.set(x, 0, z)
        onPositionUpdate?.(data.id, groupRef.current.position)
      }
    }

    if (planetMeshRef.current) {
      // Axial rotation
      const spinSpeed = (24 / Math.abs(data.rotationPeriodHours)) * 0.7
      planetMeshRef.current.rotation.y += delta * spinSpeed * (data.rotationPeriodHours < 0 ? -1 : 1)
    }

    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y += delta * 0.06
    }
  })

  const tiltRad = (data.axialTiltDeg * Math.PI) / 180

  return (
    <>
      {/* Orbital Trail */}
      <OrbitTrack radius={distance} />

      {/* Orbiting Planet Group */}
      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation()
          const worldPos = new THREE.Vector3()
          if (groupRef.current) {
            worldPos.copy(groupRef.current.position)
          }
          onSelect(worldPos)
          labAudio.playClick(850)
        }}
      >
        {/* Tilted Axis */}
        <group rotation={[0, 0, tiltRad]}>
          <mesh ref={planetMeshRef} castShadow receiveShadow>
            <sphereGeometry args={[radius, 48, 48]} />
            <meshStandardMaterial
              map={planetTexture || undefined}
              color={planetTexture ? "#ffffff" : data.color}
              roughness={data.id === "earth" ? 0.35 : 0.65}
              metalness={0.05}
            />
          </mesh>

          {/* Earth Atmosphere & Clouds Layer */}
          {data.id === "earth" && (
            <mesh ref={atmosphereRef}>
              <sphereGeometry args={[radius * 1.025, 36, 36]} />
              <meshStandardMaterial
                color="#ffffff"
                transparent
                opacity={0.35}
                roughness={0.8}
              />
            </mesh>
          )}

          {/* Venus Sulfuric Haze Layer */}
          {data.id === "venus" && (
            <mesh>
              <sphereGeometry args={[radius * 1.03, 32, 32]} />
              <meshStandardMaterial
                color="#fef08a"
                transparent
                opacity={0.2}
                roughness={0.9}
              />
            </mesh>
          )}

          {/* Mars Thin Atmosphere */}
          {data.id === "mars" && (
            <mesh>
              <sphereGeometry args={[radius * 1.025, 32, 32]} />
              <meshStandardMaterial
                color="#f87171"
                transparent
                opacity={0.15}
                roughness={0.9}
              />
            </mesh>
          )}

          {/* Neptune Deep Azure Halo */}
          {data.id === "neptune" && (
            <mesh>
              <sphereGeometry args={[radius * 1.03, 32, 32]} />
              <meshStandardMaterial
                color="#60a5fa"
                transparent
                opacity={0.22}
                roughness={0.9}
              />
            </mesh>
          )}

          {/* Saturn's Rings (Realistic with Ring Alpha Texture) */}
          {data.hasRings && (
            <group rotation={[-Math.PI / 2, 0, 0]}>
              <mesh>
                <ringGeometry args={[radius * 1.35, radius * 2.35, 64]} />
                <meshStandardMaterial
                  map={ringTexture || undefined}
                  color={ringTexture ? "#ffffff" : "#d97706"}
                  side={THREE.DoubleSide}
                  transparent
                  opacity={0.9}
                  roughness={0.3}
                />
              </mesh>
            </group>
          )}

          {/* Earth's Moon with Real Texture */}
          {data.id === "earth" && (
            <group position={[radius * 2.1, 0, 0]}>
              <mesh castShadow receiveShadow>
                <sphereGeometry args={[radius * 0.27, 24, 24]} />
                <meshStandardMaterial
                  map={moonTexture || undefined}
                  color={moonTexture ? "#ffffff" : "#cbd5e1"}
                  roughness={0.85}
                />
              </mesh>
            </group>
          )}
        </group>
      </group>
    </>
  )
}

// Camera Focus Controller to smoothly fly to a clicked planet or zoom out
function PlanetCameraGlide({
  targetPlanet,
  targetPos,
  controlsRef,
  onResetComplete,
}: {
  targetPlanet: PlanetData | null
  targetPos: THREE.Vector3 | null
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  onResetComplete?: () => void
}) {
  const { camera } = useThree()
  const isGlidingRef = useRef(false)
  const destPosRef = useRef(new THREE.Vector3(0, 18, 24))
  const destTargetRef = useRef(new THREE.Vector3(0, 0, 0))

  useEffect(() => {
    if (controlsRef.current) {
      isGlidingRef.current = true
      if (targetPlanet) {
        // Position camera close to planet using its real orbital position
        const p = targetPos || new THREE.Vector3(targetPlanet.distanceVisual, 0, 0)
        const offset = Math.max(targetPlanet.radiusVisual * 3.4, 0.7)
        destPosRef.current.set(p.x + offset, p.y + offset * 0.45, p.z + offset)
        destTargetRef.current.copy(p)
      } else {
        // Zoom out to whole solar system overview
        destPosRef.current.set(0, 18, 24)
        destTargetRef.current.set(0, 0, 0)
      }
    }
  }, [targetPlanet, targetPos, controlsRef])

  useFrame((_, delta) => {
    if (isGlidingRef.current && controlsRef.current) {
      camera.position.lerp(destPosRef.current, delta * 3.5)
      controlsRef.current.target.lerp(destTargetRef.current, delta * 3.5)
      controlsRef.current.update()

      if (camera.position.distanceTo(destPosRef.current) < 0.15) {
        isGlidingRef.current = false
        onResetComplete?.()
      }
    }
  })

  return null
}

// 4 Guided Experiments for Space & Planets Lab (Bilingual)
export const SPACE_GUIDED_EXPERIMENTS: GuidedExperiment[] = [
  {
    id: "kepler-laws",
    title: "حركة الكواكب وقوانين كبلر الثلاثة",
    titleEn: "Planetary Motion & Kepler's Three Laws",
    curriculumRef: "الفيزياء - قوانين الجاذبية الكونية وحركة الأجرام السماوية",
    curriculumRefEn: "Physics - Universal Gravitation & Celestial Mechanics",
    description: "التحقق من أن مدارات الكواكب إهليلجية، وأن سرعة الكوكب تزداد كلما اقترب من الشمس وفق قانون المساحات.",
    descriptionEn: "Verify that planetary orbits are elliptical and orbital speed increases as a planet nears the Sun.",
    steps: [
      {
        title: "مقارنة سرعة عطارد ونبتون",
        titleEn: "Compare Mercury and Neptune speeds",
        instruction: "لاحظ سرعة دوران عطارد (القريب من الشمس: 88 يوماً) مقارنة بنبتون (الأبعد: 165 سنة).",
        instructionEn: "Observe Mercury's rapid orbit (88 days) compared to distant Neptune (165 Earth years).",
        hint: "وفق قانون كبلر الثالث: مربع زمن الدورة المدارية يتناسب طردياً مع مكعب نصف القطر (T² ∝ r³).",
        hintEn: "According to Kepler's Third Law, the square of the orbital period is proportional to the cube of the semi-major axis (T² ∝ r³).",
      },
      {
        title: "تسريع المحاكاة لملاحظة الدورات",
        titleEn: "Speed up time to observe complete orbits",
        instruction: "استخدم زر التسريع (20x) لمشاهدة اكتمال دورات الكواكب الداخلية السريعة حول الشمس.",
        instructionEn: "Use the 20x speed button to watch inner planets complete full orbits quickly.",
        hint: "الشمس تقع في إحدى بؤرتي المدار البيضاوي وفق قانون كبلر الأول.",
        hintEn: "The Sun is at one focus of each elliptical orbit according to Kepler's First Law.",
      },
    ],
    quiz: {
      question: "وفقاً لقانون كبلر الثاني (قانون المساحات)، تكون سرعة الكوكب في مداره أكبر ما يمكن عندما يكون:",
      questionEn: "According to Kepler's Second Law, a planet travels fastest in its orbit when:",
      options: [
        "في نقطة الحضيض (أقرب نقطة إلى الشمس)",
        "في نقطة الأوج (أبعد نقطة عن الشمس)",
        "سرعة الكوكب ثابتة لا تتغير في أي نقطة",
        "عندما يتعامد محوره مع مستوى المدار",
      ],
      optionsEn: [
        "At perihelion (closest point to the Sun)",
        "At aphelion (farthest point from the Sun)",
        "The speed is constant throughout the orbit",
        "When its axis is perpendicular to the orbital plane",
      ],
      correctIndex: 0,
      explanation: "الخط الوهمي الواصل بين الشمس والكوكب يمسح مساحات متساوية في أزمنة متساوية، لذا يتحرك الكوكب أسرع ما يمكن عند اقترابه من الشمس في الحضيض.",
      explanationEn: "A line segment joining a planet and the Sun sweeps out equal areas during equal intervals of time, making it fastest at perihelion.",
    },
  },
  {
    id: "gravitational-weight",
    title: "الجاذبية الكونية وحساب الأوزان على الكواكب",
    titleEn: "Universal Gravitation & Planetary Weights",
    curriculumRef: "الفيزياء - قانون الجذب العام لنيوتن وحساب شدة مجال الجاذبية",
    curriculumRefEn: "Physics - Newton's Law of Universal Gravitation",
    description: "استكشف كيف يتغير وزنك على أسطح الكواكب بناءً على كتلة الكوكب ونصف قطره (g = GM/R²).",
    descriptionEn: "Explore how weight varies across planetary surfaces based on mass and radius (g = GM/R²).",
    steps: [
      {
        title: "حساب الوزن على المشتري",
        titleEn: "Calculate your weight on Jupiter",
        instruction: "افتح حاسبة الأوزان واضغط على المشتري: ستلاحظ أن وزنك يتضاعف بحوالي 2.5 مرة نتيجة كتلته الهائلة.",
        instructionEn: "Open the weight calculator and select Jupiter: your weight increases by ~2.5x due to its immense mass.",
        hint: "تسارع جاذبية المشتري 24.8 م/ث² مقارنة بـ 9.8 م/ث² على الأرض.",
        hintEn: "Jupiter's surface gravity is 24.8 m/s² compared to 9.8 m/s² on Earth.",
      },
      {
        title: "حساب الوزن على القمر والمريخ",
        titleEn: "Calculate your weight on the Moon and Mars",
        instruction: "قارن وزنك على القمر (سُدس وزنك على الأرض g ≈ 1.6) وعلى المريخ (g ≈ 3.7).",
        instructionEn: "Compare your weight on the Moon (1/6th of Earth g ≈ 1.6) and Mars (g ≈ 3.7).",
        hint: "الكتلة تظل ثابتة في أي مكان في الكون، بينما الوزن يتغير بتغير عجلة الجاذبية المحلية.",
        hintEn: "Mass is an invariant property everywhere in the universe; weight varies with local gravitational acceleration.",
      },
    ],
    quiz: {
      question: "إذا كانت كتلة رائد فضاء 70 kg على سطح الأرض، فإن كتلته على سطح القمر تساوي:",
      questionEn: "If an astronaut has a mass of 70 kg on Earth, what is their mass on the Moon?",
      options: ["70 kg (ثابتة لا تتغير)", "11.6 kg", "420 kg", "صفر بسبب انعدام الوزن"],
      optionsEn: ["70 kg (invariant / does not change)", "11.6 kg", "420 kg", "Zero due to weightlessness"],
      correctIndex: 0,
      explanation: "الكتلة هي مقدار ما يحتويه الجسم من مادة وهي خاصية ثابتة لا تتغير، أما وزنه (W = mg) فهو الذي يقل على القمر إلى السدس.",
      explanationEn: "Mass is the amount of matter in an object and is constant everywhere. Weight (W = mg) is what changes.",
    },
  },
  {
    id: "moon-phases-eclipse",
    title: "أطوار القمر وظاهرة الكسوف والخسوف",
    titleEn: "Lunar Phases, Solar & Lunar Eclipses",
    curriculumRef: "الفلك والفيزياء - أطوار القمر وحجب الضوء الفضائي",
    curriculumRefEn: "Astronomy & Physics - Moon Phases and Cosmic Shadows",
    description: "فهم سبب ظهور القمر بأشكال مختلفة (محاق، هلال، تربيع، بدر) وحالات الكسوف والخسوف.",
    descriptionEn: "Understand lunar phases and the cosmic geometry of solar and lunar eclipses.",
    steps: [
      {
        title: "فحص موقع القمر بالنسبة للشمس والأرض",
        titleEn: "Inspect Moon position relative to Sun and Earth",
        instruction: "لاحظ أن نصف القمر المواجه للشمس مضاء دائماً، لكن الجزء الذي نراه من الأرض يتغير باستمرار خلال دورته الشهرية (29.5 يوماً).",
        instructionEn: "Notice that half of the Moon is always illuminated by the Sun, but the portion visible from Earth changes over its 29.5-day synodic cycle.",
        hint: "عندما يكون القمر بين الأرض والشمس يكون في طور 'المحاق' ولا نرى جانبه المضاء.",
        hintEn: "When the Moon is between Earth and Sun, it is in New Moon phase and its lit side faces away.",
      },
      {
        title: "الفرق بين كسوف الشمس وخسوف القمر",
        titleEn: "Difference between Solar and Lunar Eclipse",
        instruction: "الكسوف الشمسي يحدث عندما يقع القمر تماماً بين الشمس والأرض فيحجب ضوءها، بينما الخسوف يحدث عندما تقع الأرض بين الشمس والقمر فتلقي بظلها عليه.",
        instructionEn: "A solar eclipse occurs when the Moon blocks the Sun from Earth; a lunar eclipse occurs when Earth casts its shadow onto the Moon.",
        hint: "الكسوف يحدث نهاراً في طور المحاق، والخسوف يحدث ليلاً في طور البدر.",
        hintEn: "Solar eclipses occur during New Moon; lunar eclipses occur during Full Moon.",
      },
    ],
    quiz: {
      question: "تحدث ظاهرة خسوف القمر (Lunar Eclipse) عندما:",
      questionEn: "A lunar eclipse occurs when:",
      options: [
        "تقع الأرض بين الشمس والقمر على استقامة واحدة (في طور البدر)",
        "يقع القمر بين الشمس والأرض على استقامة واحدة (في طور المحاق)",
        "يتعامد مدار القمر مع مدار الأرض",
        "تصل سرعة دوران القمر لضعف سرعة الأرض",
      ],
      optionsEn: [
        "Earth is directly between the Sun and Moon (Full Moon phase)",
        "The Moon is directly between the Sun and Earth (New Moon phase)",
        "The Moon's orbit is perpendicular to Earth's orbit",
        "The Moon moves at twice Earth's velocity",
      ],
      correctIndex: 0,
      explanation: "عندما تقع الأرض بين الشمس والقمر، تحجب الأرض أشعة الشمس عن القمر ويلقي كوكبنا بظله على سطح القمر، ويكون ذلك منتصف الشهر القمري (طور البدر).",
      explanationEn: "Earth passes between the Sun and the Moon, casting Earth's shadow across the lunar surface during the Full Moon.",
    },
  },
  {
    id: "orbital-escape-velocity",
    title: "السرعة المدارية وسرعة الإفلات",
    titleEn: "Orbital & Escape Velocity",
    curriculumRef: "الفيزياء - الأقمار الصناعية وحركة الصواريخ الفضائية",
    curriculumRefEn: "Physics - Satellite Motion & Escape Velocity",
    description: "تطبيق قوانين نيوتن لمعرفة السرعة المطلوبة لوضع قمر صناعي في مدار مستقر أو الهروب من الجاذبية.",
    descriptionEn: "Apply Newtonian physics to determine the speed needed for circular orbits vs escaping gravity.",
    steps: [
      {
        title: "السرعة المدارية الأولى",
        titleEn: "First Cosmic / Orbital Velocity",
        instruction: "لحساب السرعة المدارية للأقمار الصناعية نطبق القانون v = √(GM/r)، وتبلغ حوالي 7.9 كم/ث بالقرب من سطح الأرض.",
        instructionEn: "Orbital velocity is given by v = √(GM/r), approximately 7.9 km/s near Earth's surface.",
        hint: "عند هذه السرعة تتعادل القوة الجاذبة المركزية مع وزن القمر الصناعي فيدور في مدار دائري دون أن يسقط.",
        hintEn: "Centripetal acceleration balances gravitational pull, keeping the satellite in stable circular orbit.",
      },
      {
        title: "سرعة الإفلات من الجاذبية",
        titleEn: "Escape Velocity",
        instruction: "لكي تفلت مركبة فضائية من جاذبية الأرض دون عودة، يجب أن تصل لسرعة v_esc = √(2GM/r) ≈ 11.2 كم/ث.",
        instructionEn: "To break free from Earth's gravitational field, an object must reach v_esc = √(2GM/r) ≈ 11.2 km/s.",
        hint: "سرعة الإفلات تساوي دائماً الجذر التربيعي لـ 2 مضروباً في السرعة المدارية (v_esc = √2 × v_orbit).",
        hintEn: "Escape velocity is always √2 times the circular orbital velocity at the same radius.",
      },
    ],
    quiz: {
      question: "النسبة بين سرعة الإفلات من جاذبية كوكب إلى السرعة المدارية لقمر يدور بالقرب من سطحه هي:",
      questionEn: "The ratio between escape velocity from a planet and orbital velocity at its surface is:",
      options: ["√2 : 1 (حوالي 1.414)", "2 : 1", "1 : 2", "4 : 1"],
      optionsEn: ["√2 : 1 (~1.414)", "2 : 1", "1 : 2", "4 : 1"],
      correctIndex: 0,
      explanation: "سرعة الإفلات v_esc = √(2GM/R) بينما السرعة المدارية v = √(GM/R)، وبقسمتهما تكون النسبة √2 إلى 1.",
      explanationEn: "Since v_esc = √(2GM/R) and v_orb = √(GM/R), their ratio is precisely √2 : 1.",
    },
  },
]

export function SpaceLab() {
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(null)
  const [selectedPlanetPos, setSelectedPlanetPos] = useState<THREE.Vector3 | null>(null)
  const [isRealScale, setIsRealScale] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [timeMultiplier, setTimeMultiplier] = useState(1)

  // Track real-time 3D positions of orbiting planets
  const planetPositionsRef = useRef<Record<string, THREE.Vector3>>({})

  // Weight calculator state
  const [studentMass, setStudentMass] = useState(70)
  const [showWeightCalc, setShowWeightCalc] = useState(false)

  // Guided Experiments HUD
  const [activeExpIndex, setActiveExpIndex] = useState(0)
  const [isSandbox, setIsSandbox] = useState(false)
  const [cameraResetSignal, setCameraResetSignal] = useState(0)

  const controlsRef = useRef<OrbitControlsImpl>(null)
  const { lang, t, isAr } = useLabLanguage()

  const handleSelectPlanet = (planet: PlanetData, pos?: THREE.Vector3) => {
    setSelectedPlanet(planet)
    setSelectedPlanetPos(pos || planetPositionsRef.current[planet.id] || null)
    labAudio.playClick(900)
  }

  const handleZoomOut = () => {
    setSelectedPlanet(null)
    setSelectedPlanetPos(null)
    setCameraResetSignal((prev) => prev + 1)
    labAudio.playClick(750)
  }

  const handleResetLab = () => {
    setSelectedPlanet(null)
    setSelectedPlanetPos(null)
    setIsRealScale(false)
    setIsPaused(false)
    setTimeMultiplier(1)
    setCameraResetSignal((prev) => prev + 1)
  }

  return (
    <QualityProvider>
      <LanguageProvider>
        <div className="relative w-full h-full min-h-[480px] flex-1">
          <LabCanvas
            camera={{ position: [0, 18, 24], fov: 45, far: 1000 }}
            onResetCamera={handleZoomOut}
          >
            <OrbitControls
              ref={controlsRef}
              makeDefault
              enableDamping
              dampingFactor={0.06}
              minDistance={1.2}
              maxDistance={50}
              maxPolarAngle={Math.PI / 2 + 0.15}
            />

            {/* Camera Glide Controller to smoothly fly in close-up or out */}
            <PlanetCameraGlide
              targetPlanet={selectedPlanet}
              targetPos={selectedPlanetPos}
              controlsRef={controlsRef}
            />

            {/* Deep Space Milky Way Galaxy Stars */}
            <DeepSpaceGalaxy />

            {/* Central Sun */}
            <CentralSun onClick={handleZoomOut} />

            {/* Asteroid Belt between Mars & Jupiter */}
            <AsteroidBelt innerRadius={7.8} outerRadius={8.6} count={120} />

            {/* The 8 Planets */}
            {PLANETS_DATABASE.map((planet) => (
              <Planet3D
                key={planet.id}
                data={planet}
                isRealScale={isRealScale}
                timeMultiplier={timeMultiplier}
                isPaused={isPaused}
                isFocused={selectedPlanet?.id === planet.id}
                onSelect={(pos) => handleSelectPlanet(planet, pos)}
                onPositionUpdate={(id, pos) => {
                  planetPositionsRef.current[id] = pos
                }}
              />
            ))}
          </LabCanvas>

          {/* Floating Selected Planet Dossier Side Panel (Docked on Side, 100% Unobstructed Center) */}
          {selectedPlanet && (
            <div className="absolute top-16 end-4 bottom-24 w-80 md:w-96 glass p-4 rounded-2xl border border-cyan-500/30 bg-slate-950/90 shadow-2xl overflow-y-auto pointer-events-auto z-20 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: selectedPlanet.color }} />
                  <h3 className="text-sm md:text-base font-black text-white">
                    {t(
                      `كوكب ${selectedPlanet.nameAr} (${selectedPlanet.nameEn})`,
                      `Planet ${selectedPlanet.nameEn} (${selectedPlanet.nameAr})`
                    )}
                  </h3>
                </div>
                <button
                  onClick={handleZoomOut}
                  className="text-xs text-slate-400 hover:text-white font-bold px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10"
                >
                  ✕ {t("إغلاق", "Close")}
                </button>
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">
                {isAr ? selectedPlanet.descriptionAr : selectedPlanet.descriptionEn}
              </p>

              {/* Distinctive Features List */}
              <div className="flex flex-wrap gap-1 pt-1">
                {(isAr ? selectedPlanet.featuresAr : selectedPlanet.featuresEn).map((feat, i) => (
                  <span key={i} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-cyan-200">
                    ★ {feat}
                  </span>
                ))}
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <div className="text-slate-400 text-[10px]">{t("عجلة الجاذبية (g):", "Gravity (g):")}</div>
                  <div className="font-mono font-bold text-cyan-300">{selectedPlanet.gravityMps2} m/s²</div>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <div className="text-slate-400 text-[10px]">{t("نصف القطر:", "Radius:")}</div>
                  <div className="font-mono font-bold text-white">{selectedPlanet.radiusKm.toLocaleString()} km</div>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <div className="text-slate-400 text-[10px]">{t("طول السنة (المدار):", "Orbital Year:")}</div>
                  <div className="font-mono font-bold text-amber-300">{selectedPlanet.orbitPeriodDays.toLocaleString()} {t("يوم", "days")}</div>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                  <div className="text-slate-400 text-[10px]">{t("درجة الحرارة:", "Temperature:")}</div>
                  <div className="font-mono font-bold text-rose-300">{isAr ? selectedPlanet.surfaceTempC : selectedPlanet.surfaceTempCEn}°C</div>
                </div>
              </div>

              {/* Weight on this planet calculation */}
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between text-xs">
                <span className="text-slate-300">{t(`وزنك (70 كجم) هنا:`, `Your weight (70kg) here:`)}</span>
                <span className="font-mono font-bold text-cyan-300 text-sm">
                  {((70 * selectedPlanet.gravityMps2) / 9.81).toFixed(1)} kg ({ (70 * selectedPlanet.gravityMps2).toFixed(0) } N)
                </span>
              </div>
            </div>
          )}

          {/* 2D Interactive HUD Overlay */}
          <LabHUD
            title="مختبر الفضاء والمجموعة الشمسية ثلاثي الأبعاد"
            titleEn="3D Space & Solar System Laboratory"
            subjectTitle="الفيزياء الفلكية"
            subjectTitleEn="Astrophysics"
            curriculumGrade="الثانوية العامة"
            curriculumGradeEn="Secondary Physics"
            guidedExperiments={SPACE_GUIDED_EXPERIMENTS}
            activeExpIndex={activeExpIndex}
            onSelectExp={setActiveExpIndex}
            isSandbox={isSandbox}
            onToggleSandbox={setIsSandbox}
            onResetCamera={handleZoomOut}
            onResetExperiment={handleResetLab}
          >
            {/* Sleek Compact Space Lab Controls Docked at Bottom */}
            <div className="flex flex-col gap-1.5 pointer-events-auto max-w-4xl mx-auto w-full px-2">
              <div className="glass px-3 py-1.5 rounded-2xl border border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                {/* Time Controls */}
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsPaused(!isPaused)
                      labAudio.playClick()
                    }}
                    className="h-7 px-2 rounded-lg font-bold text-xs hover:bg-white/10"
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5 text-emerald-400 ml-1" /> : <Pause className="w-3.5 h-3.5 text-amber-400 ml-1" />}
                    <span>{isPaused ? t("تشغيل", "Play") : t("إيقاف", "Pause")}</span>
                  </Button>

                  <div className="flex bg-black/40 p-0.5 rounded-lg border border-white/5 text-[11px]">
                    {[1, 5, 20, 100].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => {
                          setTimeMultiplier(speed)
                          labAudio.playClick()
                        }}
                        className={`px-1.5 py-0.5 rounded-md font-semibold transition-all ${
                          timeMultiplier === speed ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-[1px] h-4 bg-white/10 hidden sm:block" />

                {/* Planet Selector Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
                  {PLANETS_DATABASE.map((p) => {
                    const isSelected = selectedPlanet?.id === p.id
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectPlanet(p)}
                        className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 border ${
                          isSelected
                            ? "bg-primary text-white border-primary shadow-md"
                            : "glass text-slate-300 border-white/5 hover:border-white/20"
                        }`}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <span>{isAr ? p.nameAr : p.nameEn}</span>
                      </button>
                    )
                  })}
                </div>

                <div className="w-[1px] h-4 bg-white/10 hidden sm:block" />

                {/* Scale Switcher & Overview Button */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setIsRealScale(!isRealScale)
                      labAudio.playClick()
                    }}
                    className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      isRealScale ? "bg-primary text-white border-primary" : "glass text-slate-400 border-white/10"
                    }`}
                    title={isRealScale ? t("التبديل إلى مقياس تعليمي", "Switch to visual scale") : t("التبديل إلى مقياس حقيقي", "Switch to real scale")}
                  >
                    {isRealScale ? t("مقياس حقيقي", "Real Scale") : t("مقياس تعليمي", "Visual Scale")}
                  </button>

                  {selectedPlanet && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleZoomOut}
                      className="h-7 px-2 rounded-lg glass font-bold text-xs text-amber-300 border-amber-500/30"
                    >
                      <ZoomOut className="w-3 h-3 ml-1" />
                      {t("نظرة عامة", "Overview")}
                    </Button>
                  )}

                  <button
                    onClick={() => {
                      setShowWeightCalc(!showWeightCalc)
                      labAudio.playClick()
                    }}
                    className={`p-1.5 rounded-lg border text-xs transition-all ${
                      showWeightCalc ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300" : "glass border-white/10 text-slate-400 hover:text-white"
                    }`}
                    title={t("حاسبة الوزن على الكواكب", "Planet Weight Calculator")}
                  >
                    <Scale className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Weight on Other Planets Drawer */}
              {showWeightCalc && (
                <div className="glass p-3 rounded-2xl border border-cyan-500/30 bg-slate-950/90 shadow-2xl space-y-2 animate-fade-in text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-cyan-300">
                      <Scale className="w-3.5 h-3.5" />
                      <span>{t("حاسبة وزنك على أسطح الكواكب (W = m · g)", "Weight on Other Planets (W = m · g)")}</span>
                    </div>
                    <button onClick={() => setShowWeightCalc(false)} className="text-slate-400 hover:text-white">✕</button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">{t("كتلتك على الأرض:", "Earth mass:")}</span>
                    <input
                      type="number"
                      min="20"
                      max="150"
                      value={studentMass}
                      onChange={(e) => setStudentMass(Math.max(1, parseFloat(e.target.value) || 0))}
                      className="w-16 bg-black/60 border border-white/20 rounded-lg px-2 py-0.5 text-center font-mono font-bold text-white text-xs"
                    />
                    <span className="text-slate-400">kg</span>
                  </div>

                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-1 text-[11px]">
                    {PLANETS_DATABASE.map((p) => {
                      const weightNewtons = studentMass * p.gravityMps2
                      const apparentKg = (weightNewtons / 9.81).toFixed(1)
                      return (
                        <div key={p.id} className="bg-white/5 p-1.5 rounded-xl border border-white/5 flex flex-col items-center text-center">
                          <span className="text-slate-300 text-[10px] truncate">{isAr ? p.nameAr : p.nameEn}</span>
                          <span className="font-mono font-bold text-cyan-300">{apparentKg} kg</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </LabHUD>
        </div>
      </LanguageProvider>
    </QualityProvider>
  )
}
