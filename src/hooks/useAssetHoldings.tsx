import { useCallback, useEffect, useState } from 'react'

// Import Hashlists (Corrected filenames based on your screenshot)
import geneticsHashlist from '@/data/noble_genetics_hashlist.json'
import extractsHashlist from '@/data/noble_extracts_hashlist.json'
import namasteHashlist from '@/data/namaste_hashlist.json'
import d3fendersHashlist from '@/data/d3fenders_hashlist.json'
import sacHashlist from '@/data/sac_hashlist.json'
import k9Hashlist from '@/data/solanak9s_hashlist.json' // <--- Corrected from screenshot
import senseiHashlist from '@/data/sensei_hashlist.json'
import tsoHashlist from '@/data/tso_hashlist.json'

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
  tso: new Set(tsoHashlist)
}

export function useAssetHoldings(wallets: string[]) {
  const [holdings, setHoldings] = useState<AssetHoldings[]>([])
  const [loading, setLoading] = useState(false)
  
  // Create a storage key based on the sorted list of wallets
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
          // Valid for 24 hours
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

      // 2. BATCH FETCH from your API
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
            k9: 0, sensei: 0, tso: 0 
        }
        
        // Loop through LIVE NFTs from Helius
        nfts.forEach((nft: any) => {
          const id = nft.id;
          // Check grouping (Collection Address) if available
          const group = nft.grouping?.[0]?.group_value;
          
          // Check against all hashlists
          if (hashlistSets.genetics.has(id) || hashlistSets.genetics.has(group)) counts.genetics++
          else if (hashlistSets.extracts.has(id) || hashlistSets.extracts.has(group)) counts.extracts++
          else if (hashlistSets.namaste.has(id) || hashlistSets.namaste.has(group)) counts.namaste++
          else if (hashlistSets.d3fenders.has(id) || hashlistSets.d3fenders.has(group)) counts.d3fenders++
          else if (hashlistSets.sac.has(id) || hashlistSets.sac.has(group)) counts.sac++
          // Live checks for the previously "holder-based" collections
          else if (hashlistSets.k9.has(id) || hashlistSets.k9.has(group)) counts.k9++
          else if (hashlistSets.sensei.has(id) || hashlistSets.sensei.has(group)) counts.sensei++
          else if (hashlistSets.tso.has(id) || hashlistSets.tso.has(group)) counts.tso++
        })

        // Filter Geckos for this specific wallet
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
          immortalGecko: geckoCount
        }
      })

      setHoldings(processedResults)

      // 4. SAVE TO STORAGE
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