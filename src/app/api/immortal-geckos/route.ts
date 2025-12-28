// Force dynamic rendering to prevent Next.js from trying to build this statically
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

const IMMORTAL_GECKOS_API = 'https://www.illogicalendeavors.com/gecko/immortals/tools/getImmortals.php';

export async function GET(request: NextRequest) {
  try {
    // Extract the wallet address from the query parameters
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
    }

    // Fetch the data from the external Immortal Geckos API
    const response = await fetch(`${IMMORTAL_GECKOS_API}?wallet=${wallet}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache settings can be adjusted here if needed
      next: { revalidate: 60 } 
    });

    if (!response.ok) {
      throw new Error(`External API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // The API returns an array of geckos; we filter for Immortals based on the 'isImmortal' flag
    const immortalCount = Array.isArray(data) 
      ? data.filter((g: any) => g.isImmortal === "1").length 
      : 0;

    return NextResponse.json({ 
      count: immortalCount,
      assets: data 
    });

  } catch (error: any) {
    console.error('Error fetching immortal geckos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Immortal Gecko data', details: error.message }, 
      { status: 500 }
    );
  }
}