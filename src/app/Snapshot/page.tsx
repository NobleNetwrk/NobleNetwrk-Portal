'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function SnapshotTool() {
  const { publicKey, connected } = useWallet()
  const router = useRouter()
  const [mintAddress, setMintAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [holders, setHolders] = useState<string[]>([])

  // Basic security: Check localstorage verification
  useEffect(() => {
    if (!connected || localStorage.getItem('verifiedWallet') !== publicKey?.toBase58()) {
      router.push('/')
    }
  }, [connected, publicKey, router])

  const takeSnapshot = async () => {
    if (!mintAddress) return toast.error("Enter a Mint/Collection Address")
    setLoading(true)
    try {
      const response = await fetch(process.env.NEXT_PUBLIC_DAS_RPC_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 'snapshot', method: 'getAssetsByGroup',
          params: { groupKey: 'collection', groupValue: mintAddress, page: 1, limit: 1000 }
        })
      })
      const data = await response.json()
      const owners = data.result.items.map((item: any) => item.ownership.owner)
      const uniqueOwners = Array.from(new Set(owners)) as string[]
      setHolders(uniqueOwners)
      toast.success(`Found ${uniqueOwners.length} unique holders`)
    } catch (err) {
      toast.error("Failed to fetch holders")
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = () => {
    const blob = new Blob([holders.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `snapshot-${mintAddress.slice(0, 8)}.csv`
    a.click()
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-3xl mx-auto bg-gray-900/50 p-8 rounded-[2.5rem] border border-white/5">
        <h1 className="text-3xl font-black uppercase tracking-tighter mb-2">Snapshot Tool</h1>
        <p className="text-gray-500 text-xs mb-8 uppercase font-bold tracking-widest">Collection Holder Extraction</p>

        <div className="space-y-4">
          <input 
            value={mintAddress}
            onChange={(e) => setMintAddress(e.target.value)}
            placeholder="Collection Mint Address..."
            className="w-full bg-black/50 border border-white/10 p-4 rounded-2xl text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button 
            onClick={takeSnapshot}
            disabled={loading}
            className="w-full bg-indigo-600 p-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all flex justify-center"
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Fetch Holders'}
          </button>
        </div>

        {holders.length > 0 && (
          <div className="mt-8 pt-8 border-t border-white/5">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{holders.length} Holders Found</span>
              <button onClick={downloadCSV} className="text-xs font-black text-indigo-400 hover:underline uppercase tracking-widest">Download CSV</button>
            </div>
            <div className="max-h-64 overflow-y-auto bg-black/30 p-4 rounded-xl font-mono text-[10px] text-gray-500 break-all">
              {holders.map(h => <div key={h} className="mb-1">{h}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}