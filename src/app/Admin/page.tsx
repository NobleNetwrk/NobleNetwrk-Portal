'use client'

import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import LoadingSpinner from '@/components/LoadingSpinner'

// Basic client-side check (Server does the real check)
const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(',')

export default function AdminConsole() {
  const { publicKey, connected, signMessage } = useWallet()
  const router = useRouter()
  
  const [impoundRate, setImpoundRate] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!connected) return
    if (!ADMIN_WALLETS.includes(publicKey?.toBase58() || '')) {
      router.push('/Portal')
      toast.error('Unauthorized Access')
      return
    }
    fetch('/api/admin/settings').then(res => res.json()).then(d => {
       setImpoundRate(d.value)
       setLoading(false)
    })
  }, [connected, publicKey, router])

  const handleSave = async () => {
    if (!publicKey || !signMessage) return
    setSaving(true)

    try {
      // 1. Prepare Message
      const timestamp = Date.now()
      const message = `Authorize System Update:\nSet K9 Payout to ${impoundRate}\nAdmin: ${publicKey.toBase58()}\nTS: ${timestamp}`
      
      // 2. Sign Message (Proof of Ownership)
      const messageBytes = new TextEncoder().encode(message)
      const signature = await signMessage(messageBytes)
      const signatureBase64 = Buffer.from(signature).toString('base64')

      // 3. Send to API
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          value: impoundRate,
          wallet: publicKey.toBase58(),
          message: message,
          signature: signatureBase64
        })
      })
      
      if (res.ok) toast.success('Secure Update Confirmed')
      else toast.error('Security verification failed')

    } catch (err) {
      console.error(err)
      toast.error('Update Cancelled')
    } finally {
      setSaving(false)
    }
  }

  if (!connected) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Connect Admin Wallet</div>
  if (loading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><LoadingSpinner size="lg" /></div>

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black uppercase text-red-500 mb-8">Secure Admin Console</h1>
        <div className="bg-gray-900 border border-red-500/30 p-8 rounded-3xl">
          <label className="text-xs text-gray-500 uppercase font-black">K9 Impound Payout</label>
          <div className="flex gap-4 mt-2">
            <input 
              type="number" 
              value={impoundRate}
              onChange={(e) => setImpoundRate(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 w-full"
            />
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-red-600 hover:bg-red-700 text-white px-8 rounded-xl font-black text-xs uppercase"
            >
              {saving ? 'Verifying...' : 'Sign & Update'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}