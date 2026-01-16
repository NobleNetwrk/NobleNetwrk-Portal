
import { ParsedAccountData } from '@solana/web3.js';

export interface TokenAccountData extends ParsedAccountData {
  parsed: {
    info: {
      tokenAmount: {
        uiAmount: number;
        amount: string;
        decimals: number;
      };
    };
    type: string;
  };
}

export type NotificationType = {
  message: string;
  type: 'success' | 'error' | 'info';
  id: number;
};

export interface WalletConnectionState {
  connected: boolean;
  publicKey: string | null;
  connecting: boolean;
  disconnecting: boolean;
}
