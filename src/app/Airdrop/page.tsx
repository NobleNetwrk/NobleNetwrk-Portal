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
}

const NTWRK_BOOST_THRESHOLD = 500000;
const TOTAL_AIRDROP = 5000000;
const WEEKLY_ALLOCATION = 10000;

export default function AirdropPage() {
  const { publicKey, connected, signMessage, disconnect } = useWallet()
  const router = useRouter()

  // --- State ---
  const [linkedWallets, setLinkedWallets] = useState<string[]>([]) 
  const [airdropProgress, setAirdropProgress] = useState(0)
  const [userTotalAllocation, setUserTotalAllocation] = useState(0)
  const [lastCheckIn, setLastCheckIn] = useState<Date | null>(null)
  const [canCheckIn, setCanCheckIn] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  
  // FIX 1: Start false so we don't block the UI if not verifying
  const [profileLoading, setProfileLoading] = useState(false) 
  const [sessionClaimed, setSessionClaimed] = useState(0)

  // --- 1. SAFELY LOAD WALLETS (The Fix) ---
  useEffect(() => {
    try {
      // Safely parse localStorage to handle both old Strings and new Objects
      const stored = JSON.parse(localStorage.getItem('noble_wallets') || '[]')
      
      if (Array.isArray(stored)) {
        if (stored.length > 0 && typeof stored[0] === 'object') {
          // New Format: Extract just the addresses
          setLinkedWallets(stored.map((w: any) => w.address))
        } else {
          // Old Format: It's already strings
          setLinkedWallets(stored)
        }
      }
    } catch (e) {
      console.error("Wallet load error", e)
    }

    // Also fetch Global Stats immediately so the bar works
    fetch('/api/airdrop?global=true')
      .then(res => res.json())
      .then(data => setAirdropProgress(data.totalAllocated || 0))
      .catch(err => console.error("Global stats failed", err))
  }, [])

  // --- 2. USE THE HOOK ---
  const { holdings: walletData, loading: assetsLoading } = useAssetHoldings(linkedWallets)

  // --- 3. AGGREGATE TOTALS ---
  const holdings = useMemo(() => {
    const initial = {
      genetics: 0, extracts: 0, namaste: 0, solanaK9s: 0,
      sensei: 0, tso: 0, d3fenders: 0, stonedApeCrew: 0,
      immortalGecko: 0, ntwrkBalance: 0,
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
    }), initial)
  }, [walletData])

  // --- Calculations ---
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
      (ntwrkBoostTiers * BOOSTS.ntwrk)
    )
  }, [holdings, ntwrkBoostTiers])

  const displayWeeklyAllocation = useMemo(() => {
    return (totalBoost / 100) * WEEKLY_ALLOCATION;
  }, [totalBoost]);

  // --- Data Fetching (Profile Only) ---
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

      // Merge API wallets with LocalStorage wallets to be safe
      if (userData.linkedWallets && userData.linkedWallets.length > 0) {
        setLinkedWallets(prev => Array.from(new Set([...prev, ...userData.linkedWallets])));
      }

    } catch (e) {
      console.error("Sync Error:", e);
      // Don't toast error here to avoid spamming users on load
    } finally {
      setProfileLoading(false);
    }
  }, [publicKey]);

  // --- Actions ---
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

  // --- Effects ---
  useEffect(() => {
    const stored = localStorage.getItem('verifiedWallet');
    if (connected && stored === publicKey?.toBase58()) {
      setIsVerified(true);
      fetchUserProfile();
    } else if (connected) {
      setIsVerified(false);
      // DO NOT reset linkedWallets here, keep what we loaded from LS so stats still show
    }
  }, [connected, publicKey, fetchUserProfile]);

  if (!connected) return <div className="min-h-screen flex items-center justify-center bg-gray-950"><LoadingSpinner size="lg" /></div>

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12 gap-4">
          <div className="flex items-center gap-4">
            <Image src="/ntwrk-logo.png" alt="Logo" width={48} height={48} className="rounded-full border border-blue-500/50 shadow-lg shadow-blue-500/20" />
            <h1 className="text-2xl font-black uppercase tracking-tighter">$NTWRK ALLOCATION</h1>
          </div>
          <button onClick={() => router.push('/Portal')} className="bg-gray-900 border border-white/5 hover:bg-gray-800 text-gray-400 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all">
            Back to Portal
          </button>
        </header>

        {/* Verification Banner */}
        {!isVerified && (
          <div className="mb-8 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 text-yellow-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              <p className="font-bold text-sm">Wallet verification required to participate in the airdrop.</p>
            </div>
            <button onClick={verifyWallet} disabled={isVerifying} className="bg-yellow-500 text-black px-6 py-2 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-yellow-400 transition-all disabled:opacity-50">
              {isVerifying ? 'Verifying...' : 'Verify Wallet'}
            </button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Global Progress */}
          <div className="bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Global Progress</p>
            <p className="text-3xl font-black text-blue-500">{((airdropProgress / TOTAL_AIRDROP) * 100).toFixed(2)}%</p>
            <div className="w-full bg-gray-800 h-1.5 rounded-full mt-4 overflow-hidden"><div className="bg-blue-500 h-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" style={{ width: `${(airdropProgress / TOTAL_AIRDROP) * 100}%` }} /></div>
          </div>

          {/* Weekly Potential */}
          <div className="bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-xl text-center">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Weekly Potential</p>
            <p className="text-3xl font-black text-green-500">
                {assetsLoading ? <span className="animate-pulse">...</span> : displayWeeklyAllocation.toFixed(2)} 
                <span className="text-xs ml-1">NTWRK</span>
            </p>
            <p className="text-[10px] text-gray-600 mt-2 font-bold uppercase">{totalBoost.toFixed(1)}x Total Boost</p>
          </div>

          {/* Total Secured */}
          <div className="bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-xl text-right">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Secured</p>
            <div className="flex justify-end items-center gap-2">
              {profileLoading && isVerified ? (
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <p className="text-3xl font-black text-purple-500">{userTotalAllocation.toFixed(2)}</p>
              )}
              <span className="text-xs text-purple-400 font-bold self-end mb-1">NTWRK</span>
            </div>
            <p className="text-[10px] text-gray-600 mt-2 font-bold uppercase tracking-tight">Across All Seasons</p>
          </div>
        </div>

        {/* Boost Table */}
        <section className="bg-gray-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 mb-12 overflow-hidden">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-black uppercase tracking-tighter">Boost Factors</h2>
            {assetsLoading && <span className="text-xs text-blue-400 animate-pulse font-mono">SYNCING ASSETS...</span>}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  <th className="pb-4">Collection</th>
                  <th className="pb-4">Holdings</th>
                  <th className="pb-4">Multiplier</th>
                  <th className="pb-4 text-right">Boost Contribution</th>
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
                  { label: 'NTWRK Staking', val: `${holdings.ntwrkBalance.toLocaleString()} NTWRK`, mult: '1x per 500k', final: ntwrkBoostTiers * BOOSTS.ntwrk }
                ].map((row, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="py-4 text-gray-300">{row.label}</td>
                    <td className="py-4 font-black">{typeof row.val === 'string' ? row.val : row.val}</td>
                    <td className="py-4 text-xs text-gray-500">{typeof row.mult === 'number' ? `+${row.mult}x` : row.mult}</td>
                    <td className="py-4 text-right font-black text-green-500">+{row.final ?? (Number(row.val) * (row.mult as number)).toFixed(1)}x</td>
                  </tr>
                ))}
                <tr className="bg-white/5">
                  <td colSpan={3} className="py-6 px-4 font-black uppercase tracking-widest text-xs">Total Boost Multiplier</td>
                  <td className="py-6 px-4 text-right font-black text-green-400 text-xl">{totalBoost.toFixed(1)}x</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Claim Section */}
        <section className="max-w-2xl mx-auto bg-gray-900/40 backdrop-blur-md p-10 rounded-[3rem] border border-white/5 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">Secure Weekly Allocation</h2>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">Check in once every 7 days to claim your share of the weekly pool.</p>
          
          <div className="bg-gray-950/50 p-6 rounded-3xl border border-white/5 mb-8 inline-block w-full max-w-sm">
            <p className="text-[10px] font-black text-gray-500 uppercase mb-2">Current Calculation</p>
            <p className="font-mono text-xs text-blue-400">({totalBoost.toFixed(1)}x Boost / 100) × {WEEKLY_ALLOCATION} NTWRK</p>
          </div>

          <button 
            onClick={handleCheckIn}
            disabled={!canCheckIn || profileLoading || !isVerified || displayWeeklyAllocation <= 0}
            className={`w-full py-6 rounded-[2rem] font-black uppercase tracking-widest text-xs transition-all shadow-xl active:scale-[0.98] ${canCheckIn && isVerified && displayWeeklyAllocation > 0 ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-900/40' : 'bg-gray-800 text-gray-600 cursor-not-allowed grayscale'}`}
          >
            {isVerified ? (
              canCheckIn ? (
                displayWeeklyAllocation > 0 ? `Secure ${displayWeeklyAllocation.toFixed(2)} NTWRK` : 'No Allocation Available'
              ) : `Next Claim in ${(7 - Math.ceil(Math.abs(Date.now() - (lastCheckIn?.getTime() || 0)) / (1000 * 60 * 60 * 24)))} Days`
            ) : 'Verification Required'}
          </button>
        </section>
      </div>
    </main>
  );
}