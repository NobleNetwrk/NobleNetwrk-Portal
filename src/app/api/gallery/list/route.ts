import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const galleries = await prisma.userGallery.findMany({
      where: { isPublic: true },
      take: 50,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        owner: true,
        name: true,
        assets: true, // Needed to count items
      },
    })

    // Format the data for the frontend
    const formatted = galleries.map((g) => ({
      id: g.id,
      owner: g.owner,
      name: g.name,
      assetCount: Array.isArray(g.assets) ? (g.assets as any[]).length : 0,
    }))

    return NextResponse.json({ galleries: formatted })
  } catch (error) {
    console.error('Gallery List Error:', error)
    return NextResponse.json({ error: 'Failed to fetch galleries' }, { status: 500 })
  }
}