"use client"
import { useEffect, useState, useMemo, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import '@solana/wallet-adapter-react-ui/styles.css'
import dynamic from 'next/dynamic'
import LoadingSpinner from '@/components/LoadingSpinner'
import GalleryBuilder from '@/components/solanaverse/GalleryBuilder'
import AvatarSelector from '@/components/solanaverse/AvatarSelector'
import AdminAvatarDashboard from '@/components/solanaverse/AdminAvatarDashboard'
import MobileControls from '@/components/solanaverse/MobileControls'
import React from 'react'

// --- 1. HASHLIST IMPORTS ---
import { K9_HASHLIST } from '@/config/k9hashlist' 
import senseiHashlist from '@/data/sensei_hashlist.json' 
import namasteHashlist from '@/data/namaste_hashlist.json'
import sacHashlist from '@/data/sac_hashlist.json'
import geneticsHashlist from '@/data/noble_genetics_hashlist.json'
import extractsHashlist from '@/data/noble_extracts_hashlist.json'
import d3fendersHashlist from '@/data/d3fenders_hashlist.json'
import tsoHashlist from '@/data/tso_hashlist.json'
import galacticGeckoHashlist from '@/data/GalacticGecko_hashlist.json'

// --- MULTIPLAYER IMPORTS ---
import { RoomProvider } from '@/liveblocks.config'
import { ClientSideSuspense } from "@liveblocks/react";
import Chat from '@/components/solanaverse/Chat'
import { LiveList } from '@liveblocks/client';

// --- DYNAMIC IMPORTS ---
const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
) as React.FC<any>;

const SolanaverseScene = dynamic(() => import('@/components/solanaverse/Scene'), { 
  ssr: false, 
  loading: () => <div className="bg-black h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div> 
})

// --- CONFIGURATION ---
const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(',')
const CENTRAL_HALL_ID = "CENTRAL_HALL" 

interface RawNFT { id: string; name: string; image: string; collection: string; }
interface PublicGallery { id: string; owner: string; name: string; assetCount: number; isPublic?: boolean; assets: RawNFT[]; }

type ViewMode = 'hall' | 'gallery' | 'gecko' | 'panda';

