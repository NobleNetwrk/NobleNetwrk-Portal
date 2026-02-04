"use client"
import React, { Suspense, useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { 
    Environment, 
    Sky,
    Box, 
    Text, 
    MeshReflectorMaterial, 
    ContactShadows,
    Cylinder,
    Torus,
    Sphere,
    Octahedron,
    Sparkles,
    Dodecahedron
} from '@react-three/drei'
import * as THREE from 'three'
import VoxelPlayer from './VoxelPlayer'
import { useOthers } from '@/liveblocks.config'
import SpatialAudio from './SpatialAudio';
import { toast } from 'react-toastify'; 
import { useAssetHoldings } from '@/hooks/useAssetHoldings';

// --- ENVIRONMENT IMPORTS ---
import GeckoGarage from './GeckoGarage';
import SenseiDojo from './SenseiDojo';

// --- CONSTANTS ---
const WALL_HEIGHT = 40; 
const ROOM_WIDTH = 60;
const ROOM_DEPTH = 100; 
const EXIT_PORTAL_Z = 30; 

// --- ZONES (FIXED TYPES) ---
const PORTAL_AREA_OFFSET: [number, number, number] = [120, 0, 50]; 
const COMMUNITY_AREA_OFFSET: [number, number, number] = [-120, 0, 50]; 
// New Zone: IRL Art Gallery (Opposite Main Hall)
const ART_GALLERY_OFFSET: [number, number, number] = [0, 0, 140]; 
const HENGE_RADIUS = 40;                
const PORTAL_TRIGGER_DIST = 5.0;

// --- UTILS ---
const cleanUrl = (url: string) => {
  if (!url || url.includes('undefined') || url.includes('mp4')) return "/ntwrk-logo.png";
  if (url.startsWith("ipfs://")) return url.replace("ipfs://", "https://cloudflare-ipfs.com/ipfs/");
  if (url.includes("nftstorage.link")) {
    const match = url.match(/bafy[a-zA-Z0-9]+/);
    if (match) return `https://cloudflare-ipfs.com/ipfs/${match[0]}`;
  }
  return url;
};

// --- SAFE TEXTURE LOADER ---
function SafeImageMaterial({ url, opacity = 1, transparent = false }: { url: string, opacity?: number, transparent?: boolean }) {
    const [texture, setTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        if (!url) return;
        const loader = new THREE.TextureLoader();
        loader.crossOrigin = "Anonymous";
        loader.load(url, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearFilter; 
            setTexture(tex);
        }, undefined, () => console.warn("Failed texture:", url));
        return () => { if (texture) texture.dispose(); };
    }, [url]);

    if (!texture) return <meshBasicMaterial color="#333" />;
    return <meshBasicMaterial map={texture} transparent={transparent} opacity={opacity} side={THREE.DoubleSide} />;
}

// --- ARCHITECTURAL COMPONENTS ---

