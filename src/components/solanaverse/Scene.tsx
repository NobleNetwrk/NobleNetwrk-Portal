"use client"
import React, { Suspense, useRef, useState, useEffect, useMemo, memo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { 
    Environment, Sky, Box, Text, MeshReflectorMaterial, ContactShadows,
    Sphere, Torus
} from '@react-three/drei'
import { Physics, RigidBody, CuboidCollider } from '@react-three/rapier' 
import * as THREE from 'three'
import VoxelPlayer from './VoxelPlayer'
import { useOthers } from '@/liveblocks.config'
import SpatialAudio from './SpatialAudio';
import { toast } from 'react-toastify'; 
import { useAssetHoldings } from '@/hooks/useAssetHoldings';

// Imports
import PortalNexus from './PortalNexus';
import CommunityPlaza from './CommunityPlaza';
import MainHall from './MainHall';
import UserGallery from './UserGallery'; 
import GeckoGarage from './GeckoGarage';
import SenseiDojo from './SenseiDojo';
import GamingRoom from './GamingRoom'; 
import QuestItem from './QuestItem';
import IRLArtGallery from './IRLArtGallery'; 

const PORTAL_AREA_OFFSET: [number, number, number] = [120, 0, 50]; 
const COMMUNITY_AREA_OFFSET: [number, number, number] = [-120, 0, 50]; 
const ART_GALLERY_OFFSET: [number, number, number] = [0, 0, 140]; 
const HENGE_RADIUS = 40;                
const PORTAL_TRIGGER_DIST = 5.0;
const EXIT_PORTAL_Z = 30; 

function FlowerPlanter({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            <RigidBody type="fixed" colliders="cuboid">
                <Box args={[3, 2.5, 3]} position={[0, 1.25, 0]} castShadow><meshStandardMaterial color="#050505" roughness={0.2} /></Box>
            </RigidBody>
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

function GrandWalkway() {
    // LAYOUT CONFIG
    const pathWidth = 24;
    const halfPath = pathWidth / 2;
    const intersectionZ = 50;
    
    // Segment Lengths
    const southStartZ = 15;
    const southEndZ = intersectionZ - halfPath;
    const northStartZ = intersectionZ + halfPath;
    const northEndZ = 140;
    const westStartX = -120;
    const westEndX = -halfPath;
    const eastStartX = halfPath;
    const eastEndX = 120;

    // --- OPTIMIZATION: Check for Mobile ---
    const [isMobile, setIsMobile] = useState(false);
    const [isMounted, setIsMounted] = useState(false); // Hydration Fix

    useEffect(() => {
        setIsMounted(true);
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Only render the mobile material AFTER mounting to prevent hydration mismatch
    const FloorMaterial = (isMounted && isMobile)
        ? <meshStandardMaterial color="#0a0a0a" roughness={0.8} metalness={0.2} />
        : <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={30} roughness={0.4} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#0a0a0a" metalness={0.5} mirror={0.5} />;

    return (
        <group>
            <RigidBody type="fixed" colliders="cuboid">
                {/* 1. SOUTH SEGMENT */}
                <group position={[0, -0.15, (southStartZ + southEndZ) / 2]}>
                    <CuboidCollider args={[halfPath, 0.5, (southEndZ - southStartZ) / 2]} position={[0, -0.5, 0]} />
                    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[pathWidth, southEndZ - southStartZ]} />
                        {FloorMaterial}
                    </mesh>
                    <Box args={[0.5, 0.5, southEndZ - southStartZ]} position={[-halfPath, 0.15, 0]}><meshStandardMaterial color="#DAA520" /></Box>
                    <Box args={[0.5, 0.5, southEndZ - southStartZ]} position={[halfPath, 0.15, 0]}><meshStandardMaterial color="#DAA520" /></Box>
                </group>

                {/* 2. NORTH SEGMENT */}
                <group position={[0, -0.15, (northStartZ + northEndZ) / 2]}>
                    <CuboidCollider args={[halfPath, 0.5, (northEndZ - northStartZ) / 2]} position={[0, -0.5, 0]} />
                    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[pathWidth, northEndZ - northStartZ]} />
                        {FloorMaterial}
                    </mesh>
                    <Box args={[0.5, 0.5, northEndZ - northStartZ]} position={[-halfPath, 0.15, 0]}><meshStandardMaterial color="#DAA520" /></Box>
                    <Box args={[0.5, 0.5, northEndZ - northStartZ]} position={[halfPath, 0.15, 0]}><meshStandardMaterial color="#DAA520" /></Box>
                </group>

                {/* 3. WEST SEGMENT */}
                <group position={[(westStartX + westEndX) / 2, -0.15, intersectionZ]}>
                    <CuboidCollider args={[(westEndX - westStartX) / 2, 0.5, halfPath]} position={[0, -0.5, 0]} />
                    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[westEndX - westStartX, pathWidth]} />
                        {FloorMaterial}
                    </mesh>
                    <Box args={[westEndX - westStartX, 0.5, 0.5]} position={[0, 0.15, -halfPath]}><meshStandardMaterial color="#DAA520" /></Box>
                    <Box args={[westEndX - westStartX, 0.5, 0.5]} position={[0, 0.15, halfPath]}><meshStandardMaterial color="#DAA520" /></Box>
                </group>

                {/* 4. EAST SEGMENT */}
                <group position={[(eastStartX + eastEndX) / 2, -0.15, intersectionZ]}>
                    <CuboidCollider args={[(eastEndX - eastStartX) / 2, 0.5, halfPath]} position={[0, -0.5, 0]} />
                    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[eastEndX - eastStartX, pathWidth]} />
                        {FloorMaterial}
                    </mesh>
                    <Box args={[eastEndX - eastStartX, 0.5, 0.5]} position={[0, 0.15, -halfPath]}><meshStandardMaterial color="#DAA520" /></Box>
                    <Box args={[eastEndX - eastStartX, 0.5, 0.5]} position={[0, 0.15, halfPath]}><meshStandardMaterial color="#DAA520" /></Box>
                </group>

                {/* 5. INTERSECTION */}
                <group position={[0, -0.15, intersectionZ]}>
                    <CuboidCollider args={[halfPath, 0.5, halfPath]} position={[0, -0.5, 0]} />
                    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                        <planeGeometry args={[pathWidth, pathWidth]} />
                        {FloorMaterial}
                    </mesh>
                </group>
            </RigidBody>

            {/* PLANTERS */}
            <FlowerPlanter position={[-15, 0, 25]} />
            <FlowerPlanter position={[15, 0, 25]} />
            <FlowerPlanter position={[-15, 0, 80]} />
            <FlowerPlanter position={[15, 0, 80]} />
            <FlowerPlanter position={[-15, 0, 110]} />
            <FlowerPlanter position={[15, 0, 110]} />
            <FlowerPlanter position={[-40, 0, 38]} /> 
            <FlowerPlanter position={[-40, 0, 62]} /> 
            <FlowerPlanter position={[-80, 0, 38]} />
            <FlowerPlanter position={[-80, 0, 62]} />
            <FlowerPlanter position={[40, 0, 38]} />
            <FlowerPlanter position={[40, 0, 62]} />
            <FlowerPlanter position={[80, 0, 38]} />
            <FlowerPlanter position={[80, 0, 62]} />
        </group>
    )
}

function CollisionManager({ publicGalleries, onEnterGallery, onExitGallery, onEnterCommunity, mode, playerPosRef, isArcadeActive }: any) {
    const cooldown = useRef(0)
    const [linkedWallets, setLinkedWallets] = useState<string[]>([])
    const { holdings } = useAssetHoldings(linkedWallets)

    const accessRights = useMemo(() => {
        if (!holdings || holdings.length === 0) return { panda: false, gecko: false };
        const totals = holdings.reduce((acc: any, curr: any) => ({
            sensei: acc.sensei + (curr.sensei || 0),
            gecko: acc.gecko + (curr.galacticGeckos || 0) + (curr.immortalGecko || 0)
        }), { sensei: 0, gecko: 0 });
        return { panda: totals.sensei > 0, gecko: totals.gecko > 0 };
    }, [holdings]);

    useEffect(() => {
        const stored = localStorage.getItem('noble_wallets');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                const wallets = parsed.map((w: any) => typeof w === 'string' ? w : w.address);
                setLinkedWallets(wallets);
            } catch(e) { console.error("Wallet parse error", e); }
        }
    }, []);

    useFrame((state, delta) => {
        if (isArcadeActive) return; 
        
        if (cooldown.current > 0) { cooldown.current -= delta; return }
        const player = playerPosRef.current
        const galleries = publicGalleries || [];

        if (mode === 'hall') {
            galleries.forEach((gallery: any, i: number) => {
                const angle = (i / galleries.length) * Math.PI * 2;
                const portalX = PORTAL_AREA_OFFSET[0] + (Math.cos(angle) * HENGE_RADIUS);
                const portalZ = PORTAL_AREA_OFFSET[2] + (Math.sin(angle) * HENGE_RADIUS);
                const dist = Math.sqrt(Math.pow(player.x - portalX, 2) + Math.pow(player.z - portalZ, 2));
                if (dist < PORTAL_TRIGGER_DIST) { onEnterGallery(gallery.owner); cooldown.current = 3.0 }
            })

            const pandaDist = Math.sqrt(Math.pow(player.x - (COMMUNITY_AREA_OFFSET[0]), 2) + Math.pow(player.z - (COMMUNITY_AREA_OFFSET[2] - 30), 2));
            if (pandaDist < PORTAL_TRIGGER_DIST) {
                if (accessRights.panda) { toast.success("Entering Sensei Dojo..."); if (onEnterCommunity) onEnterCommunity('panda'); }
                else { toast.error("Access Denied: You need a Sensei Panda."); }
                cooldown.current = 3.0;
            }

            const geckoDist = Math.sqrt(Math.pow(player.x - (COMMUNITY_AREA_OFFSET[0]), 2) + Math.pow(player.z - (COMMUNITY_AREA_OFFSET[2] + 30), 2));
            if (geckoDist < PORTAL_TRIGGER_DIST) {
                if (accessRights.gecko) { toast.success("Entering Gecko Garage..."); if (onEnterCommunity) onEnterCommunity('gecko'); }
                else { toast.error("Access Denied: You need a Galactic/Immortal Gecko."); }
                cooldown.current = 3.0;
            }

        } else if (mode === 'gallery') {
            const dist = Math.sqrt(Math.pow(player.x - 0, 2) + Math.pow(player.z - EXIT_PORTAL_Z, 2));
            if (dist < PORTAL_TRIGGER_DIST) { onExitGallery(); cooldown.current = 3.0 }
        
        } else if (mode === 'gecko' || mode === 'panda') {
            const dist = Math.sqrt(Math.pow(player.x - 0, 2) + Math.pow(player.z - 25, 2));
            if (dist < PORTAL_TRIGGER_DIST) { toast.info("Returning to Central Hall..."); onExitGallery(); cooldown.current = 3.0 }
        }
    })
    return null
}

