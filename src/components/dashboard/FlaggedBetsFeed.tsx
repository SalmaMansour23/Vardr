"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCcw, Copy } from "lucide-react";

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

type SuspiciousRow = {
  ts?: string;
  latest_ts?: string;
  platform?: string;
  market_id?: string;
  market_title?: string;
  current_price?: number | null;
  price_change_1h?: number | null;
  price_change_24h?: number | null;
  recent_volume?: number | null;
  leader_score?: number | null;
  _file_updated_at?: string;
};

const WINDOW_OPTIONS: Array<{ key: WindowKey; label: string }> = [
  { key: "24h", label: "24H" },
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
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

function parseEnvInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function formatPercent(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  return `${(v * 100).toFixed(2)}%`;
}

function formatSignedPercent(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(2)}pp`;
}

function formatAmount(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "--";
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDate(v: string | undefined): string {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.valueOf())) return v;
  return d.toLocaleString();
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
    u.searchParams.set("leader_score", String(row.leader_score ?? ""));
    return u.toString();
  } catch {
    return null;
  }
}

export function FlaggedBetsFeed() {
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  const aiIntelBaseUrl = "/agents";
  const refreshSeconds = parseEnvInt(
    process.env.NEXT_PUBLIC_REFRESH_SECONDS || process.env.REFRESH_SECONDS,
    60,
  );

  const [windowKey, setWindowKey] = useState<WindowKey>("24h");
  const [visibleCount, setVisibleCount] = useState(DEFAULT_VISIBLE_COUNT);
  const [search, setSearch] = useState("");
  const [minLeaderScore, setMinLeaderScore] = useState("");
  const [minRecentVolume, setMinRecentVolume] = useState("");
  const [dedupeTitles, setDedupeTitles] = useState(false);

  const [rows, setRows] = useState<SuspiciousRow[]>([]);
  const [selected, setSelected] = useState<SuspiciousRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");

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
      const marketRows = Array.isArray(payload)
        ? payload
        : (payload as { data?: unknown })?.data;
      if (!Array.isArray(marketRows)) {
        throw new Error("API response was not an array.");
      }
      const typed = marketRows as SuspiciousRow[];
      setRows(typed);
      setLastUpdated(typed[0]?._file_updated_at || new Date().toISOString());
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Failed to load suspicious feed.");
      setLastUpdated(new Date().toISOString());
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, windowKey]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    setVisibleCount(DEFAULT_VISIBLE_COUNT);
  }, [dedupeTitles, minLeaderScore, minRecentVolume, search, windowKey]);

  useEffect(() => {
    const ms = Math.max(10, refreshSeconds) * 1000;
    const timer = setInterval(() => {
      loadRows();
    }, ms);
    return () => clearInterval(timer);
  }, [loadRows, refreshSeconds]);

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
                  Vardr ranks leader markets by recent price movement weighted by market activity.
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

            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search market title"
                className="md:col-span-2"
              />
              <Input
                value={minLeaderScore}
                onChange={(e) => setMinLeaderScore(e.target.value)}
                placeholder="Min leader score"
                inputMode="decimal"
              />
              <Input
                value={minRecentVolume}
                onChange={(e) => setMinRecentVolume(e.target.value)}
                placeholder="Min recent volume"
                inputMode="decimal"
              />
              <label className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={dedupeTitles}
                  onChange={(e) => setDedupeTitles(e.target.checked)}
                  className="h-4 w-4"
                />
                Dedupe titles
              </label>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{loading ? "Loading..." : `${visibleRows.length} of ${filteredRows.length} rows`}</span>
              {error ? <span className="text-destructive">{error}</span> : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <div className="overflow-x-auto rounded-xl border border-border/40">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-card/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Market</th>
                  <th className="px-3 py-2">Current Price</th>
                  <th className="px-3 py-2">1H Change</th>
                  <th className="px-3 py-2">24H Change</th>
                  <th className="px-3 py-2">Recent Volume</th>
                  <th className="px-3 py-2">Platform</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, idx) => (
                  <tr
                    key={`${row.market_id || "na"}-${row.ts || row.latest_ts || "na"}-${idx}`}
                    className="cursor-pointer border-t border-border/30 hover:bg-primary/5"
                    onClick={() => setSelected(row)}
                  >
                    <td className="max-w-[520px] truncate px-3 py-2">{row.market_title || "--"}</td>
                    <td className="px-3 py-2 font-semibold">{formatPercent(row.current_price)}</td>
                    <td className="px-3 py-2 font-semibold">{formatSignedPercent(row.price_change_1h)}</td>
                    <td className="px-3 py-2 font-semibold">{formatSignedPercent(row.price_change_24h)}</td>
                    <td className="px-3 py-2 font-mono">{formatAmount(row.recent_volume)}</td>
                    <td className="px-3 py-2 uppercase text-xs">{row.platform || "--"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {visibleCount < filteredRows.length ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((count) => count + SHOW_MORE_INCREMENT)}
              >
                Show more
              </Button>
            </div>
          ) : null}
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
                <div><span className="text-muted-foreground">current_price:</span> {formatPercent(selected.current_price)}</div>
                <div><span className="text-muted-foreground">price_change_1h:</span> {formatSignedPercent(selected.price_change_1h)}</div>
                <div><span className="text-muted-foreground">price_change_24h:</span> {formatSignedPercent(selected.price_change_24h)}</div>
                <div><span className="text-muted-foreground">recent_volume:</span> {formatAmount(selected.recent_volume)}</div>
                <div><span className="text-muted-foreground">leader_score:</span> {formatAmount(selected.leader_score)}</div>
                <div><span className="text-muted-foreground">platform:</span> {selected.platform || "--"}</div>
                <div><span className="text-muted-foreground">market_id:</span> {selected.market_id || "--"}</div>
                <div><span className="text-muted-foreground">timestamp:</span> {formatDate(selected.ts || selected.latest_ts)}</div>
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