// 1. ANCIENT PORTAL
function MysticPortal({ position, rotation, label, color = "#8b5cf6" }: any) {
    const ringRef = useRef<THREE.Group>(null);
    useFrame((state, delta) => {
        if (ringRef.current) ringRef.current.rotation.z += delta * 0.5; 
    })

    const displayLabel = label ? label.toUpperCase() : "UNKNOWN PORTAL";

    return (
        <group position={position} rotation={rotation}>
            <group position={[0, 7, 0]}>
                <Cylinder args={[1.5, 2, 16, 8]} position={[-6, 0, 0]} castShadow><meshStandardMaterial color="#888" roughness={0.9} /></Cylinder>
                <Cylinder args={[1.5, 2, 16, 8]} position={[6, 0, 0]} castShadow><meshStandardMaterial color="#888" roughness={0.9} /></Cylinder>
                <Box args={[16, 2, 3]} position={[0, 8, 0]} castShadow><meshStandardMaterial color="#777" roughness={0.9} /></Box>
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

// 2. STANDARD MUSEUM PILLAR
function MuseumPillar({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            <Box args={[3, 2, 3]} position={[0, 1, 0]}><meshStandardMaterial color="#1a1a1a" roughness={0.2} /></Box>
            <Cylinder args={[1, 1, WALL_HEIGHT, 32]} position={[0, WALL_HEIGHT/2, 0]}><meshStandardMaterial color="#f5f5f5" roughness={0.1} metalness={0.1} /></Cylinder>
            <Cylinder args={[1.5, 1, 2, 32]} position={[0, WALL_HEIGHT - 1, 0]}><meshStandardMaterial color="#FFD700" metalness={1} roughness={0.2} /></Cylinder>
        </group>
    )
}

// 3. GRAND PILLAR
function GrandPillar({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
             <Box args={[6, 4, 6]} position={[0, 2, 0]}><meshStandardMaterial color="#0a0a0a" roughness={0.3} /></Box>
             <Box args={[5, 1, 5]} position={[0, 4.5, 0]}><meshStandardMaterial color="#DAA520" metalness={0.8} roughness={0.2} /></Box>
             <Cylinder args={[2, 2.5, WALL_HEIGHT - 6, 16]} position={[0, WALL_HEIGHT/2 + 1, 0]}><meshStandardMaterial color="#111" roughness={0.4} metalness={0.6} /></Cylinder>
             <Torus args={[2.6, 0.2, 16, 32]} position={[0, 10, 0]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#DAA520" /></Torus>
             <Torus args={[2.4, 0.2, 16, 32]} position={[0, 25, 0]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#DAA520" /></Torus>
             <Box args={[5, 2, 5]} position={[0, WALL_HEIGHT - 1, 0]}><meshStandardMaterial color="#DAA520" metalness={0.8} /></Box>
        </group>
    )
}

// 4. NEXUS GATE
function NexusGate({ position, rotation = [0, 0, 0] }: { position: [number, number, number], rotation?: [number, number, number] }) {
  const crystalRef = useRef<THREE.Group>(null);
  useFrame((state, delta) => { if (crystalRef.current) crystalRef.current.rotation.y += delta * 0.5; });
  return (
    <group position={position} rotation={rotation as any}>
       <group position={[-16, 0, 0]}>
          <Box args={[7, 8, 7]} position={[0, 4, 0]}><meshStandardMaterial color="#1a1a1a" roughness={1} /></Box>
          <Box args={[6, 12, 6]} position={[0, 14, 0]} rotation={[0, 0.1, 0]}><meshStandardMaterial color="#2a2a2a" roughness={1} /></Box>
          <Box args={[6.5, 14, 6.5]} position={[0, 27, 0]} rotation={[0, -0.1, 0]}><meshStandardMaterial color="#1a1a1a" roughness={1} /></Box>
       </group>
       <group position={[16, 0, 0]}>
          <Box args={[7, 8, 7]} position={[0, 4, 0]}><meshStandardMaterial color="#1a1a1a" roughness={1} /></Box>
          <Box args={[6, 12, 6]} position={[0, 14, 0]} rotation={[0, -0.1, 0]}><meshStandardMaterial color="#2a2a2a" roughness={1} /></Box>
          <Box args={[6.5, 14, 6.5]} position={[0, 27, 0]} rotation={[0, 0.1, 0]}><meshStandardMaterial color="#1a1a1a" roughness={1} /></Box>
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

// 5. FLOWER PLANTER
function FlowerPlanter({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            <Box args={[3, 2.5, 3]} position={[0, 1.25, 0]} castShadow><meshStandardMaterial color="#050505" roughness={0.2} /></Box>
            <Box args={[3.2, 0.5, 3.2]} position={[0, 2.5, 0]}><meshStandardMaterial color="#DAA520" metalness={0.8} /></Box>
            <group position={[0, 2.8, 0]}>
                <Sphere args={[0.5, 8, 8]} position={[0.5, 0, 0.5]}><meshStandardMaterial color="#e11d48" /></Sphere>
                <Sphere args={[0.6, 8, 8]} position={[-0.5, 0.2, -0.5]}><meshStandardMaterial color="#9333ea" /></Sphere>
                <Sphere args={[0.5, 8, 8]} position={[0.6, 0.1, -0.6]}><meshStandardMaterial color="#fbbf24" /></Sphere>
                <Sphere args={[0.4, 8, 8]} position={[-0.6, 0, 0.6]}><meshStandardMaterial color="#ef4444" /></Sphere>
                <Box args={[2.5, 0.2, 2.5]} position={[0, -0.1, 0]}><meshStandardMaterial color="#166534" /></Box>
            </group>
            <pointLight position={[0, 4, 0]} intensity={10} distance={15} color="#fbbf24" />
        </group>
    )
}

// 6. WATER FOUNTAIN
function WaterFountain({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            <Cylinder args={[6, 7, 2, 8]} position={[0, 1, 0]}><meshStandardMaterial color="#333" roughness={0.4} /></Cylinder>
            <Cylinder args={[4, 4, 1, 8]} position={[0, 2.5, 0]}><meshStandardMaterial color="#1a1a1a" roughness={0.4} /></Cylinder>
            <Cylinder args={[2, 2, 4, 8]} position={[0, 4, 0]}><meshStandardMaterial color="#333" roughness={0.4} /></Cylinder>
            <Cylinder args={[5.5, 5.5, 0.5, 8]} position={[0, 1.8, 0]}><meshStandardMaterial color="#00BFFF" opacity={0.8} transparent /></Cylinder>
            <Sparkles count={150} scale={[6, 12, 6]} size={4} speed={0.8} opacity={0.5} color="#00BFFF" position={[0, 6, 0]} />
            <pointLight position={[0, 5, 0]} intensity={20} color="#00BFFF" distance={15} />
        </group>
    )
}

// 7. HEART PORTAL GEOMETRY (DOJO)
function HeartPortalGeometry({ color }: { color: string }) {
    const shape = useMemo(() => {
        const heartShape = new THREE.Shape();
        const x = 0, y = 0;
        heartShape.moveTo( x + 5, y + 5 );
        heartShape.bezierCurveTo( x + 5, y + 5, x + 4, y, x, y );
        heartShape.bezierCurveTo( x - 6, y, x - 6, y + 7,x - 6, y + 7 );
        heartShape.bezierCurveTo( x - 6, y + 11, x - 3, y + 15.4, x + 5, y + 19 );
        heartShape.bezierCurveTo( x + 12, y + 15.4, x + 16, y + 11, x + 16, y + 7 );
        heartShape.bezierCurveTo( x + 16, y + 7, x + 16, y, x + 10, y );
        heartShape.bezierCurveTo( x + 7, y, x + 5, y + 5, x + 5, y + 5 );
        return heartShape;
    }, []);

    const meshRef = useRef<THREE.Mesh>(null);

    // Pulse Animation
    useFrame((state) => {
        if (meshRef.current) {
            const t = state.clock.elapsedTime;
            const scale = 0.35 + Math.sin(t * 3) * 0.02; 
            meshRef.current.scale.set(scale, scale, scale);
        }
    })

    return (
        <mesh ref={meshRef} position={[1.5, 2, 0]} rotation={[0, 0, Math.PI]}>
            <extrudeGeometry args={[shape, { depth: 4, bevelEnabled: true, bevelSegments: 3, steps: 2, bevelSize: 1, bevelThickness: 1 }]} />
            <meshStandardMaterial color={color} wireframe />
        </mesh>
    )
}

// 8. RESTRICTED COMMUNITY PORTAL
function RestrictedPortal({ position, rotation, label, color, type }: any) {
    const ringRef = useRef<THREE.Group>(null);
    
    useFrame((state, delta) => { 
        if (type !== 'panda' && ringRef.current) {
            ringRef.current.rotation.z -= delta * 0.8; 
        }
    })

    return (
        <group position={position} rotation={rotation}>
            <group position={[0, 7, 0]}>
                <Box args={[2, 14, 2]} position={[-5, 0, 0]}><meshStandardMaterial color="#1a1a1a" /></Box>
                <Box args={[2, 14, 2]} position={[5, 0, 0]}><meshStandardMaterial color="#1a1a1a" /></Box>
                <Box args={[12, 2, 2]} position={[0, 7, 0]}><meshStandardMaterial color="#1a1a1a" /></Box>
            </group>

            <group ref={ringRef} position={[0, 7, 0]}>
                {type === 'panda' ? (
                    <HeartPortalGeometry color={color} />
                ) : type === 'gecko' ? (
                    <Dodecahedron args={[4]}><meshStandardMaterial color={color} wireframe /></Dodecahedron>
                ) : (
                    <Torus args={[4, 0.5, 16, 32]}><meshStandardMaterial color={color} wireframe /></Torus>
                )}
            </group>

            <Box args={[3, 1, 1]} position={[0, 13, 0]}><meshStandardMaterial color="#DAA520" /></Box>
            <Suspense fallback={null}>
                <Text position={[0, 15, 1.5]} fontSize={1.2} color={color} font="/ROMEO.TTF" anchorX="center" anchorY="middle" material-toneMapped={false}>
                    {label}
                </Text>
                <Text position={[0, 2.5, 0]} fontSize={0.6} color="white" anchorX="center" anchorY="middle">
                    HOLDERS ONLY
                </Text>
            </Suspense>
        </group>
    )
}

// 9. COMMUNITY PLAZA
function CommunityPlaza({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.15, 0]}>
                <circleGeometry args={[40, 32]} />
                <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={10} roughness={0.8} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#2a2a2a" metalness={0.2} mirror={0.2} />
            </mesh>

            <WaterFountain position={[0, 0, 0]} />

            <RestrictedPortal position={[0, 0, -30]} rotation={[0, 0, 0]} label="SENSEI DOJO" color="#FDB813" type="panda" />
            <RestrictedPortal position={[0, 0, 30]} rotation={[0, Math.PI, 0]} label="GECKO GARAGE" color="#00FF00" type="gecko" />
            
            <FlowerPlanter position={[20, 0, 20]} />
            <FlowerPlanter position={[-20, 0, 20]} />
            <FlowerPlanter position={[20, 0, -20]} />
            <FlowerPlanter position={[-20, 0, -20]} />
        </group>
    )
}

// 10. GRAND WALKWAY (UPDATED)
function GrandWalkway() {
    return (
        <group>
            {/* Main Path to Portals */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 32.5]} receiveShadow>
                <planeGeometry args={[24, 35]} /> 
                <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={30} roughness={0.4} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#0a0a0a" metalness={0.5} mirror={0.5} />
            </mesh>
            <Box args={[0.5, 0.5, 35]} position={[-12, 0, 32.5]}><meshStandardMaterial color="#DAA520" metalness={0.8} /></Box>
            <Box args={[0.5, 0.5, 35]} position={[12, 0, 32.5]}><meshStandardMaterial color="#DAA520" metalness={0.8} /></Box>

            {/* Central Hub Area */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 50]} receiveShadow>
                <planeGeometry args={[24, 24]} />
                <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={30} roughness={0.4} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#0a0a0a" metalness={0.5} mirror={0.5} />
            </mesh>

            {/* Side Path Left */}
            <group position={[60, 0, 50]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-34, -0.15, 0]} receiveShadow>
                    <planeGeometry args={[28, 24]} />
                    <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={30} roughness={0.4} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#0a0a0a" metalness={0.5} mirror={0.5} />
                </mesh>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 0]} receiveShadow>
                    <planeGeometry args={[40, 24]} />
                    <meshStandardMaterial color="#444" roughness={0.9} metalness={0.1} /> 
                </mesh>
                <Box args={[92, 0.5, 0.5]} position={[-26, 0, 12]}><meshStandardMaterial color="#DAA520" metalness={0.8} /></Box>
                <Box args={[68, 0.5, 0.5]} position={[-14, 0, -12]}><meshStandardMaterial color="#DAA520" metalness={0.8} /></Box>
                <Box args={[40, 0.55, 0.55]} position={[0, 0, 12]}><meshStandardMaterial color="#333" roughness={0.9} /></Box>
                <Box args={[40, 0.55, 0.55]} position={[0, 0, -12]}><meshStandardMaterial color="#333" roughness={0.9} /></Box>
            </group>

            {/* Side Path Right */}
            <group position={[-60, 0, 50]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]} position={[10, -0.15, 0]} receiveShadow>
                    <planeGeometry args={[100, 24]} />
                    <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={30} roughness={0.4} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#0a0a0a" metalness={0.5} mirror={0.5} />
                </mesh>
                <Box args={[100, 0.5, 0.5]} position={[10, 0, 12]}><meshStandardMaterial color="#DAA520" metalness={0.8} /></Box>
                <Box args={[100, 0.5, 0.5]} position={[10, 0, -12]}><meshStandardMaterial color="#DAA520" metalness={0.8} /></Box>
            </group>

            {/* NEW: Path Extension to IRL Gallery */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 100]} receiveShadow>
                <planeGeometry args={[24, 100]} /> 
                <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={30} roughness={0.4} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#0a0a0a" metalness={0.5} mirror={0.5} />
            </mesh>

            {/* Decor */}
            <FlowerPlanter position={[-14, 0, 25]} />
            <FlowerPlanter position={[14, 0, 25]} />
            <FlowerPlanter position={[-14, 0, 50]} /> 
            <FlowerPlanter position={[14, 0, 50]} /> 
            <FlowerPlanter position={[50, 0, 36]} />
            <FlowerPlanter position={[50, 0, 64]} />
            <FlowerPlanter position={[-50, 0, 36]} />
            <FlowerPlanter position={[-50, 0, 64]} />
        </group>
    )
}

