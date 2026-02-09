"use client"
import React, { useState, useEffect } from 'react'
import { Box, Cylinder, MeshReflectorMaterial, Text, Float, Sphere } from '@react-three/drei'
import { RigidBody, CuboidCollider } from '@react-three/rapier' // <--- IMPORT PHYSICS
import * as THREE from 'three'

// --- TEXTURE LOADER COMPONENT ---
function SafeImageMaterial({ url }: { url: string }) {
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
    return <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />;
}

export default function SenseiDojo({ onExit }: { onExit: () => void }) {
  
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
      {/* --- ATMOSPHERE --- */}
      <color attach="background" args={['#87CEEB']} />
      <ambientLight intensity={0.5} color="#ffd700" />
      <pointLight position={[0, 30, 0]} intensity={100} color="#ffaa00" distance={60} />

      {/* --- FLOOR (Tatami/Wood Style) --- */}
      <RigidBody type="fixed" colliders="cuboid">
          {/* Visual Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
            <planeGeometry args={[60, 60]} />
            {/* CONDITIONAL RENDERING: Standard on Mobile, Reflector on Desktop */}
            {isMobile ? (
                <meshStandardMaterial color="#d2b48c" roughness={0.8} metalness={0.1} />
            ) : (
                <MeshReflectorMaterial
                  blur={[300, 100]}
                  resolution={1024}
                  mixBlur={1}
                  mixStrength={15}
                  roughness={0.8}
                  depthScale={1.2}
                  minDepthThreshold={0.4}
                  maxDepthThreshold={1.4}
                  color="#d2b48c"
                  metalness={0.1}
                  mirror={0.5} 
                />
            )}
          </mesh>
          {/* Physics Floor */}
          <CuboidCollider args={[30, 0.5, 30]} position={[0, -0.6, 0]} />
      </RigidBody>

      {/* --- BAMBOO PILLARS --- */}
      {[...Array(8)].map((_, i) => (
          <group key={i} position={[20 * Math.cos(i), 10, 20 * Math.sin(i)]}>
              <RigidBody type="fixed" colliders="hull">
                  <Cylinder args={[0.8, 0.8, 20, 8]}><meshStandardMaterial color="#556b2f" /></Cylinder>
                  {[...Array(5)].map((_, j) => (
                      <Cylinder key={j} args={[0.9, 0.9, 0.5, 8]} position={[0, -8 + (j*4), 0]}><meshStandardMaterial color="#334411" /></Cylinder>
                  ))}
              </RigidBody>
          </group>
      ))}

      {/* --- DOJO ROOF/WALLS --- */}
      <RigidBody type="fixed" colliders="cuboid">
        <Box args={[60, 10, 2]} position={[0, 5, -25]}><meshStandardMaterial color="#8b4513" /></Box>
      </RigidBody>
      
      {/* --- FLOATING LANTERNS --- */}
      {/* Visual only, high above head */}
      <Float speed={1} rotationIntensity={0.2} floatIntensity={0.5}>
        <group position={[-10, 8, -10]}>
            <Sphere args={[1.5, 16, 16]}><meshStandardMaterial color="#ff4500" emissive="#ff4500" emissiveIntensity={1} /></Sphere>
        </group>
        <group position={[10, 8, -10]}>
            <Sphere args={[1.5, 16, 16]}><meshStandardMaterial color="#ff4500" emissive="#ff4500" emissiveIntensity={1} /></Sphere>
        </group>
      </Float>

      {/* --- TITLE --- */}
      <Text position={[0, 14, -22]} fontSize={5} color="#FFD700" font="/ROMEO.TTF" anchorX="center" anchorY="middle">
        SENSEI DOJO
      </Text>

      {/* --- SOLANA SENSEI IMAGE (Center Wall) --- */}
      <RigidBody type="fixed" colliders="hull">
          <group position={[0, 6, -23.8]}>
              {/* Gold Frame */}
              <Box args={[12, 12, 0.5]} position={[0, 0, 0]}>
                  <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
              </Box>
              {/* Image Plane */}
              <mesh position={[0, 0, 0.26]}>
                  <planeGeometry args={[10.5, 10.5]} />
                  <SafeImageMaterial url="/SolanaSensei.jpg" />
              </mesh>
          </group>
      </RigidBody>

      {/* --- EXIT PORTAL --- */}
      <RigidBody type="fixed" colliders="hull">
          <group position={[0, 0, 25]} onClick={onExit}>
            <Cylinder args={[3, 3, 0.5, 32]} rotation={[Math.PI/2, 0, 0]} position={[0, 5, 0]}>
                <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
            </Cylinder>
            <Text position={[0, 8, 0]} fontSize={1} color="white">EXIT TO HALL</Text>
          </group>
      </RigidBody>
    </group>
  )
}