"use client"
import React, { useRef, memo, Suspense, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box, Cylinder, Torus, Text, Octahedron, Sparkles, MeshReflectorMaterial, Dodecahedron } from '@react-three/drei'
import { RigidBody, CuboidCollider, CylinderCollider } from '@react-three/rapier' // IMPORT PHYSICS
import * as THREE from 'three'

const HENGE_RADIUS = 40;
const BORDER_RADIUS = 48; 

// --- SOLANA GRADIENT COLORS ---
const SOL_TOP = "#14F195";    // Green
const SOL_MID = "#9945FF";    // Blue/Purple Mix
const SOL_BOT = "#E4007C";    // Deep Purple/Magenta

// --- SUB-COMPONENT: STONE BORDER (With Entrance Gap) ---
const StoneHengeBorder = memo(() => {
    const stones = useMemo(() => {
        return new Array(24).fill(0).map((_, i) => {
            const angle = (i / 24) * Math.PI * 2;
            
            // --- GAP LOGIC ---
            if (Math.abs(angle - Math.PI) < 0.5) return null;

            const r = BORDER_RADIUS + (Math.random() * 4 - 2); 
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            const scale = 1.5 + Math.random() * 1.5;
            const rotY = Math.random() * Math.PI;
            const rotZ = (Math.random() * 0.5) - 0.25; 
            return { x, z, scale, rotY, rotZ };
        }).filter(Boolean); 
    }, []);

    return (
        <group>
            {stones.map((stone: any, i) => (
                <RigidBody key={i} type="fixed" colliders="hull" position={[stone.x, 0, stone.z]} rotation={[0, stone.rotY, stone.rotZ]}>
                    <Dodecahedron args={[1.5, 0]} scale={[stone.scale, stone.scale * 1.5, stone.scale]} position={[0, stone.scale, 0]}>
                        <meshStandardMaterial color="#1a1a1a" roughness={0.9} flatShading />
                    </Dodecahedron>
                    <Dodecahedron args={[0.8, 0]} position={[1, 0.5, 1]} scale={0.5}>
                        <meshStandardMaterial color="#111" roughness={1} />
                    </Dodecahedron>
                </RigidBody>
            ))}
        </group>
    );
});
StoneHengeBorder.displayName = 'StoneHengeBorder';

// --- SUB-COMPONENT: ANCIENT MONOLITH BAR ---
const MonolithBar = ({ color, position }: any) => {
    const width = 12;
    const height = 2.8;
    const slant = 3.5; 
    const depth = 4;

    const shape = useMemo(() => {
        const s = new THREE.Shape();
        s.moveTo(0, 0);
        s.lineTo(width, 0);
        s.lineTo(width + slant, height);
        s.lineTo(slant, height);
        s.lineTo(0, 0);
        return s;
    }, [width, height, slant]);

    return (
        <group position={position}>
            <group position={[-(width + slant) / 2, -height / 2, -depth / 2]}>
                <mesh position={[0, 0, 0.2]} scale={[1, 1, 0.9]}>
                    <extrudeGeometry args={[shape, { depth: depth - 0.4, bevelEnabled: false }]} />
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} toneMapped={false} />
                </mesh>
                <mesh position={[0, 0, depth - 0.5]}>
                    <extrudeGeometry args={[shape, { depth: 0.5, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2 }]} />
                    <meshStandardMaterial color="#0a0a0a" roughness={1} metalness={0.2} />
                </mesh>
                <mesh position={[0, 0, -0.5]}>
                    <extrudeGeometry args={[shape, { depth: 0.5, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2 }]} />
                    <meshStandardMaterial color="#0a0a0a" roughness={1} metalness={0.2} />
                </mesh>
                <pointLight position={[width/2, height/2, depth/2]} color={color} intensity={5} distance={15} decay={2} />
            </group>
        </group>
    );
};

