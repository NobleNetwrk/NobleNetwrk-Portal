"use client"
import { useTexture, Box, Text } from '@react-three/drei'
import { useState } from 'react'

interface VoxelFrameProps {
  position: [number, number, number]
  imageUrl: string
}

export default function VoxelFrame({ position, imageUrl }: VoxelFrameProps) {
  const [hovered, setHovered] = useState(false)
  
  // Placeholder image while loading or if metadata is complex
  const texture = useTexture(imageUrl || '/placeholder-nft.png')

  return (
    <group position={position} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Voxel Frame Structure */}
      <Box args={[4, 4, 0.5]} castShadow>
        <meshStandardMaterial color={hovered ? "#444" : "#222"} />
      </Box>

      {/* The Actual NFT Art */}
      <mesh position={[0, 0, 0.26]}>
        <planeGeometry args={[3.5, 3.5]} />
        <meshStandardMaterial map={texture} />
      </mesh>

      {/* Hover Info Label */}
      {hovered && (
        <Text
          position={[0, 2.5, 0]}
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          Noble NFT Asset
        </Text>
      )}
    </group>
  )
}