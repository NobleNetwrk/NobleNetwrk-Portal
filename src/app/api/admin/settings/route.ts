import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import nacl from 'tweetnacl'
import { PublicKey } from '@solana/web3.js'

const prisma = new PrismaClient()

// 1. GET: Publicly readable (Safe)
export async function GET() {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'k9_impound_rate' }
    })
    return NextResponse.json({ value: setting ? Number(setting.value) : 100000 })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// 2. POST: SECURED (Admin Only)
export async function POST(req: Request) {
  try {
    const { value, wallet, signature, message } = await req.json()

    // --- SECURITY CHECK 1: Is this wallet an Admin? ---
    const allowedAdmins = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(',')
    if (!allowedAdmins.includes(wallet)) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 })
    }

    // --- SECURITY CHECK 2: Verify Cryptographic Signature ---
    // We verify that the 'message' was actually signed by the private key of 'wallet'
    try {
      const messageBytes = new TextEncoder().encode(message)
      const signatureBytes = new Uint8Array(Buffer.from(signature, 'base64'))
      const publicKeyBytes = new PublicKey(wallet).toBytes()

      const verified = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKeyBytes
      )

      if (!verified) throw new Error('Invalid Signature')
    } catch (err) {
      return NextResponse.json({ error: 'Invalid Signature' }, { status: 403 })
    }

    // --- Safe to Update ---
    const updated = await prisma.systemSettings.upsert({
      where: { key: 'k9_impound_rate' },
      update: { 
        value: value.toString(),
        updatedBy: wallet 
      },
      create: { 
        key: 'k9_impound_rate', 
        value: value.toString(),
        description: 'Amount of NTWRK paid per K9 impounded',
        updatedBy: wallet
      }
    })

    return NextResponse.json({ success: true, value: updated.value })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}