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

  // Clear data on mount/disconnect
  useEffect(() => {
    if (!connected) {
      localStorage.removeItem('noble_userId');
      localStorage.removeItem('noble_wallets');
      localStorage.removeItem('active_wallet');
    }
  }, [connected]);

  const handleLogin = useCallback(async () => {
    if (!connected || !publicKey) {
        toast.error("Wallet not connected");
        return;
    }
    // Check if wallet supports signing (Some ledgers/adapters might not)
    if (!signMessage) {
        toast.error("Wallet does not support message signing");
        return;
    }

    const cachedWallet = localStorage.getItem('active_wallet');
    const cachedUserId = localStorage.getItem('noble_userId');
    
    // Strict check to ensure we don't skip login if the wallet changed
    if (cachedWallet === publicKey.toBase58() && cachedUserId) {
      router.push('/Portal'); 
      return;
    }

    setIsSigning(true)
    try {
      const timestamp = new Date().getTime()
      const message = `NobleNetwrk Portal Login\nWallet: ${publicKey.toBase58()}\nTimestamp: ${timestamp}`
      
      // Request Signature
      const signature = await signMessage(new TextEncoder().encode(message))
      
      const res = await fetch('/api/auth/wallet', {
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
        localStorage.setItem('noble_userId', data.userId)
        
        // --- FIX: LOOK FOR walletsDetailed FIRST ---
        // The API now returns 'walletsDetailed' (objects with isPrimary).
        // If we don't catch this, it falls back to a single wallet array.
        const walletList = data.walletsDetailed || data.wallets || [{ address: publicKey.toBase58(), isPrimary: true }];
        
        localStorage.setItem('noble_wallets', JSON.stringify(walletList))
        localStorage.setItem('active_wallet', publicKey.toBase58())
        
        toast.success('Access Granted')
        router.push('/Portal')
      } else {
        toast.error(data.error || 'Database verification failed')
        disconnect() 
      }
    } catch (err) {
      console.error(err)
      toast.error('Login failed. Please try again.')
    } finally {
      setIsSigning(false)
    }
  }, [connected, publicKey, signMessage, router, disconnect])

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-gray-900/40 p-10 rounded-[2.5rem] border border-white/5 shadow-2xl text-center backdrop-blur-xl max-w-md w-full">
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
            <p className="text-blue-400 font-bold animate-pulse text-xs uppercase tracking-widest">Requesting Signature...</p>
            <p className="text-gray-500 text-[10px]">Check your wallet app</p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* 1. If NOT connected, show Connect Button */}
            {!connected && <WalletConnectDynamic />}

            {/* 2. If connected, show VERIFY Button (Manual Trigger) */}
            {connected && (
              <div className="flex flex-col gap-3 animate-fade-in">
                  <div className="bg-green-900/20 border border-green-500/30 p-3 rounded-xl">
                      <p className="text-green-400 text-xs font-bold uppercase mb-1">Wallet Connected</p>
                      <p className="text-gray-400 text-[10px] font-mono truncate">{publicKey?.toBase58()}</p>
                  </div>

                  <button 
                      onClick={handleLogin}
                      className="w-full bg-[#c5a059] hover:bg-[#d6b16a] text-black font-black uppercase py-4 rounded-xl shadow-lg shadow-yellow-500/10 transition-all active:scale-95"
                  >
                      Verify Ownership
                  </button>
                  
                  <button 
                      onClick={() => disconnect()} 
                      className="text-[10px] text-gray-500 uppercase font-bold hover:text-red-400 transition-colors"
                  >
                      Change Wallet
                  </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}