// 11. PORTAL HENGE
function PortalHenge({ publicGalleries, position }: any) {
    const stones = useMemo(() => {
        const count = 12; const radius = HENGE_RADIUS + 15; 
        return new Array(count).fill(0).map((_, i) => {
            const angle = (i / count) * Math.PI * 2;
            return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, rot: -angle, height: 20 + Math.random() * 5, angle: angle }
        }).filter(stone => Math.abs(stone.angle - Math.PI) > 0.4);
    }, [])
    
    const galleries = publicGalleries || [];

    return (
        <group position={position}>
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.15, 0]}>
                <circleGeometry args={[HENGE_RADIUS + 40, 64]} />
                <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={15} roughness={0.9} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#333" metalness={0.1} mirror={0.2} />
            </mesh>
            {stones.map((stone, i) => (
                <group key={i} position={[stone.x, stone.height/2, stone.z]} rotation={[0, stone.rot, 0]}>
                    <Box args={[6, stone.height, 4]} castShadow receiveShadow><meshStandardMaterial color="#777" roughness={0.8} /></Box>
                    {i % 2 === 0 && (<Box args={[4, 4, 14]} position={[0, stone.height/2 + 2, -10]} rotation={[0, Math.PI/6, 0]} castShadow><meshStandardMaterial color="#777" roughness={0.8} /></Box>)}
                </group>
            ))}
            <Box args={[4, 12, 4]} position={[0, 6, 0]}><meshStandardMaterial color="#222" /></Box>
            <NexusGate position={[-40, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
            {galleries.map((gallery: any, i: number) => {
                const angle = (i / galleries.length) * Math.PI * 2;
                return <MysticPortal key={gallery.id || i} position={[Math.cos(angle)*HENGE_RADIUS, 0.1, Math.sin(angle)*HENGE_RADIUS]} rotation={[0, -angle - Math.PI / 2, 0]} label={gallery.name} />
            })}
        </group>
    )
}

