// src/services/hotWalletService.ts
import { Keypair, Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getOrCreateAssociatedTokenAccount, createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';
import { prisma } from '../lib/prisma';

// Hot Wallet Configuration
const HOT_WALLET_PRIVATE_KEY = process.env.HOT_WALLET_PRIVATE_KEY || '';
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';

// NTWRK token mint address
export const NTWRK_MINT_ADDRESS = new PublicKey('NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS');

export class HotWalletService {
  private hotWallet: Keypair;
  private connection: Connection;

  constructor() {
    if (!HOT_WALLET_PRIVATE_KEY) {
      throw new Error('HOT_WALLET_PRIVATE_KEY is not configured');
    }
    
    const secretKey = bs58.decode(HOT_WALLET_PRIVATE_KEY);
    this.hotWallet = Keypair.fromSecretKey(secretKey);
    this.connection = new Connection(RPC_URL, 'confirmed');
  }

  getHotWalletPublicKey(): PublicKey {
    return this.hotWallet.publicKey;
  }

  async getNTWRKBalance(): Promise<number> {
    try {
      const tokenAccount = await getAssociatedTokenAddress(NTWRK_MINT_ADDRESS, this.hotWallet.publicKey);
      const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount);
      return accountInfo.value.uiAmount || 0;
    } catch (error) {
      console.error('Error getting NTWRK balance:', error);
      return 0;
    }
  }

  /**
   * Transfers NTWRK tokens and records the transaction in the database
   */
  async transferNTWRKToUser(userPublicKey: PublicKey, amount: number, lockId?: string): Promise<string> {
    try {
      const decimals = 9;
      const amountInLamports = BigInt(Math.floor(amount * Math.pow(10, decimals)));
      
      const hotWalletTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection, this.hotWallet, NTWRK_MINT_ADDRESS, this.hotWallet.publicKey
      );

      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection, this.hotWallet, NTWRK_MINT_ADDRESS, userPublicKey
      );

      const transaction = new Transaction().add(
        createTransferInstruction(
          hotWalletTokenAccount.address,
          userTokenAccount.address,
          this.hotWallet.publicKey,
          amountInLamports
        )
      );

      const signature = await sendAndConfirmTransaction(this.connection, transaction, [this.hotWallet]);

      // NEW: Update database if this transfer was linked to a specific Lock
      if (lockId) {
        await prisma.lockedK9.update({
          where: { id: lockId },
          data: { 
            unlocked: true,
            unlockDate: new Date(),
            unlockSignature: signature 
          }
        });
      }

      return signature;
    } catch (error) {
      console.error('Error transferring NTWRK:', error);
      throw error;
    }
  }

  async sendNFTToUser(nftMint: PublicKey, userPublicKey: PublicKey, lockId?: string): Promise<string> {
    try {
      const hotWalletATA = await getAssociatedTokenAddress(nftMint, this.hotWallet.publicKey);
      const userATA = await getOrCreateAssociatedTokenAccount(
        this.connection, this.hotWallet, nftMint, userPublicKey
      );

      const transaction = new Transaction().add(
        createTransferInstruction(
          hotWalletATA,
          userATA.address,
          this.hotWallet.publicKey,
          BigInt(1) 
        )
      );

      const signature = await sendAndConfirmTransaction(this.connection, transaction, [this.hotWallet]);

      // NEW: Ensure database is in sync with the NFT movement
      if (lockId) {
        await prisma.lockedK9.update({
          where: { id: lockId },
          data: { 
            unlocked: true,
            unlockDate: new Date(),
            unlockSignature: signature 
          }
        });
      }

      return signature;
    } catch (error) {
      console.error('Error transferring NFT to user:', error);
      throw error;
    }
  }

  async checkNFTOwnership(nftMint: PublicKey): Promise<boolean> {
    try {
      const tokenAccount = await getAssociatedTokenAddress(nftMint, this.hotWallet.publicKey);
      const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount);
      return accountInfo.value.uiAmount === 1;
    } catch (error) {
      return false;
    }
  }
}

export const hotWalletService = new HotWalletService();