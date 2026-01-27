"use client"
import { useState, useMemo, useEffect, useRef } from 'react'

// --- TYPES ---
interface NFT {
  id: string;
  name: string;
  image: string;
  collection: string;
  // Placement Data
  wall?: string; 
  x?: number; 
  y?: number; 
  scale?: number;
  // PROPS
  frameColor?: 'black' | 'gold';
  rotation?: number; 
  tilt?: number;    
  depth?: number; 
}

interface PublicGallery {
  id: string;
  owner: string;
  name: string;
  assetCount: number;
  assets: NFT[];
  isPublic?: boolean;
}

interface GalleryBuilderProps {
  myNfts: NFT[];
  walletAddress: string;
  onClose: () => void;
  existingGallery?: PublicGallery | null;
  targetId?: string; 
}

export default function GalleryBuilder({ myNfts, walletAddress, onClose, existingGallery, targetId }: GalleryBuilderProps) {
  const [step, setStep] = useState<'SELECT' | 'ARRANGE'>('SELECT')
  
  // --- STATE ---
  const [galleryName, setGalleryName] = useState(existingGallery?.name || "")
  const [isPublic, setIsPublic] = useState(existingGallery?.isPublic ?? true)
  
  // Initialize Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [placements, setPlacements] = useState<Record<string, NFT>>({})

  const [activeWall, setActiveWall] = useState<'left' | 'back' | 'right'>('left')
  const [activeItemId, setActiveItemId] = useState<string | null>(null) 
  const [isSaving, setIsSaving] = useState(false)

  // --- 1. MERGE LOGIC ---
  const displayNfts = useMemo(() => {
    const combined = [...myNfts];
    if (existingGallery && existingGallery.assets) {
      existingGallery.assets.forEach(savedAsset => {
        if (!combined.some(n => n.id === savedAsset.id)) {
          combined.push(savedAsset);
        }
      });
    }
    return combined;
  }, [myNfts, existingGallery]);

  // --- 2. STATE SYNC ---
  useEffect(() => {
    if (existingGallery && existingGallery.assets && existingGallery.assets.length > 0) {
        setGalleryName(existingGallery.name || "");
        setIsPublic(existingGallery.isPublic ?? true);

        const newSelected = new Set<string>();
        const newPlacements: Record<string, NFT> = {};

        existingGallery.assets.forEach(savedItem => {
            newSelected.add(savedItem.id);
            const walletVer = myNfts.find(n => n.id === savedItem.id);
            const savedWall = savedItem.wall ? savedItem.wall.toLowerCase() : undefined;

            newPlacements[savedItem.id] = {
                ...savedItem,
                image: walletVer?.image || savedItem.image,
                name: walletVer?.name || savedItem.name,
                wall: savedWall, 
                x: savedItem.x ?? 50,
                y: savedItem.y ?? 50,
                frameColor: savedItem.frameColor || 'black',
                rotation: savedItem.rotation || 0,
                tilt: savedItem.tilt || 0,
                depth: savedItem.depth || 0
            };
        });

        setSelectedIds(newSelected);
        setPlacements(newPlacements);
    }
  }, [existingGallery, myNfts]); 

  // Grouping 
  const groupedNfts = useMemo(() => {
    const groups: Record<string, NFT[]> = {};
    displayNfts.forEach(nft => {
      const colName = nft.collection || "Unknown Collection";
      if (!groups[colName]) groups[colName] = [];
      groups[colName].push(nft);
    });
    return groups;
  }, [displayNfts]);

  const sortedCollectionKeys = useMemo(() => {
    return Object.keys(groupedNfts).sort((a, b) => {
        if (a === "Unknown Collection") return 1;
        if (b === "Unknown Collection") return -1;
        return a.localeCompare(b);
    });
  }, [groupedNfts]);

  // --- ACTIONS ---
  const toggleNft = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) { 
        next.delete(id);
        const nextPlacements = { ...placements };
        delete nextPlacements[id];
        setPlacements(nextPlacements);
        if (activeItemId === id) setActiveItemId(null);
    } else { 
        next.add(id);
        const nft = displayNfts.find(n => n.id === id);
        if (nft) {
            setPlacements(prev => ({
                ...prev,
                [id]: { 
                    ...nft, 
                    wall: undefined, 
                    x: 50, y: 50, scale: 1,
                    frameColor: 'black',
                    rotation: 0, tilt: 0, depth: 0
                }
            }));
        }
    }
    setSelectedIds(next)
  }

  const handleDropOnWall = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("nftId");
    if (!id) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(5, Math.min(95, x));
    const clampedY = Math.max(5, Math.min(95, y));

    setPlacements(prev => ({
        ...prev,
        [id]: { 
            ...prev[id], 
            wall: activeWall, 
            x: clampedX, 
            y: clampedY 
        }
    }));
    setActiveItemId(id);
  };

  const handleDragEnd = (e: React.DragEvent, id: string) => {
    if (!placements[id]?.wall) return; 

    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(5, Math.min(95, x));
    const clampedY = Math.max(5, Math.min(95, y));

    setPlacements(prev => ({
        ...prev,
        [id]: { ...prev[id], x: clampedX, y: clampedY }
    }));
    setActiveItemId(id); 
  };

  const updateActiveItem = (updates: Partial<NFT>) => {
      if (!activeItemId) return;
      setPlacements(prev => ({
          ...prev,
          [activeItemId]: { ...prev[activeItemId], ...updates }
      }));
  };

  const unplaceItem = (id: string) => {
      setPlacements(prev => ({
          ...prev,
          [id]: { ...prev[id], wall: undefined }
      }));
      setActiveItemId(null);
  };

  const handleSave = async () => {
    if (!galleryName.trim()) return alert("Please name your gallery")
    if (selectedIds.size === 0) return alert("Please select at least one NFT")

    setIsSaving(true)
    const assetsToSave = Array.from(selectedIds).map(id => {
        const original = displayNfts.find(n => n.id === id);
        const placement = placements[id];
        return { 
            ...original, 
            ...placement,
            wall: placement?.wall,
            x: placement?.x ?? 50,
            y: placement?.y ?? 50,
            frameColor: placement?.frameColor || 'black',
            depth: placement?.depth || 0
        };
    });

    try {
      const ownerToSave = targetId || walletAddress;
      const res = await fetch('/api/gallery/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: ownerToSave, 
          name: galleryName,
          assets: assetsToSave,
          isPublic
        })
      })

      const data = await res.json()
      if (data.success) {
        alert("Gallery Saved Successfully! 🏛️")
        window.location.reload()
      } else {
        alert("Save failed: " + data.error)
      }
    } catch (e) {
      console.error(e)
      alert("Network error saving gallery")
    } finally {
      setIsSaving(false)
    }
  }

  const activeItem = activeItemId ? placements[activeItemId] : null;

  // --- 3D WYSIWYG FIX ---
  // The builder shows the "Placeable Area" (40 units high), not the full wall (50 units).
  // Side Walls: 100 units long / 40 units placeable height = 2.5 Ratio
  // Back Wall: 60 units long / 40 units placeable height = 1.5 Ratio
  const wallAspectRatio = activeWall === 'back' ? 1.5 / 1 : 2.5 / 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-white/20 w-full max-w-7xl h-[95vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#1a1a1a]">
          <div>
            <h2 className="text-xl font-black text-white uppercase italic">
              {targetId === 'CENTRAL_HALL' ? '👑 Curating Central Hall' : (existingGallery ? 'Edit Gallery' : 'Create Gallery')}
            </h2>
            <div className="flex gap-4 mt-2">
                <button onClick={() => setStep('SELECT')} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded ${step === 'SELECT' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white'}`}>1. Select NFTs</button>
                <button onClick={() => setStep('ARRANGE')} className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded ${step === 'ARRANGE' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-white'}`}>2. Arrange Walls</button>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {/* STEP 1: SELECT */}
        {step === 'SELECT' && (
            <div className="flex-1 overflow-y-auto p-6 bg-black/50">
                <div className="mb-6">
                    <label className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2 block">Gallery Name</label>
                    <input value={galleryName} onChange={(e) => setGalleryName(e.target.value)} placeholder="e.g. My Rare Collection" className="w-full bg-black border border-white/20 p-3 rounded-lg text-white placeholder-gray-700 focus:border-purple-500 outline-none transition-all" />
                </div>
                {sortedCollectionKeys.map(collectionName => (
                    <div key={collectionName} className="mb-8">
                        <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-2 sticky top-0 bg-[#111]/90 backdrop-blur-sm z-10 py-2">
                            <span className="text-purple-400 font-black uppercase text-sm italic tracking-widest">{collectionName}</span>
                            <span className="bg-white/10 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">{groupedNfts[collectionName].length}</span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                            {groupedNfts[collectionName].map(nft => {
                            const isSelected = selectedIds.has(nft.id)
                            return (
                                <div key={nft.id} onClick={() => toggleNft(nft.id)} className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer group border-2 transition-all ${isSelected ? 'border-purple-500 opacity-100 scale-95' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`}>
                                    <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                                    {isSelected && (
                                        <div className="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                                            <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg">✓</div>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/90 to-transparent p-2">
                                        <p className="text-[10px] text-white font-bold truncate">{nft.name}</p>
                                    </div>
                                </div>
                            )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* STEP 2: ARRANGE */}
        {step === 'ARRANGE' && (
            <div className="flex-1 flex bg-[#050505] min-h-0">
                
                {/* SIDEBAR */}
                <div className="w-64 border-r border-white/10 p-4 overflow-y-auto flex flex-col gap-6 shrink-0 bg-[#111]">
                    <div>
                        <h3 className="text-gray-500 font-bold text-[10px] uppercase mb-3 tracking-widest">Active Wall</h3>
                        <div className="flex flex-col gap-2">
                            {['left', 'back', 'right'].map(wall => (
                                <button key={wall} onClick={() => setActiveWall(wall as any)} className={`p-3 rounded text-left uppercase text-xs font-bold border transition-all ${activeWall === wall ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
                                    {wall} Wall
                                </button>
                            ))}
                        </div>
                    </div>

                    {activeItem ? (
                        <div className="border-t border-white/10 pt-6">
                             <h3 className="text-white font-bold text-xs uppercase mb-1">Selected Art</h3>
                             <p className="text-[10px] text-gray-400 mb-4 truncate">{activeItem.name}</p>

                             <div className="mb-4">
                                 <label className="text-[10px] uppercase font-bold text-gray-500 mb-2 block">Frame Style</label>
                                 <div className="flex gap-2">
                                     <button onClick={() => updateActiveItem({ frameColor: 'black' })} className={`flex-1 py-2 text-xs border rounded ${activeItem.frameColor === 'black' || !activeItem.frameColor ? 'bg-white text-black border-white' : 'border-white/20 text-gray-400'}`}>Black</button>
                                     <button onClick={() => updateActiveItem({ frameColor: 'gold' })} className={`flex-1 py-2 text-xs border rounded ${activeItem.frameColor === 'gold' ? 'bg-yellow-600 text-white border-yellow-500' : 'border-white/20 text-gray-400'}`}>Gold</button>
                                 </div>
                             </div>

                             <div className="mb-4">
                                 <div className="flex justify-between mb-1">
                                     <label className="text-[10px] uppercase font-bold text-gray-500">Rotation</label>
                                     <span className="text-[10px] text-white">{activeItem.rotation || 0}°</span>
                                 </div>
                                 <input type="range" min="-180" max="180" value={activeItem.rotation || 0} onChange={(e) => updateActiveItem({ rotation: parseInt(e.target.value) })} className="w-full accent-purple-600" />
                             </div>

                             <div className="mb-4">
                                 <div className="flex justify-between mb-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Tilt</label>
                                    <span className="text-[10px] text-white">{activeItem.tilt || 0}°</span>
                                 </div>
                                 <input type="range" min="-30" max="30" value={activeItem.tilt || 0} onChange={(e) => updateActiveItem({ tilt: parseInt(e.target.value) })} className="w-full accent-purple-600" />
                             </div>

                             <div className="mb-4">
                                 <div className="flex justify-between mb-1">
                                    <label className="text-[10px] uppercase font-bold text-gray-500">Dist. from Wall</label>
                                    <span className="text-[10px] text-white">{activeItem.depth || 0}</span>
                                 </div>
                                 <input type="range" min="0" max="10" step="0.5" value={activeItem.depth || 0} onChange={(e) => updateActiveItem({ depth: parseFloat(e.target.value) })} className="w-full accent-purple-600" />
                             </div>

                             <div className="pt-4 border-t border-white/10 mt-4">
                                <button 
                                    onClick={() => unplaceItem(activeItem.id)} 
                                    className="w-full py-3 bg-red-900/30 border border-red-800 text-red-400 hover:bg-red-900/50 hover:text-white rounded text-xs font-bold uppercase transition-all"
                                >
                                    Remove From Wall
                                </button>
                             </div>
                        </div>
                    ) : (
                        <div className="border-t border-white/10 pt-6 text-center">
                            <p className="text-gray-500 text-xs">Click an artwork on the wall to edit properties.</p>
                        </div>
                    )}
                </div>

                {/* MAIN CANVAS AREA */}
                <div className="flex-1 p-8 relative overflow-hidden flex flex-col items-center justify-center bg-grid-pattern bg-[#050505]">
                    
                    {/* WALL CONTAINER (FIXED COLLAPSE BUG) */}
                    <div 
                        className="relative border-2 border-white/20 shadow-2xl rounded-lg overflow-hidden transition-all bg-[#1a1a1a]"
                        style={{
                            // FIX: Force height so it doesn't collapse. Let width adjust by aspect ratio.
                            height: '60vh', 
                            width: 'auto',
                            maxWidth: '100%',
                            
                            // DYNAMIC RATIO (Matches 3D Placeable Area):
                            // Back Wall = 1.5 (60w / 40h)
                            // Side Wall = 2.5 (100w / 40h)
                            aspectRatio: wallAspectRatio, 
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDropOnWall}
                    >
                        <div className="absolute top-4 left-4 text-white/10 font-black text-6xl uppercase pointer-events-none select-none">{activeWall} WALL</div>

                        {Array.from(selectedIds).map(id => {
                            const item = placements[id];
                            if (item?.wall?.toLowerCase() !== activeWall) return null; 
                            const isSelected = activeItemId === id;

                            return (
                                <div
                                    key={id}
                                    draggable
                                    onDragStart={() => setActiveItemId(id)}
                                    onDragEnd={(e) => handleDragEnd(e, id)}
                                    onClick={(e) => { e.stopPropagation(); setActiveItemId(id); }}
                                    style={{
                                        left: `${item.x || 50}%`,
                                        top: `${item.y || 50}%`,
                                        // RELATIVE SCALE FIX: 
                                        // Frame is 12 units. Visible wall height is 40 units.
                                        // 12/40 = 30% of builder height.
                                        height: '30%', 
                                        aspectRatio: '1/1',
                                        width: 'auto',
                                        transform: `translate(-50%, -50%) rotate(${item.rotation || 0}deg)`, 
                                        position: 'absolute',
                                        zIndex: isSelected ? 10 : 1
                                    }}
                                    className="cursor-move group"
                                >
                                    <div className={`relative w-full h-full border-4 rounded bg-black shadow-lg hover:scale-105 transition-transform ${item.frameColor === 'gold' ? 'border-yellow-500' : 'border-gray-800'} ${isSelected ? 'ring-4 ring-purple-600 ring-offset-2 ring-offset-black' : ''}`}>
                                        <img src={item.image} className="w-full h-full object-cover rounded-sm pointer-events-none" />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    
                    {/* BOTTOM DOCK */}
                    <div className="w-full max-w-5xl mt-6 h-24 bg-[#111] border border-white/10 rounded-lg p-2 flex gap-2 overflow-x-auto z-10 shadow-xl shrink-0">
                        {Array.from(selectedIds).map(id => {
                            const item = placements[id];
                            if (item.wall) return null;

                            return (
                                <div 
                                    key={id} 
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData("nftId", id); 
                                    }}
                                    onClick={() => setPlacements(p => ({ ...p, [id]: { ...p[id], wall: activeWall } }))} 
                                    className="aspect-square h-full rounded cursor-grab active:cursor-grabbing border-2 border-white/20 hover:border-white overflow-hidden shrink-0 transition-colors bg-black"
                                >
                                    <img src={item.image} className="w-full h-full object-cover pointer-events-none" />
                                </div>
                            )
                        })}
                        {Array.from(selectedIds).every(id => placements[id]?.wall) && (
                            <div className="w-full flex items-center justify-center text-gray-600 text-xs italic">
                                All selected items placed. Select more in Step 1.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-[#1a1a1a] flex justify-between items-center">
          <div className="flex items-center gap-3">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="w-4 h-4 accent-purple-600 cursor-pointer"/>
            <span className="text-xs text-gray-400">Public Gallery</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-6 py-3 text-xs font-bold uppercase text-gray-400 hover:text-white transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={isSaving} className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-lg font-black uppercase text-xs tracking-wider transition-all disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Gallery'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}