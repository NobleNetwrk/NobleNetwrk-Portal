import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(req: Request) {
    try {
        const { userId, avatarId } = await req.json();

        if (!userId || !avatarId) {
            return NextResponse.json({ error: "Missing data" }, { status: 400 });
        }

        // Update the user's equipped avatar
        await prisma.user.update({
            where: { id: userId },
            data: { equippedAvatar: avatarId }
        });

        return NextResponse.json({ success: true });
    } catch (e) {
        console.error("Equip Error:", e);
        return NextResponse.json({ error: "Failed to equip" }, { status: 500 });
    }
}