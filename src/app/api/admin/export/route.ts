import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { decode } from 'bs58'
import nacl from 'tweetnacl'

const prisma = new PrismaClient()

// Secure Admin Check (Same as your other routes)
const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(',')

async function verifyAdmin(body: any) {
  const { adminWallet, message, signature } = body
  if (!ADMIN_WALLETS.includes(adminWallet)) return false
  try {
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = decode(signature)
    const publicKeyBytes = decode(adminWallet)
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
  } catch (e) {
    return false
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    if (!await verifyAdmin(body)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Fetch ALL users with an airdrop profile > 0
    const users = await prisma.user.findMany({
      where: {
        airdropProfile: {
          totalAllocation: { gt: 0 }
        }
      },
      include: {
        wallets: true,
        airdropProfile: true
      }
    })

    // Format for Export: Find Primary Wallet -> Total Allocation
    const exportData = users.map(user => {
      // Logic: Use 'isPrimary' wallet, OR fallback to the first linked wallet
      const targetWallet = user.wallets.find(w => w.isPrimary)?.address || user.wallets[0]?.address || 'NO_WALLET_LINKED'
      
      return {
        wallet: targetWallet,
        allocation: user.airdropProfile?.totalAllocation || 0
      }
    }).filter(entry => entry.wallet !== 'NO_WALLET_LINKED') // Filter out users with no wallets

    return NextResponse.json({ 
      timestamp: new Date().toISOString(),
      count: exportData.length,
      data: exportData 
    })

  } catch (error) {
    console.error("Export Error:", error)
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}