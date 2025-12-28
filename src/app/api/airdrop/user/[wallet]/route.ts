import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_PATH = path.join(process.cwd(), 'data', 'airdrop.json')

export async function GET(req: NextRequest, { params }: { params: { wallet: string } }) {
  const wallet = params.wallet

  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
    const userData = data.users[wallet] || {
      totalAllocation: 0,
      lastCheckIn: null
    }
    
    return NextResponse.json(userData)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load user data' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest, { params }: { params: { wallet: string } }) {
  const wallet = params.wallet
  const { allocation, lastCheckIn } = await req.json()

  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
    
    // Initialize user if doesn't exist
    if (!data.users[wallet]) {
      data.users[wallet] = {
        totalAllocation: 0,
        lastCheckIn: null
      }
    }
    
    // Update user data
    data.users[wallet].totalAllocation += allocation
    data.users[wallet].lastCheckIn = lastCheckIn
    
    // Update global data
    data.totalAllocated += allocation
    
    // Save to file
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8')
    
    return NextResponse.json({
      totalAllocation: data.users[wallet].totalAllocation,
      globalProgress: data.totalAllocated
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update user data' },
      { status: 500 }
    )
  }
}