"use client"

import React, { useState, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { Text, Float } from "@react-three/drei"
import { LabCanvas, LabRoom, LabHUD, GuidedExperiment, labAudio, useQuality } from "./3d"
import { AlertTriangle, Zap, Gauge, Sliders, Activity, Lightbulb } from "lucide-react"

// Resistor 4-band color calculation
function getResistorBands(ohms: number) {
  const colorMap = [
    "#000000", // 0 Black
    "#854d0e", // 1 Brown
    "#dc2626", // 2 Red
    "#ea580c", // 3 Orange
    "#eab308", // 4 Yellow
    "#16a34a", // 5 Green
    "#2563eb", // 6 Blue
    "#9333ea", // 7 Violet
    "#64748b", // 8 Grey
    "#ffffff", // 9 White
  ]
  const str = Math.round(ohms).toString()
  const d1 = parseInt(str[0] || "1", 10)
  const d2 = parseInt(str[1] || "0", 10)
  const multiplier = Math.max(0, str.length - 2)

  return [
    colorMap[d1] || "#854d0e",
    colorMap[d2] || "#000000",
    colorMap[multiplier] || "#854d0e",
    "#d97706", // Gold 5% tolerance
  ]
}

// Animated Current Flow Particles along 3D Curve
function WireParticles({
  curve,
  current,
  color = "#38bdf8",
}: {
  curve: THREE.CatmullRomCurve3
  current: number
  color?: string
}) {
  const { particleCount } = useQuality()
  const count = Math.round(18 * particleCount)
  const pointsRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const progressOffsets = useMemo(
    () => Array.from({ length: count }, (_, i) => i / count),
    [count]
  )

  useFrame((_, delta) => {
    if (!pointsRef.current || current <= 0) return

    // Speed scales with electric current
    const speed = Math.min(Math.max(current * 0.12, 0.05), 0.8)

    for (let i = 0; i < count; i++) {
      progressOffsets[i] = (progressOffsets[i] + delta * speed) % 1
      const pt = curve.getPointAt(progressOffsets[i])
      const tangent = curve.getTangentAt(progressOffsets[i])

      dummy.position.copy(pt)
      dummy.scale.setScalar(0.018)
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent)
      dummy.updateMatrix()
      pointsRef.current.setMatrixAt(i, dummy.matrix)
    }
    pointsRef.current.instanceMatrix.needsUpdate = true
  })

  if (current <= 0 || count === 0) return null

  return (
    <instancedMesh ref={pointsRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={color} />
    </instancedMesh>
  )
}

// 3D Connecting Wire Mesh
function WirePath({
  start,
  end,
  current,
  wireColor = "#334155",
}: {
  start: [number, number, number]
  end: [number, number, number]
  current: number
  wireColor?: string
}) {
  const curve = useMemo(() => {
    const p1 = new THREE.Vector3(...start)
    const p2 = new THREE.Vector3(...end)
    const mid = new THREE.Vector3()
      .addVectors(p1, p2)
      .multiplyScalar(0.5)
      .add(new THREE.Vector3(0, -0.05 + Math.random() * 0.02, 0)) // slight natural wire sag
    return new THREE.CatmullRomCurve3([p1, mid, p2])
  }, [start, end])

  const tubeGeo = useMemo(() => new THREE.TubeGeometry(curve, 32, 0.012, 8, false), [curve])

  return (
    <group>
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial color={wireColor} roughness={0.6} metalness={0.2} />
      </mesh>
      <WireParticles curve={curve} current={current} />
    </group>
  )
}

// 3D Power Supply Unit
function DCSupply({
  position,
  voltage,
  current,
  onVoltageChange,
  isOn,
  onTogglePower,
}: {
  position: [number, number, number]
  voltage: number
  current: number
  onVoltageChange: (v: number) => void
  isOn: boolean
  onTogglePower: () => void
}) {
  return (
    <group position={position}>
      {/* Unit Chassis */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.44, 0.4]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Front Faceplate */}
      <mesh position={[0, 0.22, 0.201]}>
        <planeGeometry args={[0.51, 0.4]} />
        <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.4} />
      </mesh>

      {/* Brand & Model Arabic Label */}
      <Text position={[0, 0.38, 0.205]} fontSize={0.03} color="#94a3b8" anchorX="center" anchorY="middle">
        منارة DC-30V / مجهز قدرة
      </Text>

      {/* Digital LED Displays */}
      {/* Voltage LED */}
      <mesh position={[-0.12, 0.28, 0.204]}>
        <planeGeometry args={[0.18, 0.07]} />
        <meshBasicMaterial color="#020617" />
      </mesh>
      <Text
        position={[-0.12, 0.28, 0.206]}
        fontSize={0.045}
        color={isOn ? "#ef4444" : "#451a1a"}
        font="/fonts/inter.ttf"
        anchorX="center"
        anchorY="middle"
      >
        {isOn ? `${voltage.toFixed(1)} V` : "0.0 V"}
      </Text>

      {/* Current LED */}
      <mesh position={[0.12, 0.28, 0.204]}>
        <planeGeometry args={[0.18, 0.07]} />
        <meshBasicMaterial color="#020617" />
      </mesh>
      <Text
        position={[0.12, 0.28, 0.206]}
        fontSize={0.045}
        color={isOn ? "#10b981" : "#064e3b"}
        font="/fonts/inter.ttf"
        anchorX="center"
        anchorY="middle"
      >
        {isOn ? `${current.toFixed(2)} A` : "0.00 A"}
      </Text>

      {/* Terminal Binding Posts: Red (+), Black (-) */}
      {/* Positive Terminal (+) */}
      <group position={[-0.14, 0.12, 0.205]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.04, 16]} />
          <meshStandardMaterial color="#dc2626" metalness={0.6} roughness={0.3} />
        </mesh>
        <Text position={[0, 0.04, 0.01]} fontSize={0.03} color="#ef4444" anchorX="center">
          +
        </Text>
      </group>

      {/* Negative Terminal (-) */}
      <group position={[-0.04, 0.12, 0.205]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.04, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
        </mesh>
        <Text position={[0, 0.04, 0.01]} fontSize={0.03} color="#94a3b8" anchorX="center">
          -
        </Text>
      </group>

      {/* Voltage Knob */}
      <group
        position={[0.12, 0.12, 0.215]}
        onClick={(e) => {
          e.stopPropagation()
          // Cycle through common voltages: 3V, 6V, 9V, 12V, 15V, 24V
          const next = voltage >= 24 ? 3 : voltage + 3
          onVoltageChange(next)
          labAudio.playClick(600 + next * 20)
        }}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 24]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Notch on knob */}
        <mesh position={[0, 0.025, 0.016]}>
          <boxGeometry args={[0.008, 0.015, 0.005]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Power Toggle Button */}
      <group
        position={[0, 0.05, 0.205]}
        onClick={(e) => {
          e.stopPropagation()
          onTogglePower()
          labAudio.playClick(isOn ? 450 : 850)
        }}
      >
        <mesh>
          <boxGeometry args={[0.06, 0.03, 0.02]} />
          <meshStandardMaterial color={isOn ? "#10b981" : "#ef4444"} />
        </mesh>
        <Text position={[0, -0.035, 0.01]} fontSize={0.02} color="#94a3b8" anchorX="center">
          {isOn ? "تشغيل ON" : "إيقاف OFF"}
        </Text>
      </group>
    </group>
  )
}

