import { Connection, Keypair, PublicKey, Transaction, ComputeBudgetProgram } from '@solana/web3.js';
import { 
  createTransferCheckedInstruction, 
  getAssociatedTokenAddress, 
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID
} from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import bs58 from 'bs58';
// Patch for "TypeError: fetch failed" bug in Node.js v18+
import { setGlobalDispatcher, Agent } from 'undici';

setGlobalDispatcher(new Agent({ connectTimeout: 60_000, connections: 100 }));

const NTWRK_MINT = new PublicKey('NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS');
const DATA_FILE = path.join(process.cwd(), 'data', 'all_locked_k9s.json');

// Helper to detect if a mint uses Token-2022 or Legacy
async function getMintProgramId(connection: Connection, mint: PublicKey) {
  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error(`Mint ${mint.toBase58()} not found`);
  return info.owner;
}

export async function POST(req: Request) {
  try {
    const { owner, mints } = await req.json();
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    
    if (!process.env.K9IMPOUND_PRIVATE_KEY) throw new Error('Vault Private Key missing');
    const impoundKeypair = Keypair.fromSecretKey(bs58.decode(process.env.K9IMPOUND_PRIVATE_KEY));
    const ownerPubkey = new PublicKey(owner);

    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1000000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 60000 }));

    // Use current confirmed blockhash for the entire lifecycle
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = ownerPubkey;

    // 1. Process K9 NFT Transfers with Dynamic Program ID
    for (const mint of mints) {
      const mintPubkey = new PublicKey(mint);
      const programId = await getMintProgramId(connection, mintPubkey);

      const toAta = await getAssociatedTokenAddress(mintPubkey, impoundKeypair.publicKey, false, programId);
      const fromAta = await getAssociatedTokenAddress(mintPubkey, ownerPubkey, false, programId);
      
      const toAtaInfo = await connection.getAccountInfo(toAta);
      if (!toAtaInfo) {
        tx.add(createAssociatedTokenAccountInstruction(ownerPubkey, toAta, impoundKeypair.publicKey, mintPubkey, programId));
      }
      tx.add(createTransferCheckedInstruction(fromAta, mintPubkey, toAta, ownerPubkey, 1, 0, [], programId));
    }

    // 2. Process $NTWRK Payout (Dynamic Program Detection)
    const ntwrkProgramId = await getMintProgramId(connection, NTWRK_MINT);
    const userNtwrkAta = await getAssociatedTokenAddress(NTWRK_MINT, ownerPubkey, false, ntwrkProgramId);
    const impoundNtwrkAta = await getAssociatedTokenAddress(NTWRK_MINT, impoundKeypair.publicKey, false, ntwrkProgramId);

    const userNtwrkInfo = await connection.getAccountInfo(userNtwrkAta);
    if (!userNtwrkInfo) {
      tx.add(createAssociatedTokenAccountInstruction(ownerPubkey, userNtwrkAta, ownerPubkey, NTWRK_MINT, ntwrkProgramId));
    }

    const totalPayout = BigInt(mints.length) * BigInt(1000) * BigInt(1e9); 
    tx.add(createTransferCheckedInstruction(impoundNtwrkAta, NTWRK_MINT, userNtwrkAta, impoundKeypair.publicKey, totalPayout, 9, [], ntwrkProgramId));

    // 3. Update Database
    const dbDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    const dbContent = fs.existsSync(DATA_FILE) ? fs.readFileSync(DATA_FILE, 'utf8') : '{"lockedK9s":[]}';
    const data = JSON.parse(dbContent);
    mints.forEach((m: string) => {
      data.lockedK9s.push({ mint: m, owner: owner, lockDate: new Date().toISOString(), borrowed: 1000 });
    });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

    tx.partialSign(impoundKeypair);

    return Response.json({ 
      transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64'),
      blockhash,
      lastValidBlockHeight
    });
  } catch (error: any) {
    console.error("Lock Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}