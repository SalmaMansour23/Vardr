"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCcw, Copy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";


type WindowKey = "24h" | "7d" | "30d";
type BandMode = "INVESTIGATE_ONLY" | "WATCHLIST_PLUS" | "INCLUDE_LOW";
type ApiBand = "INVESTIGATE" | "WATCHLIST" | "ALL";

type SuspiciousRow = {
  ts?: string;
  platform?: string;
  market_id?: string;
  market_title?: string;
  risk_score?: number | null;
  raw_risk?: number | null;
  anomaly_score?: number | null;
  p_informed?: number | null;
  info_susceptibility_score?: number | null;
  info_susceptibility_reasons?: string;
  info_susceptibility_bucket?: string;
  band?: string;
  quota_fill?: number | null;
  trade_size?: number | null;
  time_to_resolution_hours?: number | null;
  _file_updated_at?: string;
};

const WINDOW_OPTIONS: Array<{ key: WindowKey; label: string }> = [
  { key: "24h", label: "24H" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
];

const LIMIT_OPTIONS = [200, 500, 1000, 2000, 5000];

function parseEnvInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function toApiBand(mode: BandMode): ApiBand {
  if (mode === "INVESTIGATE_ONLY") return "INVESTIGATE";
  if (mode === "WATCHLIST_PLUS") return "WATCHLIST";
  return "ALL";
}

function formatPercent(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  return `${(v * 100).toFixed(2)}%`;
}

function formatDate(v: string | undefined): string {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.valueOf())) return v;
  return d.toLocaleString();
}

function formatAmount(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function parseReasons(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String);
    return [String(parsed)];
  } catch {
    return [raw];
  }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function buildPlatformUrl(row: SuspiciousRow): string | null {
  const platform = (row.platform || "").toLowerCase();
  const marketId = (row.market_id || "").trim();
  const title = (row.market_title || "").trim();

  if (platform === "kalshi") {
    if (!marketId) return null;
    return `https://kalshi.com/markets/${marketId.toLowerCase()}`;
  }

  if (platform === "polymarket") {
    if (marketId && !marketId.startsWith("0x") && marketId.includes("-")) {
      return `https://polymarket.com/event/${marketId}`;
    }
    if (title) {
      const slug = slugify(title);
      if (slug) return `https://polymarket.com/event/${slug}`;
    }
  }

  return null;
}

function buildAiIntelUrl(baseUrl: string, row: SuspiciousRow): string | null {
  const b = baseUrl.trim();
  if (!b) return null;
  try {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const u = new URL(b, origin);
    u.searchParams.set("platform", row.platform || "");
    u.searchParams.set("market_id", row.market_id || "");
    u.searchParams.set("title", row.market_title || "");
    u.searchParams.set("risk", String(row.risk_score ?? ""));
    return u.toString();
  } catch {
    return null;
  }
}

function matchesBandMode(row: SuspiciousRow, mode: BandMode): boolean {
  const band = (row.band || "LOW").toUpperCase();
  if (mode === "INVESTIGATE_ONLY") return band === "INVESTIGATE";
  if (mode === "WATCHLIST_PLUS") {
    return band === "INVESTIGATE" || band === "WATCHLIST" || band === "WATCHLIST_QUOTA";
  }
  return true;
}