// 3D Resistor with Color Bands
function ResistorComponent({
  position,
  resistance,
  onClick,
}: {
  position: [number, number, number]
  resistance: number
  onClick?: () => void
}) {
  const bands = useMemo(() => getResistorBands(resistance), [resistance])

  return (
    <group position={position} onClick={onClick}>
      {/* Base mounting board */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[0.34, 0.02, 0.14]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>

      {/* Terminals */}
      <mesh position={[-0.14, 0.035, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.04, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0.14, 0.035, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.04, 16]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Connecting leads */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.08, 0.04, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.12, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.08, 0.04, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.12, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
      </mesh>

      {/* Resistor Ceramic Body */}
      <group position={[0, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.1, 24]} />
          <meshStandardMaterial color="#d4a373" roughness={0.3} />
        </mesh>
        {/* End Bulges */}
        <mesh position={[0, 0.045, 0]}>
          <cylinderGeometry args={[0.026, 0.022, 0.015, 24]} />
          <meshStandardMaterial color="#d4a373" roughness={0.3} />
        </mesh>
        <mesh position={[0, -0.045, 0]}>
          <cylinderGeometry args={[0.022, 0.026, 0.015, 24]} />
          <meshStandardMaterial color="#d4a373" roughness={0.3} />
        </mesh>

        {/* 4 Colored Bands */}
        {bands.map((color, idx) => (
          <mesh key={idx} position={[0, -0.03 + idx * 0.02, 0]}>
            <cylinderGeometry args={[0.023, 0.023, 0.008, 24]} />
            <meshBasicMaterial color={color} />
          </mesh>
        ))}
      </group>

      {/* Ohmic value label */}
      <Text position={[0, 0.09, 0]} fontSize={0.035} color="#e2e8f0" anchorX="center" anchorY="bottom">
        {resistance} Ω
      </Text>
    </group>
  )
}

// 3D Sliding Rheostat (مقاومة متغيرة / ريوستات زالق)
function RheostatComponent({
  position,
  value,
  max = 100,
  onChange,
}: {
  position: [number, number, number]
  value: number
  max?: number
  onChange: (val: number) => void
}) {
  const sliderNorm = THREE.MathUtils.clamp(value / max, 0, 1)
  const sliderX = -0.16 + sliderNorm * 0.32

  return (
    <group position={position}>
      {/* Base & Stands */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[0.44, 0.02, 0.16]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>
      {/* Upright metal supports */}
      <mesh position={[-0.18, 0.06, 0]}>
        <boxGeometry args={[0.025, 0.1, 0.12]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} />
      </mesh>
      <mesh position={[0.18, 0.06, 0]}>
        <boxGeometry args={[0.025, 0.1, 0.12]} />
        <meshStandardMaterial color="#64748b" metalness={0.7} />
      </mesh>

      {/* Ceramic Tube with Nichrome Wire Windings */}
      <group position={[0, 0.06, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.035, 0.035, 0.34, 24]} />
          <meshStandardMaterial color="#78350f" roughness={0.4} />
        </mesh>
      </group>

      {/* Upper Brass Guide Rod */}
      <mesh position={[0, 0.11, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.007, 0.007, 0.35, 16]} />
        <meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Sliding Contact Block (Interactive) */}
      <group
        position={[sliderX, 0.11, 0]}
        onClick={(e) => {
          e.stopPropagation()
          const next = value >= max ? 5 : Math.round(value + 15)
          onChange(Math.min(next, max))
          labAudio.playClick(700)
        }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.035, 0.045, 0.05]} />
          <meshStandardMaterial color="#2563eb" metalness={0.5} roughness={0.3} />
        </mesh>
        {/* Contact pointer reaching coil */}
        <mesh position={[0, -0.03, 0]}>
          <boxGeometry args={[0.015, 0.02, 0.015]} />
          <meshStandardMaterial color="#eab308" metalness={0.9} />
        </mesh>
      </group>

      {/* Value label */}
      <Text position={[0, 0.16, 0]} fontSize={0.032} color="#60a5fa" anchorX="center">
        ريوستات: {value} Ω (اضغط للتعديل)
      </Text>
    </group>
  )
}

// 3D Incandescent Light Bulb
function LightBulbComponent({
  position,
  power,
  isBlown = false,
  label = "مصباح",
}: {
  position: [number, number, number]
  power: number
  isBlown?: boolean
  label?: string
}) {
  const normPower = Math.min(power / 40, 1) // normalized power 0 to 1
  const glowColor = isBlown
    ? "#334155"
    : normPower > 0.8
    ? "#fef08a"
    : normPower > 0.4
    ? "#fde047"
    : "#f59e0b"

  return (
    <group position={position}>
      {/* Porcelain socket base */}
      <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.065, 0.075, 0.05, 24]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.2} />
      </mesh>

      {/* Brass screw thread */}
      <mesh position={[0, 0.065, 0]}>
        <cylinderGeometry args={[0.035, 0.035, 0.035, 24]} />
        <meshStandardMaterial color="#ca8a04" metalness={0.8} roughness={0.25} />
      </mesh>

      {/* Glass Bulb Dome */}
      <mesh position={[0, 0.13, 0]}>
        <sphereGeometry args={[0.055, 32, 32]} />
        <meshPhysicalMaterial
          color={isBlown || power === 0 ? "#ffffff" : glowColor}
          emissive={isBlown || power === 0 ? "#000000" : glowColor}
          emissiveIntensity={isBlown ? 0 : normPower * 3.5}
          roughness={0.1}
          transmission={0.85}
          thickness={0.02}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* Filament wire inside bulb */}
      <mesh position={[0, 0.12, 0]}>
        <torusGeometry args={[0.015, 0.002, 8, 16, Math.PI]} />
        <meshBasicMaterial color={isBlown ? "#1e293b" : power > 0 ? "#ffedd5" : "#475569"} />
      </mesh>

      {/* Dynamic Point Light cast by bulb */}
      {!isBlown && power > 0 && (
        <pointLight
          position={[0, 0.14, 0]}
          color={glowColor}
          intensity={normPower * 2.2}
          distance={3.5}
          decay={2}
        />
      )}

      {/* Power label */}
      <Text position={[0, 0.22, 0]} fontSize={0.032} color="#f8fafc" anchorX="center">
        {label} ({isBlown ? "محترق!" : `${power.toFixed(1)} W`})
      </Text>
    </group>
  )
}

