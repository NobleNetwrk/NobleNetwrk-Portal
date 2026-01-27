'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'
import senseiHashlist from '@/data/sensei_hashlist.json' 
import Image from 'next/image'

// Collection started around June 28, 2024 (Unix: 1719532800)
const COLLECTION_START_TIME = 1719532800; 

// Convert Hashlist to Set for O(1) instant lookup
const SENSEI_SET = new Set(senseiHashlist);

interface PandaLoveData {
  id: string;
  name: string;
  image: string;
  daysHeld: number;
  loveLevel: number; 
  levelLabel: string;
  colorClass: string; // Changed from 'color' to 'colorClass' for Tailwind classes
  borderColor: string;
  isLoading?: boolean; 
}

export default function PandaLoveLevel() {
  const { publicKey, connected } = useWallet()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pandas, setPandas] = useState<PandaLoveData[]>([])
  const [totalPandaLevel, setTotalPandaLevel] = useState(0)
  
  const isFetching = useRef(false)

  // --- Helpers ---

  const getPngImage = (nft: any) => {
    const files = nft.content?.files;
    if (Array.isArray(files)) {
      const pngFile = files.find((f: any) => f.mime === 'image/png' || f.type === 'image/png');
      if (pngFile?.uri) return pngFile.uri;
    }
    return nft.content?.links?.image || nft.content?.files?.[0]?.uri || '';
  }

  const getLoveMetrics = useCallback((days: number) => {
    const now = Math.floor(Date.now() / 1000);
    const maxPossibleDays = Math.max(1, Math.floor((now - COLLECTION_START_TIME) / 86400));
    
    // Level out of 111 based on hold duration
    const level = Math.min(111, Math.floor((days / maxPossibleDays) * 111));
    
    // --- UPDATED: Noble Metal Hierarchy instead of Rainbow Colors ---
    let label = 'Stranger';
    let colorClass = 'text-gray-600';
    let borderColor = 'border-white/5';

    if (level >= 100) { 
        label = 'Soulmate'; 
        colorClass = 'text-[#c5a059] drop-shadow-[0_0_8px_rgba(197,160,89,0.5)]'; // Glowing Gold
        borderColor = 'border-[#c5a059]';
    }
    else if (level >= 75) { 
        label = 'Partner'; 
        colorClass = 'text-gray-200'; // Silver/Platinum
        borderColor = 'border-gray-400/50';
    }
    else if (level >= 40) { 
        label = 'Friend'; 
        colorClass = 'text-[#927035]'; // Bronze/Dark Gold
        borderColor = 'border-[#927035]/50';
    }
    else if (level >= 10) { 
        label = 'Acquaintance'; 
        colorClass = 'text-gray-500'; // Iron/Steel
        borderColor = 'border-white/10';
    }

    return { level, label, colorClass, borderColor };
  }, [])

  const fetchPandaLove = useCallback(async () => {
    if (!publicKey || isFetching.current) return
    isFetching.current = true
    setLoading(true)

    try {
      const storedWallets = localStorage.getItem('noble_wallets');
      const activeAddress = publicKey.toBase58();
      const walletSet = new Set<string>([activeAddress]);

      if (storedWallets) {
        try {
          const parsed = JSON.parse(storedWallets);
          if (Array.isArray(parsed)) {
            parsed.forEach((w: any) => {
              if (typeof w === 'string') walletSet.add(w);
              else if (w.address) walletSet.add(w.address);
            });
          }
        } catch (err) { console.warn("Wallet parse error", err) }
      }

      const walletsToScan = Array.from(walletSet);
      const walletString = walletsToScan.join(',');

      const response = await fetch(`/api/holdings?wallets=${walletString}`);
      const json = await response.json();
      
      const foundPandas: any[] = [];
      
      if (json.data) {
        json.data.forEach((walletData: any) => {
           const nfts = walletData.nfts || [];
           const matches = nfts.filter((nft: any) => {
             const id = nft.id;
             const group = nft.grouping?.[0]?.group_value;
             return SENSEI_SET.has(id) || SENSEI_SET.has(group);
           });
           foundPandas.push(...matches);
        });
      }

      const initialPandas: PandaLoveData[] = foundPandas.map(p => ({
        id: p.id,
        name: p.content?.metadata?.name || 'Sensei Panda',
        image: getPngImage(p),
        daysHeld: 0,
        loveLevel: 0,
        levelLabel: 'Calculating...',
        colorClass: 'text-gray-500',
        borderColor: 'border-white/5',
        isLoading: true
      }));

      setPandas(initialPandas);
      setLoading(false);

      let runningTotal = 0;
      
      const enrichedPandas = await Promise.all(initialPandas.map(async (panda) => {
        let referenceTime = Math.floor(Date.now() / 1000);
        const storageKey = `panda_history_${panda.id}`;

        const cachedTime = localStorage.getItem(storageKey);
        if (cachedTime) {
          referenceTime = parseInt(cachedTime);
        } else {
          try {
            const proxyRes = await fetch(`/api/me-proxy?mint=${panda.id}`);
            if (proxyRes.ok) {
              const activities = await proxyRes.json();
              if (Array.isArray(activities) && activities.length > 0) {
                const recentEvent = activities.find((a: any) => 
                  a.type === 'buyNow' || a.type === 'acceptOffer' || a.type === 'list'
                );
                referenceTime = recentEvent ? recentEvent.blockTime : activities[0].blockTime;
                localStorage.setItem(storageKey, referenceTime.toString());
              }
            }
          } catch (e) { console.warn("ME API Error", e) }
        }

        const now = Math.floor(Date.now() / 1000);
        const daysHeld = Math.max(0, Math.floor((now - referenceTime) / 86400));
        const metrics = getLoveMetrics(daysHeld);

        runningTotal += metrics.level;

        return {
          ...panda,
          daysHeld,
          loveLevel: metrics.level,
          levelLabel: metrics.label,
          colorClass: metrics.colorClass,
          borderColor: metrics.borderColor,
          isLoading: false
        };
      }));

      // SORTING LOGIC: Order by Highest Days Held
      const sortedPandas = enrichedPandas.sort((a, b) => b.daysHeld - a.daysHeld);

      setPandas(sortedPandas);
      setTotalPandaLevel(runningTotal);

    } catch (err) {
      console.error(err);
      toast.error('Failed to sync Panda Data');
      setLoading(false);
    } finally {
      isFetching.current = false;
    }
  }, [publicKey, getLoveMetrics])

  useEffect(() => {
    if (connected) fetchPandaLove();
  }, [connected, fetchPandaLove])

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white p-6 relative overflow-hidden">
       {/* Ambient Glow Background */}
       <div className="fixed top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[#c5a059]/5 rounded-full blur-[120px] pointer-events-none" />
       
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-8">
          <div>
            <button 
                onClick={() => router.push('/Portal')} 
                className="mb-4 text-[10px] font-black uppercase text-gray-500 hover:text-[#c5a059] tracking-widest flex items-center gap-2 transition-colors"
            >
              <span className="text-lg">←</span> Back to Portal
            </button>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
                Panda <span className="text-[#c5a059]">Love Level</span>
            </h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-2">
                Measure the loyalty of your Sensei Pandas
            </p>
          </div>

          {!loading && (
            <div className="bg-gradient-to-br from-[#1a1a1c] to-[#0a0a0b] border border-[#c5a059]/20 p-8 rounded-[2.5rem] backdrop-blur-2xl shadow-2xl group hover:border-[#c5a059]/40 transition-all">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#c5a059] mb-2 opacity-80">Total Love Score</p>
              <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 italic tracking-tighter">
                {totalPandaLevel.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-6 text-[10px] font-black text-[#c5a059] uppercase tracking-widest animate-pulse">Calculating Love Levels...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pandas.map((panda) => (
              <div key={panda.id} className={`group bg-[#141416] rounded-[2.5rem] border overflow-hidden transition-all hover:scale-[1.02] shadow-xl hover:shadow-2xl hover:shadow-[#c5a059]/10 ${panda.borderColor}`}>
                
                {/* IMAGE CONTAINER */}
                <div className="relative aspect-square">
                  <Image 
                    src={panda.image} 
                    alt={panda.name} 
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-110" 
                  />
                  {/* Dark Gradient Overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#141416] via-transparent to-transparent opacity-90" />
                  
                  {/* STATUS BADGE */}
                  <div className="absolute top-6 right-6 bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg">
                    <p className={`text-[9px] font-black uppercase tracking-widest ${panda.colorClass}`}>
                        {panda.isLoading ? <span className="animate-pulse">Syncing...</span> : panda.levelLabel}
                    </p>
                  </div>
                </div>

                {/* CONTENT CARD */}
                <div className="p-8 -mt-20 relative z-10">
                  <h3 className="text-xl font-black uppercase mb-6 tracking-wide text-white drop-shadow-md truncate">{panda.name}</h3>
                  
                  <div className="bg-[#0a0a0b]/80 p-6 rounded-[2rem] border border-white/5 space-y-5 backdrop-blur-md shadow-inner">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] block">Love Level</span>
                        <span className="text-3xl font-black text-white tracking-tighter">
                          {panda.isLoading ? <span className="text-gray-600 text-xl">...</span> : panda.loveLevel}
                          <span className="text-sm text-gray-600 ml-1 font-bold">/ 111</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] block">Held</span>
                        <span className="text-lg font-black text-[#c5a059] tracking-tighter">
                            {panda.isLoading ? '-' : `${panda.daysHeld}d`}
                        </span>
                      </div>
                    </div>
                    
                    {/* NOBLE GOLD PROGRESS BAR */}
                    <div className="h-2 w-full bg-[#1a1a1c] rounded-full overflow-hidden p-[1px] border border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-[#927035] via-[#c5a059] to-white transition-all duration-1000 rounded-full shadow-[0_0_10px_rgba(197,160,89,0.5)]" 
                        style={{ width: `${(panda.loveLevel / 111) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}