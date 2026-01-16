import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import base58 from 'bs58';
import nacl from 'tweetnacl';

export async function POST(req: NextRequest) {
  try {
    const { userId, walletAddress, signature, message } = await req.json();

    // 1. Verify ownership of the NEW wallet
    const isValid = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      base58.decode(signature),
      base58.decode(walletAddress)
    );

    if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

    // 2. Link to existing user
    await prisma.wallet.create({
      data: { address: walletAddress, userId: userId }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Wallet already linked elsewhere' }, { status: 400 });
  }
}