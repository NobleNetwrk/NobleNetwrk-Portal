import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import nacl from 'tweetnacl'
import base from 'base-x'

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = (typeof base === 'function' ? base : (base as any).default)(ALPHABET)

// POST: Login or Link New Wallet
export async function POST(req: Request) {
  try {
    const { address, signature, message, linkToUserId } = await req.json()

    // 1. Verify Signature
    const isValid = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(address)
    )
    if (!isValid) return NextResponse.json({ error: 'Invalid signature proof' }, { status: 401 })

    let user;
    if (linkToUserId) {
      // LINKING: Connect to existing user
      user = await prisma.user.update({
        where: { id: linkToUserId },
        data: {
          wallets: {
            connectOrCreate: { where: { address }, create: { address } }
          }
        },
        include: { wallets: true }
      });
    } else {
      // LOGIN: Find or create user
      const walletRecord = await prisma.wallet.findUnique({
        where: { address },
        include: { user: { include: { wallets: true } } }
      });

      user = walletRecord ? walletRecord.user : await prisma.user.create({
        data: { wallets: { create: { address, isPrimary: true } } },
        include: { wallets: true }
      });
    }

    return NextResponse.json({ userId: user.id, walletsDetailed: user.wallets })
  } catch (error) {
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 })
  }
}

// PATCH: Set Primary Wallet (Replaces your set-primary route)
export async function PATCH(req: Request) {
  try {
    const { userId, address } = await req.json()

    if (!userId || !address) return NextResponse.json({ error: "Missing data" }, { status: 400 })

    // Transaction: Reset all to false, set target to true
    await prisma.$transaction([
      prisma.wallet.updateMany({
        where: { userId },
        data: { isPrimary: false }
      }),
      prisma.wallet.update({
        where: { address },
        data: { isPrimary: true }
      })
    ])

    // Fetch updated list
    const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { wallets: true }
    })

    return NextResponse.json({ 
        success: true, 
        walletsDetailed: updatedUser?.wallets || [] 
    })

  } catch (error) {
    console.error("Set Primary Error:", error)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}

// DELETE: Unlink Wallet
export async function DELETE(req: Request) {
  try {
    const { userId, address } = await req.json()

    // 1. Check if the wallet exists and belongs to this user
    const wallet = await prisma.wallet.findUnique({
      where: { address }
    })

    if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

    // 2. Security Check: Make sure they aren't deleting someone else's wallet
    // (We cast to any because your strict schema implies userId exists on wallet)
    if ((wallet as any).userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // 3. Prevent deleting the Primary wallet
    if (wallet.isPrimary) {
      return NextResponse.json({ error: 'Cannot unlink your Primary wallet. Set a different Primary first.' }, { status: 400 })
    }

    // 4. THE FIX: Delete the WALLET only. 
    // This removes it from the User's list. It does NOT delete the User.
    await prisma.wallet.delete({
      where: { address }
    })

    // 5. Return the updated list of remaining wallets
    const updatedUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallets: true }
    })

    return NextResponse.json({ 
      success: true, 
      walletsDetailed: updatedUser?.wallets || [] 
    })

  } catch (error) {
    console.error("UNLINK ERROR:", error)
    return NextResponse.json({ error: 'Unlink failed' }, { status: 500 })
  }
}