import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cache, cacheKey } from '@/lib/cache'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // 1. Destructure isPublic
    const { owner, name, assets, isPublic } = body

    if (!owner || !assets) {
      return NextResponse.json({ error: 'Missing owner or assets' }, { status: 400 })
    }

    // 2. Save isPublic status to DB
    const gallery = await prisma.userGallery.upsert({
      where: { owner },
      update: { 
        name, 
        assets, 
        isPublic: isPublic ?? true, // Default to true if missing
        updatedAt: new Date() 
      },
      create: { 
        owner, 
        name, 
        assets, 
        isPublic: isPublic ?? true 
      },
    })

    const key = cacheKey('gallery', owner)
    cache.delete(key)

    return NextResponse.json({ success: true, gallery })
  } catch (error) {
    console.error('Gallery Save Error:', error)
    return NextResponse.json({ error: 'Failed to save gallery' }, { status: 500 })
  }
}