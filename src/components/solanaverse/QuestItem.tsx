"use client"
import React, { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box, Float, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

interface QuestItemProps {
  id: string;
  position: [number, number, number];
  isCollected: boolean;
  onCollect: (id: string) => void;
  playerPos: THREE.Vector3;
}

export default function QuestItem({ id, position, isCollected, onCollect, playerPos }: QuestItemProps) {
  const meshRef = useRef<THREE.Group>(null);
  const collectedInternal = useRef(false);

  useFrame((state, delta) => {
    // If visible (not collected yet), check distance
    if (!isCollected && !collectedInternal.current && playerPos && meshRef.current) {
        
        const itemPos = new THREE.Vector3(...position);
        if (itemPos.distanceTo(playerPos) < 2.5) {
            // 1. Lock internal state so we don't fire twice
            collectedInternal.current = true;

            // 2. Hide immediately (0ms visual latency)
            meshRef.current.visible = false;

            // 3. Trigger React update on next cycle (prevents frame drop)
            setTimeout(() => {
                onCollect(id);
            }, 10);
        }

        // Animation
        meshRef.current.rotation.y += delta * 2;
    }
  });

  return (
    // We toggle visibility instead of returning null to avoid heavy "unmount" costs
    <group ref={meshRef} position={position} visible={!isCollected}>
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            <Box args={[0.8, 0.8, 0.1]}>
                <meshStandardMaterial color="#FFD700" metalness={1} roughness={0.1} emissive="#FFD700" emissiveIntensity={0.2} />
            </Box>
            <Box args={[0.5, 0.3, 0.12]} position={[0, 0.25, 0]}>
                <meshStandardMaterial color="#111" />
            </Box>
            <Sparkles count={20} scale={2} size={4} speed={0.4} opacity={1} color="#FFFF00" />
        </Float>
        <pointLight distance={3} intensity={2} color="yellow" />
    </group>
  )
}