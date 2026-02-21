/**
 * In-memory cache for Kalshi trades so we can serve GET/stream in under 1ms
 * from our server instead of waiting on Kalshi API round-trips.
 */

export interface CachedKalshiTrade {
  trade_id: string;
  ticker: string;
  yes_price?: number;
  no_price?: number;
  count?: number;
  taker_side?: "yes" | "no";
  created_time?: string;
}

const CACHE_MAX_AGE_MS = 10_000;
const CACHE_STALE_OK_MS = 60_000;
const CACHE_MAX_TRADES = 300;

interface CacheEntry {
  trades: CachedKalshiTrade[];
  updatedAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(ticker: string): string {
  return ticker || "__all__";
}

export function getCachedTrades(ticker: string): CachedKalshiTrade[] | null {
  const key = cacheKey(ticker);
  const entry = cache.get(key);
  if (!entry) return null;
  return entry.trades;
}

export function getCachedTradesIfFresh(ticker: string): CachedKalshiTrade[] | null {
  const key = cacheKey(ticker);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.updatedAt > CACHE_MAX_AGE_MS) return null;
  return entry.trades;
}

export function setCachedTrades(ticker: string, trades: CachedKalshiTrade[]): void {
  const key = cacheKey(ticker);
  cache.set(key, {
    trades: trades.slice(0, CACHE_MAX_TRADES),
    updatedAt: Date.now(),
  });
}

export function hasFreshCache(ticker: string): boolean {
  const entry = cache.get(cacheKey(ticker));
  if (!entry) return false;
  return Date.now() - entry.updatedAt <= CACHE_MAX_AGE_MS;
}

export function hasStaleCache(ticker: string): boolean {
  const entry = cache.get(cacheKey(ticker));
  if (!entry) return false;
  return Date.now() - entry.updatedAt <= CACHE_STALE_OK_MS;
}
