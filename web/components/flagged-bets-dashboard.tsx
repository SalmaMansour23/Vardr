"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { formatDate, formatHours, formatPercent } from "@/lib/format";
import { getAiIntelUrl, getPlatformUrl } from "@/lib/links";
import type { FeedBand, SuspiciousRow, UiBandMode, WindowKey } from "@/lib/types";

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

const LIMIT_OPTIONS = [200, 500, 1000, 2000, 5000];

function bandColor(band: string | undefined): string {
  const value = (band || "").toUpperCase();
  if (value === "INVESTIGATE") return "bg-rose-100 text-rose-800 border-rose-300";
  if (value === "WATCHLIST" || value === "WATCHLIST_QUOTA") return "bg-amber-100 text-amber-800 border-amber-300";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function mapModeToBand(mode: UiBandMode): FeedBand {
  if (mode === "INVESTIGATE_ONLY") return "INVESTIGATE";
  if (mode === "WATCHLIST_PLUS") return "WATCHLIST";
  return "ALL";
}

function parseReasons(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return [raw];
  }
}

export function FlaggedBetsDashboard({ apiBaseUrl, aiIntelBaseUrl, refreshSeconds }: Props) {
  const [windowKey, setWindowKey] = useState<WindowKey>("24h");
  const [mode, setMode] = useState<UiBandMode>("WATCHLIST_PLUS");
  const [limit, setLimit] = useState<number>(200);
  const [search, setSearch] = useState("");
  const [sortDescending, setSortDescending] = useState(true);
  const [rows, setRows] = useState<SuspiciousRow[]>([]);
  const [selected, setSelected] = useState<SuspiciousRow | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const loadRows = useCallback(async () => {
    const band = mapModeToBand(mode);
    const u = new URL(`${apiBaseUrl.replace(/\/$/, "")}/api/suspicious`);
    u.searchParams.set("window", windowKey);
    u.searchParams.set("band", band);
    u.searchParams.set("limit", String(limit));

    setLoading(true);
    setError("");
    try {
      const res = await fetch(u.toString(), { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) {
        const msg = typeof payload?.message === "string" ? payload.message : `Request failed (${res.status})`;
        throw new Error(msg);
      }
      if (!Array.isArray(payload)) {
        throw new Error("API response was not an array.");
      }
      setRows(payload as SuspiciousRow[]);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Unknown error while loading data.");
      setLastUpdated(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, limit, mode, windowKey]);

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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    let next = rows;
    if (q) {
      next = next.filter((r) => (r.market_title || "").toLowerCase().includes(q));
    }

    // Defensive client-side filter, even though API already applies a coarse band filter.
    if (mode === "INVESTIGATE_ONLY") {
      next = next.filter((r) => (r.band || "").toUpperCase() === "INVESTIGATE");
    } else if (mode === "WATCHLIST_PLUS") {
      next = next.filter((r) => {
        const b = (r.band || "").toUpperCase();
        return b === "INVESTIGATE" || b === "WATCHLIST" || b === "WATCHLIST_QUOTA";
      });
    }

    next = [...next].sort((a, b) => {
      const ar = a.risk_score ?? Number.NEGATIVE_INFINITY;
      const br = b.risk_score ?? Number.NEGATIVE_INFINITY;
      return sortDescending ? br - ar : ar - br;
    });
    return next;
  }, [mode, rows, search, sortDescending]);

  const selectedReasons = parseReasons(selected?.info_susceptibility_reasons);
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
              Semi-live feed of suspicious trades from your insider-risk pipeline. Auto-refresh runs every {refreshSeconds}s.
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

          <div className="lg:col-span-4">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Band Filter</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode("INVESTIGATE_ONLY")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  mode === "INVESTIGATE_ONLY"
                    ? "border-rose-300 bg-rose-50 text-rose-800"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                INVESTIGATE only
              </button>
              <button
                type="button"
                onClick={() => setMode("WATCHLIST_PLUS")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  mode === "WATCHLIST_PLUS"
                    ? "border-amber-300 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                WATCHLIST+
              </button>
              <button
                type="button"
                onClick={() => setMode("INCLUDE_LOW")}
                className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                  mode === "INCLUDE_LOW"
                    ? "border-slate-400 bg-slate-100 text-slate-900"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Include LOW
              </button>
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  Top {option}
                </option>
              ))}
            </select>
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
        </div>

        <div className="mt-5 flex items-center gap-4 text-xs text-slate-600">
          <span>{loading ? "Loading..." : `${filteredRows.length} rows`}</span>
          <button
            type="button"
            onClick={() => setSortDescending((x) => !x)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1"
          >
            Sort risk: {sortDescending ? "Desc" : "Asc"}
          </button>
          {error ? <span className="font-medium text-rose-700">{error}</span> : null}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Band</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">Time to Resolution</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => (
                <tr
                  key={`${row.market_id || "na"}-${row.ts || "na"}-${idx}`}
                  onClick={() => setSelected(row)}
                  className="cursor-pointer border-t border-slate-100 hover:bg-emerald-50/50"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">{formatPercent(row.risk_score ?? null)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-1 text-xs font-medium ${bandColor(row.band)}`}>
                      {row.band || "LOW"}
                    </span>
                  </td>
                  <td className="px-4 py-3 uppercase text-slate-700">{row.platform || "--"}</td>
                  <td className="max-w-[520px] truncate px-4 py-3 text-slate-800">{row.market_title || "--"}</td>
                  <td className="px-4 py-3 text-slate-700">{formatHours(row.time_to_resolution_hours ?? null)}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-600">{formatDate(row.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {selected ? (
        <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-xl border-l border-slate-200 bg-white p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Trade Details</p>
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
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Risk Score</p><p className="font-semibold">{formatPercent(selected.risk_score ?? null)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Raw Risk</p><p className="font-semibold">{formatPercent(selected.raw_risk ?? null)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">p_informed</p><p className="font-semibold">{formatPercent(selected.p_informed ?? null)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Anomaly Score</p><p className="font-semibold">{formatPercent(selected.anomaly_score ?? null)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Info Susceptibility</p><p className="font-semibold">{formatPercent(selected.info_susceptibility_score ?? null)}</p></div>
            <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Band / Quota</p><p className="font-semibold">{selected.band || "LOW"} / {selected.quota_fill ?? 0}</p></div>
          </div>

          <div className="mt-4 rounded-lg border border-slate-200 p-3 text-sm">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Info Susceptibility Reasons</p>
            {selectedReasons.length === 0 ? (
              <p className="mt-2 text-slate-600">--</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                {selectedReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 space-y-1 text-sm text-slate-700">
            <p><span className="font-semibold">Platform:</span> {selected.platform || "--"}</p>
            <p><span className="font-semibold">Market ID:</span> <span className="font-mono text-xs">{selected.market_id || "--"}</span></p>
            <p><span className="font-semibold">Timestamp:</span> {formatDate(selected.ts)}</p>
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