// 12. NEW COMPONENT: INTERACTIVE ART FRAME (Clickable)
function InteractiveFrame({ url, label, price, link, position, rotation }: any) {
    const [hovered, setHover] = useState(false)
    
    return (
        <group position={position} rotation={rotation}
            onPointerOver={() => setHover(true)}
            onPointerOut={() => setHover(false)}
            onClick={() => {
                if(link) {
                    window.open(link, '_blank');
                    toast.success(`Opening ${label || 'Artwork'} on Marketplace...`);
                } else {
                    toast.info("Coming soon to Magic Eden");
                }
            }}
        >
            <Box args={[9, 12, 0.5]} castShadow>
                <meshStandardMaterial color={hovered ? "#ffd700" : "#111"} metalness={0.8} roughness={0.2} />
            </Box>
            <mesh position={[0, 0, 0.26]}>
                <planeGeometry args={[8, 11]} />
                <SafeImageMaterial url={cleanUrl(url)} />
            </mesh>
            <group position={[0, -7, 0]}>
                <Box args={[8, 2, 0.2]}><meshStandardMaterial color="#000" /></Box>
                <Suspense fallback={null}>
                    <Text position={[0, 0.4, 0.11]} fontSize={0.6} color="white" font="/ROMEO.TTF" anchorX="center">{label?.toUpperCase()}</Text>
                    <Text position={[0, -0.4, 0.11]} fontSize={0.5} color="#DAA520" anchorX="center">{price}</Text>
                </Suspense>
            </group>
        </group>
    )
}

