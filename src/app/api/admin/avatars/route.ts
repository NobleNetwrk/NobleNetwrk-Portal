import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// GET: Fetch all pending requests from DB
export async function GET() {
    try {
        const requests = await prisma.avatarRequest.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ requests });
    } catch (e) {
        return NextResponse.json({ requests: [] });
    }
}

// POST: Grant an Avatar (Updates User AND Request status)
export async function POST(req: Request) {
    try {
        const { wallet, requestId, avatarId } = await req.json();

        // 1. Find User
        const walletRecord = await prisma.wallet.findUnique({
            where: { address: wallet },
            include: { user: true }
        });

        if (!walletRecord || !walletRecord.user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        // 2. Transaction: Unlock Avatar + Mark Request as Granted
        await prisma.$transaction([
            // Add Avatar if missing
            prisma.user.update({
                where: { id: walletRecord.user.id },
                data: {
                    unlockedAvatars: { push: avatarId } // (Note: In production, check for dupes first or use a set)
                }
            }),
            // Update Request Status
            prisma.avatarRequest.update({
                where: { id: requestId },
                data: { status: 'GRANTED' }
            })
        ]);

        return NextResponse.json({ success: true });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: "Failed to grant" }, { status: 500 });
    }
}