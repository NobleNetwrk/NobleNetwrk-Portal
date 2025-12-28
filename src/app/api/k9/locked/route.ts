import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get('owner');
  const DATA_FILE = path.join(process.cwd(), 'data', 'impound_data.json');
  
  const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const userLocked = data.lockedK9s.filter((l: any) => l.owner === owner);
  
  return Response.json({ lockedK9s: userLocked });
}