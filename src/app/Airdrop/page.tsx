'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import Image from 'next/image'
import { toast } from 'react-toastify'
import base58 from 'bs58'
import { useAssetHoldings } from '@/hooks/useAssetHoldings'

// Boost Multipliers
const BOOSTS = {
  genetics: 5, extracts: 3, namaste: 2, solanaK9s: 1,
  sensei: 1.5, tso: 2, ntwrk: 1, immortalGecko: 3,
  d3fenders: 1, stonedApeCrew: 1,
  // NEW BOOSTS
  timeTravelingChimps: 1,
  player1: 1
}

const NTWRK_BOOST_THRESHOLD = 500000;
const TOTAL_AIRDROP = 5000000;
const WEEKLY_ALLOCATION = 10000;

export default function AirdropPage() {
  const { publicKey, connected, signMessage, disconnect } = useWallet()
  const router = useRouter()

  const [linkedWallets, setLinkedWallets] = useState<string[]>([]) 
  const [airdropProgress, setAirdropProgress] = useState(0)
  const [userTotalAllocation, setUserTotalAllocation] = useState(0)
  const [lastCheckIn, setLastCheckIn] = useState<Date | null>(null)
  const [canCheckIn, setCanCheckIn] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  
  const [profileLoading, setProfileLoading] = useState(false) 
  const [sessionClaimed, setSessionClaimed] = useState(0)

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('noble_wallets') || '[]')
      if (Array.isArray(stored)) {
        if (stored.length > 0 && typeof stored[0] === 'object') {
          setLinkedWallets(stored.map((w: any) => w.address))
        } else {
          setLinkedWallets(stored)
        }
      }
    } catch (e) { console.error("Wallet load error", e) }

    fetch('/api/airdrop?global=true')
      .then(res => res.json())
      .then(data => setAirdropProgress(data.totalAllocated || 0))
      .catch(err => console.error("Global stats failed", err))
  }, [])

  const { holdings: walletData, loading: assetsLoading } = useAssetHoldings(linkedWallets)

  const holdings = useMemo(() => {
    const initial = {
      genetics: 0, extracts: 0, namaste: 0, solanaK9s: 0,
      sensei: 0, tso: 0, d3fenders: 0, stonedApeCrew: 0,
      immortalGecko: 0, ntwrkBalance: 0,
      timeTravelingChimps: 0, player1: 0
    }

    if (!walletData || walletData.length === 0) return initial

    return walletData.reduce((acc, curr) => ({
      genetics: acc.genetics + curr.genetics,
      extracts: acc.extracts + curr.extracts,
      namaste: acc.namaste + curr.namaste,
      solanaK9s: acc.solanaK9s + curr.solanaK9s,
      sensei: acc.sensei + curr.sensei,
      tso: acc.tso + curr.tso,
      d3fenders: acc.d3fenders + curr.d3fenders,
      stonedApeCrew: acc.stonedApeCrew + curr.stonedApeCrew,
      immortalGecko: acc.immortalGecko + curr.immortalGecko,
      ntwrkBalance: acc.ntwrkBalance + curr.ntwrkBalance,
      // NEW REDUCERS
      timeTravelingChimps: acc.timeTravelingChimps + (curr.timeTravelingChimps || 0),
      player1: acc.player1 + (curr.player1 || 0),
    }), initial)
  }, [walletData])

  const ntwrkBoostTiers = useMemo(() => Math.floor((holdings.ntwrkBalance || 0) / NTWRK_BOOST_THRESHOLD), [holdings.ntwrkBalance])
  
  const totalBoost = useMemo(() => {
    return (
      (holdings.genetics * BOOSTS.genetics) + 
      (holdings.extracts * BOOSTS.extracts) +
      (holdings.namaste * BOOSTS.namaste) + 
      (holdings.solanaK9s * BOOSTS.solanaK9s) +
      (holdings.sensei * BOOSTS.sensei) + 
      (holdings.tso * BOOSTS.tso) +
      (holdings.immortalGecko * BOOSTS.immortalGecko) + 
      (holdings.d3fenders * BOOSTS.d3fenders) +
      (holdings.stonedApeCrew * BOOSTS.stonedApeCrew) + 
      // NEW BOOST CALCS
      (holdings.timeTravelingChimps * BOOSTS.timeTravelingChimps) +
      (holdings.player1 * BOOSTS.player1) +
      (ntwrkBoostTiers * BOOSTS.ntwrk)
    )
  }, [holdings, ntwrkBoostTiers])

  const displayWeeklyAllocation = useMemo(() => {
    return (totalBoost / 100) * WEEKLY_ALLOCATION;
  }, [totalBoost]);

  const fetchUserProfile = useCallback(async () => {
    if (!publicKey) return;
    setProfileLoading(true);

    try {
      const res = await fetch(`/api/airdrop?address=${publicKey.toBase58()}`);
      
      let userData = { linkedWallets: [], totalAllocation: 0, lastCheckIn: null };
      if (res.ok) {
        userData = await res.json();
      }

      setUserTotalAllocation(userData.totalAllocation || 0);
      
      const lDate = userData.lastCheckIn ? new Date(userData.lastCheckIn) : null;
      setLastCheckIn(lDate);
      
      const now = new Date();
      const diffTime = lDate ? Math.abs(now.getTime() - lDate.getTime()) : Infinity;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
      setCanCheckIn(!lDate || diffDays >= 7);

      if (userData.linkedWallets && userData.linkedWallets.length > 0) {
        setLinkedWallets(prev => Array.from(new Set([...prev, ...userData.linkedWallets])));
      }

    } catch (e) {
      console.error("Sync Error:", e);
    } finally {
      setProfileLoading(false);
    }
  }, [publicKey]);

  const verifyWallet = useCallback(async () => {
    if (!publicKey || !signMessage) return
    setIsVerifying(true)
    try {
      const message = `Sign this message to authenticate with NobleNetwrk Portal.`
      const signature = await signMessage(new TextEncoder().encode(message))
      
      const response = await fetch('/api/verify-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: publicKey.toBase58(),
          message: message,
          signature: base58.encode(signature),
        }),
      })

      if (!response.ok) throw new Error('Verification failed')

      toast.success('Wallet verified!')
      setIsVerified(true)
      localStorage.setItem('verifiedWallet', publicKey.toBase58())
      fetchUserProfile()
    } catch (err) {
      toast.error('Wallet verification failed')
      disconnect()
    } finally {
      setIsVerifying(false)
    }
  }, [publicKey, signMessage, disconnect, fetchUserProfile])

  const handleCheckIn = async () => {
    if (!isVerified || !canCheckIn || displayWeeklyAllocation <= 0) return;
    
    try {
      setProfileLoading(true); 
      const response = await fetch(`/api/airdrop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address: publicKey!.toBase58(), 
          allocation: displayWeeklyAllocation 
        })
      });

      if (!response.ok) throw new Error('Check-in failed');
      
      const data = await response.json();
      
      setUserTotalAllocation(data.totalAllocation);
      setAirdropProgress(data.globalProgress);
      setLastCheckIn(new Date());
      setCanCheckIn(false);
      setSessionClaimed(prev => prev + displayWeeklyAllocation);
      
      toast.success(`Secured ${displayWeeklyAllocation.toFixed(2)} NTWRK!`);
    } catch (e) { 
      toast.error('Failed to process check-in'); 
      console.error(e);
    } finally {
      setProfileLoading(false);
    }
  }

  useEffect(() => {
    const stored = localStorage.getItem('verifiedWallet');
    if (connected && stored === publicKey?.toBase58()) {
      setIsVerified(true);
      fetchUserProfile();
    } else if (connected) {
      setIsVerified(false);
    }
  }, [connected, publicKey, fetchUserProfile]);

  if (!connected) return <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b]"><LoadingSpinner size="lg" /></div>

  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white p-4 md:p-8 relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="fixed top-0 left-[20%] w-[600px] h-[600px] bg-[#c5a059]/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
             <div className="relative w-12 h-12 flex-shrink-0">
                <Image 
                    src="/ntwrk-logo.png" 
                    alt="Logo" 
                    fill 
                    className="rounded-full border-2 border-[#c5a059] shadow-[0_0_15px_rgba(197,160,89,0.3)] object-cover" 
                />
             </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tighter text-white">
                $NTWRK <span className="text-[#c5a059]">Allocation</span>
              </h1>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Airdrop & Rewards Center</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/Portal')} 
            className="bg-[#141416] border border-white/5 hover:border-[#c5a059]/50 text-gray-400 hover:text-[#c5a059] px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all"
          >
            Back to Portal
          </button>
        </header>

        {/* VERIFICATION ALERT (Gold Vault Style) */}
        {!isVerified && (
          <div className="mb-8 p-1 rounded-3xl bg-gradient-to-r from-[#927035] via-[#c5a059] to-[#927035]">
            <div className="bg-[#0a0a0b] rounded-[1.3rem] p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 text-[#c5a059]">
                <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                <div>
                    <h3 className="font-black uppercase tracking-widest text-xs mb-1">Security Access Required</h3>
                    <p className="text-gray-400 text-xs font-medium">Verify your wallet signature to access the Airdrop Vault.</p>
                </div>
                </div>
                <button 
                    onClick={verifyWallet} 
                    disabled={isVerifying} 
                    className="bg-[#c5a059] hover:bg-[#e4c98c] text-black px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-[#c5a059]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                {isVerifying ? 'Verifying Identity...' : 'Verify Wallet Access'}
                </button>
            </div>
          </div>
        )}

        {/* STATS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Global Progress */}
          <div className="bg-[#141416] p-8 rounded-[2.5rem] border border-white/5 shadow-xl hover:border-[#c5a059]/30 transition-all group">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Global Progress</p>
            <p className="text-3xl font-black text-white group-hover:text-[#c5a059] transition-colors">{((airdropProgress / TOTAL_AIRDROP) * 100).toFixed(2)}%</p>
            {/* Gold Progress Bar */}
            <div className="w-full bg-[#0a0a0b] border border-white/5 h-2 rounded-full mt-4 overflow-hidden">
                <div 
                    className="h-full bg-gradient-to-r from-[#927035] via-[#c5a059] to-[#f3eacb] shadow-[0_0_15px_rgba(197,160,89,0.5)]" 
                    style={{ width: `${(airdropProgress / TOTAL_AIRDROP) * 100}%` }} 
                />
            </div>
          </div>

          {/* Weekly Potential */}
          <div className="bg-[#141416] p-8 rounded-[2.5rem] border border-white/5 shadow-xl text-center hover:border-[#c5a059]/30 transition-all group">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Weekly Potential</p>
            <p className="text-3xl font-black text-[#c5a059]">
                {assetsLoading ? <span className="animate-pulse">...</span> : displayWeeklyAllocation.toFixed(2)} 
                <span className="text-xs ml-1 text-gray-400">NTWRK</span>
            </p>
            <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase bg-white/5 inline-block px-3 py-1 rounded-lg border border-white/5 group-hover:border-[#c5a059]/30 group-hover:text-[#c5a059] transition-all">
                {totalBoost.toFixed(1)}x Total Boost
            </p>
          </div>

          {/* Total Secured */}
          <div className="bg-gradient-to-br from-[#1a1a1c] to-[#0a0a0b] p-8 rounded-[2.5rem] border border-[#c5a059]/20 shadow-xl text-right relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#c5a059]/10 blur-[40px] rounded-full pointer-events-none" />
             
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Total Secured</p>
            <div className="flex justify-end items-center gap-2 relative z-10">
              {profileLoading && isVerified ? (
                <div className="w-5 h-5 border-2 border-[#c5a059] border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#c5a059] to-[#927035]">{userTotalAllocation.toFixed(2)}</p>
              )}
              <span className="text-xs text-[#c5a059]/50 font-black self-end mb-1">NTWRK</span>
            </div>
            <p className="text-[9px] text-gray-600 mt-2 font-bold uppercase tracking-widest">Across All Seasons</p>
          </div>
        </div>

        {/* Boost Table (Premium Table Styles) */}
        <section className="bg-[#141416] p-8 rounded-[2.5rem] border border-white/5 mb-12 overflow-hidden shadow-2xl">
          <div className="flex justify-between items-center mb-8 border-b border-white/5 pb-4">
            <h2 className="text-xl font-black uppercase tracking-tighter text-white">
                <span className="text-[#c5a059]">Boost</span> Factors
            </h2>
            {assetsLoading && <span className="text-[10px] text-[#c5a059] animate-pulse font-black uppercase tracking-widest">SYNCING ASSETS...</span>}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">
                  <th className="pb-4 pl-4">Collection</th>
                  <th className="pb-4">Holdings</th>
                  <th className="pb-4">Multiplier</th>
                  <th className="pb-4 text-right pr-4">Contribution</th>
                </tr>
              </thead>
              <tbody className="text-sm font-medium">
                {[
                  { label: 'Noble Genetics', val: holdings.genetics, mult: BOOSTS.genetics },
                  { label: 'Noble Extracts', val: holdings.extracts, mult: BOOSTS.extracts },
                  { label: 'Namaste', val: holdings.namaste, mult: BOOSTS.namaste },
                  { label: 'Solana K9s', val: holdings.solanaK9s, mult: BOOSTS.solanaK9s },
                  { label: 'Sensei', val: holdings.sensei, mult: BOOSTS.sensei },
                  { label: 'The Smoke Out', val: holdings.tso, mult: BOOSTS.tso },
                  { label: 'D3fenders', val: holdings.d3fenders, mult: BOOSTS.d3fenders },
                  { label: 'Stoned Ape Crew', val: holdings.stonedApeCrew, mult: BOOSTS.stonedApeCrew },
                  { label: 'Immortal Geckos', val: holdings.immortalGecko, mult: BOOSTS.immortalGecko },
                  // NEW ROWS
                  { label: 'Time Traveling Chimps', val: holdings.timeTravelingChimps, mult: BOOSTS.timeTravelingChimps },
                  { label: 'Player 1', val: holdings.player1, mult: BOOSTS.player1 },
                  { label: 'NTWRK Staking', val: `${holdings.ntwrkBalance.toLocaleString()} NTWRK`, mult: '1x per 500k', final: ntwrkBoostTiers * BOOSTS.ntwrk }
                ].map((row, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors group">
                    <td className="py-4 pl-4 text-gray-400 group-hover:text-white font-bold">{row.label}</td>
                    <td className="py-4 font-mono text-gray-500 group-hover:text-gray-300">{typeof row.val === 'string' ? row.val : row.val}</td>
                    <td className="py-4 text-xs font-black text-[#c5a059]/70 group-hover:text-[#c5a059]">{typeof row.mult === 'number' ? `+${row.mult}x` : row.mult}</td>
                    <td className="py-4 pr-4 text-right font-black text-gray-300 group-hover:text-[#c5a059]">+{row.final ?? (Number(row.val) * (row.mult as number)).toFixed(1)}x</td>
                  </tr>
                ))}
                <tr className="bg-[#c5a059]/10 border-t border-[#c5a059]/20">
                  <td colSpan={3} className="py-6 px-6 font-black uppercase tracking-widest text-xs text-[#c5a059]">Total Boost Multiplier</td>
                  <td className="py-6 px-6 text-right font-black text-white text-xl">{totalBoost.toFixed(1)}x</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* CLAIM SECTION (The "Vault Door") */}
        <section className="max-w-2xl mx-auto bg-[#141416] p-1 rounded-[3rem] shadow-2xl relative overflow-hidden group">
          {/* Animated Gold Border Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#927035] via-[#c5a059] to-[#0a0a0b] opacity-20 group-hover:opacity-40 transition-opacity" />
          
          <div className="bg-[#0a0a0b] rounded-[2.9rem] p-10 text-center relative z-10 border border-white/5 h-full">
            <h2 className="text-2xl font-black uppercase tracking-tighter mb-4 text-white">
                Secure Weekly <span className="text-[#c5a059]">Allocation</span>
            </h2>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed font-medium">
                Check in once every 7 days to claim your share of the weekly pool.
            </p>
            
            <div className="bg-[#141416] p-6 rounded-3xl border border-white/5 mb-8 inline-block w-full max-w-sm">
                <p className="text-[9px] font-black text-gray-600 uppercase mb-2 tracking-widest">Current Calculation</p>
                <p className="font-mono text-xs text-[#c5a059]">
                    ({totalBoost.toFixed(1)}x Boost / 100) × {WEEKLY_ALLOCATION.toLocaleString()} NTWRK
                </p>
            </div>

            <button 
                onClick={handleCheckIn}
                disabled={!canCheckIn || profileLoading || !isVerified || displayWeeklyAllocation <= 0}
                className={`w-full py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-[0.98]
                    ${canCheckIn && isVerified && displayWeeklyAllocation > 0 
                        ? 'bg-gradient-to-r from-[#c5a059] to-[#927035] text-black hover:brightness-110 shadow-[#c5a059]/20' 
                        : 'bg-[#1a1a1c] text-gray-600 cursor-not-allowed border border-white/5'
                    }
                `}
            >
                {isVerified ? (
                canCheckIn ? (
                    displayWeeklyAllocation > 0 ? `Secure ${displayWeeklyAllocation.toFixed(2)} NTWRK` : 'No Allocation Available'
                ) : `Next Claim in ${(7 - Math.ceil(Math.abs(Date.now() - (lastCheckIn?.getTime() || 0)) / (1000 * 60 * 60 * 24)))} Days`
                ) : 'Identity Verification Required'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}