"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { LabCanvas, LabRoom, LabHUD, GuidedExperiment, labAudio, useQuality, useLabLanguage, BillboardLabel, QualityProvider, LanguageProvider } from "./3d"
import {
  AlertTriangle,
  Zap,
  Gauge,
  Sliders,
  Activity,
  Lightbulb,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  CheckCircle2,
  Wrench,
  Link as LinkIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

// Digital LCD display mesh with zero network dependencies
function DigitalDisplayMesh({
  position,
  rotation = [0, 0, 0],
  text,
  color = "#38bdf8",
  width = 0.18,
  height = 0.07,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  text: string
  color?: string
  width?: number
  height?: number
}) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null
    const canvas = document.createElement("canvas")
    canvas.width = 256
    canvas.height = 96
    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.fillStyle = "#020617"
      ctx.fillRect(0, 0, 256, 96)
      ctx.strokeStyle = "rgba(255,255,255,0.15)"
      ctx.lineWidth = 4
      ctx.strokeRect(2, 2, 252, 92)
      ctx.font = "bold 44px monospace"
      ctx.fillStyle = color
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(text, 128, 48)
    }
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [text, color])

  useEffect(() => {
    return () => {
      texture?.dispose()
    }
  }, [texture])

  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture || undefined} color={texture ? "#ffffff" : "#020617"} />
    </mesh>
  )
}

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
function DynamicWireMesh({
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
      .add(new THREE.Vector3(0, -0.04, 0)) // slight natural wire sag
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

// Interactive Terminal Node
function TerminalPost({
  id,
  position,
  label,
  color,
  isSelected,
  onClick,
}: {
  id: string
  position: [number, number, number]
  label: string
  color: string
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onClick() }}>
      <mesh position={[0, 0.025, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.05, 16]} />
        <meshStandardMaterial
          color={isSelected ? "#38bdf8" : color}
          emissive={isSelected ? "#0284c7" : "#000000"}
          emissiveIntensity={isSelected ? 0.6 : 0}
          metalness={0.7}
          roughness={0.2}
        />
      </mesh>
      {/* Terminal knurled nut */}
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.015, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
      </mesh>
      {/* Label */}
      <BillboardLabel
        position={[0, 0.08, 0]}
        text={label}
        color={isSelected ? "#38bdf8" : "#94a3b8"}
        bgColor={isSelected ? "rgba(2, 132, 199, 0.85)" : "rgba(15, 23, 42, 0.75)"}
        scale={[0.18, 0.05, 1]}
        fontSize={16}
      />
    </group>
  )
}

// 3D Power Supply Unit
function DCSupplyUnit({
  position,
  voltage,
  current,
  onVoltageChange,
  isOn,
  onTogglePower,
  onSelectTerminal,
  selectedTerminal,
}: {
  position: [number, number, number]
  voltage: number
  current: number
  onVoltageChange: (v: number) => void
  isOn: boolean
  onTogglePower: () => void
  onSelectTerminal: (termId: string) => void
  selectedTerminal: string | null
}) {
  return (
    <group position={position}>
      {/* Chassis */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.55, 0.44, 0.4]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.25} />
      </mesh>
      {/* Faceplate */}
      <mesh position={[0, 0.22, 0.201]}>
        <planeGeometry args={[0.51, 0.4]} />
        <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.4} />
      </mesh>

      <BillboardLabel
        position={[0, 0.38, 0.21]}
        text="DC Power Supply • مجهز قدرة"
        color="#94a3b8"
        bgColor="transparent"
        borderColor="transparent"
        scale={[0.42, 0.08, 1]}
        fontSize={18}
      />

      {/* Voltage Display */}
      <DigitalDisplayMesh
        position={[-0.12, 0.28, 0.204]}
        text={isOn ? `${voltage.toFixed(1)} V` : "0.0 V"}
        color={isOn ? "#ef4444" : "#451a1a"}
        width={0.18}
        height={0.07}
      />

      {/* Current Display */}
      <DigitalDisplayMesh
        position={[0.12, 0.28, 0.204]}
        text={isOn ? `${current.toFixed(2)} A` : "0.00 A"}
        color={isOn ? "#10b981" : "#064e3b"}
        width={0.18}
        height={0.07}
      />

      {/* Interactive Terminal Binding Posts */}
      <TerminalPost
        id="power_pos"
        position={[-0.12, 0.12, 0.205]}
        label="Power (+)"
        color="#dc2626"
        isSelected={selectedTerminal === "power_pos"}
        onClick={() => onSelectTerminal("power_pos")}
      />
      <TerminalPost
        id="power_neg"
        position={[-0.02, 0.12, 0.205]}
        label="Power (-)"
        color="#0f172a"
        isSelected={selectedTerminal === "power_neg"}
        onClick={() => onSelectTerminal("power_neg")}
      />

      {/* Voltage Dial Knob */}
      <group
        position={[0.13, 0.12, 0.215]}
        onClick={(e) => {
          e.stopPropagation()
          const next = voltage >= 24 ? 3 : voltage + 3
          onVoltageChange(next)
          labAudio.playClick(600 + next * 20)
        }}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 24]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.025, 0.016]}>
          <boxGeometry args={[0.008, 0.015, 0.005]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      </group>

      {/* Power Rocker */}
      <group
        position={[0, 0.04, 0.205]}
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
      </group>
    </group>
  )
}

