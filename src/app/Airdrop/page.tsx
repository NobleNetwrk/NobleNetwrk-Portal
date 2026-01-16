'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo } from 'react'
import LoadingSpinner from '@/components/LoadingSpinner'
import Image from 'next/image'
import { toast } from 'react-toastify'
import base58 from 'bs58'

// Ensure these imports match your actual file structure
import { 
  NOBLE_GENETICS_HASHLIST, NOBLE_EXTRACTS_HASHLIST, NAMASTE_HASHLIST,
  D3FENDERS_HASHLIST, STONED_APE_CREW_HASHLIST, K9_HASHLIST,
  SENSEI_HASHLIST, TSO_HASHLIST
} from '@/utils/hashlistLoader'

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

  // State
  const [airdropProgress, setAirdropProgress] = useState(0)
  const [userTotalAllocation, setUserTotalAllocation] = useState(0)
  const [lastCheckIn, setLastCheckIn] = useState<Date | null>(null)
  const [canCheckIn, setCanCheckIn] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [loading, setLoading] = useState(true)
  
  // Track claimed amount locally for UI updates until refresh
  const [sessionClaimed, setSessionClaimed] = useState(0)

  // Holdings State
  const [holdings, setHoldings] = useState({
    genetics: 0, extracts: 0, namaste: 0, solanaK9s: 0,
    sensei: 0, tso: 0, d3fenders: 0, stonedApeCrew: 0,
    immortalGecko: 0, ntwrkBalance: 0,
  })

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
    // Basic formula: (Boost / 100) * Base Pool
    const calculated = (totalBoost / 100) * WEEKLY_ALLOCATION;
    // Ensure they can't claim more than what's left in the global pool (optional logic) 
    // or just display the calculated amount.
    return calculated; 
  }, [totalBoost]);

  // --- Data Fetching ---

  const fetchAllData = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);

    try {
      // 1. Fetch User Profile (Allocation, Check-in time, Linked Wallets)
      const res = await fetch(`/api/airdrop?address=${publicKey.toBase58()}`);
      
      let userData = { linkedWallets: [], totalAllocation: 0, lastCheckIn: null };
      if (res.ok) {
        userData = await res.json();
      } else {
        console.warn("User profile fetch failed, defaulting to current wallet.");
      }

      setUserTotalAllocation(userData.totalAllocation || 0);
      
      const lDate = userData.lastCheckIn ? new Date(userData.lastCheckIn) : null;
      setLastCheckIn(lDate);
      
      // Calculate 7-day cooldown
      const now = new Date();
      const diffTime = lDate ? Math.abs(now.getTime() - lDate.getTime()) : Infinity;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
      setCanCheckIn(!lDate || diffDays >= 7);

      // 2. AGGREGATE HOLDINGS ACROSS ALL LINKED WALLETS
      // If DB has linked wallets, use them. Otherwise, just scan the current one.
      const walletsToScan = (userData.linkedWallets && userData.linkedWallets.length > 0) 
                            ? userData.linkedWallets 
                            : [publicKey.toBase58()];

      // Initialize counters
      let grandTotal = { 
        genetics: 0, extracts: 0, namaste: 0, solanaK9s: 0, 
        sensei: 0, tso: 0, d3fenders: 0, stonedApeCrew: 0,
        immortalGecko: 0, ntwrkBalance: 0 
      }

      // Hash Sets for O(1) Lookup
      const hashSets = {
        genetics: new Set(NOBLE_GENETICS_HASHLIST),
        extracts: new Set(NOBLE_EXTRACTS_HASHLIST),
        namaste: new Set(NAMASTE_HASHLIST),
        k9: new Set(K9_HASHLIST),
        sensei: new Set(SENSEI_HASHLIST),
        tso: new Set(TSO_HASHLIST),
        d3fenders: new Set(D3FENDERS_HASHLIST),
        stonedApe: new Set(STONED_APE_CREW_HASHLIST)
      }

      // Parallel Fetch for Speed
      await Promise.all(walletsToScan.map(async (addr: string) => {
        try {
          // A. Fetch Standard Holdings (NFTs + Tokens)
          const hRes = await fetch(`/api/holdings?address=${addr}`).then(r => r.ok ? r.json() : null);
          
          if (hRes) {
            if (hRes.balances?.ntwrk) grandTotal.ntwrkBalance += hRes.balances.ntwrk;
            
            if (hRes.nfts && Array.isArray(hRes.nfts)) {
              hRes.nfts.forEach((asset: any) => {
                const id = asset.id;
                const group = asset.grouping?.[0]?.group_value;
                
                if (hashSets.genetics.has(id) || hashSets.genetics.has(group)) grandTotal.genetics++;
                else if (hashSets.extracts.has(id) || hashSets.extracts.has(group)) grandTotal.extracts++;
                else if (hashSets.namaste.has(id) || hashSets.namaste.has(group)) grandTotal.namaste++;
                else if (hashSets.k9.has(id) || hashSets.k9.has(group)) grandTotal.solanaK9s++;
                else if (hashSets.sensei.has(id) || hashSets.sensei.has(group)) grandTotal.sensei++;
                else if (hashSets.tso.has(id) || hashSets.tso.has(group)) grandTotal.tso++;
                else if (hashSets.d3fenders.has(id) || hashSets.d3fenders.has(group)) grandTotal.d3fenders++;
                else if (hashSets.stonedApe.has(id) || hashSets.stonedApe.has(group)) grandTotal.stonedApeCrew++;
              });
            }
          }

          // B. Fetch Immortal Geckos (Separate Endpoint)
          const gRes = await fetch(`/api/immortal-geckos?wallet=${addr}`).then(r => r.ok ? r.json() : null);
          if (gRes?.count) grandTotal.immortalGecko += gRes.count;

        } catch (innerErr) {
          console.error(`Failed to scan wallet ${addr}`, innerErr);
        }
      }));

      setHoldings(grandTotal);

      // 3. Fetch Global Stats
      const gStats = await fetch('/api/airdrop?global=true').then(r => r.ok ? r.json() : { totalAllocated: 0 });
      setAirdropProgress(gStats.totalAllocated || 0);

    } catch (e) {
      console.error("Sync Error:", e);
      toast.error('Failed to sync user data');
    } finally {
      setLoading(false);
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
      fetchAllData()
    } catch (err) {
      toast.error('Wallet verification failed')
      disconnect()
    } finally {
      setIsVerifying(false)
    }
  }, [publicKey, signMessage, disconnect, fetchAllData])

  const handleCheckIn = async () => {
    if (!isVerified || !canCheckIn || displayWeeklyAllocation <= 0) return;
    
    try {
      setLoading(true);
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
      
      setUserTotalAllocation(data.totalAllocation); // Update UI with new total
      setAirdropProgress(data.globalProgress);      // Update global bar
      setLastCheckIn(new Date());                   // Reset timer
      setCanCheckIn(false);                         // Lock button
      setSessionClaimed(prev => prev + displayWeeklyAllocation);
      
      toast.success(`Secured ${displayWeeklyAllocation.toFixed(2)} NTWRK!`);
    } catch (e) { 
      toast.error('Failed to process check-in'); 
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // --- Effects ---

  useEffect(() => {
    const stored = localStorage.getItem('verifiedWallet');
    if (connected && stored === publicKey?.toBase58()) {
      setIsVerified(true);
      fetchAllData();
    } else if (connected) {
      setIsVerified(false);
      // Optional: Clear data if wallet changes but not verified
      setHoldings({
        genetics: 0, extracts: 0, namaste: 0, solanaK9s: 0,
        sensei: 0, tso: 0, d3fenders: 0, stonedApeCrew: 0,
        immortalGecko: 0, ntwrkBalance: 0,
      });
    }
  }, [connected, publicKey, fetchAllData]);

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
            <p className="text-3xl font-black text-green-500">{displayWeeklyAllocation.toFixed(2)} <span className="text-xs">NTWRK</span></p>
            <p className="text-[10px] text-gray-600 mt-2 font-bold uppercase">{totalBoost.toFixed(1)}x Total Boost</p>
          </div>

          {/* Total Secured */}
          <div className="bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 shadow-xl text-right">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Secured</p>
            <p className="text-3xl font-black text-purple-500">{userTotalAllocation.toFixed(2)} <span className="text-xs">NTWRK</span></p>
            <p className="text-[10px] text-gray-600 mt-2 font-bold uppercase tracking-tight">Across All Seasons</p>
          </div>
        </div>

        {/* Boost Table */}
        <section className="bg-gray-900/40 backdrop-blur-md p-8 rounded-[2.5rem] border border-white/5 mb-12 overflow-hidden">
          <h2 className="text-xl font-black uppercase tracking-tighter mb-8">Boost Factors</h2>
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
            disabled={!canCheckIn || loading || !isVerified || displayWeeklyAllocation <= 0}
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