export function FlaggedBetsFeed() {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  const aiIntelBaseUrl = "/agents";
  const refreshSeconds = parseEnvInt(
    process.env.NEXT_PUBLIC_REFRESH_SECONDS || process.env.REFRESH_SECONDS,
    60,
  );

  const [windowKey, setWindowKey] = useState<WindowKey>("24h");
  const [bandMode, setBandMode] = useState<BandMode>("WATCHLIST_PLUS");
  const [limit, setLimit] = useState<number>(200);
  const [search, setSearch] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [sortDesc, setSortDesc] = useState(true);

  const [rows, setRows] = useState<SuspiciousRow[]>([]);
  const [selected, setSelected] = useState<SuspiciousRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");

    const band = toApiBand(bandMode);
    const makeUrl = (base: string | null): string => {
      const params = new URLSearchParams();
      params.set("window", windowKey);
      params.set("band", band);
      params.set("limit", String(limit));
      if (base && base.trim()) {
        const u = new URL(`${base.replace(/\/$/, "")}/api/suspicious`);
        u.search = params.toString();
        return u.toString();
      }
      return `/api/suspicious?${params.toString()}`;
    };

    const requestUrls = apiBaseUrl ? [makeUrl(apiBaseUrl), makeUrl(null)] : [makeUrl(null)];

    try {
      let payload: unknown = null;
      let ok = false;
      let lastErr: Error | null = null;

      for (const requestUrl of requestUrls) {
        try {
          const res = await fetch(requestUrl, { cache: "no-store" });
          const parsed = await res.json();
          if (!res.ok) {
            throw new Error((parsed as { message?: string })?.message || `Failed request (${res.status})`);
          }
          payload = parsed;
          ok = true;
          break;
        } catch (err) {
          lastErr = err instanceof Error ? err : new Error("Failed to load suspicious feed.");
        }
      }

      if (!ok) {
        throw lastErr || new Error("Failed to load suspicious feed.");
      }
      if (!Array.isArray(payload)) {
        throw new Error("API response was not an array.");
      }
      const typed = payload as SuspiciousRow[];
      setRows(typed);
      setLastUpdated(typed[0]?._file_updated_at || new Date().toISOString());
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load suspicious feed.");
      setLastUpdated(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, bandMode, limit, windowKey]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    const ms = Math.max(10, refreshSeconds) * 1000;
    const timer = setInterval(() => {
      loadRows();
    }, ms);
    return () => clearInterval(timer);
  }, [loadRows, refreshSeconds]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = minAmount.trim() === "" ? null : Number(minAmount);
    const max = maxAmount.trim() === "" ? null : Number(maxAmount);

    let next = rows.filter((row) => matchesBandMode(row, bandMode));

    if (q) {
      next = next.filter((r) => (r.market_title || "").toLowerCase().includes(q));
    }

    if (min !== null && Number.isFinite(min)) {
      next = next.filter((r) => (r.trade_size ?? Number.NEGATIVE_INFINITY) >= min);
    }

    if (max !== null && Number.isFinite(max)) {
      next = next.filter((r) => (r.trade_size ?? Number.POSITIVE_INFINITY) <= max);
    }

    next = [...next].sort((a, b) => {
      const ar = a.risk_score ?? Number.NEGATIVE_INFINITY;
      const br = b.risk_score ?? Number.NEGATIVE_INFINITY;
      return sortDesc ? br - ar : ar - br;
    });

    return next;
  }, [rows, bandMode, search, minAmount, maxAmount, sortDesc]);

  const reasons = parseReasons(selected?.info_susceptibility_reasons);
  const marketUrl = selected ? buildPlatformUrl(selected) : null;
  const aiIntelUrl = selected ? buildAiIntelUrl(aiIntelBaseUrl, selected) : null;

  return (
    <div className="space-y-4">
      <Card className="border-border/50 bg-card/30 rounded-2xl overflow-hidden shadow-xl">
        <CardHeader className="pb-0">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Flagged Bets Feed</h3>
                <p className="text-[11px] text-muted-foreground">
                  Auto-refresh every {refreshSeconds}s. Last updated: {formatDate(lastUpdated)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Built with the proprietary Vardr Model, this is the first model that attempts to classify insider trading activity in Kalshi.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Vardr combines anomaly detection, informed-trader probability modeling, and context-aware plausibility scoring into a unified risk ranking for each trade.
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={loadRows}>
                <RefreshCcw size={14} /> Refresh
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {WINDOW_OPTIONS.map((opt) => (
                <Button
                  key={opt.key}
                  variant={windowKey === opt.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setWindowKey(opt.key)}
                >
                  {opt.label}
                </Button>
              ))}

              <Button
                variant={bandMode === "INVESTIGATE_ONLY" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setBandMode("INVESTIGATE_ONLY")}
              >
                INVESTIGATE only
              </Button>
              <Button
                variant={bandMode === "WATCHLIST_PLUS" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setBandMode("WATCHLIST_PLUS")}
              >
                WATCHLIST+
              </Button>
              <Button
                variant={bandMode === "INCLUDE_LOW" ? "default" : "outline"}
                size="sm"
                onClick={() => setBandMode("INCLUDE_LOW")}
              >
                Include LOW
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search market title"
                className="md:col-span-2"
              />
              <Input
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                placeholder="Min bet amount"
                inputMode="decimal"
              />
              <Input
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                placeholder="Max bet amount"
                inputMode="decimal"
              />
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {LIMIT_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    Top {n}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{loading ? "Loading..." : `${filteredRows.length} rows`}</span>
              <Button variant="ghost" size="sm" onClick={() => setSortDesc((v) => !v)}>
                Sort risk: {sortDesc ? "Desc" : "Asc"}
              </Button>
              {error ? <span className="text-destructive">{error}</span> : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="overflow-x-auto rounded-xl border border-border/40">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Risk Score</th>
                  <th className="px-3 py-2">Band</th>
                  <th className="px-3 py-2">Platform</th>
                  <th className="px-3 py-2">Market</th>
                  <th className="px-3 py-2">Bet Amount</th>
                  <th className="px-3 py-2">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr
                    key={`${row.market_id || "na"}-${row.ts || "na"}-${idx}`}
                    className="cursor-pointer border-t border-border/30 hover:bg-primary/5"
                    onClick={() => setSelected(row)}
                  >
                    <td className="px-3 py-2 font-semibold">{formatPercent(row.risk_score)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={(row.band || "").toUpperCase() === "INVESTIGATE" ? "destructive" : "outline"}>
                        {row.band || "LOW"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 uppercase text-xs">{row.platform || "--"}</td>
                    <td className="max-w-[380px] truncate px-3 py-2">{row.market_title || "--"}</td>
                    <td className="px-3 py-2 font-mono">{formatAmount(row.trade_size)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{formatDate(row.ts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => (!open ? setSelected(null) : undefined)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {selected ? (
            <div className="space-y-4">
              <SheetHeader>
                <SheetTitle className="text-base">{selected.market_title || "Untitled market"}</SheetTitle>
                <SheetDescription>
                  {(selected.platform || "--").toUpperCase()} | {selected.market_id || "--"}
                </SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">risk_score (final):</span> {formatPercent(selected.risk_score)}</div>
                <div><span className="text-muted-foreground">raw_risk:</span> {formatPercent(selected.raw_risk)}</div>
                <div><span className="text-muted-foreground">p_informed:</span> {formatPercent(selected.p_informed)}</div>
                <div><span className="text-muted-foreground">anomaly_score:</span> {formatPercent(selected.anomaly_score)}</div>
                <div><span className="text-muted-foreground">info_susceptibility_score:</span> {formatPercent(selected.info_susceptibility_score)}</div>
                <div><span className="text-muted-foreground">band:</span> {selected.band || "LOW"}</div>
                <div><span className="text-muted-foreground">quota_fill:</span> {selected.quota_fill ?? 0}</div>
                <div><span className="text-muted-foreground">market_id:</span> {selected.market_id || "--"}</div>
                <div><span className="text-muted-foreground">timestamp:</span> {formatDate(selected.ts)}</div>
                <div><span className="text-muted-foreground">bet_amount:</span> {formatAmount(selected.trade_size)}</div>
              </div>

              <div>
                <div className="text-xs uppercase font-bold tracking-wider text-muted-foreground mb-1">
                  info_susceptibility_reasons
                </div>
                {reasons.length ? (
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    {reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">--</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {marketUrl ? (
                  <a href={marketUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink size={14} /> Open on {(selected.platform || "market").toLowerCase() === "kalshi" ? "Kalshi" : "Polymarket"}
                    </Button>
                  </a>
                ) : null}

                {aiIntelUrl ? (
                  <a href={aiIntelUrl} target="_blank" rel="noreferrer">
                    <Button variant="secondary" size="sm" className="gap-2">
                      <ExternalLink size={14} /> Open AI intelligence tool (internal)
                    </Button>
                  </a>
                ) : null}

                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={async () => {
                    if (!selected.market_id) return;
                    try {
                      await navigator.clipboard.writeText(selected.market_id);
                    } catch {
                      // no-op
                    }
                  }}
                >
                  <Copy size={14} /> Copy market_id
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
