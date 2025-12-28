'use client'

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { NotificationType } from '@/types'
import { toast } from 'react-toastify'

const WalletConnect = () => {
  const { disconnect } = useWallet()

  const handleError = useCallback((error: Error): NotificationType => {
    console.error('Wallet error:', error)
    
    let userMessage: string
    switch (error.name) {
      case 'WalletNotReadyError':
        userMessage = 'Wallet extension not detected'
        break
      case 'WalletConnectionError':
        userMessage = 'Connection rejected'
        break
      default:
        userMessage = 'Wallet operation failed'
    }

    return {
      message: userMessage,
      type: 'error',
      id: Date.now()
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect()
      toast.success('Wallet disconnected', {
        autoClose: 2000,
        hideProgressBar: true
      })
    } catch (error) {
      const notification = handleError(error as Error)
      toast(notification.message, {
        type: notification.type,
        position: 'bottom-right'
      })
    }
  }, [disconnect, handleError])

  return (
    <div className="wallet-adapter-button-wrapper">
      <WalletMultiButton
        className="wallet-adapter-button-trigger"
        style={{
          backgroundColor: '#512da8',
          color: 'white',
          fontSize: '14px',
          height: '40px'
        }}
      />
      {/*
        Optional: Add a disconnect button if needed
        <button onClick={handleDisconnect} className="disconnect-button">
          Disconnect
        </button>
      */}
    </div>
  )
}

export default WalletConnect