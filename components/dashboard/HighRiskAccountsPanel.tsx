'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ChevronRight, ShieldAlert, Info, X, TrendingUp, Clock, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AccountRiskProfile {
  account_id: string;
  risk_score: number;
  confidence: number;
  risk_category: string;
  pattern_type: string;
  evidence: string[];
  features: {
    temporal_alignment_score: number;
    position_concentration: number;
    timing_precision: number;
    cross_event_exposure: number;
    signal_correlation: number;
  };
  false_positive_probability: number;
  flagged_timestamp: string;
}

interface HighRiskAccountsPanelProps {
  accounts?: AccountRiskProfile[];
}

const DEMO_SCENARIO_DATE = '2026-04-10';

const MOCK_ACCOUNTS: AccountRiskProfile[] = [
  {
    account_id: 'ACC-2847-ALPHA',
    risk_score: 87.3,
    confidence: 92,
    risk_category: 'Critical Risk',
    pattern_type: 'Pre-Announcement Positioning',
    evidence: [
      'Trades executed consistently 15-20 minutes before public signal emergence',
      'Position concentration of 84% within 2-hour pre-drift window',
      'Timing precision coefficient of variation: 0.08 (highly systematic)',
      'Strong correlation (0.91) with subsequent market movement direction',
      'Cross-event exposure across 3 related Fed policy announcements'
    ],
    features: {
      temporal_alignment_score: 89.2,
      position_concentration: 84.1,
      timing_precision: 91.7,
      cross_event_exposure: 73.5,
      signal_correlation: 78.9
    },
    false_positive_probability: 8,
    flagged_timestamp: `${DEMO_SCENARIO_DATE}T09:15:00Z`
  },
  {
    account_id: 'ACC-1593-GAMMA',
    risk_score: 76.8,
    confidence: 85,
    risk_category: 'High Risk',
    pattern_type: 'Information Arbitrage',
    evidence: [
      'Systematic entry immediately following unverified social media signals',
      'Position sizes correlate with signal classification confidence (r=0.87)',
      'No comparable activity detected during control periods without leaks',
      'Trading volume spikes align with 67% of high-risk public signals',
      'Demonstrated knowledge of non-public drift timing windows'
    ],
    features: {
      temporal_alignment_score: 81.4,
      position_concentration: 72.3,
      timing_precision: 68.9,
      cross_event_exposure: 79.2,
      signal_correlation: 82.1
    },
    false_positive_probability: 15,
    flagged_timestamp: `${DEMO_SCENARIO_DATE}T08:47:00Z`
  },
  {
    account_id: 'ACC-4219-DELTA',
    risk_score: 68.5,
    confidence: 78,
    risk_category: 'High Risk',
    pattern_type: 'Coordinated Network Activity',
    evidence: [
      'Trading patterns synchronized with 2 other flagged accounts (temporal offset <5min)',
      'Shared information flow topology detected via causal graph analysis',
      'Aggregate position building across linked accounts totals $2.1M',
      'Network exhibits hub-and-spoke communication structure',
      'Timing correlation with external information sources: 0.74'
    ],
    features: {
      temporal_alignment_score: 73.6,
      position_concentration: 65.8,
      timing_precision: 70.2,
      cross_event_exposure: 68.9,
      signal_correlation: 63.7
    },
    false_positive_probability: 22,
    flagged_timestamp: `${DEMO_SCENARIO_DATE}T08:52:00Z`
  },
  {
    account_id: 'ACC-7831-THETA',
    risk_score: 62.1,
    confidence: 71,
    risk_category: 'Moderate Risk',
    pattern_type: 'Suspicious Timing Pattern',
    evidence: [
      'Unusual clustering of trades in 45-minute window before announcement',
      'Historical pattern analysis shows 3 similar instances in past 180 days',
      'Position sizing inconsistent with account\'s typical trading behavior',
      'Entry timing coincides with period of elevated information asymmetry',
      'Partial alignment with adversarial strategy simulation (68% match)'
    ],
    features: {
      temporal_alignment_score: 64.3,
      position_concentration: 58.9,
      timing_precision: 61.7,
      cross_event_exposure: 65.4,
      signal_correlation: 60.2
    },
    false_positive_probability: 29,
    flagged_timestamp: `${DEMO_SCENARIO_DATE}T08:39:00Z`
  }
];

