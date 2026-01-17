// src/app/api/holdings/route.ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic'; // Disable static caching for this route

const RPC_URL = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || process.env.RPC_URL;
const connection = new Connection(RPC_URL || "https://api.mainnet-beta.solana.com");
const NTWRK_MINT_ADDRESS = "NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS";

async function fetchWalletData(address: string) {
  try {
    const pubKey = new PublicKey(address);

    // Run parallel fetches
    const [solBalance, tokenAccounts, dasAssets] = await Promise.all([
      connection.getBalance(pubKey).catch(() => 0),
      connection.getParsedTokenAccountsByOwner(pubKey, {
        mint: new PublicKey(NTWRK_MINT_ADDRESS)
      }).catch(() => ({ value: [] })),
      // Helius DAS Call (Much faster than parsing token accounts one by one)
      fetch(RPC_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'noble-portal',
          method: 'getAssetsByOwner',
          params: {
            ownerAddress: address,
            page: 1,
            limit: 1000,
            displayOptions: { showGrandTotal: true }
          },
        }),
      }).then(res => res.json()).catch(() => ({ result: { items: [] } }))
    ]);

    // Process Basic Balances
    const sol = solBalance / LAMPORTS_PER_SOL;
    const ntwrkBalance = tokenAccounts.value?.reduce((acc: number, account: any) => {
      return acc + (account.account.data.parsed.info.tokenAmount.uiAmount || 0);
    }, 0) || 0;
    
    // Return RAW NFTs so frontend can filter them using Hashlists
    const nfts = dasAssets.result?.items || [];

    return {
      wallet: address,
      balances: { sol, ntwrk: ntwrkBalance, nftCount: nfts.length },
      nfts: nfts // Frontend will sort these into "Genetics", "Extracts", etc.
    };
  } catch (error) {
    console.error(`Error fetching ${address}:`, error);
    return { wallet: address, error: "Failed to fetch" };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const walletsParam = searchParams.get("wallets");
  const addressParam = searchParams.get("address");

  // Combine params into a unique list
  let targets: string[] = [];
  if (walletsParam) targets = walletsParam.split(',');
  if (addressParam) targets.push(addressParam);
  targets = [...new Set(targets)].filter(t => t.length > 10);

  if (targets.length === 0) return NextResponse.json({ error: "No wallet provided" }, { status: 400 });

  // BATCH FETCH: Server handles the heavy lifting
  const results = await Promise.all(targets.map(addr => fetchWalletData(addr)));
  return NextResponse.json({ data: results });
}