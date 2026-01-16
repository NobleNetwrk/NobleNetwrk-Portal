import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mint = searchParams.get('mint');

  if (!mint) return NextResponse.json({ error: 'Mint required' }, { status: 400 });

  try {
    const response = await fetch(
      `https://api-mainnet.magiceden.dev/v2/tokens/${mint}/activities`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.ME_API}`,
          'Accept': 'application/json'
        },
        // Adding a cache tag so we don't spam ME for the same panda twice
        next: { revalidate: 3600 } 
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
    return NextResponse.json({ error: 'Bridge Crash' }, { status: 500 });
  }
}