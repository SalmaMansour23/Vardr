"use client"

import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Contract } from '@/lib/data-generator';
import { ShieldAlert, TrendingUp, BarChart3, Users, Clock, Layers, Zap, MessageSquare } from 'lucide-react';

interface AnomalyBreakdownProps {
  analysis: Contract;
}

export function AnomalyBreakdown({ analysis }: AnomalyBreakdownProps) {
  const risk = analysis.riskScore;
  
  const metrics = [
    { label: 'Drift Deviation', value: analysis.driftDeviationScore || 0, icon: TrendingUp },
    { label: 'Order Imbalance', value: analysis.imbalanceScore || 0, icon: BarChart3 },
    { label: 'Volume Spike', value: analysis.volumeSpikeScore || 0, icon: ShieldAlert },
    { label: 'Sequence pattern', value: analysis.sequencePatternScore || 0, icon: Layers },
    { label: 'Pre-Event Conc.', value: analysis.preEventConcentrationScore || 0, icon: Clock },
    { label: 'Cross-Event Align.', value: analysis.crossEventAlignmentScore || 0, icon: Users },
    { label: 'Lead-Lag Signal', value: analysis.leadLagScore || 0, icon: Zap },
    { label: 'Social Sentiment', value: analysis.socialSentimentDivergenceScore || 0, icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Integrity Risk Decomposition</h3>
      <div className="grid gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="space-y-1.5">
            <div className="flex justify-between items-center text-[10px]">
              <div className="flex items-center gap-2 text-muted-foreground font-bold uppercase">
                <m.icon size={11} className={m.value > 60 ? 'text-destructive' : 'text-primary'} />
                <span>{m.label}</span>
              </div>
              <span className={`font-mono font-bold ${m.value > 60 ? 'text-destructive' : ''}`}>{m.value}%</span>
            </div>
            <Progress value={m.value} className="h-1" />
          </div>
        ))}
      </div>
      
      <div className="mt-8 p-4 rounded-xl bg-muted/30 border border-border/50">
        <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-2">Surveillance Insight</h4>
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed italic">
          {risk > 60 
            ? "High Information Asymmetry Detected. Abnormal drift correlated with coordinated accumulation in the pre-event window. Lead-lag signal confirms CPI market moving ahead of Treasury benchmarks."
            : "Market parameters within nominal statistical bands. No coordinated pre-disclosure signaling detected across active trade sequences."}
        </p>
      </div>
    </div>
  );
}