// 3D Incandescent Light Bulb Unit with Terminals
function BulbUnit({
  position,
  power,
  isBlown,
  onSelectTerminal,
  selectedTerminal,
  termInId = "bulb_in",
  termOutId = "bulb_out",
  label = "مصباح الحمل",
}: {
  position: [number, number, number]
  power: number
  isBlown: boolean
  onSelectTerminal: (id: string) => void
  selectedTerminal: string | null
  termInId?: string
  termOutId?: string
  label?: string
}) {
  const normPower = Math.min(power / 40, 1)
  const glowColor = isBlown
    ? "#334155"
    : normPower > 0.8
    ? "#fef08a"
    : normPower > 0.4
    ? "#fde047"
    : "#f59e0b"

  return (
    <group position={position}>
      {/* Base mounting board */}
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <boxGeometry args={[0.34, 0.03, 0.22]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} />
      </mesh>

      {/* Porcelain socket */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.06, 0.07, 0.05, 24]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.2} />
      </mesh>

      {/* Glass Bulb Dome */}
      <mesh position={[0, 0.14, 0]}>
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

      {/* Bulb Light */}
      {!isBlown && power > 0 && (
        <pointLight position={[0, 0.16, 0]} color={glowColor} intensity={normPower * 2.2} distance={3.5} decay={2} />
      )}

      {/* Connection Terminals */}
      <TerminalPost
        id={termInId}
        position={[-0.11, 0.03, 0]}
        label="Terminal 1"
        color="#dc2626"
        isSelected={selectedTerminal === termInId}
        onClick={() => onSelectTerminal(termInId)}
      />
      <TerminalPost
        id={termOutId}
        position={[0.11, 0.03, 0]}
        label="Terminal 2"
        color="#0f172a"
        isSelected={selectedTerminal === termOutId}
        onClick={() => onSelectTerminal(termOutId)}
      />

      <BillboardLabel
        position={[0, 0.25, 0]}
        text={`${label} (${isBlown ? "محترق!" : `${power.toFixed(1)} W`})`}
        color="#f8fafc"
        bgColor="rgba(15, 23, 42, 0.85)"
        scale={[0.34, 0.08, 1]}
        fontSize={18}
      />
    </group>
  )
}

// 3D Knife Switch Unit with Terminals
function SwitchUnit({
  position,
  isOpen,
  onToggle,
  onSelectTerminal,
  selectedTerminal,
}: {
  position: [number, number, number]
  isOpen: boolean
  onToggle: () => void
  onSelectTerminal: (id: string) => void
  selectedTerminal: string | null
}) {
  const angle = isOpen ? -Math.PI / 4 : 0

  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <boxGeometry args={[0.34, 0.03, 0.18]} />
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </mesh>

      {/* Blade Arm (Clickable to open/close) */}
      <group
        position={[-0.07, 0.045, 0]}
        rotation={[0, 0, angle]}
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
          labAudio.playClick(isOpen ? 850 : 500)
        }}
      >
        <mesh position={[0.07, 0, 0]}>
          <boxGeometry args={[0.15, 0.015, 0.008]} />
          <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
        </mesh>
        <mesh position={[0.16, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 0.05, 16]} />
          <meshStandardMaterial color="#dc2626" roughness={0.4} />
        </mesh>
      </group>

      {/* Terminals */}
      <TerminalPost
        id="switch_in"
        position={[-0.11, 0.03, 0]}
        label="Switch In"
        color="#eab308"
        isSelected={selectedTerminal === "switch_in"}
        onClick={() => onSelectTerminal("switch_in")}
      />
      <TerminalPost
        id="switch_out"
        position={[0.11, 0.03, 0]}
        label="Switch Out"
        color="#eab308"
        isSelected={selectedTerminal === "switch_out"}
        onClick={() => onSelectTerminal("switch_out")}
      />

      <BillboardLabel
        position={[0, 0.12, 0]}
        text={isOpen ? "مفتاح مفتوح (اضغط للإغلاق)" : "مفتاح مغلق (نشط)"}
        color={isOpen ? "#ef4444" : "#10b981"}
        bgColor="rgba(15, 23, 42, 0.85)"
        scale={[0.38, 0.08, 1]}
        fontSize={18}
      />
    </group>
  )
}

