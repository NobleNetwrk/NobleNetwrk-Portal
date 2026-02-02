import { LRUCache } from 'lru-cache'

// Options: Store up to 500 items, expire them after 5 minutes
const options = {
  max: 500,
  ttl: 1000 * 60 * 5, // 5 Minutes
  allowStale: false,
}

// Create a singleton cache instance
export const cache = new LRUCache<string, any>(options)

// Helper to generate consistent keys
export const cacheKey = (prefix: string, value: string) => `${prefix}:${value}`