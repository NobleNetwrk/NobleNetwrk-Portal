'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'
import axios from 'axios'

import { 
  NOBLE_GENETICS_HASHLIST, NOBLE_EXTRACTS_HASHLIST, NAMASTE_HASHLIST,
  D3FENDERS_HASHLIST, STONED_APE_CREW_HASHLIST, K9_HASHLIST,
  SENSEI_HASHLIST, TSO_HASHLIST
} from '@/utils/hashlistLoader'

const NTWRK_MINT_ADDRESS = 'NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS'
const DAS_RPC_URL = process.env.NEXT_PUBLIC_DAS_RPC_URL || 'https://api.mainnet-beta.solana.com';

export default function Vault() {
  const { publicKey, connected } = useWallet()
  const { connection } = useConnection()
  const router = useRouter()

  const [balances, setBalances] = useState({ sol: 0, ntwrk: 0 })
  const [prices, setPrices] = useState({ sol: 0, ntwrk: 0 })
  const [loading, setLoading] = useState(true)
  const [holdings, setHoldings] = useState({
    genetics: 0, extracts: 0, namaste: 0, solanaK9s: 0,
    sensei: 0, tso: 0, d3fenders: 0, stonedApeCrew: 0,
  })
  const [isVerified, setIsVerified] = useState(false)

  const portfolioValue = useMemo(() => ({
    solUsd: (balances.sol * prices.sol).toFixed(2),
    ntwrkUsd: (balances.ntwrk * prices.ntwrk).toFixed(2)
  }), [balances, prices])

  useEffect(() => {
    if (publicKey) {
      const storedWallet = localStorage.getItem('verifiedWallet')
      if (storedWallet !== publicKey.toBase58()) {
        router.push('/')
      } else {
        setIsVerified(true)
      }
    }
  }, [publicKey, router])

  const fetchData = useCallback(async () => {
    if (!publicKey || !connected) return
    setLoading(true)

    try {
      const results = await Promise.allSettled([
        axios.get('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112,NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS'),
        connection.getBalance(publicKey),
        connection.getParsedTokenAccountsByOwner(publicKey, { mint: new PublicKey(NTWRK_MINT_ADDRESS), programId: TOKEN_PROGRAM_ID }),
        fetch(DAS_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 'portal-sync', method: 'getAssetsByOwner',
            params: { ownerAddress: publicKey.toString(), page: 1, limit: 1000 }
          })
        }).then(res => res.json())
      ])

      if (results[0].status === 'fulfilled') {
        const val = (results[0] as any).value;
        const data = val.data;
        setPrices({
          sol: data['So11111111111111111111111111111111111111112']?.usdPrice || 0,
          ntwrk: data['NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS']?.usdPrice || 0
        })
      }

      if (results[1].status === 'fulfilled') {
        setBalances(prev => ({ ...prev, sol: (results[1] as any).value / 1e9 }))
      }

      if (results[2].status === 'fulfilled') {
        const ntwrkAta = (results[2] as any).value.value[0]
        setBalances(prev => ({ ...prev, ntwrk: ntwrkAta?.account.data.parsed.info.tokenAmount.uiAmount || 0 }))
      }

      if (results[3].status === 'fulfilled') {
        const val = (results[3] as any).value;
        if (!val.error) {
          const assets = val.result.items
          const counts = { genetics: 0, extracts: 0, namaste: 0, solanaK9s: 0, sensei: 0, tso: 0, d3fenders: 0, stonedApeCrew: 0 }
          
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

          assets.forEach((asset: any) => {
            if (hashSets.genetics.has(asset.id)) counts.genetics++
            else if (hashSets.extracts.has(asset.id)) counts.extracts++
            else if (hashSets.namaste.has(asset.id)) counts.namaste++
            else if (hashSets.k9.has(asset.id)) counts.solanaK9s++
            else if (hashSets.sensei.has(asset.id)) counts.sensei++
            else if (hashSets.tso.has(asset.id)) counts.tso++
            else if (hashSets.d3fenders.has(asset.id)) counts.d3fenders++
            else if (hashSets.stonedApe.has(asset.id)) counts.stonedApeCrew++
          })
          setHoldings(prev => ({ ...prev, ...counts }))
        }
      }

      toast.success('Portal Synced')
    } catch (err) {
      toast.error('Sync error')
    } finally {
      setLoading(false)
    }
  }, [publicKey, connected, connection])

  useEffect(() => {
    if (isVerified) fetchData()
  }, [isVerified, fetchData])

  if (!isVerified || !connected) return null

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
          <div className="flex items-center gap-4">
            <Image src="/ntwrk-logo.png" alt="Logo" width={64} height={64} className="rounded-full border-2 border-blue-500 shadow-lg" />
            <div>
              <h1 className="text-3xl font-black tracking-tighter uppercase">NobleNetwrk Portal</h1>
              <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Authorized Member</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <button onClick={() => router.push('/Airdrop')} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95">
              $NTWRK Airdrop
            </button>
            <button onClick={() => router.push('/K9Impound')} className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95">
              K9 Impound
            </button>
            {/* NEW: Panda Love Level Button in Header */}
            <button onClick={() => router.push('/PandaLoveLevel')} className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95">
              Panda Love Level
            </button>
            <button onClick={fetchData} disabled={loading} className="p-3 bg-gray-900 rounded-2xl border border-white/5 hover:bg-gray-800 transition-colors">
              <svg className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.836 3a8.001 8.001 0 00-15.836-3L4 12m14.004 6.183L18 9.227m-1.722-1.722A8.001 8.001 0 004 12m14.004 6.183L18 15.227" /></svg>
            </button>
          </div>
        </header>

        {/* Balance Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
                <Image src="/solana-logo.png" alt="SOL" width={28} height={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">SOL Balance</p>
                <h2 className="text-2xl font-black">{balances.sol.toFixed(4)}</h2>
              </div>
            </div>
            <p className="text-lg font-bold text-indigo-400">${portfolioValue.solUsd}</p>
          </div>

          <div className="bg-gray-900/40 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/5 flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-green-500/10 rounded-2xl flex items-center justify-center border border-green-500/20">
                <Image src="/ntwrk-logo.png" alt="NTWRK" width={28} height={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">$NTWRK Balance</p>
                <h2 className="text-2xl font-black">{balances.ntwrk.toLocaleString()}</h2>
              </div>
            </div>
            <p className="text-lg font-bold text-green-400">${portfolioValue.ntwrkUsd}</p>
          </div>
        </div>

        <div className="mb-6 flex justify-between items-end">
          <h2 className="text-xl font-black uppercase tracking-tighter">Verified Assets</h2>
          <p className="text-[10px] font-bold text-gray-600 uppercase">Synced via DAS Protocol</p>
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
                stonedApeCrew: { label: 'Stoned Ape', icon: '/sac-icon.png', color: 'green' }
              }[key] || { label: key, icon: '/ntwrk-logo.png', color: 'gray' };

              return (
                <div key={key} className="bg-gray-900/40 backdrop-blur-md p-6 rounded-3xl border border-white/5 transition-all group hover:scale-[1.02] shadow-lg">
                  <div className="flex justify-between items-start mb-6">
                    <Image src={config.icon} alt={config.label} width={42} height={42} className="rounded-xl" />
                    <div className={`px-2 py-0.5 rounded bg-${config.color}-500/10 text-${config.color}-400 text-[8px] font-black uppercase tracking-widest`}>OK</div>
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-tight mb-1">{config.label}</h3>
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-black text-white">{count}</span>
                    {config.action && count > 0 && (
                      <button 
                        onClick={() => router.push(`/${config.action}`)} 
                        className={`text-[9px] font-black text-${config.color}-400 hover:text-${config.color}-300 uppercase tracking-widest underline decoration-2 underline-offset-4 transition-all`}
                      >
                        {config.actionLabel}
                      </button>
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