const getRiskColor = (score: number) => {
  if (score >= 80) return 'text-red-500';
  if (score >= 60) return 'text-orange-500';
  if (score >= 40) return 'text-yellow-500';
  return 'text-green-500';
};

const getRiskBadgeVariant = (category: string): "default" | "destructive" | "secondary" | "outline" => {
  if (category.includes('Critical')) return 'destructive';
  if (category.includes('High')) return 'destructive';
  if (category.includes('Moderate')) return 'default';
  return 'secondary';
};

export function HighRiskAccountsPanel({ accounts = MOCK_ACCOUNTS }: HighRiskAccountsPanelProps) {
  const [selectedAccount, setSelectedAccount] = useState<AccountRiskProfile | null>(null);

  return (
    <>
      <Card className="border-border/50 bg-card/30 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-border/50 bg-gradient-to-r from-destructive/10 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-destructive/20 p-2 rounded-lg">
                <ShieldAlert className="text-destructive w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider">High-Risk Accounts</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Real-time behavioral anomaly detection • {accounts.length} flagged
                </p>
              </div>
            </div>
            <Badge variant="destructive" className="text-[9px] uppercase font-bold px-3 py-1">
              <AlertTriangle size={10} className="mr-1" />
              Active Monitoring
            </Badge>
          </div>
        </div>

        <CardContent className="p-0">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-muted/30 border-b border-border/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <div className="col-span-3">Account ID</div>
            <div className="col-span-2 text-center">Risk Score</div>
            <div className="col-span-2 text-center">Confidence</div>
            <div className="col-span-3">Pattern Type</div>
            <div className="col-span-2 text-center">Evidence</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-border/30">
            {accounts.map((account) => (
              <button
                key={account.account_id}
                onClick={() => setSelectedAccount(account)}
                className="w-full grid grid-cols-12 gap-4 px-6 py-4 hover:bg-muted/20 transition-colors text-left group"
              >
                <div className="col-span-3 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getRiskColor(account.risk_score)} animate-pulse`} />
                  <span className="font-mono text-xs font-medium group-hover:text-primary transition-colors">
                    {account.account_id}
                  </span>
                </div>

                <div className="col-span-2 flex items-center justify-center">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${getRiskColor(account.risk_score)}`}>
                      {account.risk_score}
                    </span>
                    <span className="text-[10px] text-muted-foreground">/100</span>
                  </div>
                </div>

                <div className="col-span-2 flex items-center justify-center">
                  <Badge variant="outline" className="text-[9px] font-bold">
                    {account.confidence}%
                  </Badge>
                </div>

                <div className="col-span-3 flex items-center">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {account.pattern_type}
                  </span>
                </div>

                <div className="col-span-2 flex items-center justify-center gap-2">
                  <Badge variant="secondary" className="text-[9px]">
                    {account.evidence.length} items
                  </Badge>
                  <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </button>
            ))}
          </div>

          {/* Footer Disclaimer */}
          <div className="px-6 py-4 bg-muted/10 border-t border-border/30">
            <div className="flex items-start gap-2">
              <Info size={12} className="text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[9px] text-muted-foreground leading-relaxed">
                <span className="font-bold uppercase tracking-wider">Compliance Disclaimer:</span> Risk scores are generated using statistical models and AI-powered behavioral analysis for surveillance purposes only. 
                Flagged accounts require human review and contextual investigation before any regulatory action. 
                False positive rates vary by pattern type and market conditions. This system does not constitute 
                definitive evidence of misconduct or legal liability.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evidence Breakdown Dialog */}
      <Dialog open={!!selectedAccount} onOpenChange={() => setSelectedAccount(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                <ShieldAlert className="text-destructive w-5 h-5" />
                Account Risk Profile
              </DialogTitle>
              <Badge variant={getRiskBadgeVariant(selectedAccount?.risk_category || '')} className="text-[9px] uppercase">
                {selectedAccount?.risk_category}
              </Badge>
            </div>
          </DialogHeader>

          {selectedAccount && (
            <div className="space-y-6 mt-4">
              {/* Account Overview */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-muted/30 border-border/50">
                  <CardContent className="p-4">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Account ID</div>
                    <div className="font-mono text-sm font-bold">{selectedAccount.account_id}</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30 border-border/50">
                  <CardContent className="p-4">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Pattern Type</div>
                    <div className="text-sm font-medium">{selectedAccount.pattern_type}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Risk Metrics */}
              <div className="grid grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-destructive/10 to-transparent border-destructive/30">
                  <CardContent className="p-4 text-center">
                    <div className="text-[9px] text-muted-foreground uppercase font-bold mb-2">Risk Score</div>
                    <div className={`text-2xl font-bold ${getRiskColor(selectedAccount.risk_score)}`}>
                      {selectedAccount.risk_score}
                    </div>
                    <div className="text-[8px] text-muted-foreground mt-1">out of 100</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30 border-border/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-[9px] text-muted-foreground uppercase font-bold mb-2">Confidence</div>
                    <div className="text-2xl font-bold">{selectedAccount.confidence}%</div>
                    <div className="text-[8px] text-muted-foreground mt-1">model certainty</div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30 border-border/50">
                  <CardContent className="p-4 text-center">
                    <div className="text-[9px] text-muted-foreground uppercase font-bold mb-2">Evidence</div>
                    <div className="text-2xl font-bold">{selectedAccount.evidence.length}</div>
                    <div className="text-[8px] text-muted-foreground mt-1">data points</div>
                  </CardContent>
                </Card>
                <Card className="bg-yellow-500/10 border-yellow-500/30">
                  <CardContent className="p-4 text-center">
                    <div className="text-[9px] text-muted-foreground uppercase font-bold mb-2">FP Probability</div>
                    <div className="text-2xl font-bold text-yellow-500">{selectedAccount.false_positive_probability}%</div>
                    <div className="text-[8px] text-muted-foreground mt-1">uncertainty</div>
                  </CardContent>
                </Card>
              </div>

              {/* Uncertainty Quantification */}
              <Card className="bg-yellow-500/5 border-yellow-500/30">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-yellow-500 w-5 h-5 mt-0.5 shrink-0" />
                    <div className="space-y-2">
                      <div className="font-bold text-sm uppercase tracking-wider text-yellow-500">
                        Uncertainty Quantification
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        <span className="font-bold">False Positive Probability: {selectedAccount.false_positive_probability}%</span> — 
                        Based on historical validation data and feature distribution analysis. 
                        This account has a {100 - selectedAccount.false_positive_probability}% probability of representing genuine 
                        information asymmetry behavior requiring investigation. Model calibration: 2,847 validated cases.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Evidence Breakdown */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="text-primary w-4 h-4" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">Evidence Breakdown</h3>
                  <Badge variant="outline" className="text-[8px]">{selectedAccount.evidence.length} observations</Badge>
                </div>
                <div className="space-y-2">
                  {selectedAccount.evidence.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                      <Badge variant="secondary" className="text-[9px] font-mono shrink-0 mt-0.5">
                        {idx + 1}
                      </Badge>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature Analysis */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="text-primary w-4 h-4" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">Quantitative Features</h3>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {Object.entries(selectedAccount.features).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                          {key.replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs font-bold">{value}/100</span>
                      </div>
                      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            value >= 80 ? 'bg-red-500' : 
                            value >= 60 ? 'bg-orange-500' : 
                            value >= 40 ? 'bg-yellow-500' : 
                            'bg-green-500'
                          }`}
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timestamp */}
              <div className="pt-4 border-t border-border/30">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Flagged: {new Date(selectedAccount.flagged_timestamp).toLocaleString()}</span>
                  <span className="font-mono">System ID: DRIFT-{selectedAccount.account_id}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
