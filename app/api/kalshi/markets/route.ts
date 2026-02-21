import { NextResponse } from "next/server";

const KALSHI_MARKETS_URL = "https://api.elections.kalshi.com/trade-api/v2/markets";
const DEFAULT_LIMIT = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? String(DEFAULT_LIMIT);
  const status = searchParams.get("status") ?? "";

  const url = new URL(KALSHI_MARKETS_URL);
  url.searchParams.set("limit", limit);
  if (status) url.searchParams.set("status", status);

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const raw = await response.text();
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Kalshi API returned non-JSON response", markets: [] },
        { status: 502 }
      );
    }
    let data: { markets?: { ticker?: string; title?: string }[]; cursor?: string };
    try {
      data = JSON.parse(raw) as { markets?: { ticker?: string; title?: string }[]; cursor?: string };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from Kalshi API", markets: [] },
        { status: 502 }
      );
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch markets", markets: [] },
        { status: response.status }
      );
    }
    const markets = (data.markets ?? []).map((m) => ({
      ticker: m.ticker ?? "",
      title: m.title ?? m.ticker ?? "Unknown",
    })).filter((m) => m.ticker);
    return NextResponse.json({ markets, cursor: data.cursor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch markets";
    return NextResponse.json({ error: message, markets: [] }, { status: 502 });
  }
}
