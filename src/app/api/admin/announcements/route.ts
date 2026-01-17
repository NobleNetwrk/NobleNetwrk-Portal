import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import nacl from 'tweetnacl'
import { decode } from 'bs58'

const prisma = new PrismaClient()

// Secure Admin Check
const ADMIN_WALLETS = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '').split(',')

async function verifyAdmin(body: any) {
  const { adminWallet, message, signature } = body
  
  // 1. Check Allowlist
  if (!ADMIN_WALLETS.includes(adminWallet)) return false

  // 2. Cryptographic Verification
  try {
    const messageBytes = new TextEncoder().encode(message)
    const signatureBytes = decode(signature)
    const publicKeyBytes = decode(adminWallet)
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
  } catch (e) {
    console.error("Sig verification failed", e)
    return false
  }
}

// GET: Publicly accessible (for Portal to display)
export async function GET() {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { date: 'desc' }
    })
    return NextResponse.json({ data: announcements })
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}

// POST: Create New (Admin Only)
export async function POST(req: Request) {
  const body = await req.json()
  if (!await verifyAdmin(body)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const newAnn = await prisma.announcement.create({
      data: {
        title: body.title,
        content: body.content,
        isActive: true
      }
    })
    return NextResponse.json({ newAnnouncement: newAnn })
  } catch (e) {
    return NextResponse.json({ error: "Creation failed" }, { status: 500 })
  }
}

// PUT: Update Existing (Admin Only)
export async function PUT(req: Request) {
  const body = await req.json()
  if (!await verifyAdmin(body)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const updated = await prisma.announcement.update({
      where: { id: body.id },
      data: {
        title: body.title,
        content: body.content,
        isActive: body.isActive ?? true
      }
    })
    return NextResponse.json({ data: updated })
  } catch (e) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}

// DELETE: Remove (Admin Only)
export async function DELETE(req: Request) {
  const body = await req.json()
  if (!await verifyAdmin(body)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    await prisma.announcement.delete({ where: { id: body.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}