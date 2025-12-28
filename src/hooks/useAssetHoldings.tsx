import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { useCallback, useEffect, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import axios from 'axios'
import geneticsHashlist from '@/data/noble_genetics_hashlist.json'
import extractsHashlist from '@/data/noble_extracts_hashlist.json'
import namasteHashlist from '@/data/namaste_hashlist.json'
import k9Holders from '@/data/k9_holders.json'
import senseiHolders from '@/data/sensei_holders.json'
import tsoHolders from '@/data/tso_holders.json'
import d3fendersHashlist from '@/data/d3fenders_hashlist.json'
import sacHashlist from '@/data/sac_hashlist.json'

interface ImmortalGecko {
  ownerWallet: string
  isImmortal: string
}

const GECKOS_API_BASE = '/api/immortal-geckos'
const NTWRK_MINT_ADDRESS = 'NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS'

export interface AssetHoldings {
  genetics: number
  extracts: number
  namaste: number
  solanaK9s: number
  sensei: number
  tso: number
  immortalGecko: number
  ntwrkBalance: number
  d3fenders: number
  stonedApeCrew: number
}

export function useAssetHoldings() {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const [holdings, setHoldings] = useState<AssetHoldings | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!publicKey || !connection) {
      setHoldings(null)
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      const walletAddress = publicKey.toBase58()
      let newHoldings: AssetHoldings = {
        genetics: 0,
        extracts: 0,
        namaste: 0,
        solanaK9s: 0,
        sensei: 0,
        tso: 0,
        immortalGecko: 0,
        ntwrkBalance: 0,
        d3fenders: 0,
        stonedApeCrew: 0,
      }

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        publicKey,
        { programId: TOKEN_PROGRAM_ID }
      )

      const geneticsSet = new Set(geneticsHashlist)
      const extractsSet = new Set(extractsHashlist)
      const namasteSet = new Set(namasteHashlist)
      const d3fendersSet = new Set(d3fendersHashlist)
      const sacSet = new Set(sacHashlist)

      tokenAccounts.value.forEach((tokenAccount: {
        account: {
          data: {
            parsed: {
              info: {
                tokenAmount: { uiAmount: number }
                mint: string
              }
            }
          }
        }
      }) => {
        const parsed = tokenAccount.account.data.parsed
        const amount = parsed.info.tokenAmount.uiAmount
        const mint = parsed.info.mint

        if (amount > 0) {
          if (geneticsSet.has(mint)) {
            newHoldings.genetics++
          } else if (extractsSet.has(mint)) {
            newHoldings.extracts++
          } else if (namasteSet.has(mint)) {
            newHoldings.namaste++
          } else if (d3fendersSet.has(mint)) {
            newHoldings.d3fenders++
          } else if (sacSet.has(mint)) {
            newHoldings.stonedApeCrew++
          } else if (mint === NTWRK_MINT_ADDRESS) {
            newHoldings.ntwrkBalance = amount
          }
        }
      })

      // Corrected logic to count occurrences in holder lists
      newHoldings.solanaK9s = k9Holders.filter(holder => holder === walletAddress).length
      newHoldings.sensei = senseiHolders.filter(holder => holder === walletAddress).length
      newHoldings.tso = tsoHolders.filter(holder => holder === walletAddress).length

      try {
        const geckoResponse = await axios.get(
          `${GECKOS_API_BASE}?publicKey=${walletAddress}`
        )
        const ownedGeckos: ImmortalGecko[] = geckoResponse.data.data || []
        newHoldings.immortalGecko = ownedGeckos.length
      } catch (err) {
        console.error('Error fetching Immortal Geckos:', err)
      }

      setHoldings(newHoldings)
    } catch (err) {
      console.error('Error fetching asset holdings:', err)
      setHoldings(null)
    } finally {
      setLoading(false)
    }
  }, [publicKey, connection])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { holdings, loading, refetch: fetchData }
}