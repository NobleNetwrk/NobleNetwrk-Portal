// src/hooks/useWalletVerification.tsx
import { useCallback, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { toast } from 'react-toastify'
import base58 from 'bs58'

const VERIFY_WALLET_API = '/api/verify-wallet'

export function useWalletVerification() {
  const { publicKey, connected, signMessage, disconnect } = useWallet()
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)

  const verifyWallet = useCallback(async () => {
    if (!publicKey || !signMessage) {
      toast.error('Wallet not connected or does not support signing.')
      return false
    }

    setIsVerifying(true)
    try {
      const message = 'Sign this message to authenticate with NobleNetwrk Vault.'
      const encodedMessage = new TextEncoder().encode(message)
      const signature = await signMessage(encodedMessage)

      const response = await fetch(VERIFY_WALLET_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicKey: publicKey.toBase58(),
          message: message,
          signature: base58.encode(signature),
        }),
      })

      if (!response.ok) {
        throw new Error('Verification failed on the server.')
      }

      toast.success('Wallet verified!')
      setIsVerified(true)
      // The server should set an HTTP-only cookie here.
      // This client-side code no longer needs localStorage.
      return true
    } catch (err) {
      console.error('Signing or verification failed:', err)
      toast.error('Wallet verification failed.')
      disconnect()
      return false
    } finally {
      setIsVerifying(false)
    }
  }, [publicKey, signMessage, disconnect])

  return { isVerified, isVerifying, verifyWallet, setIsVerified }
}