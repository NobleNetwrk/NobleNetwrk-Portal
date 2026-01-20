import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; 
import { Connection, PublicKey } from '@solana/web3.js';

// --- IMPORT HASHLISTS ---
import genetics from '@/data/noble_genetics_hashlist.json';
import extracts from '@/data/noble_extracts_hashlist.json';
import namaste from '@/data/namaste_hashlist.json';
import d3fenders from '@/data/d3fenders_hashlist.json';
import sac from '@/data/sac_hashlist.json';
import solanak9s from '@/data/solanak9s_hashlist.json';
import sensei from '@/data/sensei_hashlist.json';
import tso from '@/data/tso_hashlist.json';
import ttc from '@/data/TimeTravelingChimps_hashlist.json';
import p1 from '@/data/Player1_hashlist.json';
import gg from '@/data/GalacticGecko_hashlist.json';

const HASHLISTS: Record<string, string[]> = {
  genetics: genetics as string[],
  extracts: extracts as string[],
  namaste: namaste as string[],
  solanaK9s: solanak9s as string[],
  sensei: sensei as string[],
  tso: tso as string[],
  d3fenders: d3fenders as string[],
  stonedApeCrew: sac as string[],
  timeTravelingChimps: ttc as string[],
  player1: p1 as string[],
  immortalGeckos: gg as string[], 
};

// Known Marketplace Addresses (Escrow & Delegates) - RESTORED
const MARKETPLACE_WALLETS = new Set([
  '1BWutmTvYPwDtmw9abTkS4Ssr8no61spGAvW1X6NDix', // ME V2
  'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K', // ME Authority
  'GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMhtTv8pb7R4', // ME V1
  'TSWAPaqyCSx2KABk68Shruf448k1tkct9rGKdG2G8',   // Tensor
  'CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvY7tGFhb', // Solanart
  '4pRNK5o5aMa38VawM3bUe3jY7tQx4sZ2YL1h2k1w1j6e', // OpenSea
  'A7p8451ktDduPoRDjP5yD87Vd1Hw34v8XN9rC5vC8y8',  // Solanart V2
]);

// Use server-side RPC env var
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(RPC_URL);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { communities, includePortalUsers } = body;
    
    // Map: Wallet Address -> Weight/Count
    const recipientMap = new Map<string, number>();
    const logs: string[] = [];

    // --- 1. FETCH PORTAL USERS (Weighted by HODL Score) ---
    if (includePortalUsers) {
      logs.push("Fetching Registered Users (Primary Wallet & HODL Score)...");
      try {
        const users = await prisma.user.findMany({
          where: { wallets: { some: {} } },
          select: {
            id: true,
            hodlScore: true,
            wallets: { select: { address: true, isPrimary: true } }
          }
        });

        let userCount = 0;
        users.forEach(user => {
          if (!user.wallets || user.wallets.length === 0) return;
          const primaryWallet = user.wallets.find(w => w.isPrimary) || user.wallets[0];

          if (primaryWallet && primaryWallet.address) {
            const address = primaryWallet.address;
            const weight = user.hodlScore || 0;

            if (weight > 0) {
                const currentWeight = recipientMap.get(address) || 0;
                recipientMap.set(address, currentWeight + weight);
                userCount++;
            }
          }
        });
        logs.push(`✅ Added ${userCount} Users based on HODL Score.`);
      } catch (error: any) {
        console.error("DB Fetch Error:", error);
        logs.push(`❌ Error fetching users: ${error.message}`);
      }
    }

    // --- 2. FETCH NFT HOLDERS (RPC SNAPSHOT) ---
    if (communities && Array.isArray(communities)) {
        for (const communityId of communities) {
            if (communityId === 'portal_users') continue; 

            const hashlist = HASHLISTS[communityId];
            if (!hashlist) {
                logs.push(`⚠️ No hashlist found for ID: ${communityId}`);
                continue;
            }

            logs.push(`📸 Snapshotting ${communityId} holders...`);
            
            // Using getAssetBatch (DAS API) is much faster and cleaner than standard RPC loops
            // if your RPC supports it. Assuming standard RPC here for compatibility based on previous files.
            // If you have a DAS RPC (Helius/Triton), replace this loop with the batch call from your snippet.
            
            // Standard RPC Fallback (slower but reliable on public nodes)
            // or DAS Batch if available:
            
            const BATCH_SIZE = 50; 
            for (let i = 0; i < hashlist.length; i += BATCH_SIZE) {
                const batch = hashlist.slice(i, i + BATCH_SIZE);
                
                await Promise.all(batch.map(async (mint) => {
                    try {
                        const largestAccounts = await connection.getTokenLargestAccounts(new PublicKey(mint));
                        if (!largestAccounts.value || largestAccounts.value.length === 0) return;

                        const holderATA = largestAccounts.value[0].address;
                        const accountInfo = await connection.getParsedAccountInfo(holderATA);
                        
                        if (accountInfo.value && 'parsed' in accountInfo.value.data) {
                            const ownerWallet = accountInfo.value.data.parsed.info.owner;
                            
                            // --- MARKETPLACE FILTER RESTORED ---
                            if (MARKETPLACE_WALLETS.has(ownerWallet)) {
                                // Skip listed items
                                return;
                            }

                            if (ownerWallet) {
                                const current = recipientMap.get(ownerWallet) || 0;
                                recipientMap.set(ownerWallet, current + 1);
                            }
                        }
                    } catch (e) { /* ignore */ }
                }));
            }
            logs.push(`✅ Snapshot complete for ${communityId}`);
        }
    }

    // --- 3. FORMAT RESPONSE ---
    const recipients = Array.from(recipientMap.entries()).map(([address, count]) => ({
        address,
        count 
    }));

    const totalWeight = recipients.reduce((acc, curr) => acc + curr.count, 0);

    return NextResponse.json({
        recipients,
        totalWeight, // Renamed from totalNFTs to be accurate
        logs
    });

  } catch (error: any) {
    console.error("Snapshot API Error:", error);
    return NextResponse.json({ error: error.message || "Unknown error generating snapshot" }, { status: 500 });
  }
}