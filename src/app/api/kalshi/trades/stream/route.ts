import { NextRequest } from "next/server";
import { getCachedTrades, setCachedTrades } from "@/lib/kalshi-trades-cache";
import type { CachedKalshiTrade } from "@/lib/kalshi-trades-cache";

export const dynamic = "force-dynamic";

const KALSHI_TRADES_URL = "https://api.elections.kalshi.com/trade-api/v2/markets/trades";
const POLL_INTERVAL_MS = 500;
const TRADES_PER_POLL = 100;
const MAX_SEEN_IDS = 5000;

interface KalshiTrade extends CachedKalshiTrade {}

interface KalshiTradesResponse {
  trades?: KalshiTrade[];
  cursor?: string;
}

function encodeSSE(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker") ?? "";

  const stream = new ReadableStream({
    async start(controller) {
      const seenIds = new Set<string>();
      const seenOrder: string[] = [];
      let firstRun = true;

      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(": connected\n\n"));

      const cached = getCachedTrades(ticker);
      if (cached && cached.length > 0) {
        for (const t of cached) {
          if (t.trade_id) controller.enqueue(encoder.encode(encodeSSE(t)));
        }
      }

      const poll = async () => {
        try {
          const url = new URL(KALSHI_TRADES_URL);
          url.searchParams.set("limit", String(TRADES_PER_POLL));
          if (ticker) url.searchParams.set("ticker", ticker);

          const response = await fetch(url.toString(), {
            headers: { Accept: "application/json" },
            next: { revalidate: 0 },
          });

          if (!response.ok) {
            return;
          }

          const body = (await response.json()) as KalshiTradesResponse;
          const trades = body.trades ?? [];

          setCachedTrades(ticker, trades);

          if (firstRun) {
            firstRun = false;
            trades.forEach((t) => {
              if (t.trade_id) {
                seenIds.add(t.trade_id);
                seenOrder.push(t.trade_id);
              }
            });
            while (seenOrder.length > MAX_SEEN_IDS) {
              const oldest = seenOrder.shift();
              if (oldest) seenIds.delete(oldest);
            }
            if (!cached || cached.length === 0) {
              for (const t of trades) {
                if (t.trade_id) controller.enqueue(encoder.encode(encodeSSE(t)));
              }
            }
            return;
          }

          for (const trade of trades) {
            if (!trade.trade_id || seenIds.has(trade.trade_id)) continue;
            seenIds.add(trade.trade_id);
            seenOrder.push(trade.trade_id);
            while (seenOrder.length > MAX_SEEN_IDS) {
              const oldest = seenOrder.shift();
              if (oldest) seenIds.delete(oldest);
            }
            controller.enqueue(encoder.encode(encodeSSE(trade)));
          }
        } catch {
          // Ignore fetch errors and keep polling
        }
      };

      poll();
      const intervalId = setInterval(poll, POLL_INTERVAL_MS);

      request.signal?.addEventListener("abort", () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
    },
  });
}
