"use client"
import { useFrame, useThree } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import { Box } from '@react-three/drei'
import * as THREE from 'three'
import { useMyPresence } from '@/liveblocks.config'

interface VoxelPlayerProps {
  teleportPos?: [number, number, number] | null;
  onPosUpdate?: (pos: THREE.Vector3) => void; 
  avatarId?: string;
  isRemote?: boolean;
  remotePos?: [number, number, number];
  remoteRot?: number;
  remotePitch?: number; 
  isSelfieMode?: boolean; 
}

// --- CONFIGURATION ---
const WALK_SPEED = 10
const SPRINT_SPEED = 24
const ROTATION_SPEED = 2.5 
const CAMERA_DISTANCE = 4.0 
const CAMERA_HEIGHT = 2.0   

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

// --- AVATAR DEFINITIONS ---

// 1. HUMAN AVATAR
function AvatarHuman({ pitchRef }: { pitchRef: React.MutableRefObject<number> }) {
  const s = 0.08; 
  const headGroup = useRef<THREE.Group>(null);
  
  // FIX: Inverted pitch (-pitchRef.current) so head looks UP when camera looks UP
  useFrame(() => { 
      if (headGroup.current) headGroup.current.rotation.x = -pitchRef.current; 
  });

  const C_SKIN = "#F5CCA2"; const C_BEARD = "#FFFFFF"; const C_EYE = "#38B6FF"; const C_BROW = "#000000"; const C_SHADOW = "#E0B088";
  return (
    <group position={[0, -0.5, 0]}>
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
      <group position={[0, 0.8, 0]}>
        <Box args={[5*s, 6*s, 3*s]} position={[0, 4*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        <Voxel x={-1.5} y={5.5} z={1.6} scale={s} color={C_SHADOW} /> <Voxel x={1.5}  y={5.5} z={1.6} scale={s} color={C_SHADOW} />
        <Box args={[1.5*s, 6*s, 2*s]} position={[-3.5*s, 3.5*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        <Box args={[1.5*s, 6*s, 2*s]} position={[3.5*s, 3.5*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        <Box args={[2*s, 6*s, 2.5*s]} position={[-1.2*s, -2*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        <Box args={[2*s, 6*s, 2.5*s]} position={[1.2*s, -2*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        <Voxel x={0} y={1} z={0.5} scale={s} color={C_SHADOW} />
      </group>
    </group>
  )
}

// 2. ALIEN AVATAR
function AvatarAlien({ pitchRef }: { pitchRef: React.MutableRefObject<number> }) {
  const s = 0.08; 
  const headGroup = useRef<THREE.Group>(null);
  
  // FIX: Inverted pitch
  useFrame(() => { 
      if (headGroup.current) headGroup.current.rotation.x = -pitchRef.current; 
  });

  const C_SKIN = "#88FF88"; const C_SUIT = "#222222"; const C_EYE = "#FF0000";
  return (
    <group position={[0, -0.5, 0]}>
      <group ref={headGroup} position={[0, 1.8, 0]}>
        <Box args={[8*s, 8*s, 7*s]} position={[0, 4*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SKIN} /></Box>
        <Voxel x={-2} y={5} z={3.6} scale={s} color={C_EYE} /> <Voxel x={2} y={5} z={3.6} scale={s} color={C_EYE} />
        <Voxel x={0} y={8} z={0} scale={s} color={C_SKIN} />
      </group>
      <group position={[0, 0.8, 0]}>
        <Box args={[5*s, 6*s, 3*s]} position={[0, 4*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box>
        <Box args={[1.5*s, 6*s, 2*s]} position={[-3.5*s, 3.5*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box>
        <Box args={[1.5*s, 6*s, 2*s]} position={[3.5*s, 3.5*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box>
        <Box args={[2*s, 6*s, 2.5*s]} position={[-1.2*s, -2*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box>
        <Box args={[2*s, 6*s, 2.5*s]} position={[1.2*s, -2*s, 0]} raycast={() => null}><meshStandardMaterial color={C_SUIT} /></Box>
      </group>
    </group>
  )
}

// 3. PANDA AVATAR
function AvatarGoldenPanda({ pitchRef }: { pitchRef: React.MutableRefObject<number> }) {
  const s = 0.04; 
  const headGroup = useRef<THREE.Group>(null);
  
  // FIX: Inverted pitch
  useFrame(() => { 
      if (headGroup.current) headGroup.current.rotation.x = -pitchRef.current; 
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
      <group position={[0, 0.2, 0]}>
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
            <group position={[1.5*s, -1*s, 0.1*s]} rotation={[0, 0, 0.78]}><Box args={[2.5*s, 2.5*s, 0.3*s]}><meshStandardMaterial color={C_GOLD_BRIGHT} /></Box><Box args={[1*s, 1*s, 0.35*s]}><meshStandardMaterial color="#000" /></Box></group>
        </group>
      </group>
    </group>
  )
}

// --- AVATAR REGISTRY ---
const AVATAR_REGISTRY: Record<string, React.FC<any>> = {
    'human': AvatarHuman,
    'alien': AvatarAlien,
    'panda_3120': AvatarGoldenPanda, 
};

export default function VoxelPlayer({ 
  teleportPos, 
  onPosUpdate, 
  avatarId = 'human',
  isRemote = false, 
  remotePos, 
  remoteRot,
  remotePitch,
  isSelfieMode = false 
}: VoxelPlayerProps) {
  const { camera } = useThree()
  const avatarRef = useRef<THREE.Group>(null)
  const pitchRef = useRef(0);
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
      rotation.current.yaw = Math.PI
      rotation.current.pitch = 0.1
      if (avatarRef.current) {
        avatarRef.current.position.copy(playerPos.current)
        avatarRef.current.rotation.y = rotation.current.yaw
      }
    }
  }, [teleportPos, isRemote])

  // --- LOOP ---
  useFrame((state, delta) => {
    if (avatarRef.current) {
        
        // 1. REMOTE PLAYER
        if (isRemote && remotePos) {
            const targetPos = new THREE.Vector3(...remotePos)
            avatarRef.current.position.lerp(targetPos, 0.2)
            avatarRef.current.rotation.y = remoteRot || 0
            pitchRef.current = remotePitch || 0;
            return;
        }

        // --- SPLIT LOGIC BASED ON MODE ---
        if (isSelfieMode) {
            // === SELFIE MODE CONTROLS ===
            // Arrows move CAMERA ORBIT, NOT PLAYER
            // Player stays locked in place (Tripod mode)
            
            if (keys.current['ArrowLeft']) selfieOrbit.current.yaw += 2.0 * delta;
            if (keys.current['ArrowRight']) selfieOrbit.current.yaw -= 2.0 * delta;
            if (keys.current['ArrowUp']) selfieOrbit.current.height += 2.0 * delta;
            if (keys.current['ArrowDown']) selfieOrbit.current.height -= 2.0 * delta;
            
            // Clamp Height
            selfieOrbit.current.height = Math.max(0.5, Math.min(3.5, selfieOrbit.current.height));

            // Force Avatar to stand still
            avatarRef.current.position.copy(playerPos.current);
            avatarRef.current.rotation.y = rotation.current.yaw;
            pitchRef.current = 0; // Look straight ahead for photo

            // Calculate Orbit Camera Position
            // We orbit around the head (Y=1.6) at a fixed distance
            const dist = 2.5; 
            // Total Angle = Player Rotation + PI (Front) + Orbit Offset
            const totalYaw = rotation.current.yaw + Math.PI + selfieOrbit.current.yaw;
            
            const offsetX = Math.sin(totalYaw) * dist;
            const offsetZ = Math.cos(totalYaw) * dist;
            
            const camPos = new THREE.Vector3(
                playerPos.current.x + offsetX,
                playerPos.current.y + selfieOrbit.current.height,
                playerPos.current.z + offsetZ
            );
            
            // Snap camera instantly (No Lerp/Elastic)
            camera.position.copy(camPos);
            
            // Look at Head
            const headPos = playerPos.current.clone().add(new THREE.Vector3(0, 1.6, 0));
            camera.lookAt(headPos);

        } else {
            // === NORMAL MODE CONTROLS ===
            // Arrows move PLAYER YAW/PITCH
            
            if (keys.current['ArrowLeft']) rotation.current.yaw += ROTATION_SPEED * delta
            if (keys.current['ArrowRight']) rotation.current.yaw -= ROTATION_SPEED * delta
            if (keys.current['ArrowUp']) rotation.current.pitch += ROTATION_SPEED * delta
            if (keys.current['ArrowDown']) rotation.current.pitch -= ROTATION_SPEED * delta

            rotation.current.pitch = Math.max(-0.5, Math.min(0.5, rotation.current.pitch))
            pitchRef.current = rotation.current.pitch;

            const isSprinting = keys.current['ShiftLeft'] || keys.current['ShiftRight']
            const speed = (isSprinting ? SPRINT_SPEED : WALK_SPEED) * delta

            const forward = (keys.current['KeyW'] ? 1 : 0) - (keys.current['KeyS'] ? 1 : 0)
            const side = (keys.current['KeyD'] ? 1 : 0) - (keys.current['KeyA'] ? 1 : 0)

            const moveDir = new THREE.Vector3(side, 0, -forward).normalize()
            moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation.current.yaw)

            if (moveDir.lengthSq() > 0) {
                playerPos.current.add(moveDir.multiplyScalar(speed))
            }

            avatarRef.current.position.copy(playerPos.current)
            avatarRef.current.rotation.y = rotation.current.yaw
            
            if (moveDir.lengthSq() > 0) {
                const bobOffset = Math.sin(state.clock.elapsedTime * 20) * 0.08
                avatarRef.current.position.y += bobOffset 
            }

            // Normal Camera Follow (Third Person)
            const offset = new THREE.Vector3(0, 0, CAMERA_DISTANCE)
            const rotEuler = new THREE.Euler(rotation.current.pitch, rotation.current.yaw, 0, 'YXZ')
            offset.applyEuler(rotEuler)

            const camPos = playerPos.current.clone().add(offset)
            camPos.y += CAMERA_HEIGHT 
            
            // STRICT COPY (No Elasticity)
            camera.position.copy(camPos)
            camera.lookAt(playerPos.current.clone().add(new THREE.Vector3(0, 1.8, 0))) 
        }

        if (onPosUpdate) onPosUpdate(playerPos.current)

        if (updateMyPresence) {
            updateMyPresence({
                position: [playerPos.current.x, playerPos.current.y, playerPos.current.z],
                rotation: rotation.current.yaw,
                pitch: rotation.current.pitch, 
                avatarId: avatarId
            })
        }
    }
  })

  const AvatarComponent = AVATAR_REGISTRY[avatarId] || AVATAR_REGISTRY['human'];

  return (
    <group ref={avatarRef} position={[0,0,0]} raycast={() => null}> 
        <group rotation={[0, Math.PI, 0]}>
            <AvatarComponent pitchRef={pitchRef} />
        </group>
        {isRemote && <mesh position={[0, 2.5, 0]} />}
    </group>
  )
}