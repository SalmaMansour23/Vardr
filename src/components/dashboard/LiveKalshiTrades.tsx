"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const INITIAL_FETCH_LIMIT = 200;
const MAX_TRADES = 500;
const NEW_HIGHLIGHT_MS = 2000;
const STREAM_BATCH_MS = 32;
const RECONNECT_DELAY_MS = 2000;
const CONNECTION_TIMEOUT_MS = 15000;
const MAX_RECONNECT_ATTEMPTS = 10;

export interface KalshiPublicTrade {
  trade_id: string;
  ticker: string;
  yes_price?: number;
  no_price?: number;
  count?: number;
  taker_side?: "yes" | "no";
  created_time?: string;
}

function fmtTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function tradePrice(t: KalshiPublicTrade): number {
  return t.taker_side === "yes" ? (t.yes_price ?? 0) : (t.no_price ?? 0);
}

function tradeValueCents(t: KalshiPublicTrade): number {
  return tradePrice(t) * (t.count ?? 0);
}

function fmtDollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface LiveKalshiTradesProps {
  ticker: string;
  marketName?: string;
}

export function LiveKalshiTrades({ ticker, marketName }: LiveKalshiTradesProps) {
  const [trades, setTrades] = useState<KalshiPublicTrade[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [spinning, setSpinning] = useState(false);
  const [streamConnected, setStreamConnected] = useState(false);
  const knownIds = useRef<Set<string>>(new Set());
  const streamBufferRef = useRef<KalshiPublicTrade[]>([]);
  const streamFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamEsRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectionOpenedRef = useRef(false);
  const retryCountRef = useRef(0);
  const mountedRef = useRef(true);

  const addTrades = useCallback((incoming: KalshiPublicTrade[]) => {
    const fresh = incoming.filter((t) => !knownIds.current.has(t.trade_id));
    fresh.forEach((t) => knownIds.current.add(t.trade_id));
    if (fresh.length > 0) {
      setNewIds((prev) => {
        const next = new Set(prev);
        fresh.forEach((t) => next.add(t.trade_id));
        return next;
      });
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          fresh.forEach((t) => next.delete(t.trade_id));
          return next;
        });
      }, NEW_HIGHLIGHT_MS);
    }
    setTrades((prev) => {
      const byId = new Map(prev.map((t) => [t.trade_id, t]));
      [...incoming].forEach((t) => byId.set(t.trade_id, t));
      const merged = Array.from(byId.values()).sort((a, b) =>
        (b.created_time ?? "").localeCompare(a.created_time ?? "")
      );
      return merged.slice(0, MAX_TRADES);
    });
    setError(null);
  }, []);

  const fetchInitial = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams();
      params.set("limit", String(INITIAL_FETCH_LIMIT));
      if (ticker) params.set("ticker", ticker);
      const res = await fetch(`/api/kalshi/trades?${params.toString()}`, {
        cache: "no-store",
      });
      const contentType = res.headers.get("content-type") ?? "";
      const raw = await res.text();
      if (!contentType.includes("application/json")) {
        setError("Server returned an invalid response. Check that the API route is available.");
        setTrades([]);
        return;
      }
      let data: { trades?: KalshiPublicTrade[]; error?: string };
      try {
        data = JSON.parse(raw) as { trades?: KalshiPublicTrade[]; error?: string };
      } catch {
        setError("Invalid response from server.");
        setTrades([]);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Failed to fetch trades");
        setTrades([]);
        return;
      }
      const list: KalshiPublicTrade[] = data.trades ?? [];
      knownIds.current = new Set(list.map((t) => t.trade_id));
      setTrades(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setTrades([]);
    }
  }, [ticker]);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  useEffect(() => {
    mountedRef.current = true;
    const streamUrl = ticker
      ? `/api/kalshi/trades/stream?ticker=${encodeURIComponent(ticker)}`
      : "/api/kalshi/trades/stream";

    const flushStreamBuffer = () => {
      streamFlushRef.current = null;
      const buf = streamBufferRef.current;
      if (buf.length > 0) {
        streamBufferRef.current = [];
        addTrades(buf);
      }
    };

    const tryReconnect = () => {
      if (!mountedRef.current || retryCountRef.current >= MAX_RECONNECT_ATTEMPTS) return;
      retryCountRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;
        if (!mountedRef.current) return;
        connect();
      }, RECONNECT_DELAY_MS);
    };

    const connect = () => {
      if (streamEsRef.current) {
        streamEsRef.current.close();
        streamEsRef.current = null;
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      connectionOpenedRef.current = false;
      const es = new EventSource(streamUrl);
      streamEsRef.current = es;

      connectionTimeoutRef.current = setTimeout(() => {
        connectionTimeoutRef.current = null;
        if (connectionOpenedRef.current) return;
        es.close();
        streamEsRef.current = null;
        setStreamConnected(false);
        tryReconnect();
      }, CONNECTION_TIMEOUT_MS);

      es.onopen = () => {
        connectionOpenedRef.current = true;
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        retryCountRef.current = 0;
        setStreamConnected(true);
      };

      es.onerror = () => {
        setStreamConnected(false);
        es.close();
        streamEsRef.current = null;
        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
          connectionTimeoutRef.current = null;
        }
        tryReconnect();
      };

      es.onmessage = (event) => {
        try {
          const raw = event.data;
          if (typeof raw !== "string" || raw.trim().startsWith("<")) return;
          const t = JSON.parse(raw) as KalshiPublicTrade;
          if (!t?.trade_id) return;
          streamBufferRef.current.push(t);
          if (streamFlushRef.current === null) {
            streamFlushRef.current = setTimeout(flushStreamBuffer, STREAM_BATCH_MS);
          }
        } catch {
          // ignore malformed stream message
        }
      };
    };

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current !== null) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (connectionTimeoutRef.current !== null) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      if (streamFlushRef.current !== null) {
        clearTimeout(streamFlushRef.current);
        streamFlushRef.current = null;
      }
      streamBufferRef.current = [];
      if (streamEsRef.current) {
        streamEsRef.current.close();
        streamEsRef.current = null;
      }
      retryCountRef.current = 0;
      setStreamConnected(false);
    };
  }, [addTrades, ticker]);

  const handleRefresh = useCallback(async () => {
    setSpinning(true);
    await fetchInitial();
    setSpinning(false);
  }, [fetchInitial]);

  const displayedTrades = ticker
    ? trades.filter((t) => t.ticker === ticker)
    : trades;
  const yesCount = displayedTrades.filter((t) => t.taker_side === "yes").length;
  const noCount = displayedTrades.filter((t) => t.taker_side === "no").length;
  const totalCents = displayedTrades.reduce(
    (s, t) => s + tradeValueCents(t),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          Real-time Kalshi trades
          {marketName && (
            <span className="text-foreground font-normal normal-case">
              ({marketName})
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                streamConnected
                  ? "bg-green-500 animate-pulse"
                  : "bg-muted-foreground"
              }`}
            />
            <span
              className={`text-[10px] font-bold uppercase tracking-widest ${
                streamConnected ? "text-green-500" : "text-muted-foreground"
              }`}
            >
              {streamConnected ? "LIVE" : "Connecting…"}
            </span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md border border-border/50 hover:border-border"
          >
            <RefreshCw size={12} className={spinning ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2 text-[11px] text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-border/50 overflow-hidden bg-card/20 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-[10px] font-bold uppercase">
                Time
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase">
                Trade ID
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-center">
                Side
              </TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right">
                Value
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedTrades.length === 0 && !error && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="h-24 text-center text-[11px] text-muted-foreground"
                >
                  {ticker
                    ? "No trades for this market yet. Trades will appear here in real time."
                    : "Select a contract with a Kalshi ticker to see live trades, or add tickers in src/lib/data-generator.ts (CONTRACT_KALSHI_TICKERS)."}
                </TableCell>
              </TableRow>
            )}
            {displayedTrades.map((trade) => {
              const isNew = newIds.has(trade.trade_id);
              const isYes = trade.taker_side === "yes";
              const valueCents = tradeValueCents(trade);
              const qty = trade.count ?? 0;
              const rowClass = [
                "group hover:bg-muted/20 transition-colors",
                isNew &&
                  (isYes ? "fill-new-yes-violet" : "fill-new-no"),
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <TableRow key={trade.trade_id} className={rowClass}>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {fmtTime(trade.created_time)}
                  </TableCell>
                  <TableCell
                    className="text-[11px] font-mono truncate max-w-[200px]"
                    title={trade.trade_id}
                  >
                    {trade.trade_id}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`text-[11px] font-bold tabular-nums ${
                        isYes ? "text-violet-400" : "text-red-400"
                      }`}
                    >
                      {isYes ? "YES" : "NO"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px] font-bold tabular-nums">
                    {valueCents > 0 ? (
                      <>
                        <span
                          className={
                            isYes ? "text-violet-400" : "text-red-400"
                          }
                        >
                          {fmtDollars(valueCents)}
                        </span>
                        {qty > 0 && (
                          <span className="text-[10px] font-normal text-muted-foreground ml-1">
                            x{qty}
                          </span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <div className="border-t border-border bg-muted/30 px-4 h-9 flex items-center gap-6 text-[10px] text-muted-foreground">
          <span>
            <strong className="text-foreground font-mono">
              {displayedTrades.length}
            </strong>{" "}
            trades
            {ticker ? " (this market)" : ""}
          </span>
          <span>
            YES <strong className="text-violet-400 font-mono">{yesCount}</strong>
            <span className="mx-1">|</span>
            NO <strong className="text-red-400 font-mono">{noCount}</strong>
          </span>
          <span>
            Total{" "}
            <strong className="text-foreground font-mono">
              {fmtDollars(totalCents)}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}
