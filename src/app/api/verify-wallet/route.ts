// app/api/verify-wallet/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import base58 from 'bs58';
import { verify } from '@noble/ed25519';

// This API route handles the secure server-side wallet signature verification.
// By moving this logic to the server, we prevent client-side tampering.

export async function POST(req: NextRequest) {
  try {
    // 1. Validate the request body.
    const { publicKey, signature, message } = await req.json();

    if (!publicKey || !signature || !message) {
      return NextResponse.json({ success: false, error: 'Missing required parameters: publicKey, signature, or message.' }, { status: 400 });
    }

    // 2. Decode the signature and message from base58.
    const messageUint8 = new TextEncoder().encode(message);
    const signatureUint8 = base58.decode(signature);
    const publicKeyUint8 = base58.decode(publicKey);

    // 3. Perform the cryptographic verification.
    const isValid = await verify(signatureUint8, messageUint8, publicKeyUint8);

    if (isValid) {
      return NextResponse.json({ success: true, message: 'Signature is valid.' });
    } else {
      return NextResponse.json({ success: false, message: 'Invalid signature.' }, { status: 401 });
    }
  } catch (error) {
    console.error('Wallet verification failed:', error);
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 });
  }
}