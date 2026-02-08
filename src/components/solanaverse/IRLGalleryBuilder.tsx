"use client"
import { useState, useEffect, useMemo } from 'react'
import Image from 'next/image'
import { useConnection } from '@solana/wallet-adapter-react'
import irlHashlist from '@/data/irlart_hashlist.json' 

// --- CONFIGURATION ---
const POSITIONS = [
  { id: 'left-outer', label: 'Far Left', icon: '👈' },
  { id: 'left-inner', label: 'Mid Left', icon: 'QD' },
  { id: 'center', label: 'Center Feature', icon: '👑' },
  { id: 'right-inner', label: 'Mid Right', icon: 'QE' },
  { id: 'right-outer', label: 'Far Right', icon: '👉' },
] as const;

type PositionKey = typeof POSITIONS[number]['id'];

interface IRLItem {
  position: string;
  name: string;
  image: string;
  price: string;
  isSold: boolean;
  link: string;
  nftMint?: string; // Added field
}

interface CatalogItem {
    id: string;
    name: string;
    image: string;
    loading: boolean;
}

interface Props {
  myNfts: any[];
  onClose: () => void;
}

export default function IRLGalleryBuilder({ myNfts, onClose }: Props) {
  const { connection } = useConnection();
  const [items, setItems] = useState<Record<string, IRLItem>>({});
  const [selectedPos, setSelectedPos] = useState<PositionKey>('center');
  const [isSaving, setIsSaving] = useState(false);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  // --- FETCH METADATA ---
  useEffect(() => {
      const loadCatalog = async () => {
          const initialItems = (irlHashlist as string[]).map(mint => ({
              id: mint,
              name: 'Loading...',
              image: '/ntwrk-logo.png',
              loading: true
          }));
          setCatalogItems(initialItems);

          const updatedItems = await Promise.all(initialItems.map(async (item) => {
              try {
                  const response = await fetch(connection.rpcEndpoint, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                          jsonrpc: '2.0',
                          id: 'my-id',
                          method: 'getAsset',
                          params: { id: item.id }
                      })
                  });
                  
                  const { result } = await response.json();
                  
                  if (result && result.content) {
                      let imageUrl = result.content.links?.image;
                      if (result.content.files?.length > 0) {
                          const png = result.content.files.find((f: any) => f.mime === 'image/png');
                          if (png) imageUrl = png.uri || png.cdn_uri;
                      }

                      return {
                          id: item.id,
                          name: result.content.metadata?.name || 'Unknown Art',
                          image: imageUrl || item.image,
                          loading: false
                      };
                  }
              } catch (e) {
                  console.warn(`Failed to fetch metadata for ${item.id}`, e);
              }
              return { ...item, name: `Mint: ${item.id.slice(0, 6)}...`, loading: false };
          }));

          setCatalogItems(updatedItems);
      };

      if (irlHashlist.length > 0) {
          loadCatalog();
      }
  }, [connection.rpcEndpoint]);

  // Load existing data
  useEffect(() => {
    fetch('/api/admin/irl-gallery')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.items) {
          const map: any = {};
          data.items.forEach((item: any) => map[item.position] = item);
          setItems(map);
        }
      });
  }, []);

  const currentItem = items[selectedPos] || {
    position: selectedPos,
    name: '',
    image: '',
    price: '',
    isSold: false,
    link: '',
    nftMint: ''
  };

  const updateCurrent = (field: keyof IRLItem, value: any) => {
    setItems(prev => ({
      ...prev,
      [selectedPos]: { ...prev[selectedPos], [field]: value, position: selectedPos }
    }));
  };

  const handleSelectFromCatalog = (item: CatalogItem) => {
    updateCurrent('name', item.name);
    updateCurrent('image', item.image);
    updateCurrent('nftMint', item.id); // Save the Mint ID
    setShowWalletSelector(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = items[selectedPos];
      if (!payload || !payload.image) {
          alert("Please add an image first.");
          setIsSaving(false);
          return;
      }

      const res = await fetch('/api/admin/irl-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) alert("Stand Updated Successfully! 🏛️");
      else alert("Failed to save.");
      
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
      <div className="bg-[#111] border border-[#DAA520]/30 w-full max-w-6xl h-[90vh] rounded-3xl flex overflow-hidden shadow-2xl">
        
        <div className="w-1/4 bg-[#0a0a0a] border-r border-white/10 p-6 flex flex-col gap-4 overflow-y-auto">
          <h2 className="text-[#DAA520] font-black uppercase tracking-widest text-xl mb-6">Curate Showroom</h2>
          <div className="flex flex-col gap-3">
            {POSITIONS.map((pos) => (
                <button
                key={pos.id}
                onClick={() => setSelectedPos(pos.id)}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 group ${
                    selectedPos === pos.id 
                    ? 'border-[#DAA520] bg-[#DAA520]/10' 
                    : 'border-white/10 hover:border-white/30 bg-black'
                }`}
                >
                <div className="w-10 h-10 rounded-full bg-[#1a1a1a] flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                    {pos.icon}
                </div>
                <span className="font-bold uppercase text-[10px] tracking-widest text-gray-400 group-hover:text-white">
                    {pos.label}
                </span>
                {items[pos.id]?.image && <span className="text-[9px] text-green-500 font-mono">● Active</span>}
                </button>
            ))}
          </div>
          <div className="mt-auto pt-6">
             <button onClick={onClose} className="w-full py-4 text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest border border-white/10 rounded-xl hover:bg-white/5 transition-all">
                Exit Builder
             </button>
          </div>
        </div>

        <div className="flex-1 p-8 bg-grid-pattern relative flex flex-col">
            <div className="flex-1 flex gap-8 items-start">
                <div className="w-1/3 aspect-[3/4] bg-black border-4 border-[#DAA520] rounded-lg shadow-2xl relative overflow-hidden group">
                    {currentItem.image ? (
                        <img src={currentItem.image} className={`w-full h-full object-cover ${currentItem.isSold ? 'grayscale opacity-50' : ''}`} />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-700 text-xs uppercase font-bold">No Art Selected</div>
                    )}
                    {currentItem.isSold && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="bg-red-600 text-white font-black text-2xl px-6 py-2 -rotate-12 border-4 border-white shadow-xl">SOLD</div>
                        </div>
                    )}
                </div>

                <div className="flex-1 space-y-6 max-w-lg">
                    <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-black text-white uppercase">{POSITIONS.find(p => p.id === selectedPos)?.label}</h3>
                        <button 
                            onClick={() => setShowWalletSelector(true)}
                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest shadow-lg shadow-purple-900/20"
                        >
                            Select from Catalog
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Title</label>
                            <input 
                                value={currentItem.name} 
                                onChange={(e) => updateCurrent('name', e.target.value)}
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded p-3 text-white text-sm focus:border-[#DAA520] outline-none"
                                placeholder="Artwork Title"
                            />
                        </div>
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Price (Manual Override)</label>
                                <input 
                                    value={currentItem.price || ''} 
                                    onChange={(e) => updateCurrent('price', e.target.value)}
                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded p-3 text-white text-sm focus:border-[#DAA520] outline-none"
                                    placeholder="e.g. 50 SOL"
                                />
                            </div>
                            <div className="flex items-end pb-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={currentItem.isSold} 
                                        onChange={(e) => updateCurrent('isSold', e.target.checked)}
                                        className="w-5 h-5 accent-red-500"
                                    />
                                    <span className="text-xs font-bold text-red-400 uppercase">Mark as Sold</span>
                                </label>
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Marketplace Link</label>
                            <input 
                                value={currentItem.link || ''} 
                                onChange={(e) => updateCurrent('link', e.target.value)}
                                className="w-full bg-[#1a1a1a] border border-white/10 rounded p-3 text-white focus:border-[#DAA520] outline-none font-mono text-xs"
                                placeholder="https://magiceden.io/..."
                            />
                        </div>
                        {currentItem.nftMint && (
                            <div className="text-[9px] text-gray-600 font-mono">
                                Mint ID Linked: {currentItem.nftMint}
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        className="w-full py-4 bg-[#DAA520] hover:bg-[#b8860b] text-black font-black uppercase tracking-widest rounded-xl transition-all mt-8 shadow-xl shadow-[#DAA520]/10"
                    >
                        {isSaving ? 'Saving Stand...' : 'Save Updates'}
                    </button>
                </div>
            </div>
        </div>

        {showWalletSelector && (
            <div className="absolute inset-0 bg-black/90 z-20 flex flex-col p-8 animate-in fade-in">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h3 className="text-white font-bold uppercase">Official Collection Catalog</h3>
                        <p className="text-[10px] text-gray-500">Fetched from {irlHashlist.length} Whitelisted Hashes</p>
                    </div>
                    <button onClick={() => setShowWalletSelector(false)} className="text-gray-500 hover:text-white">Close</button>
                </div>
                {catalogItems.length > 0 ? (
                    <div className="grid grid-cols-4 md:grid-cols-6 gap-4 overflow-y-auto">
                        {catalogItems.map((item, idx) => (
                            <div key={item.id + idx} onClick={() => !item.loading && handleSelectFromCatalog(item)} className={`aspect-square bg-[#1a1a1a] rounded-lg overflow-hidden cursor-pointer hover:border-2 border-[#DAA520] group relative ${item.loading ? 'animate-pulse' : ''}`}>
                                <img src={item.image} className="w-full h-full object-cover" />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2 text-[9px] text-center text-white opacity-0 group-hover:opacity-100 transition-opacity truncate">
                                    {item.loading ? 'Fetching...' : item.name}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                        <p className="text-sm font-bold uppercase mb-2">Initializing...</p>
                        <p className="text-xs">Connecting to RPC to fetch metadata.</p>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  )
}