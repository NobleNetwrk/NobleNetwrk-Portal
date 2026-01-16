'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'
import axios from 'axios'
import { base58 } from '@/lib/base58'

import { 
  NOBLE_GENETICS_HASHLIST, NOBLE_EXTRACTS_HASHLIST, NAMASTE_HASHLIST,
  D3FENDERS_HASHLIST, STONED_APE_CREW_HASHLIST, K9_HASHLIST,
  SENSEI_HASHLIST, TSO_HASHLIST
} from '@/utils/hashlistLoader'

export default function Portal() {
  const { publicKey, signMessage, disconnect, connected } = useWallet()
  const router = useRouter()

  // --- HYDRATION FIX: Start with empty state to match server ---
  const [linkedWallets, setLinkedWallets] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  // -------------------------------------------------------------

  const [balances, setBalances] = useState({ sol: 0, ntwrk: 0 })
  const [prices, setPrices] = useState({ sol: 0, ntwrk: 0 })
  const [loading, setLoading] = useState(true)
  const [isLinking, setIsLinking] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [showWalletList, setShowWalletList] = useState(false)
  
  const [holdings, setHoldings] = useState({
    genetics: 0, extracts: 0, namaste: 0, solanaK9s: 0,
    sensei: 0, tso: 0, d3fenders: 0, stonedApeCrew: 0,
    immortalGeckos: 0,
  })

  // --- ADMIN CHECK ---
  const isAdmin = useMemo(() => {
    if (!publicKey) return false
    const admins = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(',')
    return admins.includes(publicKey.toBase58())
  }, [publicKey])

  // --- 1. SAFELY LOAD STORAGE ON CLIENT MOUNT ---
  useEffect(() => {
    setIsMounted(true)
    
    // Load User ID
    const storedUserId = localStorage.getItem('noble_userId')
    setUserId(storedUserId)

    // Load Wallets safely
    try {
      const stored = JSON.parse(localStorage.getItem('noble_wallets') || '[]') as string[]
      const validWallets = Array.isArray(stored) ? stored : []
      
      // If we have a connected wallet but no stored list, use connected wallet temporarily
      if (validWallets.length === 0 && publicKey) {
        setLinkedWallets([publicKey.toBase58()])
      } else {
        setLinkedWallets(validWallets)
      }
    } catch { 
      if (publicKey) setLinkedWallets([publicKey.toBase58()])
    }
  }, [publicKey]) 


  const needsLinking = useMemo(() => {
    if (!publicKey || !isMounted) return false
    return !linkedWallets.includes(publicKey.toBase58())
  }, [publicKey, linkedWallets, isMounted])

  const portfolioValue = useMemo(() => ({
    solUsd: (balances.sol * prices.sol).toFixed(2),
    ntwrkUsd: (balances.ntwrk * prices.ntwrk).toFixed(2)
  }), [balances, prices])

  // --- ACTIONS ---

  const handleLinkWallet = async () => {
    if (!publicKey || !signMessage || !userId) {
      toast.error("Please login first.")
      return
    }
    setIsLinking(true)
    try {
      const message = `Link Wallet to NobleNetwrk\nWallet: ${publicKey.toBase58()}\nTS: ${new Date().getTime()}`
      const signature = await signMessage(new TextEncoder().encode(message))
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: publicKey.toBase58(),
          signature: base58.encode(signature),
          message,
          linkToUserId: userId 
        })
      })
      
      const data = await res.json()
      if (res.ok) {
        localStorage.setItem('noble_wallets', JSON.stringify(data.wallets))
        setLinkedWallets(data.wallets) // Update state directly
        toast.success('Wallet linked successfully!')
      } else {
        toast.error(data.error || 'Link failed')
      }
    } catch (err) { console.error(err) } finally { setIsLinking(false) }
  }

  const handleUnlinkWallet = async (walletToRemove: string) => {
    if (!confirm(`Are you sure you want to unlink ${walletToRemove.slice(0, 6)}...?`)) return;
    
    setIsUnlinking(true);
    try {
      const res = await fetch('/api/auth/wallet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId, address: walletToRemove })
      });

      const data = await res.json();
      
      if (res.ok) {
        let newList: string[] = []
        if (data.wallets) {
          newList = data.wallets
        } else {
          newList = linkedWallets.filter(w => w !== walletToRemove)
        }
        
        localStorage.setItem('noble_wallets', JSON.stringify(newList))
        setLinkedWallets(newList)
        toast.success('Wallet unlinked.')
        
        if (walletToRemove === publicKey?.toBase58()) {
          disconnect();
          router.push('/');
        }
      } else {
        toast.error(data.error || 'Unlink failed');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to unlink wallet');
    } finally {
      setIsUnlinking(false);
    }
  };

  const fetchData = useCallback(async () => {
    // Only fetch if we have wallets to scan
    const walletsToScan = linkedWallets.length > 0 ? linkedWallets : (publicKey ? [publicKey.toBase58()] : []);
    
    // Prevent fetching if not mounted or no wallets found yet
    if (!isMounted || walletsToScan.length === 0) { 
        setLoading(false); 
        return; 
    }
    
    setLoading(true)

    try {
      const priceRes = await axios.get('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112,NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS')
      setPrices({
        sol: priceRes.data['So11111111111111111111111111111111111111112']?.usdPrice || 0,
        ntwrk: priceRes.data['NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS']?.usdPrice || 0
      })
    } catch (e) { console.warn('Price API error') }

    let grandTotalSol = 0
    let grandTotalNtwrk = 0
    let grandTotalHoldings = { 
      genetics: 0, extracts: 0, namaste: 0, solanaK9s: 0, 
      sensei: 0, tso: 0, d3fenders: 0, stonedApeCrew: 0,
      immortalGeckos: 0 
    }

    const hashSets = {
      genetics: new Set(NOBLE_GENETICS_HASHLIST || []),
      extracts: new Set(NOBLE_EXTRACTS_HASHLIST || []),
      namaste: new Set(NAMASTE_HASHLIST || []),
      k9: new Set(K9_HASHLIST || []),
      sensei: new Set(SENSEI_HASHLIST || []),
      tso: new Set(TSO_HASHLIST || []),
      d3fenders: new Set(D3FENDERS_HASHLIST || []),
      stonedApe: new Set(STONED_APE_CREW_HASHLIST || [])
    }

    await Promise.all(walletsToScan.map(async (address) => {
      try {
        const res = await fetch(`/api/holdings?address=${address}`)
        const data = await res.json()

        if (res.ok) {
          if (data.balances) {
            grandTotalSol += data.balances.sol || 0
            grandTotalNtwrk += data.balances.ntwrk || 0
          }
          if (data.nfts && Array.isArray(data.nfts)) {
            data.nfts.forEach((asset: any) => {
              const id = asset.id;
              const group = asset.grouping?.[0]?.group_value;
              if (hashSets.genetics.has(id) || hashSets.genetics.has(group)) grandTotalHoldings.genetics++
              else if (hashSets.extracts.has(id) || hashSets.extracts.has(group)) grandTotalHoldings.extracts++
              else if (hashSets.namaste.has(id) || hashSets.namaste.has(group)) grandTotalHoldings.namaste++
              else if (hashSets.k9.has(id) || hashSets.k9.has(group)) grandTotalHoldings.solanaK9s++
              else if (hashSets.sensei.has(id) || hashSets.sensei.has(group)) grandTotalHoldings.sensei++
              else if (hashSets.tso.has(id) || hashSets.tso.has(group)) grandTotalHoldings.tso++
              else if (hashSets.d3fenders.has(id) || hashSets.d3fenders.has(group)) grandTotalHoldings.d3fenders++
              else if (hashSets.stonedApe.has(id) || hashSets.stonedApe.has(group)) grandTotalHoldings.stonedApeCrew++
            })
          }
        }

        const geckoRes = await fetch(`/api/immortal-geckos?wallet=${address}`)
        const geckoData = await geckoRes.json()
        if (geckoRes.ok && geckoData.count) {
          grandTotalHoldings.immortalGeckos += geckoData.count
        }
      } catch (err) { console.error(`Fetch Error for ${address}:`, err) }
    }))

    setBalances({ sol: grandTotalSol, ntwrk: grandTotalNtwrk })
    setHoldings(grandTotalHoldings)
    setLoading(false)
  }, [linkedWallets, publicKey, isMounted])

  useEffect(() => {
    // Only fetch data once we are mounted and have a user or wallet
    if (isMounted && (userId || connected)) fetchData()
  }, [fetchData, userId, connected, isMounted])

  // Optional: Return null or a loader until client-side hydration is complete
  if (!isMounted) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><LoadingSpinner size="lg"/></div>;

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
          <div className="flex items-center gap-4">
            <Image src="/ntwrk-logo.png" alt="Logo" width={64} height={64} className="rounded-full border-2 border-blue-500 shadow-lg" />
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter">NobleNetwrk Portal</h1>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest bg-gray-900 px-2 py-1 rounded">{linkedWallets.length} Linked Wallets</span>
                <button onClick={() => setShowWalletList(!showWalletList)} className="text-[10px] text-blue-400 hover:text-blue-300 underline font-bold uppercase">{showWalletList ? 'Hide List' : 'View List'}</button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* ADMIN BUTTON (Only visible to whitelisted wallets) */}
            {isAdmin && (
              <button onClick={() => router.push('/Admin')} className="flex-1 md:flex-none bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 text-red-500 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all">
                Admin
              </button>
            )}

            <button onClick={() => router.push('/Airdrop')} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">$NTWRK Airdrop</button>
            <button onClick={() => router.push('/K9Impound')} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">K9 Impound</button>
            <button onClick={() => router.push('/PandaLoveLevel')} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">Panda Love Level</button>
            
            {needsLinking ? (
              <button onClick={handleLinkWallet} disabled={isLinking} className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest animate-pulse shadow-lg shadow-yellow-500/20">{isLinking ? 'Linking...' : '+ Link This Wallet'}</button>
            ) : (
              <div className="px-4 py-3 bg-green-900/30 border border-green-500/30 rounded-2xl"><span className="text-green-400 text-[10px] font-black uppercase tracking-widest">✓ Wallet Linked</span></div>
            )}
            
            <button onClick={() => fetchData()} disabled={loading} className="p-3 bg-gray-900 rounded-2xl border border-white/5 hover:bg-gray-800 transition-colors">
              <svg className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.836 3a8.001 8.001 0 00-15.836-3L4 12m14.004 6.183L18 9.227m-1.722-1.722A8.001 8.001 0 004 12m14.004 6.183L18 15.227" /></svg>
            </button>
            <button onClick={() => { localStorage.clear(); disconnect(); router.push('/') }} className="bg-red-900/40 hover:bg-red-900/60 text-white px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-500/20 transition-all">Logout</button>
          </div>
        </header>

        {showWalletList && (
          <div className="mb-8 bg-gray-900/60 border border-white/10 p-6 rounded-3xl animate-in fade-in slide-in-from-top-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Linked Wallets & Management</h3>
            <div className="flex flex-col gap-2">
              {linkedWallets.map((wallet, idx) => (
                <div key={idx} className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-gray-300">{wallet}</span>
                    {publicKey?.toBase58() === wallet && <span className="text-[9px] text-blue-400 bg-blue-900/20 px-2 py-1 rounded border border-blue-500/30">ACTIVE</span>}
                  </div>
                  
                  <button 
                    onClick={() => handleUnlinkWallet(wallet)}
                    disabled={isUnlinking}
                    className="text-red-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Unlink Wallet"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-4 italic">Unlinking a wallet will remove its assets from your aggregate totals immediately.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20"><Image src="/solana-logo.png" alt="SOL" width={28} height={28} /></div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total SOL Balance</p>
                <h2 className="text-2xl font-black">{balances.sol.toFixed(4)}</h2>
              </div>
            </div>
            <p className="text-lg font-bold text-indigo-400">${portfolioValue.solUsd}</p>
          </div>
          <div className="bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20"><Image src="/ntwrk-logo.png" alt="NTWRK" width={28} height={28} /></div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total $NTWRK Balance</p>
                <h2 className="text-2xl font-black">{balances.ntwrk.toLocaleString()}</h2>
              </div>
            </div>
            <p className="text-lg font-bold text-green-400">${portfolioValue.ntwrkUsd}</p>
          </div>
        </div>

        <div className="mb-6 flex justify-between items-end">
          <h2 className="text-xl font-black uppercase tracking-tighter">Verified Assets</h2>
          <p className="text-[10px] font-bold text-gray-600 uppercase">Synced across {linkedWallets.length} wallets</p>
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Object.entries(holdings).map(([key, count]) => {
              const config: any = {
                genetics: { label: 'Noble Genetics', icon: '/noble-genetics-icon.png', color: 'purple' },
                extracts: { label: 'Noble Extracts', icon: '/noble-extracts-icon.png', color: 'red' },
                namaste: { label: 'Namaste', icon: '/namaste-icon.png', color: 'yellow' },
                solanaK9s: { label: 'Solana K9', icon: '/solana-k9s-icon.png', color: 'blue', action: 'K9Impound', actionLabel: 'Impound' },
                sensei: { label: 'Sensei Panda', icon: '/sensei-icon.png', color: 'emerald', action: 'PandaLoveLevel', actionLabel: 'Love Level' },
                tso: { label: 'Smoke Out', icon: '/tso-icon.png', color: 'orange' },
                d3fenders: { label: 'D3fenders', icon: '/d3fenders-icon.png', color: 'indigo' },
                stonedApeCrew: { label: 'Stoned Ape', icon: '/sac-icon.png', color: 'green' },
                immortalGeckos: { label: 'Immortal Geckos', icon: '/immortal-gecko-icon.png', color: 'cyan' } 
              }[key] || { label: key, icon: '/ntwrk-logo.png', color: 'gray' };

              return (
                <div key={key} className="bg-gray-900/40 backdrop-blur-md p-6 rounded-3xl border border-white/5 transition-all group hover:scale-[1.02] shadow-lg">
                  <div className="flex justify-between items-start mb-6"><Image src={config.icon} alt={config.label} width={42} height={42} className="rounded-xl" /></div>
                  <h3 className="text-xs font-black uppercase tracking-tight mb-1">{config.label}</h3>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-black text-white">{count}</span>
                    {config.action && count > 0 && (
                      <button onClick={() => router.push(`/${config.action}`)} className={`text-[9px] font-black text-${config.color}-400 hover:text-${config.color}-300 uppercase tracking-widest underline decoration-2 underline-offset-4 transition-all`}>{config.actionLabel}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}