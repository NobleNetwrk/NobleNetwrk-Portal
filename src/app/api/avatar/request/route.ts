import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(req: Request) {
    try {
        const { wallet, nftId, nftName, nftImage } = await req.json();

        // 1. Find the User ID from the Wallet
        const walletRecord = await prisma.wallet.findUnique({
            where: { address: wallet },
            include: { user: true }
        });

        if (!walletRecord || !walletRecord.user) {
            return NextResponse.json({ error: "User profile not found. Please refresh." }, { status: 404 });
        }

        // 2. Create the Request in the DB
        await prisma.avatarRequest.create({
            data: {
                userId: walletRecord.user.id,
                wallet: wallet,
                nftId,
                nftName,
                nftImage,
                status: 'PENDING'
            }
        });

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error("Request Error:", e);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}