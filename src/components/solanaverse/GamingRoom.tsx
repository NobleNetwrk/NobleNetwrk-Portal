"use client"
import React, { Suspense, useRef, useMemo, useState, useEffect } from 'react'
import { Box, Text, MeshReflectorMaterial, Cylinder, Sparkles, Torus } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { RigidBody, CuboidCollider } from '@react-three/rapier' 
import ArcadeCabinet from './ArcadeCabinet'
import * as THREE from 'three'

interface GamingRoomProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  playerPos: THREE.Vector3;
  onInteractArcade: () => void;
}

// --- SUB-COMPONENTS ---

function TronWarpGrid({ width, height, color = "#00FFFF" }: { width: number, height: number, color?: string }) {
    const horizontalCount = 10;
    const verticalCount = 14;
    
    return (
        <group position={[0, 0, -0.55]}> 
            {/* Horizontal Lines */}
            {Array.from({ length: horizontalCount }).map((_, i) => (
                <Box key={`h-${i}`} args={[width, 0.05, 0.05]} position={[0, (i * (height/horizontalCount)) - (height/2) + 1, 0]}>
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} />
                </Box>
            ))}
            {/* Vertical Lines */}
            {Array.from({ length: verticalCount }).map((_, i) => {
                const xBase = (i * (width/verticalCount)) - (width/2) + 1;
                const isCenter = Math.abs(xBase) < 4; 
                if (isCenter) {
                    const angle = xBase < 0 ? 0.1 : -0.1; 
                    return (
                        <group key={`v-warped-${i}`} position={[xBase, 0, 0]}>
                            <Box args={[0.05, height/2, 0.05]} position={[0, height/4, 0]}><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} /></Box>
                            <Box args={[0.05, height/2, 0.05]} position={[xBase < 0 ? -0.5 : 0.5, -height/4, 0]} rotation={[0, 0, angle]}><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} /></Box>
                        </group>
                    )
                } else {
                    return <Box key={`v-${i}`} args={[0.05, height, 0.05]} position={[xBase, 0, 0]}><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} /></Box>
                }
            })}
            {/* Warp Core */}
            <group position={[0, -6, 0.2]}> 
                <Torus args={[3.5, 0.1, 16, 64]}><meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} /></Torus>
                <Torus args={[2.8, 0.08, 16, 64]}><meshStandardMaterial color="#FF00FF" emissive="#FF00FF" emissiveIntensity={2} /></Torus>
                <Torus args={[2.1, 0.05, 16, 64]}><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} /></Torus>
                <Cylinder args={[1.5, 1.5, 0.2, 32]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#000" /></Cylinder>
                <Sparkles count={40} scale={[4, 4, 1]} size={6} speed={2} opacity={0.8} color="#00FFFF" />
            </group>
        </group>
    )
}

function CyberPillar({ position, height = 20 }: { position: [number, number, number], height?: number }) {
    return (
        <group position={position}>
            <RigidBody type="fixed" colliders="cuboid">
                <Box args={[2, height, 2]}><meshStandardMaterial color="#111" roughness={0.3} metalness={0.8} /></Box>
                <Box args={[0.1, height, 0.1]} position={[1, 0, 1]}><meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} /></Box>
                <Box args={[0.1, height, 0.1]} position={[-1, 0, 1]}><meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} /></Box>
                <Box args={[0.1, height, 0.1]} position={[1, 0, -1]}><meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} /></Box>
                <Box args={[0.1, height, 0.1]} position={[-1, 0, -1]}><meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} /></Box>
            </RigidBody>
        </group>
    )
}

