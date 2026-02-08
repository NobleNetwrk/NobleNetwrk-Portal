import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; 

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

  try {
    let profile = await prisma.gameProfile.findUnique({ where: { userId } });
    
    // If user has a profile but no game profile yet, create one
    if (!profile) {
       const user = await prisma.user.findUnique({ where: { id: userId }});
       if(user) {
         profile = await prisma.gameProfile.create({
           data: { userId }
         });
       }
    }

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("Game Progress Fetch Error:", error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, xp, level, collectedItems } = body;

    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const profile = await prisma.gameProfile.upsert({
      where: { userId },
      update: {
        xp,
        level,
        collectedItems,
        lastSavedAt: new Date()
      },
      create: {
        userId,
        xp,
        level,
        collectedItems
      }
    });

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    console.error("Game Progress Save Error:", error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}