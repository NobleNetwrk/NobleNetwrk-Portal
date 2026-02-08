import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const items = await prisma.irlGalleryItem.findMany()
    return NextResponse.json({ success: true, items })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    // Added nftMint to destructuring
    const { position, name, image, price, isSold, link, description, nftMint } = body

    const item = await prisma.irlGalleryItem.upsert({
      where: { position },
      update: { name, image, price, isSold, link, description, nftMint },
      create: { position, name, image, price, isSold, link, description, nftMint }
    })

    return NextResponse.json({ success: true, item })
  } catch (error) {
    console.error("IRL Gallery Save Error:", error)
    return NextResponse.json({ error: 'Failed to save item' }, { status: 500 })
  }
}