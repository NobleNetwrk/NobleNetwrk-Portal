'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction } from '@solana/web3.js'
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'
import { K9_HASHLIST } from '@/config/k9hashlist'
// Import the shared constants
import { NTWRK_PER_K9, WEEKLY_INTEREST_RATE, NTWRK_MINT_ADDRESS } from '@/config/k9-constants'

const DAS_RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

interface K9Asset {
  id: string;
  name: string;
  image: string;
  locked: boolean;
  lockDate?: string;
  unlockCost?: number;
}

export default function K9Impound() {
  const { publicKey, connected, signTransaction } = useWallet() 
  const { connection } = useConnection()
  const router = useRouter()

  const [k9Nfts, setK9Nfts] = useState<K9Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNfts, setSelectedNfts] = useState<string[]>([])
  const [showLockModal, setShowLockModal] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [selectedForUnlock, setSelectedForUnlock] = useState<K9Asset | null>(null)
  const [processing, setProcessing] = useState(false)
  const [userNtwrkBalance, setUserNtwrkBalance] = useState(0)
  
  const isFetching = useRef(false)

  const calculateUnlockCost = useCallback((lockDate: string) => {
    const elapsed = Date.now() - new Date(lockDate).getTime()
    const weeks = Math.max(0, Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000)))
    const interest = (NTWRK_PER_K9 * (weeks * WEEKLY_INTEREST_RATE)) / 100
    return NTWRK_PER_K9 + interest
  }, [])

  const fetchAllData = useCallback(async () => {
    if (!publicKey || isFetching.current) return
    isFetching.current = true
    setLoading(true)

    try {
      const lockRes = await fetch(`/api/k9/locked?owner=${publicKey.toString()}`)
      const { lockedK9s = [] } = await lockRes.json()

      try {
        const ata = await getAssociatedTokenAddress(new PublicKey(NTWRK_MINT_ADDRESS), publicKey)
        const account = await getAccount(connection, ata)
        setUserNtwrkBalance(Number(account.amount) / 1e9) 
      } catch { setUserNtwrkBalance(0) }

      const dasRes = await fetch(DAS_RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 'k9-fetch', method: 'getAssetsByOwner',
          params: { ownerAddress: publicKey.toString(), page: 1, limit: 1000 }
        }),
      })
      const dasData = await dasRes.json()
      const k9MintSet = new Set(K9_HASHLIST)
      
      const walletK9s = (dasData.result?.items || [])
        .filter((item: any) => k9MintSet.has(item.id))
        .map((item: any) => ({
          id: item.id,
          name: item.content?.metadata?.name || `K9 #${item.id.slice(0,4)}`,
          image: item.content?.links?.image || '/solana-k9s-icon.png',
          locked: false
        }))

      const lockedFormatted = lockedK9s.map((l: any) => ({
        id: l.mint,
        name: l.name || `K9 #${l.mint.slice(0, 4)}`,
        image: l.image || '/solana-k9s-icon.png',
        locked: true,
        lockDate: l.lockDate,
        unlockCost: calculateUnlockCost(l.lockDate)
      }))

      setK9Nfts([...walletK9s, ...lockedFormatted])
    } catch (e) { toast.error("Failed to load assets") }
    finally { setLoading(false); isFetching.current = false; }
  }, [publicKey, connection, calculateUnlockCost])

  useEffect(() => { if (connected && publicKey) fetchAllData() }, [connected, publicKey, fetchAllData])

  const handleLock = async () => {
    if (!publicKey || !signTransaction) return;
    setProcessing(true);
    try {
      const nftsToLock = k9Nfts
        .filter(n => selectedNfts.includes(n.id))
        .map(n => ({ mint: n.id, name: n.name, image: n.image }));

      // Step 1: Get the transaction from the server
      const res = await fetch('/api/k9/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: publicKey.toString(), nfts: nftsToLock })
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Step 2: User signs and sends the transaction
      const tx = Transaction.from(Buffer.from(data.transaction, 'base64'));
      const signedTx = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signedTx.serialize(), { 
        skipPreflight: false, 
        preflightCommitment: 'confirmed' 
      });
      
      // Wait for confirmation on the frontend first
      await connection.confirmTransaction(signature, 'confirmed');

      // Step 3: Tell the server to verify the signature and update the JSON file
      const confirmRes = await fetch('/api/k9/lock', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              signature, 
              owner: publicKey.toString(), 
              nfts: nftsToLock 
          })
      });

      const confirmData = await confirmRes.json();
      if (confirmData.error) throw new Error("Transaction succeeded but database update failed. Please contact support.");

      toast.success("K9s Impounded successfully!");
      fetchAllData();
      setShowLockModal(false);
      setSelectedNfts([]);
    } catch (e: any) { 
      console.error("Locking Error:", e);
      toast.error(e.message || "Impound failed.");
    } finally { setProcessing(false) }
  };

  const handleUnlock = async () => {
    if (!selectedForUnlock || !publicKey || !signTransaction) return;
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
      setTimeout(fetchAllData, 2000);
      setShowUnlockModal(false);
    } catch (e: any) { toast.error(e.message || "Rescue failed") }
    finally { setProcessing(false) }
  };

  if (!connected) return <div className="p-20 text-center font-black">Connect Wallet to access Impound</div>

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
          <button onClick={() => router.push('/Portal')} className="bg-gray-900 border border-white/5 hover:bg-gray-800 text-gray-400 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Back to Portal</button>
        </header>

        {/* How It Works Section */}
        <section className="mb-16 bg-blue-600/5 border border-blue-500/10 rounded-[3rem] p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                    <h2 className="text-2xl font-black mb-4 uppercase tracking-tighter flex items-center gap-3">
                        <span className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm">?</span>
                        How the Vault Works
                    </h2>
                    <p className="text-gray-400 text-sm leading-relaxed mb-6 font-medium">
                        Need liquidity but don't want to sell your K9? Listing on a marketplace forces floor competition, suppresses the project's value, and gives opportunistic bots the chance to damage the floor.
                    </p>
                    <p className="text-gray-400 text-sm leading-relaxed font-medium">
                        The <span className="text-blue-500 font-bold">K9 Impound</span> keeps your asset safe in our communal vault. You get instant <span className="text-white font-bold">$NTWRK</span>, which you are welcome to sell or trade, the floor remains untouched, and you can rescue your K9 whenever you're ready.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-900/50 p-6 rounded-3xl border border-white/5">
                        <p className="text-blue-500 font-black text-xs uppercase mb-2">1. Instant Liquidity</p>
                        <p className="text-[10px] text-gray-500 leading-tight">Get <span className="text-white">{NTWRK_PER_K9.toLocaleString()} $NTWRK</span> instantly upon impounding your K9.</p>
                    </div>
                    <div className="bg-gray-900/50 p-6 rounded-3xl border border-white/5">
                        <p className="text-green-500 font-black text-xs uppercase mb-2">2. Floor Protection</p>
                        <p className="text-[10px] text-gray-500 leading-tight">Your NFT is held in vault, not listed. No floor suppression, no bot snipers.</p>
                    </div>
                    <div className="bg-gray-900/50 p-6 rounded-3xl border border-white/5">
                        <p className="text-orange-500 font-black text-xs uppercase mb-2">3. Communal Vault</p>
                        <p className="text-[10px] text-gray-500 leading-tight">Assets stay within the community trust rather than circulating to outside traders.</p>
                    </div>
                    <div className="bg-gray-900/50 p-6 rounded-3xl border border-white/5">
                        <p className="text-purple-500 font-black text-xs uppercase mb-2">4. Full Rescue</p>
                        <p className="text-[10px] text-gray-500 leading-tight">Rescue your K9 at any time by repaying the liquidity plus a {WEEKLY_INTEREST_RATE}% weekly fee.</p>
                    </div>
                </div>
            </div>
        </section>

        {loading ? <div className="flex justify-center h-64"><LoadingSpinner size="lg" /></div> : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <section>
              <h2 className="text-xl font-black mb-6 flex items-center gap-2 uppercase tracking-tighter"><span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></span> Available K9s</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {k9Nfts.filter(n => !n.locked).map(nft => (
                  <div key={nft.id} onClick={() => setSelectedNfts(prev => prev.includes(nft.id) ? prev.filter(i => i !== nft.id) : [...prev, nft.id])} className={`p-3 rounded-[2rem] border-2 transition-all cursor-pointer bg-gray-900/40 backdrop-blur-md ${selectedNfts.includes(nft.id) ? 'border-blue-500 scale-95' : 'border-white/5'}`}>
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-3"><Image src={nft.image} alt="k9" fill className="object-cover" /></div>
                    <p className="text-[10px] font-black uppercase text-gray-400 truncate text-center">{nft.name}</p>
                    <div className="mt-2 bg-green-500/10 py-1.5 rounded-xl text-center"><p className="text-[10px] font-black text-green-500">+{NTWRK_PER_K9.toLocaleString()} NTWRK</p></div>
                  </div>
                ))}
              </div>
              {selectedNfts.length > 0 && <button onClick={() => setShowLockModal(true)} className="w-full mt-8 bg-blue-600 hover:bg-blue-700 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all">IMPOUND {selectedNfts.length} K9s</button>}
            </section>

            <section>
              <h2 className="text-xl font-black mb-6 flex items-center gap-2 uppercase tracking-tighter"><span className="w-3 h-3 bg-orange-500 rounded-full"></span> Locked Assets</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {k9Nfts.filter(n => n.locked).map(nft => (
                  <div key={nft.id} className="p-3 rounded-[2rem] bg-gray-900/20 border border-white/5 transition-all">
                    <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 grayscale opacity-60"><Image src={nft.image} alt="k9" fill className="object-cover" /></div>
                    <p className="text-[10px] font-black text-gray-500 truncate text-center">{nft.name}</p>
                    <div className="mt-2 bg-orange-500/5 p-2 rounded-xl text-center"><p className="text-sm font-black text-orange-500">{nft.unlockCost?.toLocaleString()} NTWRK</p></div>
                    <button onClick={() => { setSelectedForUnlock(nft); setShowUnlockModal(true); }} className="w-full mt-3 bg-orange-600 hover:bg-orange-700 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">RESCUE</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Modals */}
      {showLockModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-white/5 p-10 rounded-[3rem] max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-2xl font-black mb-2 uppercase tracking-tighter">Confirm Impound?</h3>
            <p className="text-gray-500 text-sm mb-8">Receive <span className="text-green-600 font-bold">{(selectedNfts.length * NTWRK_PER_K9).toLocaleString()} $NTWRK</span> instantly.</p>
            <button disabled={processing} onClick={handleLock} className="w-full bg-blue-600 hover:bg-blue-700 py-5 rounded-3xl font-black tracking-widest text-xs transition-all shadow-lg">{processing ? "PROCESSING..." : "CONFIRM"}</button>
            <button onClick={() => setShowLockModal(false)} className="w-full text-gray-400 font-bold text-xs uppercase tracking-widest py-4">Cancel</button>
          </div>
        </div>
      )}

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