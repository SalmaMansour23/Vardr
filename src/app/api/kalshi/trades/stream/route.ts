import { NextRequest } from "next/server";
import { POLL_INTERVAL_MS, MAX_SEEN_IDS, KALSHI_BASE_URL } from "../../../../../../app/lib/feature-config";

export const dynamic = "force-dynamic";

const TRADES_PER_POLL = 100;

interface KalshiTrade {
  trade_id: string;
  ticker: string;
  yes_price?: number;
  no_price?: number;
  count?: number;
  taker_side?: "yes" | "no";
  created_time?: string;
}

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

      const poll = async () => {
        try {
          const url = new URL(`${KALSHI_BASE_URL}/markets/trades`);
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
            controller.enqueue(new TextEncoder().encode(encodeSSE(trade)));
          }
        } catch {
          // Ignore fetch errors and keep polling
        }
      };

      await poll();
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
