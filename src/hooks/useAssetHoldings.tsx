import { useCallback, useEffect, useState } from 'react'

// Import Hashlists
import geneticsHashlist from '@/data/noble_genetics_hashlist.json'
import extractsHashlist from '@/data/noble_extracts_hashlist.json'
import namasteHashlist from '@/data/namaste_hashlist.json'
import d3fendersHashlist from '@/data/d3fenders_hashlist.json'
import sacHashlist from '@/data/sac_hashlist.json'
import k9Hashlist from '@/data/solanak9s_hashlist.json'
import senseiHashlist from '@/data/sensei_hashlist.json'
import tsoHashlist from '@/data/tso_hashlist.json'
import ttcHashlist from '@/data/TimeTravelingChimps_hashlist.json'
import p1Hashlist from '@/data/Player1_hashlist.json'
// NEW IMPORT
import ggHashlist from '@/data/GalacticGecko_hashlist.json'

export interface AssetHoldings {
  wallet: string
  solBalance: number
  ntwrkBalance: number
  genetics: number
  extracts: number
  namaste: number
  solanaK9s: number
  sensei: number
  tso: number
  immortalGecko: number
  d3fenders: number
  stonedApeCrew: number
  timeTravelingChimps: number
  player1: number
  // NEW TYPE
  galacticGeckos: number
}

// Convert ALL Hashlists to Sets for O(1) instant lookup
const hashlistSets = {
  genetics: new Set(geneticsHashlist),
  extracts: new Set(extractsHashlist),
  namaste: new Set(namasteHashlist),
  d3fenders: new Set(d3fendersHashlist),
  sac: new Set(sacHashlist),
  k9: new Set(k9Hashlist),
  sensei: new Set(senseiHashlist),
  tso: new Set(tsoHashlist),
  ttc: new Set(ttcHashlist),
  p1: new Set(p1Hashlist),
  // NEW SET
  gg: new Set(ggHashlist),
}

export function useAssetHoldings(wallets: string[]) {
  const [holdings, setHoldings] = useState<AssetHoldings[]>([])
  const [loading, setLoading] = useState(false)
  
  const storageKey = `noble_assets_${wallets.sort().join('_')}`

  const fetchData = useCallback(async (forceRefresh = false) => {
    if (wallets.length === 0) return

    setLoading(true)

    // 1. CHECK CACHE
    if (!forceRefresh) {
      const cached = localStorage.getItem(storageKey)
      if (cached) {
        try {
          const parsed = JSON.parse(cached)
          if (Date.now() - parsed.timestamp < 1000 * 60 * 60 * 24) {
            console.log("⚡ Loaded assets from cache")
            setHoldings(parsed.data)
            setLoading(false)
            return
          }
        } catch (e) { localStorage.removeItem(storageKey) }
      }
    }

    try {
      console.log("🌐 Fetching batch data...")
      const walletString = wallets.join(',')

      // 2. BATCH FETCH
      // We keep the immortal-geckos fetch as requested for Airdrop logic
      const [holdingsRes, geckosRes] = await Promise.all([
        fetch(`/api/holdings?wallets=${walletString}`).then(r => r.json()),
        fetch(`/api/immortal-geckos?wallets=${walletString}`).then(r => r.json())
      ])

      const apiData = holdingsRes.data || []
      const geckoData = geckosRes.data || []

      // 3. PROCESS DATA
      const processedResults: AssetHoldings[] = apiData.map((wData: any) => {
        const wallet = wData.wallet
        const nfts = wData.nfts || []
        
        // Initialize counts
        let counts = { 
            genetics: 0, extracts: 0, namaste: 0, d3fenders: 0, sac: 0,
            k9: 0, sensei: 0, tso: 0, ttc: 0, p1: 0, gg: 0 
        }
        
        // Loop through LIVE NFTs
        nfts.forEach((nft: any) => {
          const id = nft.id;
          const group = nft.grouping?.[0]?.group_value;
          
          if (hashlistSets.genetics.has(id) || hashlistSets.genetics.has(group)) counts.genetics++
          else if (hashlistSets.extracts.has(id) || hashlistSets.extracts.has(group)) counts.extracts++
          else if (hashlistSets.namaste.has(id) || hashlistSets.namaste.has(group)) counts.namaste++
          else if (hashlistSets.d3fenders.has(id) || hashlistSets.d3fenders.has(group)) counts.d3fenders++
          else if (hashlistSets.sac.has(id) || hashlistSets.sac.has(group)) counts.sac++
          else if (hashlistSets.k9.has(id) || hashlistSets.k9.has(group)) counts.k9++
          else if (hashlistSets.sensei.has(id) || hashlistSets.sensei.has(group)) counts.sensei++
          else if (hashlistSets.tso.has(id) || hashlistSets.tso.has(group)) counts.tso++
          else if (hashlistSets.ttc.has(id) || hashlistSets.ttc.has(group)) counts.ttc++
          else if (hashlistSets.p1.has(id) || hashlistSets.p1.has(group)) counts.p1++
          // NEW CHECK: Galactic Geckos via Hashlist
          else if (hashlistSets.gg.has(id) || hashlistSets.gg.has(group)) counts.gg++
        })

        // Filter Immortal Geckos (Legacy logic preserved)
        const geckoCount = geckoData.filter((g: any) => 
            g.ownerWallet?.toLowerCase() === wallet.toLowerCase()
        ).length

        return {
          wallet,
          solBalance: wData.balances.sol || 0,
          ntwrkBalance: wData.balances.ntwrk || 0,
          genetics: counts.genetics,
          extracts: counts.extracts,
          namaste: counts.namaste,
          d3fenders: counts.d3fenders,
          stonedApeCrew: counts.sac,
          solanaK9s: counts.k9,
          sensei: counts.sensei,
          tso: counts.tso,
          immortalGecko: geckoCount,
          timeTravelingChimps: counts.ttc,
          player1: counts.p1,
          // NEW FIELD
          galacticGeckos: counts.gg
        }
      })

      setHoldings(processedResults)

      localStorage.setItem(storageKey, JSON.stringify({
        timestamp: Date.now(),
        data: processedResults
      }))

    } catch (err) {
      console.error('Error fetching assets:', err)
    } finally {
      setLoading(false)
    }
  }, [wallets, storageKey])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { holdings, loading, refetch: () => fetchData(true) }
}