// 3D Knife Switch (مفتاح سكين)
function KnifeSwitchComponent({
  position,
  isOpen,
  onToggle,
}: {
  position: [number, number, number]
  isOpen: boolean
  onToggle: () => void
}) {
  const angle = isOpen ? -Math.PI / 4 : 0

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
        labAudio.playClick(isOpen ? 850 : 500)
      }}
    >
      {/* Insulated wooden / slate base */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[0.26, 0.02, 0.14]} />
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </mesh>

      {/* Contact terminal blocks */}
      <mesh position={[-0.09, 0.03, 0]}>
        <boxGeometry args={[0.03, 0.025, 0.03]} />
        <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Jaws contact for blade */}
      <mesh position={[0.09, 0.035, 0]}>
        <boxGeometry args={[0.025, 0.035, 0.02]} />
        <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Knife Blade Pivoting Arm */}
      <group position={[-0.09, 0.035, 0]} rotation={[0, 0, angle]}>
        {/* Brass Blade */}
        <mesh position={[0.09, 0, 0]}>
          <boxGeometry args={[0.18, 0.015, 0.008]} />
          <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Insulated handle */}
        <mesh position={[0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 0.05, 16]} />
          <meshStandardMaterial color="#dc2626" roughness={0.4} />
        </mesh>
      </group>

      {/* State label */}
      <Text position={[0, 0.08, 0]} fontSize={0.03} color={isOpen ? "#ef4444" : "#10b981"} anchorX="center">
        {isOpen ? "مفتاح مفتوح (اضغط للإغلاق)" : "مفتاح مغلق (نشط)"}
      </Text>
    </group>
  )
}

