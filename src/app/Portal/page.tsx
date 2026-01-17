'use client'

import { useEffect, useState, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'
import axios from 'axios'
import { base58 } from '@/lib/base58'
import { useAssetHoldings } from '@/hooks/useAssetHoldings'

export default function Portal() {
  const { publicKey, signMessage, disconnect } = useWallet()
  const router = useRouter()

  // --- STATE ---
  const [linkedWallets, setLinkedWallets] = useState<string[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  
  const [prices, setPrices] = useState({ sol: 0, ntwrk: 0 })
  const [isLinking, setIsLinking] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [showWalletList, setShowWalletList] = useState(false)

  // --- 1. USE THE HOOK ---
  const { holdings: walletData, loading: holdingsLoading, refetch } = useAssetHoldings(linkedWallets)

  // --- 2. CALCULATE TOTALS ---
  const totals = useMemo(() => {
    // Initial counters
    const initial = {
      sol: 0, ntwrk: 0, genetics: 0, extracts: 0, namaste: 0, solanaK9s: 0,
      sensei: 0, tso: 0, d3fenders: 0, stonedApeCrew: 0, immortalGeckos: 0
    }

    if (!walletData || walletData.length === 0) return initial

    // Aggregate all wallets
    return walletData.reduce((acc, curr) => ({
      sol: acc.sol + (curr.solBalance || 0),
      ntwrk: acc.ntwrk + (curr.ntwrkBalance || 0),
      genetics: acc.genetics + curr.genetics,
      extracts: acc.extracts + curr.extracts,
      namaste: acc.namaste + curr.namaste,
      solanaK9s: acc.solanaK9s + curr.solanaK9s,
      sensei: acc.sensei + curr.sensei,
      tso: acc.tso + curr.tso,
      d3fenders: acc.d3fenders + curr.d3fenders,
      stonedApeCrew: acc.stonedApeCrew + curr.stonedApeCrew,
      // FIX 1: Use 'curr.immortalGecko' (Singular, matches Hook)
      immortalGeckos: acc.immortalGeckos + curr.immortalGecko, 
    }), initial)
  }, [walletData])

  const portfolioValue = useMemo(() => ({
    solUsd: (totals.sol * prices.sol).toFixed(2),
    ntwrkUsd: (totals.ntwrk * prices.ntwrk).toFixed(2)
  }), [totals, prices])

  const isAdmin = useMemo(() => {
    if (!publicKey) return false
    const admins = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(',')
    return admins.includes(publicKey.toBase58())
  }, [publicKey])

  const needsLinking = useMemo(() => {
    if (!publicKey || !isMounted) return false
    return !linkedWallets.includes(publicKey.toBase58())
  }, [publicKey, linkedWallets, isMounted])

  // --- EFFECTS ---

  useEffect(() => {
    setIsMounted(true)
    const storedUserId = localStorage.getItem('noble_userId')
    setUserId(storedUserId)

    try {
      const stored = JSON.parse(localStorage.getItem('noble_wallets') || '[]') as string[]
      const validWallets = Array.isArray(stored) ? stored : []
      if (validWallets.length === 0 && publicKey) {
        setLinkedWallets([publicKey.toBase58()])
      } else {
        setLinkedWallets(validWallets)
      }
    } catch { 
      if (publicKey) setLinkedWallets([publicKey.toBase58()])
    }
  }, [publicKey])

  useEffect(() => {
    if (!isMounted) return
    const fetchPrices = async () => {
      try {
        const res = await axios.get('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112,NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS')
        setPrices({
          sol: res.data['So11111111111111111111111111111111111111112']?.usdPrice || 0,
          ntwrk: res.data['NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS']?.usdPrice || 0
        })
      } catch (e) { console.warn('Price API error') }
    }
    fetchPrices()
  }, [isMounted])

  // --- ACTIONS ---

  const handleLinkWallet = async () => {
    if (!publicKey || !signMessage || !userId) return toast.error("Please login first.")
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
        setLinkedWallets(data.wallets)
        toast.success('Wallet linked successfully!')
      } else {
        toast.error(data.error || 'Link failed')
      }
    } catch (err) { console.error(err) } finally { setIsLinking(false) }
  }

  const handleUnlinkWallet = async (walletToRemove: string) => {
    if (!confirm(`Unlink ${walletToRemove.slice(0, 6)}...?`)) return;
    setIsUnlinking(true);
    try {
      const res = await fetch('/api/auth/wallet', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, address: walletToRemove })
      });
      const data = await res.json();
      if (res.ok) {
        const newList = data.wallets || linkedWallets.filter(w => w !== walletToRemove)
        localStorage.setItem('noble_wallets', JSON.stringify(newList))
        setLinkedWallets(newList)
        toast.success('Wallet unlinked.')
        if (walletToRemove === publicKey?.toBase58()) {
          disconnect();
          router.push('/');
        }
      } else { toast.error(data.error || 'Unlink failed') }
    } catch (err) { console.error(err); toast.error('Failed to unlink') } finally { setIsUnlinking(false) }
  };

  if (!isMounted) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><LoadingSpinner size="lg"/></div>;

  const assetConfig = [
    { key: 'genetics', label: 'Noble Genetics', icon: '/noble-genetics-icon.png', color: 'purple' },
    { key: 'extracts', label: 'Noble Extracts', icon: '/noble-extracts-icon.png', color: 'red' },
    { key: 'namaste', label: 'Namaste', icon: '/namaste-icon.png', color: 'yellow' },
    { key: 'solanaK9s', label: 'Solana K9', icon: '/solana-k9s-icon.png', color: 'blue', action: 'K9Impound', actionLabel: 'Impound' },
    { key: 'sensei', label: 'Sensei Panda', icon: '/sensei-icon.png', color: 'emerald', action: 'PandaLoveLevel', actionLabel: 'Love Level' },
    { key: 'tso', label: 'Smoke Out', icon: '/tso-icon.png', color: 'orange' },
    { key: 'd3fenders', label: 'D3fenders', icon: '/d3fenders-icon.png', color: 'indigo' },
    { key: 'stonedApeCrew', label: 'Stoned Ape', icon: '/sac-icon.png', color: 'green' },
    { key: 'immortalGeckos', label: 'Immortal Geckos', icon: '/immortal-gecko-icon.png', color: 'cyan' },
  ]

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
            
            {/* FIX 2: Call refetch() with NO arguments */}
            <button onClick={() => refetch()} disabled={holdingsLoading} className="p-3 bg-gray-900 rounded-2xl border border-white/5 hover:bg-gray-800 transition-colors" title="Refresh Holdings">
              <svg className={`w-5 h-5 text-gray-400 ${holdingsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.836 3a8.001 8.001 0 00-15.836-3L4 12m14.004 6.183L18 9.227m-1.722-1.722A8.001 8.001 0 004 12m14.004 6.183L18 15.227" /></svg>
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
                  <button onClick={() => handleUnlinkWallet(wallet)} disabled={isUnlinking} className="text-red-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
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
                <h2 className="text-2xl font-black">{totals.sol.toFixed(4)}</h2>
              </div>
            </div>
            <p className="text-lg font-bold text-indigo-400">${portfolioValue.solUsd}</p>
          </div>
          <div className="bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20"><Image src="/ntwrk-logo.png" alt="NTWRK" width={28} height={28} /></div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total $NTWRK Balance</p>
                <h2 className="text-2xl font-black">{totals.ntwrk.toLocaleString()}</h2>
              </div>
            </div>
            <p className="text-lg font-bold text-green-400">${portfolioValue.ntwrkUsd}</p>
          </div>
        </div>

        <div className="mb-6 flex justify-between items-end">
          <h2 className="text-xl font-black uppercase tracking-tighter">Verified Assets</h2>
          <p className="text-[10px] font-bold text-gray-600 uppercase">Synced across {linkedWallets.length} wallets</p>
        </div>

        {holdingsLoading && (!walletData || walletData.length === 0) ? (
          <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {assetConfig.map((config) => {
              // Dynamically access the correct total based on the config key
              const count = totals[config.key as keyof typeof totals] || 0;
              
              return (
                <div key={config.key} className="bg-gray-900/40 backdrop-blur-md p-6 rounded-3xl border border-white/5 transition-all group hover:scale-[1.02] shadow-lg">
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