// --- SUB-COMPONENT: SOLANA MONOLITH (CENTER) ---
function SolanaMonolith() {
    const groupRef = useRef<THREE.Group>(null);
    useFrame((state, delta) => {
        if (groupRef.current) {
            groupRef.current.rotation.y -= delta * 0.2; 
            groupRef.current.position.y = 9 + Math.sin(state.clock.elapsedTime * 0.5) * 1.0;
        }
    });

    return (
        <group>
            {/* PHYSICS: Invisible Box for Monolith Collision (If player jumps high) */}
            <RigidBody type="fixed" colliders="cuboid" position={[0, 9, 0]}>
                 <Box args={[12, 12, 4]} visible={false} />
            </RigidBody>

            <group ref={groupRef} position={[0, 9, 0]} rotation={[0, -Math.PI/6, 0]}> 
                <MonolithBar color={SOL_TOP} position={[0, 4.0, 0]} />
                <group rotation={[0, Math.PI, 0]}>
                    <MonolithBar color={SOL_MID} position={[0, 0, 0]} />
                </group>
                <MonolithBar color={SOL_BOT} position={[0, -4.0, 0]} />
                <Sparkles count={40} scale={[14, 22, 14]} size={8} speed={0.4} opacity={0.5} color={SOL_TOP} position={[0, 6, 0]} />
                <Sparkles count={40} scale={[14, 22, 14]} size={8} speed={0.4} opacity={0.5} color={SOL_MID} position={[0, -6, 0]} />
            </group>
        </group>
    )
}

// --- PORTAL COMPONENTS ---

function MysticPortal({ position, rotation, label, color = "#8b5cf6" }: any) {
    const ringRef = useRef<THREE.Group>(null);
    useFrame((state, delta) => { if (ringRef.current) ringRef.current.rotation.z += delta * 0.5; })
    const displayLabel = label ? label.toUpperCase() : "UNKNOWN PORTAL";
    return (
        <group position={position} rotation={rotation}>
            {/* Base Platform */}
            <group position={[0, 7, 0]}>
                {/* PHYSICS: Side Pillars */}
                <RigidBody type="fixed" colliders="hull">
                    <Cylinder args={[1.5, 2, 16, 8]} position={[-6, 0, 0]} castShadow><meshStandardMaterial color="#888" roughness={0.9} /></Cylinder>
                </RigidBody>
                <RigidBody type="fixed" colliders="hull">
                    <Cylinder args={[1.5, 2, 16, 8]} position={[6, 0, 0]} castShadow><meshStandardMaterial color="#888" roughness={0.9} /></Cylinder>
                </RigidBody>
                <RigidBody type="fixed" colliders="cuboid">
                    <Box args={[16, 2, 3]} position={[0, 8, 0]} castShadow><meshStandardMaterial color="#777" roughness={0.9} /></Box>
                </RigidBody>
            </group>
            
            <group ref={ringRef} position={[0, 7, 0]}>
                <Torus args={[4.5, 0.3, 16, 32]}><meshBasicMaterial color={color} toneMapped={false} /></Torus>
                <Torus args={[4.5, 0.8, 16, 8]} rotation={[0,0,0.5]} scale={1.05}><meshStandardMaterial color="#222" wireframe /></Torus>
            </group>
            <Cylinder args={[4, 4, 1, 32]} rotation={[Math.PI/2, 0, 0]} position={[0, 7, 0]}><meshBasicMaterial color="black" /></Cylinder>
            <group position={[0, 19, 0]}>
                <Box args={[displayLabel.length * 0.8 + 2, 3, 0.5]} position={[0, 0, -0.2]}><meshStandardMaterial color="#222" roughness={1} /></Box>
                <Suspense fallback={null}>
                    <Text position={[0, 0, 0.1]} fontSize={1.5} color="#FFD700" font="/ROMEO.TTF" anchorX="center" anchorY="middle" material-toneMapped={false}>{displayLabel}</Text>
                </Suspense>
            </group>
        </group>
    )
}

