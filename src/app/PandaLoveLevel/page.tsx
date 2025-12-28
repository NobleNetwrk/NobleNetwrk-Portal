'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'
import { SENSEI_HASHLIST } from '@/utils/hashlistLoader'

// Using your Helius RPC from env
const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || '';

interface PandaLoveData {
  id: string;
  name: string;
  image: string;
  daysHeld: number;
  level: string;
  color: string;
  progress: number;
}

export default function PandaLoveLevel() {
  const { publicKey, connected } = useWallet()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [pandas, setPandas] = useState<PandaLoveData[]>([])

  const getLevelInfo = (days: number) => {
    if (days >= 90) return { label: 'Soulmate', color: 'text-pink-500', next: null };
    if (days >= 30) return { label: 'Partner', color: 'text-purple-400', next: 90 };
    if (days >= 7) return { label: 'Friend', color: 'text-blue-400', next: 30 };
    return { label: 'Stranger', color: 'text-gray-400', next: 7 };
  }

  const fetchPandaLove = useCallback(async () => {
    if (!publicKey || !RPC_URL) return
    setLoading(true)

    try {
      const senseiSet = new Set(SENSEI_HASHLIST);
      
      // 1. Fetch all assets using Helius DAS
      const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'my-id',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: publicKey.toString(),
            page: 1,
            limit: 1000
          },
        }),
      });
      const { result } = await response.json();
      const myPandas = result.items.filter((asset: any) => senseiSet.has(asset.id));

      // 2. Map through Pandas and find true Acquisition Date
      const detailedPandas = await Promise.all(myPandas.map(async (panda: any) => {
        // Fetch signatures for this specific asset
        const sigResponse = await fetch(RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'history',
            method: 'getSignaturesForAddress',
            params: [panda.id, { limit: 20 }]
          }),
        });
        const sigData = await sigResponse.json();
        const history = sigData.result || [];

        /**
         * LOGIC: To avoid "0 days" from staking/unstaking, we look for 
         * the oldest signature in the recent history batch. 
         * Staking usually happens at the 'top' (index 0). 
         * The 'Sale' or initial transfer is usually further down.
         */
        const acquisitionTx = history.length > 0 ? history[history.length - 1] : null;
        const blockTime = acquisitionTx?.blockTime || Math.floor(Date.now() / 1000);
        
        const daysHeld = Math.floor((Date.now() / 1000 - blockTime) / 86400);
        const { label, color, next } = getLevelInfo(daysHeld);

        return {
          id: panda.id,
          name: panda.content?.metadata?.name || 'Sensei Panda',
          image: panda.content?.links?.image || panda.content?.files?.[0]?.uri || '',
          daysHeld,
          level: label,
          color,
          progress: next ? Math.min((daysHeld / next) * 100, 100) : 100
        };
      }));

      setPandas(detailedPandas);
    } catch (err) {
      console.error(err);
      toast.error('Error fetching Panda history');
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
        <button 
          onClick={() => router.push('/Portal')}
          className="mb-8 text-[10px] font-black uppercase text-gray-500 hover:text-white transition-colors tracking-widest"
        >
          ← Back to Portal
        </button>

        <h1 className="text-4xl font-black uppercase tracking-tighter mb-12">Panda Love Levels</h1>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-[10px] font-black text-gray-600 uppercase tracking-widest animate-pulse">Scanning Helius History...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {pandas.map((panda) => (
              <div key={panda.id} className="bg-gray-900/40 rounded-[2.5rem] border border-white/5 overflow-hidden shadow-2xl">
                <div className="relative aspect-square bg-black/20">
                  <img src={panda.image} alt={panda.name} className="w-full h-full object-cover" />
                  <div className="absolute top-6 right-6 bg-black/70 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${panda.color}`}>{panda.level}</p>
                  </div>
                </div>

                <div className="p-8">
                  <h3 className="text-xl font-black uppercase mb-6 tracking-tight">{panda.name}</h3>
                  
                  <div className="space-y-6">
                    <div className="flex justify-between items-center bg-black/40 p-4 rounded-2xl border border-white/5">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Days Held</span>
                      <span className="text-2xl font-black text-emerald-400">{panda.daysHeld}</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase text-gray-600 tracking-widest">
                        <span>Love Progress</span>
                        <span>{Math.floor(panda.progress)}%</span>
                      </div>
                      <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-1000" 
                          style={{ width: `${panda.progress}%` }}
                        />
                      </div>
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