// 3D Digital Multimeter (Ammeter or Voltmeter)
function DigitalMeterComponent({
  position,
  label,
  value,
  unit,
  color = "#3b82f6",
}: {
  position: [number, number, number]
  label: string
  value: number
  unit: string
  color?: string
}) {
  return (
    <group position={position}>
      {/* Rugged multimeter casing */}
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.26, 0.09, 0.2]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>
      {/* Protective rubber holster */}
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[0.27, 0.08, 0.21]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>

      {/* LCD Screen recessed */}
      <mesh position={[0, 0.096, -0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.18, 0.08]} />
        <meshBasicMaterial color="#020617" />
      </mesh>

      {/* LCD readout */}
      <Text
        position={[0, 0.098, -0.02]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.045}
        color="#38bdf8"
        font="/fonts/inter.ttf"
        anchorX="center"
        anchorY="middle"
      >
        {`${value.toFixed(2)} ${unit}`}
      </Text>

      {/* Meter description label */}
      <Text
        position={[0, 0.098, 0.06]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.024}
        color="#ffffff"
        anchorX="center"
      >
        {label}
      </Text>
    </group>
  )
}

// Spark warning particle burst for short circuits
function SparkBurst({ position }: { position: [number, number, number] }) {
  const sparkCount = 15
  const sparks = useMemo(
    () =>
      Array.from({ length: sparkCount }, () => ({
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          Math.random() * 1.5 + 0.5,
          (Math.random() - 0.5) * 1.5
        ),
      })),
    [sparkCount]
  )

  const groupRef = useRef<THREE.Group>(null)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    groupRef.current.children.forEach((child, i) => {
      child.position.addScaledVector(sparks[i].vel, delta)
      sparks[i].vel.y -= 3.5 * delta // gravity
      if (child.position.y < 0) {
        child.position.set(0, 0, 0)
        sparks[i].vel.set(
          (Math.random() - 0.5) * 1.5,
          Math.random() * 1.5 + 0.5,
          (Math.random() - 0.5) * 1.5
        )
      }
    })
  })

  return (
    <group ref={groupRef} position={position}>
      {sparks.map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.008, 4, 4]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      ))}
      <pointLight color="#f59e0b" intensity={3} distance={1.5} />
    </group>
  )
}

