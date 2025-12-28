// src/app/page.tsx
'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { toast } from 'react-toastify'

const WalletConnectDynamic = dynamic(
  () => import('@/components/WalletConnect'),
  { ssr: false }
)

export default function Home() {
  const { publicKey, connected, signMessage } = useWallet()
  const router = useRouter()
  const [isSigning, setIsSigning] = useState(false)

  const verifyWalletAndRedirect = useCallback(async () => {
    if (!connected || !publicKey || !signMessage) return

    const storedWallet = localStorage.getItem('verifiedWallet')

    if (storedWallet === publicKey.toBase58()) {
      router.push('/Portal')
      return
    }

    setIsSigning(true)
    try {
      const message = `Sign this message to authenticate with NobleNetwrk Portal.\n\nTimestamp: ${new Date().getTime()}`
      const encodedMessage = new TextEncoder().encode(message)
      await signMessage(encodedMessage)
      
      toast.success('Wallet verified!')
      localStorage.setItem('verifiedWallet', publicKey.toBase58())
      router.push('/Portal')
    } catch (err) {
      console.error('Signing failed:', err)
      toast.error('Verification failed. Please approve the signature.')
    } finally {
      setIsSigning(false)
    }
  }, [connected, publicKey, router, signMessage])

  useEffect(() => {
    verifyWalletAndRedirect()
  }, [verifyWalletAndRedirect])

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-md bg-gray-900/40 backdrop-blur-xl p-10 rounded-[2.5rem] border border-white/5 shadow-2xl text-center">
        {/* Background glow effect */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full -z-10" />
        
        <div className="mb-8">
          <Image
            src="/ntwrk-logo.png"
            alt="NobleNetwrk Logo"
            width={140}
            height={140}
            className="mx-auto rounded-full border-4 border-gray-950 shadow-2xl"
            priority
          />
        </div>
        
        <h1 className="text-4xl font-black text-white mb-4 tracking-tight">NobleNetwrk Portal</h1>
        
        {isSigning ? (
          <div className="py-8 space-y-6">
            <div className="flex justify-center">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-400">Authenticating...</p>
              <p className="text-gray-500 text-sm mt-1">Please approve the request in your wallet.</p>
            </div>
          </div>
        ) : (
          <>
            <p className="text-gray-400 mb-10 leading-relaxed">
              Connect your Solana wallet to manage your K9 assets and access the NobleNetwrk ecosystem.
            </p>
            <div className="flex justify-center scale-110">
              <WalletConnectDynamic />
            </div>
            <p className="mt-8 text-[10px] text-gray-600 uppercase font-black tracking-widest">
              Secure Message-Based Verification
            </p>
          </>
        )}
      </div>
    </main>
  )
}