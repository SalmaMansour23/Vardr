import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

type WindowKey = '24h' | '7d' | '30d';

interface ParsedRow {
  ts?: string;
  platform?: string;
  market_id?: string;
  market_title?: string;
  band?: string;
  risk_score?: number | null;
  raw_risk?: number | null;
  anomaly_score?: number | null;
  p_informed?: number | null;
  trade_size?: number | null;
  time_to_resolution_hours?: number | null;
  matched_keywords: string[];
}

const WINDOW_FILES: Record<WindowKey, string> = {
  '24h': 'suspicious_24h.csv',
  '7d': 'suspicious_7d.csv',
  '30d': 'suspicious_30d.csv',
};

function parseKeywords(raw: string): string[] {
  return raw
    .split(',')
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean)
    .filter((k, i, arr) => arr.indexOf(k) === i)
    .slice(0, 20);
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];

    if (ch === '"') {
      if (inQuotes && csvText[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && csvText[i + 1] === '\n') {
        i++;
      }
      row.push(field);
      field = '';
      if (row.length > 1 || row[0]?.trim()) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += ch;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0]?.trim()) {
      rows.push(row);
    }
  }

  return rows;
}

function toNumber(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toRecord(headers: string[], values: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((h, idx) => {
    record[h] = values[idx] ?? '';
  });
  return record;
}

export async function GET(request: NextRequest) {
  try {
    const windowParam = (request.nextUrl.searchParams.get('window') || '30d').toLowerCase();
    const windowKey: WindowKey = windowParam === '24h' || windowParam === '7d' || windowParam === '30d'
      ? (windowParam as WindowKey)
      : '30d';

    const keywordsRaw = request.nextUrl.searchParams.get('keywords') || '';
    const keywords = parseKeywords(keywordsRaw);
    if (keywords.length === 0) {
      return NextResponse.json(
        { error: 'Missing keywords. Pass comma-separated keywords query param.' },
        { status: 400 }
      );
    }

    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || '25');
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 500) : 25;

    const csvPath = path.join(process.cwd(), 'reports', WINDOW_FILES[windowKey]);
    let csvText = '';
    try {
      csvText = await fs.readFile(csvPath, 'utf8');
    } catch {
      return NextResponse.json(
        { error: `Missing file: ${csvPath}. Run scoring to generate suspicious CSV reports.` },
        { status: 404 }
      );
    }

    const rows = parseCsvRows(csvText);
    if (rows.length < 2) {
      return NextResponse.json({
        keywords,
        window: windowKey,
        source_file: WINDOW_FILES[windowKey],
        total_matches: 0,
        band_counts: { INVESTIGATE: 0, WATCHLIST: 0, LOW: 0 },
        keyword_hit_counts: Object.fromEntries(keywords.map((k) => [k, 0])),
        rows: [],
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const keywordHitCounts: Record<string, number> = Object.fromEntries(keywords.map((k) => [k, 0]));
    const bandCounts = { INVESTIGATE: 0, WATCHLIST: 0, LOW: 0 };

    const matchedRows: ParsedRow[] = [];
    for (const line of dataRows) {
      const rec = toRecord(headers, line);
      const haystack = [
        rec.market_title || '',
        rec.market_id || '',
        rec.platform || '',
        rec.info_susceptibility_reasons || '',
      ].join(' ').toLowerCase();

      const matchedKeywords = keywords.filter((k) => haystack.includes(k));
      if (matchedKeywords.length === 0) {
        continue;
      }

      for (const k of matchedKeywords) {
        keywordHitCounts[k] += 1;
      }

      const band = (rec.band || 'LOW').toUpperCase();
      if (band === 'INVESTIGATE') {
        bandCounts.INVESTIGATE += 1;
      } else if (band.startsWith('WATCHLIST')) {
        bandCounts.WATCHLIST += 1;
      } else {
        bandCounts.LOW += 1;
      }

      matchedRows.push({
        ts: rec.ts || undefined,
        platform: rec.platform || undefined,
        market_id: rec.market_id || undefined,
        market_title: rec.market_title || undefined,
        band: rec.band || undefined,
        risk_score: toNumber(rec.risk_score),
        raw_risk: toNumber(rec.raw_risk),
        anomaly_score: toNumber(rec.anomaly_score),
        p_informed: toNumber(rec.p_informed),
        trade_size: toNumber(rec.trade_size),
        time_to_resolution_hours: toNumber(rec.time_to_resolution_hours),
        matched_keywords: matchedKeywords,
      });
    }

    matchedRows.sort((a, b) => (b.risk_score ?? Number.NEGATIVE_INFINITY) - (a.risk_score ?? Number.NEGATIVE_INFINITY));

    return NextResponse.json({
      keywords,
      window: windowKey,
      source_file: WINDOW_FILES[windowKey],
      total_matches: matchedRows.length,
      band_counts: bandCounts,
      keyword_hit_counts: keywordHitCounts,
      rows: matchedRows.slice(0, limit),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to build flagged bets context',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
