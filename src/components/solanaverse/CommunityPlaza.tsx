"use client"
import React, { useRef, useMemo, memo, Suspense } from 'react'
import { useFrame } from '@react-three/fiber'
import { Box, Cylinder, Sphere, Text, MeshReflectorMaterial, Torus, Sparkles, Dodecahedron } from '@react-three/drei'
import { RigidBody, CylinderCollider } from '@react-three/rapier' // <--- IMPORT PHYSICS
import * as THREE from 'three'

function FlowerPlanter({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {/* PHYSICS: Main Box */}
            <RigidBody type="fixed" colliders="cuboid">
                <Box args={[3, 2.5, 3]} position={[0, 1.25, 0]} castShadow><meshStandardMaterial color="#050505" roughness={0.2} /></Box>
            </RigidBody>
            
            {/* VISUALS: Decoration */}
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

function WaterFountain({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {/* PHYSICS: Base (Hull collider fits the cylinder shape automatically) */}
            <RigidBody type="fixed" colliders="hull">
                <Cylinder args={[6, 7, 2, 8]} position={[0, 1, 0]}><meshStandardMaterial color="#333" roughness={0.4} /></Cylinder>
            </RigidBody>

            {/* VISUALS: Upper tiers */}
            <Cylinder args={[4, 4, 1, 8]} position={[0, 2.5, 0]}><meshStandardMaterial color="#1a1a1a" roughness={0.4} /></Cylinder>
            <Cylinder args={[2, 2, 4, 8]} position={[0, 4, 0]}><meshStandardMaterial color="#333" roughness={0.4} /></Cylinder>
            <Cylinder args={[5.5, 5.5, 0.5, 8]} position={[0, 1.8, 0]}><meshStandardMaterial color="#00BFFF" opacity={0.8} transparent /></Cylinder>
            <Sparkles count={150} scale={[6, 12, 6]} size={4} speed={0.8} opacity={0.5} color="#00BFFF" position={[0, 6, 0]} />
            <pointLight position={[0, 5, 0]} intensity={20} color="#00BFFF" distance={15} />
        </group>
    )
}

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

function RestrictedPortal({ position, rotation, label, color, type }: any) {
    const ringRef = useRef<THREE.Group>(null);
    useFrame((state, delta) => { 
        if (type !== 'panda' && ringRef.current) {
            ringRef.current.rotation.z -= delta * 0.8; 
        }
    })
    return (
        <group position={position} rotation={rotation}>
            {/* PHYSICS: Pillars & Header */}
            <RigidBody type="fixed" colliders="cuboid">
                <group position={[0, 7, 0]}>
                    <Box args={[2, 14, 2]} position={[-5, 0, 0]}><meshStandardMaterial color="#1a1a1a" /></Box>
                    <Box args={[2, 14, 2]} position={[5, 0, 0]}><meshStandardMaterial color="#1a1a1a" /></Box>
                    <Box args={[12, 2, 2]} position={[0, 7, 0]}><meshStandardMaterial color="#1a1a1a" /></Box>
                </group>
            </RigidBody>

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

const CommunityPlaza = memo(({ position }: { position: [number, number, number] }) => {
    return (
        <group position={position}>
            {/* PHYSICS: Floor Collider (Invisible Disc) */}
            <RigidBody type="fixed" colliders={false}>
                <CylinderCollider args={[0.5, 40]} position={[0, -0.65, 0]} />
                
                {/* Visual Floor Mesh (No collision on mesh itself to keep it simple) */}
                <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.15, 0]}>
                    <circleGeometry args={[40, 32]} />
                    <MeshReflectorMaterial blur={[0, 0]} resolution={512} mixBlur={0} mixStrength={10} roughness={0.8} depthScale={0} minDepthThreshold={0.9} maxDepthThreshold={1} color="#2a2a2a" metalness={0.2} mirror={0.2} />
                </mesh>
            </RigidBody>

            <WaterFountain position={[0, 0, 0]} />
            <RestrictedPortal position={[0, 0, -30]} rotation={[0, 0, 0]} label="SENSEI DOJO" color="#FDB813" type="panda" />
            <RestrictedPortal position={[0, 0, 30]} rotation={[0, Math.PI, 0]} label="GECKO GARAGE" color="#00FF00" type="gecko" />
            <FlowerPlanter position={[20, 0, 20]} />
            <FlowerPlanter position={[-20, 0, 20]} />
            <FlowerPlanter position={[20, 0, -20]} />
            <FlowerPlanter position={[-20, 0, -20]} />
        </group>
    )
});

export default CommunityPlaza;