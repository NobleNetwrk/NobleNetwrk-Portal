'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'
import senseiHashlist from '@/data/sensei_hashlist.json' // Direct import for O(1) lookup

// Collection started around June 28, 2024 (Unix: 1719532800)
const COLLECTION_START_TIME = 1719532800; 

// Convert Hashlist to Set for O(1) instant lookup
const SENSEI_SET = new Set(senseiHashlist);

interface PandaLoveData {
  id: string;
  name: string;
  image: string;
  daysHeld: number;
  loveScore: number; 
  levelLabel: string;
  color: string;
  isLoading?: boolean; // UI State for individual card loading
}

export default function PandaLoveLevel() {
  const { publicKey, connected } = useWallet()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pandas, setPandas] = useState<PandaLoveData[]>([])
  const [totalNobleLove, setTotalNobleLove] = useState(0)
  
  // Ref to prevent double-fetching in React 18 strict mode
  const isFetching = useRef(false)

  // --- Helpers ---

  // Helper: Find the PNG in the files array, fallback to default image (GIF)
  const getPngImage = (nft: any) => {
    const files = nft.content?.files;
    if (Array.isArray(files)) {
      const pngFile = files.find((f: any) => f.mime === 'image/png' || f.type === 'image/png');
      if (pngFile?.uri) return pngFile.uri;
    }
    // Fallback to default (usually GIF)
    return nft.content?.links?.image || nft.content?.files?.[0]?.uri || '';
  }

  const getLoveMetrics = useCallback((days: number) => {
    const now = Math.floor(Date.now() / 1000);
    const maxPossibleDays = Math.max(1, Math.floor((now - COLLECTION_START_TIME) / 86400));
    
    // Score out of 111 based on hold duration
    const score = Math.min(111, Math.floor((days / maxPossibleDays) * 111));
    
    let label = 'Stranger';
    let color = 'text-gray-400';

    if (score >= 100) { label = 'Soulmate'; color = 'text-pink-500'; }
    else if (score >= 75) { label = 'Partner'; color = 'text-purple-400'; }
    else if (score >= 40) { label = 'Friend'; color = 'text-blue-400'; }
    else if (score >= 10) { label = 'Acquaintance'; color = 'text-emerald-400'; }

    return { score, label, color };
  }, [])

  const fetchPandaLove = useCallback(async () => {
    if (!publicKey || isFetching.current) return
    isFetching.current = true
    setLoading(true)

    try {
      // 1. GET LINKED WALLETS (From Local Storage)
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

      console.log("🐼 Batch Scanning Wallets:", walletsToScan.length);

      // 2. BATCH FETCH ASSETS (1 API Call instead of N)
      // We use the same optimized route as the Portal
      const response = await fetch(`/api/holdings?wallets=${walletString}`);
      const json = await response.json();
      
      const foundPandas: any[] = [];
      
      if (json.data) {
        json.data.forEach((walletData: any) => {
           const nfts = walletData.nfts || [];
           // Filter for Sensei Pandas using Hashlist
           const matches = nfts.filter((nft: any) => {
             const id = nft.id;
             const group = nft.grouping?.[0]?.group_value;
             return SENSEI_SET.has(id) || SENSEI_SET.has(group);
           });
           foundPandas.push(...matches);
        });
      }

      // 3. INITIAL RENDER (Fastest Possible Paint)
      // Show cards immediately with images, even if score is loading
      const initialPandas: PandaLoveData[] = foundPandas.map(p => ({
        id: p.id,
        name: p.content?.metadata?.name || 'Sensei Panda',
        image: getPngImage(p), // <--- Uses PNG optimization
        daysHeld: 0,
        loveScore: 0,
        levelLabel: 'Calculating...',
        color: 'text-gray-500',
        isLoading: true
      }));

      setPandas(initialPandas);
      setLoading(false); // Stop main spinner, show individual loaders

      // 4. ASYNC ENRICHMENT (The "Love Score" calculation)
      let runningTotal = 0;
      const enrichedPandas = await Promise.all(initialPandas.map(async (panda) => {
        let referenceTime = Math.floor(Date.now() / 1000);
        const storageKey = `panda_history_${panda.id}`;

        // A. CHECK CACHE FIRST (Instant)
        const cachedTime = localStorage.getItem(storageKey);
        if (cachedTime) {
          referenceTime = parseInt(cachedTime);
        } else {
          // B. FETCH ONLY IF NOT CACHED (Slow, but rare)
          try {
            const proxyRes = await fetch(`/api/me-proxy?mint=${panda.id}`);
            if (proxyRes.ok) {
              const activities = await proxyRes.json();
              if (Array.isArray(activities) && activities.length > 0) {
                // Find last sale or transfer
                const recentEvent = activities.find((a: any) => 
                  a.type === 'buyNow' || a.type === 'acceptOffer' || a.type === 'list'
                );
                referenceTime = recentEvent ? recentEvent.blockTime : activities[0].blockTime;
                
                // Save to cache forever (history doesn't change for this owner unless sold)
                localStorage.setItem(storageKey, referenceTime.toString());
              }
            }
          } catch (e) { console.warn("ME API Error", e) }
        }

        const now = Math.floor(Date.now() / 1000);
        const daysHeld = Math.max(0, Math.floor((now - referenceTime) / 86400));
        const metrics = getLoveMetrics(daysHeld);

        runningTotal += metrics.score;

        return {
          ...panda,
          daysHeld,
          loveScore: metrics.score,
          levelLabel: metrics.label,
          color: metrics.color,
          isLoading: false
        };
      }));

      setPandas(enrichedPandas);
      setTotalNobleLove(runningTotal);

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
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div>
            <button onClick={() => router.push('/Portal')} className="mb-4 text-[10px] font-black uppercase text-gray-500 hover:text-white tracking-widest block">
              ← Back to Portal
            </button>
            <h1 className="text-5xl font-black uppercase tracking-tighter">Panda Love Level</h1>
          </div>

          {!loading && (
            <div className="bg-gradient-to-br from-pink-600/20 to-purple-600/20 border border-pink-500/30 p-8 rounded-[2.5rem] backdrop-blur-2xl shadow-[0_0_50px_-12px_rgba(236,72,153,0.3)]">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-pink-400 mb-2">Total Noble Love Score</p>
              <p className="text-5xl font-black text-white italic tracking-tighter">{totalNobleLove}</p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-[10px] font-black text-gray-600 uppercase tracking-widest animate-pulse">Calculating Love Levels...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pandas.map((panda) => (
              <div key={panda.id} className="group bg-gray-900/40 rounded-[3rem] border border-white/5 overflow-hidden transition-all hover:border-pink-500/40 shadow-2xl">
                <div className="relative aspect-square">
                  {/* Optimized Image Loading */}
                  <img 
                    src={panda.image} 
                    alt={panda.name} 
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-80" />
                  
                  <div className="absolute top-8 right-8 bg-black/80 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/10 shadow-xl">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${panda.color}`}>
                        {panda.isLoading ? <span className="animate-pulse">...</span> : panda.levelLabel}
                    </p>
                  </div>
                </div>

                <div className="p-8 -mt-16 relative z-10">
                  <h3 className="text-2xl font-black uppercase mb-6 tracking-tight text-white/90">{panda.name}</h3>
                  <div className="bg-black/80 p-6 rounded-[2rem] border border-white/10 space-y-5 backdrop-blur-2xl shadow-inner">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] block">Love Score</span>
                        <span className="text-4xl font-black text-white tracking-tighter">
                          {panda.isLoading ? <span className="text-gray-600 text-2xl">Syncing...</span> : panda.loveScore}
                          <span className="text-base text-pink-500/40 ml-2 font-black italic">/ 111</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] block">Days Held</span>
                        <span className="text-xl font-black text-gray-300 tracking-tighter">
                            {panda.isLoading ? '-' : panda.daysHeld}
                        </span>
                      </div>
                    </div>
                    
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden p-[2px] border border-white/5">
                      <div 
                        className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 transition-all duration-1000 rounded-full" 
                        style={{ width: `${(panda.loveScore / 111) * 100}%` }}
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