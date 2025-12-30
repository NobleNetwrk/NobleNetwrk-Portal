import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Define the path to your JSON database
const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'all_locked_k9s.json');

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const owner = searchParams.get('owner');

    // 1. Validation: Ensure owner is provided
    if (!owner) {
      return NextResponse.json({ error: "Owner address required" }, { status: 400 });
    }

    // 2. Directory/File Check: If the file doesn't exist, nobody has locked anything yet
    if (!fs.existsSync(DATA_FILE)) {
      return NextResponse.json({ lockedK9s: [] });
    }

    // 3. Read and Parse: Get the current state of the vault
    const fileData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    
    // Ensure the data structure is as expected
    const allLocked = fileData.lockedK9s || [];

    // 4. Case-Insensitive Filtering:
    // This prevents "disappearing" assets if the wallet string casing differs 
    // between the browser and the JSON file.
    const userLockedK9s = allLocked.filter((k9: any) => 
      k9.owner?.toLowerCase() === owner.toLowerCase()
    );

    return NextResponse.json({ lockedK9s: userLockedK9s });
  } catch (error: any) {
    console.error("API Error in /api/k9/locked:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}