import { Keypair, Connection, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { getOrCreateAssociatedTokenAccount, createTransferInstruction, getAssociatedTokenAddress } from '@solana/spl-token'
import bs58 from 'bs58'

// Hot Wallet Configuration
const HOT_WALLET_PRIVATE_KEY = process.env.HOT_WALLET_PRIVATE_KEY || ''
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com'

// NTWRK token mint address
export const NTWRK_MINT_ADDRESS = new PublicKey('NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS')

export class HotWalletService {
  private hotWallet: Keypair
  private connection: Connection

  constructor() {
    if (!HOT_WALLET_PRIVATE_KEY) {
      throw new Error('HOT_WALLET_PRIVATE_KEY is not configured')
    }
    
    const secretKey = bs58.decode(HOT_WALLET_PRIVATE_KEY)
    this.hotWallet = Keypair.fromSecretKey(secretKey)
    this.connection = new Connection(RPC_URL, 'confirmed')
  }

  getHotWalletPublicKey(): PublicKey {
    return this.hotWallet.publicKey
  }

  async getNTWRKBalance(): Promise<number> {
    try {
      const tokenAccount = await getAssociatedTokenAddress(NTWRK_MINT_ADDRESS, this.hotWallet.publicKey)
      const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount)
      return accountInfo.value.uiAmount || 0
    } catch (error) {
      console.error('Error getting NTWRK balance:', error)
      return 0
    }
  }

  async transferNTWRKToUser(userPublicKey: PublicKey, amount: number): Promise<string> {
    try {
      // FIX: Use BigInt for 9 decimals to avoid floating point precision errors
      const decimals = 9;
      const amountInLamports = BigInt(Math.floor(amount * Math.pow(10, decimals)));
      
      const hotWalletTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection, this.hotWallet, NTWRK_MINT_ADDRESS, this.hotWallet.publicKey
      )

      const userTokenAccount = await getOrCreateAssociatedTokenAccount(
        this.connection, this.hotWallet, NTWRK_MINT_ADDRESS, userPublicKey
      )

      const transaction = new Transaction().add(
        createTransferInstruction(
          hotWalletTokenAccount.address,
          userTokenAccount.address,
          this.hotWallet.publicKey,
          amountInLamports
        )
      )

      return await sendAndConfirmTransaction(this.connection, transaction, [this.hotWallet])
    } catch (error) {
      console.error('Error transferring NTWRK:', error)
      throw error
    }
  }

  async sendNFTToUser(nftMint: PublicKey, userPublicKey: PublicKey): Promise<string> {
    try {
      const hotWalletATA = await getAssociatedTokenAddress(nftMint, this.hotWallet.publicKey)
      
      // Hot wallet pays rent for user ATA if missing
      const userATA = await getOrCreateAssociatedTokenAccount(
        this.connection, this.hotWallet, nftMint, userPublicKey
      )

      const transaction = new Transaction().add(
        createTransferInstruction(
          hotWalletATA,
          userATA.address,
          this.hotWallet.publicKey,
          BigInt(1) 
        )
      )

      return await sendAndConfirmTransaction(this.connection, transaction, [this.hotWallet])
    } catch (error) {
      console.error('Error transferring NFT to user:', error)
      throw error
    }
  }

  async checkNFTOwnership(nftMint: PublicKey): Promise<boolean> {
    try {
      const tokenAccount = await getAssociatedTokenAddress(nftMint, this.hotWallet.publicKey)
      const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount)
      return accountInfo.value.uiAmount === 1
    } catch (error) {
      return false
    }
  }
}

export const hotWalletService = new HotWalletService()