function NexusGate({ position, rotation = [0, 0, 0] }: { position: [number, number, number], rotation?: [number, number, number] }) {
  const crystalRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => { if (crystalRef.current) crystalRef.current.rotation.y += delta * 0.5; });
  return (
    <group position={position} rotation={rotation as any}>
       {/* Stone Pathway Under Gate - Extended to 60 to act as a bridge */}
       <RigidBody type="fixed" colliders="cuboid">
            <Box args={[40, 0.5, 60]} position={[0, 0.2, 0]}>
                    <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
            </Box>
       </RigidBody>
       
       <group position={[-16, 0, 0]}>
          <RigidBody type="fixed" colliders="cuboid">
              <Box args={[7, 8, 7]} position={[0, 4, 0]}><meshStandardMaterial color="#1a1a1a" roughness={1} /></Box>
              <Box args={[6, 12, 6]} position={[0, 14, 0]} rotation={[0, 0.1, 0]}><meshStandardMaterial color="#2a2a2a" roughness={1} /></Box>
              <Box args={[6.5, 14, 6.5]} position={[0, 27, 0]} rotation={[0, -0.1, 0]}><meshStandardMaterial color="#1a1a1a" roughness={1} /></Box>
          </RigidBody>
       </group>
       <group position={[16, 0, 0]}>
          <RigidBody type="fixed" colliders="cuboid">
              <Box args={[7, 8, 7]} position={[0, 4, 0]}><meshStandardMaterial color="#1a1a1a" roughness={1} /></Box>
              <Box args={[6, 12, 6]} position={[0, 14, 0]} rotation={[0, -0.1, 0]}><meshStandardMaterial color="#2a2a2a" roughness={1} /></Box>
              <Box args={[6.5, 14, 6.5]} position={[0, 27, 0]} rotation={[0, 0.1, 0]}><meshStandardMaterial color="#1a1a1a" roughness={1} /></Box>
          </RigidBody>
       </group>
       
       <group position={[0, 32, 0]}>
           <Box args={[45, 6, 8]} rotation={[0, 0, 0.02]} position={[0, 0, 0]}><meshStandardMaterial color="#111" roughness={0.9} /></Box>
           <Suspense fallback={null}>
               <Text position={[0, 0, 4.1]} fontSize={3.5} color="#e9d5ff" font="/ROMEO.TTF" anchorX="center" anchorY="middle" material-toneMapped={false}>PORTAL NEXUS</Text>
               <Text position={[0, 0, 4.05]} fontSize={3.6} color="#7c3aed" font="/ROMEO.TTF" anchorX="center" anchorY="middle" material-toneMapped={false} fillOpacity={0.4}>PORTAL NEXUS</Text>
           </Suspense>
       </group>
       <group ref={crystalRef} position={[0, 20, 0]}>
            <Octahedron args={[1.5]} position={[-16, 4, 0]}><meshBasicMaterial color="#a855f7" wireframe /></Octahedron>
            <Octahedron args={[1.5]} position={[16, 4, 0]}><meshBasicMaterial color="#a855f7" wireframe /></Octahedron>
       </group>
       <pointLight position={[-16, 24, 4]} color="#a855f7" intensity={40} distance={20} />
       <pointLight position={[16, 24, 4]} color="#a855f7" intensity={40} distance={20} />
       <Sparkles count={60} scale={[40, 35, 10]} size={6} speed={0.4} opacity={0.6} color="#d8b4fe" position={[0, 15, 0]} />
    </group>
  )
}

const PortalNexus = memo(({ publicGalleries, position }: { publicGalleries: any[], position: [number, number, number] }) => {
    const radius = HENGE_RADIUS;
    return (
        <group position={position}>
            {/* 1. STONE BORDER (With Entrance Gap) */}
            <StoneHengeBorder />

            {/* 2. SOLANA MONOLITH */}
            <SolanaMonolith />

            {/* 3. ENTRANCE GATE */}
            {/* Moved to -50 (Just outside border) acting as main entrance */}
            <NexusGate 
                position={[-50, 0, 0]} 
                rotation={[0, -Math.PI / 2, 0]} 
            />
            
            {/* 4. USER PORTALS */}
            {publicGalleries.map((gallery: any, i: number) => {
                const angle = (i / publicGalleries.length) * Math.PI * 2;
                const x = Math.cos(angle) * radius;
                const z = Math.sin(angle) * radius;
                
                // Gap for entrance in the portals too, to prevent overlap
                if (Math.abs(angle - Math.PI) < 0.2) return null;

                const rot = -angle - Math.PI / 2; 
                
                return (
                    <MysticPortal 
                        key={i}
                        position={[x, 0, z]} 
                        rotation={[0, rot, 0]} 
                        label={gallery.name || gallery.owner.slice(0, 6)}
                        color="#a855f7" 
                    />
                )
            })}
             {/* PHYSICS FLOOR FOR PORTAL AREA */}
             <RigidBody type="fixed" colliders={false}>
                <CylinderCollider args={[0.2, radius + 10]} position={[0, -0.2, 0]} />
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
                    <circleGeometry args={[radius + 10, 64]} />
                    <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={20} roughness={0.3} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#050505" metalness={0.6} mirror={0.5} />
                </mesh>
             </RigidBody>
        </group>
    )
});

export default PortalNexus;