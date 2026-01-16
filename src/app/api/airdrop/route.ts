import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  const global = req.nextUrl.searchParams.get('global');

  try {
    // 1. Handle Global Stats
    // Aggregates must run on AirdropProfile, not User
    if (global === 'true') {
      try {
        const stats = await prisma.airdropProfile.aggregate({
          _sum: { totalAllocation: true }
        });
        const total = stats._sum?.totalAllocation || 0;
        return NextResponse.json({ totalAllocated: total });
      } catch (dbError) {
        console.error("Global Stats Aggregation Error:", dbError);
        return NextResponse.json({ totalAllocated: 0 });
      }
    }

    // 2. Handle User Specific Data
    if (!address) return NextResponse.json({ error: "Address required" }, { status: 400 });

    const walletRecord = await prisma.wallet.findUnique({
      where: { address },
      include: { 
        user: { 
          include: { 
            wallets: true,
            // Include the relation to get allocation data
            airdropProfile: true 
          } 
        } 
      }
    });

    if (!walletRecord) return NextResponse.json({ error: "User not found" }, { status: 404 });

    // Safely access data from the related profile, defaulting to 0/null if it doesn't exist yet
    return NextResponse.json({
      totalAllocation: walletRecord.user.airdropProfile?.totalAllocation || 0,
      lastCheckIn: walletRecord.user.airdropProfile?.lastCheckIn || null,
      linkedWallets: walletRecord.user.wallets.map(w => w.address)
    });

  } catch (err) {
    console.error("Airdrop GET Error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { address } = body;
    
    // Schema uses Float, so we parse as float.
    const rawAllocation = parseFloat(body.allocation);
    // Ensure we have a valid number
    const allocation = isNaN(rawAllocation) ? 0 : rawAllocation;

    if (!address || allocation <= 0) {
      return NextResponse.json({ error: "Invalid allocation amount" }, { status: 400 });
    }

    const walletRecord = await prisma.wallet.findUnique({
      where: { address },
      select: { userId: true }
    });

    if (!walletRecord) {
      return NextResponse.json({ error: "Wallet not linked to user" }, { status: 404 });
    }

    // Atomic Update using upsert to handle cases where AirdropProfile doesn't exist yet
    const updatedProfile = await prisma.airdropProfile.upsert({
      where: { userId: walletRecord.userId },
      create: {
        userId: walletRecord.userId,
        totalAllocation: allocation,
        lastCheckIn: new Date(),
        weeklyClaimed: allocation // Initialize weekly tracking if needed
      },
      update: {
        totalAllocation: { increment: allocation },
        lastCheckIn: new Date(),
        // Optional: Update weekly claimed if you track that cumulatively
        weeklyClaimed: { increment: allocation } 
      }
    });

    // Re-fetch global stats from AirdropProfile
    const globalStats = await prisma.airdropProfile.aggregate({ 
      _sum: { totalAllocation: true } 
    });

    return NextResponse.json({ 
      success: true, 
      totalAllocation: updatedProfile.totalAllocation,
      globalProgress: globalStats._sum.totalAllocation || 0
    });

  } catch (err) {
    console.error("Airdrop POST Error:", err);
    return NextResponse.json({ error: "Transaction failed" }, { status: 500 });
  }
}