// 3D Resistor Unit with Terminals
function ResistorUnit({
  position,
  ohms,
  onSelectTerminal,
  selectedTerminal,
  onClickOhms,
}: {
  position: [number, number, number]
  ohms: number
  onSelectTerminal: (id: string) => void
  selectedTerminal: string | null
  onClickOhms?: () => void
}) {
  const bands = useMemo(() => getResistorBands(ohms), [ohms])

  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <boxGeometry args={[0.34, 0.03, 0.18]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} />
      </mesh>

      {/* Ceramic body */}
      <group position={[0, 0.045, 0]} rotation={[0, 0, Math.PI / 2]} onClick={onClickOhms}>
        <mesh castShadow>
          <cylinderGeometry args={[0.022, 0.022, 0.1, 24]} />
          <meshStandardMaterial color="#d4a373" roughness={0.3} />
        </mesh>
        {bands.map((color, idx) => (
          <mesh key={idx} position={[0, -0.03 + idx * 0.02, 0]}>
            <cylinderGeometry args={[0.023, 0.023, 0.008, 24]} />
            <meshBasicMaterial color={color} />
          </mesh>
        ))}
      </group>

      {/* Terminals */}
      <TerminalPost
        id="resistor_in"
        position={[-0.11, 0.03, 0]}
        label="R In"
        color="#cbd5e1"
        isSelected={selectedTerminal === "resistor_in"}
        onClick={() => onSelectTerminal("resistor_in")}
      />
      <TerminalPost
        id="resistor_out"
        position={[0.11, 0.03, 0]}
        label="R Out"
        color="#cbd5e1"
        isSelected={selectedTerminal === "resistor_out"}
        onClick={() => onSelectTerminal("resistor_out")}
      />

      <BillboardLabel
        position={[0, 0.1, 0]}
        text={`${ohms} Ω`}
        color="#e2e8f0"
        bgColor="rgba(15, 23, 42, 0.85)"
        scale={[0.22, 0.06, 1]}
        fontSize={18}
      />
    </group>
  )
}

// 3D Rheostat Unit with Terminals
function RheostatUnit({
  position,
  ohms,
  onChangeOhms,
  onSelectTerminal,
  selectedTerminal,
}: {
  position: [number, number, number]
  ohms: number
  onChangeOhms: (val: number) => void
  onSelectTerminal: (id: string) => void
  selectedTerminal: string | null
}) {
  const sliderNorm = THREE.MathUtils.clamp(ohms / 100, 0, 1)
  const sliderX = -0.12 + sliderNorm * 0.24

  return (
    <group position={position}>
      {/* Base */}
      <mesh position={[0, 0.015, 0]} receiveShadow>
        <boxGeometry args={[0.42, 0.03, 0.18]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>

      {/* Coil */}
      <mesh position={[0, 0.065, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.032, 0.032, 0.3, 24]} />
        <meshStandardMaterial color="#78350f" roughness={0.4} />
      </mesh>

      {/* Slider */}
      <group
        position={[sliderX, 0.115, 0]}
        onClick={(e) => {
          e.stopPropagation()
          const next = ohms >= 100 ? 5 : ohms + 15
          onChangeOhms(next)
          labAudio.playClick(700)
        }}
      >
        <mesh castShadow>
          <boxGeometry args={[0.035, 0.045, 0.05]} />
          <meshStandardMaterial color="#2563eb" metalness={0.5} roughness={0.3} />
        </mesh>
      </group>

      {/* Terminals */}
      <TerminalPost
        id="rheostat_in"
        position={[-0.15, 0.03, 0]}
        label="Rheo In"
        color="#eab308"
        isSelected={selectedTerminal === "rheostat_in"}
        onClick={() => onSelectTerminal("rheostat_in")}
      />
      <TerminalPost
        id="rheostat_out"
        position={[0.15, 0.03, 0]}
        label="Rheo Out"
        color="#eab308"
        isSelected={selectedTerminal === "rheostat_out"}
        onClick={() => onSelectTerminal("rheostat_out")}
      />

      <BillboardLabel
        position={[0, 0.18, 0]}
        text={`ريوستات: ${ohms} Ω`}
        color="#60a5fa"
        bgColor="rgba(15, 23, 42, 0.85)"
        scale={[0.28, 0.07, 1]}
        fontSize={18}
      />
    </group>
  )
}

// 3D Digital Meter Unit
function DigitalMeterUnit({
  position,
  label,
  value,
  unit,
  color,
  termInId,
  termOutId,
  onSelectTerminal,
  selectedTerminal,
}: {
  position: [number, number, number]
  label: string
  value: number
  unit: string
  color: string
  termInId: string
  termOutId: string
  onSelectTerminal: (id: string) => void
  selectedTerminal: string | null
}) {
  return (
    <group position={position}>
      <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.28, 0.09, 0.22]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.045, 0]}>
        <boxGeometry args={[0.29, 0.08, 0.23]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>

      {/* Screen */}
      <DigitalDisplayMesh
        position={[0, 0.098, -0.02]}
        rotation={[-Math.PI / 2, 0, 0]}
        text={`${value.toFixed(2)} ${unit}`}
        color="#38bdf8"
        width={0.18}
        height={0.08}
      />

      {/* Terminals */}
      <TerminalPost
        id={termInId}
        position={[-0.08, 0.06, 0.07]}
        label="+"
        color="#dc2626"
        isSelected={selectedTerminal === termInId}
        onClick={() => onSelectTerminal(termInId)}
      />
      <TerminalPost
        id={termOutId}
        position={[0.08, 0.06, 0.07]}
        label="-"
        color="#0f172a"
        isSelected={selectedTerminal === termOutId}
        onClick={() => onSelectTerminal(termOutId)}
      />

      <BillboardLabel
        position={[0, 0.12, 0.06]}
        text={label}
        color="#ffffff"
        bgColor="rgba(15, 23, 42, 0.85)"
        scale={[0.22, 0.06, 1]}
        fontSize={18}
      />
    </group>
  )
}

