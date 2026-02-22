import type { SuspiciousRow } from "./types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

export function getKalshiUrl(row: SuspiciousRow): string | null {
  const marketId = row.market_id?.trim();
  if (!marketId) return null;
  // Best effort from market_id only. Kalshi URLs often include extra path segments.
  return `https://kalshi.com/markets/${marketId.toLowerCase()}`;
}

export function getPolymarketUrl(row: SuspiciousRow): string | null {
  const marketId = row.market_id?.trim();
  const title = row.market_title?.trim();

  // If market_id is already a slug-like string, use it.
  if (marketId && !marketId.startsWith("0x") && marketId.includes("-")) {
    return `https://polymarket.com/event/${marketId}`;
  }

  // Otherwise use title slug as best effort.
  if (title) {
    const slug = slugify(title);
    if (slug) {
      return `https://polymarket.com/event/${slug}`;
    }
  }

  return null;
}

export function getPlatformUrl(row: SuspiciousRow): string | null {
  const platform = (row.platform || "").toLowerCase();
  if (platform === "kalshi") return getKalshiUrl(row);
  if (platform === "polymarket") return getPolymarketUrl(row);
  return null;
}

export function getAiIntelUrl(baseUrl: string, row: SuspiciousRow): string | null {
  const trimmed = (baseUrl || "").trim();
  if (!trimmed) return null;

  const u = new URL(trimmed);
  u.searchParams.set("platform", row.platform || "");
  u.searchParams.set("market_id", row.market_id || "");
  u.searchParams.set("title", row.market_title || "");
  u.searchParams.set("risk", String(row.risk_score ?? ""));
  return u.toString();
}
