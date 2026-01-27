"use client"
import React, { Suspense, useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { 
    Environment, 
    Sky,
    Box, 
    Text, 
    MeshReflectorMaterial, 
    SpotLight,
    ContactShadows
} from '@react-three/drei'
import * as THREE from 'three'
import VoxelPlayer from './VoxelPlayer'
import { useOthers } from '@/liveblocks.config'

// --- CONSTANTS ---
const WALL_HEIGHT = 50; 
const ROOM_WIDTH = 60;
const HUB_RADIUS = 60; 
const PORTAL_TRIGGER_DIST = 5.0; 
const EXIT_PORTAL_Z = 30; 
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

// --- SAFE TEXTURE LOADER ---
// Uses standard loader but handles errors safely to prevent white-screen crashes
function SafeImageMaterial({ url }: { url: string }) {
    const [texture, setTexture] = useState<THREE.Texture | null>(null);

    useEffect(() => {
        if (!url) return;
        const loader = new THREE.TextureLoader();
        loader.crossOrigin = "Anonymous";
        
        loader.load(
            url,
            (tex) => {
                tex.colorSpace = THREE.SRGBColorSpace;
                // VM OPTIMIZATION: Set minFilter to Nearest to save processing if needed, 
                // but Linear is usually fine.
                tex.minFilter = THREE.LinearFilter; 
                setTexture(tex);
            },
            undefined, 
            () => { console.warn("Failed texture:", url); } 
        );

        // Strict cleanup to prevent memory leaks in the VM
        return () => {
            if (texture) texture.dispose();
        };
    }, [url]);

    if (!texture) return <meshBasicMaterial color="#333" />;
    return <meshBasicMaterial map={texture} transparent={true} side={THREE.DoubleSide} />;
}

// --- TYPES ---
interface RawNFT {
    id: string;
    name: string;
    image: string;
    collection: string;
    wall?: 'left' | 'right' | 'back';
    x?: number; 
    y?: number;
    frameColor?: 'black' | 'gold';
    rotation?: number; 
    tilt?: number; 
    depth?: number;
}

interface SceneProps {
    mode: 'hall' | 'gallery';
    activeData: RawNFT[]; 
    publicGalleries: { id: string, name: string, owner: string }[];
    onEnterGallery: (ownerAddress: string) => void;
    onExitGallery: () => void;
    avatarId: string;
    isSelfieMode: boolean;
}

// 1. COLLISION MANAGER
function CollisionManager({ publicGalleries, onEnterGallery, onExitGallery, mode, playerPosRef }: any) {
    const cooldown = useRef(0)
    useFrame((state, delta) => {
        if (cooldown.current > 0) { cooldown.current -= delta; return }
        const player = playerPosRef.current

        if (mode === 'hall') {
            publicGalleries.forEach((gallery: any, i: number) => {
                const total = publicGalleries.length;
                const angle = (i / total) * Math.PI * 2;
                const x = Math.cos(angle) * HUB_RADIUS;
                const z = Math.sin(angle) * HUB_RADIUS;
                const dist = Math.sqrt(Math.pow(player.x - x, 2) + Math.pow(player.z - z, 2));
                if (dist < PORTAL_TRIGGER_DIST) { onEnterGallery(gallery.owner); cooldown.current = 3.0 }
            })
        } else {
            const dist = Math.sqrt(Math.pow(player.x - 0, 2) + Math.pow(player.z - EXIT_PORTAL_Z, 2));
            if (dist < PORTAL_TRIGGER_DIST) { onExitGallery(); cooldown.current = 3.0 }
        }
    })
    return null
}

// 2. PORTAL FRAME
function PortalFrame({ position, rotation, label }: any) {
    return (
        <group position={position} rotation={rotation}>
            <Box args={[10, 14, 1]}><meshStandardMaterial color="#8b5cf6" emissive="#6d28d9" emissiveIntensity={2} /></Box>
            <Box args={[8, 12, 0.5]} position={[0,0,0.3]}><meshBasicMaterial color="black" /></Box>
            <Text position={[0, 8.5, 0]} fontSize={0.8} color="white" anchorX="center">{label.toUpperCase()}</Text>
        </group>
    )
}

// 3. NFT FRAME
function NFTFrame({ url, label, frameColor = 'black' }: { url: string, label?: string, frameColor?: 'black'|'gold' }) {
  const finalUrl = cleanUrl(url);
  const isGold = frameColor === 'gold';

  return (
    <group>
      <Box args={[12, 12, 0.5]} castShadow receiveShadow>
        <meshStandardMaterial 
            color={isGold ? "#DAA520" : "#1a1a1a"} 
            metalness={isGold ? 0.8 : 0.5} 
            roughness={0.5}
        />
      </Box>
      <mesh position={[0, 0, 0.26]}>
        <planeGeometry args={[10.5, 10.5]} />
        <SafeImageMaterial url={finalUrl} />
      </mesh>
      
      <SpotLight position={[0, 8, 5]} angle={0.5} intensity={10} color="white" target-position={[0, 0, 0]} />
      
      {label && (
        <group position={[0, -7, 0.1]}>
            <Box args={[10, 2, 0.1]}><meshStandardMaterial color="#222" /></Box>
            <Text position={[0, 0, 0.06]} fontSize={0.5} color={isGold ? "#FFD700" : "white"} anchorX="center" maxWidth={9}>{label.toUpperCase()}</Text>
        </group>
      )}
    </group>
  );
}

// 4. GALLERY ROOM (With Optimized Shiny Floor)
function GalleryRoom({ items }: { items: RawNFT[] }) {
    return (
        <group>
             {/* FLOOR: RESTORED SHINY REFLECTOR (Optimized) */}
             <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, -ROOM_DEPTH/2 + 15]}>
                <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
                {/* VM FIX: resolution={512} (Low res reflection)
                    This prevents VRAM spikes while keeping the cool effect.
                */}
                <MeshReflectorMaterial
                    blur={[400, 100]} 
                    resolution={512} 
                    mixBlur={1} 
                    mixStrength={40} 
                    roughness={0.6} 
                    depthScale={1.2} 
                    minDepthThreshold={0.4} 
                    maxDepthThreshold={1.4} 
                    color="#151515" 
                    metalness={0.6} 
                    mirror={0.5} // Reduced mirror intensity slightly for performance
                />
             </mesh>

             {/* WALLS: Double Sided for visibility */}
             <Box args={[ROOM_WIDTH, WALL_HEIGHT, 1]} position={[0, WALL_HEIGHT/2, -ROOM_DEPTH + 15]} receiveShadow>
                <meshStandardMaterial color="#1a1a1a" side={THREE.DoubleSide} />
             </Box>
             <Box args={[1, WALL_HEIGHT, ROOM_DEPTH]} position={[-ROOM_WIDTH/2, WALL_HEIGHT/2, -ROOM_DEPTH/2 + 15]} receiveShadow>
                <meshStandardMaterial color="#1a1a1a" side={THREE.DoubleSide} />
             </Box>
             <Box args={[1, WALL_HEIGHT, ROOM_DEPTH]} position={[ROOM_WIDTH/2, WALL_HEIGHT/2, -ROOM_DEPTH/2 + 15]} receiveShadow>
                <meshStandardMaterial color="#1a1a1a" side={THREE.DoubleSide} />
             </Box>
             
             <ambientLight intensity={0.6} />
             
             {items.map((nft, i) => {
                if (!nft.wall && !nft.x) return null; 

                let pos: [number, number, number] = [0,0,0];
                let wallRot: [number, number, number] = [0,0,0];

                const y3d = (100 - (nft.y || 50)) / 100 * 30 + 5; 
                
                const tiltRad = THREE.MathUtils.degToRad(nft.tilt || 0);
                const tiltPushback = Math.abs(Math.sin(tiltRad) * 6);
                const depthOffset = 0.7 + tiltPushback + (nft.depth || 0);

                if (nft.wall === 'left') {
                    pos = [ -ROOM_WIDTH/2 + depthOffset, y3d, 15 - ((nft.x || 50) / 100 * ROOM_DEPTH) ];
                    wallRot = [0, Math.PI / 2, 0];
                } else if (nft.wall === 'right') {
                    pos = [ ROOM_WIDTH/2 - depthOffset, y3d, 15 - ((nft.x || 50) / 100 * ROOM_DEPTH) ];
                    wallRot = [0, -Math.PI / 2, 0];
                } else { // BACK
                    pos = [ ((nft.x || 50) / 100 * ROOM_WIDTH) - (ROOM_WIDTH/2), y3d, -ROOM_DEPTH + 15 + depthOffset ];
                    wallRot = [0, 0, 0];
                }

                const innerRot: [number, number, number] = [
                    tiltRad, 
                    0, 
                    THREE.MathUtils.degToRad(-(nft.rotation || 0)) 
                ];

                return (
                    <Suspense key={nft.id || i} fallback={null}>
                        <group position={pos} rotation={wallRot}>
                            <group rotation={innerRot} scale={nft.x ? 1 : 0.8}>
                                <NFTFrame 
                                    url={nft.image} 
                                    label={nft.name} 
                                    frameColor={nft.frameColor || 'black'} 
                                />
                            </group>
                        </group>
                    </Suspense>
                )
             })}
        </group>
    )
}

