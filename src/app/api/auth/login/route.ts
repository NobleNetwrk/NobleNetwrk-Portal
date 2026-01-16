// src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import nacl from 'tweetnacl'
import base from 'base-x'

// Direct base58 initialization to fix the "basex is not a function" crash
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const bs58 = (typeof base === 'function' ? base : (base as any).default)(ALPHABET)

export async function POST(req: Request) {
  try {
    const { address, signature, message, linkToUserId } = await req.json()

    // 1. Cryptographically verify the Solana signature
    const isValid = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(address)
    )

    if (!isValid) return NextResponse.json({ error: 'Invalid signature proof' }, { status: 401 })

    let user;
    if (linkToUserId) {
      // MULTI-WALLET LINKING: Attach new wallet to existing User ID 
      user = await prisma.user.update({
        where: { id: linkToUserId },
        data: {
          wallets: {
            connectOrCreate: {
              where: { address },
              create: { address }
            }
          }
        },
        include: { wallets: true }
      });
    } else {
      // LOGIN/SIGNUP: Find user by wallet address 
      const walletRecord = await prisma.wallet.findUnique({
        where: { address },
        include: { user: { include: { wallets: true } } }
      });

      if (walletRecord) {
        user = walletRecord.user;
      } else {
        // Auto-create new User and Wallet if first-time visitor 
        user = await prisma.user.create({
          data: {
            wallets: { create: { address, isPrimary: true } }
          },
          include: { wallets: true }
        });
      }
    }

    // Return the User ID and ALL linked wallet addresses for asset aggregation
    return NextResponse.json({
      userId: user.id,
      wallets: user.wallets.map((w: any) => w.address)
    })

  } catch (error) {
    console.error('Auth Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}