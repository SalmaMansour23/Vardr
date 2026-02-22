"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Zap, AlertTriangle, Activity, LayoutDashboard, ListFilter, X, Loader2, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSignalTrace } from '../hooks/use-signal-trace';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateSeededData, Contract, TraderProfile, getTraderProfile, CONTRACT_CONFIG, getScenarioTimes, SIGNAL_TRACE_HOURS_BEFORE_EVENT } from '@/lib/data-generator';
import { ProbabilityChart } from '@/components/dashboard/ProbabilityChart';
import { AnomalyBreakdown } from '@/components/dashboard/AnomalyBreakdown';
import { TraderIntelligence } from '@/components/dashboard/TraderIntelligence';
import { SocialSignalPanel } from '@/components/dashboard/SocialSignalPanel';
import { TimelineRiskPanel } from '@/components/dashboard/TimelineRiskPanel';
import { FlaggedBetsFeed } from '@/components/dashboard/FlaggedBetsFeed';
import { AiRiskIntelligencePage } from '../../components/dashboard/AiRiskIntelligencePage';
import { fetchPublicSignals } from '@/lib/fetchPublicSignals';

export default function LeakLensDashboard() {
  const [isLeaked, setIsLeaked] = useState(false);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [selectedTrader, setSelectedTrader] = useState<TraderProfile | null>(null);
  const [runAnalysis, setRunAnalysis] = useState(false);

  const activeContract = useMemo(() => allContracts[0], [allContracts]);

  const activeConfig = useMemo(() =>
    CONTRACT_CONFIG.find(c => c.id === activeContract?.id) ?? CONTRACT_CONFIG[0],
    [activeContract?.id]
  );

  const signalTraceData = useMemo(() => {
    const { drift_time, announcement_time } = activeContract
      ? getScenarioTimes(activeContract)
      : { drift_time: '', announcement_time: '' };
    const eventKeyword = activeConfig?.eventKeyword ?? 'cpi';
    const publicSignals = runAnalysis && drift_time
      ? fetchPublicSignals(eventKeyword, drift_time, 15, SIGNAL_TRACE_HOURS_BEFORE_EVENT)
      : [];
    const posts = publicSignals.map(signal => ({
      text: signal.text,
      timestamp: signal.timestamp
    }));
    return { drift_time, announcement_time, posts };
  }, [runAnalysis, activeContract, activeConfig?.eventKeyword]);

  const { classifications, timelineResult, loading, error } = useSignalTrace(signalTraceData);

  useEffect(() => {
    const contracts = CONTRACT_CONFIG.map((_, i) => generateSeededData(isLeaked, i));
    setAllContracts(contracts);
  }, [isLeaked]);

  // Calculate adjusted risk score based on timeline analysis
  const adjustedRiskScore = useMemo(() => {
    if (!activeContract) return 0;

    let score = activeContract.riskScore;

    // Add points based on AI timeline analysis
    if (timelineResult && runAnalysis) {
      if (timelineResult.risk_level === 'High') {
        score += 20;
      } else if (timelineResult.risk_level === 'Medium') {
        score += 10;
      }
    }

    // Cap at 100
    return Math.min(score, 100);
  }, [activeContract, timelineResult, runAnalysis]);

  const handleSimulateLeak = () => {
    setIsLeaked(!isLeaked);
    setRunAnalysis(!runAnalysis);
  };

  const handleTraderClick = (traderId: string) => {
    if (activeContract) {
      const profile = getTraderProfile(traderId, activeContract.trades);
      setSelectedTrader(profile);
    }
  };

  if (!activeContract) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-body">
      {/* Top Header */}
      <header className="border-b border-border bg-background sticky top-0 z-50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-start">
          <div className="flex items-center gap-4">
            <div>
              <img
                src="/vardr-logo.png"
                alt="Vardr Intelligence"
                className="h-12 w-auto max-w-[360px] object-contain"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/vardr-logo.svg";
                }}
              />
            </div>
          </div>

        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-6 py-8 relative">
        <div className="flex flex-col gap-8">
          <Tabs defaultValue="activity" className="w-full">
            <div className="flex justify-between items-center mb-6">
              <TabsList className="bg-card/30 border border-border/50 p-1 rounded-xl">
                <TabsTrigger value="activity" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <ListFilter size={14} /> Flagged Bets
                </TabsTrigger>
                <TabsTrigger value="agents" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <Brain size={14} /> Risk Officer Report
                </TabsTrigger>
                <TabsTrigger value="dashboard" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <LayoutDashboard size={14} /> Simulation
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="dashboard" className="mt-0 space-y-8 animate-in fade-in duration-500">
              <div className="flex justify-end">
                <Button 
                  variant={isLeaked ? "destructive" : "outline"} 
                  size="sm" 
                  onClick={handleSimulateLeak}
                  className="gap-2 font-bold uppercase text-[10px] tracking-widest border-2 transition-all duration-300"
                >
                  <Zap size={14} fill={isLeaked ? "currentColor" : "none"} />
                  {isLeaked ? "Reset Surveillance" : "Simulate Information Leak"}
                </Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column (Main Analysis) */}
                <div className="lg:col-span-8 space-y-8">
                  <Card className="border-border/50 bg-card/30 overflow-hidden rounded-2xl shadow-xl">
                    <div className="p-6 flex items-center justify-between border-b border-border/50">
                      <div className="flex items-center gap-2">
                        <Activity size={18} className="text-primary" />
                        <div>
                          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Information Propogation Analysis</h2>
                          <p className="text-[10px] text-muted-foreground font-medium">{activeContract.description}</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <Badge variant="outline" className="text-[9px] uppercase border-accent/20 text-accent">Real-time Feed</Badge>
                      </div>
                    </div>
                    <CardContent className="pt-8">
                      <ProbabilityChart data={activeContract.data} announcementTime={activeContract.announcementTime} />
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <Card className="border-border/50 bg-card/30 rounded-2xl overflow-hidden shadow-2xl">
                      <CardContent className="p-8">
                        <AnomalyBreakdown analysis={activeContract} />
                      </CardContent>
                    </Card>
                    <SocialSignalPanel
                      classifications={classifications}
                      posts={signalTraceData.posts}
                      showEmptyState
                    />
                  </div>
                </div>

                {/* Right Column (Risk Breakdown) */}
                <div className="lg:col-span-4 space-y-8">
                  {/* AI-Powered Signal Analysis */}
                  {runAnalysis && (
                    <>
                      {loading ? (
                        <Card className="border-primary/30 bg-primary/5 rounded-2xl overflow-hidden shadow-2xl">
                          <CardContent className="p-8 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            <span className="text-xs text-muted-foreground">Running AI analysis...</span>
                          </CardContent>
                        </Card>
                      ) : error ? (
                        <Card className="border-destructive/30 bg-destructive/5 rounded-2xl">
                          <CardContent className="p-6">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="text-destructive shrink-0" size={20} />
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-tighter text-destructive mb-2">Analysis Error</h4>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">{error}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ) : timelineResult ? (
                        <TimelineRiskPanel
                          timelineResult={timelineResult}
                          drift_time={signalTraceData.drift_time}
                          announcement_time={signalTraceData.announcement_time}
                          riskScore={adjustedRiskScore}
                        />
                      ) : null}
                    </>
                  )}

                  {adjustedRiskScore > 60 && (
                    <Card className="border-destructive/30 bg-destructive/5 rounded-2xl border-dashed">
                      <CardContent className="p-6 flex items-start gap-4">
                        <AlertTriangle className="text-destructive shrink-0" size={20} />
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-tighter text-destructive underline decoration-dotted">Behavioral Alert: Trader_Atlas</h4>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Detected High Information Asymmetry Risk. Position accumulation correlates 0.94 with subsequent probability drift in the pre-disclosure window.
                          </p>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="h-6 text-[9px] uppercase font-bold"
                            onClick={() => handleTraderClick('Trader_Atlas')}
                          >
                            View Flag Reason
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="agents" className="mt-0 animate-in fade-in duration-500">
              <AiRiskIntelligencePage />
            </TabsContent>

            <TabsContent value="activity" className="mt-0 animate-in fade-in duration-500">
              <FlaggedBetsFeed />
            </TabsContent>
          </Tabs>
        </div>

        {/* Trader Intelligence Overlay */}
        {selectedTrader && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-2xl h-[85vh] relative">
              <TraderIntelligence profile={selectedTrader} onClose={() => setSelectedTrader(null)} />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setSelectedTrader(null)}
                className="absolute -top-4 -right-4 bg-card rounded-full shadow-lg border border-border hover:bg-muted"
              >
                <X size={18} />
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-card/20 py-10 px-6">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-[10px] text-muted-foreground/60 max-w-3xl leading-relaxed font-bold">
            Vardr Intelligence uses its proprietary Vardr Model to transform insider trading and abnormal signals in prediction markets into actionable risk mitigation and security intelligence for companies, government entities, and institutional traders.
          </p>
          <div className="flex gap-8 text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest">
            <span className="hover:text-primary transition-colors cursor-pointer">Security Protocol</span>
            <span className="hover:text-primary transition-colors cursor-pointer">Behavioral Model v3.0</span>
            <span className="hover:text-primary transition-colors cursor-pointer">Compliance API</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