// 13. NEW COMPONENT: IRL ART GALLERY
function IRLArtGallery({ position }: { position: [number, number, number] }) {
    // PLACEHOLDER DATA: Replace these URLs and Links with your real ones
    const artPieces = [
        { id: 1, name: "Abstract Genesis", price: "5 SOL", image: "/ntwrk-logo.png", link: "https://magiceden.io" },
        { id: 2, name: "Neon Dreams", price: "8 SOL", image: "/ntwrk-logo.png", link: "https://magiceden.io" },
        { id: 3, name: "Golden Era", price: "12 SOL", image: "/ntwrk-logo.png", link: "https://magiceden.io" },
    ];

    return (
        <group position={position}>
            {/* Floor */}
            <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0.1, 0]}>
                <boxGeometry args={[50, 30, 0.5]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.1} metalness={0.8} />
            </mesh>

            {/* Roof */}
            <Box args={[54, 34, 1]} position={[0, 15, 0]}>
                <meshStandardMaterial color="#000" roughness={0.2} />
            </Box>
            <Box args={[52, 32, 0.5]} position={[0, 14.5, 0]}>
                <meshStandardMaterial color="#DAA520" emissive="#DAA520" emissiveIntensity={0.2} />
            </Box>

            {/* Pillars */}
            <Cylinder args={[1, 1, 15, 8]} position={[-24, 7.5, 14]}><meshStandardMaterial color="#333" /></Cylinder>
            <Cylinder args={[1, 1, 15, 8]} position={[24, 7.5, 14]}><meshStandardMaterial color="#333" /></Cylinder>
            <Cylinder args={[1, 1, 15, 8]} position={[-24, 7.5, -14]}><meshStandardMaterial color="#333" /></Cylinder>
            <Cylinder args={[1, 1, 15, 8]} position={[24, 7.5, -14]}><meshStandardMaterial color="#333" /></Cylinder>

            {/* Back Wall (North) */}
            <Box args={[50, 15, 1]} position={[0, 7.5, 14.5]}>
                <meshStandardMaterial color="#050505" roughness={0.5} />
            </Box>

            {/* Signage */}
            <Suspense fallback={null}>
                <Text position={[0, 16.5, 16]} fontSize={2.5} color="white" font="/ROMEO.TTF" anchorX="center" rotation={[0, Math.PI, 0]}>
                    NOBLE FINE ART
                </Text>
            </Suspense>

            {/* Center Piece */}
            <InteractiveFrame 
                {...artPieces[0]} 
                position={[0, 7, 13.5]} 
                rotation={[0, Math.PI, 0]} 
            />

            {/* Side Piece Left */}
            <InteractiveFrame 
                {...artPieces[1]} 
                position={[15, 7, 13.5]} 
                rotation={[0, Math.PI - 0.3, 0]} 
            />

            {/* Side Piece Right */}
            <InteractiveFrame 
                {...artPieces[2]} 
                position={[-15, 7, 13.5]} 
                rotation={[0, Math.PI + 0.3, 0]} 
            />

            <pointLight position={[0, 12, 0]} intensity={50} distance={40} color="#fff" />
        </group>
    )
}

