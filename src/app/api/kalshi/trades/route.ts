import { NextResponse } from "next/server";
import {
  getCachedTrades,
  getCachedTradesIfFresh,
  hasStaleCache,
  setCachedTrades,
} from "@/lib/kalshi-trades-cache";

const KALSHI_TRADES_URL = "https://api.elections.kalshi.com/trade-api/v2/markets/trades";
const DEFAULT_LIMIT = 200;

async function fetchAndCacheTrades(
  ticker: string,
  limit: string,
  cursor: string
): Promise<{ trades: unknown[]; data: { trades?: unknown[]; cursor?: string; message?: string } }> {
  const url = new URL(KALSHI_TRADES_URL);
  url.searchParams.set("limit", limit);
  if (cursor) url.searchParams.set("cursor", cursor);
  if (ticker) url.searchParams.set("ticker", ticker);
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  const raw = await response.text();
  const data = JSON.parse(raw) as {
    trades?: unknown[];
    message?: string;
    cursor?: string;
  };
  if (!response.ok) {
    throw new Error(data.message ?? "Failed to fetch trades");
  }
  const trades = (data.trades ?? []) as { trade_id: string; ticker: string; [k: string]: unknown }[];
  if (trades.length > 0 && !cursor) setCachedTrades(ticker, trades);
  return { trades, data };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? String(DEFAULT_LIMIT);
  const cursor = searchParams.get("cursor") ?? "";
  const ticker = searchParams.get("ticker") ?? "";

  if (!cursor) {
    const fresh = getCachedTradesIfFresh(ticker);
    if (fresh && fresh.length > 0) {
      return NextResponse.json({ trades: fresh, cursor: "" });
    }
    const stale = getCachedTrades(ticker);
    if (stale && stale.length > 0 && hasStaleCache(ticker)) {
      fetchAndCacheTrades(ticker, limit, cursor).catch(() => {});
      return NextResponse.json({ trades: stale, cursor: "" });
    }
  }

  try {
    const { data } = await fetchAndCacheTrades(ticker, limit, cursor);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch trades";
    return NextResponse.json({ error: message, trades: [] }, { status: 502 });
  }
}
