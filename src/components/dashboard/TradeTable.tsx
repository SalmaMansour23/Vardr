"use client"

import React, { useState } from 'react';
import { Trade } from '@/lib/data-generator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, User, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface TradeTableProps {
  trades: Trade[];
  onTraderClick: (traderId: string) => void;
  announcementTime: number;
}

export function TradeTable({ trades, onTraderClick, announcementTime }: TradeTableProps) {
  const [filter, setFilter] = useState<'all' | 'pre-event' | 'suspicious'>('all');

  const filteredTrades = trades.filter(t => {
    if (filter === 'suspicious') return t.isAnomaly;
    if (filter === 'pre-event') return t.timestamp < announcementTime;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Clock size={16} /> Market Execution Audit
        </h2>
        <div className="flex gap-2">
          <Badge 
            variant={filter === 'all' ? 'default' : 'outline'} 
            className="cursor-pointer uppercase text-[9px] px-3 py-1"
            onClick={() => setFilter('all')}
          >
            All Trades
          </Badge>
          <Badge 
            variant={filter === 'pre-event' ? 'secondary' : 'outline'} 
            className="cursor-pointer uppercase text-[9px] px-3 py-1"
            onClick={() => setFilter('pre-event')}
          >
            Pre-Event Only
          </Badge>
          <Badge 
            variant={filter === 'suspicious' ? 'destructive' : 'outline'} 
            className="cursor-pointer uppercase text-[9px] px-3 py-1"
            onClick={() => setFilter('suspicious')}
          >
            Asymmetry Risk
          </Badge>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 overflow-hidden bg-card/20 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-[10px] font-bold uppercase">Timestamp</TableHead>
              <TableHead className="text-[10px] font-bold uppercase">Trader ID</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-center">Direction</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right">Price</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right">Size</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right">Relative Timing</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTrades.map((trade) => (
              <TableRow key={trade.tradeId} className="group hover:bg-muted/20 transition-colors">
                <TableCell className="font-mono text-[11px] text-muted-foreground">
                  {format(trade.timestamp, 'HH:mm:ss')}
                </TableCell>
                <TableCell>
                  <button 
                    onClick={() => onTraderClick(trade.traderId)}
                    className={`flex items-center gap-1.5 text-[11px] font-bold hover:underline ${trade.traderId === 'Trader_Atlas' && trade.isAnomaly ? 'text-destructive' : 'text-primary'}`}
                  >
                    <User size={10} />
                    {trade.traderId}
                  </button>
                </TableCell>
                <TableCell className="text-center">
                  {trade.direction === 'Yes' ? (
                    <Badge variant="outline" className="text-[9px] border-green-500/30 text-green-500 bg-green-500/5">YES</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-500 bg-red-500/5">NO</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-[11px]">
                  ${trade.price.toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono text-[11px] font-bold">
                  {trade.size.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-[11px]">
                  <span className={trade.timestamp < announcementTime ? 'text-amber-500 font-bold' : 'text-muted-foreground'}>
                    {trade.relativeTimeStr}
                  </span>
                </TableCell>
                <TableCell className="flex justify-center items-center h-full pt-4">
                  {trade.isAnomaly ? (
                    <Badge variant="destructive" className="text-[8px] h-4 gap-1 px-1.5">
                      <AlertCircle size={8} /> RISK
                    </Badge>
                  ) : (
                    <span className="text-[9px] text-muted-foreground opacity-30">Nominal</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