function VortexWall({ color = "#00FFFF", invert = false, isMobile = false }: { color?: string, invert?: boolean, isMobile?: boolean }) {
    const ribsRef = useRef<THREE.Group>(null);
    useFrame((state) => {
        if (!isMobile && ribsRef.current) {
            ribsRef.current.children.forEach((child: any, i) => {
                const mesh = child.children[0]?.children[0]; 
                if (mesh && mesh.material) {
                    const t = state.clock.elapsedTime * 3;
                    const offset = invert ? (12 - i) : i; 
                    const wave = Math.sin(t - offset * 0.8) * 0.5 + 1.5; 
                    mesh.material.emissiveIntensity = wave;
                }
            });
        }
    });

    const ribs = useMemo(() => {
        const items = [];
        const count = 12;
        for (let i = 0; i < count; i++) {
            const t = i / (count - 1); 
            const z = -13 + (t * 26); 
            const scale = invert ? 0.6 + (t * 0.4) : 1.0 - (t * 0.4); 
            items.push({ z, scale });
        }
        return items;
    }, [invert]);

    return (
        <group>
            {/* PHYSICS WALL (Solid Barrier) */}
            <RigidBody type="fixed" colliders="cuboid">
                <Box args={[30, 20, 1]}><meshStandardMaterial color="#050505" metalness={0.8} roughness={0.2} /></Box>
            </RigidBody>

            {/* HIDE COMPLEX GEOMETRY ON MOBILE */}
            {!isMobile && (
                <group ref={ribsRef}>
                    {ribs.map((item, i) => (
                        <group key={i} position={[item.z, 0, 0]}>
                            <group rotation={[0, Math.PI / 2, 0]}>
                                <mesh rotation={[0, 0, -Math.PI / 2]} scale={[item.scale, item.scale, item.scale]}>
                                    <torusGeometry args={[8, 0.3, 8, 32, Math.PI]} /> 
                                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1} toneMapped={false} />
                                </mesh>
                            </group>
                        </group>
                    ))}
                </group>
            )}

            <group position={[0, 0, 1]}>
                <Box args={[30, 0.2, 0.2]} rotation={[0, 0, 0]}><meshBasicMaterial color="#ffffff" /></Box>
                <Box args={[30, 1.5, 1.5]} rotation={[0, 0, 0]}><meshBasicMaterial color={color} transparent opacity={0.05} /></Box>
                <group rotation={[0, 0, invert ? -Math.PI / 2 : Math.PI / 2]}>
                    <Sparkles count={isMobile ? 20 : 50} scale={[3, 28, 3]} size={8} speed={3} opacity={0.6} color="#ffffff" noise={0.1} />
                </group>
            </group>
        </group>
    )
}

function EntranceGate() {
    return (
        <group position={[0, 0, -15]}>
            <RigidBody type="fixed" colliders="cuboid">
                <group position={[-12, 10, 0]} rotation={[0, 0, -0.2]}>
                    <Box args={[4, 25, 4]}><meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.1} /></Box>
                    <Box args={[0.2, 25, 0.2]} position={[2, 0, 2]}><meshStandardMaterial color="#FF00FF" emissive="#FF00FF" emissiveIntensity={3} /></Box>
                </group>
                <group position={[12, 10, 0]} rotation={[0, 0, 0.2]}>
                    <Box args={[4, 25, 4]}><meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.1} /></Box>
                    <Box args={[0.2, 25, 0.2]} position={[-2, 0, 2]}><meshStandardMaterial color="#FF00FF" emissive="#FF00FF" emissiveIntensity={3} /></Box>
                </group>
                <Box args={[34, 4, 4]} position={[0, 18, 0]}><meshStandardMaterial color="#111" metalness={0.8} /></Box>
            </RigidBody>
            <Box args={[30, 0.2, 0.2]} position={[0, 16.5, 2]}><meshStandardMaterial color="#FF00FF" emissive="#FF00FF" emissiveIntensity={2} /></Box>
            <group position={[0, 14, 0]}>
                <Text fontSize={3.5} color="#00ff00" font="/ROMEO.TTF" anchorX="center" anchorY="middle" outlineWidth={0.1} outlineColor="#004400" rotation={[0, Math.PI, 0]}>ARCADE ZONE</Text>
                <Sparkles count={50} scale={[15, 5, 2]} size={4} speed={0.4} opacity={0.5} color="#00ff00" />
            </group>
        </group>
    )
}

// --- MAIN COMPONENT ---

