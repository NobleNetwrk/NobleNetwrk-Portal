import { Connection, Keypair, PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { 
  createTransferCheckedInstruction, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { 
  publicKey as umiPk, 
  createNoopSigner, 
  signerIdentity 
} from '@metaplex-foundation/umi';
import { transferV1, mplCore } from '@metaplex-foundation/mpl-core';
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters'; 
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';

const NTWRK_MINT = new PublicKey('NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS');
const VAULT_WALLET = new PublicKey('AEFmyqaDkKJpjy36mCZ2Zw4hKszdeCKt2s4bbHpTWkR4');
const K9_COLLECTION = new PublicKey('8k5dMh8QW3ayde4GAcq35JsB8s6PmoRkS9vpibHaonQk');
const DATA_FILE = path.join(process.cwd(), 'data', 'all_locked_k9s.json');

export async function POST(req: Request) {
  try {
    const { owner, mint, cost } = await req.json();
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    
    // 1. Setup Umi with the Vault as the Identity
    const umi = createUmi(rpcUrl).use(mplCore());
    const ownerPubkey = new PublicKey(owner);
    const mintPubkey = new PublicKey(mint);

    if (!process.env.K9IMPOUND_PRIVATE_KEY) throw new Error('Vault Private Key missing');
    const impoundKeypair = Keypair.fromSecretKey(bs58.decode(process.env.K9IMPOUND_PRIVATE_KEY));

    // Define the Vault as a NoopSigner for Umi's instruction builder
    // The vault is the current owner of the NFT and must authorize the transfer
    const vaultSigner = createNoopSigner(umiPk(VAULT_WALLET.toBase58()));
    umi.use(signerIdentity(vaultSigner));

    const tx = new Transaction();
    
    // Priority fees
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }));

    // 2. Transfer $NTWRK from User to Vault (The Rescue Payment)
    const userNtwrkAta = await getAssociatedTokenAddress(NTWRK_MINT, ownerPubkey);
    const impoundNtwrkAta = await getAssociatedTokenAddress(NTWRK_MINT, VAULT_WALLET);

    // Amount = cost * 10^9 (decimals)
    const paymentAmount = BigInt(Math.floor(cost * 1e9));

    tx.add(createTransferCheckedInstruction(
      userNtwrkAta,      // Source: User
      NTWRK_MINT, 
      impoundNtwrkAta,   // Destination: Vault
      ownerPubkey,       // Authority: User
      paymentAmount, 
      9
    ));

    // 3. Transfer Metaplex Core NFT from Vault to User
    const transferIx = transferV1(umi, {
      asset: umiPk(mintPubkey.toBase58()),
      newOwner: umiPk(ownerPubkey.toBase58()),
      collection: umiPk(K9_COLLECTION.toBase58()),
    }).getInstructions()[0];

    tx.add(toWeb3JsInstruction(transferIx));

    // Finalize Transaction
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = ownerPubkey;

    // IMPORTANT: Vault partial signs to authorize the NFT leaving the vault
    tx.partialSign(impoundKeypair);

    // 4. Update Database: Remove the K9 from the locked list
    if (fs.existsSync(DATA_FILE)) {
      const dbContent = fs.readFileSync(DATA_FILE, 'utf8');
      const dbData = JSON.parse(dbContent);
      
      dbData.lockedK9s = dbData.lockedK9s.filter((item: any) => item.mint !== mint);
      
      fs.writeFileSync(DATA_FILE, JSON.stringify(dbData, null, 2));
    }

    return Response.json({ 
      transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'),
      blockhash
    });
  } catch (error: any) {
    console.error("Rescue Route Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}