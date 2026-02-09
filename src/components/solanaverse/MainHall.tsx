"use client"
import React, { Suspense, useState, useEffect, memo } from 'react'
import { Box, Text, MeshReflectorMaterial, Cylinder, Torus } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier' // IMPORT PHYSICS
import * as THREE from 'three'

// --- CONSTANTS ---
const WALL_HEIGHT = 40; 
const ROOM_WIDTH = 60;
const ROOM_DEPTH = 100; 

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

// --- SUB-COMPONENTS ---
function MuseumPillar({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {/* PHYSICS: Make Pillar Solid */}
            <RigidBody type="fixed" colliders="cuboid">
                <Box args={[3, 2, 3]} position={[0, 1, 0]}><meshStandardMaterial color="#1a1a1a" roughness={0.2} /></Box>
            </RigidBody>
            <Cylinder args={[1, 1, WALL_HEIGHT, 32]} position={[0, WALL_HEIGHT/2, 0]}><meshStandardMaterial color="#f5f5f5" roughness={0.1} metalness={0.1} /></Cylinder>
            <Cylinder args={[1.5, 1, 2, 32]} position={[0, WALL_HEIGHT - 1, 0]}><meshStandardMaterial color="#FFD700" metalness={1} roughness={0.2} /></Cylinder>
        </group>
    )
}

function GrandPillar({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
             {/* PHYSICS: Make Grand Pillar Solid */}
             <RigidBody type="fixed" colliders="cuboid">
                <Box args={[6, 4, 6]} position={[0, 2, 0]}><meshStandardMaterial color="#0a0a0a" roughness={0.3} /></Box>
             </RigidBody>
             <Box args={[5, 1, 5]} position={[0, 4.5, 0]}><meshStandardMaterial color="#DAA520" metalness={0.8} roughness={0.2} /></Box>
             <Cylinder args={[2, 2.5, WALL_HEIGHT - 6, 16]} position={[0, WALL_HEIGHT/2 + 1, 0]}><meshStandardMaterial color="#111" roughness={0.4} metalness={0.6} /></Cylinder>
             <Torus args={[2.6, 0.2, 16, 32]} position={[0, 10, 0]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#DAA520" /></Torus>
             <Torus args={[2.4, 0.2, 16, 32]} position={[0, 25, 0]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#DAA520" /></Torus>
             <Box args={[5, 2, 5]} position={[0, WALL_HEIGHT - 1, 0]}><meshStandardMaterial color="#DAA520" metalness={0.8} /></Box>
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

// --- MAIN COMPONENT ---
function MainHall({ items, title, variant = 'gallery' }: { items: any[], title: string, variant?: 'hub' | 'gallery' }) {
    const isHub = variant === 'hub';
    const floorColor = isHub ? "#050505" : "#1a1a1a";
    const wallColor = isHub ? "#111" : "#222";
    const accentColor = isHub ? "#DAA520" : "#888"; 

    // --- OPTIMIZATION: Check for Mobile ---
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return (
        <group>
             <ambientLight intensity={isHub ? 0.6 : 0.8} color="#ffffff" />
             <pointLight position={[0, 35, 0]} intensity={isHub ? 500 : 400} distance={120} decay={2} castShadow color={isHub ? "#fff8e0" : "#ffffff"} />

             {/* Floor Visuals */}
             <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -ROOM_DEPTH/2 + 15]}>
                <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
                {/* CONDITIONAL RENDERING: Standard on Mobile, Reflector on Desktop */}
                {isMobile ? (
                    <meshStandardMaterial color={floorColor} roughness={0.1} metalness={0.5} />
                ) : (
                    <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={isHub ? 50 : 25} roughness={isHub ? 0.2 : 0.4} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color={floorColor} metalness={isHub ? 0.9 : 0.6} mirror={isHub ? 0.8 : 0.5} />
                )}
             </mesh>

             {/* PHYSICS: SOLID WALLS */}
             <RigidBody type="fixed" colliders="cuboid">
                {/* Back Wall */}
                <Box args={[ROOM_WIDTH, WALL_HEIGHT, 2]} position={[0, WALL_HEIGHT/2, -ROOM_DEPTH + 15]} receiveShadow><meshStandardMaterial color={wallColor} /></Box>
                {/* Left Wall */}
                <Box args={[2, WALL_HEIGHT, ROOM_DEPTH]} position={[-ROOM_WIDTH/2, WALL_HEIGHT/2, -ROOM_DEPTH/2 + 15]} receiveShadow><meshStandardMaterial color={wallColor} /></Box>
                {/* Right Wall */}
                <Box args={[2, WALL_HEIGHT, ROOM_DEPTH]} position={[ROOM_WIDTH/2, WALL_HEIGHT/2, -ROOM_DEPTH/2 + 15]} receiveShadow><meshStandardMaterial color={wallColor} /></Box>
             </RigidBody>

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

export default memo(MainHall);