// 14. MAIN HALL (Unchanged)
function MainHall({ items, title, variant = 'gallery' }: { items: any[], title: string, variant?: 'hub' | 'gallery' }) {
    const isHub = variant === 'hub';
    const floorColor = isHub ? "#050505" : "#1a1a1a";
    const wallColor = isHub ? "#111" : "#222";
    const accentColor = isHub ? "#DAA520" : "#888"; 

    return (
        <group>
             <ambientLight intensity={isHub ? 0.6 : 0.8} color="#ffffff" />
             <pointLight position={[0, 35, 0]} intensity={isHub ? 500 : 400} distance={120} decay={2} castShadow color={isHub ? "#fff8e0" : "#ffffff"} />

             <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -ROOM_DEPTH/2 + 15]}>
                <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
                <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={isHub ? 50 : 25} roughness={isHub ? 0.2 : 0.4} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color={floorColor} metalness={isHub ? 0.9 : 0.6} mirror={isHub ? 0.8 : 0.5} />
             </mesh>

             <Box args={[ROOM_WIDTH, WALL_HEIGHT, 2]} position={[0, WALL_HEIGHT/2, -ROOM_DEPTH + 15]} receiveShadow><meshStandardMaterial color={wallColor} /></Box>
             <Box args={[2, WALL_HEIGHT, ROOM_DEPTH]} position={[-ROOM_WIDTH/2, WALL_HEIGHT/2, -ROOM_DEPTH/2 + 15]} receiveShadow><meshStandardMaterial color={wallColor} /></Box>
             <Box args={[2, WALL_HEIGHT, ROOM_DEPTH]} position={[ROOM_WIDTH/2, WALL_HEIGHT/2, -ROOM_DEPTH/2 + 15]} receiveShadow><meshStandardMaterial color={wallColor} /></Box>
             <Box args={[ROOM_WIDTH + 4, 1, ROOM_DEPTH + 4]} position={[0, WALL_HEIGHT, -ROOM_DEPTH/2 + 15]}><meshStandardMaterial color="#000" /></Box>
             <Box args={[ROOM_WIDTH, 1, ROOM_DEPTH]} position={[0, WALL_HEIGHT - 1, -ROOM_DEPTH/2 + 15]}><meshStandardMaterial color={accentColor} metalness={1} roughness={0.1} /></Box>

             <MuseumPillar position={[-ROOM_WIDTH/2 + 2, 0, -35]} />
             <MuseumPillar position={[-ROOM_WIDTH/2 + 2, 0, -83]} />
             <MuseumPillar position={[ROOM_WIDTH/2 - 2, 0, -35]} />
             <MuseumPillar position={[ROOM_WIDTH/2 - 2, 0, -83]} />

             {isHub ? (
                <group position={[0, 0, 15]}>
                    <GrandPillar position={[-14, 0, 0]} />
                    <GrandPillar position={[14, 0, 0]} />
                    <Box args={[40, 6, 6]} position={[0, WALL_HEIGHT - 3, 0]}><meshStandardMaterial color="#1a1a1a" roughness={0.2} /></Box>
                    <Box args={[38, 4, 7]} position={[0, WALL_HEIGHT - 3, 0]}><meshStandardMaterial color="#000" /></Box>
                    <Suspense fallback={null}>
                        <Text position={[0, WALL_HEIGHT - 3, 4]} fontSize={3.5} color="#DAA520" font="/ROMEO.TTF" anchorX="center" anchorY="middle" material-toneMapped={false} outlineWidth={0.05} outlineColor="#000">{title.toUpperCase()}</Text>
                    </Suspense>
                </group>
             ) : (
                <group position={[0, 0, 15]}>
                    <MuseumPillar position={[-ROOM_WIDTH/2 + 2, 0, 0]} />
                    <MuseumPillar position={[ROOM_WIDTH/2 - 2, 0, 0]} />
                    <Box args={[ROOM_WIDTH, 4, 4]} position={[0, WALL_HEIGHT - 2, 0]}><meshStandardMaterial color="#1a1a1a" /></Box>
                    <Suspense fallback={null}>
                        <Text position={[0, WALL_HEIGHT - 6, 0]} fontSize={2} color="#FFD700" font="/ROMEO.TTF" anchorX="center" material-toneMapped={false}>{title.toUpperCase()}</Text>
                    </Suspense>
                </group>
             )}
             
             {items.map((nft, i) => {
                if (!nft.wall && !nft.x) return null; 
                const y3d = (100 - (nft.y || 50)) / 100 * 30 + 5; 
                const tiltRad = THREE.MathUtils.degToRad(nft.tilt || 0);
                const depthOffset = 1.15 + Math.abs(Math.sin(tiltRad) * 6) + (nft.depth || 0);
                let pos: [number, number, number] = [0,0,0], wallRot: [number, number, number] = [0,0,0];

                if (nft.wall === 'left') { pos = [ -ROOM_WIDTH/2 + depthOffset, y3d, 15 - ((nft.x || 50) / 100 * ROOM_DEPTH) ]; wallRot = [0, Math.PI / 2, 0]; }
                else if (nft.wall === 'right') { pos = [ ROOM_WIDTH/2 - depthOffset, y3d, 15 - ((nft.x || 50) / 100 * ROOM_DEPTH) ]; wallRot = [0, -Math.PI / 2, 0]; }
                else { pos = [ ((nft.x || 50) / 100 * ROOM_WIDTH) - (ROOM_WIDTH/2), y3d, -ROOM_DEPTH + 15 + depthOffset ]; wallRot = [0, 0, 0]; }

                return (
                    <Suspense key={nft.id || i} fallback={null}>
                        <group position={pos} rotation={wallRot}>
                            <group rotation={[tiltRad, 0, THREE.MathUtils.degToRad(-(nft.rotation || 0))]} scale={nft.x ? 1 : 0.8}>
                                <NFTFrame url={nft.image} label={nft.name} frameColor={isHub ? 'gold' : nft.frameColor || 'black'} />
                            </group>
                        </group>
                    </Suspense>
                )
             })}
        </group>
    )
}