// 4 Guided Experiments aligned with Egyptian Curriculum
const ELECTRICITY_GUIDED_EXPERIMENTS: GuidedExperiment[] = [
  {
    id: "ohms-law",
    title: "تحقيق قانون أوم (Ohm's Law: V = IR)",
    curriculumRef: "الفيزياء - الفصل الأول: التيار الكهربي وقانون أوم",
    description: "دراسة العلاقة الطردية بين فرق الجهد وشدة التيار عند ثبوت درجة الحرارة وتعيين المقاومة.",
    steps: [
      {
        title: "تأكد من إغلاق مفتاح الدائرة",
        instruction: "اضغط على مفتاح السكين (Knife Switch) لإغلاق الدائرة والسماح بمرور الشحنات الكهربائية.",
        hint: "لاحظ حركة الجسيمات الزرقاء التي تمثل تدفق الإلكترونات في الأسلاك.",
      },
      {
        title: "زيادة فرق الجهد وملاحظة شدة التيار",
        instruction: "اضغط على مقبض مجهز القدرة (DC Supply) لزيادة الجهد إلى 12V ولاحظ قراءة الأمبيرميتر.",
        hint: "وفقاً لقانون أوم: كلما زاد فرق الجهد V، تزداد شدة التيار I بنسبة ثابتة تمثل المقاومة R.",
      },
      {
        title: "تغيير قيمة المقاومة بالريوستات",
        instruction: "اضغط على الزالق المتحرك للريوستات لزيادة المقاومة، وشاهد هبوط شدة التيار وضعف إضاءة المصباح.",
        hint: "العلاقة بين شدة التيار والمقاومة علاقة عكسية (I = V / R).",
      },
    ],
    quiz: {
      question: "إذا تضاعف فرق الجهد بين طرفي مقاومة أومية ثابتة عند ثبوت درجة الحرارة، فإن شدة التيار المار بها:",
      options: ["تزداد للضعف (2I)", "تقل للنصف (I/2)", "تظل ثابتة لا تتغير", "تزداد لأربعة أمثالها"],
      correctIndex: 0,
      explanation: "وفق قانون أوم V = IR، تتناسب شدة التيار طردياً مع فرق الجهد عند ثبوت المقاومة (R ثابتة)، فتتضاعف شدة التيار بتضاعف الجهد.",
    },
  },
  {
    id: "series-parallel",
    title: "مقارنة التوصيل على التوالي والتوازي",
    curriculumRef: "الفيزياء - توصيل المقاومات والمصابيح الكهربية",
    description: "استكشف كيف تختلف المقاومة المكافئة وإضاءة المصابيح بين التوصيل على التوالي والتوازي.",
    steps: [
      {
        title: "اختر وضع التوصيل على التوالي",
        instruction: "في التوصيل على التوالي: يكون للتيار مسار واحد، والمقاومة الكلية Req = R1 + R2.",
        hint: "إذا فُتحت الدائرة في أي نقطة أو تلف مصباح ينقطع التيار عن جميع أجزاء الدائرة.",
      },
      {
        title: "بدّل إلى التوصيل على التوازي",
        instruction: "انتقل إلى وضع التوازي في لوحة التحكم لملاحظة شدة إضاءة المصابيح واستقلال كل فرع.",
        hint: "في التوازي: فرق الجهد متساوٍ على جميع الفروع، والمقاومة المكافئة أصغر من أصغر مقاومة.",
      },
    ],
    quiz: {
      question: "عند توصيل عدة مصابيح متماثلة على التوازي مع مصدر مهمل المقاومة الداخلية، ثم إضافة مصباح آخر على التوازي، فإن إضاءة المصابيح السابقة:",
      options: ["تظل ثابتة كما هي", "تقل شدتها", "تزداد شدتها", "تنطفئ تماماً"],
      correctIndex: 0,
      explanation: "في التوصيل على التوازي، يظل فرق الجهد على طرفي كل مصباح ثابتاً ويساوي جهد المصدر V، وبالتالي تظل قدرة وإضاءة كل مصباح ثابتة.",
    },
  },
  {
    id: "kirchhoff-laws",
    title: "قانونا كيرشوف وتوزيع التيارات",
    curriculumRef: "الفيزياء - قانونا كيرشوف للدوائر المعقدة",
    description: "التحقق من قانون حفظ الشحنة (قانون كيرشوف الأول) وقانون حفظ الطاقة (قانون كيرشوف الثاني).",
    steps: [
      {
        title: "التحقق من العقدة الكهربائية (Junction Node)",
        instruction: "لاحظ نقطة تفرع التيار: التيار الكلي الداخل يساوي مجموع التيارات الخارجة (Σ I_in = Σ I_out).",
        hint: "قانون كيرشوف الأول هو تطبيق مباشر لمبدأ بقاء الشحنة الكهربية.",
      },
      {
        title: "فحص المسار المغلق (Loop)",
        instruction: "قس فروق الجهد عبر كل عنصر في المسار للتأكد من أن المجموع الجبري للقوى الدافعة يساوي مجموع فروق الجهد.",
        hint: "قانون كيرشوف الثاني هو تطبيق مباشر لمبدأ بقاء الطاقة.",
      },
    ],
    quiz: {
      question: "يعتبر قانون كيرشوف الأول (قانون النقطة) صيغة رياضية معبرة عن قانون:",
      options: ["بقاء الشحنة الكهربية", "بقاء الطاقة", "بقاء كمية التحرك", "قانون الجذب العام"],
      correctIndex: 0,
      explanation: "قانون كيرشوف الأول ينص على أن مجموع الشحنات الداخلة إلى نقطة في زمن معين يساوي مجموع الشحنات الخارجة منها، فهو يعبر عن حفظ الشحنة.",
    },
  },
  {
    id: "power-short-circuit",
    title: "القدرة الكهربائية وخطر الماس الكهربائي (Short Circuit)",
    curriculumRef: "الفيزياء - القدرة والطاقة الكهربية وحماية الدوائر",
    description: "فهم قانون القدرة المستهلكة P = VI وتجربة أمان الدائرة عند هبوط المقاومة لصفر تقريباً.",
    steps: [
      {
        title: "ملاحظة القدرة المستهلكة للمصباح",
        instruction: "راقب قراءة الواط (W) المحسوبة من P = V × I. لاحظ كيف تزداد الإضاءة بارتفاع القدرة.",
        hint: "الطاقة الحرارية والضوئية المنبعثة تعتمد على معدل استهلاك الطاقة بالواط.",
      },
      {
        title: "تنبيه قصر الدائرة (Short Circuit)",
        instruction: "إذا انخفضت مقاومة الدائرة إلى ما يقارب الصفر، يقفز التيار لقيم هائلة ويفصل قاطع الأمان لمنع تلف الأجهزة.",
        hint: "الماس الكهربائي يحدث عند تلامس سلكي المصدر بدون حمل، مما يسبب تياراً عالي الخطورة.",
      },
    ],
    quiz: {
      question: "مصباحان مكتوب عليهما (100W, 220V) و (25W, 220V)، تكون مقاومة فتيلة المصباح الثاني:",
      options: ["أربعة أمثال مقاومة الأول", "نصف مقاومة الأول", "مساوية لمقاومة الأول", "ربع مقاومة الأول"],
      correctIndex: 0,
      explanation: "من القانون P = V² / R، نجد أن المقاومة R = V² / P. بما أن الجهد ثابت (220V)، فالمصباح ذو القدرة الأقل (25W) تكون مقاومته أربعة أضعاف مصباح (100W).",
    },
  },
]

