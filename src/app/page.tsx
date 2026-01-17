'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { toast } from 'react-toastify'
import { base58 } from '@/lib/base58'

const WalletConnectDynamic = dynamic(() => import('@/components/WalletConnect'), { ssr: false })

export default function Home() {
  const { publicKey, connected, signMessage, disconnect } = useWallet()
  const router = useRouter()
  const [isSigning, setIsSigning] = useState(false)

  // Clear data on mount to ensure fresh login
  useEffect(() => {
    if (!connected) {
      localStorage.removeItem('noble_userId');
      localStorage.removeItem('noble_wallets');
      localStorage.removeItem('active_wallet');
    }
  }, [connected]);

  const handleLogin = useCallback(async () => {
    if (!connected || !publicKey || !signMessage) return

    // Prevent re-login loop if already verified
    const cachedWallet = localStorage.getItem('active_wallet');
    const cachedUserId = localStorage.getItem('noble_userId');
    
    if (cachedWallet === publicKey.toBase58() && cachedUserId) {
      router.push('/Portal'); 
      return;
    }

    setIsSigning(true)
    try {
      const timestamp = new Date().getTime()
      const message = `NobleNetwrk Portal Login\nWallet: ${publicKey.toBase58()}\nTimestamp: ${timestamp}`
      const signature = await signMessage(new TextEncoder().encode(message))
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: publicKey.toBase58(),
          signature: base58.encode(signature),
          message: message
        })
      })

      const data = await res.json()
      
      if (res.ok) {
        // [CRITICAL STEP] Sync Database to Local Storage
        localStorage.setItem('noble_userId', data.userId)
        
        // Ensure we save the full list of wallets returned by the DB
        if (data.wallets && Array.isArray(data.wallets)) {
          localStorage.setItem('noble_wallets', JSON.stringify(data.wallets))
        } else {
          // Fallback if API doesn't return list (prevents crash)
          localStorage.setItem('noble_wallets', JSON.stringify([publicKey.toBase58()]))
        }
        
        localStorage.setItem('active_wallet', publicKey.toBase58())
        
        toast.success('Access Granted')
        router.push('/Portal')
      } else {
        toast.error(data.error || 'Database verification failed')
        disconnect() // Force disconnect on failure so they can try again
      }
    } catch (err) {
      console.error(err)
      toast.error('Login failed. Please sign the message.')
      disconnect()
    } finally {
      setIsSigning(false)
    }
  }, [connected, publicKey, signMessage, router, disconnect])

  useEffect(() => {
    if (connected) handleLogin()
  }, [connected, handleLogin])

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-900/40 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl text-center backdrop-blur-xl max-w-md w-full">
        {/* Responsive Hero Image Fix */}
<div className="relative w-32 h-32 md:w-48 md:h-48 mx-auto mb-8">
  <Image 
    src="/ntwrk-logo.png" 
    alt="Logo" 
    fill
    className="object-contain rounded-full shadow-lg shadow-blue-500/20"
    priority
  />
</div>
        <h1 className="text-4xl font-black text-white mb-6 tracking-tighter uppercase">NobleNetwrk</h1>
        
        {isSigning ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-blue-400 font-bold animate-pulse text-xs uppercase tracking-widest">Verifying Database Entry...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <WalletConnectDynamic />
            {connected && (
              <button onClick={() => disconnect()} className="block w-full text-[10px] text-gray-500 uppercase font-black hover:text-red-400 transition-colors mt-4">
                Disconnect Wallet
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  )
}