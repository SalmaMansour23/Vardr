import { NextResponse } from "next/server";
import { KALSHI_BASE_URL } from "../../../lib/feature-config";

const DEFAULT_LIMIT = 200;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") ?? String(DEFAULT_LIMIT);
  const cursor = searchParams.get("cursor") ?? "";
  const ticker = searchParams.get("ticker") ?? "";

  const url = new URL(`${KALSHI_BASE_URL}/markets/trades`);
  url.searchParams.set("limit", limit);
  if (cursor) url.searchParams.set("cursor", cursor);
  if (ticker) url.searchParams.set("ticker", ticker);

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });
    const contentType = response.headers.get("content-type") ?? "";
    const raw = await response.text();
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Kalshi API returned non-JSON response", trades: [] },
        { status: 502 }
      );
    }
    let data: { trades?: unknown[]; message?: string };
    try {
      data = JSON.parse(raw) as { trades?: unknown[]; message?: string };
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from Kalshi API", trades: [] },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: (data as { message?: string }).message ?? "Failed to fetch trades", trades: [] },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch trades";
    return NextResponse.json({ error: message, trades: [] }, { status: 502 });
  }
}