// --- MAIN EXPORT ---
export default function Scene({ 
    mode, 
    activeData, 
    publicGalleries, 
    onEnterGallery, 
    onExitGallery, 
    avatarId,
    isSelfieMode 
}: SceneProps) {
  const startPos = useMemo<[number, number, number]>(() => [(Math.random() * 10) - 5, 5, 10], []); 
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
            gl={{ 
                antialias: false, 
                powerPreference: "high-performance",
                preserveDrawingBuffer: true // Required for Selfie
            }}
        >
            <Suspense fallback={null}>
                <Sky sunPosition={[100, 20, 100]} />
                <Environment preset="city" blur={0.8} background={false} />
            </Suspense>
            <fog attach="fog" args={['#050505', 10, 90]} />

            <VoxelPlayer 
                teleportPos={startPos} 
                onPosUpdate={(pos) => playerPosRef.current.copy(pos)} 
                avatarId={avatarId} 
                isRemote={false} 
                isSelfieMode={isSelfieMode}
            />

            {others.map(({ connectionId, presence }) => {
                if (!presence || !presence.position) return null;
                return <VoxelPlayer key={connectionId} isRemote={true} remotePos={presence.position} remoteRot={presence.rotation} remotePitch={presence.pitch} avatarId={presence.avatarId || 'human'} />
            })}

            <CollisionManager playerPosRef={playerPosRef} mode={mode} publicGalleries={publicGalleries} onEnterGallery={onEnterGallery} onExitGallery={onExitGallery} />

            {mode === 'hall' && (
                <group>
                    <GalleryRoom items={activeData} />
                    {/* Hall Floor also gets optimized reflection */}
                    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.2, 0]}>
                        <circleGeometry args={[HUB_RADIUS + 40, 64]} />
                        <MeshReflectorMaterial blur={[300, 100]} resolution={512} mixBlur={1} mixStrength={50} roughness={0.4} color="#111" metalness={0.6} mirror={0.7} />
                    </mesh>
                    {publicGalleries.map((gallery, i) => {
                        const angle = (i / publicGalleries.length) * Math.PI * 2;
                        const x = Math.cos(angle) * HUB_RADIUS;
                        const z = Math.sin(angle) * HUB_RADIUS;
                        return <PortalFrame key={gallery.id} position={[x, 4, z]} rotation={[0, -angle + Math.PI / 2, 0]} label={gallery.name} />
                    })}
                </group>
            )}

            {mode === 'gallery' && (
                <group>
                    <GalleryRoom items={activeData} />
                    <PortalFrame position={[0, 4, EXIT_PORTAL_Z]} rotation={[0, Math.PI, 0]} label="RETURN TO HALL" />
                </group>
            )}

            <ContactShadows resolution={512} scale={100} blur={2} opacity={0.5} far={10} color="#000000" />
        </Canvas>
    </>
  );
}