export default function GamingRoom({ position, rotation = [0, 0, 0], playerPos, onInteractArcade }: GamingRoomProps) {
  
  // --- OPTIMIZATION: Check for Mobile ---
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <group position={position} rotation={rotation as any}>
        
        {/* --- FLOOR (Now Solid & Optimized) --- */}
        <RigidBody type="fixed" colliders="cuboid">
            {/* Visual Floor */}
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.14, 0]}>
                <planeGeometry args={[32, 32]} />
                {/* CONDITIONAL MATERIAL: Standard on Mobile, Reflector on Desktop */}
                {isMobile ? (
                    <meshStandardMaterial color="#050505" roughness={0.1} metalness={0.8} />
                ) : (
                    <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={50} roughness={0.1} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#050505" metalness={0.9} mirror={0.8} />
                )}
            </mesh>
            {/* Invisible Physics Floor */}
            <CuboidCollider args={[16, 0.5, 16]} position={[0, -0.5, 0]} />
        </RigidBody>

        {/* Floor Border Glow */}
        <Box args={[32, 0.2, 0.2]} position={[0, 0, 15]}><meshStandardMaterial color="#00ff00" emissive="#00ff00" /></Box>
        <Box args={[0.2, 0.2, 32]} position={[-15, 0, 0]}><meshStandardMaterial color="#00ff00" emissive="#00ff00" /></Box>
        <Box args={[0.2, 0.2, 32]} position={[15, 0, 0]}><meshStandardMaterial color="#00ff00" emissive="#00ff00" /></Box>

        {/* --- WALLS & STRUCTURE --- */}
        
        {/* Back Wall with TRON WARP GRID */}
        <group position={[0, 10, 15]}>
            <RigidBody type="fixed" colliders="cuboid">
                <Box args={[30, 20, 1]}><meshStandardMaterial color="#0a0a0a" metalness={0.5} /></Box>
            </RigidBody>
            {/* Optimized: Hide complex Tron Grid on Mobile */}
            {!isMobile && <TronWarpGrid width={28} height={18} color="#00FFFF" />}
        </group>

        {/* Side Walls (Vortex) - Simplified on Mobile */}
        <group position={[-15, 10, 0]} rotation={[0, Math.PI / 2, 0]}>
            <VortexWall color="#00FFFF" isMobile={isMobile} />
        </group>
        <group position={[15, 10, 0]} rotation={[0, -Math.PI / 2, 0]}>
            <VortexWall color="#00FFFF" invert={true} isMobile={isMobile} />
        </group>

        {/* Pillars */}
        <CyberPillar position={[-15, 10, 15]} /> 
        <CyberPillar position={[15, 10, 15]} /> 
        
        {/* Ceiling (Physics) */}
        <RigidBody type="fixed" colliders="cuboid" position={[0, 20, 0]}>
            <Box args={[32, 1, 32]}><meshStandardMaterial color="#050505" /></Box>
        </RigidBody>
        <group position={[0, 20, 0]}>
            <Box args={[25, 0.1, 0.2]} position={[0, -0.5, 0]}><meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} /></Box>
            <Box args={[0.2, 0.1, 25]} position={[0, -0.5, 0]}><meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.5} /></Box>
        </group>

        <EntranceGate />

        {/* --- ARCADE CABINETS (Solid Obstacles) --- */}
        <RigidBody type="fixed" colliders="hull">
            <ArcadeCabinet position={[0, 0, 12]} rotation={[0, 0, 0]} playerPos={playerPos} onInteract={onInteractArcade} />
        </RigidBody>
        <RigidBody type="fixed" colliders="hull">
            <ArcadeCabinet position={[-12, 0, 8]} rotation={[0, -Math.PI / 2, 0]} playerPos={playerPos} onInteract={onInteractArcade} />
        </RigidBody>
        <RigidBody type="fixed" colliders="hull">
            <ArcadeCabinet position={[-12, 0, 0]} rotation={[0, -Math.PI / 2, 0]} playerPos={playerPos} onInteract={onInteractArcade} />
        </RigidBody>
        <RigidBody type="fixed" colliders="hull">
            <ArcadeCabinet position={[-12, 0, -8]} rotation={[0, -Math.PI / 2, 0]} playerPos={playerPos} onInteract={onInteractArcade} />
        </RigidBody>
        <RigidBody type="fixed" colliders="hull">
            <ArcadeCabinet position={[12, 0, 8]} rotation={[0, Math.PI / 2, 0]} playerPos={playerPos} onInteract={onInteractArcade} />
        </RigidBody>
        <RigidBody type="fixed" colliders="hull">
            <ArcadeCabinet position={[12, 0, 0]} rotation={[0, Math.PI / 2, 0]} playerPos={playerPos} onInteract={onInteractArcade} />
        </RigidBody>
        <RigidBody type="fixed" colliders="hull">
            <ArcadeCabinet position={[12, 0, -8]} rotation={[0, Math.PI / 2, 0]} playerPos={playerPos} onInteract={onInteractArcade} />
        </RigidBody>
    </group>
  )
}