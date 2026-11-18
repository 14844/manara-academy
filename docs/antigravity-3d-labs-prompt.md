# Prompt for Antigravity — 3D Virtual Labs (Manara Academy)

Copy everything below the line into Antigravity, opened on this repository.

---

You are working on **Manara Academy**, an Arabic (RTL) e-learning platform for Egyptian secondary-school students (Thanaweya Amma). Stack: **Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, shadcn/ui, framer-motion**, Firebase. Dark theme with a blue accent. Read the codebase before changing anything.

## Goal
Replace the current 2D virtual labs with **realistic, interactive 3D laboratories** that feel like standing in a real lab — the best virtual labs any Arabic platform has. Then add a new **Space & Planets lab**. Every lab must be scientifically correct and aligned with the Egyptian secondary curriculum.

## Existing code (keep routes and public behaviour)
- Listing: `src/app/labs/page.tsx` — Experiment page: `src/app/labs/[id]/page.tsx`
- Current labs to rebuild in 3D: `src/components/labs/circuit-lab.tsx` (electric circuits), `src/components/labs/molecule-lab.tsx` (molecule building), `src/components/labs/reaction-lab.tsx` (chemical reactions & balancing equations), `src/components/labs/function-lab.tsx` (math functions/graphs).
- Labs are public (no login, no plan gating). Keep it that way.

## Technology
- `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier` (physics) and `@react-three/postprocessing` (subtle bloom/SSAO only on desktop). Pin exact versions compatible with React 19.
- Load every lab with `next/dynamic` and `ssr: false`; the 3D code must not be in any other page's bundle.
- Use glTF/GLB models (Draco/meshopt compressed) from CC0/permissively licensed sources (e.g. Poly Haven, Kenney, Sketchfab CC0) or build them procedurally. Put license/attribution in `public/models/LICENSES.md`. No copyrighted or paid assets.
- Planet textures: NASA / Solar System Scope textures that are licensed for reuse (record attribution).

## Every lab must have
1. **A real lab room**: bench, shelves, equipment, realistic PBR materials and lighting, soft shadows; camera with orbit/zoom limits and a "reset view" button.
2. **Hands-on interaction**: pick up, drag, connect, pour, rotate with mouse and touch (pinch/rotate on phones). Snapping where it helps (wires to terminals, atoms to bond sites).
3. **Correct science, live**: values computed from real formulas and shown on in-scene instruments (ammeter, voltmeter, thermometer, balance, pH indicator…). Wrong setups produce realistic results (short circuit → fuse blows/warning; unbalanced equation → mass mismatch shown).
4. **Guided experiments + free mode**: each lab ships 3–5 guided experiments tied to curriculum lessons (Arabic step-by-step instructions, hints, a short question at the end with instant feedback) plus a sandbox mode.
5. **Arabic RTL UI** overlay (shadcn components), Egyptian-Arabic friendly wording, numbers and units correct (Ω, V, A, mol, g/mol…).
6. **Performance**: 60 fps on desktop, ≥30 fps on a mid/low Android phone. Adaptive quality (detect device/`navigator.hardwareConcurrency`, lower DPR, disable shadows/post-processing on weak devices), instancing, lazy texture loading, dispose on unmount. Show a progress loader while assets load. Respect `prefers-reduced-motion`.
7. **Accessibility & fallbacks**: keyboard controls where feasible, readable contrast, and a graceful message if WebGL is unavailable.

## Lab specs
- **Electricity (physics):** battery/power supply, resistors (color bands match value), bulbs whose brightness follows power, switches, rheostat, ammeter/voltmeter that must be connected correctly (series/parallel), wires with visible current flow particles. Ohm's law, series/parallel resistance, Kirchhoff's laws, electric power, short-circuit safety.
- **Molecules (chemistry):** 3D atoms (CPK colors, correct relative sizes), valence-correct bonding (single/double/triple), VSEPR geometry with bond angles, functional groups for organic chemistry (alkanes, alkenes, alcohols, carboxylic acids…), IUPAC name shown for built molecules, switch between ball-and-stick and space-filling.
- **Reactions (chemistry):** glassware (beakers, flasks, burette, test tubes, Bunsen burner), pouring with liquid simulation (shader-based is fine), color changes, gas bubbles, precipitates, temperature change, titration with indicator and endpoint, equation balancing with conservation-of-mass check.
- **Functions (math):** 3D/2D graphing board in the lab: plot functions from input, sliders for parameters with live transformation (shift/stretch/reflect), derivative and tangent line, area under curve, intersections.
- **NEW — Space & Planets lab (`/labs/space`):** an observatory/planetarium room that opens into the solar system. Sun + 8 planets + major moons with real textures, axial tilt, rotation, and Keplerian orbits; toggle "real scale" vs "visual scale"; time controls (pause, speed up, date picker); click a planet for an Arabic info card (mass, radius, gravity, day/year length, temperature, moons); a gravity sandbox (Newton's law of gravitation — place bodies, set velocity, see orbits/escape velocity); weight on other planets; phases of the Moon and eclipses explained in 3D. Add it to the labs listing.

## Process
1. Inspect the existing labs and reuse their curriculum content/logic.
2. Build a shared 3D lab framework first (`src/components/labs/3d/`: scene shell, lab room, camera controls, interaction/drag system, instrument HUD, quality manager, loader), then each lab on top of it.
3. Keep the TypeScript strict and passing (`tsc --noEmit`) and `next build` green. Don't touch unrelated parts of the app (auth, payments, admin, plans).
4. Commit per lab with clear messages.

Quality bar: when a student opens a lab it should feel like a real school lab they can touch — accurate physics/chemistry, polished visuals, smooth on phones.
