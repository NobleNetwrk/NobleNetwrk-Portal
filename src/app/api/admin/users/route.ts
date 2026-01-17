import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Fetch Users including their related profiles and wallets
    const users = await prisma.user.findMany({
      include: {
        wallets: true,        // Get the list of wallets
        airdropProfile: true  // Get the allocation data
      },
      // Sort by allocation (descending) inside the relation
      orderBy: {
        airdropProfile: {
          totalAllocation: 'desc'
        }
      },
      take: 100
    })
    
    // 2. Format the data for the Frontend
    const formattedUsers = users.map(user => {
      // Find the primary wallet or just take the first one found
      const mainWallet = user.wallets.find(w => w.isPrimary)?.address || user.wallets[0]?.address || 'No Wallet Linked';

      return {
        wallet: mainWallet,
        // Safely access airdropProfile (it might be null if new user)
        totalAllocation: user.airdropProfile?.totalAllocation || 0,
        lastCheckIn: user.airdropProfile?.lastCheckIn || null
      };
    });
    
    return NextResponse.json({ users: formattedUsers })
  } catch (e) {
    console.error("User fetch error:", e)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}