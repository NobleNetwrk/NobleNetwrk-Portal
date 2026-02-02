// src/components/SpatialAudio.tsx
import { useEffect, useState, useRef } from "react";
import AgoraRTC, { 
  IAgoraRTCClient, 
  IMicrophoneAudioTrack,
  IRemoteAudioTrack 
} from "agora-rtc-sdk-ng";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMyPresence, useOthers } from "@/liveblocks.config";

// FIX 1: Use Environment Variable
const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID || ""; 
const CHANNEL = "solanaverse-hall";

export default function SpatialAudio() {
  // Use a ref for client to prevent recreation, though useState lazy init is also fine.
  // We keep useState here to match your previous pattern which works.
  const [client] = useState<IAgoraRTCClient>(() => 
    AgoraRTC.createClient({ mode: "rtc", codec: "vp8" })
  );
  
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<Record<string, IRemoteAudioTrack>>({});
  
  // We don't use the 'myPresence' variable, just the updater
  const [, updateMyPresence] = useMyPresence();
  const others = useOthers();
  const { camera } = useThree();

  useEffect(() => {
    if (!APP_ID) {
        console.error("Agora App ID is missing in .env.local");
        return;
    }

    let mounted = true;

    const init = async () => {
      try {
        const uid = await client.join(APP_ID, CHANNEL, null, null);
        
        if (mounted) updateMyPresence({ voiceId: uid.toString() } as any);

        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        if (mounted) {
            setLocalAudioTrack(audioTrack);
            await client.publish(audioTrack);
        }

        client.on("user-published", async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === "audio") {
            if (mounted) {
                setRemoteUsers((prev) => ({ ...prev, [user.uid]: user.audioTrack! }));
            }
            user.audioTrack?.play();
          }
        });

        client.on("user-unpublished", (user) => {
          if (mounted) {
              setRemoteUsers((prev) => {
                const newUsers = { ...prev };
                delete newUsers[user.uid];
                return newUsers;
              });
          }
        });

      } catch (error) {
        console.error("Voice Chat Error:", error);
      }
    };

    init();

    return () => {
      mounted = false;
      localAudioTrack?.close();
      client.leave();
    };
  }, []); // client and updateMyPresence are stable

  useFrame(() => {
    const listenerPos = camera.position;

    others.forEach((other) => {
      const voiceId = other.presence.voiceId;
      const remotePos = other.presence.position; 
      
      if (voiceId && remoteUsers[voiceId] && remotePos) {
        // FIX 2: Access array indices [0], [1], [2] instead of .x, .y, .z
        // Liveblocks stores position as [x, y, z] tuple
        const dist = listenerPos.distanceTo(
            new THREE.Vector3(remotePos[0], remotePos[1], remotePos[2])
        );
        
        // Volume Dropoff Logic
        let volume = 0;
        if (dist < 50) {
            volume = 1 - (dist / 50);
        }
        
        remoteUsers[voiceId].setVolume(Math.floor(volume * 100));
      }
    });
  });

  return null;
}