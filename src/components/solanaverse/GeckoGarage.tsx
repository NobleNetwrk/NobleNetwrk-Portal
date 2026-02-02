"use client"
import React, { useState, useEffect, useMemo } from 'react'
import { Box, Cylinder, MeshReflectorMaterial, Text, Float, Dodecahedron, useGLTF } from '@react-three/drei'
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

// --- NEW: ARMCHAIR MODEL COMPONENT ---
function ArmchairModel(props: any) {
  // Load the model from the public folder
  const { scene } = useGLTF('/GeckoArmchair.glb')
  
  // Clone the scene so we can re-use it multiple times (otherwise only one appears)
  const clone = useMemo(() => {
    const clonedScene = scene.clone()
    // Optional: Enable shadows on the model
    clonedScene.traverse((node: any) => {
        if (node.isMesh) {
            node.castShadow = true;
            node.receiveShadow = true;
        }
    })
    return clonedScene
  }, [scene])

  return <primitive object={clone} {...props} />
}

export default function GeckoGarage({ onExit }: { onExit: () => void }) {
  return (
    <group>
      {/* --- ATMOSPHERE --- */}
      <color attach="background" args={['#050505']} />
      <fog attach="fog" args={['#050505', 10, 50]} />
      <ambientLight intensity={0.2} />
      <pointLight position={[0, 20, 0]} intensity={200} color="#00ff00" distance={40} />

      {/* --- FLOOR (Industrial Grid) --- */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[60, 60]} />
        <MeshReflectorMaterial
          blur={[300, 100]}
          resolution={1024}
          mixBlur={1}
          mixStrength={40}
          roughness={0.6}
          depthScale={1.2}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#1a1a1a"
          metalness={0.8}
          mirror={0.5} 
        />
      </mesh>

      {/* --- WALLS (Cyberpunk Hexagons) --- */}
      <group>
        <Box args={[60, 30, 2]} position={[0, 15, -30]}><meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} /></Box>
        <Box args={[2, 30, 60]} position={[-30, 15, 0]}><meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} /></Box>
        <Box args={[2, 30, 60]} position={[30, 15, 0]}><meshStandardMaterial color="#111" metalness={0.9} roughness={0.1} /></Box>
      </group>

      {/* --- DECOR: FLOATING GECKO CRYSTALS --- */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
        <Dodecahedron args={[3]} position={[-15, 10, -15]}>
            <meshStandardMaterial color="#00ff00" wireframe />
        </Dodecahedron>
      </Float>
      <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1}>
        <Dodecahedron args={[3]} position={[15, 8, -10]}>
            <meshStandardMaterial color="#00ff00" wireframe />
        </Dodecahedron>
      </Float>

      {/* --- CENTERPIECE: THE GARAGE PLATFORM --- */}
      <Cylinder args={[8, 9, 2, 6]} position={[0, 1, 0]}><meshStandardMaterial color="#222" metalness={0.8} /></Cylinder>
      <Cylinder args={[7, 7, 0.5, 32]} position={[0, 2.1, 0]}><meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={2} /></Cylinder>

      {/* --- NEW: LOUNGE AREA (Using your GLB) --- */}
      {/* Chair 1: Left of platform */}
      <ArmchairModel 
        position={[-12, 0, 0]} 
        rotation={[0, Math.PI / 4, 0]} 
        scale={2.5} 
      />
      
      {/* Chair 2: Right of platform */}
      <ArmchairModel 
        position={[12, 0, 0]} 
        rotation={[0, -Math.PI / 4, 0]} 
        scale={2.5} 
      />

      {/* --- TITLE --- */}
      <Text position={[0, 20, -28]} fontSize={4} color="#00ff00" font="/ROMEO.TTF" anchorX="center" anchorY="middle">
        GECKO GARAGE
      </Text>

      {/* --- GECKO IMAGE (Center Wall) --- */}
      <group position={[0, 10, -28.8]}>
          {/* Gold Frame */}
          <Box args={[12, 12, 0.5]} position={[0, 0, 0]}>
              <meshStandardMaterial color="#FFD700" metalness={0.8} roughness={0.2} />
          </Box>
          {/* Image Plane */}
          <mesh position={[0, 0, 0.26]}>
              <planeGeometry args={[10.5, 10.5]} />
              <SafeImageMaterial url="/Gecko.jpg" />
          </mesh>
      </group>

      {/* --- EXIT PORTAL --- */}
      <group position={[0, 0, 25]} onClick={onExit}>
        <Cylinder args={[3, 3, 0.5, 32]} rotation={[Math.PI/2, 0, 0]} position={[0, 5, 0]}>
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
        </Cylinder>
        <Text position={[0, 8, 0]} fontSize={1} color="white">EXIT TO HALL</Text>
      </group>
    </group>
  )
}

// Preload the model to prevent pop-in
useGLTF.preload('/GeckoArmchair.glb')