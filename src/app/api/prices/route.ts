import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = searchParams.get('ids');

  if (!ids) {
    return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
  }

  try {
    // Server-side fetch to Jupiter (No CORS issues here)
    const response = await fetch(`https://price.jup.ag/v6/price?ids=${ids}`);
    
    if (!response.ok) {
        return NextResponse.json({ data: {} }); // Return empty on upstream error
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Price Proxy Error:", error);
    return NextResponse.json({ data: {} });
  }
}