'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction } from '@solana/web3.js'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'
import { K9_HASHLIST } from '@/config/k9hashlist'
import { WEEKLY_INTEREST_RATE, NTWRK_MINT_ADDRESS } from '@/config/k9-constants'

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
    // 1. Get System Settings (Payout Rate)
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
      // 1. Get Linked Wallets from Local Storage
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
      
      // 2. CHECK CACHE (Efficiency Boost)
      const cacheKey = `k9_vault_${walletString}`
      if (!forceRefresh) {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          const parsed = JSON.parse(cached)
          // Cache valid for 5 minutes (Vault data changes less often than prices)
          if (Date.now() - parsed.timestamp < 1000 * 60 * 5) {
            console.log("⚡ Loaded K9s from cache")
            setK9Nfts(parsed.data)
            // Fetch system rate in background without blocking UI
            fetchSystemData().then(r => setPayoutRate(r))
            setLoading(false)
            isFetching.current = false
            return
          }
        }
      }

      // 3. FETCH FRESH DATA
      const currentRate = await fetchSystemData() // Ensure we have rate for calc
      
      const grandTotalAssets: K9Asset[] = []

      // A. Fetch Locked K9s (Parallel DB Calls)
      // Since these are internal DB calls, they are fast.
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

      // B. Fetch Unlocked K9s (BATCH API Call)
      // Instead of hitting RPC directly, we ask our efficient backend
      try {
        const batchRes = await fetch(`/api/holdings?wallets=${walletString}`)
        const batchData = await batchRes.json()
        
        if (batchData.data) {
          batchData.data.forEach((walletResult: any) => {
            const rawNfts = walletResult.nfts || []
            // Filter RAW data for K9s
            const k9s = rawNfts
              .filter((nft: any) => {
                const id = nft.id
                const group = nft.grouping?.[0]?.group_value
                return k9MintSet.has(id) || k9MintSet.has(group)
              })
              .map((nft: any) => ({
                id: nft.id,
                name: nft.content?.metadata?.name || `K9 #${nft.id.slice(0,4)}`,
                // Use Helius CDN image or fallback
                image: nft.content?.links?.image || nft.content?.files?.[0]?.uri || '/solana-k9s-icon.png',
                locked: false,
                owner: walletResult.wallet
              }))
            grandTotalAssets.push(...k9s)
          })
        }
      } catch (e) { console.error("Batch fetch failed", e) }

      // 4. Update State & Cache
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

    // Validation
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

      // Transaction
      const tx = Transaction.from(Buffer.from(data.transaction, 'base64'));
      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), { 
        skipPreflight: false, 
        preflightCommitment: 'confirmed' 
      });
      
      await connection.confirmTransaction(signature, 'confirmed');

      // Finalize in DB
      await fetch('/api/k9/lock', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signature, owner: publicKey.toString(), nfts: nftsToLock })
      });

      toast.success("K9s Impounded successfully!");
      fetchAllData(true); // Force refresh to update UI immediately
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
      setTimeout(() => fetchAllData(true), 2000); // Wait a moment for blockchain to index, then force refresh
    } catch (e: any) { toast.error(e.message || "Rescue failed") }
    finally { setProcessing(false) }
  };

  if (!connected) return <div className="min-h-screen flex items-center justify-center font-black text-gray-500">Connect Wallet to access Impound</div>

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <Image src="/solana-k9s-icon.png" alt="Logo" width={64} height={64} className="rounded-full border-2 border-blue-500 shadow-lg" />
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase">K9 Impound</h1>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Secured Vault Protocol</p>
            </div>
          </div>
          <div className="flex gap-4">
             <button onClick={() => router.push('/Portal')} className="bg-gray-900 border border-white/5 hover:bg-gray-800 text-gray-400 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Back to Portal</button>
          </div>
        </header>

        {/* How It Works (Collapsed for brevity, structure preserved) */}
        <section className="mb-16 bg-blue-600/5 border border-blue-500/10 rounded-[3rem] p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                    <h2 className="text-2xl font-black mb-4 uppercase tracking-tighter flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">?</span>
                        How the Vault Works
                    </h2>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6 font-medium">
                        Need liquidity but don't want to sell your K9? Listing on a marketplace forces floor competition. The K9 Impound keeps your asset safe in our communal vault while giving you instant $NTWRK.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-900/50 p-6 rounded-3xl border border-white/5">
                        <p className="text-blue-500 font-black text-xs uppercase mb-2">1. Instant Liquidity</p>
                        <p className="text-[10px] text-gray-500 leading-tight">Get <span className="text-white">{payoutRate.toLocaleString()} $NTWRK</span> instantly.</p>
                    </div>
                    <div className="bg-gray-900/50 p-6 rounded-3xl border border-white/5">
                        <p className="text-green-500 font-black text-xs uppercase mb-2">2. Floor Protection</p>
                        <p className="text-[10px] text-gray-500 leading-tight">Your NFT is held in vault, not listed.</p>
                    </div>
                </div>
            </div>
        </section>

        {loading ? <div className="flex justify-center h-64"><LoadingSpinner size="lg" /></div> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            
            {/* UNLOCKED ASSETS */}
            <section>
              <h2 className="text-xl font-black mb-6 flex items-center gap-2 uppercase tracking-tighter">
                <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span> Available K9s
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {k9Nfts.filter(n => !n.locked).map(nft => (
                  <div 
                    key={nft.id} 
                    onClick={() => setSelectedNfts(prev => prev.includes(nft.id) ? prev.filter(i => i !== nft.id) : [...prev, nft.id])} 
                    className={`p-3 rounded-[2rem] border-2 transition-all cursor-pointer bg-gray-900/40 backdrop-blur-md relative ${selectedNfts.includes(nft.id) ? 'border-blue-500 scale-95' : 'border-white/5'}`}
                  >
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-3">
                        <Image src={nft.image} alt="k9" fill className="object-cover" />
                    </div>
                    <p className="text-[10px] font-black uppercase text-gray-400 truncate text-center">{nft.name}</p>
                    
                    {nft.owner !== publicKey?.toString() && (
                      <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-[8px] font-bold text-yellow-400 border border-yellow-500/30">
                        {nft.owner.slice(0, 4)}...
                      </div>
                    )}

                    <div className="mt-2 bg-green-500/10 py-1.5 rounded-xl text-center">
                        <p className="text-[10px] font-black text-green-500">+{payoutRate.toLocaleString()} NTWRK</p>
                    </div>
                  </div>
                ))}
              </div>
              {selectedNfts.length > 0 && (
                  <button onClick={() => setShowLockModal(true)} className="w-full mt-8 bg-blue-600 hover:bg-blue-700 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">
                      IMPOUND {selectedNfts.length} K9s
                  </button>
              )}
            </section>

            {/* LOCKED ASSETS */}
            <section>
              <h2 className="text-xl font-black mb-6 flex items-center gap-2 uppercase tracking-tighter">
                <span className="w-3 h-3 bg-orange-500 rounded-full"></span> Locked Assets
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {k9Nfts.filter(n => n.locked).map(nft => (
                  <div key={nft.id} className="p-3 rounded-[2rem] bg-gray-900/20 border border-white/5 transition-all relative">
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 grayscale opacity-60">
                        <Image src={nft.image} alt="k9" fill className="object-cover" />
                    </div>
                    <p className="text-[10px] font-black text-gray-500 truncate text-center">{nft.name}</p>

                    {nft.owner !== publicKey?.toString() && (
                      <div className="absolute top-2 right-2 bg-black/60 px-2 py-1 rounded text-[8px] font-bold text-yellow-400 border border-yellow-500/30">
                        {nft.owner.slice(0, 4)}...
                      </div>
                    )}

                    <div className="mt-2 bg-orange-500/5 p-2 rounded-xl text-center">
                        <p className="text-sm font-black text-orange-500">{nft.unlockCost?.toLocaleString()} NTWRK</p>
                    </div>
                    <button onClick={() => { setSelectedForUnlock(nft); setShowUnlockModal(true); }} className="w-full mt-3 bg-orange-600 hover:bg-orange-700 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/5 p-10 rounded-[3rem] max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">Confirm Impound?</h3>
            <p className="text-gray-500 text-sm mb-8">Receive <span className="text-green-600 font-bold">{(selectedNfts.length * payoutRate).toLocaleString()} $NTWRK</span> instantly.</p>
            <button disabled={processing} onClick={handleLock} className="w-full bg-blue-600 hover:bg-blue-700 py-5 rounded-3xl font-black tracking-widest text-xs transition-all shadow-lg">{processing ? "PROCESSING..." : "CONFIRM"}</button>
            <button onClick={() => setShowLockModal(false)} className="w-full text-gray-400 font-bold text-xs uppercase tracking-widest py-4">Cancel</button>
          </div>
        </div>
      )}

      {/* UNLOCK MODAL */}
      {showUnlockModal && selectedForUnlock && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/5 p-10 rounded-[3rem] max-w-sm w-full text-center shadow-2xl">
            <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">Rescue {selectedForUnlock.name}</h3>
            <div className="bg-orange-500/10 p-8 rounded-[2rem] my-8 border border-orange-500/20 text-center">
                <p className="text-4xl font-black text-orange-600">{selectedForUnlock.unlockCost?.toLocaleString()} <span className="text-sm">NTWRK</span></p>
            </div>
            <button disabled={processing} onClick={handleUnlock} className="w-full bg-orange-600 hover:bg-orange-700 py-5 rounded-3xl font-black tracking-widest text-xs shadow-lg">{processing ? "PROCESSING..." : "PAY & RESCUE"}</button>
            <button onClick={() => setShowUnlockModal(false)} className="w-full text-gray-400 font-bold text-xs uppercase tracking-widest py-4">Cancel</button>
          </div>
        </div>
      )}
    </main>
  )
}