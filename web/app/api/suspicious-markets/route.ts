import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type WindowKey = "24h" | "7d" | "30d";

const WINDOW_TO_FILE: Record<WindowKey, string> = {
  "24h": "suspicious_24h.csv",
  "7d": "suspicious_7d.csv",
  "30d": "suspicious_30d.csv",
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

function freshJson(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(NO_STORE_HEADERS)) {
    headers.set(key, value);
  }

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = csvText.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0]?.trim()) rows.push(row);
      row = [];
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0]?.trim()) rows.push(row);
  }

  return rows;
}

function toRecord(headers: string[], values: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((header, idx) => {
    out[header] = values[idx] ?? "";
  });
  return out;
}

function toFloat(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

type TradeRow = {
  platform: string;
  market_id: string;
  market_title: string;
  ts: string;
  price: number | null;
  trade_size: number | null;
};

function normalizeTradeRow(row: Record<string, string>): TradeRow {
  return {
    platform: row.platform || "",
    market_id: row.market_id || "",
    market_title: row.market_title || "",
    ts: row.ts || "",
    price: toFloat(row.price),
    trade_size: toFloat(row.trade_size),
  };
}

function getTimestampMs(value: string): number | null {
  const n = new Date(value).valueOf();
  return Number.isFinite(n) ? n : null;
}

function buildLeaderRows(trades: TradeRow[]): Array<Record<string, unknown>> {
  const grouped = new Map<string, TradeRow[]>();
  for (const trade of trades) {
    if (!trade.platform || !trade.market_id) continue;
    const key = `${trade.platform}\u0000${trade.market_id}`;
    const group = grouped.get(key) || [];
    group.push(trade);
    grouped.set(key, group);
  }

  const leaders: Array<Record<string, unknown>> = [];
  for (const group of grouped.values()) {
    const ordered = group
      .map((trade) => ({ trade, tsMs: getTimestampMs(trade.ts) }))
      .filter((item): item is { trade: TradeRow; tsMs: number } => item.tsMs !== null && item.trade.price !== null)
      .sort((a, b) => a.tsMs - b.tsMs);
    if (ordered.length === 0) continue;

    const latest = ordered[ordered.length - 1];
    const latestMs = latest.tsMs;
    const currentPrice = latest.trade.price ?? null;
    const oneHourAgo = latestMs - 60 * 60 * 1000;
    const dayAgo = latestMs - 24 * 60 * 60 * 1000;
    const oneHourBase = ordered.find((item) => item.tsMs >= oneHourAgo) || ordered[0];
    const dayBase = ordered.find((item) => item.tsMs >= dayAgo) || ordered[0];
    const priceChange1h = currentPrice === null || oneHourBase.trade.price === null
      ? null
      : currentPrice - oneHourBase.trade.price;
    const priceChange24h = currentPrice === null || dayBase.trade.price === null
      ? null
      : currentPrice - dayBase.trade.price;
    const recentVolume = group.reduce((sum, trade) => sum + (trade.trade_size ?? 0), 0) || group.length;
    const leaderScore = priceChange1h === null ? 0 : Math.abs(priceChange1h) * Math.log1p(recentVolume);
    const representative = latest.trade;

    leaders.push({
      platform: representative.platform,
      market_id: representative.market_id,
      market_title: representative.market_title,
      ts: representative.ts,
      latest_ts: representative.ts,
      current_price: currentPrice,
      price_change_1h: priceChange1h,
      price_change_24h: priceChange24h,
      recent_volume: recentVolume,
      leader_score: leaderScore,
    });
  }

  return leaders.sort((a, b) => {
    const ar = typeof a.leader_score === "number" ? a.leader_score : Number.NEGATIVE_INFINITY;
    const br = typeof b.leader_score === "number" ? b.leader_score : Number.NEGATIVE_INFINITY;
    return br - ar;
  });
}

async function findReportPath(fileName: string): Promise<string> {
  const candidates = [
    path.join(process.cwd(), "reports", fileName),
    path.join(process.cwd(), "..", "reports", fileName),
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next likely project layout.
    }
  }

  return candidates[0];
}

export async function GET(request: NextRequest) {
  try {
    const windowParam = (request.nextUrl.searchParams.get("window") || "24h").toLowerCase();
    const windowKey: WindowKey =
      windowParam === "24h" || windowParam === "7d" || windowParam === "30d"
        ? windowParam
        : "24h";
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") || "10");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 1000) : 10;
    const sourceFile = WINDOW_TO_FILE[windowKey];
    const csvPath = await findReportPath(sourceFile);

    let csvText = "";
    try {
      csvText = await fs.readFile(csvPath, "utf8");
    } catch {
      return freshJson(
        {
          error: "missing_report",
          message: `Could not find ${sourceFile}. Run scoring first: python -m ml_insider.cli score`,
          window: windowKey,
          path: csvPath,
          csvPath,
          csvLastModified: null,
          rowCount: 0,
        },
        { status: 404 },
      );
    }

    const stats = await fs.stat(csvPath);
    const updatedAt = new Date(stats.mtime).toISOString();
    const servedAt = new Date().toISOString();
    const rows = parseCsvRows(csvText);
    const rowCount = Math.max(0, rows.length - 1);
    if (rows.length < 2) {
      return freshJson({
        data: [],
        csvPath,
        csvLastModified: updatedAt,
        rowCount,
        metadata: {
          window: windowKey,
          limit,
          total: 0,
          returned: 0,
          csvPath,
          csvLastModified: updatedAt,
          rowCount,
        },
      });
    }

    const headers = rows[0];
    const tradeRows = rows.slice(1).map((line) => normalizeTradeRow(toRecord(headers, line)));
    const leaderRows = buildLeaderRows(tradeRows);
    const data = leaderRows.slice(0, limit).map((row) => ({
      ...row,
      _window: windowKey,
      _source_file: sourceFile,
      _file_updated_at: updatedAt,
      _served_at: servedAt,
    }));

    return freshJson({
      data,
      csvPath,
      csvLastModified: updatedAt,
      rowCount,
      metadata: {
        window: windowKey,
        limit,
        total: leaderRows.length,
        returned: data.length,
        source_file: sourceFile,
        file_updated_at: updatedAt,
        served_at: servedAt,
        csvPath,
        csvLastModified: updatedAt,
        rowCount,
      },
    });
  } catch (err) {
    return freshJson(
      {
        error: "internal_error",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
