"use client";

import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Loader2, CheckCircle } from "lucide-react";

interface KalshiFill {
  fill_id: string;
  ticker?: string;
  market_ticker?: string;
  side?: string;
  yes_price?: number;
  no_price?: number;
  count?: number;
  created_time?: string;
}

interface GetFillsResponse {
  fills: KalshiFill[];
  cursor?: string;
}

export function KalshiFillsTable({ refreshKey }: { refreshKey?: number }) {
  const [fills, setFills] = useState<KalshiFill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function fetchFills() {
      try {
        const res = await fetch("/api/kalshi/fills");
        const data: GetFillsResponse | { error?: string } = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError((data as { error?: string }).error ?? "Failed to fetch fills");
          setFills([]);
          return;
        }
        setFills((data as GetFillsResponse).fills ?? []);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Request failed");
          setFills([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchFills();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 overflow-hidden bg-card/20 backdrop-blur-sm p-8 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm font-medium">Loading Kalshi fills...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border/50 overflow-hidden bg-card/20 backdrop-blur-sm p-6">
        <p className="text-sm text-destructive font-medium">{error}</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Ensure API_KEY and private key are set in .env for the server.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-card/20 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-[10px] font-bold uppercase">Fill ID</TableHead>
              <TableHead className="text-[10px] font-bold uppercase">Market</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-center">Side</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right">Price (c)</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right">Count</TableHead>
              <TableHead className="text-[10px] font-bold uppercase">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fills.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">
                  No fills
                </TableCell>
              </TableRow>
            ) : (
              fills.map((fill) => (
                <TableRow key={fill.fill_id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-mono text-[11px] text-muted-foreground truncate max-w-[120px]">
                    {fill.fill_id}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] truncate max-w-[140px]">
                    {fill.ticker ?? fill.market_ticker ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={
                        fill.side === "yes"
                          ? "text-[9px] border-green-500/30 text-green-500 bg-green-500/5"
                          : "text-[9px] border-red-500/30 text-red-500 bg-red-500/5"
                      }
                    >
                      {fill.side?.toUpperCase() ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px]">
                    {fill.yes_price != null ? fill.yes_price : fill.no_price ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px]">
                    {fill.count ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {fill.created_time
                      ? format(new Date(fill.created_time), "yyyy-MM-dd HH:mm")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
    </div>
  );
}