const QuestSystem = memo(({ questLocations, collectedItems, onCollectItem, playerPosRef }: any) => {
    return (
        <>
            {questLocations.map((loc: any) => (
                <QuestItem 
                    key={loc.id} 
                    id={loc.id} 
                    position={loc.pos} 
                    isCollected={collectedItems.includes(loc.id)} 
                    onCollect={(id: string) => {
                        onCollectItem(id);
                        toast.success("Found a Golden Disk! (+50 XP)");
                    }}
                    playerPos={playerPosRef.current}
                />
            ))}
        </>
    )
});
QuestSystem.displayName = 'QuestSystem';

const StaticWorldEnvironment = memo(({ mode, activeData, publicGalleries, irlData, galleryTitle, playerPosRef, setShowArcade }: any) => {
    if (mode === 'hall') {
        return (
            <group>
                <GamingRoom 
                    position={[-60, 0, 5]} 
                    rotation={[0, Math.PI, 0]} 
                    playerPos={playerPosRef.current} 
                    onInteractArcade={() => setShowArcade(true)}
                />
                <MainHall items={activeData} title="CENTRAL HALL" variant="hub" />
                <GrandWalkway />
                <PortalNexus publicGalleries={publicGalleries} position={PORTAL_AREA_OFFSET} />
                <CommunityPlaza position={COMMUNITY_AREA_OFFSET} />
                <IRLArtGallery position={ART_GALLERY_OFFSET} items={irlData} />
                <ambientLight intensity={0.5} color="#cddeff" />
                <directionalLight position={[100, 150, 50]} intensity={3} color="#ffebc2" castShadow shadow-mapSize={[2048, 2048]} />
            </group>
        );
    } else if (mode === 'gallery') {
        // --- SEPARATED INTO USERGALLERY COMPONENT ---
        return <UserGallery items={activeData} title={galleryTitle} />
        
    } else if (mode === 'gecko') {
        return <GeckoGarage onExit={() => {}} />;
    } else if (mode === 'panda') {
        return <SenseiDojo onExit={() => {}} />;
    }
    return null;
}, (prev, next) => {
    return prev.mode === next.mode && prev.galleryTitle === next.galleryTitle && prev.activeData === next.activeData;
});
StaticWorldEnvironment.displayName = 'StaticWorldEnvironment';

