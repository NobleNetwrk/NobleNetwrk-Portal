// src/types/index.ts

export * from './legacy'; // This line re-exports NotificationType and other types from the legacy file.

export interface AssetHoldings {
  genetics: number
  extracts: number
  namaste: number
  solanaK9s: number
  sensei: number
  tso: number
  immortalGecko: number
  ntwrkBalance: number
  d3fenders: number
  stonedApeCrew: number
  totalAllocated: number;
  weeklyAllocation: number;
}