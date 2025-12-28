// src/utils/hashlistLoader.ts
import nobleGeneticsHashlist from '@/data/noble_genetics_hashlist.json'
import nobleExtractsHashlist from '@/data/noble_extracts_hashlist.json'
import namasteHashlist from '@/data/namaste_hashlist.json'
import d3fendersHashlist from '@/data/d3fenders_hashlist.json'
import solanaK9sHashlist from '@/data/solanak9s_hashlist.json'
import senseiHashlist from '@/data/sensei_hashlist.json'
import tsoHashlist from '@/data/tso_hashlist.json'
import sacHashlist from '@/data/sac_hashlist.json'

// Helper to extract mint addresses from JSON structure
function extractMints(hashlist: any): string[] {
  // Check if it's an array of objects with mint property, or just an array of strings
  if (Array.isArray(hashlist)) {
    if (hashlist.length > 0 && typeof hashlist[0] === 'object' && hashlist[0].mint) {
      return hashlist.map((item: any) => item.mint)
    }
    return hashlist.filter((item: any): item is string => typeof item === 'string')
  }
  return []
}

// Extract and export the hash lists
export const NOBLE_GENETICS_HASHLIST = extractMints(nobleGeneticsHashlist)
export const NOBLE_EXTRACTS_HASHLIST = extractMints(nobleExtractsHashlist)
export const NAMASTE_HASHLIST = extractMints(namasteHashlist)
export const D3FENDERS_HASHLIST = extractMints(d3fendersHashlist)
export const STONED_APE_CREW_HASHLIST = extractMints(sacHashlist)
export const K9_HASHLIST = extractMints(solanaK9sHashlist)
export const SENSEI_HASHLIST = extractMints(senseiHashlist)
export const TSO_HASHLIST = extractMints(tsoHashlist)