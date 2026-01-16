// app/api/holdings/route.ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { NextResponse } from "next/server";

// 1. Setup Server-Side Connection (Uses the private RPC_URL from .env)
const RPC_URL = process.env.RPC_URL; 
const connection = new Connection(RPC_URL || "https://api.mainnet-beta.solana.com");

// 2. Define Constants
// REPLACE THIS with the actual Mint Address for your NTWRK token
const NTWRK_MINT_ADDRESS = "NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS"; 

export async function GET(request: Request) {
  // Get wallet address from the query string ?address=...
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get("address");

  if (!walletAddress) {
    return NextResponse.json({ error: "Wallet address required" }, { status: 400 });
  }

  try {
    const pubKey = new PublicKey(walletAddress);

    // 3. Run all fetches in parallel for speed
    const [solBalance, tokenAccounts, dasAssets] = await Promise.all([
        // A. Fetch SOL
        connection.getBalance(pubKey),

        // B. Fetch NTWRK Token Account
        connection.getParsedTokenAccountsByOwner(pubKey, {
            mint: new PublicKey(NTWRK_MINT_ADDRESS)
        }),

        // C. Fetch NFTs (Using Helius DAS API via raw fetch for efficiency)
        fetch(RPC_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'my-id',
                method: 'getAssetsByOwner',
                params: {
                    ownerAddress: walletAddress,
                    page: 1,
                    limit: 1000,
                    displayOptions: {
                        showGrandTotal: true,
                    }
                },
            }),
        }).then(res => res.json())
    ]);

    // 4. Process Data
    
    // Process SOL
    const sol = solBalance / LAMPORTS_PER_SOL;

    // Process NTWRK
    // Note: User might have multiple accounts for same token (rare but possible), we sum them.
    const ntwrkBalance = tokenAccounts.value.reduce((acc, account) => {
        return acc + (account.account.data.parsed.info.tokenAmount.uiAmount || 0);
    }, 0);

    // Process NFTs
    // Helius DAS response structure handling
    const nfts = dasAssets.result?.items || [];
    
    return NextResponse.json({
        wallet: walletAddress,
        balances: {
            sol: sol,
            ntwrk: ntwrkBalance,
            nftCount: nfts.length
        },
        nfts: nfts // Sending full NFT list if you need to display them
    });

  } catch (error: any) {
    console.error("Holdings fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}