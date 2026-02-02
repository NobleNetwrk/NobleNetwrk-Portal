// src/components/SolanaProvider.tsx
'use client';

import { ReactNode, useMemo, useEffect } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';

// --- MOBILE WALLET ADAPTER IMPORTS ---
import {
    createDefaultAuthorizationCache,
    createDefaultChainSelector,
    createDefaultWalletNotFoundHandler,
    registerMwa,
} from '@solana-mobile/wallet-standard-mobile';

export function SolanaProvider({ children }: { children: ReactNode }) {
  // FIX: Check .env first. If missing, Fallback to public (slow) RPC.
  const endpoint = useMemo(() => 
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'), 
  []);

  // Note: Modern wallet adapters auto-detect, so empty array is usually fine
  const wallets = useMemo(() => [], []);

  // --- REGISTER MOBILE WALLET ADAPTER ---
  useEffect(() => {
      // Initialize the Mobile Wallet Adapter (MWA)
      // This allows mobile browsers (like on Saga) and Android apps to connect
      registerMwa({
          appIdentity: {
              name: 'NobleNetwrk Portal',
              uri: typeof window !== 'undefined' ? window.location.origin : 'https://noblenetwrk.com',
              icon: '/ntwrk-logo.png', // Ensure this path matches your logo in the public folder
          },
          authorizationCache: createDefaultAuthorizationCache(),
          chains: ['solana:mainnet', 'solana:devnet'],
          chainSelector: createDefaultChainSelector(),
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
      });
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}