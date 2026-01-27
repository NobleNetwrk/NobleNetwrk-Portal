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
import { useHodlScore, CollectionConfig } from '@/hooks/useHodlScore' 

interface Announcement {
  id: string
  title: string
  content: string
  date: string
  isActive: boolean
}

interface WalletItem {
  address: string
  isPrimary: boolean
}

export default function Portal() {
  const { publicKey, signMessage, disconnect } = useWallet()
  const router = useRouter()

  const [linkedWallets, setLinkedWallets] = useState<string[]>([]) 
  const [walletDetails, setWalletDetails] = useState<WalletItem[]>([]) 
  const [userId, setUserId] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [prices, setPrices] = useState({ sol: 0, ntwrk: 0 })
  const [isLinking, setIsLinking] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [showWalletList, setShowWalletList] = useState(false)
  const [isSettingPrimary, setIsSettingPrimary] = useState(false)
  const [announcements, setAnnouncements] = useState<Announcement[]>([])

  const [username, setUsername] = useState<string>("")
  const [isSavingName, setIsSavingName] = useState(false)
  
  const { holdings: walletData, loading: holdingsLoading, refetch } = useAssetHoldings(linkedWallets)
  
  const { 
    hodlData, 
    loading: initialHodlLoading, 
    refreshing: isRefreshingHodl, 
    refreshScore, 
    getBreakdown, 
    configs: hodlConfigs 
  } = useHodlScore(userId);

  const [showHodlBreakdown, setShowHodlBreakdown] = useState(false);
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);

  // --- ASSET CONFIGURATION ---
  const assetConfig = [
    { 
      key: 'solanaK9s', label: 'Solana K9', icon: '/solana-k9s-icon.png', color: 'blue', action: 'K9Impound', actionLabel: 'Impound',
      matcher: (name: string) => name.includes('K9') || name.includes('Police')
    },
    { 
      key: 'genetics', label: 'Noble Genetics', icon: '/noble-genetics-icon.png', color: 'purple',
      matcher: (name: string) => name.includes('Genetic') || name.includes('Noble') || name.includes('OG')
    },
    { 
      key: 'extracts', label: 'Noble Extracts', icon: '/noble-extracts-icon.png', color: 'red',
      matcher: (name: string) => name.includes('Extract')
    },
    { 
      key: 'namaste', label: 'Namaste', icon: '/namaste-icon.png', color: 'yellow',
      matcher: (name: string) => name.includes('Namaste')
    },
    { 
      key: 'sensei', label: 'Sensei Panda', icon: '/sensei-icon.png', color: 'emerald', action: 'PandaLoveLevel', actionLabel: 'Love Level',
      matcher: (name: string) => name.includes('Sensei') || name.includes('Panda')
    },
    { 
      key: 'timeTravelingChimps', label: 'Time Traveling Chimps', icon: '/TimeTravelingChimps-icon.png', color: 'teal',
      matcher: (name: string) => name.includes('Time Traveling') || name.includes('Chimp')
    },
    { 
      key: 'player1', label: 'Player 1', icon: '/Player1-icon.png', color: 'pink',
      matcher: (name: string) => name.includes('Player 1') || name.includes('PlayerOne')
    },
    { 
      key: 'tso', label: 'Smoke Out', icon: '/tso-icon.png', color: 'orange',
      matcher: (name: string) => name.includes('Smoke Out')
    },
    { 
      key: 'd3fenders', label: 'D3fenders', icon: '/d3fenders-icon.png', color: 'indigo',
      matcher: (name: string) => name.includes('D3fender')
    },
    { 
      key: 'stonedApeCrew', label: 'Stoned Ape', icon: '/sac-icon.png', color: 'green',
      matcher: (name: string) => name.includes('Stoned Ape')
    },
    { 
      key: 'galacticGeckos', label: 'Galactic Geckos', icon: '/immortal-gecko-icon.png', color: 'cyan',
      matcher: (name: string) => name.includes('Galactic') || name.includes('Gecko')
    },
  ];

  // --- TOTALS ---
  const totals = useMemo(() => {
    const initial = {
      sol: 0, ntwrk: 0, genetics: 0, extracts: 0, namaste: 0, solanaK9s: 0,
      sensei: 0, tso: 0, d3fenders: 0, stonedApeCrew: 0, 
      immortalGeckos: 0, timeTravelingChimps: 0, player1: 0,
      galacticGeckos: 0 
    }

    if (!walletData || walletData.length === 0) return initial

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
      immortalGeckos: acc.immortalGeckos + curr.immortalGecko, 
      timeTravelingChimps: acc.timeTravelingChimps + (curr.timeTravelingChimps || 0),
      player1: acc.player1 + (curr.player1 || 0),
      galacticGeckos: acc.galacticGeckos + (curr.galacticGeckos || 0),
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
      const stored = JSON.parse(localStorage.getItem('noble_wallets') || '[]')
      if (Array.isArray(stored)) {
        if (stored.length > 0 && typeof stored[0] === 'string') {
          setLinkedWallets(stored)
          setWalletDetails(stored.map((addr, idx) => ({ address: addr, isPrimary: idx === 0 }))) 
        } else if (stored.length > 0 && typeof stored[0] === 'object') {
          setLinkedWallets(stored.map((w: any) => w.address))
          setWalletDetails(stored)
        }
      } else if (publicKey) {
         setLinkedWallets([publicKey.toBase58()])
         setWalletDetails([{ address: publicKey.toBase58(), isPrimary: true }])
      }
    } catch { if (publicKey) setLinkedWallets([publicKey.toBase58()]) }

    fetch('/api/admin/announcements')
      .then(res => res.json())
      .then(data => { if (data.data) setAnnouncements(data.data.filter((a: Announcement) => a.isActive)) })
      .catch(err => console.error("Failed to load updates"))

  }, [publicKey])

  useEffect(() => {
    if (publicKey) {
      fetch(`/api/user/profile?wallet=${publicKey.toBase58()}`)
        .then(res => res.json())
        .then(data => {
          if (data.user?.username) {
            setUsername(data.user.username);
          }
        })
        .catch(e => console.error("Profile sync error", e));
    }
  }, [publicKey]);

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

  const handleHodlRefresh = async () => {
    if (linkedWallets.length === 0) return toast.error("No wallets linked");
    await refreshScore(linkedWallets);
  };

  const groupedAssets = getBreakdown();

  const handleSaveUsername = async () => {
    if (!userId) return toast.error("Please login first");
    if (!username || username.length < 3) return toast.error("Username must be at least 3 characters");

    setIsSavingName(true);
    try {
        const res = await fetch('/api/user/username', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, username })
        });
        
        const data = await res.json();

        if (res.ok) {
            toast.success("Identity updated successfully!");
        } else {
            toast.error(data.error || "Failed to update username");
        }
    } catch (e) {
        toast.error("Network error");
    } finally {
        setIsSavingName(false);
    }
  };

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
        const newDetails = data.walletsDetailed || data.wallets.map((w:string) => ({ address: w, isPrimary: false }))
        localStorage.setItem('noble_wallets', JSON.stringify(newDetails))
        setWalletDetails(newDetails)
        setLinkedWallets(newDetails.map((w: any) => w.address))
        toast.success('Wallet linked successfully!')
      } else {
        toast.error(data.error || 'Link failed')
      }
    } catch (err) { console.error(err) } finally { setIsLinking(false) }
  }

  const handleSetPrimary = async (targetWallet: string) => {
    if (!publicKey || !signMessage || !userId) return
    setIsSettingPrimary(true)
    try {
      const message = `Authorize Primary Airdrop Wallet Change\nNew Target: ${targetWallet}\nTS: ${Date.now()}`
      const signatureBytes = await signMessage(new TextEncoder().encode(message))
      const signature = Buffer.from(signatureBytes).toString('base64')

      const res = await fetch('/api/auth/set-primary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, address: targetWallet, message, signature })
      })

      const data = await res.json()
      if (res.ok) {
        const updatedList = walletDetails.map(w => ({ ...w, isPrimary: w.address === targetWallet }))
        setWalletDetails(updatedList)
        localStorage.setItem('noble_wallets', JSON.stringify(updatedList))
        toast.success(`Primary Airdrop wallet updated.`)
      } else { toast.error(data.error || "Update failed") }
    } catch (e) { console.error(e); toast.error("Failed to sign request") } finally { setIsSettingPrimary(false) }
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
        const newList = walletDetails.filter(w => w.address !== walletToRemove)
        localStorage.setItem('noble_wallets', JSON.stringify(newList))
        setWalletDetails(newList)
        setLinkedWallets(newList.map(w => w.address))
        toast.success('Wallet unlinked.')
      } else { toast.error(data.error || 'Unlink failed') }
    } catch (err) { console.error(err); toast.error('Failed to unlink') } finally { setIsUnlinking(false) }
  };

  if (!isMounted) return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center"><LoadingSpinner size="lg"/></div>;

  return (
    <main className="min-h-screen bg-transparent text-white p-4 md:p-8">
      {/* HODL MODAL */}
      {showHodlBreakdown && hodlData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
            <div className="bg-[#141416] border border-[#c5a059]/30 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
                <div className="p-6 border-b border-[#c5a059]/10 flex justify-between items-center bg-[#0a0a0b] rounded-t-3xl">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter text-[#c5a059]">HODL Breakdown</h2>
                        <p className="text-xs text-gray-500 font-bold uppercase">Total Score: {hodlData.totalScore.toLocaleString()} Days</p>
                    </div>
                    <button onClick={() => setShowHodlBreakdown(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white">✕</button>
                </div>
                <div className="p-6 overflow-y-auto space-y-4">
                    {/* Show refresh button if details are missing (fresh DB load) */}
                    {(!hodlData.details || hodlData.details.length === 0) && (
                        <div className="text-center p-8 border border-dashed border-[#c5a059]/20 rounded-2xl">
                            <p className="text-sm font-bold text-gray-400 mb-2">Score Loaded from Database</p>
                            <p className="text-xs text-gray-500 mb-4">Detailed breakdown not cached. Refresh to calculate live.</p>
                            <button 
                                onClick={handleHodlRefresh}
                                disabled={isRefreshingHodl}
                                className="bg-[#c5a059] hover:bg-[#927035] text-black px-4 py-2 rounded-xl text-xs font-black uppercase"
                            >
                                {isRefreshingHodl ? 'Calculating...' : 'Calculate Live Breakdown'}
                            </button>
                        </div>
                    )}

                    {/* Iterate over HOOK CONFIG (hodlConfigs) */}
                    {hodlData.details && hodlData.details.length > 0 && hodlConfigs.map((config: CollectionConfig) => {
                        const items = groupedAssets[config.key] || [];
                        if (items.length === 0) return null;
                        
                        const sectionScore = items.reduce((sum, item) => sum + item.daysHeld, 0);
                        const isExpanded = expandedCollection === config.key;

                        return (
                            <div key={config.key} className="bg-black/40 border border-white/5 rounded-2xl overflow-hidden">
                                <button 
                                    onClick={() => setExpandedCollection(isExpanded ? null : config.key)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <Image src={config.icon} alt={config.label} width={32} height={32} className="rounded-lg grayscale-[0.3]" />
                                        <div className="text-left">
                                            <h3 className="text-sm font-bold uppercase text-gray-200">{config.label}</h3>
                                            <p className="text-[10px] text-gray-500 font-mono">{items.length} Assets</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-[#c5a059]">{sectionScore.toLocaleString()} pts</p>
                                        <p className="text-[10px] text-gray-600 uppercase font-bold">{isExpanded ? 'Collapse' : 'Expand'}</p>
                                    </div>
                                </button>
                                {isExpanded && (
                                    <div className="p-4 border-t border-white/5 bg-black/20 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {items.sort((a,b) => b.daysHeld - a.daysHeld).map((asset) => (
                                            <div key={asset.mint} className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
                                                <div className="w-10 h-10 rounded-lg overflow-hidden relative flex-shrink-0 bg-gray-800">
                                                    {asset.image && <Image src={asset.image} alt="NFT" fill className="object-cover" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold truncate text-gray-300">{asset.name}</p>
                                                    <p className="text-[10px] text-gray-500 font-mono">Held: <span className="text-[#c5a059] font-bold">{asset.daysHeld}d</span></p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
      )}

      {/* REST OF PORTAL UI (Header, Stats, Tiles) */}
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-6">
          <div className="flex items-center gap-4">
            <Image src="/ntwrk-logo.png" alt="Logo" width={64} height={64} className="rounded-full border-2 border-[#c5a059] shadow-[0_0_15px_rgba(197,160,89,0.2)]" />
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-white">Noble<span className="text-[#c5a059]">Netwrk</span> Portal</h1>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest bg-[#141416] px-2 py-1 rounded border border-white/5">{linkedWallets.length} Linked Wallets</span>
                <button onClick={() => setShowWalletList(!showWalletList)} className="text-[10px] text-[#c5a059] hover:text-[#e4c98c] underline font-bold uppercase decoration-[#c5a059]/50">{showWalletList ? 'Hide List' : 'View List'}</button>
              </div>
            </div>
          </div>
          
          {/* NAV BAR */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {isAdmin && <button onClick={() => router.push('/Admin')} className="bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 text-red-500 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest">Admin</button>}
            
            {/* MAIN AIRDROP BUTTON (Primary CTA) */}
            <button 
                onClick={() => router.push('/Airdrop')} 
                className="bg-gradient-to-r from-[#c5a059] to-[#927035] hover:brightness-110 text-black px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[#c5a059]/20 flex items-center gap-2"
            >
                $NTWRK Airdrop
            </button>

            {/* TOOLS DROPDOWN MENU */}
            <div className="relative group">
                <button className="bg-[#141416] hover:bg-[#1f1f22] border border-white/5 text-gray-300 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                    Tools
                    <svg className="w-3 h-3 group-hover:rotate-180 transition-transform text-[#c5a059]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="absolute top-full right-0 pt-4 w-48 hidden group-hover:block z-50">
                    <div className="bg-[#141416] border border-[#c5a059]/20 rounded-xl shadow-2xl overflow-hidden">
                        <button onClick={() => router.push('/PandaLoveLevel')} className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:bg-[#c5a059]/10 hover:text-[#c5a059] transition-colors border-b border-white/5">
                            Panda Love Level
                        </button>
                        <button onClick={() => router.push('/K9Impound')} className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:bg-[#c5a059]/10 hover:text-[#c5a059] transition-colors border-b border-white/5">
                            K9 Impound
                        </button>
                        <button onClick={() => router.push('/AirdropTool')} className="w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:bg-[#c5a059]/10 hover:text-[#c5a059] transition-colors">
                            Airdrop Tool
                        </button>
                    </div>
                </div>
            </div>
            
            {needsLinking ? (
              <button onClick={handleLinkWallet} disabled={isLinking} className="bg-[#c5a059] hover:bg-[#e4c98c] text-black px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest animate-pulse shadow-lg shadow-[#c5a059]/20">{isLinking ? 'Linking...' : '+ Link This Wallet'}</button>
            ) : (
              <div className="px-4 py-3 bg-[#141416] border border-[#c5a059]/30 rounded-2xl"><span className="text-[#c5a059] text-[10px] font-black uppercase tracking-widest">✓ Wallet Linked</span></div>
            )}
            
            <button onClick={() => refetch()} disabled={holdingsLoading} className="p-3 bg-[#141416] rounded-2xl border border-white/5 hover:border-[#c5a059]/50 transition-colors">
              <svg className={`w-5 h-5 text-gray-400 group-hover:text-[#c5a059] ${holdingsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.836 3a8.001 8.001 0 00-15.836-3L4 12m14.004 6.183L18 9.227m-1.722-1.722A8.001 8.001 0 004 12m14.004 6.183L18 15.227" /></svg>
            </button>
            <button onClick={() => { localStorage.clear(); disconnect(); router.push('/') }} className="bg-red-900/10 hover:bg-red-900/30 text-red-500 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest border border-red-500/10">Logout</button>
          </div>
        </header>

        {showWalletList && (
          <div className="mb-8 bg-[#141416]/80 backdrop-blur-md border border-[#c5a059]/20 p-6 rounded-3xl animate-in fade-in slide-in-from-top-4">
            
            {/* --- METAVERSE IDENTITY --- */}
            <div className="mb-6 border-b border-white/5 pb-6">
               <div className="flex justify-between items-center mb-3">
                   <h3 className="text-xs font-bold text-[#c5a059] uppercase tracking-widest">Metaverse Identity</h3>
                   <span className="text-[10px] text-gray-600 font-mono">Visible in Chat & Games</span>
               </div>
               <div className="flex gap-2">
                   <input 
                       value={username} 
                       onChange={(e) => setUsername(e.target.value)} 
                       placeholder="Enter a Username..." 
                       className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-[#c5a059] flex-1 text-sm font-mono placeholder-gray-700 transition-colors"
                   />
                   <button 
                       onClick={handleSaveUsername} 
                       disabled={isSavingName || !username.trim()}
                       className="bg-[#c5a059] hover:bg-[#e4c98c] text-black px-6 py-2 rounded-xl text-xs font-bold uppercase disabled:opacity-50 transition-all shadow-lg shadow-[#c5a059]/20"
                   >
                       {isSavingName ? 'Saving...' : 'Set Name'}
                   </button>
               </div>
            </div>
            
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">Linked Wallets & Management</h3>
            <div className="flex flex-col gap-2">
              {walletDetails.map((wallet, idx) => (
                <div key={idx} className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${wallet.isPrimary ? 'bg-[#c5a059]/10 border-[#c5a059]/40' : 'bg-black/40 border-white/5 hover:border-white/20'}`}>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-gray-300">{wallet.address.slice(0,6)}...{wallet.address.slice(-6)}</span>
                    {wallet.isPrimary && <span className="text-[9px] text-black bg-[#c5a059] px-2 py-1 rounded font-black tracking-wider shadow-lg">PRIMARY</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {!wallet.isPrimary && (
                      <button onClick={() => handleSetPrimary(wallet.address)} disabled={isSettingPrimary} className="text-[9px] font-bold text-[#c5a059] hover:text-white uppercase hover:underline">Make Primary</button>
                    )}
                    <button onClick={() => handleUnlinkWallet(wallet.address)} disabled={isUnlinking} className="text-red-500 hover:text-red-400 p-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATS & HODL SCORE ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* SOL */}
          <div className="bg-[#141416] p-8 rounded-[2.5rem] border border-white/5 flex flex-col justify-center shadow-xl relative overflow-hidden group hover:border-[#c5a059]/20 transition-all">
            <div className="flex items-center gap-5 relative z-10">
              <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center border border-white/10"><Image src="/solana-logo.png" alt="SOL" width={28} height={28} /></div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">SOL Balance</p>
                <h2 className="text-2xl font-black text-white">{totals.sol.toFixed(4)}</h2>
              </div>
            </div>
            <p className="text-lg font-bold text-[#c5a059] mt-2 ml-[4.5rem]">${portfolioValue.solUsd}</p>
          </div>

          {/* NTWRK */}
          <div className="bg-[#141416] p-8 rounded-[2.5rem] border border-white/5 flex flex-col justify-center shadow-xl hover:border-[#c5a059]/20 transition-all">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center border border-white/10"><Image src="/ntwrk-logo.png" alt="NTWRK" width={28} height={28} /></div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">$NTWRK Balance</p>
                <h2 className="text-2xl font-black text-white">{totals.ntwrk.toLocaleString()}</h2>
              </div>
            </div>
            <p className="text-lg font-bold text-[#c5a059] mt-2 ml-[4.5rem]">${portfolioValue.ntwrkUsd}</p>
          </div>

          {/* HODL SCORE CARD (Premium Gold) */}
          <div className="bg-gradient-to-br from-[#1a1a1c] to-[#0a0a0b] p-8 rounded-[2.5rem] border border-[#c5a059]/20 flex flex-col justify-center relative overflow-hidden shadow-2xl group hover:border-[#c5a059]/50 transition-all">
             {/* Subtle ambient glow behind */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#c5a059]/10 blur-[50px] rounded-full pointer-events-none" />
             
             <div className="relative z-10 flex items-center gap-5">
                <div className="w-14 h-14 bg-[#c5a059]/10 rounded-2xl flex items-center justify-center border border-[#c5a059]/30">
                    <svg className="w-7 h-7 text-[#c5a059]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">My HODL Score</p>
                    {initialHodlLoading ? (
                        <span className="text-xs text-gray-500 animate-pulse">Syncing...</span>
                    ) : (hodlData?.totalScore !== undefined && hodlData.totalScore > 0) ? (
                        <div>
                            {/* Gold Gradient Text */}
                            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#c5a059] to-[#f3eacb] animate-in fade-in">{hodlData.totalScore.toLocaleString()}</h2>
                            <button 
                                onClick={handleHodlRefresh} 
                                disabled={isRefreshingHodl} 
                                className="text-[9px] font-bold text-gray-600 hover:text-[#c5a059] uppercase tracking-wider mt-1 flex items-center gap-1"
                            >
                                {isRefreshingHodl ? 'Refreshing...' : '↻ Refresh Score'}
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={handleHodlRefresh} 
                            disabled={isRefreshingHodl} 
                            className="text-xs font-black uppercase tracking-widest text-[#c5a059] hover:text-white transition-colors"
                        >
                            {isRefreshingHodl ? 'Calculating...' : 'Calculate Score'}
                        </button>
                    )}
                </div>
             </div>
             {hodlData && (
                 <button 
                    onClick={() => setShowHodlBreakdown(true)}
                    className="mt-4 ml-[4.5rem] text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest underline decoration-2 underline-offset-4 decoration-[#c5a059]/30 hover:decoration-[#c5a059]"
                 >
                    View Breakdown
                 </button>
             )}
          </div>
        </div>

        {/* ASSET TILES */}
        <div className="mb-6 flex justify-between items-end">
          <h2 className="text-xl font-black uppercase tracking-tighter text-white">Verified Assets</h2>
          <p className="text-[10px] font-bold text-gray-500 uppercase">Synced across {linkedWallets.length} wallets</p>
        </div>

        {holdingsLoading && (!walletData || walletData.length === 0) ? (
          <div className="h-64 flex items-center justify-center"><LoadingSpinner size="lg" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assetConfig.map((config) => {
              const count = totals[config.key as keyof typeof totals] || 0;
              return (
                <div key={config.key} className="bg-[#141416] p-6 rounded-3xl border border-white/5 transition-all group hover:scale-[1.02] shadow-lg flex items-center gap-6 hover:border-[#c5a059]/20 hover:shadow-[#c5a059]/5">
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <Image 
                        src={config.icon} 
                        alt={config.label} 
                        fill 
                        className="rounded-2xl object-cover border border-white/5 shadow-lg grayscale-[0.2] group-hover:grayscale-0 transition-all"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-black uppercase tracking-wide text-gray-500 mb-1 truncate group-hover:text-gray-300 transition-colors">{config.label}</h3>
                    <div className="flex items-end justify-between">
                        <span className="text-4xl font-black text-white leading-none">{count}</span>
                        {config.action && count > 0 && (
                            <button onClick={() => router.push(`/${config.action}`)} className="text-[10px] font-black text-[#c5a059] hover:text-[#e4c98c] uppercase tracking-widest underline decoration-2 underline-offset-4 transition-all mb-1">
                                {config.actionLabel}
                            </button>
                        )}
                    </div>
                    {/* CUSTOM LOGIC FOR GALACTIC GECKOS */}
                    {config.key === 'galacticGeckos' && (
                        <p className="text-[10px] font-bold text-gray-600 uppercase mt-1">
                            Immortal Geckos: <span className="text-gray-300">{totals.immortalGeckos}</span>
                        </p>
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