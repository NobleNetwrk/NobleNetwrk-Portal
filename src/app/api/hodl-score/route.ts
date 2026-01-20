import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; 

// --- IMPORT HASHLISTS ---
import d3fenders from '@/data/d3fenders_hashlist.json';
import namaste from '@/data/namaste_hashlist.json';
import extracts from '@/data/noble_extracts_hashlist.json';
import genetics from '@/data/noble_genetics_hashlist.json';
import sac from '@/data/sac_hashlist.json';
import sensei from '@/data/sensei_hashlist.json';
import solanak9s from '@/data/solanak9s_hashlist.json';
import tso from '@/data/tso_hashlist.json';
import ttc from '@/data/TimeTravelingChimps_hashlist.json';
import p1 from '@/data/Player1_hashlist.json';
import gg from '@/data/GalacticGecko_hashlist.json';

// --- CONFIGURATION ---
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
  galacticGeckos: gg as string[],
};

// Flatten for O(1) lookup
const ALL_VERIFIED_MINTS = new Set<string>();
Object.values(HASHLISTS).forEach(list => list.forEach(mint => ALL_VERIFIED_MINTS.add(mint)));

// Known Marketplace Addresses (Escrow & Delegates)
const MARKETPLACE_WALLETS = new Set([
  '1BWutmTvYPwDtmw9abTkS4Ssr8no61spGAvW1X6NDix', 
  'M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K', 
  'GUfCR9mK6azb9vcpsxgXyj7XRPAKJd4KMhtTv8pb7R4', 
  'TSWAPaqyCSx2KABk68Shruf448k1tkct9rGKdG2G8',   
  'CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvY7tGFhb', 
  '4pRNK5o5aMa38VawM3bUe3jY7tQx4sZ2YL1h2k1w1j6e', 
  'A7p8451ktDduPoRDjP5yD87Vd1Hw34v8XN9rC5vC8y8',  
]);

const RPC_URL = process.env.RPC_URL;

// --- GET: FETCH SAVED SCORE ---
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { hodlScore: true, hodlLastUpdated: true }
    });

    if (!user) {
      return NextResponse.json({ totalScore: 0 });
    }

    return NextResponse.json({
      totalScore: user.hodlScore,
      lastUpdated: user.hodlLastUpdated
    });

  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch score' }, { status: 500 });
  }
}

// --- POST: REFRESH (CALCULATE & SAVE) ---
export async function POST(req: Request) {
  try {
    if (!RPC_URL) return NextResponse.json({ error: 'RPC URL missing' }, { status: 500 });

    const { wallets, userId } = await req.json();

    if (!wallets?.length) return NextResponse.json({ error: 'No wallets provided' }, { status: 400 });
    if (!userId) return NextResponse.json({ error: 'No User ID provided' }, { status: 400 });

    // 1. Fetch All Assets
    const allAssets = await fetchAllAssets(wallets);

    // 2. Filter: Verified Only & Not In Escrow
    const verifiedHoldings = allAssets.filter(asset => {
        if (!ALL_VERIFIED_MINTS.has(asset.id)) return false;
        if (asset.ownership.owner && MARKETPLACE_WALLETS.has(asset.ownership.owner)) return false;
        if (asset.ownership.delegated && asset.ownership.delegate && MARKETPLACE_WALLETS.has(asset.ownership.delegate)) return false;
        return true;
    });

    // 3. Calculate Days Held (Using Magic Eden API)
    const BATCH_SIZE = 5;
    const results = [];
    
    for (let i = 0; i < verifiedHoldings.length; i += BATCH_SIZE) {
        const batch = verifiedHoldings.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(batch.map(async (asset) => {
            const daysHeld = await getDaysHeldFromME(asset.id);
            if (daysHeld < 0) return null; // Listed

            return {
                mint: asset.id,
                name: asset.content?.metadata?.name || 'Unknown',
                image: asset.content?.links?.image || '',
                owner: asset.ownership.owner,
                daysHeld
            };
        }));
        results.push(...batchResults.filter(r => r !== null));
        if (i + BATCH_SIZE < verifiedHoldings.length) await new Promise(r => setTimeout(r, 200)); 
    }

    // 4. Aggregate
    const totalDays = results.reduce((acc, curr) => acc + (curr?.daysHeld || 0), 0);
    const totalScore = totalDays; 
    results.sort((a, b) => (b?.daysHeld || 0) - (a?.daysHeld || 0));

    // 5. UPDATE USER DB (Score Only)
    await prisma.user.update({
      where: { id: userId },
      data: {
        hodlScore: totalScore,
        hodlLastUpdated: new Date()
      }
    });

    // Return score AND details (frontend handles caching details)
    return NextResponse.json({
        totalScore,
        details: results, 
        lastUpdated: new Date()
    });

  } catch (error: any) {
    console.error("HODL Calc Error:", error);
    return NextResponse.json({ error: 'Calculation failed', details: error.message }, { status: 500 });
  }
}

// --- HELPERS ---
async function fetchAllAssets(wallets: string[]) {
    const assets: any[] = [];
    for (const wallet of wallets) {
        let page = 1;
        while (true) {
            try {
                // @ts-ignore
                const response = await fetch(RPC_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 'get-assets',
                        method: 'getAssetsByOwner',
                        params: {
                            ownerAddress: wallet,
                            page,
                            limit: 1000,
                            displayOptions: { showFungible: false, showNativeBalance: false }
                        },
                    }),
                });
                const { result } = await response.json();
                if (!result || !result.items || result.items.length === 0) break;
                assets.push(...result.items);
                if (result.items.length < 1000) break;
                page++;
            } catch (e) {
                console.error("Asset fetch error", e);
                break;
            }
        }
    }
    return assets;
}

async function getDaysHeldFromME(mint: string): Promise<number> {
    try {
        const response = await fetch(`https://api-mainnet.magiceden.dev/v2/tokens/${mint}/activities?offset=0&limit=50`);
        if (!response.ok) return 0;
        const activities = await response.json();
        
        if (!Array.isArray(activities) || activities.length === 0) return 0;

        const latestEvent = activities[0];
        if (latestEvent.type === 'list') return -1; // Exclude listed

        const acquisitionEvent = activities.find((a: any) => a.type === 'buyNow' || a.type === 'acceptOffer');
        let referenceTime = Math.floor(Date.now() / 1000);
        
        if (acquisitionEvent) referenceTime = acquisitionEvent.blockTime;
        else if (activities.length > 0) referenceTime = activities[activities.length - 1].blockTime;

        return Math.floor((Math.floor(Date.now() / 1000) - referenceTime) / 86400);
    } catch (e) { return 0; }
}