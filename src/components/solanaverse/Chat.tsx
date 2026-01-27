"use client"
import { useState, useEffect, useRef } from 'react'
import { useStorage, useMutation, useMyPresence } from '@/liveblocks.config'
import { LiveObject } from '@liveblocks/client'

export default function Chat() {
  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  
  // 1. Get Chat History from Storage
  // Returns null initially while loading
  const messages = useStorage((root) => root.messages)

  // 2. Get My User Info (for the sender tag)
  const [myPresence] = useMyPresence()

  // 3. Send Message Action
  const sendMessage = useMutation(({ storage }, text: string) => {
    if(!text.trim()) return;
    
    const msg = new LiveObject({
        sender: myPresence.wallet?.slice(0,4) || "Guest", // Fallback name
        text: text,
        timestamp: Date.now(),
        avatarId: myPresence.avatarId || 'human'
    })

    // If storage isn't initialized yet, ignore (rare race condition)
    if (storage.get("messages")) {
        storage.get("messages").push(msg)
    }
  }, [myPresence])

  // 4. Handle Submit
  const handleSend = (e: React.FormEvent) => {
      e.preventDefault()
      sendMessage(draft)
      setDraft("")
  }

  // 5. Auto-Scroll to bottom when new message arrives
  useEffect(() => {
      if(scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
  }, [messages])

  // 6. Stop arrow keys from moving player while typing!
  const stopPropagation = (e: React.KeyboardEvent) => {
      e.stopPropagation()
  }

  if (!messages) return null; // Still loading

  return (
    <div className="pointer-events-auto w-80 flex flex-col gap-2">
        {/* MESSAGES AREA */}
        <div 
            ref={scrollRef}
            className="h-48 overflow-y-auto bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-3 flex flex-col gap-2 shadow-xl mask-image-linear-to-t"
        >
            {messages.map((msg, i) => (
                <div key={msg.timestamp + i} className="text-xs break-words">
                    <span className={`font-bold uppercase mr-2 ${msg.sender === (myPresence.wallet?.slice(0,4) || "Guest") ? 'text-yellow-400' : 'text-purple-400'}`}>
                        {msg.sender}:
                    </span>
                    <span className="text-gray-200 shadow-black drop-shadow-sm">{msg.text}</span>
                </div>
            ))}
            {messages.length === 0 && (
                <div className="text-gray-500 text-[10px] italic text-center mt-10">
                    No messages yet. Say hello!
                </div>
            )}
        </div>

        {/* INPUT AREA */}
        <form onSubmit={handleSend} className="flex gap-2">
            <input 
                type="text" 
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={stopPropagation} // Critical for game controls
                placeholder="Press Enter to chat..."
                className="flex-1 bg-black/80 border border-white/20 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-purple-500 transition-colors"
            />
            <button 
                type="submit" 
                disabled={!draft.trim()}
                className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg px-3 font-bold text-xs transition-colors"
            >
                ➤
            </button>
        </form>
    </div>
  )
}