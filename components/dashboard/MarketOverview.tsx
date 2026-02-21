"use client"

import React from 'react';
import { Contract } from '@/lib/data-generator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Activity, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MarketOverviewProps {
  contracts: Contract[];
}

export function MarketOverview({ contracts }: MarketOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-primary/20 rounded-lg"><Activity className="text-primary" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Active Surveillance</p>
              <p className="text-xl font-bold font-mono">14 Markets</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-destructive/20 rounded-lg"><AlertTriangle className="text-destructive" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Critical Anomalies</p>
              <p className="text-xl font-bold font-mono text-destructive">02 Detected</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-accent/5 border-accent/20">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-accent/20 rounded-lg"><Shield className="text-accent" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Network Integrity</p>
              <p className="text-xl font-bold font-mono text-accent">98.4%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-2xl border border-border/50 overflow-hidden bg-card/20 backdrop-blur-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-[10px] font-bold uppercase">Contract Identifier</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-right">Price</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-center">Risk Score</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-center">Pre-Event Vol %</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-center">Lead-Lag</TableHead>
              <TableHead className="text-[10px] font-bold uppercase text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-bold text-sm">{c.name}</TableCell>
                <TableCell className="text-right font-mono text-sm">${c.currentPrice.toFixed(2)}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={c.riskScore > 60 ? 'destructive' : 'outline'} className="font-mono">
                    {c.riskScore}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <span className={`font-mono font-bold ${c.preEventVolumePct > 40 ? 'text-destructive' : ''}`}>
                    {c.preEventVolumePct}%
                  </span>
                </TableCell>
                <TableCell className="text-center">
                  {c.hasLeadLag ? (
                    <Badge variant="outline" className="text-[9px] border-accent/50 text-accent gap-1">
                      <Zap size={8} /> DETECTED
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Normal</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {c.riskScore > 60 ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                      <span className="text-[10px] font-bold text-red-500 uppercase">Suspicious</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-[10px] font-bold text-green-500 uppercase">Clear</span>
                    </div>
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
