"use client"
import React, { useRef, useState, useEffect } from 'react'
import { useTexture, Box, Cylinder, Sphere, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ArcadeProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  onInteract: () => void;
  playerPos: THREE.Vector3;
}

export default function ArcadeCabinet({ position, rotation = [0, 0, 0], onInteract, playerPos }: ArcadeProps) {
  const [hovered, setHover] = useState(false)
  const [isClose, setIsClose] = useState(false)
  const groupRef = useRef<THREE.Group>(null)
  
  // Load textures
  const textures = useTexture({
    screen: '/PortalHunter.png',
    sideLeft: '/TTC.jpg',
    sideRight: '/PB.png',
  })

  Object.values(textures).forEach(t => {
    t.colorSpace = THREE.SRGBColorSpace;
  });

  // --- FIX: DYNAMIC DISTANCE CHECK ---
  // This calculates the cabinet's REAL world position, handling nested groups correctly.
  useFrame(() => {
    if (groupRef.current && playerPos) {
        const worldPos = new THREE.Vector3();
        groupRef.current.getWorldPosition(worldPos); // Get true position in the world
        const distance = worldPos.distanceTo(playerPos);
        setIsClose(distance < 6); // Trigger range
    }
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isClose && (e.key === 'e' || e.key === 'E')) onInteract();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isClose, onInteract]);

  return (
    <group 
        ref={groupRef} 
        position={position} 
        rotation={rotation as any}
        onClick={(e) => {
            e.stopPropagation();
            if (isClose) onInteract();
        }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
    >
      <group rotation={[0, Math.PI, 0]}> 
        
        {/* --- MAIN CABINET BODY --- */}
        <Box args={[3.2, 2, 3]} position={[0, 1, 0]}>
            <meshStandardMaterial color="#111" roughness={0.2} metalness={0.5} />
        </Box>

        <Box args={[3.2, 4, 2.5]} position={[0, 4, -0.25]}>
            <meshStandardMaterial color="#1a1a1a" roughness={0.2} />
        </Box>

        {/* --- SIDE ART PANELS --- */}
        
        {/* Left Side Art (TTC.jpg) */}
        <mesh position={[-1.72, 4, -0.25]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[2.5, 4]} />
            <meshBasicMaterial map={textures.sideLeft} toneMapped={false} />
        </mesh>

        {/* Right Side Art (PB.png) */}
        <mesh position={[1.72, 4, -0.25]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[2.5, 4]} />
            <meshBasicMaterial map={textures.sideRight} toneMapped={false} />
        </mesh>

        {/* Side Panels (Neon Accents) */}
        <Box args={[0.1, 7, 3.5]} position={[1.66, 3.5, 0]}>
            <meshStandardMaterial color="#000" />
        </Box>
        <Box args={[0.05, 7, 0.1]} position={[1.71, 3.5, 1.7]} >
            <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} />
        </Box>

        <Box args={[0.1, 7, 3.5]} position={[-1.66, 3.5, 0]}>
            <meshStandardMaterial color="#000" />
        </Box>
        <Box args={[0.05, 7, 0.1]} position={[-1.71, 3.5, 1.7]}>
            <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} />
        </Box>

        {/* --- CONTROL DECK --- */}
        <group position={[0, 3.8, 1.5]} rotation={[0.3, 0, 0]}>
            <Box args={[3.2, 0.3, 1.5]}>
                <meshStandardMaterial color="#222" />
            </Box>
            
            <group position={[-0.8, 0.2, 0.3]}>
                <Cylinder args={[0.05, 0.05, 0.6]} position={[0, 0.3, 0]}>
                    <meshStandardMaterial color="#888" metalness={1} />
                </Cylinder>
                <Sphere args={[0.15]} position={[0, 0.6, 0]}>
                    <meshStandardMaterial color="red" roughness={0.1} />
                </Sphere>
                <Cylinder args={[0.3, 0.4, 0.1]} position={[0, 0, 0]}>
                    <meshStandardMaterial color="#111" />
                </Cylinder>
            </group>

            <Cylinder args={[0.12, 0.12, 0.1]} position={[0.4, 0.15, 0.2]}>
                <meshStandardMaterial color="#00BFFF" emissive="#00BFFF" emissiveIntensity={0.5} />
            </Cylinder>
            <Cylinder args={[0.12, 0.12, 0.1]} position={[0.8, 0.15, 0.3]}>
                <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
            </Cylinder>
            <Cylinder args={[0.12, 0.12, 0.1]} position={[1.2, 0.15, 0.2]}>
                <meshStandardMaterial color="#32CD32" emissive="#32CD32" emissiveIntensity={0.5} />
            </Cylinder>
        </group>

        {/* --- SCREEN AREA --- */}
        <group position={[0, 5.2, 0.8]} rotation={[-0.15, 0, 0]}>
            <Box args={[3, 2.5, 0.2]} position={[0, 0, -0.1]}>
                <meshStandardMaterial color="#000" />
            </Box>
            
            {/* SCREEN MESH */}
            <mesh position={[0, 0, 0.25]} rotation={[0.15, 0, 0]}>
                <planeGeometry args={[2.8, 2.2]} />
                <meshBasicMaterial map={textures.screen} toneMapped={false} />
            </mesh>
            
            <Box args={[3, 0.05, 0.05]} position={[0, 1.15, 0.02]}><meshStandardMaterial color="#00ff00" emissive="#00ff00" /></Box>
            <Box args={[3, 0.05, 0.05]} position={[0, -1.15, 0.02]}><meshStandardMaterial color="#00ff00" emissive="#00ff00" /></Box>
        </group>

        {/* --- MARQUEE --- */}
        <group position={[0, 6.8, 1.2]}>
            <Box args={[3.2, 0.8, 1]} position={[0, 0, -0.5]}>
                <meshStandardMaterial color="#111" />
            </Box>
            <Box args={[3, 0.6, 0.1]} position={[0, 0, 0.01]}>
                <meshStandardMaterial color="#000" />
            </Box>
            <Text 
                position={[0, 0, 0.07]} 
                fontSize={0.35} 
                color="#00ff00" 
                anchorX="center" 
                anchorY="middle" 
                font="/ROMEO.TTF" 
                outlineWidth={0.02} 
                outlineColor="#004400"
            >
                PORTAL HUNTERS
            </Text>
        </group>

      </group>

      {isClose && (
        <group position={[0, 8.5, 0]} rotation={[0, Math.PI, 0]}> 
            <Text fontSize={0.5} color="white" anchorX="center" outlineWidth={0.04} outlineColor="black">
                PRESS 'E' TO PLAY
            </Text>
            <Box args={[3.5, 0.8, 0.1]} position={[0, 0, -0.05]}>
                <meshBasicMaterial color="black" opacity={0.6} transparent />
            </Box>
        </group>
      )}
    </group>
  )
}