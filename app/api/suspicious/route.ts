import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

type WindowKey = '24h' | '7d' | '30d';
type Band = 'ALL' | 'INVESTIGATE' | 'WATCHLIST' | 'LOW';

const WINDOW_TO_FILE: Record<WindowKey, string> = {
  '24h': 'suspicious_24h.csv',
  '7d': 'suspicious_7d.csv',
  '30d': 'suspicious_30d.csv',
};

const VALID_BANDS: Set<Band> = new Set(['ALL', 'INVESTIGATE', 'WATCHLIST', 'LOW']);

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const text = csvText.replace(/^\uFEFF/, '');

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

    if (!inQuotes && ch === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && text[i + 1] === '\n') {
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

function toRecord(headers: string[], values: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((header, idx) => {
    out[header] = values[idx] ?? '';
  });
  return out;
}

function toFloat(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toInt(value: string | undefined): number | null {
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizeRow(row: Record<string, string>): Record<string, unknown> {
  return {
    ...row,
    risk_score: toFloat(row.risk_score),
    raw_risk: toFloat(row.raw_risk),
    anomaly_score: toFloat(row.anomaly_score),
    p_informed: toFloat(row.p_informed),
    info_susceptibility_score: toFloat(row.info_susceptibility_score),
    time_to_resolution_hours: toFloat(row.time_to_resolution_hours),
    price: toFloat(row.price),
    trade_size: toFloat(row.trade_size),
    quota_fill: toInt(row.quota_fill),
    flagged: toInt(row.flagged),
    pseudo_flagged: toInt(row.pseudo_flagged),
    band: (row.band || 'LOW').toUpperCase(),
  };
}

function bandMatch(rowBand: string | undefined, requestedBand: Band): boolean {
  const band = (rowBand || 'LOW').toUpperCase();
  if (requestedBand === 'ALL') return true;
  if (requestedBand === 'INVESTIGATE') return band === 'INVESTIGATE';
  if (requestedBand === 'WATCHLIST') return band === 'INVESTIGATE' || band === 'WATCHLIST' || band === 'WATCHLIST_QUOTA';
  if (requestedBand === 'LOW') return band === 'LOW';
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const windowParam = (request.nextUrl.searchParams.get('window') || '24h').toLowerCase();
    const windowKey: WindowKey = windowParam === '24h' || windowParam === '7d' || windowParam === '30d'
      ? (windowParam as WindowKey)
      : '24h';

    const bandParam = (request.nextUrl.searchParams.get('band') || 'ALL').toUpperCase();
    if (!VALID_BANDS.has(bandParam as Band)) {
      return NextResponse.json(
        {
          error: 'invalid_band',
          message: 'band must be one of INVESTIGATE, WATCHLIST, LOW, ALL',
          band: bandParam,
        },
        { status: 400 }
      );
    }
    const requestedBand = bandParam as Band;

    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || '1000');
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 50000) : 1000;

    const csvPath = path.join(process.cwd(), 'reports', WINDOW_TO_FILE[windowKey]);
    let csvText = '';
    try {
      csvText = await fs.readFile(csvPath, 'utf8');
    } catch {
      return NextResponse.json(
        {
          error: 'missing_report',
          message: `Could not find ${WINDOW_TO_FILE[windowKey]}. Run scoring first: python -m ml_insider.cli score`,
          window: windowKey,
          path: csvPath,
        },
        { status: 404 }
      );
    }

    const rows = parseCsvRows(csvText);
    if (rows.length < 2) {
      return NextResponse.json([]);
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const normalizedRows = dataRows.map((line) => normalizeRow(toRecord(headers, line)));

    const filtered = normalizedRows.filter((row) => bandMatch(String(row.band || ''), requestedBand));
    filtered.sort((a, b) => {
      const ar = typeof a.risk_score === 'number' ? a.risk_score : null;
      const br = typeof b.risk_score === 'number' ? b.risk_score : null;
      if (ar === null && br === null) return 0;
      if (ar === null) return 1;
      if (br === null) return -1;
      return br - ar;
    });

    const stats = await fs.stat(csvPath);
    const updatedAt = new Date(stats.mtime).toISOString();
    const servedAt = new Date().toISOString();
    const out = filtered.slice(0, limit).map((row) => ({
      ...row,
      _window: windowKey,
      _source_file: WINDOW_TO_FILE[windowKey],
      _file_updated_at: updatedAt,
      _served_at: servedAt,
    }));

    return NextResponse.json(out);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'read_failed',
        message: `Failed to read suspicious feed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}
