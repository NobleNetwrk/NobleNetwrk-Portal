import { NextResponse } from 'next/server';

// 1. FORCE DYNAMIC: Never cache the transaction payload!
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const meUrl = new URL('https://api-mainnet.magiceden.dev/v2/instructions/buy_now');
  searchParams.forEach((value, key) => {
    meUrl.searchParams.append(key, value);
  });

  console.log("Constructing Buy Tx for:", searchParams.get("tokenMint"));

  try {
    const response = await fetch(meUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${process.env.ME_API}`,
        'Accept': 'application/json'
      },
      // 2. DISABLE CACHE: Always get a fresh transaction with a fresh blockhash
      cache: 'no-store'
    });

    if (!response.ok) {
      // 1. CAPTURE THE REAL ERROR
      const errorText = await response.text();
      console.error("Magic Eden API Error:", errorText);
      
      // 2. SEND IT TO THE FRONTEND
      return NextResponse.json({ 
        error: `Magic Eden Error: ${errorText}` 
      }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Proxy Internal Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Proxy Error' }, { status: 500 });
  }
}