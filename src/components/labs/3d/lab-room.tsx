"use client"

import React, { useRef, useEffect } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { OrbitControls, ContactShadows } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import { useQuality } from "./quality-manager"

interface LabRoomProps {
  children?: React.ReactNode
  cameraResetSignal?: number
  defaultCameraPosition?: [number, number, number]
  defaultTarget?: [number, number, number]
  hideTable?: boolean // for Space Lab which is in an observatory dome
}

export function LabRoom({
  children,
  cameraResetSignal = 0,
  defaultCameraPosition = [0, 2.2, 3.8],
  defaultTarget = [0, 0.9, 0],
  hideTable = false,
}: LabRoomProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const { shadows } = useQuality()

  // Animate camera back to default on reset signal or station change
  const isResettingRef = useRef(false)
  const resetProgressRef = useRef(0)
  const startPosRef = useRef(new THREE.Vector3())
  const startTargetRef = useRef(new THREE.Vector3())
  const targetPos = useRef(new THREE.Vector3(...defaultCameraPosition))
  const targetCenter = useRef(new THREE.Vector3(...defaultTarget))
  const lastTargetPosKey = useRef(`${defaultCameraPosition.join(",")}|${defaultTarget.join(",")}`)

  useEffect(() => {
    const key = `${defaultCameraPosition.join(",")}|${defaultTarget.join(",")}`
    if (controlsRef.current && (cameraResetSignal > 0 || key !== lastTargetPosKey.current)) {
      lastTargetPosKey.current = key
      isResettingRef.current = true
      resetProgressRef.current = 0
      startPosRef.current.copy(controlsRef.current.object.position)
      startTargetRef.current.copy(controlsRef.current.target)
      targetPos.current.set(...defaultCameraPosition)
      targetCenter.current.set(...defaultTarget)
    }
  }, [cameraResetSignal, defaultCameraPosition, defaultTarget])

  useFrame((_, delta) => {
    if (isResettingRef.current && controlsRef.current) {
      resetProgressRef.current += delta * 3.5
      const alpha = THREE.MathUtils.clamp(resetProgressRef.current, 0, 1)
      const t = 1 - Math.pow(1 - alpha, 3) // easeOutCubic

      controlsRef.current.object.position.lerpVectors(startPosRef.current, targetPos.current, t)
      controlsRef.current.target.lerpVectors(startTargetRef.current, targetCenter.current, t)
      controlsRef.current.update()

      if (alpha >= 1) {
        isResettingRef.current = false
      }
    }
  })

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.07}
        minDistance={1.2}
        maxDistance={8}
        minPolarAngle={Math.PI / 12}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={defaultTarget}
      />

      {/* Laboratory Ambient & Key Lighting */}
      <ambientLight intensity={0.65} color="#dbeafe" />
      <directionalLight
        position={[4, 6, 4]}
        intensity={1.2}
        castShadow={shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={15}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.0005}
      />
      {/* Overhead workbench warm accent light */}
      <spotLight
        position={[0, 4.5, 0.5]}
        target-position={[0, 0.8, 0]}
        intensity={0.9}
        angle={0.7}
        penumbra={0.6}
        color="#fffbeb"
      />
      {/* Subtle blue accent light from behind shelves */}
      <pointLight position={[-3, 2.5, -2.5]} intensity={0.4} color="#38bdf8" />

      {!hideTable && (
        <group>
          {/* Main Laboratory Bench (Table) */}
          <group position={[0, 0, 0]}>
            {/* Tabletop: Solid dark chemical-resistant phenolic/epoxy resin surface */}
            <mesh position={[0, 0.78, 0]} receiveShadow castShadow>
              <boxGeometry args={[4.4, 0.08, 2.4]} />
              <meshStandardMaterial
                color="#1e293b"
                roughness={0.25}
                metalness={0.15}
              />
            </mesh>

            {/* Table Beveled Edge Rim */}
            <mesh position={[0, 0.74, 0]}>
              <boxGeometry args={[4.44, 0.04, 2.44]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} />
            </mesh>

            {/* Table Legs: Industrial brushed stainless steel */}
            {[
              [-2.05, 0.37, -1.05],
              [2.05, 0.37, -1.05],
              [-2.05, 0.37, 1.05],
              [2.05, 0.37, 1.05],
            ].map(([x, y, z], idx) => (
              <group key={idx} position={[x, y, z]}>
                <mesh castShadow receiveShadow>
                  <cylinderGeometry args={[0.045, 0.045, 0.74, 16]} />
                  <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
                </mesh>
                {/* Rubber feet */}
                <mesh position={[0, -0.36, 0]}>
                  <cylinderGeometry args={[0.06, 0.06, 0.02, 16]} />
                  <meshStandardMaterial color="#090d16" roughness={0.9} />
                </mesh>
              </group>
            ))}

            {/* Crossbeam supports */}
            <mesh position={[0, 0.15, -1.05]}>
              <boxGeometry args={[4.1, 0.04, 0.04]} />
              <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position={[0, 0.15, 1.05]}>
              <boxGeometry args={[4.1, 0.04, 0.04]} />
              <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.4} />
            </mesh>

            {/* Utility Channel / Power Strip at back edge */}
            <mesh position={[0, 0.84, -1.1]} receiveShadow>
              <boxGeometry args={[4.2, 0.05, 0.12]} />
              <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>

          {/* Contact Shadows on workbench for tabletop realism */}
          {shadows && (
            <ContactShadows
              position={[0, 0.822, 0]}
              opacity={0.65}
              scale={4.2}
              blur={1.4}
              far={1.2}
              resolution={512}
              color="#000000"
            />
          )}

          {/* Laboratory Room Background Elements */}
          <group position={[0, 0, -2.6]}>
            {/* Back Wall */}
            <mesh position={[0, 2.5, 0]} receiveShadow>
              <planeGeometry args={[14, 7]} />
              <meshStandardMaterial color="#0f172a" roughness={0.8} />
            </mesh>

            {/* Whiteboard / Formula board */}
            <group position={[0, 2.7, 0.02]}>
              {/* Board frame */}
              <mesh>
                <boxGeometry args={[3.2, 1.4, 0.04]} />
                <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
              </mesh>
              {/* Board face */}
              <mesh position={[0, 0, 0.025]}>
                <planeGeometry args={[3.1, 1.3]} />
                <meshStandardMaterial color="#020617" roughness={0.2} metalness={0.1} />
              </mesh>
            </group>

            {/* Wall Shelf Units */}
            <group position={[0, 1.5, 0.15]}>
              {/* Metal Shelf Plank */}
              <mesh receiveShadow castShadow>
                <boxGeometry args={[4.2, 0.04, 0.35]} />
                <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.4} />
              </mesh>
              {/* Shelf brackets */}
              {[-1.6, 0, 1.6].map((x, i) => (
                <mesh key={i} position={[x, -0.15, -0.05]}>
                  <boxGeometry args={[0.03, 0.3, 0.25]} />
                  <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
                </mesh>
              ))}

              {/* Decorative glassware on shelf */}
              {/* Reagent bottles */}
              <mesh position={[-1.2, 0.18, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.26, 16]} />
                <meshStandardMaterial color="#78350f" transparent opacity={0.85} roughness={0.1} />
              </mesh>
              <mesh position={[-1.0, 0.18, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 0.22, 16]} />
                <meshStandardMaterial color="#0284c7" transparent opacity={0.8} roughness={0.1} />
              </mesh>
              {/* Erlenmeyer flask */}
              <mesh position={[0.9, 0.16, 0]}>
                <cylinderGeometry args={[0.03, 0.1, 0.24, 16]} />
                <meshStandardMaterial color="#38bdf8" transparent opacity={0.75} roughness={0.1} />
              </mesh>
              {/* Beakers */}
              <mesh position={[1.3, 0.14, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.18, 16]} />
                <meshStandardMaterial color="#a7f3d0" transparent opacity={0.7} roughness={0.1} />
              </mesh>
            </group>
          </group>

          {/* Laboratory Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[16, 16]} />
            <meshStandardMaterial color="#090d16" roughness={0.6} metalness={0.2} />
          </mesh>
        </group>
      )}

      {/* Main Experiment In-Scene Content */}
      {children}
    </>
  )
}
