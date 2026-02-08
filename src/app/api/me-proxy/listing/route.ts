import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint');

  if (!mint) return NextResponse.json({ error: 'Mint required' }, { status: 400 });

  try {
    const response = await fetch(
      `https://api-mainnet.magiceden.dev/v2/tokens/${mint}/listings`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.ME_API}`,
          'Accept': 'application/json'
        },
        // Cache for 60 seconds to avoid hitting rate limits while keeping prices fresh
        next: { revalidate: 60 } 
      }
    );

    if (response.status === 429) {
      return NextResponse.json({ error: 'Rate Limited' }, { status: 429 });
    }

    if (!response.ok) {
      return NextResponse.json({ error: 'ME Error' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Proxy Error' }, { status: 500 });
  }
}