export default function Scene({ 
    mode, activeData, publicGalleries, onEnterGallery, onExitGallery,
    onEnterCommunity, avatarId, isSelfieMode, galleryTitle, username, mobileInput, 
    irlData, showArcade, setShowArcade, collectedItems = [], onCollectItem
}: any) {
  
  // FIXED: No more Math.random() here. Uses fixed position for hydration match.
  const startPos: [number, number, number] = [0, 2, 10]; 
  
  const communitySpawn = useMemo<[number, number, number]>(() => [0, 2, 20], []);
  const playerPosRef = useRef(new THREE.Vector3(...startPos));
  const others = useOthers();

  const questLocations = useMemo(() => [
      { id: 'disk_1', pos: [15, 6, -10] }, 
      { id: 'disk_2', pos: [-20, 8, 30] }, 
      { id: 'disk_3', pos: [0, 4, -80] },  
      { id: 'disk_4', pos: [35, 10, 50] }, 
      { id: 'disk_5', pos: [-35, 5, 20] }, 
  ], []);

  const AudioSystem = useMemo(() => <SpatialAudio />, []);

  // --- OPTIMIZATION: Check for Mobile ---
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false); // Hydration safety check

  useEffect(() => {
      setIsMounted(true);
      const checkMobile = () => setIsMobile(window.innerWidth < 768);
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <>
        <div className="absolute top-24 right-8 z-50 pointer-events-none">
            <div className="bg-black/50 backdrop-blur-md p-4 rounded-xl border border-white/10">
                <p className="text-[10px] text-blue-400 mt-2">Players Online: {others.length + 1}</p>
            </div>
        </div>

        <Canvas id="solanaverse-canvas" shadows camera={{ fov: 60, far: 1000 }} gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}>
            
            {/* PHYSICS OUTSIDE OF SUSPENSE TO PREVENT DEADLOCK */}
            <Physics gravity={[0, -18, 0]} debug={false}> 
                <Suspense fallback={<Text position={[0, 10, 0]} color="white" anchorX="center">Loading World...</Text>}>
                    
                    {/* GLOBAL FLOOR CATCHER */}
                    <RigidBody type="fixed" colliders={false}>
                        <CuboidCollider args={[200, 2, 200]} position={[0, -2.1, 0]} />
                    </RigidBody>

                    {(mode === 'hall' || mode === 'gallery') && <Sky sunPosition={[100, 20, 100]} />}
                    <Environment preset="city" blur={0.8} background={false} />
                    
                    {AudioSystem}

                    <VoxelPlayer 
                        teleportPos={(mode === 'gecko' || mode === 'panda') ? communitySpawn : startPos} 
                        teleportRot={(mode === 'panda' || mode === 'gecko') ? 0 : Math.PI}
                        onPosUpdate={(pos) => playerPosRef.current.copy(pos)} 
                        avatarId={avatarId} 
                        isRemote={false} 
                        isSelfieMode={isSelfieMode} 
                        username={username}
                        mobileInput={mobileInput}
                        inputEnabled={!showArcade} // <--- DISABLE INPUT WHEN ARCADE IS OPEN
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
                        isArcadeActive={showArcade} 
                    />

                    <StaticWorldEnvironment 
                        mode={mode}
                        activeData={activeData}
                        publicGalleries={publicGalleries}
                        irlData={irlData}
                        galleryTitle={galleryTitle}
                        playerPosRef={playerPosRef}
                        setShowArcade={setShowArcade}
                    />

                    {mode === 'hall' && (
                        <QuestSystem 
                            questLocations={questLocations}
                            collectedItems={collectedItems}
                            onCollectItem={onCollectItem}
                            playerPosRef={playerPosRef}
                        />
                    )}
                </Suspense>
            </Physics> 

            {/* OPTIMIZATION: Disable expensive shadows on mobile */}
            {(isMounted && !isMobile) && (
                <ContactShadows resolution={512} scale={100} blur={2} opacity={0.5} far={10} color="#000000" />
            )}
        </Canvas>
    </>
  );
}