// 4 Guided Experiments (Bilingual)
export const ELECTRICITY_GUIDED_EXPERIMENTS: GuidedExperiment[] = [
  {
    id: "ohms-law",
    title: "تحقيق قانون أوم (Ohm's Law: V = IR)",
    titleEn: "Verification of Ohm's Law (V = IR)",
    curriculumRef: "الفيزياء - التيار الكهربي وقانون أوم",
    curriculumRefEn: "Physics - Electric Current & Ohm's Law",
    description: "توصيل الدائرة وتغيير فرق الجهد والمقاومة لدراسة العلاقة الطردية بين الجهد والتيار.",
    descriptionEn: "Connect the circuit and vary voltage/resistance to study the linear I-V relationship.",
    steps: [
      {
        title: "توصيل أطراف الدائرة الكهربائية",
        titleEn: "Wire the Circuit Terminals",
        instruction: "اختر أطراف التوصيل من مجهز القدرة إلى المفتاح ثم الريوستات والمصباح لتشكيل دائرة مغلقة.",
        instructionEn: "Connect wires from the Power Supply (+) to the Switch, then to the Rheostat, Bulb, and back to Power (-).",
        hint: "يمكنك أيضاً الضغط على زر 'قالب دائرة بسيطة' لبناء التوصيل فوراً.",
        hintEn: "You can also click 'Simple Circuit Preset' to auto-wire the setup.",
      },
      {
        title: "إغلاق المفتاح وزيادة فرق الجهد",
        titleEn: "Close Switch and Increase Voltage",
        instruction: "اضغط على مفتاح السكين لإغلاقه، ولاحظ قراءة الأمبيرميتر مع زيادة الجهد.",
        instructionEn: "Click the knife switch to close it, and observe current rise as voltage increases.",
      },
    ],
    quiz: {
      question: "إذا تضاعف فرق الجهد بين طرفي مقاومة أومية ثابتة عند ثبوت درجة الحرارة، فإن شدة التيار المار بها:",
      questionEn: "If the voltage across a fixed ohmic resistor is doubled at constant temperature, the current will:",
      options: ["تزداد للضعف (2I)", "تقل للنصف (I/2)", "تظل ثابتة لا تتغير", "تزداد لأربعة أمثالها"],
      optionsEn: ["Double (2I)", "Halve (I/2)", "Remain unchanged", "Quadruple (4I)"],
      correctIndex: 0,
      explanation: "وفق قانون أوم V = IR، تتناسب شدة التيار طردياً مع فرق الجهد عند ثبوت المقاومة.",
      explanationEn: "According to Ohm's Law (V = IR), electric current is directly proportional to voltage across a constant resistance.",
    },
  },
  {
    id: "series-parallel",
    title: "توصيل المقاومات على التوالي والتوازي",
    titleEn: "Series vs Parallel Resistor Circuits",
    curriculumRef: "الفيزياء - توصيل المقاومات والمصابيح",
    curriculumRefEn: "Physics - Resistor & Lamp Combinations",
    description: "مقارنة المقاومة المكافئة وإضاءة المصابيح في التوصيلين.",
    descriptionEn: "Compare equivalent resistance and bulb luminosity in series and parallel.",
    steps: [
      {
        title: "تجربة التوصيل على التوالي",
        titleEn: "Test Series Circuit",
        instruction: "في التوالي يكون مسار التيار واحداً والمقاومة المكافئة Req = R1 + R2.",
        instructionEn: "In series, current flows through a single path, and equivalent resistance is Req = R1 + R2.",
      },
      {
        title: "تجربة التوصيل على التوازي",
        titleEn: "Test Parallel Circuit",
        instruction: "في التوازي يتوزع التيار ويظل فرق الجهد متساوياً على كل فرع، وتكون إضاءة المصابيح أقوى.",
        instructionEn: "In parallel, voltage is identical across branches and bulbs shine at full independent power.",
      },
    ],
    quiz: {
      question: "عند توصيل عدة مصابيح متماثلة على التوازي مع مصدر مهمل المقاومة الداخلية، فإن إضاءة كل مصباح:",
      questionEn: "When identical bulbs are connected in parallel to an ideal source, the brightness of each bulb:",
      options: ["تظل ثابتة ومستقلة", "تقل شدتها", "تزداد شدتها", "تنطفئ تماماً"],
      optionsEn: ["Remains constant and independent", "Decreases", "Increases", "Turns off"],
      correctIndex: 0,
      explanation: "في التوازي يظل فرق الجهد على طرفي كل مصباح ثابتاً ومساوياً لجهد المصدر.",
      explanationEn: "In a parallel circuit, each branch receives the full source voltage independently.",
    },
  },
  {
    id: "kirchhoff-laws",
    title: "قانونا كيرشوف وتوزيع التيارات",
    titleEn: "Kirchhoff's Current & Voltage Laws",
    curriculumRef: "الفيزياء - قانونا كيرشوف",
    curriculumRefEn: "Physics - Kirchhoff's Circuit Laws",
    description: "التحقق من حفظ الشحنة عند العقد وحفظ الطاقة في المسارات المغلقة.",
    descriptionEn: "Verify conservation of charge at nodes (KCL) and energy in closed loops (KVL).",
    steps: [
      {
        title: "فحص العقدة (KCL)",
        titleEn: "Check Junction Node (KCL)",
        instruction: "مجموع التيارات الداخلة إلى النقطة يساوي مجموع التيارات الخارجة منها (Σ I_in = Σ I_out).",
        instructionEn: "Total current entering a junction equals the total current leaving it (Σ I_in = Σ I_out).",
      },
    ],
    quiz: {
      question: "يعتبر قانون كيرشوف الأول صيغة رياضية تعبر عن قانون:",
      questionEn: "Kirchhoff's First Law (Current Law) expresses the principle of conservation of:",
      options: ["بقاء الشحنة الكهربية", "بقاء الطاقة", "بقاء كمية التحرك", "الجاذبية الكونية"],
      optionsEn: ["Conservation of electric charge", "Conservation of energy", "Conservation of momentum", "Universal gravitation"],
      correctIndex: 0,
      explanation: "قانون كيرشوف الأول يعبر عن حفظ الشحنة الكهربية عند أي نقطة تفرع.",
      explanationEn: "KCL mathematically embodies the fundamental conservation of electric charge at circuit junctions.",
    },
  },
  {
    id: "power-short-circuit",
    title: "القدرة الكهربية وخطر الماس الكهربائي",
    titleEn: "Electric Power & Short-Circuit Safety",
    curriculumRef: "الفيزياء - القدرة وحماية الدوائر",
    curriculumRefEn: "Physics - Electric Power & Circuit Protection",
    description: "حساب القدرة P = VI وملاحظة حماية الدائرة عند هبوط المقاومة لصفر تقريباً.",
    descriptionEn: "Compute power P = VI and observe safety fuse blow when resistance drops near zero.",
    steps: [
      {
        title: "فحص استهلاك الواط (W)",
        titleEn: "Inspect Wattage Consumption",
        instruction: "راقب كيف تتغير القدرة المستهلكة مع تغيير الجهد والمقاومة.",
        instructionEn: "Watch how power (W) scales with voltage and current.",
      },
    ],
    quiz: {
      question: "إذا انخفضت مقاومة دائرة كهربائية فجأة إلى الصفر تقريباً (ماس كهربائي)، فإن شدة التيار:",
      questionEn: "If circuit resistance drops to near zero (short circuit), electric current will:",
      options: ["تقفز لقيمة هائلة ويفصل قاطع الأمان", "تهبط للصفر فوراً", "تظل ثابتة", "تتذبذب"],
      optionsEn: ["Surge to a dangerously high value tripping the fuse", "Drop to zero", "Remain constant", "Oscillate"],
      correctIndex: 0,
      explanation: "من قانون أوم I = V/R، عندما تقترب R من الصفر يقفز التيار لقيم هائلة مسبباً خطراً يوجب فصل القاطع.",
      explanationEn: "As R approaches zero, I = V/R surges toward infinity, triggering safety circuit breakers.",
    },
  },
]