export default function SolanaversePage() {
  const { publicKey, connected } = useWallet()
  
  // --- STATE ---
  const [loading, setLoading] = useState(false)
  const [myNfts, setMyNfts] = useState<RawNFT[]>([]) 
  const [adminNfts, setAdminNfts] = useState<RawNFT[]>([]) 
  const [publicGalleries, setPublicGalleries] = useState<PublicGallery[]>([]) 
  
  const [userGalleryData, setUserGalleryData] = useState<PublicGallery | null>(null) 
  const [centralHallData, setCentralHallData] = useState<PublicGallery | null>(null)

  const [viewMode, setViewMode] = useState<ViewMode>('hall')
  const [activeGalleryName, setActiveGalleryName] = useState<string>("") 
  const [currentRoomId, setCurrentRoomId] = useState("solanaverse-central-hall")
  const [activeSceneData, setActiveSceneData] = useState<RawNFT[]>([]) 
  
  const [showBuilder, setShowBuilder] = useState(false)
  const [builderTargetId, setBuilderTargetId] = useState<string | undefined>(undefined)

  const [showAvatarSelector, setShowAvatarSelector] = useState(false)
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)

  // KEY STATE: User Identity
  const [userId, setUserId] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null) 
  const [avatarId, setAvatarId] = useState('human') 
  const [isProfileLoading, setIsProfileLoading] = useState(false)

  const [isSelfieMode, setIsSelfieMode] = useState(false);
  
  // --- NEW: CHAT VISIBILITY STATE ---
  const [isChatOpen, setIsChatOpen] = useState(false); 

  // --- MOBILE INPUT REF ---
  const mobileInputRef = useRef({ move: { x: 0, y: 0 }, look: { x: 0, y: 0 } });

  const HASHLISTS = useMemo(() => ({
    'Solana K9s': new Set(K9_HASHLIST),
    'Sensei Pandas': new Set(senseiHashlist),
    'Namaste': new Set(namasteHashlist),
    'Stoned Apes': new Set(sacHashlist),
    'Noble Genetics': new Set(geneticsHashlist),
    'Noble Extracts': new Set(extractsHashlist),
    'D3fenders': new Set(d3fendersHashlist),
    'Smoke Out': new Set(tsoHashlist),
    'Galactic Geckos': new Set(galacticGeckoHashlist),
  }), []);

  // ... (Helpers kept as is) ...
  const fixSenseiUrl = (url: string) => {
    if (!url) return "/ntwrk-logo.png";
    if (url.includes("sensei.launchifi.xyz") && url.includes("/gif/")) {
        return url.replace("/gif/", "/png/").replace(".gif", ".png");
    }
    return url;
  };

  const sanitizeAssets = (assets: RawNFT[]) => {
      return assets.map(asset => ({ ...asset, image: fixSenseiUrl(asset.image) }));
  };

  const getPngImage = (nft: any) => {
    const fileLists = [
        nft.content?.files,
        nft.properties?.files,
        nft.content?.metadata?.properties?.files
    ];
    for (const files of fileLists) {
        if (Array.isArray(files)) {
            const pngFile = files.find((f: any) => 
                f.mime === 'image/png' || f.type === 'image/png' || (f.uri && f.uri.endsWith('.png'))
            );
            if (pngFile?.uri) return fixSenseiUrl(pngFile.uri);
        }
    }
    const defaultImg = nft.content?.links?.image || nft.content?.files?.[0]?.uri || nft.image || '';
    return fixSenseiUrl(defaultImg);
  }

  // --- ACTIONS ---
  const handleAvatarSelect = async (newAvatarId: string) => {
      setAvatarId(newAvatarId); 
      if (userId) {
          try {
              await fetch('/api/user/equip', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ userId, avatarId: newAvatarId })
              });
          } catch (e) { console.error("Failed to save avatar choice", e); }
      }
  };

  const handleScreenshot = () => {
    const canvas = document.getElementById('solanaverse-canvas')?.querySelector('canvas');
    if (canvas) {
        const link = document.createElement('a');
        link.download = `noble-selfie-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
  };

  const handleMobileInput = (type: 'move' | 'look', x: number, y: number) => {
      if (type === 'move') mobileInputRef.current.move = { x, y };
      if (type === 'look') mobileInputRef.current.look = { x, y };
  };

  // --- INITIAL LOAD ---
  useEffect(() => {
    fetch('/api/gallery/list')
        .then(r => r.json())
        .then(d => { 
            if(d.galleries) {
                const onlyUserGalleries = d.galleries.filter((g: PublicGallery) => g.owner !== CENTRAL_HALL_ID);
                setPublicGalleries(onlyUserGalleries)
            }
        })

    fetch(`/api/gallery/get?owner=${CENTRAL_HALL_ID}`).then(r => r.json()).then(d => {
        if (d.success && d.gallery && d.gallery.assets.length > 0) {
            const cleanAssets = d.gallery.assets.map((a: any) => ({...a, image: fixSenseiUrl(a.image)}));
            setAdminNfts(cleanAssets)
            setCentralHallData({...d.gallery, assets: cleanAssets}) 
            setActiveSceneData(cleanAssets) 
        }
    })

    if (connected && publicKey) {
        setIsProfileLoading(true);
        let allWallets: string[] = [publicKey.toBase58()];
        try {
            const stored = JSON.parse(localStorage.getItem('noble_wallets') || '[]');
            if (Array.isArray(stored) && stored.length > 0) {
                if (typeof stored[0] === 'string') {
                    allWallets = Array.from(new Set([...allWallets, ...stored]));
                } else {
                    const addresses = stored.map((w: any) => w.address);
                    allWallets = Array.from(new Set([...allWallets, ...addresses]));
                }
            }
        } catch (e) { console.warn("Wallet cache error"); }

        const resolveIdentity = async () => {
            let foundId = null;
            let savedAvatar = 'human'; 
            let savedUsername = null; 

            for (const wallet of allWallets) {
                try {
                    const res = await fetch(`/api/user/profile?wallet=${wallet}`);
                    if (res.ok) {
                        const data = await res.json();
                        const id = data.user?.id || data.id || data.data?.id; 
                        
                        if (data.user?.equippedAvatar) savedAvatar = data.user.equippedAvatar;
                        if (data.user?.username) savedUsername = data.user.username; 

                        if (id) { foundId = id; break; }
                    }
                } catch (e) { }
            }

            if (foundId) {
                setUserId(foundId);
                setAvatarId(savedAvatar);
                setUsername(savedUsername); 
                
                fetch(`/api/gallery/get?owner=${foundId}`).then(r => r.json()).then(d => {
                    if(d.success && d.gallery) {
                        const cleanAssets = d.gallery.assets.map((a: any) => ({...a, image: fixSenseiUrl(a.image)}));
                        setUserGalleryData({...d.gallery, assets: cleanAssets})
                    }
                })
            }
            setIsProfileLoading(false);
        };

        resolveIdentity();
        fetchAndCacheHoldings(allWallets.join(','));
    }
  }, [connected, publicKey])

  const fetchAndCacheHoldings = async (wallets: string) => {
    try {
        const res = await fetch(`/api/holdings?wallets=${wallets}`)
        const json = await res.json()
        const found: RawNFT[] = []
        if (json.data) {
            json.data.forEach((w: any) => w.nfts?.forEach((n: any) => {
                let collectionName = null;
                for (const [colName, set] of Object.entries(HASHLISTS)) {
                    if (set.has(n.id) || (n.grouping && n.grouping.some((g: any) => set.has(g.group_value)))) {
                        collectionName = colName;
                        break;
                    }
                }
                if (!collectionName && n.content?.metadata?.name?.includes('Immortal')) {
                    collectionName = 'Galactic Geckos';
                }
                if (collectionName) {
                    const img = getPngImage(n);
                    if (img) {
                        found.push({ id: n.id, name: n.content?.metadata?.name || 'NFT', image: img, collection: collectionName })
                    }
                }
            }))
        }
        setMyNfts(sanitizeAssets(found))
    } catch (e) { console.error("Fetch error", e); }
  }

  const openBuilder = (mode: 'PERSONAL' | 'CENTRAL') => {
      if (mode === 'CENTRAL') {
          setBuilderTargetId(CENTRAL_HALL_ID)
          setShowBuilder(true)
      } else {
          if (!userId) {
              alert("Profile not loaded.");
              return; 
          }
          setBuilderTargetId(userId) 
          setShowBuilder(true)
      }
  }

  const handleEnterGallery = async (ownerId: string) => {
    setLoading(true)
    try {
        const res = await fetch(`/api/gallery/get?owner=${ownerId}`)
        const data = await res.json()
        if (data.success && data.gallery) {
            const cleanAssets = data.gallery.assets.map((a: any) => ({...a, image: fixSenseiUrl(a.image)}));
            setActiveSceneData(cleanAssets)
            setActiveGalleryName(data.gallery.name || "User Gallery") 
            setViewMode('gallery')
            setCurrentRoomId(`gallery-${ownerId}`)
        }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleEnterCommunity = (type: 'gecko' | 'panda') => {
      setViewMode(type); 
      setCurrentRoomId(`community-${type}`); 
  }

  const handleExitGallery = () => {
    setActiveSceneData(adminNfts)
    setViewMode('hall')
    setActiveGalleryName("")
    setCurrentRoomId("solanaverse-central-hall")
  }

  if (loading) return <div className="h-screen bg-black flex items-center justify-center"><LoadingSpinner size="lg" /></div>
  
  const isAdmin = publicKey && ADMIN_WALLETS.includes(publicKey.toBase58());

  const getPageTitle = () => {
      switch(viewMode) {
          case 'gecko': return 'Gecko Garage';
          case 'panda': return 'Sensei Dojo';
          case 'gallery': return activeGalleryName || 'User Gallery';
          default: return 'Central Hall';
      }
  }

  return (
    // FIX: Using 'fixed' with explicit offsets to break out of layout.tsx constraints
    // top-[81px] accounts for the sticky header height (approx 81px)
    <div className="fixed left-0 right-0 bottom-0 top-[81px] bg-black overflow-hidden touch-none z-0">
        
        {/* --- MOBILE CONTROLS --- */}
        {!isSelfieMode && !showBuilder && !showAvatarSelector && (
            <MobileControls onInput={handleMobileInput} />
        )}

        {showBuilder && publicKey && (
            <GalleryBuilder 
                myNfts={myNfts} 
                walletAddress={publicKey.toBase58()} 
                targetId={builderTargetId} 
                onClose={() => setShowBuilder(false)}
                existingGallery={builderTargetId === CENTRAL_HALL_ID ? centralHallData : userGalleryData} 
            />
        )}

        {showAvatarSelector && (
            <AvatarSelector 
                onClose={() => setShowAvatarSelector(false)}
                onSelect={handleAvatarSelect}
                currentAvatar={avatarId}
                myNfts={myNfts}
                walletAddress={publicKey?.toBase58() || ""}
            />
        )}

        {showAdminDashboard && (
            <AdminAvatarDashboard onClose={() => setShowAdminDashboard(false)} />
        )}

        {/* --- HUD --- */}
        <div className="absolute inset-0 z-40 pointer-events-none p-8 flex flex-col justify-between">
            {!isSelfieMode ? (
                <div className="flex justify-between items-start w-full pointer-events-auto transition-opacity duration-300">
                    <div>
                        <h1 className="text-4xl font-black text-white italic drop-shadow-lg uppercase">
                            {getPageTitle()}
                        </h1>
                        <p className="text-purple-400 font-bold uppercase tracking-widest text-xs mb-2">
                            {viewMode === 'hall' ? 'Explore the Portals' : 'Immersive Experience'}
                        </p>
                        
                        <div className="bg-black/40 backdrop-blur-md p-2 rounded-lg border border-white/10 hidden md:inline-block">
                            <p className="text-[10px] text-gray-300 font-mono uppercase">
                                🎮 <b>WASD</b> to Walk • <b>ARROWS</b> to Look
                            </p>
                        </div>

                        <div className="mt-4 flex gap-3 flex-wrap">
                            {viewMode !== 'hall' && (
                                <button onClick={handleExitGallery} className="bg-white/10 border border-white/20 backdrop-blur-md text-white px-4 py-2 rounded-lg font-bold hover:bg-white/20 transition-all uppercase text-xs">⬅ Return to Hall</button>
                            )}

                            {connected && (
                                <>
                                    <button onClick={() => setShowAvatarSelector(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-blue-500 transition-all uppercase text-xs">👤 Avatar</button>
                                    <button onClick={() => setIsSelfieMode(true)} className="bg-pink-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-pink-500 transition-all uppercase text-xs">📸 Selfie</button>
                                    
                                    <button 
                                        onClick={() => setIsChatOpen(!isChatOpen)} 
                                        className={`${isChatOpen ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-700 hover:bg-gray-600'} text-white px-4 py-2 rounded-lg font-bold shadow-lg transition-all uppercase text-xs border border-white/20`}
                                    >
                                        💬 {isChatOpen ? 'Hide Chat' : 'Chat'}
                                    </button>

                                    <button 
                                        onClick={() => openBuilder('PERSONAL')} 
                                        className={`text-white px-4 py-2 rounded-lg font-bold shadow-lg transition-all uppercase text-xs ${(!userId || isProfileLoading) ? 'bg-gray-600 cursor-not-allowed opacity-50' : 'bg-purple-600 hover:bg-purple-500'}`}
                                        disabled={!userId || isProfileLoading}
                                    >
                                        {isProfileLoading ? 'Fetching...' : (!userId ? 'No Profile' : (userGalleryData ? '✎ Edit My Gallery' : '+ Create Gallery'))}
                                    </button>
                                    {isAdmin && (
                                        <>
                                            <button onClick={() => openBuilder('CENTRAL')} className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-yellow-500 transition-all uppercase text-xs border border-yellow-400/50">👑 Curate Hall</button>
                                            <button onClick={() => setShowAdminDashboard(true)} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg hover:bg-red-500 transition-all uppercase text-xs border border-red-400/50">👑 Requests</button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                    <div className="pointer-events-auto"><WalletMultiButton className="!bg-purple-600 hover:!bg-purple-500 !font-bold !rounded-lg" /></div>
                </div>
            ) : (
                <div className="w-full flex justify-between items-start pointer-events-auto">
                    <div className="bg-black/50 p-2 rounded text-white text-xs backdrop-blur-md">📸 <b>SELFIE MODE</b></div>
                    <button onClick={() => setIsSelfieMode(false)} className="bg-white/10 text-white px-4 py-2 rounded-full font-bold hover:bg-white/20">✕ Close</button>
                </div>
            )}

            {isSelfieMode && (
                <div className="w-full flex justify-center pb-8 pointer-events-auto">
                    <button onClick={handleScreenshot} className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 shadow-2xl hover:scale-110 transition-transform flex items-center justify-center group">
                        <div className="w-12 h-12 bg-transparent border-2 border-black/20 rounded-full group-hover:bg-gray-100" />
                    </button>
                </div>
            )}
        </div>

        {/* --- CANVAS CONTAINER (Absolute, not Fixed) --- */}
        {/* Changed from fixed to absolute so it respects the top-[81px] parent constraint */}
        <div className="absolute inset-0 z-0">
            <RoomProvider 
                id={currentRoomId} 
                initialPresence={{ position: [0,0,0], rotation: 0, pitch: 0, avatarId: 'human', wallet: publicKey?.toBase58() || 'Guest' }}
                initialStorage={{ messages: new LiveList([]) }} 
            >
                <ClientSideSuspense fallback={<div className="bg-black h-screen flex items-center justify-center text-white">Connecting to Solanaverse...</div>}>
                    {() => (
                        <>
                            <SolanaverseScene 
                                mode={viewMode}
                                activeData={activeSceneData}
                                publicGalleries={publicGalleries}
                                onEnterGallery={handleEnterGallery}
                                onExitGallery={handleExitGallery}
                                onEnterCommunity={handleEnterCommunity}
                                avatarId={avatarId} 
                                isSelfieMode={isSelfieMode}
                                galleryTitle={activeGalleryName}
                                username={username}
                                mobileInput={mobileInputRef} 
                            />
                            
                            {/* --- CHAT WITH VISIBILITY TOGGLE --- */}
                            {!isSelfieMode && (
                                <div className={`absolute bottom-8 left-8 z-50 transition-opacity duration-300 ${isChatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                                    <Chat />
                                </div>
                            )}
                        </>
                    )}
                </ClientSideSuspense>
            </RoomProvider>
        </div>
    </div>
  )
}