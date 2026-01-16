// src/app/api/immortal-geckos/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const IMMORTAL_GECKOS_API = 'https://www.illogicalendeavors.com/gecko/immortals/tools/getImmortals.php';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    const response = await fetch(IMMORTAL_GECKOS_API, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 60 } 
    });

    if (!response.ok) {
      throw new Error(`External API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // FIXED: Now filters for BOTH immortality AND matching owner wallet
    const userImmortals = Array.isArray(data) 
      ? data.filter((g: any) => g.isImmortal === "1" && g.ownerWallet === wallet)
      : [];

    return NextResponse.json({ 
      count: userImmortals.length,
      assets: userImmortals 
    });

  } catch (error: any) {
    console.error('Error fetching immortal geckos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Immortal Gecko data', details: error.message }, 
      { status: 500 }
    );
  }
}