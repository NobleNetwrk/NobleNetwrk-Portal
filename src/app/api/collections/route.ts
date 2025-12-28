// src/app/api/collections/route.ts

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'src', 'data');

    const [
      solanaK9sHashlist,
      senseiHashlist,
      tsoHashlist,
      nobleGeneticsHashlist,
      nobleExtractsHashlist,
      namasteHashlist,
    ] = await Promise.all([
      fs.promises.readFile(path.join(dataDir, 'solanak9s.json'), 'utf-8'),
      fs.promises.readFile(path.join(dataDir, 'sensei.json'), 'utf-8'),
      fs.promises.readFile(path.join(dataDir, 'TSO.json'), 'utf-8'),
      fs.promises.readFile(path.join(dataDir, 'noble_genetics_hashlist.json'), 'utf-8'),
      fs.promises.readFile(path.join(dataDir, 'noble_extracts_hashlist.json'), 'utf-8'),
      fs.promises.readFile(path.join(dataDir, 'namaste_hashlist.json'), 'utf-8'),
    ].map(promise => promise.catch(err => {
      console.error(`Failed to read file: ${err.message}`);
      return '[]'; // Return an empty array as a string on error
    })));

    const collections = {
      solanaK9s: JSON.parse(solanaK9sHashlist),
      sensei: JSON.parse(senseiHashlist),
      tso: JSON.parse(tsoHashlist),
      nobleGenetics: JSON.parse(nobleGeneticsHashlist),
      nobleExtracts: JSON.parse(nobleExtractsHashlist),
      namaste: JSON.parse(namasteHashlist),
    };

    return NextResponse.json(collections);
  } catch (error) {
    console.error('Error fetching collection data:', error);
    return NextResponse.json({ error: 'Failed to load collection data' }, { status: 500 });
  }
}