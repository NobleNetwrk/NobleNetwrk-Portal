import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Construct the Magic Eden URL with all incoming query parameters
  const meUrl = new URL('https://api-mainnet.magiceden.dev/v2/instructions/buy_now');
  searchParams.forEach((value, key) => {
    meUrl.searchParams.append(key, value);
  });

  try {
    const response = await fetch(meUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${process.env.ME_API}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ME Buy Error:", errorText);
      return NextResponse.json({ error: errorText || 'Failed to fetch buy instructions' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Buy Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}