// Connection wire interface
interface WireConnection {
  id: string
  from: string
  to: string
  fromPos: [number, number, number]
  toPos: [number, number, number]
}

export function CircuitLab() {
  const [voltage, setVoltage] = useState(12)
  const [rheostatOhms, setRheostatOhms] = useState(15)
  const [fixedResistorOhms, setFixedResistorOhms] = useState(10)
  const [isSwitchOpen, setIsSwitchOpen] = useState(false)
  const [isPowerOn, setIsPowerOn] = useState(true)

  // Terminal connection state (Student forms the circuit!)
  const [selectedTerminal, setSelectedTerminal] = useState<string | null>(null)
  const [wires, setWires] = useState<WireConnection[]>([
    // Default simple circuit pre-connected
    { id: "w1", from: "power_pos", to: "switch_in", fromPos: [-1.22, 0.94, -0.25], toPos: [0.79, 0.85, -0.45] },
    { id: "w2", from: "switch_out", to: "rheostat_in", fromPos: [1.01, 0.85, -0.45], toPos: [-0.25, 0.85, -0.45] },
    { id: "w3", from: "rheostat_out", to: "bulb_in", fromPos: [0.05, 0.85, -0.45], toPos: [0.74, 0.85, 0.4] },
    { id: "w4", from: "bulb_out", to: "power_neg", fromPos: [0.96, 0.85, 0.4], toPos: [-1.12, 0.94, -0.25] },
  ])

  // Guided Experiments HUD
  const [activeExpIndex, setActiveExpIndex] = useState(0)
  const [isSandbox, setIsSandbox] = useState(false)
  const [cameraResetSignal, setCameraResetSignal] = useState(0)

  const { lang, t, isAr } = useLabLanguage()

  // Terminal Positions Registry on the Tabletop
  const TERMINALS: Record<string, { label: string; pos: [number, number, number] }> = {
    power_pos: { label: "Power (+)", pos: [-1.22, 0.94, -0.25] },
    power_neg: { label: "Power (-)", pos: [-1.12, 0.94, -0.25] },
    switch_in: { label: "Switch In", pos: [0.79, 0.85, -0.45] },
    switch_out: { label: "Switch Out", pos: [1.01, 0.85, -0.45] },
    rheostat_in: { label: "Rheo In", pos: [-0.25, 0.85, -0.45] },
    rheostat_out: { label: "Rheo Out", pos: [0.05, 0.85, -0.45] },
    resistor_in: { label: "R In", pos: [0.14, 0.85, 0.45] },
    resistor_out: { label: "R Out", pos: [0.36, 0.85, 0.45] },
    bulb_in: { label: "Bulb In", pos: [0.74, 0.85, 0.4] },
    bulb_out: { label: "Bulb Out", pos: [0.96, 0.85, 0.4] },
    ammeter_in: { label: "Ammeter (+)", pos: [-1.03, 0.88, 0.52] },
    ammeter_out: { label: "Ammeter (-)", pos: [-0.87, 0.88, 0.52] },
    voltmeter_in: { label: "Voltmeter (+)", pos: [-0.43, 0.88, 0.52] },
    voltmeter_out: { label: "Voltmeter (-)", pos: [-0.27, 0.88, 0.52] },
  }

  // Handle student clicking terminals to create / connect wires
  const handleTerminalClick = (termId: string) => {
    if (!selectedTerminal) {
      setSelectedTerminal(termId)
      labAudio.playClick(700)
    } else {
      if (selectedTerminal === termId) {
        setSelectedTerminal(null)
        return
      }
      // Create new wire between selectedTerminal and termId
      const t1 = TERMINALS[selectedTerminal]
      const t2 = TERMINALS[termId]
      if (t1 && t2) {
        const newWire: WireConnection = {
          id: `w_${Date.now()}`,
          from: selectedTerminal,
          to: termId,
          fromPos: t1.pos,
          toPos: t2.pos,
        }
        setWires((prev) => [...prev, newWire])
        labAudio.playSnap()
      }
      setSelectedTerminal(null)
    }
  }

  // Check if circuit forms a complete closed conductive path
  const isCircuitClosed = useMemo(() => {
    if (!isPowerOn || isSwitchOpen || wires.length < 2) return false
    // Checks if power_pos connects through components back to power_neg
    const hasPos = wires.some((w) => w.from === "power_pos" || w.to === "power_pos")
    const hasNeg = wires.some((w) => w.from === "power_neg" || w.to === "power_neg")
    return hasPos && hasNeg
  }, [wires, isPowerOn, isSwitchOpen])

  // Circuit resistance calculation
  const totalResistance = useMemo(() => {
    let r = 2.0 // internal resistance of wires and bulb base
    if (wires.some((w) => w.from.includes("rheostat") || w.to.includes("rheostat"))) {
      r += rheostatOhms
    }
    if (wires.some((w) => w.from.includes("resistor") || w.to.includes("resistor"))) {
      r += fixedResistorOhms
    }
    return r
  }, [wires, rheostatOhms, fixedResistorOhms])

  // Short circuit check: closed circuit with resistance < 1.0 Ohm
  const isShortCircuit = isCircuitClosed && totalResistance < 1.5

  // Current calculation
  const current = useMemo(() => {
    if (!isCircuitClosed || isShortCircuit) return 0
    return Number((voltage / totalResistance).toFixed(2))
  }, [isCircuitClosed, isShortCircuit, voltage, totalResistance])

  // Power calculation
  const power = useMemo(() => {
    if (!isCircuitClosed) return 0
    return Number((voltage * current).toFixed(1))
  }, [isCircuitClosed, voltage, current])

  // Quick Preset Wiring Templates
  const handleApplyPreset = (type: "simple" | "series" | "parallel" | "clear") => {
    if (type === "clear") {
      setWires([])
      setSelectedTerminal(null)
      labAudio.playClick(500)
      return
    }

    if (type === "simple") {
      setWires([
        { id: "w1", from: "power_pos", to: "switch_in", fromPos: [-1.22, 0.94, -0.25], toPos: [0.79, 0.85, -0.45] },
        { id: "w2", from: "switch_out", to: "rheostat_in", fromPos: [1.01, 0.85, -0.45], toPos: [-0.25, 0.85, -0.45] },
        { id: "w3", from: "rheostat_out", to: "bulb_in", fromPos: [0.05, 0.85, -0.45], toPos: [0.74, 0.85, 0.4] },
        { id: "w4", from: "bulb_out", to: "power_neg", fromPos: [0.96, 0.85, 0.4], toPos: [-1.12, 0.94, -0.25] },
      ])
    } else if (type === "series") {
      setWires([
        { id: "w1", from: "power_pos", to: "switch_in", fromPos: [-1.22, 0.94, -0.25], toPos: [0.79, 0.85, -0.45] },
        { id: "w2", from: "switch_out", to: "resistor_in", fromPos: [1.01, 0.85, -0.45], toPos: [0.14, 0.85, 0.45] },
        { id: "w3", from: "resistor_out", to: "bulb_in", fromPos: [0.36, 0.85, 0.45], toPos: [0.74, 0.85, 0.4] },
        { id: "w4", from: "bulb_out", to: "power_neg", fromPos: [0.96, 0.85, 0.4], toPos: [-1.12, 0.94, -0.25] },
      ])
    }
    labAudio.playSnap()
  }

  const handleResetLab = () => {
    setVoltage(12)
    setRheostatOhms(15)
    setFixedResistorOhms(10)
    setIsSwitchOpen(false)
    setIsPowerOn(true)
    handleApplyPreset("simple")
    setCameraResetSignal((prev) => prev + 1)
  }

  return (
    <QualityProvider>
      <LanguageProvider>
        <div className="relative w-full h-full min-h-[480px] flex-1">
          <LabCanvas
            camera={{ position: [0, 2.3, 3.2], fov: 42, far: 100 }}
            onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
          >
        <LabRoom cameraResetSignal={cameraResetSignal} defaultCameraPosition={[0, 2.3, 3.2]} defaultTarget={[0, 0.85, 0]}>
          {/* 1. DC Power Supply (Back Left) */}
          <DCSupplyUnit
            position={[-1.1, 0.82, -0.45]}
            voltage={voltage}
            current={current}
            onVoltageChange={setVoltage}
            isOn={isPowerOn}
            onTogglePower={() => setIsPowerOn(!isPowerOn)}
            onSelectTerminal={handleTerminalClick}
            selectedTerminal={selectedTerminal}
          />

          {/* 2. Sliding Rheostat (Center Back) */}
          <RheostatUnit
            position={[-0.1, 0.82, -0.45]}
            ohms={rheostatOhms}
            onChangeOhms={setRheostatOhms}
            onSelectTerminal={handleTerminalClick}
            selectedTerminal={selectedTerminal}
          />

          {/* 3. Knife Switch (Right Back) */}
          <SwitchUnit
            position={[0.9, 0.82, -0.45]}
            isOpen={isSwitchOpen}
            onToggle={() => setIsSwitchOpen(!isSwitchOpen)}
            onSelectTerminal={handleTerminalClick}
            selectedTerminal={selectedTerminal}
          />

          {/* 4. Resistor Component (Center Front) */}
          <ResistorUnit
            position={[0.25, 0.82, 0.45]}
            ohms={fixedResistorOhms}
            onSelectTerminal={handleTerminalClick}
            selectedTerminal={selectedTerminal}
            onClickOhms={() => {
              const next = fixedResistorOhms >= 50 ? 5 : fixedResistorOhms + 10
              setFixedResistorOhms(next)
              labAudio.playClick(650)
            }}
          />

          {/* 5. Light Bulb (Right Front) */}
          <BulbUnit
            position={[0.85, 0.82, 0.4]}
            power={power}
            isBlown={isShortCircuit}
            onSelectTerminal={handleTerminalClick}
            selectedTerminal={selectedTerminal}
            label={t("مصباح الحمل", "Load Lamp")}
          />

          {/* 6. Digital Multimeters (Front Left) */}
          <DigitalMeterUnit
            position={[-0.95, 0.82, 0.45]}
            label="Ammeter (A)"
            value={current}
            unit="A"
            color="#10b981"
            termInId="ammeter_in"
            termOutId="ammeter_out"
            onSelectTerminal={handleTerminalClick}
            selectedTerminal={selectedTerminal}
          />
          <DigitalMeterUnit
            position={[-0.35, 0.82, 0.45]}
            label="Voltmeter (V)"
            value={isCircuitClosed ? voltage : 0}
            unit="V"
            color="#3b82f6"
            termInId="voltmeter_in"
            termOutId="voltmeter_out"
            onSelectTerminal={handleTerminalClick}
            selectedTerminal={selectedTerminal}
          />

          {/* 7. Student-formed 3D Dynamic Wires */}
          {wires.map((wire) => (
            <DynamicWireMesh
              key={wire.id}
              start={wire.fromPos}
              end={wire.toPos}
              current={current}
              wireColor="#3b82f6"
            />
          ))}
        </LabRoom>
      </LabCanvas>

      {/* 2D Interactive HUD Overlay */}
      <LabHUD
        title="مختبر الدوائر والتركيب الكهربائي ثلاثي الأبعاد"
        titleEn="3D Interactive Circuit Construction Laboratory"
        subjectTitle="الفيزياء الكهربية"
        subjectTitleEn="Electric Physics"
        curriculumGrade="الثانوية العامة"
        curriculumGradeEn="Secondary Physics"
        guidedExperiments={ELECTRICITY_GUIDED_EXPERIMENTS}
        activeExpIndex={activeExpIndex}
        onSelectExp={setActiveExpIndex}
        isSandbox={isSandbox}
        onToggleSandbox={setIsSandbox}
        onResetCamera={() => setCameraResetSignal((prev) => prev + 1)}
        onResetExperiment={handleResetLab}
      >
        <div className="flex flex-col gap-2.5 pointer-events-auto max-w-4xl mx-auto w-full px-2">
          {/* Wire Construction & Presets Bar */}
          <div className="glass px-4 py-2.5 rounded-2xl border border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-3">
            {/* Terminal Connection Status */}
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-slate-200">
                {selectedTerminal ? (
                  <span className="text-cyan-300 animate-pulse">
                    {t(`تم اختيار طرف: ${selectedTerminal} — اضغط على طرف آخر للتوصيل`, `Selected: ${selectedTerminal} — Click another terminal to wire`)}
                  </span>
                ) : (
                  <span>
                    {t(
                      `اضغط على أي طرفين لتوصيل سلك بينهما (${wires.length} أسلاك موصلة)`,
                      `Click any two terminals to form a wire (${wires.length} connected)`
                    )}
                  </span>
                )}
              </span>
            </div>

            {/* Quick Presets & Clear Buttons */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => handleApplyPreset("simple")}
                className="px-2.5 py-1 rounded-lg font-semibold bg-white/5 border border-white/10 hover:bg-white/15 text-slate-300"
              >
                {t("دائرة بسيطة", "Simple Circuit")}
              </button>
              <button
                onClick={() => handleApplyPreset("series")}
                className="px-2.5 py-1 rounded-lg font-semibold bg-white/5 border border-white/10 hover:bg-white/15 text-slate-300"
              >
                {t("توالي", "Series")}
              </button>
              <button
                onClick={() => handleApplyPreset("clear")}
                className="px-2.5 py-1 rounded-lg font-semibold bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>{t("مسح الأسلاك", "Clear Wires")}</span>
              </button>
            </div>
          </div>

          {/* Short Circuit Warning Banner */}
          {isShortCircuit && (
            <div className="glass px-3.5 py-2 rounded-xl border border-rose-500/50 bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-2 animate-bounce shadow-xl">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                {t(
                  "تحذير أمان: ماس كهربائي (Short Circuit)! المقاومة صفر تقريباً وتم فصل المنصهر لمنع الاحتراق.",
                  "Safety Warning: Short Circuit detected! Resistance is near zero, safety fuse has blown."
                )}
              </span>
            </div>
          )}

          {/* Real-Time Metrics Dial */}
          <div className="glass px-4 py-2 rounded-xl border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isCircuitClosed ? "bg-emerald-400 animate-ping" : "bg-rose-400"}`} />
              <span className="font-bold text-slate-300">
                {isCircuitClosed
                  ? t("حالة الدائرة: مغلقة ونشطة", "Circuit: Closed & Active")
                  : t("حالة الدائرة: مفتوحة (غير مكتملة أو المفتاح مفتوح)", "Circuit: Open / Incomplete")}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400">{t("الجهد:", "Voltage:")}</span>
                <span className="font-mono font-bold text-white">{voltage} V</span>
              </div>
              <div className="w-[1px] h-3.5 bg-white/10" />
              <div className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-400">{t("التيار:", "Current:")}</span>
                <span className="font-mono font-bold text-emerald-300">{current} A</span>
              </div>
              <div className="w-[1px] h-3.5 bg-white/10" />
              <div className="flex items-center gap-1">
                <Lightbulb className="w-3.5 h-3.5 text-yellow-300" />
                <span className="text-slate-400">{t("القدرة:", "Power:")}</span>
                <span className="font-mono font-bold text-yellow-300">{power} W</span>
              </div>
            </div>
          </div>
        </div>
      </LabHUD>
        </div>
      </LanguageProvider>
    </QualityProvider>
  )
}