function NFTFrame({ url, label, frameColor = 'black' }: { url: string, label?: string, frameColor?: 'black'|'gold' }) {
  const finalUrl = cleanUrl(url);
  const isGold = frameColor === 'gold';
  return (
    <group>
      <Box args={[12, 12, 0.5]} castShadow receiveShadow><meshStandardMaterial color={isGold ? "#DAA520" : "#1a1a1a"} metalness={isGold ? 0.8 : 0.5} roughness={0.5} /></Box>
      <mesh position={[0, 0, 0.26]}><planeGeometry args={[10.5, 10.5]} /><SafeImageMaterial url={finalUrl} /></mesh>
      {label && (
        <group position={[0, -7, 0.1]}>
            <Box args={[10, 2.5, 0.1]}><meshStandardMaterial color="#222" roughness={0.9} /></Box>
            <Suspense fallback={null}><Text position={[0, 0, 0.08]} font="/ROMEO.TTF" fontSize={0.7} color={isGold ? "#FFD700" : "white"} anchorX="center" anchorY="middle" maxWidth={9}>{label.toUpperCase()}</Text></Suspense>
        </group>
      )}
    </group>
  );
}

// 15. COLLISION MANAGER
function CollisionManager({ publicGalleries, onEnterGallery, onExitGallery, onEnterCommunity, mode, playerPosRef }: any) {
    const cooldown = useRef(0)
    const [linkedWallets, setLinkedWallets] = useState<string[]>([])
    
    // FETCH HOLDINGS FOR ALL LINKED WALLETS
    const { holdings } = useAssetHoldings(linkedWallets)

    // CALCULATE ACCESS RIGHTS ACROSS ALL WALLETS
    const accessRights = useMemo(() => {
        if (!holdings || holdings.length === 0) return { panda: false, gecko: false };
        
        const totals = holdings.reduce((acc: any, curr: any) => ({
            sensei: acc.sensei + (curr.sensei || 0),
            gecko: acc.gecko + (curr.galacticGeckos || 0) + (curr.immortalGecko || 0)
        }), { sensei: 0, gecko: 0 });
        
        return { 
            panda: totals.sensei > 0, 
            gecko: totals.gecko > 0 
        };
    }, [holdings]);

    // LOAD LINKED WALLETS FROM LOCALSTORAGE
    useEffect(() => {
        const stored = localStorage.getItem('noble_wallets');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Handle both simple array and object array formats
                const wallets = parsed.map((w: any) => typeof w === 'string' ? w : w.address);
                setLinkedWallets(wallets);
            } catch(e) { console.error("Wallet parse error", e); }
        }
    }, []);

    useFrame((state, delta) => {
        if (cooldown.current > 0) { cooldown.current -= delta; return }
        const player = playerPosRef.current
        const galleries = publicGalleries || [];

        // ONLY CHECK COLLISIONS IN THE MAIN HALL
        if (mode === 'hall') {
            galleries.forEach((gallery: any, i: number) => {
                const angle = (i / galleries.length) * Math.PI * 2;
                const portalX = PORTAL_AREA_OFFSET[0] + (Math.cos(angle) * HENGE_RADIUS);
                const portalZ = PORTAL_AREA_OFFSET[2] + (Math.sin(angle) * HENGE_RADIUS);
                const dist = Math.sqrt(Math.pow(player.x - portalX, 2) + Math.pow(player.z - portalZ, 2));
                if (dist < PORTAL_TRIGGER_DIST) { onEnterGallery(gallery.owner); cooldown.current = 3.0 }
            })

            // SENSEI DOJO (PANDA) CHECK
            const pandaDist = Math.sqrt(Math.pow(player.x - (COMMUNITY_AREA_OFFSET[0]), 2) + Math.pow(player.z - (COMMUNITY_AREA_OFFSET[2] - 30), 2));
            if (pandaDist < PORTAL_TRIGGER_DIST) {
                if (accessRights.panda) {
                    toast.success("Entering Sensei Dojo...");
                    if (onEnterCommunity) onEnterCommunity('panda');
                } else {
                    player.z += 8; // Bounce back
                    toast.error("Access Denied: You need a Sensei Panda in one of your linked wallets.");
                }
                cooldown.current = 3.0;
            }

            // GECKO GARAGE CHECK
            const geckoDist = Math.sqrt(Math.pow(player.x - (COMMUNITY_AREA_OFFSET[0]), 2) + Math.pow(player.z - (COMMUNITY_AREA_OFFSET[2] + 30), 2));
            if (geckoDist < PORTAL_TRIGGER_DIST) {
                if (accessRights.gecko) {
                    toast.success("Entering Gecko Garage..."); 
                    if (onEnterCommunity) onEnterCommunity('gecko');
                } else {
                    player.z -= 8; // Bounce back
                    toast.error("Access Denied: You need a Galactic/Immortal Gecko in one of your linked wallets.");
                }
                cooldown.current = 3.0;
            }

        } else if (mode === 'gallery') {
            // EXIT USER GALLERY
            const dist = Math.sqrt(Math.pow(player.x - 0, 2) + Math.pow(player.z - EXIT_PORTAL_Z, 2));
            if (dist < PORTAL_TRIGGER_DIST) { onExitGallery(); cooldown.current = 3.0 }
        
        } else if (mode === 'gecko' || mode === 'panda') {
            // EXIT COMMUNITY AREAS
            // Assume exit portal is at [0, 0, 25] in the new worlds
            const dist = Math.sqrt(Math.pow(player.x - 0, 2) + Math.pow(player.z - 25, 2));
            if (dist < PORTAL_TRIGGER_DIST) { 
                toast.info("Returning to Central Hall...");
                onExitGallery(); // Reusing onExitGallery to return to 'hall' mode
                cooldown.current = 3.0 
            }
        }
    })
    return null
}

