import { createClient, LiveList, LiveObject } from "@liveblocks/client"; //
import { createRoomContext } from "@liveblocks/react";

const publicApiKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY;

if (!publicApiKey) {
  throw new Error("Liveblocks API key is missing. Add NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY to .env.local");
}

const client = createClient({
  publicApiKey: publicApiKey,
});

// 1. Define Storage Schema
type Storage = {
  messages: LiveList<LiveObject<{
    sender: string;
    text: string;
    timestamp: number;
    avatarId: string;
  }>>;
};

// 2. Define Presence Schema
type Presence = {
  position: [number, number, number];
  rotation: number;
  pitch: number;
  avatarId: string;
  wallet?: string; 
  username?: string;
};

// 3. CRITICAL FIX: Pass 'Storage' to the generics here
export const { 
  RoomProvider, 
  useMyPresence, 
  useOthers, 
  useStorage, 
  useMutation 
} = createRoomContext<Presence, Storage>(client);