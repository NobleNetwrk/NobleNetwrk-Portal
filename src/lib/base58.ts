// src/lib/base58.ts
import bs58 from 'bs58';

export const base58 = {
  encode: (data: Uint8Array | number[]): string => bs58.encode(data),
  decode: (data: string): Uint8Array => bs58.decode(data),
};