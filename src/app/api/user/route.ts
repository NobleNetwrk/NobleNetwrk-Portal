import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';

const DATA_PATH = path.join(process.cwd(), 'data', 'users.json');

async function readDB() {
  try {
    const data = await fs.readFile(DATA_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return { users: [] };
  }
}

async function writeDB(data: any) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

export async function POST(req: Request) {
  try {
    const { publicKey, signature, message, action, linkedWallet } = await req.json();

    // 1. Cryptographic Verification
    const signatureUint8 = new Uint8Array(signature);
    const messageUint8 = new TextEncoder().encode(message);
    const pubKeyUint8 = new PublicKey(publicKey).toBytes();
    
    const verified = nacl.sign.detached.verify(messageUint8, signatureUint8, pubKeyUint8);
    if (!verified) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = await readDB();
    let userIndex = db.users.findIndex((u: any) => u.id === publicKey);
    
    // Create user if they don't exist
    if (userIndex === -1) {
      db.users.push({ id: publicKey, role: 'member', linkedWallets: [publicKey] });
      userIndex = db.users.length - 1;
    }

    const user = db.users[userIndex];

    // 2. Action Handling
    switch (action) {
      case 'GET_USER':
        return NextResponse.json(user);

      case 'LINK_WALLET':
        if (linkedWallet && !user.linkedWallets.includes(linkedWallet)) {
          user.linkedWallets.push(linkedWallet);
          await writeDB(db);
        }
        return NextResponse.json(user);

      case 'REMOVE_WALLET':
        if (linkedWallet && linkedWallet !== publicKey) {
          user.linkedWallets = user.linkedWallets.filter((w: string) => w !== linkedWallet);
          await writeDB(db);
        }
        return NextResponse.json(user);

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Registry Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}