// --- MAIN EXPORT ---
export default function Scene({ 
    mode, 
    activeData, 
    publicGalleries, 
    onEnterGallery, 
    onExitGallery,
    onEnterCommunity, 
    avatarId, 
    isSelfieMode, 
    galleryTitle,
    username,
    mobileInput 
}: any) {
  const startPos = useMemo<[number, number, number]>(() => [(Math.random() * 10) - 5, 5, 10], []); 
  
  // FIX: Memoize community spawn so it doesn't change on re-renders
  const communitySpawn = useMemo<[number, number, number]>(() => [0, 2, 20], []);

  const playerPosRef = useRef(new THREE.Vector3(...startPos));
  const others = useOthers();

  return (
    <>
        <div className="absolute top-24 right-8 z-50 pointer-events-none">
            <div className="bg-black/50 backdrop-blur-md p-4 rounded-xl border border-white/10">
                <p className="text-[10px] text-blue-400 mt-2">Players Online: {others.length + 1}</p>
            </div>
        </div>

        <Canvas 
            id="solanaverse-canvas" 
            shadows 
            camera={{ fov: 60, far: 1000 }} 
            gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}
        >
            <Suspense fallback={<Text position={[0, 10, 0]} color="white" anchorX="center">Loading World...</Text>}>
                
                {(mode === 'hall' || mode === 'gallery') && <Sky sunPosition={[100, 20, 100]} />}
                <Environment preset="city" blur={0.8} background={false} />
                
                <SpatialAudio />

                <VoxelPlayer 
                    teleportPos={(mode === 'gecko' || mode === 'panda') ? communitySpawn : startPos} 
                    teleportRot={(mode === 'panda' || mode === 'gecko') ? 0 : Math.PI}
                    onPosUpdate={(pos) => playerPosRef.current.copy(pos)} 
                    avatarId={avatarId} 
                    isRemote={false} 
                    isSelfieMode={isSelfieMode} 
                    username={username}
                    mobileInput={mobileInput}
                />
                
                {others.map(({ connectionId, presence }) => {
                    if (!presence || !presence.position) return null;
                    return <VoxelPlayer key={connectionId} isRemote={true} remotePos={presence.position} remoteRot={presence.rotation} remotePitch={presence.pitch} avatarId={presence.avatarId || 'human'} />
                })}

                <CollisionManager 
                    playerPosRef={playerPosRef} 
                    mode={mode} 
                    publicGalleries={publicGalleries} 
                    onEnterGallery={onEnterGallery} 
                    onExitGallery={onExitGallery} 
                    onEnterCommunity={onEnterCommunity} 
                />

                {/* --- SCENES --- */}
                {mode === 'hall' && (
                    <group>
                        <MainHall items={activeData} title="CENTRAL HALL" variant="hub" />
                        <GrandWalkway />
                        <PortalHenge publicGalleries={publicGalleries} position={PORTAL_AREA_OFFSET} />
                        <CommunityPlaza position={COMMUNITY_AREA_OFFSET} />
                        
                        {/* --- NEW ART GALLERY (Opposite Main Hall) --- */}
                        <IRLArtGallery position={ART_GALLERY_OFFSET} />

                        <ambientLight intensity={0.5} color="#cddeff" />
                        <directionalLight position={[100, 150, 50]} intensity={3} color="#ffebc2" castShadow shadow-mapSize={[2048, 2048]} />
                    </group>
                )}

                {mode === 'gallery' && (
                    <group>
                        <MainHall items={activeData} title={galleryTitle || "USER GALLERY"} variant="gallery" />
                        <MysticPortal position={[0, 0, EXIT_PORTAL_Z]} rotation={[0, Math.PI, 0]} label="RETURN TO HALL" color="#ef4444" />
                        <ambientLight intensity={0.5} color="#cddeff" />
                        <directionalLight position={[100, 150, 50]} intensity={3} color="#ffebc2" castShadow shadow-mapSize={[2048, 2048]} />
                    </group>
                )}

                {mode === 'gecko' && <GeckoGarage onExit={onExitGallery} />}
                {mode === 'panda' && <SenseiDojo onExit={onExitGallery} />}

                <ContactShadows resolution={512} scale={100} blur={2} opacity={0.5} far={10} color="#000000" />
            
            </Suspense>
        </Canvas>
    </>
  );
}