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
import { Loader2, FileText } from "lucide-react";

interface KalshiOrder {
  order_id: string;
  ticker: string;
  side: string;
  yes_price?: number;
  no_price?: number;
  remaining_count?: number;
  status?: string;
  created_time?: string | null;
}

interface GetOrdersResponse {
  orders: KalshiOrder[];
  cursor?: string;
}

export function KalshiOrdersTable({ refreshKey }: { refreshKey?: number }) {
  const [orders, setOrders] = useState<KalshiOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function fetchOrders() {
      try {
        const res = await fetch("/api/kalshi/orders");
        const data: GetOrdersResponse | { error?: string } = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError((data as { error?: string }).error ?? "Failed to fetch orders");
          setOrders([]);
          return;
        }
        setOrders((data as GetOrdersResponse).orders ?? []);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Request failed");
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchOrders();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 overflow-hidden bg-card/20 backdrop-blur-sm p-8 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm font-medium">Loading Kalshi orders...</span>
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
              <TableHead className="text-[10px] font-bold uppercase">Order ID</TableHead>
              <TableHead className="text-[10px] font-bold uppercase">Market</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-center">Side</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right">Price (c)</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right">Remaining</TableHead>
              <TableHead className="text-[10px] font-bold uppercase">Status</TableHead>
              <TableHead className="text-[10px] font-bold uppercase">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground text-sm py-8">
                  No orders
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.order_id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="font-mono text-[11px] text-muted-foreground truncate max-w-[120px]">
                    {order.order_id}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] truncate max-w-[140px]">
                    {order.ticker}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={
                        order.side === "yes"
                          ? "text-[9px] border-green-500/30 text-green-500 bg-green-500/5"
                          : "text-[9px] border-red-500/30 text-red-500 bg-red-500/5"
                      }
                    >
                      {order.side?.toUpperCase() ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px]">
                    {order.yes_price != null ? order.yes_price : order.no_price ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[11px]">
                    {order.remaining_count ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[9px]">
                      {order.status ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {order.created_time
                      ? format(new Date(order.created_time), "yyyy-MM-dd HH:mm")
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
