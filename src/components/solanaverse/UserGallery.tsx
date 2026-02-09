"use client"
import React, { Suspense } from 'react'
import { Text, Torus } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import MainHall from './MainHall'

// Needs to match the logic in Scene.tsx CollisionManager
const EXIT_PORTAL_Z = 30; 

interface UserGalleryProps {
    items: any[];
    title: string;
}

export default function UserGallery({ items, title }: UserGalleryProps) {
    return (
        <group>
            <MainHall items={items} title={title || "USER GALLERY"} variant="gallery" />
            
            {/* Physics Floor for Gallery */}
            <RigidBody type="fixed" colliders={false}>
                <CuboidCollider args={[50, 0.5, 50]} position={[0, -0.5, 0]} />
            </RigidBody>

            {/* Exit Portal Visuals */}
            <group position={[0, 0, EXIT_PORTAL_Z]} rotation={[0, Math.PI, 0]}>
                <Torus args={[4.5, 0.3, 16, 32]}><meshBasicMaterial color="#ef4444" /></Torus>
                <Suspense fallback={null}>
                    <Text position={[0, 5, 0]} fontSize={1.5} color="#FFD700" anchorX="center">RETURN TO HALL</Text>
                </Suspense>
            </group>

            {/* Lighting specific to Gallery */}
            <ambientLight intensity={0.5} color="#cddeff" />
            <directionalLight position={[100, 150, 50]} intensity={3} color="#ffebc2" castShadow shadow-mapSize={[2048, 2048]} />
        </group>
    )
}