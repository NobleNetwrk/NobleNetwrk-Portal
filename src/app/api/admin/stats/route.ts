import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [userCount, allocationStats] = await Promise.all([
      prisma.user.count(),
      prisma.airdropProfile.aggregate({
        _sum: { totalAllocation: true }
      })
    ])

    return NextResponse.json({
      totalUsers: userCount,
      totalAllocated: allocationStats._sum.totalAllocation || 0
    })
  } catch (e) {
    console.error("Stats Error:", e)
    return NextResponse.json({ totalUsers: 0, totalAllocated: 0 })
  }
}