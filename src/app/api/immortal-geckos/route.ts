import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const EXTERNAL_API = "https://illogicalendeavors.com/gecko/immortals/tools/getImmortals.php";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const walletsParam = searchParams.get("wallets");
    
    // Clean inputs: Split comma-separated list into lowercase array
    const targets = (walletsParam || "").split(',')
        .filter(t => t.length > 10)
        .map(t => t.toLowerCase());

    if (targets.length === 0) return NextResponse.json({ data: [] });

    try {
        // 1. Fetch Master List (Cached for 60s)
        const response = await fetch(EXTERNAL_API, { next: { revalidate: 60 } });
        
        if (!response.ok) throw new Error("External API failed");
        
        const allGeckos = await response.json();

        // 2. Filter for ALL wallets at once
        const foundGeckos = Array.isArray(allGeckos) ? allGeckos.filter((gecko: any) => 
            // A. Check if it is actually Immortal (CRITICAL FIX)
            gecko.isImmortal === "1" &&
            // B. Check if it belongs to one of our wallets (using correct property name)
            (targets.includes(gecko.ownerWallet?.toLowerCase()))
        ) : [];

        return NextResponse.json({ 
            data: foundGeckos,
            count: foundGeckos.length 
        });

    } catch (error: any) {
        console.error("Gecko fetch error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}