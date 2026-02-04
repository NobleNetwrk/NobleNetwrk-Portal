"use client"
import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect, useMemo, useState } from 'react'
import { Box, Cylinder, Torus, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { useMyPresence } from '@/liveblocks.config'

interface VoxelPlayerProps {
  teleportPos?: [number, number, number] | null;
  teleportRot?: number; 
  onPosUpdate?: (pos: THREE.Vector3) => void; 
  avatarId?: string;
  isRemote?: boolean;
  remotePos?: [number, number, number];
  remoteRot?: number;
  remotePitch?: number; 
  isSelfieMode?: boolean; 
  username?: string | null;
  mobileInput?: React.MutableRefObject<{ move: { x: number, y: number }, look: { x: number, y: number } }>;
}

// --- CONFIGURATION ---
const WALK_SPEED = 10
const SPRINT_SPEED = 24
const ROTATION_SPEED = 1.5 
const CAMERA_DISTANCE = 4.0 
const CAMERA_HEIGHT = 2.0   

// --- GAMEPAD HELPER (NEW) ---
const applyDeadzone = (value: number, threshold = 0.15) => {
  return Math.abs(value) > threshold ? value : 0;
};

// --- VOXEL HELPER ---
function Voxel({ x, y, z, color, scale = 0.06 }: { x: number, y: number, z: number, color: string, scale?: number }) {
  return (
    <Box 
      args={[scale, scale, scale]} 
      position={[x * scale, y * scale, z * scale]} 
      castShadow
      raycast={() => null} 
    >
      <meshStandardMaterial color={color} />
    </Box>
  )
}

// --- ANIMATION HELPER ---
function useBipedAnim(speedRef: React.MutableRefObject<number>) {
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const bodyGroup = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 15; 
    const speed = Math.min(speedRef.current, 1.5); 
    
    if (speed > 0.1) {
        if(leftLeg.current) leftLeg.current.rotation.x = Math.sin(t) * 0.8 * speed;
        if(rightLeg.current) rightLeg.current.rotation.x = Math.sin(t + Math.PI) * 0.8 * speed;
        if(leftArm.current) leftArm.current.rotation.x = Math.sin(t + Math.PI) * 0.6 * speed;
        if(rightArm.current) rightArm.current.rotation.x = Math.sin(t) * 0.6 * speed;
        if(bodyGroup.current) {
            bodyGroup.current.position.y = 0.8 + Math.abs(Math.sin(t*2)) * 0.05 * speed;
            bodyGroup.current.rotation.z = Math.sin(t) * 0.05 * speed;
        }
    } else {
        if(leftLeg.current) leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, 0, 0.1);
        if(rightLeg.current) rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, 0, 0.1);
        if(leftArm.current) leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0, 0.1);
        if(rightArm.current) rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, 0.1);
        if(bodyGroup.current) {
            bodyGroup.current.position.y = THREE.MathUtils.lerp(bodyGroup.current.position.y, 0.8, 0.1);
            bodyGroup.current.rotation.z = THREE.MathUtils.lerp(bodyGroup.current.rotation.z, 0, 0.1);
        }
    }
  });

  return { leftLeg, rightLeg, leftArm, rightArm, bodyGroup };
}

// --- AVATAR DEFINITIONS ---

