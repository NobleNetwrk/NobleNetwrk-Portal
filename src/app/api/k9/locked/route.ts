import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'all_locked_k9s.json');

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const owner = searchParams.get('owner');

    if (!owner) return NextResponse.json({ error: "Owner address required" }, { status: 400 });
    if (!fs.existsSync(DATA_FILE)) return NextResponse.json({ lockedK9s: [] });

    const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const userLockedK9s = fileData.lockedK9s.filter((k9: any) => k9.owner === owner);

    return NextResponse.json({ lockedK9s: userLockedK9s });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}