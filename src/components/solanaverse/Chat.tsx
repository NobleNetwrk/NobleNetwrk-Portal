"use client"
import { useState, useEffect, useRef } from 'react'
import { useStorage, useMutation, useMyPresence } from '@/liveblocks.config'
import { LiveObject } from '@liveblocks/client'

export default function Chat() {
  const [draft, setDraft] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const messages = useStorage((root) => root.messages)
  const [myPresence] = useMyPresence()

  const sendMessage = useMutation(({ storage }, text: string) => {
    if(!text.trim()) return;
    
    // PRIORITY: Database Username -> Wallet Address -> Guest
    const senderName = myPresence.username || myPresence.wallet?.slice(0,4) || "Guest";

    const msg = new LiveObject({
        sender: senderName, 
        text: text,
        timestamp: Date.now(),
        avatarId: myPresence.avatarId || 'human'
    })

    if (storage.get("messages")) {
        storage.get("messages").push(msg)
    }
  }, [myPresence])

  const handleSend = (e: React.FormEvent) => {
      e.preventDefault()
      sendMessage(draft)
      setDraft("")
  }

  useEffect(() => {
      if(scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
  }, [messages])

  const stopPropagation = (e: React.KeyboardEvent) => {
      e.stopPropagation()
  }

  if (!messages) return null;

  return (
    <div className="pointer-events-auto w-80 flex flex-col gap-2">
        <div 
            ref={scrollRef}
            className="h-48 overflow-y-auto bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-3 flex flex-col gap-2 shadow-xl mask-image-linear-to-t"
        >
            {messages.map((msg, i) => (
                <div key={msg.timestamp + i} className="text-xs break-words">
                    <span className={`font-bold uppercase mr-2 ${msg.sender === (myPresence.username || myPresence.wallet?.slice(0,4) || "Guest") ? 'text-yellow-400' : 'text-purple-400'}`}>
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

        <form onSubmit={handleSend} className="flex gap-2">
            <input 
                type="text" 
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={stopPropagation}
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