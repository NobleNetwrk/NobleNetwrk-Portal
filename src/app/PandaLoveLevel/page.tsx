'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'
import { SENSEI_HASHLIST } from '@/utils/hashlistLoader'

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || '';
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Collection started around June 28, 2024 (Unix: 1719532800)
const COLLECTION_START_TIME = 1719532800; 

interface PandaLoveData {
  id: string;
  name: string;
  image: string;
  daysHeld: number;
  loveScore: number; 
  levelLabel: string;
  color: string;
}

export default function PandaLoveLevel() {
  const { publicKey, connected } = useWallet()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pandas, setPandas] = useState<PandaLoveData[]>([])
  const [totalNobleLove, setTotalNobleLove] = useState(0)

  const getLoveMetrics = (days: number) => {
    const now = Math.floor(Date.now() / 1000);
    const maxPossibleDays = Math.max(1, Math.floor((now - COLLECTION_START_TIME) / 86400));
    
    // Score out of 111 based on hold duration since last activity
    const score = Math.min(111, Math.floor((days / maxPossibleDays) * 111));
    
    let label = 'Stranger';
    let color = 'text-gray-400';

    if (score >= 100) { label = 'Soulmate'; color = 'text-pink-500'; }
    else if (score >= 75) { label = 'Partner'; color = 'text-purple-400'; }
    else if (score >= 40) { label = 'Friend'; color = 'text-blue-400'; }
    else if (score >= 10) { label = 'Acquaintance'; color = 'text-emerald-400'; }

    return { score, label, color };
  }

  const fetchPandaLove = useCallback(async () => {
    if (!publicKey || !RPC_URL) return
    setLoading(true)

    try {
      const senseiSet = new Set(SENSEI_HASHLIST);
      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'my-id',
          method: 'getAssetsByOwner',
          params: { ownerAddress: publicKey.toString(), page: 1, limit: 1000 },
        }),
      });
      const { result } = await response.json();
      const myPandas = result.items.filter((asset: any) => senseiSet.has(asset.id));

      const detailedResults: PandaLoveData[] = [];
      let runningTotalLove = 0;

      for (const panda of myPandas) {
        let referenceTime = Math.floor(Date.now() / 1000);

        try {
          await delay(150); // Prevent Bridge Errors / Rate Limits
          const proxyRes = await fetch(`/api/me-proxy?mint=${panda.id}`);
          const activities = await proxyRes.json();
          
          if (proxyRes.ok && Array.isArray(activities) && activities.length > 0) {
            /** * RESTORED LOGIC: Find the MOST RECENT sale or listing.
             * ME returns NEWEST activities at index [0].
             */
            const recentEvent = activities.find((a: any) => 
              a.type === 'buyNow' || a.type === 'acceptOffer' || a.type === 'list'
            );

            if (recentEvent) {
              referenceTime = recentEvent.blockTime;
            } else {
              // Fallback to the newest activity available
              referenceTime = activities[0].blockTime;
            }
          }
        } catch (err) {
          console.error("ME Proxy error", err);
        }
        
        const now = Math.floor(Date.now() / 1000);
        const daysHeld = Math.max(0, Math.floor((now - referenceTime) / 86400));
        const { score, label, color } = getLoveMetrics(daysHeld);

        runningTotalLove += score;

        detailedResults.push({
          id: panda.id,
          name: panda.content?.metadata?.name || 'Sensei Panda',
          image: panda.content?.links?.image || panda.content?.files?.[0]?.uri || '',
          daysHeld,
          loveScore: score,
          levelLabel: label,
          color
        });
      }

      setPandas(detailedResults);
      setTotalNobleLove(runningTotalLove);
    } catch (err) {
      console.error(err);
      toast.error('Failed to calculate Noble Love');
    } finally {
      setLoading(false)
    }
  }, [publicKey])

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
                  <img src={panda.image} alt={panda.name} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-transparent opacity-80" />
                  <div className="absolute top-8 right-8 bg-black/80 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/10 shadow-xl">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${panda.color}`}>{panda.levelLabel}</p>
                  </div>
                </div>

                <div className="p-8 -mt-16 relative z-10">
                  <h3 className="text-2xl font-black uppercase mb-6 tracking-tight text-white/90">{panda.name}</h3>
                  <div className="bg-black/80 p-6 rounded-[2rem] border border-white/10 space-y-5 backdrop-blur-2xl shadow-inner">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] block">Love Score</span>
                        <span className="text-4xl font-black text-white tracking-tighter">
                          {panda.loveScore}
                          <span className="text-base text-pink-500/40 ml-2 font-black italic">/ 111</span>
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.15em] block">Days Held</span>
                        <span className="text-xl font-black text-gray-300 tracking-tighter">{panda.daysHeld}</span>
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