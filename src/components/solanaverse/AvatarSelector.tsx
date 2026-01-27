"use client"
import { useState, useEffect } from 'react'

interface AvatarSelectorProps {
  onClose: () => void;
  onSelect: (id: string) => void;
  currentAvatar: string;
  myNfts: any[]; 
  walletAddress: string; 
}

export default function AvatarSelector({ onClose, onSelect, currentAvatar, myNfts, walletAddress }: AvatarSelectorProps) {
  const [view, setView] = useState<'SELECT' | 'REQUEST'>('SELECT')
  const [selectedNftForRequest, setSelectedNftForRequest] = useState<string | null>(null)
  
  const [availableAvatars, setAvailableAvatars] = useState([
    { id: 'human', name: 'Default Human', color: 'bg-[#F5CCA2]' },
    { id: 'alien', name: 'Alien Scout', color: 'bg-[#88FF88]' },
    { id: 'panda_3120', name: 'Golden King Panda', color: 'bg-[#FFD700]' } // Custom pre-loaded
  ])

  // 1. FETCH UNLOCKED AVATARS ON MOUNT
  useEffect(() => {
    async function fetchUnlocked() {
      try {
        const res = await fetch(`/api/user/profile?wallet=${walletAddress}`)
        const data = await res.json()
        
        // Define all possible avatars so we can display names properly
        const ALL_POSSIBLE = [
             { id: 'human', name: 'Default Human', color: 'bg-[#F5CCA2]' },
             { id: 'alien', name: 'Alien Scout', color: 'bg-[#88FF88]' },
             { id: 'panda_3120', name: 'Golden King Panda', color: 'bg-[#FFD700]' }
        ];

        if (data.unlocked) {
            const unlockedList = data.unlocked.map((id: string) => {
                const known = ALL_POSSIBLE.find(a => a.id === id);
                // If we don't know the name, show ID with a generic color
                return known || { id, name: `Custom (${id})`, color: 'bg-purple-500' };
            });
            
            // Merge defaults (everyone has human/alien) with unlocked list
            const defaults = ALL_POSSIBLE.slice(0, 2);
            const final = [...defaults];
            
            unlockedList.forEach((u: any) => {
                if (!final.find(f => f.id === u.id)) final.push(u);
            });
            
            setAvailableAvatars(final);
        }
      } catch (e) {
        console.error("Failed to load avatars", e);
      }
    }
    if (walletAddress) fetchUnlocked();
  }, [walletAddress]);

  // 2. SUBMIT REQUEST TO API
  const handleRequestSubmit = async () => {
    if(!selectedNftForRequest) return;
    
    const nft = myNfts.find(n => n.id === selectedNftForRequest);
    if (!nft) return;

    try {
        await fetch('/api/avatar/request', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                wallet: walletAddress,
                nftId: nft.id,
                nftName: nft.name,
                nftImage: nft.image
            })
        });
        alert("Request Sent! The developer will craft this avatar manually when possible.");
        setView('SELECT');
    } catch(e) {
        alert("Failed to send request. Please try again.");
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-white/20 w-full max-w-2xl rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
          <h2 className="text-2xl font-black text-white uppercase italic">
            {view === 'SELECT' ? 'Choose Your Avatar' : 'Request Custom Avatar'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {/* CONTENT */}
        <div className="p-6">
          {view === 'SELECT' ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                {availableAvatars.map(av => (
                  <button
                    key={av.id}
                    onClick={() => onSelect(av.id)}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-3 transition-all ${
                      currentAvatar === av.id 
                        ? 'border-purple-500 bg-purple-500/20' 
                        : 'border-white/10 bg-white/5 hover:border-white/30'
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-full ${av.color} shadow-lg`} />
                    <span className="text-white font-bold text-sm uppercase">{av.name}</span>
                    {currentAvatar === av.id && <span className="text-[10px] text-purple-400">EQUIPPED</span>}
                  </button>
                ))}
              </div>

              <div className="border-t border-white/10 pt-6">
                <p className="text-gray-400 text-sm mb-3">Want to play as one of your NFTs?</p>
                <button 
                  onClick={() => setView('REQUEST')}
                  className="w-full py-3 bg-white/5 border border-white/10 rounded-lg text-white font-bold hover:bg-white/10 transition-all uppercase text-xs tracking-widest"
                >
                  Request Custom Avatar Generation
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col h-[50vh]">
              <p className="text-gray-400 text-sm mb-4">
                Select an NFT from your wallet. We will manually voxelize it for you (ETA: TBD).
              </p>
              
              <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                <div className="grid grid-cols-3 gap-3 pb-4">
                    {myNfts.map((nft: any) => (
                    <div 
                        key={nft.id}
                        onClick={() => setSelectedNftForRequest(nft.id)}
                        style={{ aspectRatio: '1/1' }}
                        className={`relative w-full rounded-lg overflow-hidden cursor-pointer border-2 ${
                            selectedNftForRequest === nft.id ? 'border-yellow-500' : 'border-transparent'
                        }`}
                    >
                        <img src={nft.image} className="w-full h-full object-cover" alt={nft.name} />
                    </div>
                    ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
                <button onClick={() => setView('SELECT')} className="flex-1 py-3 text-gray-400 hover:text-white font-bold text-xs uppercase">Cancel</button>
                <button 
                    onClick={handleRequestSubmit}
                    disabled={!selectedNftForRequest}
                    className="flex-1 py-3 bg-yellow-600 text-white font-bold rounded-lg hover:bg-yellow-500 disabled:opacity-50 text-xs uppercase"
                >
                    Submit Request
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}