// 1. HUMAN AVATAR (ARTICULATED)
function AvatarHuman({ pitchRef, speedRef }: { pitchRef: React.MutableRefObject<number>, speedRef: React.MutableRefObject<number> }) {
  const s = 0.08; 
  const headGroup = useRef<THREE.Group>(null);
  const { leftLeg, rightLeg, leftArm, rightArm, bodyGroup } = useBipedAnim(speedRef);
  
  useFrame(() => { if (headGroup.current) headGroup.current.rotation.x = -pitchRef.current; });

  const C_SKIN = "#F5CCA2"; const C_BEARD = "#FFFFFF"; const C_EYE = "#38B6FF"; const C_BROW = "#000000"; const C_SHADOW = "#E0B088";
  return (
    <group position={[0, -0.5, 0]}>
      {/* HEAD */}
      <group ref={headGroup} position={[0, 1.8, 0]}>
        <Box args={[8*s, 8*s, 7*s]} position={[0, 4*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        <Voxel x={-2} y={5} z={3.6} scale={s} color={C_EYE} /> <Voxel x={-3} y={5} z={3.6} scale={s} color={C_EYE} />
        <Voxel x={2} y={5} z={3.6} scale={s} color={C_EYE} /> <Voxel x={3} y={5} z={3.6} scale={s} color={C_EYE} />
        <Voxel x={-2} y={6.5} z={3.6} scale={s} color={C_BROW} /> <Voxel x={-3} y={6.5} z={3.6} scale={s} color={C_BROW} />
        <Voxel x={2} y={6.5} z={3.6} scale={s} color={C_BROW} /> <Voxel x={3} y={6.5} z={3.6} scale={s} color={C_BROW} />
        <group position={[0, 0, 0.05]}>
            <Voxel x={-1} y={3} z={4} scale={s} color={C_BEARD} /> <Voxel x={0}  y={3} z={4} scale={s} color={C_BEARD} />
            <Voxel x={1}  y={3} z={4} scale={s} color={C_BEARD} /> <Voxel x={-2} y={2.5} z={4} scale={s} color={C_BEARD} />
            <Voxel x={2}  y={2.5} z={4} scale={s} color={C_BEARD} />
        </group>
        <Box args={[8.5*s, 3.5*s, 1*s]} position={[0, 1.5*s, 3.8*s]} raycast={() => null}><meshStandardMaterial color={C_BEARD} /></Box>
        <Box args={[5*s, 1.5*s, 1*s]} position={[0, -0.5*s, 3.5*s]} raycast={() => null}><meshStandardMaterial color={C_BEARD} /></Box>
        <Voxel x={-4.5} y={4} z={0} scale={s} color={C_SKIN} /> <Voxel x={4.5}  y={4} z={0} scale={s} color={C_SKIN} />
      </group>

      {/* BODY GROUP (Pivot point for bouncing) */}
      <group ref={bodyGroup} position={[0, 0.8, 0]}>
        {/* Torso */}
        <Box args={[5*s, 6*s, 3*s]} position={[0, 4*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        <Voxel x={-1.5} y={5.5} z={1.6} scale={s} color={C_SHADOW} /> <Voxel x={1.5}  y={5.5} z={1.6} scale={s} color={C_SHADOW} />
        <Voxel x={0} y={1} z={0.5} scale={s} color={C_SHADOW} />

        {/* ARMS - Pivoted at Shoulder (Y approx 6.5s relative to body group) */}
        <group ref={leftArm} position={[-3.5*s, 6*s, 0]}>
             <Box args={[1.5*s, 6*s, 2*s]} position={[0, -2.5*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        </group>
        <group ref={rightArm} position={[3.5*s, 6*s, 0]}>
             <Box args={[1.5*s, 6*s, 2*s]} position={[0, -2.5*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        </group>

        {/* LEGS - Pivoted at Hip (Y approx 1s relative to body group) */}
        <group ref={leftLeg} position={[-1.2*s, 1*s, 0]}>
             <Box args={[2*s, 6*s, 2.5*s]} position={[0, -3*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        </group>
        <group ref={rightLeg} position={[1.2*s, 1*s, 0]}>
             <Box args={[2*s, 6*s, 2.5*s]} position={[0, -3*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        </group>
      </group>
    </group>
  )
}

// 2. ALIEN AVATAR (ARTICULATED)
function AvatarAlien({ pitchRef, speedRef }: { pitchRef: React.MutableRefObject<number>, speedRef: React.MutableRefObject<number> }) {
  const s = 0.08; 
  const headGroup = useRef<THREE.Group>(null);
  const { leftLeg, rightLeg, leftArm, rightArm, bodyGroup } = useBipedAnim(speedRef);
  
  useFrame(() => { if (headGroup.current) headGroup.current.rotation.x = -pitchRef.current; });

  const C_SKIN = "#88FF88"; const C_SUIT = "#222222"; const C_EYE = "#FF0000";
  return (
    <group position={[0, -0.5, 0]}>
      <group ref={headGroup} position={[0, 1.8, 0]}>
        <Box args={[8*s, 8*s, 7*s]} position={[0, 4*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        <Voxel x={-2} y={5} z={3.6} scale={s} color={C_EYE} /> <Voxel x={2} y={5} z={3.6} scale={s} color={C_EYE} />
        <Voxel x={0} y={8} z={0} scale={s} color={C_SKIN} />
      </group>
      <group ref={bodyGroup} position={[0, 0.8, 0]}>
        <Box args={[5*s, 6*s, 3*s]} position={[0, 4*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box>
        
        {/* ARMS */}
        <group ref={leftArm} position={[-3.5*s, 6*s, 0]}>
            <Box args={[1.5*s, 6*s, 2*s]} position={[0, -2.5*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box>
        </group>
        <group ref={rightArm} position={[3.5*s, 6*s, 0]}>
            <Box args={[1.5*s, 6*s, 2*s]} position={[0, -2.5*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box>
        </group>

        {/* LEGS */}
        <group ref={leftLeg} position={[-1.2*s, 1*s, 0]}>
            <Box args={[2*s, 6*s, 2.5*s]} position={[0, -3*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box>
        </group>
        <group ref={rightLeg} position={[1.2*s, 1*s, 0]}>
            <Box args={[2*s, 6*s, 2.5*s]} position={[0, -3*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box>
        </group>
      </group>
    </group>
  )
}

// 3. PANDA AVATAR (WADDLE ANIMATION)
function AvatarGoldenPanda({ pitchRef, speedRef }: { pitchRef: React.MutableRefObject<number>, speedRef: React.MutableRefObject<number> }) {
  const s = 0.04; 
  const headGroup = useRef<THREE.Group>(null);
  const bodyGroup = useRef<THREE.Group>(null);
  
  useFrame((state) => { 
      if (headGroup.current) headGroup.current.rotation.x = -pitchRef.current; 
      
      // Panda Waddle (Z-rotation rocking)
      const t = state.clock.elapsedTime * 10;
      const speed = Math.min(speedRef.current, 1);
      if(bodyGroup.current && speed > 0.1) {
          bodyGroup.current.rotation.z = Math.sin(t) * 0.1 * speed;
          bodyGroup.current.position.y = 0.2 + Math.abs(Math.sin(t)) * 0.05 * speed;
      }
  });

  const C_GOLD_BODY = "#C5A059"; const C_GOLD_DARK = "#8B6508"; const C_GOLD_BRIGHT = "#FFD700";
  const C_WHITE_BASE = "#F7F5F0"; const C_BLACK = "#0A0A0A"; const C_RED_ROPE = "#D92121";
  const C_GEM_BLUE = "#0047AB"; const C_GEM_RED = "#B22222";
  return (
    <group position={[0, -0.5, 0]}>
      <group ref={headGroup} position={[0, 1.8, 0]}>
        <Box args={[16*s, 14*s, 14*s]} position={[0, 6*s, 0]} raycast={() => null}><meshStandardMaterial color={C_WHITE_BASE} /></Box>
        <Box args={[3*s, 8*s, 10*s]} position={[-9*s, 5*s, 1*s]} raycast={() => null}><meshStandardMaterial color={C_WHITE_BASE} /></Box>
        <Box args={[3*s, 8*s, 10*s]} position={[9*s, 5*s, 1*s]} raycast={() => null}><meshStandardMaterial color={C_WHITE_BASE} /></Box>
        <group position={[-4.5*s, 7*s, 6.5*s]} rotation={[0, 0, 0.15]}><Box args={[5*s, 4*s, 2*s]}><meshStandardMaterial color={C_GOLD_DARK} metalness={0.6} roughness={0.3} /></Box></group>
        <group position={[4.5*s, 7*s, 6.5*s]} rotation={[0, 0, -0.15]}><Box args={[5*s, 4*s, 2*s]}><meshStandardMaterial color={C_GOLD_DARK} metalness={0.6} roughness={0.3} /></Box></group>
        <Voxel x={-4.5} y={7.2} z={7.6} scale={s} color="#FFFFFF" /> <Voxel x={4.5}  y={7.2} z={7.6} scale={s} color="#FFFFFF" />
        <Voxel x={-4.5} y={7.2} z={7.7} scale={s} color={C_BLACK} /> <Voxel x={4.5}  y={7.2} z={7.7} scale={s} color={C_BLACK} />
        <Box args={[8*s, 5*s, 4*s]} position={[0, 3*s, 7*s]} raycast={() => null}><meshStandardMaterial color={C_WHITE_BASE} /></Box>
        <Voxel x={0} y={4.5} z={9} scale={s} color={C_BLACK} /> <Voxel x={-1} y={4.5} z={8.8} scale={s} color={C_BLACK} /> <Voxel x={1} y={4.5} z={8.8} scale={s} color={C_BLACK} />
        <group position={[-7*s, 13*s, 0]}><Box args={[5*s, 4*s, 2*s]}><meshStandardMaterial color={C_GOLD_BODY} /></Box><Box args={[3*s, 2*s, 2.1*s]} position={[0,0,0]}><meshStandardMaterial color={C_GOLD_DARK} /></Box></group>
        <group position={[7*s, 13*s, 0]}><Box args={[5*s, 4*s, 2*s]}><meshStandardMaterial color={C_GOLD_BODY} /></Box><Box args={[3*s, 2*s, 2.1*s]} position={[0,0,0]}><meshStandardMaterial color={C_GOLD_DARK} /></Box></group>
        <group position={[0, 13.5*s, 0]}>
            <Box args={[15*s, 2*s, 15*s]}><meshStandardMaterial color={C_GOLD_BRIGHT} metalness={1} roughness={0.15} /></Box>
            <Voxel x={0} y={0} z={7.6} scale={s} color={C_GEM_RED} /> <Voxel x={-4} y={0} z={7.6} scale={s} color={C_GEM_BLUE} /> <Voxel x={4} y={0} z={7.6} scale={s} color={C_GEM_BLUE} />
            <Voxel x={0} y={2} z={7} scale={s} color={C_GOLD_BRIGHT} /> <Voxel x={0} y={3} z={7} scale={s} color={C_GOLD_BRIGHT} /> <Voxel x={0} y={4} z={7} scale={s} color={C_GOLD_BRIGHT} />
            <Voxel x={-3} y={2} z={6.5} scale={s} color={C_GOLD_BRIGHT} /> <Voxel x={-3} y={3} z={6.5} scale={s} color={C_GOLD_BRIGHT} />
            <Voxel x={3} y={2} z={6.5} scale={s} color={C_GOLD_BRIGHT} /> <Voxel x={3} y={3} z={6.5} scale={s} color={C_GOLD_BRIGHT} />
            <Voxel x={-6} y={2} z={5} scale={s} color={C_GOLD_BRIGHT} /> <Voxel x={6} y={2} z={5} scale={s} color={C_GOLD_BRIGHT} />
        </group>
      </group>
      <group ref={bodyGroup} position={[0, 0.2, 0]}>
        <Box args={[14*s, 16*s, 10*s]} position={[0, 7*s, 0]} raycast={() => null}><meshStandardMaterial color={C_GOLD_BODY} metalness={0.7} roughness={0.4} /></Box>
        <Box args={[10*s, 12*s, 1*s]} position={[0, 6*s, 5.1*s]} raycast={() => null}><meshStandardMaterial color={C_WHITE_BASE} /></Box>
        <Box args={[5*s, 14*s, 5*s]} position={[-9*s, 7*s, 0]} rotation={[0, 0, 0.1]}><meshStandardMaterial color={C_GOLD_DARK} /></Box>
        <Box args={[5*s, 14*s, 5*s]} position={[9*s, 7*s, 0]} rotation={[0, 0, -0.1]}><meshStandardMaterial color={C_GOLD_DARK} /></Box>
        <Box args={[5*s, 8*s, 6*s]} position={[-4*s, -2*s, 0]}><meshStandardMaterial color={C_GOLD_DARK} /></Box>
        <Box args={[5*s, 8*s, 6*s]} position={[4*s, -2*s, 0]}><meshStandardMaterial color={C_GOLD_DARK} /></Box>
        <Box args={[14.5*s, 0.5*s, 10.5*s]} position={[0, 14*s, 0]}><meshStandardMaterial color={C_RED_ROPE} /></Box>
        <Box args={[0.6*s, 4*s, 0.6*s]} position={[2*s, 12*s, 5.2*s]} rotation={[0, 0, 0.6]}><meshStandardMaterial color={C_RED_ROPE} /></Box>
        <Box args={[0.6*s, 4*s, 0.6*s]} position={[-2*s, 12*s, 5.2*s]} rotation={[0, 0, -0.6]}><meshStandardMaterial color={C_RED_ROPE} /></Box>
        <group position={[0, 10*s, 6*s]}>
            <group position={[0, 1.5*s, 0]} rotation={[0, 0, 0.78]}><Box args={[2.5*s, 2.5*s, 0.3*s]}><meshStandardMaterial color={C_GOLD_BRIGHT} /></Box><Box args={[1*s, 1*s, 0.35*s]}><meshStandardMaterial color="#000" /></Box></group>
            <group position={[-1.5*s, -1*s, 0.1*s]} rotation={[0, 0, 0.78]}><Box args={[2.5*s, 2.5*s, 0.3*s]}><meshStandardMaterial color={C_GOLD_BRIGHT} /></Box><Box args={[1*s, 1*s, 0.35*s]}><meshStandardMaterial color="#000" /></Box></group>
            <group position={[-1.5*s, -1*s, 0.1*s]} rotation={[0, 0, 0.78]}><Box args={[2.5*s, 2.5*s, 0.3*s]}><meshStandardMaterial color={C_GOLD_BRIGHT} /></Box><Box args={[1*s, 1*s, 0.35*s]}><meshStandardMaterial color="#000" /></Box></group>
        </group>
      </group>
    </group>
  )
}

// 4. GALACTIC GECKO AVATAR (ARTICULATED)
function AvatarGalacticGecko({ pitchRef, speedRef }: { pitchRef: React.MutableRefObject<number>, speedRef: React.MutableRefObject<number> }) {
  const s = 0.05; 
  const headGroup = useRef<THREE.Group>(null);
  const { leftLeg, rightLeg, leftArm, rightArm, bodyGroup } = useBipedAnim(speedRef);
  
  useFrame(() => { 
      if (headGroup.current) headGroup.current.rotation.x = -pitchRef.current; 
  });

  const C_SKIN = "#66b050"; // Gecko Green
  const C_SUIT = "#111111"; // Black Suit
  const C_SHIRT = "#FFFFFF"; // White Shirt
  const C_TIE = "#00FF00"; // Bright Green Tie
  const C_BEARD_ROCK = "#4a4036"; // Dark brownish grey crystals
  const C_GOGGLE_HOUSING = "#2b2b2b"; // Dark metal
  const C_LENS = "#00ffff"; // Cyan/Turquoise glowing lens
  const C_COIL_BASE = "#8c5a3c"; // Wood/Copper base
  const C_BULB = "#fffdd0"; // Cream/Pale Yellow
  const C_LIGHTNING = "#ffff00"; // Yellow sparks
  const C_MECHANICAL = "#777777"; // Grey metal side piece
  const C_EYE_WHITE = "#FFFFFF";
  const C_PUPIL = "#000000";

  return (
    <group position={[0, -0.5, 0]}>
      {/* HEAD GROUP */}
      <group ref={headGroup} position={[0, 1.7, 0]}>
        
        {/* --- HEAD BASE --- */}
        <Box args={[10*s, 9*s, 11*s]} position={[0, 4.5*s, 1*s]}><meshStandardMaterial color={C_SKIN} /></Box>
        <Box args={[8*s, 4*s, 8*s]} position={[0, 2*s, 9*s]}><meshStandardMaterial color={C_SKIN} /></Box>
        <Box args={[11*s, 4*s, 8*s]} position={[0, 1*s, 0]}><meshStandardMaterial color={C_SKIN} /></Box>

        {/* --- ROCK BEARD (Crystal Spikes) --- */}
        <group position={[0, 0, 10*s]}>
            <Box args={[2*s, 5*s, 2*s]} position={[0, -2*s, 0]} rotation={[0.2, 0, 0]}><meshStandardMaterial color={C_BEARD_ROCK} /></Box>
            <Box args={[1.5*s, 4*s, 1.5*s]} position={[2*s, -1.5*s, -1*s]} rotation={[0.1, 0, -0.2]}><meshStandardMaterial color={C_BEARD_ROCK} /></Box>
            <Box args={[1.5*s, 4*s, 1.5*s]} position={[-2*s, -1.5*s, -1*s]} rotation={[0.1, 0, 0.2]}><meshStandardMaterial color={C_BEARD_ROCK} /></Box>
            <Box args={[1.5*s, 3*s, 1.5*s]} position={[3.5*s, -1*s, -2*s]} rotation={[0, 0, -0.4]}><meshStandardMaterial color={C_BEARD_ROCK} /></Box>
            <Box args={[1.5*s, 3*s, 1.5*s]} position={[-3.5*s, -1*s, -2*s]} rotation={[0, 0, 0.4]}><meshStandardMaterial color={C_BEARD_ROCK} /></Box>
        </group>

        {/* --- EYES --- */}
        <group position={[3.5*s, 5*s, 5*s]} rotation={[0, 0.2, 0]}>
             <Box args={[3*s, 3*s, 2*s]}><meshStandardMaterial color={C_SKIN} /></Box>
             <Box args={[2*s, 2*s, 0.5*s]} position={[0, 0, 1.1*s]}><meshStandardMaterial color={C_EYE_WHITE} /></Box>
             <Box args={[0.5*s, 1.5*s, 0.1*s]} position={[0, 0, 1.4*s]}><meshStandardMaterial color={C_PUPIL} /></Box>
        </group>

        <group position={[-3.5*s, 5*s, 6*s]} rotation={[0, -0.1, 0]}>
             <Cylinder args={[2.5*s, 2.5*s, 6*s, 16]} rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0]}>
                <meshStandardMaterial color={C_GOGGLE_HOUSING} metalness={0.6} roughness={0.4} />
             </Cylinder>
             <Cylinder args={[2*s, 2*s, 0.5*s, 16]} rotation={[Math.PI/2, 0, 0]} position={[0, 0, 3.1*s]}>
                <meshStandardMaterial color={C_LENS} emissive={C_LENS} emissiveIntensity={1.5} toneMapped={false} />
             </Cylinder>
             <Box args={[11*s, 1*s, 11*s]} position={[3.5*s, 0, -4*s]}><meshStandardMaterial color="#333" /></Box>
        </group>

        {/* --- TESLA COIL HEADGEAR --- */}
        <group position={[0, 9*s, 2*s]}>
            {/* Left Coil */}
            <group position={[3*s, 0, 0]}>
                <Cylinder args={[1.5*s, 1.5*s, 2*s, 8]} position={[0, 1*s, 0]}><meshStandardMaterial color={C_COIL_BASE} /></Cylinder>
                <Torus args={[1.6*s, 0.2*s, 8, 16]} position={[0, 0.5*s, 0]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#ffd700" /></Torus>
                <Torus args={[1.6*s, 0.2*s, 8, 16]} position={[0, 1.5*s, 0]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#ffd700" /></Torus>
                <Box args={[3.5*s, 3.5*s, 3.5*s]} position={[0, 3.5*s, 0]}>
                    <meshStandardMaterial color={C_BULB} emissive={C_BULB} emissiveIntensity={0.6} />
                </Box>
                <group position={[2*s, 4*s, 0]} rotation={[0, 0, -0.5]}>
                    <Box args={[0.5*s, 3*s, 0.5*s]}><meshStandardMaterial color={C_LIGHTNING} emissive={C_LIGHTNING} /></Box>
                </group>
            </group>

            {/* Right Coil + Antenna */}
            <group position={[-3*s, 0, 0]}>
                <Cylinder args={[1.5*s, 1.5*s, 2*s, 8]} position={[0, 1*s, 0]}><meshStandardMaterial color={C_COIL_BASE} /></Cylinder>
                <Torus args={[1.6*s, 0.2*s, 8, 16]} position={[0, 0.5*s, 0]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#ffd700" /></Torus>
                <Torus args={[1.6*s, 0.2*s, 8, 16]} position={[0, 1.5*s, 0]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#ffd700" /></Torus>
                <Box args={[3.5*s, 3.5*s, 3.5*s]} position={[0, 3.5*s, 0]}>
                    <meshStandardMaterial color={C_BULB} emissive={C_BULB} emissiveIntensity={0.6} />
                </Box>
                {/* Side Antenna Structure */}
                <group position={[-2.5*s, 1*s, 0]}>
                    <Box args={[3*s, 0.5*s, 0.5*s]}><meshStandardMaterial color={C_MECHANICAL} /></Box>
                    <Box args={[0.5*s, 4*s, 0.5*s]} position={[-1.5*s, 2*s, 0]}><meshStandardMaterial color={C_MECHANICAL} /></Box>
                    <Box args={[0.5*s, 3*s, 0.5*s]} position={[-1.5*s, 3.5*s, 0]}><meshStandardMaterial color="#cd7f32" emissive="#cd7f32" emissiveIntensity={2} /></Box>
                    <Box args={[2*s, 0.2*s, 0.2*s]} position={[-0.5*s, 3*s, 0]} rotation={[0,0, -0.5]}><meshStandardMaterial color={C_LIGHTNING} emissive={C_LIGHTNING} /></Box>
                </group>
            </group>
        </group>

      </group>

      {/* BODY - BLACK SUIT (Refactored for Articulation) */}
      <group ref={bodyGroup} position={[0, 0.8, 0]}>
        <Box args={[7*s, 8*s, 3.5*s]} position={[0, 3*s, 0]}><meshStandardMaterial color={C_SUIT} /></Box>
        <Box args={[3*s, 3*s, 3.6*s]} position={[0, 5.5*s, 0]}><meshStandardMaterial color={C_SHIRT} /></Box>
        <Box args={[1*s, 5*s, 3.7*s]} position={[0, 4.5*s, 0]}><meshStandardMaterial color={C_TIE} /></Box>
        
        {/* ARMS - Pivoted at Shoulder (Y approx 5.5s) */}
        <group ref={leftArm} position={[-2.5*s, 5.5*s, 0]}>
            <Box args={[2.5*s, 6*s, 3.8*s]} position={[0, -2.5*s, 0]} rotation={[0, 0, -0.1]}><meshStandardMaterial color={C_SUIT} /></Box>
            <Box args={[2*s, 2*s, 2*s]} position={[-2.5*s, -6*s, 0]}><meshStandardMaterial color={C_SKIN} /></Box>
        </group>
        <group ref={rightArm} position={[2.5*s, 5.5*s, 0]}>
            <Box args={[2.5*s, 6*s, 3.8*s]} position={[0, -2.5*s, 0]} rotation={[0, 0, 0.1]}><meshStandardMaterial color={C_SUIT} /></Box>
            <Box args={[2*s, 2*s, 2*s]} position={[2.5*s, -6*s, 0]}><meshStandardMaterial color={C_SKIN} /></Box>
        </group>

        {/* LEGS - Pivoted at Hip (Y approx 0s) */}
        <group ref={leftLeg} position={[-1.6*s, 0, 0]}>
            <Box args={[2.8*s, 6*s, 3*s]} position={[0, -3*s, 0]}><meshStandardMaterial color={C_SUIT} /></Box>
        </group>
        <group ref={rightLeg} position={[1.6*s, 0, 0]}>
            <Box args={[2.8*s, 6*s, 3*s]} position={[0, -3*s, 0]}><meshStandardMaterial color={C_SUIT} /></Box>
        </group>

        {/* Outer thigh pads - Attached to body for now as they are high up */}
        <Box args={[2.5*s, 7*s, 2.5*s]} position={[-4.5*s, 3.5*s, 0]} rotation={[0, 0, 0.1]}><meshStandardMaterial color={C_SUIT} /></Box>
        <Box args={[2.5*s, 7*s, 2.5*s]} position={[4.5*s, 3.5*s, 0]} rotation={[0, 0, -0.1]}><meshStandardMaterial color={C_SUIT} /></Box>
      </group>
    </group>
  )
}

// 5. NEW: CLASSIC RED EYES GECKO (Direct Scaling Fix)
function AvatarGeckoGLB({ pitchRef, speedRef }: { pitchRef: React.MutableRefObject<number>, speedRef: React.MutableRefObject<number> }) {
    const { scene } = useGLTF('/ClassicRedEyesGecko.glb')
    const meshRef = useRef<THREE.Group>(null);
    
    // Clone scene for multiplayer support
    const clone = useMemo(() => {
        const c = scene.clone()
        c.scale.set(50, 50, 50) 
        c.traverse((node: any) => {
            if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
        })
        return c
    }, [scene])
    
    const headBone = useMemo(() => {
        return clone.getObjectByName('mixamorig:Head') || clone.getObjectByName('Head')
    }, [clone])

    // Apply Pitch & Waddle
    useFrame((state) => {
        if (headBone) {
            headBone.rotation.x = -pitchRef.current + 0.1 
        }
        
        // Simple bouncy waddle for the GLB since we don't have individual limb access easily
        const t = state.clock.elapsedTime * 12;
        const speed = Math.min(speedRef.current, 1);
        if(meshRef.current && speed > 0.1) {
             meshRef.current.position.y = Math.abs(Math.sin(t)) * 0.1 * speed;
             meshRef.current.rotation.z = Math.sin(t) * 0.05 * speed;
        }
    })

    return (
        <group ref={meshRef} position={[0, 0, 0]}>
             <primitive object={clone} position={[0, 0, 0]} />
        </group>
    )
}

// --- AVATAR REGISTRY ---
const AVATAR_REGISTRY: Record<string, React.FC<any>> = {
    'human': AvatarHuman,
    'alien': AvatarAlien,
    'panda_3120': AvatarGoldenPanda, 
    'gecko_8062': AvatarGalacticGecko, 
    'gecko_classic': AvatarGeckoGLB,
};

export default function VoxelPlayer({ 
  teleportPos,
  teleportRot, // NEW PROP
  onPosUpdate, 
  avatarId = 'human',
  isRemote = false, 
  remotePos, 
  remoteRot,
  remotePitch,
  isSelfieMode = false,
  username ,
  mobileInput
}: VoxelPlayerProps) {
  const { camera } = useThree()
  const avatarRef = useRef<THREE.Group>(null)
  const pitchRef = useRef(0);
  const animationSpeedRef = useRef(0); // Track speed for animation
  const prevRemotePos = useRef(new THREE.Vector3(0,0,0)); // For remote velocity calc

  const [presence, updateMyPresence] = !isRemote ? useMyPresence() : [null, null];
  
  const keys = useRef<Record<string, boolean>>({})
  const playerPos = useRef(new THREE.Vector3(0, 0, 0))
  const rotation = useRef({ yaw: Math.PI, pitch: 0.1 }) 
  
  // NEW: State for Selfie Camera Orbit
  const selfieOrbit = useRef({ yaw: 0, height: 1.8 })

  // --- INPUT (LOCAL ONLY) ---
  useEffect(() => {
    if (isRemote) return; 
    
    // Prevent Scrolling
    const onKeyDown = (e: KeyboardEvent) => {
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
        keys.current[e.code] = true
    }
    const onKeyUp = (e: KeyboardEvent) => (keys.current[e.code] = false)
    
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [isRemote])

  // --- TELEPORT ---
  useEffect(() => {
    if (teleportPos && !isRemote) {
      playerPos.current.set(...teleportPos)
      rotation.current.yaw = teleportRot ?? Math.PI 
      rotation.current.pitch = 0.1
      if (avatarRef.current) {
        avatarRef.current.position.copy(playerPos.current)
        avatarRef.current.rotation.y = rotation.current.yaw
      }
    }
  }, [teleportPos, teleportRot, isRemote])

  // --- LOOP ---
  useFrame((state, delta) => {
    if (avatarRef.current) {
        
        // 1. REMOTE PLAYER
        if (isRemote && remotePos) {
            const targetPos = new THREE.Vector3(...remotePos)
            
            // Calculate velocity for animation
            const dist = targetPos.distanceTo(prevRemotePos.current);
            const instSpeed = dist / delta;
            
            // Smoothly interpolate animation speed
            animationSpeedRef.current = THREE.MathUtils.lerp(animationSpeedRef.current, instSpeed > 0.5 ? 1 : 0, 0.1);
            
            prevRemotePos.current.copy(targetPos); // Update previous pos

            avatarRef.current.position.lerp(targetPos, 0.2)
            avatarRef.current.rotation.y = remoteRot || 0
            pitchRef.current = remotePitch || 0;
            return;
        }

        // ===============================================
        // === GLOBAL INPUT HANDLING (PSG1 / GAMEPAD) ===
        // ===============================================
        // We poll gamepads here so values are available for BOTH Selfie & Normal modes
        
        let gpLookX = 0, gpLookY = 0, gpMoveX = 0, gpMoveY = 0;
        let gpSprint = false;

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = Array.from(gamepads).find(g => g && g.connected);

        if (gp) {
            // Map Axes (Standard Layout)
            // 0: Left Stick X, 1: Left Stick Y
            // 2: Right Stick X, 3: Right Stick Y
            gpMoveX = applyDeadzone(gp.axes[0]);
            gpMoveY = applyDeadzone(gp.axes[1]);
            gpLookX = applyDeadzone(gp.axes[2]);
            gpLookY = applyDeadzone(gp.axes[3]);

            // Map Sprint (Button 1=B, Button 5=RB usually)
            if (gp.buttons[1]?.pressed || gp.buttons[5]?.pressed) {
                gpSprint = true;
            }
        }

        // --- SPLIT LOGIC BASED ON MODE ---
        if (isSelfieMode) {
            // === SELFIE MODE CONTROLS ===
            animationSpeedRef.current = 0; // No walking in selfie mode

            // KEYBOARD
            if (keys.current['ArrowLeft']) selfieOrbit.current.yaw += 2.0 * delta;
            if (keys.current['ArrowRight']) selfieOrbit.current.yaw -= 2.0 * delta;
            if (keys.current['ArrowUp']) selfieOrbit.current.height += 2.0 * delta;
            if (keys.current['ArrowDown']) selfieOrbit.current.height -= 2.0 * delta;

            // GAMEPAD (PSG1) - Add joystick input to selfie orbit
            selfieOrbit.current.yaw += gpLookX * 2.0 * delta;
            selfieOrbit.current.height += gpLookY * 2.0 * delta; // Up pushes camera up
            
            // Clamp Height
            selfieOrbit.current.height = Math.max(0.5, Math.min(3.5, selfieOrbit.current.height));

            // Force Avatar to stand still
            avatarRef.current.position.copy(playerPos.current);
            avatarRef.current.rotation.y = rotation.current.yaw;
            pitchRef.current = 0; // Look straight ahead for photo

            // Calculate Orbit Camera Position
            const dist = 2.5; 
            const totalYaw = rotation.current.yaw + Math.PI + selfieOrbit.current.yaw;
            
            const offsetX = Math.sin(totalYaw) * dist;
            const offsetZ = Math.cos(totalYaw) * dist;
            
            const camPos = new THREE.Vector3(
                playerPos.current.x + offsetX,
                playerPos.current.y + selfieOrbit.current.height,
                playerPos.current.z + offsetZ
            );
            
            camera.position.copy(camPos);
            
            const headPos = playerPos.current.clone().add(new THREE.Vector3(0, 1.6, 0));
            camera.lookAt(headPos);

        } else {
            // ===============================================
            // === NORMAL MODE CONTROLS (INCL. GAMEPAD) ===
            // ===============================================
            
            // 1. ROTATION (Add Keyboard + Mobile Look + Gamepad)
            // Note: Mobile X rotates Yaw, Mobile Y rotates Pitch
            const joyLookX = (mobileInput?.current.look.x || 0) + gpLookX;
            const joyLookY = (mobileInput?.current.look.y || 0) + gpLookY;

            if (keys.current['ArrowLeft']) rotation.current.yaw += ROTATION_SPEED * delta
            if (keys.current['ArrowRight']) rotation.current.yaw -= ROTATION_SPEED * delta
            
            // Add Joystick Yaw (Multiplier for sensitivity)
            rotation.current.yaw -= joyLookX * ROTATION_SPEED * delta * 1.5; 

            if (keys.current['ArrowUp']) rotation.current.pitch += ROTATION_SPEED * delta
            if (keys.current['ArrowDown']) rotation.current.pitch -= ROTATION_SPEED * delta
            
            // Add Joystick Pitch
            // FIX: INVERTED LOOK (Subtracted instead of added to flip vertical axis)
            rotation.current.pitch -= joyLookY * ROTATION_SPEED * delta * 1.5;

            rotation.current.pitch = Math.max(-0.5, Math.min(0.5, rotation.current.pitch))
            pitchRef.current = rotation.current.pitch;

            // 2. MOVEMENT (Add Keyboard + Mobile Move + Gamepad)
            const isSprinting = keys.current['ShiftLeft'] || keys.current['ShiftRight'] || gpSprint;
            const speed = (isSprinting ? SPRINT_SPEED : WALK_SPEED) * delta

            // Combine Keyboard (0 or 1) with Joystick (-1 to 1)
            const joyMoveY = (mobileInput?.current.move.y || 0) + gpMoveY;
            const joyMoveX = (mobileInput?.current.move.x || 0) + gpMoveX;

            const forward = (keys.current['KeyW'] ? 1 : 0) - (keys.current['KeyS'] ? 1 : 0) - joyMoveY;
            const side = (keys.current['KeyD'] ? 1 : 0) - (keys.current['KeyA'] ? 1 : 0) + joyMoveX;

            const moveDir = new THREE.Vector3(side, 0, -forward).normalize()
            moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current.yaw)

            if (moveDir.lengthSq() > 0) {
                playerPos.current.add(moveDir.multiplyScalar(speed))
                // Ramping up animation speed
                animationSpeedRef.current = THREE.MathUtils.lerp(animationSpeedRef.current, isSprinting ? 1.5 : 1.0, 0.2);
            } else {
                // Ramping down animation speed
                animationSpeedRef.current = THREE.MathUtils.lerp(animationSpeedRef.current, 0, 0.2);
            }

            avatarRef.current.position.copy(playerPos.current)
            avatarRef.current.rotation.y = rotation.current.yaw
            
            // Normal Camera Follow (Third Person)
            const offset = new THREE.Vector3(0, 0, CAMERA_DISTANCE)
            const rotEuler = new THREE.Euler(rotation.current.pitch, rotation.current.yaw, 0, 'YXZ')
            offset.applyEuler(rotEuler)

            const camPos = playerPos.current.clone().add(offset)
            camPos.y += CAMERA_HEIGHT 
            
            camera.position.copy(camPos)
            camera.lookAt(playerPos.current.clone().add(new THREE.Vector3(0, 1.8, 0))) 
        }

        if (onPosUpdate) onPosUpdate(playerPos.current)

        if (updateMyPresence) {
            updateMyPresence({
                position: [playerPos.current.x, playerPos.current.y, playerPos.current.z],
                rotation: rotation.current.yaw,
                pitch: rotation.current.pitch, 
                avatarId: avatarId,
                username: username || undefined
            })
        }
    }
  })

  const AvatarComponent = AVATAR_REGISTRY[avatarId] || AVATAR_REGISTRY['human'];

  return (
    <group ref={avatarRef} position={[0,0,0]} raycast={() => null}> 
        <group rotation={[0, Math.PI, 0]}>
            {/* Pass the dynamic speed ref to the avatar */}
            <AvatarComponent pitchRef={pitchRef} speedRef={animationSpeedRef} />
        </group>
        {isRemote && <mesh position={[0, 2.5, 0]} />}
    </group>
  )
}