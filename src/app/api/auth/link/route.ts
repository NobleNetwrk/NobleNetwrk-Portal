// src/app/api/auth/link/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import nacl from 'tweetnacl';
import base58 from 'bs58';

export async function POST(req: Request) {
  try {
    const { userId, newAddress, signature, message } = await req.json();

    // Verify signature of the new wallet
    const isValid = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      base58.decode(signature),
      base58.decode(newAddress)
    );

    if (!isValid) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });

    // Link new wallet to the existing User
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        wallets: {
          connectOrCreate: {
            where: { address: newAddress },
            create: { address: newAddress }
          }
        }
      },
      include: { wallets: true }
    });

    return NextResponse.json({ 
      wallets: updatedUser.wallets.map(w => w.address) 
    });

  } catch (error) {
    return NextResponse.json({ error: 'Linking failed' }, { status: 500 });
  }
}