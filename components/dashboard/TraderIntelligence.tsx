"use client"

import React from 'react';
import { TraderProfile } from '@/lib/data-generator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { User, Target, BarChart, Zap, History, AlertTriangle, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TraderIntelligenceProps {
  profile: TraderProfile;
  onClose: () => void;
}

export function TraderIntelligence({ profile, onClose }: TraderIntelligenceProps) {
  const isHighRisk = profile.riskContribution > 60;

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-xl shadow-2xl h-full flex flex-col overflow-hidden">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${isHighRisk ? 'bg-destructive/20' : 'bg-primary/20'}`}>
              <User className={isHighRisk ? 'text-destructive w-6 h-6' : 'text-primary w-6 h-6'} />
            </div>
            <div>
              <CardTitle className="text-xl font-bold font-headline">{profile.traderId}</CardTitle>
              <div className="flex gap-2 mt-1">
                <Badge variant="secondary" className="text-[10px] uppercase">Tier 1 Liquidity</Badge>
                {isHighRisk && (
                  <Badge variant="destructive" className="text-[10px] uppercase animate-pulse">High Asymmetry Risk</Badge>
                )}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Risk Profile & Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Information Asymmetry Score</h3>
              <span className={`text-sm font-bold font-mono ${isHighRisk ? 'text-destructive' : 'text-primary'}`}>
                {profile.riskContribution}/100
              </span>
            </div>
            <Progress value={profile.riskContribution} className="h-2" />
            
            <div className={`p-4 rounded-xl border ${isHighRisk ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/10 border-border/50'}`}>
              <h4 className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Behavioral Summary</h4>
              <p className="text-xs text-muted-foreground leading-relaxed italic">
                "{profile.behaviorSummary}"
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Why This Profile Is Flagged</h3>
            <div className="space-y-2">
              {profile.flagReasons.length > 0 ? (
                profile.flagReasons.map((reason, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-card/50 border border-border/30">
                    <AlertTriangle size={12} className="text-destructive shrink-0 mt-0.5" />
                    <span className="text-[11px] text-muted-foreground leading-tight">{reason}</span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-muted-foreground italic">No elevated risk patterns detected for this profile based on historical baselines.</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1">
              <History size={10} /> Total Trades
            </span>
            <p className="text-lg font-bold font-mono">{profile.totalTrades}</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1">
              <Target size={10} /> Event win Rate
            </span>
            <p className={`text-lg font-bold font-mono ${profile.winRate > 60 ? 'text-green-500' : ''}`}>{profile.winRate}%</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1">
              <BarChart size={10} /> Avg Pos. Size
            </span>
            <p className="text-lg font-bold font-mono">${profile.avgSize.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest flex items-center gap-1">
              <Zap size={10} /> Pre-Event Ratio
            </span>
            <p className={`text-lg font-bold font-mono ${profile.preEventRatio > 40 ? 'text-destructive' : ''}`}>{profile.preEventRatio}%</p>
          </div>
        </div>

        {/* Trade Sequence Visualization */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Pre-Event Accumulation Sequence</h3>
          <div className="relative pt-6 pb-2 px-4">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-border/50 -translate-y-1/2" />
            <div className="flex justify-between items-center relative z-10">
              {profile.trades.filter(t => t.isAnomaly).slice(0, 3).map((trade, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-destructive flex items-center justify-center text-[10px] font-bold shadow-[0_0_15px_rgba(239,68,68,0.4)]">
                    T{i+1}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono">{trade.relativeTimeStr}</div>
                </div>
              ))}
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                  <Clock size={16} />
                </div>
                <div className="text-[9px] text-primary font-bold">ANNOUNCEMENT</div>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-center text-muted-foreground italic mt-2">
            Sequence Analysis: 3-step directional accumulation detected in a 6-minute pre-disclosure window.
          </p>
        </div>

        {/* Behavioral Timeline */}
        <div className="space-y-4 pt-4 border-t border-border/50">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent Behavioral Sequencing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.trades.slice(0, 6).map((trade, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${trade.isAnomaly ? 'bg-destructive/10 border-destructive/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'bg-muted/10 border-border/50'}`}>
                <div className={`w-2 h-2 rounded-full ${trade.direction === 'Yes' ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold">{trade.direction} Entry @ ${trade.price}</span>
                    <Badge variant={trade.isAnomaly ? "destructive" : "secondary"} className="text-[8px] h-3.5">
                      {trade.isAnomaly ? "ASPECT DETECTED" : "NOMINAL"}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-muted-foreground font-mono">Size: {trade.size} contracts</span>
                    <span className="text-[10px] text-muted-foreground">{trade.relativeTimeStr}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
