"use client"
import { useEffect, useState, useMemo, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import '@solana/wallet-adapter-react-ui/styles.css'
import dynamic from 'next/dynamic'
import LoadingSpinner from '@/components/LoadingSpinner'
import GalleryBuilder from '@/components/solanaverse/GalleryBuilder'
import IRLGalleryBuilder from '@/components/solanaverse/IRLGalleryBuilder'
import AvatarSelector from '@/components/solanaverse/AvatarSelector'
import AdminAvatarDashboard from '@/components/solanaverse/AdminAvatarDashboard'
import MobileControls from '@/components/solanaverse/MobileControls'
import React from 'react'
import { toast } from 'react-toastify'

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
const IRL_GALLERY_ID = "IRL_GALLERY_OFFICIAL" 

interface RawNFT { id: string; name: string; image: string; collection: string; }
interface PublicGallery { id: string; owner: string; name: string; assetCount: number; isPublic?: boolean; assets: RawNFT[]; }

type ViewMode = 'hall' | 'gallery' | 'gecko' | 'panda';

export default function SolanaversePage() {
  const { publicKey, connected, connecting, wallet } = useWallet()
  const router = useRouter()
  
  // --- STATE ---
  const [loading, setLoading] = useState(false)
  const [accessGranted, setAccessGranted] = useState(false) 
  const [showConnectState, setShowConnectState] = useState(false); // To show "Connection Failed" UI

  const [myNfts, setMyNfts] = useState<RawNFT[]>([]) 
  const [adminNfts, setAdminNfts] = useState<RawNFT[]>([]) 
  const [publicGalleries, setPublicGalleries] = useState<PublicGallery[]>([]) 
  
  const [userGalleryData, setUserGalleryData] = useState<PublicGallery | null>(null) 
  const [centralHallData, setCentralHallData] = useState<PublicGallery | null>(null)
  const [irlItems, setIrlItems] = useState<any[]>([])

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
  const [isChatOpen, setIsChatOpen] = useState(false); 

  // --- GAME PERSISTENCE STATE ---
  const [showArcade, setShowArcade] = useState(false); 
  const [userXP, setUserXP] = useState(0);
  const [userLevel, setUserLevel] = useState(1);
  const [collectedItems, setCollectedItems] = useState<string[]>([]);

  // ---------------------------------------------------------
  // 1. STRICT ACCESS CONTROL (REFINED)
  // ---------------------------------------------------------
  useEffect(() => {
      // If already verified, stop checking
      if (accessGranted) {
          setShowConnectState(false);
          return;
      }

      // Success: Wallet connected
      if (connected && publicKey) {
          setAccessGranted(true);
          setShowConnectState(false);
          return;
      }

      // If connecting, just wait
      if (connecting) {
          setShowConnectState(false);
          return;
      }

      // If disconnected, start a graceful timer before kicking/showing error
      const timeoutMs = wallet ? 4000 : 2000; // Give selected wallets more time (4s)
      
      const checkTimer = setTimeout(() => {
          if (!connected && !connecting) {
              // Instead of instantly pushing, show the "Connection Failed" UI
              // This gives the user a chance to click "Connect" again without page reload
              setShowConnectState(true);
          }
      }, timeoutMs); 

      return () => clearTimeout(checkTimer);
  }, [connected, connecting, publicKey, accessGranted, wallet]);


  // 2. Calculate Level
  useEffect(() => {
      const newLevel = 1 + Math.floor(userXP / 100);
      if (newLevel > userLevel) {
          toast.success(`🎉 LEVEL UP! You are now Level ${newLevel}`);
          setUserLevel(newLevel);
      }
  }, [userXP]);

  // 3. Helper to Save Progress to DB
  const saveProgress = async (xp: number, level: number, items: string[]) => {
      if (!userId) return; 

      try {
          const res = await fetch('/api/game/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, xp, level, collectedItems: items })
          });
          
          if (!res.ok) console.error("Save failed");
      } catch (e) { console.error("Failed to save progress", e); }
  };

  // 4. Add XP Action
  const addXP = (amount: number) => {
      const newXP = userXP + amount;
      setUserXP(newXP);
      const newLevel = 1 + Math.floor(newXP / 100);
      saveProgress(newXP, newLevel, collectedItems);
  };

  // 5. Collect Item Action
  const handleCollectItem = (itemId: string) => {
      if (!collectedItems.includes(itemId)) {
          const newItems = [...collectedItems, itemId];
          setCollectedItems(newItems);
          
          const newXP = userXP + 50;
          setUserXP(newXP);
          const newLevel = 1 + Math.floor(newXP / 100);

          if (userId) {
              saveProgress(newXP, newLevel, newItems);
          } else {
              toast.warn("⚠️ Syncing profile...");
          }
      }
  };

  // 6. SYNC ON LOGIN
  useEffect(() => {
      if (userId && collectedItems.length > 0) {
          saveProgress(userXP, userLevel, collectedItems);
      }
  }, [userId]);

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

  useEffect(() => {
    const nav = document.querySelector('nav');
    if (nav) nav.style.display = 'none'; 
    return () => { if (nav) nav.style.display = 'flex'; };
  }, []);

  useEffect(() => {
    fetch('/api/gallery/list')
        .then(r => r.json())
        .then(d => { 
            if(d.galleries) {
                const onlyUserGalleries = d.galleries.filter((g: PublicGallery) => 
                    g.owner !== CENTRAL_HALL_ID && g.owner !== IRL_GALLERY_ID
                );
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

    fetch('/api/admin/irl-gallery').then(r => r.json()).then(d => {
        if (d.success && d.items) {
            setIrlItems(d.items); 
        }
    }).catch(e => console.error("Failed to load IRL gallery", e));

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
                });

                fetch(`/api/game/progress?userId=${foundId}`)
                    .then(r => r.json())
                    .then(d => {
                        if (d.success && d.profile) {
                            if (d.profile.collectedItems.length >= collectedItems.length) {
                                setUserXP(d.profile.xp);
                                setUserLevel(d.profile.level);
                                setCollectedItems(d.profile.collectedItems);
                            }
                        }
                    })
                    .catch(e => console.error("Game load error", e));
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

  const openBuilder = (mode: 'PERSONAL' | 'CENTRAL' | 'IRL') => {
      if (mode === 'CENTRAL') {
          setBuilderTargetId(CENTRAL_HALL_ID)
          setShowBuilder(true)
      } else if (mode === 'IRL') {
          setBuilderTargetId(IRL_GALLERY_ID)
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
            addXP(10); 
        }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleEnterCommunity = (type: 'gecko' | 'panda') => {
      setViewMode(type); 
      setCurrentRoomId(`community-${type}`); 
      addXP(15); 
  }

  const handleExitGallery = () => {
    setActiveSceneData(adminNfts)
    setViewMode('hall')
    setActiveGalleryName("")
    setCurrentRoomId("solanaverse-central-hall")
  }

  // --- ACCESS BLOCKER ---
  if (!accessGranted) {
      if (showConnectState) {
          return (
              <div className="h-screen bg-black flex flex-col items-center justify-center gap-6 z-50">
                  <div className="text-red-500 font-mono text-xl animate-pulse uppercase tracking-widest border border-red-500 p-4 rounded bg-red-900/20">
                      ⚠ Connection Lost / Required
                  </div>
                  <div className="flex gap-4">
                      <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-500 !font-bold !rounded-lg !h-12 !text-sm" />
                      <button 
                        onClick={() => router.push('/')}
                        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-mono uppercase text-sm border border-white/20 transition-all"
                      >
                        Return Home
                      </button>
                  </div>
              </div>
          )
      }

      return (
          <div className="h-screen bg-black flex flex-col items-center justify-center gap-4">
              <LoadingSpinner size="lg" />
              <div className="text-white font-mono text-sm animate-pulse uppercase tracking-widest">
                  Initializing...
              </div>
          </div>
      );
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
    <div className="fixed inset-0 bg-black overflow-hidden touch-none z-0">
        
        {/* --- ARCADE OVERLAY --- */}
        {showArcade && (
            <div className="absolute inset-0 z-[100] bg-black flex flex-col">
                <div className="h-12 bg-[#111] border-b border-green-500/50 flex justify-between items-center px-6">
                    <span className="text-green-400 font-bold font-mono tracking-widest animate-pulse">Running: PORTAL_HUNTER.exe</span>
                    <button 
                        onClick={() => setShowArcade(false)}
                        className="text-white bg-red-600 hover:bg-red-500 px-4 py-1 rounded text-xs font-bold uppercase"
                    >
                        Exit Arcade [ESC]
                    </button>
                </div>
                <iframe 
                    src="https://huntingportals.com/" 
                    className="flex-1 w-full border-none focus:outline-none"
                    allow="gamepad; fullscreen; accelerometer; gyroscope"
                />
            </div>
        )}

        {!isSelfieMode && !showBuilder && !showAvatarSelector && !showArcade && (
            <MobileControls onInput={handleMobileInput} />
        )}

        {/* --- DYNAMIC BUILDER RENDERER --- */}
        {showBuilder && publicKey && (
            builderTargetId === IRL_GALLERY_ID ? (
                <IRLGalleryBuilder myNfts={myNfts} onClose={() => setShowBuilder(false)} />
            ) : (
                <GalleryBuilder 
                    myNfts={myNfts} 
                    walletAddress={publicKey.toBase58()} 
                    targetId={builderTargetId} 
                    onClose={() => setShowBuilder(false)}
                    existingGallery={builderTargetId === CENTRAL_HALL_ID ? centralHallData : userGalleryData} 
                />
            )
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

        {showAdminDashboard && <AdminAvatarDashboard onClose={() => setShowAdminDashboard(false)} />}

        {/* --- HUD --- */}
        {!showArcade && (
            <div className="absolute inset-0 z-40 pointer-events-none p-4 md:p-6 flex flex-col justify-between">
                {!isSelfieMode ? (
                    <div className="w-full pointer-events-auto transition-opacity duration-300">
                        
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            {/* LEFT: Title & Controls */}
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-4">
                                    <button 
                                        onClick={() => router.push('/Portal')}
                                        className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all group backdrop-blur-md"
                                        title="Exit Solanaverse"
                                    >
                                        <svg className="w-5 h-5 text-gray-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                        </svg>
                                    </button>

                                    <div>
                                        <h1 className="text-2xl md:text-4xl font-black text-white italic drop-shadow-lg uppercase leading-none">{getPageTitle()}</h1>
                                        
                                        {/* XP / LEVEL BAR */}
                                        <div className="flex items-center gap-2 mt-1">
                                            <div className="bg-black/60 border border-purple-500/30 rounded px-2 py-0.5 flex items-center gap-2">
                                                <span className="text-[10px] text-purple-400 font-bold">LVL {userLevel}</span>
                                                <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${(userXP % 100)}%` }} />
                                                </div>
                                            </div>
                                            <div className="text-[9px] text-yellow-400 font-mono">
                                                {collectedItems.length}/5 Disks
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 flex-wrap">
                                    {viewMode !== 'hall' && (
                                        <button onClick={handleExitGallery} className="bg-white/10 border border-white/20 backdrop-blur-md text-white px-3 py-1.5 rounded-lg font-bold hover:bg-white/20 transition-all uppercase text-[10px]">⬅ Hall</button>
                                    )}

                                    {connected && (
                                        <>
                                            <button onClick={() => setShowAvatarSelector(true)} className="bg-blue-600/80 hover:bg-blue-500 backdrop-blur-md text-white px-3 py-1.5 rounded-lg font-bold shadow-lg transition-all uppercase text-[10px]">👤 Avatar</button>
                                            <button onClick={() => setIsSelfieMode(true)} className="bg-pink-600/80 hover:bg-pink-500 backdrop-blur-md text-white px-3 py-1.5 rounded-lg font-bold shadow-lg transition-all uppercase text-[10px]">📸 Selfie</button>
                                            
                                            <button 
                                                onClick={() => setIsChatOpen(!isChatOpen)} 
                                                className={`${isChatOpen ? 'bg-green-600 hover:bg-green-500' : 'bg-gray-700/80 hover:bg-gray-600'} backdrop-blur-md text-white px-3 py-1.5 rounded-lg font-bold shadow-lg transition-all uppercase text-[10px] border border-white/10`}
                                            >
                                                💬 {isChatOpen ? 'Hide Chat' : 'Chat'}
                                            </button>

                                            <button 
                                                onClick={() => openBuilder('PERSONAL')} 
                                                className={`text-white px-3 py-1.5 rounded-lg font-bold shadow-lg transition-all uppercase text-[10px] backdrop-blur-md ${(!userId || isProfileLoading) ? 'bg-gray-600/50 cursor-not-allowed opacity-50' : 'bg-purple-600/80 hover:bg-purple-500'}`}
                                                disabled={!userId || isProfileLoading}
                                            >
                                                {isProfileLoading ? '...' : (!userId ? 'No Profile' : (userGalleryData ? '✎ Gallery' : '+ Create'))}
                                            </button>
                                            
                                            {isAdmin && (
                                                <>
                                                    <button onClick={() => openBuilder('CENTRAL')} className="bg-yellow-600/80 text-white px-3 py-1.5 rounded-lg font-bold shadow-lg hover:bg-yellow-500 transition-all uppercase text-[10px] border border-yellow-400/30">👑 Hall</button>
                                                    <button onClick={() => openBuilder('IRL')} className="bg-emerald-600/80 text-white px-3 py-1.5 rounded-lg font-bold shadow-lg hover:bg-emerald-500 transition-all uppercase text-[10px] border border-emerald-400/30">🎨 IRL</button>
                                                    <button onClick={() => setShowAdminDashboard(true)} className="bg-red-600/80 text-white px-3 py-1.5 rounded-lg font-bold shadow-lg hover:bg-red-500 transition-all uppercase text-[10px] border border-red-400/30">👑 Req</button>
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT: Wallet */}
                            <div className="flex flex-col items-end gap-2">
                                <div className="pointer-events-auto"><WalletMultiButton className="!bg-purple-600 hover:!bg-purple-500 !font-bold !rounded-lg !h-10 !text-xs" /></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="w-full flex justify-between items-start pointer-events-auto">
                        <div className="bg-black/50 p-2 rounded text-white text-xs backdrop-blur-md">📸 <b>SELFIE MODE</b></div>
                        <button onClick={() => setIsSelfieMode(false)} className="bg-white/10 text-white px-4 py-2 rounded-full font-bold hover:bg-white/20">✕ Close</button>
                    </div>
                )}

                <div className="pointer-events-auto flex justify-center items-end pb-4">
                    {isSelfieMode && (
                        <button onClick={handleScreenshot} className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 shadow-2xl hover:scale-110 transition-transform flex items-center justify-center group">
                            <div className="w-12 h-12 bg-transparent border-2 border-black/20 rounded-full group-hover:bg-gray-100" />
                        </button>
                    )}
                </div>
            </div>
        )}

        {/* 3D SCENE CONTAINER */}
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
                                irlData={irlItems}
                                
                                // Gamification Props
                                showArcade={showArcade}
                                setShowArcade={setShowArcade}
                                collectedItems={collectedItems}
                                onCollectItem={handleCollectItem}
                            />
                            
                            {!isSelfieMode && !showArcade && (
                                <div className={`absolute bottom-24 left-8 z-50 transition-opacity duration-300 ${isChatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
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
