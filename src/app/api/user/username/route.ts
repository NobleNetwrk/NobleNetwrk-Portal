import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export async function POST(req: Request) {
    try {
        const { userId, username } = await req.json();

        // Basic Validation
        if (!userId || !username || username.length < 3) {
            return NextResponse.json({ error: "Invalid username (min 3 chars)" }, { status: 400 });
        }

        // Update User
        await prisma.user.update({
            where: { id: userId },
            data: { username }
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        // Handle duplicate username error (Prisma error code P2002)
        if (e.code === 'P2002') {
            return NextResponse.json({ error: "Username already taken" }, { status: 409 });
        }
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}