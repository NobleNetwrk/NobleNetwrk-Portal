import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import { decode } from 'bs58'

// Get admins from env
const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(',')

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { adminWallet, message, signature, targetWallet, approved } = body

    // 1. Verify Admin
    if (!ADMIN_WALLETS.includes(adminWallet)) {
      return NextResponse.json({ error: 'Unauthorized Admin' }, { status: 401 })
    }

    // 2. Verify Signature (Security Check)
    const verified = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      decode(signature),
      new PublicKey(adminWallet).toBytes()
    )

    if (!verified) {
      return NextResponse.json({ error: 'Invalid Signature' }, { status: 403 })
    }

    // 3. Find User ID linked to the wallet
    const walletRecord = await prisma.wallet.findUnique({
      where: { address: targetWallet },
      include: { user: true }
    })

    if (!walletRecord) {
        return NextResponse.json({ error: 'User wallet not found in registry' }, { status: 404 })
    }

    // 4. Update the "isApproved" status
    const updatedUser = await prisma.user.update({
      where: { id: walletRecord.userId },
      data: { isApproved: approved }
    })

    return NextResponse.json({ success: true, user: updatedUser })

  } catch (error) {
    console.error('Approval Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}