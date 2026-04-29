"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatDate, formatPercent } from "@/lib/format";
import { getAiIntelUrl, getPlatformUrl } from "@/lib/links";
import type { SuspiciousRow, WindowKey } from "@/lib/types";

type Props = {
  apiBaseUrl: string;
  aiIntelBaseUrl: string;
  refreshSeconds: number;
};

const WINDOW_OPTIONS: Array<{ key: WindowKey; label: string }> = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
];

const DEFAULT_VISIBLE_COUNT = 10;
const SHOW_MORE_INCREMENT = 10;
const API_ROW_LIMIT = 1000;

const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "be",
  "before",
  "by",
  "for",
  "from",
  "in",
  "is",
  "of",
  "on",
  "or",
  "than",
  "the",
  "to",
  "will",
  "with",
]);

function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}pp`;
}

function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function titleTokens(title: string | undefined): string[] {
  return (title || "")
    .toLowerCase()
    .replace(/[\u2019']/g, "")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\b(?:more|less)\s+than\s+\$?\d+(?:\.\d+)?\s*(?:b|bn|m|mm|million|billion|%|years?)?\b/g, " ")
    .replace(/\bbetween\s+\$?\d+(?:\.\d+)?\s*(?:b|bn|m|mm|million|billion|%|years?)?\s+and\s+\$?\d+(?:\.\d+)?\s*(?:b|bn|m|mm|million|billion|%|years?)?\b/g, " ")
    .replace(/\b(?:at\s+least|at\s+most|over|under|above|below)\s+\$?\d+(?:\.\d+)?\s*(?:b|bn|m|mm|million|billion|%|years?)?\b/g, " ")
    .replace(/[<>]=?\s*\$?\d+(?:\.\d+)?\s*(?:b|bn|m|mm|million|billion|%|years?)?/g, " ")
    .replace(/\b(?:by|before|after)\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\b/g, " ")
    .replace(/\b(?:by|before|after)\s+gta\s+vi\b/g, " ")
    .replace(/\b(?:by|before|after)\s+\d{4}\b/g, " ")
    .replace(/\$?\d+(?:\.\d+)?\s*(?:b|bn|m|mm|million|billion|%|years?)?/g, " ")
    .replace(/\belections\b/g, "election")
    .replace(/\bprimaries\b/g, "primary")
    .replace(/\binvades\b/g, "invade")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !TITLE_STOP_WORDS.has(token));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function dedupeSimilarTitles(rows: SuspiciousRow[]): SuspiciousRow[] {
  const groups: Array<{ key: string; tokens: Set<string> }> = [];
  const out: SuspiciousRow[] = [];

  for (const row of rows) {
    const tokens = new Set(titleTokens(row.market_title));
    const key = [...tokens].join(" ");
    const duplicate = groups.some((group) => key && (group.key === key || jaccardSimilarity(tokens, group.tokens) >= 0.55));
    if (duplicate) continue;
    groups.push({ key: key || row.market_id || String(out.length), tokens });
    out.push(row);
  }

  return out;
}

export function FlaggedBetsDashboard({ apiBaseUrl, aiIntelBaseUrl, refreshSeconds }: Props) {
  const [windowKey, setWindowKey] = useState<WindowKey>("24h");
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);
  const [search, setSearch] = useState("");
  const [minLeaderScore, setMinLeaderScore] = useState("");
  const [minRecentVolume, setMinRecentVolume] = useState("");
  const [dedupeTitles, setDedupeTitles] = useState(false);
  const [rows, setRows] = useState<SuspiciousRow[]>([]);
  const [selected, setSelected] = useState<SuspiciousRow | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const loadRows = useCallback(async () => {
    const makeUrl = (base: string | null): string => {
      const params = new URLSearchParams();
      params.set("window", windowKey);
      params.set("limit", String(API_ROW_LIMIT));
      if (base && base.trim()) {
        const u = new URL(`${base.replace(/\/$/, "")}/api/suspicious-markets`);
        u.search = params.toString();
        return u.toString();
      }
      return `/api/suspicious-markets?${params.toString()}`;
    };
    const requestUrls = apiBaseUrl ? [makeUrl(apiBaseUrl), makeUrl(null)] : [makeUrl(null)];

    setLoading(true);
    setError("");
    try {
      let payload: unknown = null;
      let ok = false;
      let lastErr: Error | null = null;
      for (const requestUrl of requestUrls) {
        try {
          const res = await fetch(requestUrl, { cache: "no-store" });
          const parsed = await res.json();
          if (!res.ok) {
            const msg = typeof parsed?.message === "string" ? parsed.message : `Request failed (${res.status})`;
            throw new Error(msg);
          }
          payload = parsed;
          ok = true;
          break;
        } catch (err) {
          lastErr = err instanceof Error ? err : new Error("Unknown error while loading data.");
        }
      }
      if (!ok) {
        throw lastErr || new Error("Unknown error while loading data.");
      }
      const marketRows = Array.isArray(payload)
        ? payload
        : (payload as { data?: unknown })?.data;
      if (!Array.isArray(marketRows)) {
        throw new Error("API response was not an array.");
      }
      const typed = marketRows as SuspiciousRow[];
      setRows(typed);
      setLastUpdated(typed[0]?._file_updated_at || new Date().toISOString());
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Unknown error while loading data.");
      setLastUpdated(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, windowKey]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    const intervalMs = Math.max(10, refreshSeconds) * 1000;
    const t = setInterval(() => {
      loadRows();
    }, intervalMs);
    return () => clearInterval(t);
  }, [loadRows, refreshSeconds]);

  useEffect(() => {
    setVisibleCount(DEFAULT_VISIBLE_COUNT);
  }, [dedupeTitles, minLeaderScore, minRecentVolume, search, windowKey]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const minScore = minLeaderScore.trim() === "" ? null : Number(minLeaderScore);
    const minVolume = minRecentVolume.trim() === "" ? null : Number(minRecentVolume);
    let next = rows;
    if (q) {
      next = next.filter((r) => (r.market_title || "").toLowerCase().includes(q));
    }
    if (minScore !== null && Number.isFinite(minScore)) {
      next = next.filter((r) => (r.leader_score ?? Number.NEGATIVE_INFINITY) >= minScore);
    }
    if (minVolume !== null && Number.isFinite(minVolume)) {
      next = next.filter((r) => (r.recent_volume ?? Number.NEGATIVE_INFINITY) >= minVolume);
    }

    next = [...next].sort((a, b) => {
      const ar = a.leader_score ?? Number.NEGATIVE_INFINITY;
      const br = b.leader_score ?? Number.NEGATIVE_INFINITY;
      return br - ar;
    });
    if (dedupeTitles) {
      next = dedupeSimilarTitles(next);
    }
    return next;
  }, [dedupeTitles, minLeaderScore, minRecentVolume, rows, search]);

  const visibleRows = filteredRows.slice(0, visibleCount);

  const marketUrl = selected ? getPlatformUrl(selected) : null;
  const aiUrl = selected ? getAiIntelUrl(aiIntelBaseUrl, selected) : null;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 lg:px-8">
      <section className="rounded-3xl border border-emerald-200 bg-white/80 p-6 shadow-glow backdrop-blur lg:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">Data Tab Replacement</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Flagged Bets</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-700">
              Semi-live feed of leader markets from your price-movement pipeline. Auto-refresh runs every {refreshSeconds}s.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono">
              Last updated: {lastUpdated ? formatDate(lastUpdated) : "--"}
            </span>
            <button
              type="button"
              onClick={loadRows}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 font-medium text-emerald-800 hover:bg-emerald-100"
            >
              Refresh Now
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Window</label>
            <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-1">
              {WINDOW_OPTIONS.map((w) => (
                <button
                  key={w.key}
                  type="button"
                  onClick={() => setWindowKey(w.key)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    windowKey === w.key ? "bg-slateInk text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Search Title</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search market title"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Min Leader Score</label>
            <input
              value={minLeaderScore}
              onChange={(e) => setMinLeaderScore(e.target.value)}
              placeholder="e.g. 1.5"
              inputMode="decimal"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Min Volume</label>
            <input
              value={minRecentVolume}
              onChange={(e) => setMinRecentVolume(e.target.value)}
              placeholder="e.g. 1000"
              inputMode="decimal"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-end lg:col-span-2">
            <label className="flex h-[38px] w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={dedupeTitles}
                onChange={(e) => setDedupeTitles(e.target.checked)}
                className="h-4 w-4"
              />
              Dedupe titles
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4 text-xs text-slate-600">
          <span>{loading ? "Loading..." : `${visibleRows.length} of ${filteredRows.length} rows`}</span>
          {error ? <span className="font-medium text-rose-700">{error}</span> : null}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">Current Price</th>
                <th className="px-4 py-3">1H Change</th>
                <th className="px-4 py-3">24H Change</th>
                <th className="px-4 py-3">Recent Volume</th>
                <th className="px-4 py-3">Platform</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, idx) => (
                <tr
                  key={`${row.market_id || "na"}-${row.ts || row.latest_ts || "na"}-${idx}`}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer border-t border-slate-100 hover:bg-emerald-50/50"
                >
                  <td className="max-w-[520px] truncate px-4 py-3 text-slate-800">{row.market_title || "--"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatPercent(row.current_price ?? null)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatSignedPercent(row.price_change_1h ?? null)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatSignedPercent(row.price_change_24h ?? null)}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{formatAmount(row.recent_volume ?? null)}</td>
                  <td className="px-4 py-3 uppercase text-slate-700">{row.platform || "--"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visibleCount < filteredRows.length ? (
          <div className="flex justify-center border-t border-slate-100 p-4">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + SHOW_MORE_INCREMENT)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Show more
            </button>
          </div>
        ) : null}
      </section>

      {selected ? (
        <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-xl border-l border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Leader Market Details</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">{selected.market_title || "Untitled market"}</h2>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600"
            >
              Close
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Current Price</p><p className="font-semibold">{formatPercent(selected.current_price ?? null)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">1H Change</p><p className="font-semibold">{formatSignedPercent(selected.price_change_1h ?? null)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">24H Change</p><p className="font-semibold">{formatSignedPercent(selected.price_change_24h ?? null)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Recent Volume</p><p className="font-semibold">{formatAmount(selected.recent_volume ?? null)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Platform</p><p className="font-semibold">{selected.platform || "--"}</p></div>
          </div>

          <div className="mt-4 space-y-1 text-sm text-slate-700">
            <p><span className="font-semibold">Platform:</span> {selected.platform || "--"}</p>
            <p><span className="font-semibold">Market ID:</span> <span className="font-mono text-xs">{selected.market_id || "--"}</span></p>
            <p><span className="font-semibold">Timestamp:</span> {formatDate(selected.ts || selected.latest_ts)}</p>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {marketUrl ? (
              <a
                href={marketUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-300 bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
              >
                Open on {(selected.platform || "market").toLowerCase() === "kalshi" ? "Kalshi" : "Polymarket"}
              </a>
            ) : null}
            {aiUrl ? (
              <a
                href={aiUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800"
              >
                Open AI intelligence tool
              </a>
            ) : null}
            <button
              type="button"
              onClick={async () => {
                if (!selected.market_id) return;
                try {
                  await navigator.clipboard.writeText(selected.market_id);
                } catch {
                  // no-op
                }
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              Copy market_id
            </button>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
