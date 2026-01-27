import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
        return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    try {
        const walletRecord = await prisma.wallet.findUnique({
            where: { address: walletAddress },
            include: { user: true }
        });

        if (walletRecord && walletRecord.user) {
            return NextResponse.json({
                id: walletRecord.user.id,
                user: {
                    id: walletRecord.user.id,
                    createdAt: walletRecord.user.createdAt,
                    equippedAvatar: walletRecord.user.equippedAvatar,
                    username: walletRecord.user.username || null // <--- ADD THIS
                },
                unlocked: walletRecord.user.unlockedAvatars 
            });
        }

        return NextResponse.json({ 
            error: 'User not found',
            unlocked: ['human', 'alien'] 
        }, { status: 404 });

    } catch (e) {
        console.error("Profile API Error:", e);
        return NextResponse.json({ error: 'Server error', unlocked: ['human', 'alien'] }, { status: 500 });
    }
}