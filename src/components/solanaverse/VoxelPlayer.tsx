"use client"
import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect, useState, useMemo, Suspense } from 'react'
import { Box, Cylinder, Torus, useGLTF, Html } from '@react-three/drei'
import { RigidBody, CapsuleCollider, RapierRigidBody, useRapier } from '@react-three/rapier' 
import * as THREE from 'three'
import { useMyPresence } from '@/liveblocks.config'

// --- CONFIGURATION ---
const WALK_SPEED = 10
const SPRINT_SPEED = 18 
const JUMP_FORCE = 12    
const ROTATION_SPEED = 1.5 
const CAMERA_DISTANCE = 10.0 
const CAMERA_HEIGHT = 7.0   

const applyDeadzone = (value: number, threshold = 0.15) => Math.abs(value) > threshold ? value : 0;

// --- VOXEL HELPER ---
function Voxel({ x, y, z, color, scale = 0.06 }: { x: number, y: number, z: number, color: string, scale?: number }) {
  return <Box args={[scale, scale, scale]} position={[x * scale, y * scale, z * scale]} castShadow raycast={() => null}><meshStandardMaterial color={color} /></Box>
}

// --- ANIMATION HELPER ---
function useBipedAnim(speedRef: React.MutableRefObject<number>, isGroundedRef: React.MutableRefObject<boolean>) {
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const bodyGroup = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime * 15; 
    const speed = Math.min(speedRef.current, 1.5); 
    const isGrounded = isGroundedRef.current;

    if (!isGrounded) {
        if(leftLeg.current) leftLeg.current.rotation.x = 0.5;
        if(rightLeg.current) rightLeg.current.rotation.x = -0.2;
        if(leftArm.current) leftArm.current.rotation.x = -0.5;
        if(rightArm.current) rightArm.current.rotation.x = -0.5;
        if(bodyGroup.current) bodyGroup.current.position.y = 0.8; 
    } else if (speed > 0.1) {
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

// ------------------------------------
// --- AVATAR DEFINITIONS ---
// ------------------------------------

function AvatarHuman({ pitchRef, speedRef, isGroundedRef }: any) {
  const s = 0.17; 
  const headGroup = useRef<THREE.Group>(null);
  const { leftLeg, rightLeg, leftArm, rightArm, bodyGroup } = useBipedAnim(speedRef, isGroundedRef);
  useFrame(() => { if (headGroup.current) headGroup.current.rotation.x = -pitchRef.current; });
  const C_SKIN = "#F5CCA2"; const C_BEARD = "#FFFFFF"; const C_EYE = "#38B6FF"; const C_BROW = "#000000"; const C_SHADOW = "#E0B088";
  return (
    <group position={[0, 0, 0]}> 
      <group ref={headGroup} position={[0, 2.2, 0]}>
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
      <group ref={bodyGroup} position={[0, 0.8, 0]}>
        <Box args={[5*s, 6.5*s, 3*s]} position={[0, 4*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        <Voxel x={-1.5} y={5.5} z={1.6} scale={s} color={C_SHADOW} /> <Voxel x={1.5}  y={5.5} z={1.6} scale={s} color={C_SHADOW} />
        <Voxel x={0} y={1} z={0.5} scale={s} color={C_SHADOW} />
        <group ref={leftArm} position={[-3.5*s, 6*s, 0]}><Box args={[1.5*s, 6*s, 2*s]} position={[0, -2.5*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box></group>
        <group ref={rightArm} position={[3.5*s, 6*s, 0]}><Box args={[1.5*s, 6*s, 2*s]} position={[0, -2.5*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box></group>
        <group ref={leftLeg} position={[-1.2*s, 1*s, 0]}><Box args={[2*s, 6*s, 2.5*s]} position={[0, -3*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box></group>
        <group ref={rightLeg} position={[1.2*s, 1*s, 0]}><Box args={[2*s, 6*s, 2.5*s]} position={[0, -3*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box></group>
      </group>
    </group>
  )
}

function AvatarAlien({ pitchRef, speedRef, isGroundedRef }: any) {
  const s = 0.17; 
  const headGroup = useRef<THREE.Group>(null);
  const { leftLeg, rightLeg, leftArm, rightArm, bodyGroup } = useBipedAnim(speedRef, isGroundedRef);
  useFrame(() => { if (headGroup.current) headGroup.current.rotation.x = -pitchRef.current; });
  const C_SKIN = "#88FF88"; const C_SUIT = "#222222"; const C_EYE = "#FF0000";
  return (
    <group position={[0, 0, 0]}> 
      <group ref={headGroup} position={[0, 2.2, 0]}>
        <Box args={[8*s, 8*s, 7*s]} position={[0, 4*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        <Voxel x={-2} y={5} z={3.6} scale={s} color={C_EYE} /> <Voxel x={2} y={5} z={3.6} scale={s} color={C_EYE} />
        <Voxel x={0} y={8} z={0} scale={s} color={C_SKIN} />
      </group>
      <group ref={bodyGroup} position={[0, 0.8, 0]}>
        <Box args={[5*s, 6.5*s, 3*s]} position={[0, 4*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box>
        <group ref={leftArm} position={[-3.5*s, 6*s, 0]}><Box args={[1.5*s, 6*s, 2*s]} position={[0, -2.5*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box></group>
        <group ref={rightArm} position={[3.5*s, 6*s, 0]}><Box args={[1.5*s, 6*s, 2*s]} position={[0, -2.5*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box></group>
        <group ref={leftLeg} position={[-1.2*s, 1*s, 0]}><Box args={[2*s, 6*s, 2.5*s]} position={[0, -3*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box></group>
        <group ref={rightLeg} position={[1.2*s, 1*s, 0]}><Box args={[2*s, 6*s, 2.5*s]} position={[0, -3*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box></group>
      </group>
    </group>
  )
}

function AvatarGoldenPanda({ pitchRef, speedRef, isGroundedRef }: any) {
  const s = 0.09; 
  const headGroup = useRef<THREE.Group>(null);
  const bodyGroup = useRef<THREE.Group>(null); 
  const { leftLeg, rightLeg, leftArm, rightArm } = useBipedAnim(speedRef, isGroundedRef);
  useFrame((state) => { 
      if (headGroup.current) headGroup.current.rotation.x = -pitchRef.current; 
      if (bodyGroup.current) {
          const t = state.clock.elapsedTime * 15;
          const speed = Math.min(speedRef.current, 1.5);
          const bob = speed > 0.1 ? Math.abs(Math.sin(t*2)) * 0.03 : 0;
          bodyGroup.current.position.y = 0.2 + bob; 
          bodyGroup.current.rotation.set(0, 0, 0); 
      }
  });
  const C_GOLD_BODY = "#C5A059"; const C_GOLD_DARK = "#8B6508"; const C_GOLD_BRIGHT = "#FFD700";
  const C_WHITE_BASE = "#F7F5F0"; const C_BLACK = "#0A0A0A"; const C_RED_ROPE = "#D92121";
  const C_GEM_BLUE = "#0047AB"; const C_GEM_RED = "#B22222";
  
  return (
    <group position={[0, 0, 0]}> 
      <group ref={headGroup} position={[0, 2.3, 0]}>
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
        <group ref={leftArm} position={[-9*s, 12*s, 0]}><Box args={[5*s, 14*s, 5*s]} position={[0, -5*s, 0]} rotation={[0, 0, 0.1]}><meshStandardMaterial color={C_GOLD_DARK} /></Box></group>
        <group ref={rightArm} position={[9*s, 12*s, 0]}><Box args={[5*s, 14*s, 5*s]} position={[0, -5*s, 0]} rotation={[0, 0, -0.1]}><meshStandardMaterial color={C_GOLD_DARK} /></Box></group>
        <group ref={leftLeg} position={[-4*s, 0, 0]}><Box args={[5*s, 8*s, 6*s]} position={[0, -2*s, 0]}><meshStandardMaterial color={C_GOLD_DARK} /></Box></group>
        <group ref={rightLeg} position={[4*s, 0, 0]}><Box args={[5*s, 8*s, 6*s]} position={[0, -2*s, 0]}><meshStandardMaterial color={C_GOLD_DARK} /></Box></group>
        <Box args={[14.5*s, 0.5*s, 10.5*s]} position={[0, 14*s, 0]}><meshStandardMaterial color={C_RED_ROPE} /></Box>
        <Box args={[0.6*s, 4*s, 0.6*s]} position={[2*s, 12*s, 5.2*s]} rotation={[0, 0, 0.6]}><meshStandardMaterial color={C_RED_ROPE} /></Box>
        <Box args={[0.6*s, 4*s, 0.6*s]} position={[-2*s, 12*s, 5.2*s]} rotation={[0, 0, -0.6]}><meshStandardMaterial color={C_RED_ROPE} /></Box>
        <group position={[0, 10*s, 6*s]}>
            <group position={[0, 1.5*s, 0]} rotation={[0, 0, 0.78]}><Box args={[2.5*s, 2.5*s, 0.3*s]}><meshStandardMaterial color={C_GOLD_BRIGHT} /></Box><Box args={[1*s, 1*s, 0.35*s]}><meshStandardMaterial color="#000" /></Box></group>
            <group position={[-1.5*s, -1*s, 0.1*s]} rotation={[0, 0, 0.78]}><Box args={[2.5*s, 2.5*s, 0.3*s]}><meshStandardMaterial color={C_GOLD_BRIGHT} /></Box><Box args={[1*s, 1*s, 0.35*s]}><meshStandardMaterial color="#000" /></Box></group>
            <group position={[1.5*s, -1*s, 0.1*s]} rotation={[0, 0, 0.78]}><Box args={[2.5*s, 2.5*s, 0.3*s]}><meshStandardMaterial color={C_GOLD_BRIGHT} /></Box><Box args={[1*s, 1*s, 0.35*s]}><meshStandardMaterial color="#000" /></Box></group>
        </group>
      </group>
    </group>
  )
}

function AvatarGalacticGecko({ pitchRef, speedRef, isGroundedRef }: any) {
  const s = 0.17; 
  const headGroup = useRef<THREE.Group>(null);
  const { leftLeg, rightLeg, leftArm, rightArm, bodyGroup } = useBipedAnim(speedRef, isGroundedRef);
  useFrame(() => { if (headGroup.current) headGroup.current.rotation.x = -pitchRef.current; });
  const C_SKIN = "#66b050"; const C_SUIT = "#111111"; const C_SHIRT = "#FFFFFF"; const C_TIE = "#00FF00"; const C_BEARD_ROCK = "#4a4036"; 
  const C_GOGGLE_HOUSING = "#2b2b2b"; const C_LENS = "#00ffff"; const C_COIL_BASE = "#8c5a3c"; const C_BULB = "#fffdd0"; 
  const C_LIGHTNING = "#ffff00"; const C_MECHANICAL = "#777777"; const C_EYE_WHITE = "#FFFFFF"; const C_PUPIL = "#000000";

  return (
    <group position={[0, 0, 0]}> 
      {/* HEAD GROUP */}
      <group ref={headGroup} position={[0, 2.2, 0]}>
        <Box args={[10*s, 9*s, 11*s]} position={[0, 4.5*s, 1*s]}><meshStandardMaterial color={C_SKIN} /></Box>
        <Box args={[8*s, 4*s, 8*s]} position={[0, 2*s, 9*s]}><meshStandardMaterial color={C_SKIN} /></Box>
        <Box args={[11*s, 4*s, 8*s]} position={[0, 1*s, 0]}><meshStandardMaterial color={C_SKIN} /></Box>

        <group position={[0, 0, 10*s]}>
            <Box args={[2*s, 5*s, 2*s]} position={[0, -2*s, 0]} rotation={[0.2, 0, 0]}><meshStandardMaterial color={C_BEARD_ROCK} /></Box>
            <Box args={[1.5*s, 4*s, 1.5*s]} position={[2*s, -1.5*s, -1*s]} rotation={[0.1, 0, -0.2]}><meshStandardMaterial color={C_BEARD_ROCK} /></Box>
            <Box args={[1.5*s, 4*s, 1.5*s]} position={[-2*s, -1.5*s, -1*s]} rotation={[0.1, 0, 0.2]}><meshStandardMaterial color={C_BEARD_ROCK} /></Box>
            <Box args={[1.5*s, 3*s, 1.5*s]} position={[3.5*s, -1*s, -2*s]} rotation={[0, 0, -0.4]}><meshStandardMaterial color={C_BEARD_ROCK} /></Box>
            <Box args={[1.5*s, 3*s, 1.5*s]} position={[-3.5*s, -1*s, -2*s]} rotation={[0, 0, 0.4]}><meshStandardMaterial color={C_BEARD_ROCK} /></Box>
        </group>

        <group position={[3.5*s, 5*s, 5*s]} rotation={[0, 0.2, 0]}>
             <Box args={[3*s, 3*s, 2*s]}><meshStandardMaterial color={C_SKIN} /></Box>
             <Box args={[2*s, 2*s, 0.5*s]} position={[0, 0, 1.1*s]}><meshStandardMaterial color={C_EYE_WHITE} /></Box>
             <Box args={[0.5*s, 1.5*s, 0.1*s]} position={[0, 0, 1.4*s]}><meshStandardMaterial color={C_PUPIL} /></Box>
        </group>

        <group position={[-3.5*s, 5*s, 6*s]} rotation={[0, -0.1, 0]}>
             <Cylinder args={[2.5*s, 2.5*s, 6*s, 16]} rotation={[Math.PI/2, 0, 0]} position={[0, 0, 0]}><meshStandardMaterial color={C_GOGGLE_HOUSING} metalness={0.6} roughness={0.4} /></Cylinder>
             <Cylinder args={[2*s, 2*s, 0.5*s, 16]} rotation={[Math.PI/2, 0, 0]} position={[0, 0, 3.1*s]}><meshStandardMaterial color={C_LENS} emissive={C_LENS} emissiveIntensity={1.5} toneMapped={false} /></Cylinder>
             <Box args={[11*s, 1*s, 11*s]} position={[3.5*s, 0, -4*s]}><meshStandardMaterial color="#333" /></Box>
        </group>

        <group position={[0, 9*s, 2*s]}>
            <group position={[3*s, 0, 0]}>
                <Cylinder args={[1.5*s, 1.5*s, 2*s, 8]} position={[0, 1*s, 0]}><meshStandardMaterial color={C_COIL_BASE} /></Cylinder>
                <Torus args={[1.6*s, 0.2*s, 8, 16]} position={[0, 0.5*s, 0]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#ffd700" /></Torus>
                <Torus args={[1.6*s, 0.2*s, 8, 16]} position={[0, 1.5*s, 0]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#ffd700" /></Torus>
                <Box args={[3.5*s, 3.5*s, 3.5*s]} position={[0, 3.5*s, 0]}><meshStandardMaterial color={C_BULB} emissive={C_BULB} emissiveIntensity={0.6} /></Box>
                <group position={[2*s, 4*s, 0]} rotation={[0, 0, -0.5]}><Box args={[0.5*s, 3*s, 0.5*s]}><meshStandardMaterial color={C_LIGHTNING} emissive={C_LIGHTNING} /></Box></group>
            </group>
            <group position={[-3*s, 0, 0]}>
                <Cylinder args={[1.5*s, 1.5*s, 2*s, 8]} position={[0, 1*s, 0]}><meshStandardMaterial color={C_COIL_BASE} /></Cylinder>
                <Torus args={[1.6*s, 0.2*s, 8, 16]} position={[0, 0.5*s, 0]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#ffd700" /></Torus>
                <Torus args={[1.6*s, 0.2*s, 8, 16]} position={[0, 1.5*s, 0]} rotation={[Math.PI/2, 0, 0]}><meshStandardMaterial color="#ffd700" /></Torus>
                <Box args={[3.5*s, 3.5*s, 3.5*s]} position={[0, 3.5*s, 0]}><meshStandardMaterial color={C_BULB} emissive={C_BULB} emissiveIntensity={0.6} /></Box>
                <group position={[-2.5*s, 1*s, 0]}>
                    <Box args={[3*s, 0.5*s, 0.5*s]}><meshStandardMaterial color={C_MECHANICAL} /></Box>
                    <Box args={[0.5*s, 4*s, 0.5*s]} position={[-1.5*s, 2*s, 0]}><meshStandardMaterial color={C_MECHANICAL} /></Box>
                    <Box args={[0.5*s, 3*s, 0.5*s]} position={[-1.5*s, 3.5*s, 0]}><meshStandardMaterial color="#cd7f32" emissive="#cd7f32" emissiveIntensity={2} /></Box>
                    <Box args={[2*s, 0.2*s, 0.2*s]} position={[-0.5*s, 3*s, 0]} rotation={[0,0, -0.5]}><meshStandardMaterial color={C_LIGHTNING} emissive={C_LIGHTNING} /></Box>
                </group>
            </group>
        </group>
      </group>
      <group ref={bodyGroup} position={[0, 0.8, 0]}>
        {/* BODY */}
        <Box args={[7*s, 8*s, 3.5*s]} position={[0, 3*s, 0]}><meshStandardMaterial color={C_SUIT} /></Box>
        <Box args={[3*s, 3*s, 3.6*s]} position={[0, 5.5*s, 0]}><meshStandardMaterial color={C_SHIRT} /></Box>
        <Box args={[1*s, 5*s, 3.7*s]} position={[0, 4.5*s, 0]}><meshStandardMaterial color={C_TIE} /></Box>
        <group ref={leftArm} position={[-2.5*s, 5.5*s, 0]}>
            <Box args={[2.5*s, 6*s, 3.8*s]} position={[0, -2.5*s, 0]} rotation={[0, 0, -0.1]}><meshStandardMaterial color={C_SUIT} /></Box><Box args={[2*s, 2*s, 2*s]} position={[-2.5*s, -6*s, 0]}><meshStandardMaterial color={C_SKIN} /></Box></group>
        <group ref={rightArm} position={[2.5*s, 5.5*s, 0]}>
            <Box args={[2.5*s, 6*s, 3.8*s]} position={[0, -2.5*s, 0]} rotation={[0, 0, 0.1]}><meshStandardMaterial color={C_SUIT} /></Box><Box args={[2*s, 2*s, 2*s]} position={[2.5*s, -6*s, 0]}><meshStandardMaterial color={C_SKIN} /></Box></group>
        <group ref={leftLeg} position={[-1.6*s, 0, 0]}>
            <Box args={[2.8*s, 6*s, 3*s]} position={[0, -3*s, 0]}><meshStandardMaterial color={C_SUIT} /></Box></group>
        <group ref={rightLeg} position={[1.6*s, 0, 0]}>
            <Box args={[2.8*s, 6*s, 3*s]} position={[0, -3*s, 0]}><meshStandardMaterial color={C_SUIT} /></Box></group>
        <Box args={[2.5*s, 7*s, 2.5*s]} position={[-4.5*s, 3.5*s, 0]} rotation={[0, 0, 0.1]}><meshStandardMaterial color={C_SUIT} /></Box>
        <Box args={[2.5*s, 7*s, 2.5*s]} position={[4.5*s, 3.5*s, 0]} rotation={[0, 0, -0.1]}><meshStandardMaterial color={C_SUIT} /></Box>
      </group>
    </group>
  )
}

function AvatarGeckoGLB({ pitchRef, speedRef, isGroundedRef }: any) {
    const { scene } = useGLTF('/ClassicRedEyesGecko.glb')
    const meshRef = useRef<THREE.Group>(null);
    const clone = useMemo(() => {
        const c = scene.clone(); c.scale.set(75, 75, 75);
        c.traverse((node: any) => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; } });
        return c;
    }, [scene]);
    const headBone = useMemo(() => clone.getObjectByName('mixamorig:Head') || clone.getObjectByName('Head'), [clone]);
    useFrame((state) => {
        if (headBone) headBone.rotation.x = -pitchRef.current + 0.1;
        const t = state.clock.elapsedTime * 12;
        const speed = Math.min(speedRef.current, 1);
        if(meshRef.current) {
             if (isGroundedRef.current && speed > 0.1) {
                 meshRef.current.position.y = Math.abs(Math.sin(t)) * 0.1 * speed;
                 meshRef.current.rotation.z = Math.sin(t) * 0.05 * speed;
             } else {
                 meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, 0, 0.1);
                 meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, 0, 0.1);
             }
        }
    })
    return <group ref={meshRef} position={[0, 0, 0]}><primitive object={clone} position={[0, 0, 0]} /></group>
}

const AVATAR_REGISTRY: Record<string, React.FC<any>> = {
    'human': AvatarHuman,
    'alien': AvatarAlien,
    'panda_3120': AvatarGoldenPanda, 
    'gecko_8062': AvatarGalacticGecko, 
    'gecko_classic': AvatarGeckoGLB,
};

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

export default function VoxelPlayer({ 
  teleportPos,
  teleportRot,
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
  const { camera, gl } = useThree()
  const rapier = useRapier(); 
  
  // 1. FIX: Explicitly allow null to fix "read-only" TS error
  const rigidBodyRef = useRef<RapierRigidBody | null>(null);
  
  const avatarGroupRef = useRef<THREE.Group>(null)
  const pitchRef = useRef(0);
  const animationSpeedRef = useRef(0); 
  const isGrounded = useRef(false);
  
  const [presence, updateMyPresence] = !isRemote ? useMyPresence() : [null, null];
  const keys = useRef<Record<string, boolean>>({})
  const playerPos = useRef(new THREE.Vector3(0, 0, 0))
  const rotation = useRef({ yaw: Math.PI, pitch: 0.1 }) 
  const selfieOrbit = useRef({ yaw: 0, height: 1.8 })
  const prevJumpBtn = useRef(false); 

  // DEBUG HUD
  const debugTextRef = useRef<HTMLParagraphElement>(null);
  const lastDebugUpdate = useRef(0);

  // --- HYDRATION FIX ---
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // --- INPUT LISTENERS ---
  useEffect(() => {
    if (isRemote || !mounted) return;
    window.focus();
    const onKeyDown = (e: KeyboardEvent) => { keys.current[e.code] = true; }
    const onKeyUp = (e: KeyboardEvent) => { keys.current[e.code] = false; }
    const onMouseMove = (e: MouseEvent) => {
        if (document.pointerLockElement === gl.domElement) {
            rotation.current.yaw -= e.movementX * 0.002;
            rotation.current.pitch -= e.movementY * 0.002;
            rotation.current.pitch = Math.max(-0.5, Math.min(0.5, rotation.current.pitch));
        }
    }
    const onClick = () => { if (!isSelfieMode) gl.domElement.requestPointerLock(); }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    document.addEventListener('mousemove', onMouseMove)
    gl.domElement.addEventListener('click', onClick)

    return () => { 
        document.removeEventListener('keydown', onKeyDown); 
        document.removeEventListener('keyup', onKeyUp);
        document.removeEventListener('mousemove', onMouseMove);
        gl.domElement.removeEventListener('click', onClick);
    }
  }, [isRemote, isSelfieMode, gl.domElement, mounted])

  // --- TELEPORT ON LOAD ---
  useEffect(() => {
    if (teleportPos && !isRemote && rigidBodyRef.current) {
        rigidBodyRef.current.setTranslation({ x: teleportPos[0], y: teleportPos[1], z: teleportPos[2] }, true);
        rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        playerPos.current.set(...teleportPos);
        rotation.current.yaw = teleportRot ?? Math.PI;
    }
  }, [teleportPos, teleportRot, isRemote])

  useFrame((state, delta) => {
    if (isRemote) {
        if (remotePos && avatarGroupRef.current) {
             const target = new THREE.Vector3(...remotePos);
             avatarGroupRef.current.position.lerp(target, 0.2); 
             avatarGroupRef.current.rotation.y = remoteRot || 0;
             pitchRef.current = remotePitch || 0;
             const dist = avatarGroupRef.current.position.distanceTo(target);
             animationSpeedRef.current = THREE.MathUtils.lerp(animationSpeedRef.current, dist > 0.1 ? 1 : 0, 0.1);
        }
        return;
    }

    // --- 🚨 FORCE LINK SYSTEM (The "Body Snatcher") ---
    // If React failed to attach the ref, we manually hunt for the body in the physics world
    if (!rigidBodyRef.current && rapier && rapier.world) {
        try {
            rapier.world.forEachRigidBody((body) => {
                // @ts-ignore
                if (body.userData && body.userData.isPlayer) {
                    // console.log("👻 Force Link: Player Body Found!");
                    rigidBodyRef.current = body;
                }
            });
        } catch(e) {}
    }

    // --- MAIN LOCAL LOOP ---
    let gpLookX = 0, gpLookY = 0, gpMoveX = 0, gpMoveY = 0;
    let gpSprint = false;

    // --- GAMEPAD LOGIC (FIXED) ---
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(gamepads).find(g => g && g.connected);

    if (gp) {
        // Standard mapping: Left Stick (0,1), Right Stick (2,3)
        gpMoveX = applyDeadzone(gp.axes[0]);
        gpMoveY = -applyDeadzone(gp.axes[1]); // Invert Y
        gpLookX = applyDeadzone(gp.axes[2]);
        gpLookY = -applyDeadzone(gp.axes[3]); // Invert Y

        // Sprint button (L3 or B/Circle)
        if (gp.buttons[1]?.pressed || gp.buttons[10]?.pressed) gpSprint = true;
        
        // Jump button (A/Cross or LB)
        const jumpPressed = gp.buttons[0]?.pressed || gp.buttons[4]?.pressed;
        
        // Physics Jump Logic
        if (jumpPressed && !prevJumpBtn.current) {
             if (isGrounded.current) {
                 if(rigidBodyRef.current) {
                     const linvel = rigidBodyRef.current.linvel();
                     rigidBodyRef.current.setLinvel({ x: linvel.x, y: JUMP_FORCE, z: linvel.z }, true);
                 }
             }
        }
        prevJumpBtn.current = jumpPressed || false;
    }

    const forward = (keys.current['KeyW'] ? 1 : 0) - (keys.current['KeyS'] ? 1 : 0) + (mobileInput?.current.move.y || 0) + gpMoveY;
    const side = (keys.current['KeyD'] ? 1 : 0) - (keys.current['KeyA'] ? 1 : 0) + (mobileInput?.current.move.x || 0) + gpMoveX;
    const isSprinting = keys.current['ShiftLeft'] || gpSprint;
    const currentSpeed = (isSprinting ? SPRINT_SPEED : WALK_SPEED);
    const jump = keys.current['Space'];

    const moveDir = new THREE.Vector3(side, 0, -forward).normalize();
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current.yaw);

    let engineStatus = "Checking...";
    let rbHandle = "N/A";
    
    // 2. PHYSICS UPDATE
    if (rigidBodyRef.current) {
        engineStatus = "ALIVE (Attached)";
        rbHandle = rigidBodyRef.current.handle.toString();
        
        const bodyPos = rigidBodyRef.current.translation();
        
        // SYNC: Physics Center (1.0m) -> Feet (0.0m)
        const feetY = bodyPos.y - 1.0; 
        
        playerPos.current.set(bodyPos.x, feetY, bodyPos.z);

        const linvel = rigidBodyRef.current.linvel();
        const targetVel = moveDir.multiplyScalar(currentSpeed);
        
        const isLanded = Math.abs(linvel.y) < 0.2; 
        isGrounded.current = isLanded; // Update ref for avatars

        // Jump (Keyboard)
        if (jump && isLanded) {
            linvel.y = JUMP_FORCE;
        }
        rigidBodyRef.current.setLinvel({ x: targetVel.x, y: linvel.y, z: targetVel.z }, true);

    } else {
        engineStatus = "ALIVE (Detached/Loading)";
        // Fallback: Manual Movement
        playerPos.current.add(moveDir.multiplyScalar(currentSpeed * delta));
        
        // Fake Floor Gravity
        if (playerPos.current.y > 0) playerPos.current.y -= 9.8 * delta;
        if (playerPos.current.y < 0.05) playerPos.current.y = 0;
    }

    // 3. ANIMATION & VISUALS
    animationSpeedRef.current = THREE.MathUtils.lerp(animationSpeedRef.current, moveDir.length(), 0.1);
    
    if (avatarGroupRef.current) {
        avatarGroupRef.current.position.copy(playerPos.current);
        avatarGroupRef.current.rotation.y = rotation.current.yaw;
    }

    // 4. HUD
    if (debugTextRef.current && state.clock.elapsedTime - lastDebugUpdate.current > 0.1) {
        lastDebugUpdate.current = state.clock.elapsedTime;
        const gpStatus = gp ? `GAMEPAD: ${gp.id.substring(0,10)}` : "NO GAMEPAD";
        debugTextRef.current.innerText = `ENGINE: ${engineStatus} [ID:${rbHandle}]\nPOS: ${playerPos.current.x.toFixed(1)}, ${playerPos.current.y.toFixed(1)}\nINPUT: ${forward.toFixed(1)}|${side.toFixed(1)}\n${gpStatus}`;
        debugTextRef.current.style.color = engineStatus.includes("Attached") ? "lime" : "orange";
    }

    // 5. CAMERA & ROTATION LOGIC
    if (isSelfieMode) {
        if (keys.current['ArrowLeft']) selfieOrbit.current.yaw += 2.0 * delta;
        if (keys.current['ArrowRight']) selfieOrbit.current.yaw -= 2.0 * delta;
        
        // Gamepad Selfie Look
        selfieOrbit.current.yaw += gpLookX * 2.0 * delta;
        selfieOrbit.current.height += gpLookY * 2.0 * delta; 

        // ... (Selfie logic remains same)
        const dist = 5.5; 
        const totalYaw = rotation.current.yaw + Math.PI + selfieOrbit.current.yaw;
        const camPos = new THREE.Vector3(
            playerPos.current.x + Math.sin(totalYaw) * dist,
            playerPos.current.y + selfieOrbit.current.height,
            playerPos.current.z + Math.cos(totalYaw) * dist
        );
        camera.position.copy(camPos);
        camera.lookAt(new THREE.Vector3(playerPos.current.x, playerPos.current.y + 1.6, playerPos.current.z));

    } else {
        // === NORMAL MODE: Mouse + Arrows + Gamepad ===
        
        // A. Arrow Keys Rotation (Restored Feature)
        if (keys.current['ArrowLeft']) rotation.current.yaw += ROTATION_SPEED * delta;
        if (keys.current['ArrowRight']) rotation.current.yaw -= ROTATION_SPEED * delta;
        if (keys.current['ArrowUp']) rotation.current.pitch += ROTATION_SPEED * delta;
        if (keys.current['ArrowDown']) rotation.current.pitch -= ROTATION_SPEED * delta;

        // B. Gamepad & Mobile Look
        const joyLookX = (mobileInput?.current.look.x || 0) + gpLookX;
        const joyLookY = (mobileInput?.current.look.y || 0) + gpLookY;

        rotation.current.yaw -= joyLookX * ROTATION_SPEED * delta * 2.0; 
        rotation.current.pitch += joyLookY * ROTATION_SPEED * delta * 2.0;

        // B. Mouse Rotation (Already handled by event listener updating rotation.current)
        
        // Clamp Pitch
        rotation.current.pitch = Math.max(-0.5, Math.min(0.5, rotation.current.pitch));
        pitchRef.current = rotation.current.pitch;

        // C. Camera Follow
        const offset = new THREE.Vector3(0, 0, CAMERA_DISTANCE);
        offset.applyEuler(new THREE.Euler(rotation.current.pitch, rotation.current.yaw, 0, 'YXZ'));
        const targetCamPos = new THREE.Vector3(playerPos.current.x, playerPos.current.y + CAMERA_HEIGHT, playerPos.current.z).add(offset);
        camera.position.copy(targetCamPos);
        camera.lookAt(new THREE.Vector3(playerPos.current.x, playerPos.current.y + 1.8, playerPos.current.z));
    }

    // 6. Network
    if (updateMyPresence && onPosUpdate) {
        onPosUpdate(playerPos.current);
        updateMyPresence({
            position: [playerPos.current.x, playerPos.current.y, playerPos.current.z],
            rotation: rotation.current.yaw,
            pitch: rotation.current.pitch,
            avatarId: avatarId,
            username: username || undefined
        });
    }
  })

  // @ts-ignore
  const AvatarComponent = AVATAR_REGISTRY[avatarId] || AVATAR_REGISTRY['human'];

  if (isRemote) {
      return (
        <group ref={avatarGroupRef}>
             <group rotation={[0, Math.PI, 0]}>
                 <Suspense fallback={<Box args={[1, 2, 1]}><meshStandardMaterial color="gray" /></Box>}>
                    <AvatarComponent pitchRef={pitchRef} speedRef={animationSpeedRef} isGroundedRef={isGrounded} />
                 </Suspense>
             </group>
             <mesh position={[0, 2.5, 0]} /> 
        </group>
      )
  }

  // Prevent Hydration Errors
  if (!mounted) return null;

  return (
    <>
        <Html position={[0,0,0]} zIndexRange={[100, 0]}>
             <div 
                tabIndex={0}
                onClick={(e) => { e.currentTarget.style.display='none'; gl.domElement.requestPointerLock(); window.focus(); }}
                style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '20px', borderRadius: '10px', fontSize: '20px', cursor: 'pointer', border: '2px solid lime', textAlign: 'center' }}
            >
                <p>CLICK TO START</p>
            </div>
            <div style={{ position: 'fixed', top: '10px', left: '10px', background: 'rgba(0,0,0,0.8)', color: '#0f0', padding: '10px', fontFamily: 'monospace', fontSize: '12px', pointerEvents: 'none', whiteSpace: 'pre' }}>
                <p ref={debugTextRef}>Initializing...</p>
            </div>
        </Html>

        {/* --- PHYSICS BODY --- */}
        {/* Callback Ref used to manually populate our ref if React behaves oddly */}
        <RigidBody 
            ref={(api) => {
                if (api) {
                    rigidBodyRef.current = api;
                    // Tag for Force Link System
                    api.userData = { isPlayer: true }; 
                }
            }} 
            position={[0, 5, 0]} 
            enabledRotations={[false, false, false]} 
            friction={0} 
            linearDamping={0.5}
            lockRotations={true} 
            colliders={false} 
            userData={{ isPlayer: true }} 
        >
            <CapsuleCollider args={[0.9, 0.5]} position={[0, 0, 0]} /> 
            
            {/* DEBUG CUBE REMOVED FOR FINAL POLISH */}
        </RigidBody>

        {/* --- VISUALS (OUTSIDE PHYSICS BODY) --- */}
        <group ref={avatarGroupRef}>
            <group rotation={[0, Math.PI, 0]}>
                <Suspense fallback={<Box args={[1, 2, 1]}><meshStandardMaterial color="gray" /></Box>}>
                    <AvatarComponent pitchRef={pitchRef} speedRef={animationSpeedRef} isGroundedRef={isGrounded} />
                </Suspense>
            </group>
        </group>
    </>
  )
}