export function CircuitLab() {
  // Circuit electrical parameters
  const [voltage, setVoltage] = useState(12)
  const [rheostatResistance, setRheostatResistance] = useState(15)
  const [fixedResistance, setFixedResistance] = useState(10)
  const [circuitMode, setCircuitMode] = useState<"simple" | "series" | "parallel">("simple")
  const [isSwitchOpen, setIsSwitchOpen] = useState(false)
  const [isPowerOn, setIsPowerOn] = useState(true)

  // HUD & Guided Exp states
  const [activeExpIndex, setActiveExpIndex] = useState(0)
  const [isSandbox, setIsSandbox] = useState(false)
  const [cameraResetSignal, setCameraResetSignal] = useState(0)

  // Equivalent resistance calculation
  const equivalentResistance = useMemo(() => {
    if (circuitMode === "simple") {
      return rheostatResistance + 2 // 2 ohms internal/bulb base resistance
    } else if (circuitMode === "series") {
      return rheostatResistance + fixedResistance + 4
    } else {
      // Parallel: (R1 * R2) / (R1 + R2)
      const r1 = Math.max(rheostatResistance, 1)
      const r2 = Math.max(fixedResistance, 1)
      return (r1 * r2) / (r1 + r2) + 1
    }
  }, [circuitMode, rheostatResistance, fixedResistance])

  // Is short-circuit condition?
  const isShortCircuit = isPowerOn && !isSwitchOpen && equivalentResistance < 1.5

  // Circuit current (I = V / Req)
  const current = useMemo(() => {
    if (!isPowerOn || isSwitchOpen || isShortCircuit) return 0
    return Number((voltage / equivalentResistance).toFixed(2))
  }, [voltage, equivalentResistance, isPowerOn, isSwitchOpen, isShortCircuit])

  // Power consumed (P = V * I)
  const power = useMemo(() => {
    if (!isPowerOn || isSwitchOpen) return 0
    return Number((voltage * current).toFixed(1))
  }, [voltage, current, isPowerOn, isSwitchOpen])

  // Trigger spark sound on short circuit
  const prevShortRef = useRef(false)
  if (isShortCircuit && !prevShortRef.current) {
    labAudio.playSpark()
    prevShortRef.current = true
  } else if (!isShortCircuit) {
    prevShortRef.current = false
  }

  const handleResetLab = () => {
    setVoltage(12)
    setRheostatResistance(15)
    setFixedResistance(10)
    setCircuitMode("simple")
    setIsSwitchOpen(false)
    setIsPowerOn(true)
    setCameraResetSignal((prev) => prev + 1)
  }

  return (
    <div className="relative w-full h-full min-h-[480px]">
      <LabCanvas
        camera={{ position: [0, 2.3, 3.2], fov: 42 }}
        onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
      >
        <LabRoom cameraResetSignal={cameraResetSignal} defaultCameraPosition={[0, 2.3, 3.2]} defaultTarget={[0, 0.85, 0]}>
          {/* Bench Components Layout */}

          {/* 1. DC Power Supply (Back Left) */}
          <DCSupply
            position={[-1.1, 0.82, -0.45]}
            voltage={voltage}
            current={current}
            onVoltageChange={setVoltage}
            isOn={isPowerOn}
            onTogglePower={() => setIsPowerOn(!isPowerOn)}
          />

          {/* 2. Rheostat (Center Back) */}
          <RheostatComponent
            position={[-0.1, 0.82, -0.45]}
            value={rheostatResistance}
            max={100}
            onChange={setRheostatResistance}
          />

          {/* 3. Knife Switch (Right Back) */}
          <KnifeSwitchComponent
            position={[0.9, 0.82, -0.45]}
            isOpen={isSwitchOpen}
            onToggle={() => setIsSwitchOpen(!isSwitchOpen)}
          />

          {/* 4. Digital Multimeters (Front Left and Front Center) */}
          {/* Ammeter: Measuring current in series */}
          <DigitalMeterComponent
            position={[-0.95, 0.82, 0.45]}
            label="أمبيرميتر (A) على التوالي"
            value={current}
            unit="A"
            color="#10b981"
          />

          {/* Voltmeter: Measuring voltage in parallel */}
          <DigitalMeterComponent
            position={[-0.35, 0.82, 0.45]}
            label="فولتميتر (V) على التوازي"
            value={isPowerOn && !isSwitchOpen ? voltage : 0}
            unit="V"
            color="#3b82f6"
          />

          {/* 5. Resistor Component (Used in Series & Parallel Modes) */}
          {circuitMode !== "simple" && (
            <ResistorComponent
              position={[0.25, 0.82, 0.45]}
              resistance={fixedResistance}
              onClick={() => {
                const next = fixedResistance >= 50 ? 5 : fixedResistance + 10
                setFixedResistance(next)
                labAudio.playClick(650)
              }}
            />
          )}

          {/* 6. Light Bulb (Right Front) */}
          <LightBulbComponent
            position={[0.85, 0.82, 0.4]}
            power={power}
            isBlown={isShortCircuit}
            label={circuitMode === "parallel" ? "مصباح فرع 1" : "مصباح الحمل"}
          />

          {/* Secondary Bulb for Parallel mode */}
          {circuitMode === "parallel" && (
            <LightBulbComponent
              position={[1.25, 0.82, 0.4]}
              power={power * 0.8}
              isBlown={isShortCircuit}
              label="مصباح فرع 2"
            />
          )}

          {/* Spark visual effect if short circuit occurs */}
          {isShortCircuit && <SparkBurst position={[-0.1, 0.9, -0.45]} />}

          {/* 3D Realistic Wires connecting the circuit */}
          <WirePath
            start={[-0.96, 0.94, -0.25]} // Power (+)
            end={[-0.3, 0.88, -0.45]} // To Rheostat
            current={current}
            wireColor="#dc2626"
          />
          <WirePath
            start={[0.1, 0.88, -0.45]} // Rheostat out
            end={[0.77, 0.85, -0.45]} // To switch
            current={current}
            wireColor="#eab308"
          />
          <WirePath
            start={[1.03, 0.85, -0.45]} // Switch out
            end={[0.85, 0.85, 0.35]} // To Bulb
            current={current}
            wireColor="#3b82f6"
          />
          <WirePath
            start={[0.85, 0.85, 0.45]} // Bulb out
            end={[-0.95, 0.88, 0.35]} // To Ammeter
            current={current}
            wireColor="#1e293b"
          />
          <WirePath
            start={[-0.95, 0.88, 0.55]} // Ammeter return
            end={[-1.14, 0.94, -0.25]} // Power (-)
            current={current}
            wireColor="#0f172a"
          />
        </LabRoom>
      </LabCanvas>

      {/* 2D Interactive HUD Overlay */}
      <LabHUD
        title="مختبر الدوائر الكهربائية ثلاثي الأبعاد"
        subjectTitle="الفيزياء الكهربية"
        curriculumGrade="الثانوية العامة"
        guidedExperiments={ELECTRICITY_GUIDED_EXPERIMENTS}
        activeExpIndex={activeExpIndex}
        onSelectExp={setActiveExpIndex}
        isSandbox={isSandbox}
        onToggleSandbox={setIsSandbox}
        onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
        onResetExperiment={handleResetLab}
      >
        {/* Floating In-Scene Quick Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pointer-events-auto max-w-4xl mx-auto w-full px-2">
          {/* Circuit Mode Selector */}
          <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 shadow-lg">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-primary" />
              <span>نمط التوصيل:</span>
            </span>
            <div className="flex gap-1 bg-black/40 p-0.5 rounded-lg border border-white/5 text-xs">
              <button
                onClick={() => {
                  setCircuitMode("simple")
                  labAudio.playClick()
                }}
                className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                  circuitMode === "simple" ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                دائرة مفردة
              </button>
              <button
                onClick={() => {
                  setCircuitMode("series")
                  labAudio.playClick()
                }}
                className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                  circuitMode === "series" ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                توالي
              </button>
              <button
                onClick={() => {
                  setCircuitMode("parallel")
                  labAudio.playClick()
                }}
                className={`px-2 py-0.5 rounded-md font-semibold transition-all ${
                  circuitMode === "parallel" ? "bg-primary text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                توازي
              </button>
            </div>
          </div>

          {/* Short Circuit Warning Alert */}
          {isShortCircuit && (
            <div className="glass px-3.5 py-1.5 rounded-xl border border-rose-500/50 bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-2 animate-bounce shadow-xl">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>تحذير أمان: ماس كهربائي (Short Circuit)! انخفضت المقاومة وتم فصل المنصهر.</span>
            </div>
          )}

          {/* Quick Real-Time Metrics Dial */}
          <div className="glass px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">الجهد:</span>
              <span className="font-mono font-bold text-white">{voltage} V</span>
            </div>
            <div className="w-[1px] h-3.5 bg-white/10" />
            <div className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">التيار:</span>
              <span className="font-mono font-bold text-emerald-300">{current} A</span>
            </div>
            <div className="w-[1px] h-3.5 bg-white/10" />
            <div className="flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 text-yellow-300" />
              <span className="text-slate-400">القدرة:</span>
              <span className="font-mono font-bold text-yellow-300">{power} W</span>
            </div>
          </div>
        </div>
      </LabHUD>
    </div>
  )
}
