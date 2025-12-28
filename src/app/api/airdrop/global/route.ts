import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_PATH = path.join(process.cwd(), 'data', 'airdrop.json')

// Initialize data structure
const defaultData = {
  totalAllocated: 0,
  users: {}
}

// Ensure data file exists
if (!fs.existsSync(DATA_PATH)) {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true })
  fs.writeFileSync(DATA_PATH, JSON.stringify(defaultData), 'utf-8')
}

export async function GET() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'))
    return NextResponse.json({ totalAllocated: data.totalAllocated })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load global data' },
      { status: 500 }
    )
  }
}