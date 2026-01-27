'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { Transaction } from '@solana/web3.js'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'
import { K9_HASHLIST } from '@/config/k9hashlist'
import { WEEKLY_INTEREST_RATE } from '@/config/k9-constants'

interface K9Asset {
  id: string;
  name: string;
  image: string;
  locked: boolean;
  lockDate?: string;
  unlockCost?: number;
  owner: string; 
}

// Convert hashlist to Set once for O(1) performance
const k9MintSet = new Set(K9_HASHLIST)

export default function K9Impound() {
  const { publicKey, connected, signTransaction } = useWallet() 
  const { connection } = useConnection()
  const router = useRouter()

  // --- State ---
  const [k9Nfts, setK9Nfts] = useState<K9Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNfts, setSelectedNfts] = useState<string[]>([])
  
  // Modals & Processing
  const [showLockModal, setShowLockModal] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [selectedForUnlock, setSelectedForUnlock] = useState<K9Asset | null>(null)
  const [processing, setProcessing] = useState(false)
  
  // System Data
  const [payoutRate, setPayoutRate] = useState(100000)
  
  const isFetching = useRef(false)

  // --- Helpers ---

  const calculateUnlockCost = useCallback((lockDate: string, rate: number) => {
    const elapsed = Date.now() - new Date(lockDate).getTime()
    const weeks = Math.max(0, Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000)))
    const interest = (rate * (weeks * WEEKLY_INTEREST_RATE)) / 100
    return rate + interest
  }, [])

  // --- OPTIMIZED DATA FETCHING ---

  const fetchSystemData = useCallback(async () => {
    let rate = 100000
    try {
      const res = await fetch('/api/admin/settings')
      const data = await res.json()
      if (data.value) {
        rate = Number(data.value)
        setPayoutRate(rate)
      }
    } catch (e) { console.warn("Using default rate") }
    return rate
  }, [])

  const fetchAllData = useCallback(async (forceRefresh = false) => {
    if (!publicKey || isFetching.current) return
    isFetching.current = true
    setLoading(true)

    try {
      const storedWallets = localStorage.getItem('noble_wallets')
      const walletSet = new Set<string>([publicKey.toString()])
      if (storedWallets) {
        try {
          const parsed = JSON.parse(storedWallets)
          if (Array.isArray(parsed)) parsed.forEach(w => walletSet.add(w))
        } catch (e) { console.warn("Storage parse error", e) }
      }
      const walletsToScan = Array.from(walletSet)
      const walletString = walletsToScan.join(',')
      
      const cacheKey = `k9_vault_${walletString}`
      if (!forceRefresh) {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Date.now() - parsed.timestamp < 1000 * 60 * 5) {
            setK9Nfts(parsed.data)
            fetchSystemData().then(r => setPayoutRate(r))
            setLoading(false)
            isFetching.current = false
            return
          }
        }
      }

      const currentRate = await fetchSystemData() 
      
      const grandTotalAssets: K9Asset[] = []

      const lockedResults = await Promise.all(walletsToScan.map(async (address) => {
         try {
           const res = await fetch(`/api/k9/locked?owner=${address}`)
           const data = await res.json()
           return (data.lockedK9s || []).map((l: any) => ({
             id: l.mint,
             name: l.name || `K9 #${l.mint.slice(0, 4)}`,
             image: l.image || '/solana-k9s-icon.png',
             locked: true,
             lockDate: l.lockDate,
             unlockCost: calculateUnlockCost(l.lockDate, currentRate),
             owner: address 
           }))
         } catch { return [] }
      }))
      lockedResults.flat().forEach(item => grandTotalAssets.push(item))

      try {
        const batchRes = await fetch(`/api/holdings?wallets=${walletString}`)
        const batchData = await batchRes.json()
        
        if (batchData.data) {
          batchData.data.forEach((walletResult: any) => {
            const rawNfts = walletResult.nfts || []
            const k9s = rawNfts
              .filter((nft: any) => {
                const id = nft.id
                const group = nft.grouping?.[0]?.group_value
                return k9MintSet.has(id) || k9MintSet.has(group)
              })
              .map((nft: any) => ({
                id: nft.id,
                name: nft.content?.metadata?.name || `K9 #${nft.id.slice(0,4)}`,
                image: nft.content?.links?.image || nft.content?.files?.[0]?.uri || '/solana-k9s-icon.png',
                locked: false,
                owner: walletResult.wallet
              }))
            grandTotalAssets.push(...k9s)
          })
        }
      } catch (e) { console.error("Batch fetch failed", e) }

      setK9Nfts(grandTotalAssets)
      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: grandTotalAssets
      }))

    } catch (e) { 
      toast.error("Failed to sync vault")
      console.error(e)
    } finally { 
      setLoading(false)
      isFetching.current = false 
    }
  }, [publicKey, calculateUnlockCost, fetchSystemData])

  useEffect(() => {
    if (connected && publicKey) fetchAllData()
  }, [connected, publicKey, fetchAllData])

  // --- ACTIONS ---

  const handleLock = async () => {
    if (!publicKey || !signTransaction) return;

    const wrongWalletAssets = k9Nfts.filter(n => selectedNfts.includes(n.id) && n.owner !== publicKey.toString())
    if (wrongWalletAssets.length > 0) {
      toast.warn(`Please switch to wallet ${wrongWalletAssets[0].owner.slice(0,6)}... to impound ${wrongWalletAssets[0].name}`)
      return
    }

    setProcessing(true);
    try {
      const nftsToLock = k9Nfts
        .filter(n => selectedNfts.includes(n.id))
        .map(n => ({ mint: n.id, name: n.name, image: n.image }));

      const res = await fetch('/api/k9/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: publicKey.toString(), nfts: nftsToLock })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const tx = Transaction.from(Buffer.from(data.transaction, 'base64'));
      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), { 
        skipPreflight: false, 
        preflightCommitment: 'confirmed' 
      });
      
      await connection.confirmTransaction(signature, 'confirmed');

      await fetch('/api/k9/lock', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signature, owner: publicKey.toString(), nfts: nftsToLock })
      });

      toast.success("K9s Impounded successfully!");
      fetchAllData(true); 
      setShowLockModal(false);
      setSelectedNfts([]);
    } catch (e: any) { 
      console.error("Locking Error:", e);
      toast.error(e.message || "Impound failed.");
    } finally { setProcessing(false) }
  };

  const handleUnlock = async () => {
    if (!selectedForUnlock || !publicKey || !signTransaction) return;

    if (selectedForUnlock.owner !== publicKey.toString()) {
      toast.warn(`Please switch to wallet ${selectedForUnlock.owner.slice(0,6)}... to rescue this K9`);
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch('/api/k9/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: publicKey.toString(), mint: selectedForUnlock.id, cost: selectedForUnlock.unlockCost })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const tx = Transaction.from(Buffer.from(data.transaction, 'base64'));
      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: false });
      
      await connection.confirmTransaction(signature, 'confirmed');
      
      toast.success("K9 Rescued!");
      setShowUnlockModal(false);
      setTimeout(() => fetchAllData(true), 2000); 
    } catch (e: any) { toast.error(e.message || "Rescue failed") }
    finally { setProcessing(false) }
  };

  if (!connected) return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center font-black text-[#c5a059] uppercase tracking-widest">Connect Wallet to access Impound</div>

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white p-4 md:p-8 relative overflow-hidden">
       {/* Background Ambient Glow */}
       <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#c5a059]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <div className="relative">
                <Image src="/solana-k9s-icon.png" alt="Logo" width={64} height={64} className="rounded-full border-2 border-[#c5a059] shadow-[0_0_15px_rgba(197,160,89,0.3)]" />
                <div className="absolute -bottom-1 -right-1 bg-[#c5a059] text-black text-[10px] font-black px-2 py-0.5 rounded-full">VAULT</div>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase text-white">K9 <span className="text-[#c5a059]">Impound</span></h1>
              <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Secured Liquidity Protocol</p>
            </div>
          </div>
          <div className="flex gap-4">
             <button onClick={() => router.push('/Portal')} className="bg-[#141416] border border-white/5 hover:border-[#c5a059]/50 text-gray-400 hover:text-[#c5a059] px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Back to Portal</button>
          </div>
        </header>

        {/* How It Works (Premium Gold Edition) */}
        <section className="mb-16 bg-[#141416] border border-[#c5a059]/20 rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#c5a059]/5 blur-[60px] rounded-full pointer-events-none" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-10">
                <div>
                    <h2 className="text-2xl font-black mb-4 uppercase tracking-tighter flex items-center gap-3 text-[#c5a059]">
                        <span className="w-8 h-8 bg-[#c5a059]/20 border border-[#c5a059] rounded-full flex items-center justify-center text-sm font-serif italic">i</span>
                        The Noble Vault
                    </h2>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6 font-medium">
                        Liquidity without liquidation. Deposit your K9 into our secured vault to receive instant $NTWRK. Your asset remains safe and unlisted until you are ready to reclaim it.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-black/40 p-6 rounded-3xl border border-white/5 hover:border-[#c5a059]/30 transition-colors">
                        <p className="text-[#c5a059] font-black text-xs uppercase mb-2">1. Instant Deposit</p>
                        <p className="text-[10px] text-gray-500 leading-tight">Receive <span className="text-white font-bold">{payoutRate.toLocaleString()} $NTWRK</span> instantly.</p>
                    </div>
                    <div className="bg-black/40 p-6 rounded-3xl border border-white/5 hover:border-[#c5a059]/30 transition-colors">
                        <p className="text-gray-200 font-black text-xs uppercase mb-2">2. Secure Custody</p>
                        <p className="text-[10px] text-gray-500 leading-tight">Asset held in escrow. Never listed on floor.</p>
                    </div>
                </div>
            </div>
        </section>

        {loading ? <div className="flex justify-center h-64"><LoadingSpinner size="lg" /></div> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            
            {/* UNLOCKED ASSETS */}
            <section>
              <h2 className="text-xl font-black mb-6 flex items-center gap-2 uppercase tracking-tighter text-white">
                <span className="w-2 h-2 bg-[#c5a059] rounded-full animate-pulse shadow-[0_0_10px_#c5a059]"></span> Available K9s
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {k9Nfts.filter(n => !n.locked).map(nft => (
                  <div 
                    key={nft.id} 
                    onClick={() => setSelectedNfts(prev => prev.includes(nft.id) ? prev.filter(i => i !== nft.id) : [...prev, nft.id])} 
                    className={`p-3 rounded-[2rem] border transition-all cursor-pointer bg-[#141416] relative group hover:shadow-lg hover:shadow-[#c5a059]/5 ${selectedNfts.includes(nft.id) ? 'border-[#c5a059] shadow-[0_0_15px_rgba(197,160,89,0.2)]' : 'border-white/5 hover:border-[#c5a059]/30'}`}
                  >
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-3">
                        <Image src={nft.image} alt="k9" fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                    <p className="text-[10px] font-black uppercase text-gray-400 truncate text-center group-hover:text-gray-200">{nft.name}</p>
                    
                    {nft.owner !== publicKey?.toString() && (
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-[8px] font-bold text-[#c5a059] border border-[#c5a059]/30">
                        {nft.owner.slice(0, 4)}...
                      </div>
                    )}

                    <div className="mt-2 bg-[#c5a059]/10 py-1.5 rounded-xl text-center border border-[#c5a059]/20">
                        <p className="text-[10px] font-black text-[#c5a059]">+{payoutRate.toLocaleString()} NTWRK</p>
                    </div>
                  </div>
                ))}
              </div>
              {selectedNfts.length > 0 && (
                  <button 
                    onClick={() => setShowLockModal(true)} 
                    className="w-full mt-8 bg-gradient-to-r from-[#c5a059] to-[#927035] hover:brightness-110 text-black py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-lg shadow-[#c5a059]/20 active:scale-95 transition-all"
                  >
                      IMPOUND {selectedNfts.length} K9s
                  </button>
              )}
            </section>

            {/* LOCKED ASSETS */}
            <section>
              <h2 className="text-xl font-black mb-6 flex items-center gap-2 uppercase tracking-tighter text-gray-400">
                <span className="w-2 h-2 bg-gray-600 rounded-full"></span> Locked in Vault
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {k9Nfts.filter(n => n.locked).map(nft => (
                  <div key={nft.id} className="p-3 rounded-[2rem] bg-black/40 border border-white/5 transition-all relative group">
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 opacity-60 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0">
                        <Image src={nft.image} alt="k9" fill className="object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <svg className="w-8 h-8 text-[#c5a059] drop-shadow-md" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                        </div>
                    </div>
                    <p className="text-[10px] font-black text-gray-600 truncate text-center">{nft.name}</p>

                    {nft.owner !== publicKey?.toString() && (
                      <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-[8px] font-bold text-[#c5a059] border border-[#c5a059]/30">
                        {nft.owner.slice(0, 4)}...
                      </div>
                    )}

                    <div className="mt-2 bg-[#c5a059]/5 p-2 rounded-xl text-center border border-white/5">
                        <p className="text-xs font-black text-gray-400">Cost: <span className="text-[#c5a059]">{nft.unlockCost?.toLocaleString()}</span></p>
                    </div>
                    <button 
                        onClick={() => { setSelectedForUnlock(nft); setShowUnlockModal(true); }} 
                        className="w-full mt-3 bg-[#141416] hover:bg-[#1f1f22] border border-[#c5a059]/30 hover:border-[#c5a059] text-[#c5a059] py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                    >
                        RESCUE
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* LOCK MODAL */}
      {showLockModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#141416] border border-[#c5a059]/30 p-10 rounded-[3rem] max-w-sm w-full shadow-2xl shadow-[#c5a059]/10 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#927035] via-[#c5a059] to-[#927035]" />
            <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter text-white">Confirm Impound?</h3>
            <p className="text-gray-500 text-sm mb-8">Receive <span className="text-[#c5a059] font-black">{(selectedNfts.length * payoutRate).toLocaleString()} $NTWRK</span> instantly.</p>
            <button 
                disabled={processing} 
                onClick={handleLock} 
                className="w-full bg-gradient-to-r from-[#c5a059] to-[#927035] hover:brightness-110 text-black py-5 rounded-3xl font-black tracking-widest text-xs transition-all shadow-lg"
            >
                {processing ? "PROCESSING..." : "CONFIRM"}
            </button>
            <button onClick={() => setShowLockModal(false)} className="w-full text-gray-500 hover:text-white font-bold text-xs uppercase tracking-widest py-4 transition-colors">Cancel</button>
          </div>
        </div>
      )}

      {/* UNLOCK MODAL */}
      {showUnlockModal && selectedForUnlock && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#141416] border border-[#c5a059]/30 p-10 rounded-[3rem] max-w-sm w-full text-center shadow-2xl shadow-[#c5a059]/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#927035] via-[#c5a059] to-[#927035]" />
            <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter text-white">Rescue <span className="text-[#c5a059]">{selectedForUnlock.name}</span></h3>
            <div className="bg-[#0a0a0b] p-8 rounded-[2rem] my-8 border border-[#c5a059]/20 text-center">
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-1">Repayment Cost</p>
                <p className="text-3xl font-black text-white">{selectedForUnlock.unlockCost?.toLocaleString()} <span className="text-sm text-[#c5a059]">$NTWRK</span></p>
            </div>
            <button 
                disabled={processing} 
                onClick={handleUnlock} 
                className="w-full bg-gradient-to-r from-[#c5a059] to-[#927035] hover:brightness-110 text-black py-5 rounded-3xl font-black tracking-widest text-xs shadow-lg"
            >
                {processing ? "PROCESSING..." : "PAY & RESCUE"}
            </button>
            <button onClick={() => setShowUnlockModal(false)} className="w-full text-gray-500 hover:text-white font-bold text-xs uppercase tracking-widest py-4 transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </main>
  )
}