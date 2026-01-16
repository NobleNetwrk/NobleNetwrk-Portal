// src/app/api/vault/data/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey, Connection } from '@solana/web3.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const IMMORTAL_GECKOS_API = process.env.IMMORTAL_GECKOS_API || 'https://www.illogicalendeavors.com/gecko/immortals/tools/getImmortals.php';
const JUPITER_PRICE_API = 'https://lite-api.jup.ag/price/v3';
const NTWRK_MINT_ADDRESS = 'NTWRKKPPXXzLis2aCZHQ9yJ4RyELHseF3Q8CmZBjsjS';
const SOLANA_RPC_ENDPOINT = process.env.SOLANA_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com';

// Define the type for the holdings object
interface Holdings {
  genetics: number;
  extracts: number;
  namaste: number;
  solanaK9s: number;
  sensei: number;
  tso: number;
  d3fenders: number;
  stonedApeCrew: number;
  immortalGecko: number;
}

// Define the file to key mapping
const collectionFileMap: { [key: string]: keyof Holdings } = {
  'noble_genetics_hashlist.json': 'genetics',
  'noble_extracts_hashlist.json': 'extracts',
  'namaste_hashlist.json': 'namaste',
  'solanaK9s.json': 'solanaK9s',
  'sensei.json': 'sensei',
  'TSO.json': 'tso',
  'd3fenders.json': 'd3fenders',
  'stoned_ape_crew.json': 'stonedApeCrew',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const publicKey = searchParams.get('publicKey');

  if (!publicKey) {
    return NextResponse.json({ success: false, error: 'Missing required parameter: publicKey.' }, { status: 400 });
  }

  try {
    const connection = new Connection(SOLANA_RPC_ENDPOINT);
    const userPublicKey = new PublicKey(publicKey);
    const userPublicKeyString = userPublicKey.toBase58();

    // 1. Fetch SOL Balance, SOL Price, and NTWRK Price in parallel
    const [solBalance, solPriceResponse, ntwrkPriceResponse] = await Promise.all([
      connection.getBalance(userPublicKey).catch(() => 0),
      axios.get(`${JUPITER_PRICE_API}?ids=So11111111111111111111111111111111111111112`).catch(() => null),
      axios.get(`${JUPITER_PRICE_API}?ids=${NTWRK_MINT_ADDRESS}`).catch(() => null),
    ]);

    const solPrice = solPriceResponse?.data['So11111111111111111111111111111111111111112']?.usdPrice || null;
    const ntwrkPrice = ntwrkPriceResponse?.data[NTWRK_MINT_ADDRESS]?.usdPrice || null;
    const solBalanceInSol = solBalance / 1e9;
    
    // 2. Fetch and filter all NFT data directly from local files in parallel
    const dataDir = path.join(process.cwd(), 'src', 'data');
    const collectionPromises = Object.keys(collectionFileMap).map(file => {
      const filePath = path.join(dataDir, file);
      return fs.promises.readFile(filePath, 'utf-8')
        .then(data => JSON.parse(data) as string[])
        .catch(err => {
          console.error(`Failed to read or parse collection file ${file}:`, err);
          return [];
        });
    });

    const collectionsData = await Promise.all(collectionPromises);

    const holdings: Holdings = {
      genetics: 0,
      extracts: 0,
      namaste: 0,
      solanaK9s: 0,
      sensei: 0,
      tso: 0,
      d3fenders: 0,
      stonedApeCrew: 0,
      immortalGecko: 0,
    };

    Object.values(collectionFileMap).forEach((key, index) => {
      const hashlist = collectionsData[index];
      const count = (hashlist as string[]).filter(owner => owner === userPublicKeyString).length;
      holdings[key] = count;
    });

    // 3. Fetch Immortal Geckos
    const { data: immortalGeckos } = await axios.get(IMMORTAL_GECKOS_API);
    const immortalGeckoCount = immortalGeckos.filter((gecko: { ownerWallet: string }) => gecko.ownerWallet === userPublicKeyString).length;
    holdings.immortalGecko = immortalGeckoCount;

    // 4. Fetch NTWRK token balance
    const ntwrkAccount = await connection.getParsedTokenAccountsByOwner(
      userPublicKey,
      { mint: new PublicKey(NTWRK_MINT_ADDRESS) }
    );
    const ntwrkBalance = ntwrkAccount.value[0]?.account.data.parsed.info.tokenAmount.uiAmount || 0;

    const data = {
      solBalance: solBalanceInSol,
      solPrice,
      ntwrkBalance,
      ntwrkPrice,
      holdings,
    };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in consolidated vault data endpoint:', error);
    return NextResponse.json({ success: false, message: 'Internal server error.' }, { status: 500 });
  }
}