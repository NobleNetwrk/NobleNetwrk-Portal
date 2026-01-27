import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cache, cacheKey } from '@/lib/cache'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const owner = searchParams.get('owner')

  if (!owner) {
    return NextResponse.json({ error: 'Owner required' }, { status: 400 })
  }

  try {
    // 1. CHECK CACHE
    const key = cacheKey('gallery', owner)
    if (cache.has(key)) {
      console.log(`⚡ CACHE HIT: Gallery for ${owner.slice(0, 4)}`)
      return NextResponse.json({ success: true, gallery: cache.get(key) })
    }

    // 2. FETCH FROM DB (If not in cache)
    console.log(`🐢 DB FETCH: Gallery for ${owner.slice(0, 4)}`)
    const gallery = await prisma.userGallery.findUnique({
      where: { owner },
    })

    if (!gallery) {
      return NextResponse.json({ error: 'Gallery not found' }, { status: 404 })
    }

    // 3. SET CACHE
    cache.set(key, gallery)

    return NextResponse.json({ success: true, gallery })
  } catch (error) {
    console.error('Gallery Fetch Error:', error)
    return NextResponse.json({ error: 'Failed to fetch gallery' }, { status: 500 })
  }
}