import { Connection, Keypair, PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { 
  createTransferCheckedInstruction, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction 
} from '@solana/spl-token';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { publicKey as umiPk, createNoopSigner, signerIdentity } from '@metaplex-foundation/umi';
import { transferV1, mplCore } from '@metaplex-foundation/mpl-core';
import { toWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters'; 
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';
import { NTWRK_PER_K9 } from '@/config/k9-constants';

const NTWRK_MINT = new PublicKey('NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS');
const VAULT_WALLET = new PublicKey('AEFmyqaDkKJpjy36mCZ2Zw4hKszdeCKt2s4bbHpTWkR4');
const K9_COLLECTION = new PublicKey('8k5dMh8QW3ayde4GAcq35JsB8s6PmoRkS9vpibHaonQk');
const DATA_FILE = path.join(process.cwd(), 'data', 'all_locked_k9s.json');

// 1. GENERATE TRANSACTION
export async function POST(req: Request) {
  try {
    const { owner, nfts } = await req.json();
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    
    const umi = createUmi(rpcUrl).use(mplCore());
    const ownerPubkey = new PublicKey(owner);
    const userSigner = createNoopSigner(umiPk(ownerPubkey.toBase58()));
    umi.use(signerIdentity(userSigner));

    if (!process.env.K9IMPOUND_PRIVATE_KEY) throw new Error('Vault Private Key missing');
    const impoundKeypair = Keypair.fromSecretKey(bs58.decode(process.env.K9IMPOUND_PRIVATE_KEY));

    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 800000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100000 }));

    for (const nft of nfts) {
      const transferIx = transferV1(umi, {
        asset: umiPk(nft.mint),
        newOwner: umiPk(VAULT_WALLET.toBase58()),
        collection: umiPk(K9_COLLECTION.toBase58()),
      }).getInstructions()[0];
      tx.add(toWeb3JsInstruction(transferIx));
    }

    const userNtwrkAta = await getAssociatedTokenAddress(NTWRK_MINT, ownerPubkey);
    const impoundNtwrkAta = await getAssociatedTokenAddress(NTWRK_MINT, impoundKeypair.publicKey);

    const userNtwrkInfo = await connection.getAccountInfo(userNtwrkAta);
    if (!userNtwrkInfo) {
      tx.add(createAssociatedTokenAccountInstruction(ownerPubkey, userNtwrkAta, ownerPubkey, NTWRK_MINT));
    }

    const totalPayout = BigInt(nfts.length) * BigInt(NTWRK_PER_K9) * BigInt(1e9); 
    
    tx.add(createTransferCheckedInstruction(
      impoundNtwrkAta, NTWRK_MINT, userNtwrkAta, impoundKeypair.publicKey, totalPayout, 9
    ));

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = ownerPubkey;
    tx.partialSign(impoundKeypair);

    return Response.json({ 
      transaction: tx.serialize({ requireAllSignatures: false }).toString('base64'),
      blockhash
    });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// 2. VERIFY TRANSACTION AND SAVE TO JSON
export async function PUT(req: Request) {
    try {
        const { signature, owner, nfts } = await req.json();
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');

        // Verify transaction success on-chain
        const status = await connection.getSignatureStatus(signature);
        if (!status || status.value?.err) {
            throw new Error("Transaction failed or not found on-chain.");
        }

        // Database updates - ONLY happens if verification passes
        const dbDir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        
        const dbContent = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf8') : '{"lockedK9s":[]}';
        const dbData = JSON.parse(dbContent);
        
        nfts.forEach((nft: any) => {
          if (!dbData.lockedK9s.find((item: any) => item.mint === nft.mint)) {
            dbData.lockedK9s.push({ 
              mint: nft.mint, 
              name: nft.name,
              image: nft.image,
              owner: owner, 
              lockDate: new Date().toISOString() 
            });
          }
        });

        fs.writeFileSync(DATA_FILE, JSON.stringify(dbData, null, 2));
        return Response.json({ success: true });

    } catch (error: any) {
        return Response.json({ error: error.message }, { status: 500 });
    }
}