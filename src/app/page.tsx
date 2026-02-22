"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Zap, AlertTriangle, Clock, Activity, LayoutDashboard, ListFilter, UserCheck, Globe, X, MessageSquare, TrendingUp, Search, Loader2, Brain, Network, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSignalTrace } from '../hooks/use-signal-trace';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateSeededData, Contract, TraderProfile, getTraderProfile, CONTRACT_CONFIG, getScenarioTimes, SIGNAL_TRACE_HOURS_BEFORE_EVENT } from '@/lib/data-generator';
import { ProbabilityChart } from '@/components/dashboard/ProbabilityChart';
import { AnomalyBreakdown } from '@/components/dashboard/AnomalyBreakdown';
import { MarketOverview } from '@/components/dashboard/MarketOverview';
import { TraderIntelligence } from '@/components/dashboard/TraderIntelligence';
import { SocialSignalPanel } from '@/components/dashboard/SocialSignalPanel';
import { TimelineRiskPanel } from '@/components/dashboard/TimelineRiskPanel';
import { CausalGraphVisualizer } from '@/components/dashboard/CausalGraphVisualizer';
import { HighRiskAccountsPanel } from '@/components/dashboard/HighRiskAccountsPanel';
import { LiveKalshiTrades } from '@/components/dashboard/LiveKalshiTrades';
import { MarketStressAnalysis } from '@/components/dashboard/MarketStressAnalysis';
import { SystemicRiskAnalysis } from '@/components/dashboard/SystemicRiskAnalysis';
import { PolymarketStressAnalysis } from '@/components/dashboard/PolymarketStressAnalysis';
import { PolymarketSystemicRiskAnalysis } from '@/components/dashboard/PolymarketSystemicRiskAnalysis';
import { FlaggedBetsFeed } from '@/components/dashboard/FlaggedBetsFeed';
import { Input } from '@/components/ui/input';
import { fetchPublicSignals } from '@/lib/fetchPublicSignals';
import { ADVERSARIAL_HIGH_RISK_SIMILARITY } from '@/lib/ui-thresholds';

export default function LeakLensDashboard() {
  const [isLeaked, setIsLeaked] = useState(false);
  const [activeContractIndex, setActiveContractIndex] = useState(0);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [selectedTrader, setSelectedTrader] = useState<TraderProfile | null>(null);
  const [runAnalysis, setRunAnalysis] = useState(false);

  // Advanced AI Analysis States
  const [causalGraph, setCausalGraph] = useState<any>(null);
  const [crossEventAnalysis, setCrossEventAnalysis] = useState<any>(null);
  const [adversarialSim, setAdversarialSim] = useState<any>(null);
  const [expertPanel, setExpertPanel] = useState<any>(null);
  const [advancedLoading, setAdvancedLoading] = useState(false);

  const activeContract = useMemo(() => allContracts[activeContractIndex], [allContracts, activeContractIndex]);

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

  // Run advanced AI analysis when basic analysis completes
  useEffect(() => {
    if (!runAnalysis || !timelineResult || loading) return;

    const relatedEvents = activeConfig?.relatedEvents ?? [];

    const runAdvancedAnalysis = async () => {
      setAdvancedLoading(true);

      try {
        const [causalRes, crossRes, adversarialRes, expertRes] = await Promise.all([
          fetch('/api/generate-causal-graph', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              narratives: classifications.map(c => c.reasoning).filter(Boolean),
              market_events: [`Market drift at ${signalTraceData.drift_time}`, `${activeContract?.name ?? 'Market'} volatility`],
              posts: signalTraceData.posts.map(p => p.text)
            })
          }),

          fetch('/api/cross-event-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              primary_event: { type: activeContract?.name ?? activeConfig?.name ?? 'Event', drift_time: signalTraceData.drift_time },
              related_events: relatedEvents,
              posts: signalTraceData.posts
            })
          }),

          fetch('/api/adversarial-simulation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              market_structure: { type: 'prediction_market', liquidity: 'medium' },
              information: activeContract?.description ?? 'Event disclosure',
              actual_pattern: {
                posts: signalTraceData.posts.map(p => ({ text: p.text, timestamp: p.timestamp })),
                drift_time: signalTraceData.drift_time
              }
            })
          }),

          // Expert Panel Ensemble
          fetch('/api/expert-panel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              posts: signalTraceData.posts,
              drift_time: signalTraceData.drift_time,
              announcement_time: signalTraceData.announcement_time,
              market_movement: 'Probability increased from 45% to 78%'
            })
          })
        ]);

        const [causalData, crossData, adversarialData, expertData] = await Promise.all([
          causalRes.json(),
          crossRes.json(),
          adversarialRes.json(),
          expertRes.json()
        ]);

        setCausalGraph(causalData.result || causalData);
        setCrossEventAnalysis(crossData.result || crossData);
        setAdversarialSim(adversarialData.result || adversarialData);
        setExpertPanel(expertData.result || expertData);

      } catch (err) {
        console.error('Advanced analysis error:', err);
      } finally {
        setAdvancedLoading(false);
      }
    };

    runAdvancedAnalysis();
  }, [runAnalysis, timelineResult, loading, classifications, signalTraceData, activeConfig, activeContract]);

  const handleSimulateLeak = () => {
    setIsLeaked(!isLeaked);
    setRunAnalysis(!runAnalysis);
    // Reset advanced analysis
    if (runAnalysis) {
      setCausalGraph(null);
      setCrossEventAnalysis(null);
      setAdversarialSim(null);
      setExpertPanel(null);
    }
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
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-primary/20 p-2 rounded-xl">
              <Shield className="text-primary w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold font-headline tracking-tight">DriftX <span className="text-primary text-xs ml-1 bg-primary/10 px-1.5 py-0.5 rounded">v3.0</span></h1>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase">
                <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-primary">ID: {activeContract.id}</span>
                <span className="flex items-center gap-1"><Clock size={12} /> Live Monitoring</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Global Integrity Score</span>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${adjustedRiskScore > 60 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                <span className={`text-sm font-bold uppercase ${adjustedRiskScore > 60 ? 'text-red-500' : 'text-green-500'}`}>
                  {adjustedRiskScore > 60 ? 'Critical Asymmetry' : 'Market Integrity High'}
                </span>
              </div>
            </div>
            
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
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-6 py-8 relative">
        <div className="flex flex-col gap-8">
          {/* Market Selection Tabs */}
          <div className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
            {allContracts.map((c, i) => (
              <button
                key={c.id}
                onClick={() => setActiveContractIndex(i)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl border transition-all ${
                  activeContractIndex === i 
                    ? 'bg-primary border-primary text-primary-foreground font-bold shadow-lg' 
                    : 'bg-card/30 border-border hover:bg-card/50 text-muted-foreground'
                }`}
              >
                <div className="text-[10px] uppercase tracking-tighter opacity-70 font-bold mb-1">Contract {i+1}</div>
                <div className="text-sm">{c.name}</div>
              </button>
            ))}
          </div>

          <Tabs defaultValue="dashboard" className="w-full">
            <div className="flex justify-between items-center mb-6">
              <TabsList className="bg-card/30 border border-border/50 p-1 rounded-xl">
                <TabsTrigger value="dashboard" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <LayoutDashboard size={14} /> Intelligence
                </TabsTrigger>
                <TabsTrigger value="advanced" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <Brain size={14} /> Advanced AI
                </TabsTrigger>
                <TabsTrigger value="activity" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <ListFilter size={14} /> Flagged Bets
                </TabsTrigger>
                <TabsTrigger value="kalshi" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <Radio size={14} /> Kalshi Live
                </TabsTrigger>
                <TabsTrigger value="overview" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <Globe size={14} /> Global Overview
                </TabsTrigger>
                <TabsTrigger value="stress" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <Activity size={14} /> Market Stress
                </TabsTrigger>
                <TabsTrigger value="systemic" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <Network size={14} /> Systemic Risk
                </TabsTrigger>
                <TabsTrigger value="poly-stress" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <Activity size={14} /> Poly Market Stress
                </TabsTrigger>
                <TabsTrigger value="poly-risk" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <Network size={14} /> Poly Systemic Risk
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2 px-4 py-2 bg-card/20 border border-border/50 rounded-xl">
                <Search size={14} className="text-muted-foreground" />
                <Input placeholder="Search Trader..." className="h-6 w-32 border-none bg-transparent text-[11px] focus-visible:ring-0 p-0" />
              </div>
            </div>

            <TabsContent value="dashboard" className="mt-0 space-y-8 animate-in fade-in duration-500">
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

            <TabsContent value="advanced" className="mt-0 animate-in fade-in duration-500">
              <div className="space-y-8">
                {/* High-Risk Accounts Panel - Always Visible */}
                <HighRiskAccountsPanel />

                {!runAnalysis ? (
                  <Card className="border-border/50 bg-card/30 rounded-2xl">
                    <CardContent className="p-12 flex flex-col items-center justify-center gap-4">
                      <Brain className="h-16 w-16 text-muted-foreground/30" />
                      <h3 className="text-lg font-bold text-muted-foreground">Advanced AI Analysis Inactive</h3>
                      <p className="text-sm text-muted-foreground/70 text-center max-w-md">
                        Click "Simulate Information Leak" to run ensemble AI analysis including causal graphs,
                        cross-event correlation, adversarial simulation, and expert panel consensus.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-8">
                    {/* Expert Panel Analysis */}
                    {expertPanel && (
                      <Card className="border-primary/30 bg-primary/5 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-primary/20">
                          <h2 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                            <UserCheck size={16} /> Expert Panel Consensus
                          </h2>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Multi-expert ensemble AI analysis from {expertPanel.experts?.length || 3} specialized analysts
                          </p>
                        </div>
                        <CardContent className="p-6 space-y-4">
                          {advancedLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              <span className="ml-3 text-xs text-muted-foreground">Consulting expert panel...</span>
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {expertPanel.experts?.map((expert: any, idx: number) => (
                                  <Card key={idx} className="bg-muted/20 border-border/30">
                                    <CardContent className="p-4 space-y-2">
                                      <div className="text-[10px] font-bold uppercase text-primary">{expert.role || `Expert ${idx + 1}`}</div>
                                      <div className="text-[11px] leading-relaxed text-muted-foreground">
                                        {expert.analysis?.substring(0, 150)}...
                                      </div>
                                      <Badge variant="outline" className="text-[8px]">
                                        Risk: {expert.risk_score || 'N/A'}
                                      </Badge>
                                    </CardContent>
                                  </Card>
                                )) || <p className="text-xs text-muted-foreground">Expert reports loading...</p>}
                              </div>
                              <div className="pt-4 border-t border-border/30">
                                <div className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Synthesized Assessment</div>
                                <p className="text-sm leading-relaxed">{expertPanel.synthesis?.final_assessment || expertPanel.synthesis || 'Processing...'}</p>
                                <div className="mt-3 flex items-center gap-4">
                                  <Badge variant={expertPanel.consensus_risk_score > 70 ? "destructive" : "default"} className="text-[10px]">
                                    Consensus Risk: {expertPanel.consensus_risk_score || expertPanel.risk_score || 'N/A'}/100
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px]">
                                    Confidence: {expertPanel.confidence_level || expertPanel.confidence || 'Medium'}
                                  </Badge>
                                </div>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Causal Graph Visualization */}
                    {causalGraph && (
                      <Card className="border-border/50 bg-card/30 rounded-2xl overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-border/50">
                          <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                            <Network size={16} className="text-primary" /> Causal Network Graph
                          </h2>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            AI-generated causal relationships between narratives, market events, and information flow
                          </p>
                        </div>
                        <CardContent className="p-6">
                          {advancedLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                              <span className="ml-3 text-xs text-muted-foreground">Generating causal graph...</span>
                            </div>
                          ) : (
                            <CausalGraphVisualizer
                              nodes={causalGraph.nodes || []}
                              edges={causalGraph.edges || []}
                            />
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Cross-Event and Adversarial Analysis */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Cross-Event Analysis */}
                      {crossEventAnalysis && (
                        <Card className="border-border/50 bg-card/30 rounded-2xl overflow-hidden shadow-xl">
                          <div className="p-4 border-b border-border/50">
                            <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                              <TrendingUp size={14} className="text-accent" /> Cross-Event Correlation
                            </h2>
                          </div>
                          <CardContent className="p-6 space-y-3">
                            {advancedLoading ? (
                              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                            ) : (
                              <>
                                <p className="text-[11px] leading-relaxed text-muted-foreground">
                                  {crossEventAnalysis.analysis || crossEventAnalysis.correlation_analysis}
                                </p>
                                {crossEventAnalysis.linked_events?.map((event: any, idx: number) => (
                                  <div key={idx} className="p-3 rounded-lg bg-muted/20 border border-border/30">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-[10px] font-bold">{event.event_type}</span>
                                      <Badge variant="outline" className="text-[8px]">
                                        Strength: {Math.round((event.relationship_strength || 0) * 100)}%
                                      </Badge>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground">{event.reasoning}</p>
                                  </div>
                                ))}
                              </>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      {/* Adversarial Simulation */}
                      {adversarialSim && (
                        <Card className="border-destructive/30 bg-destructive/5 rounded-2xl overflow-hidden shadow-xl">
                          <div className="p-4 border-b border-destructive/20">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-destructive flex items-center gap-2">
                              <AlertTriangle size={14} /> Adversarial Strategy
                            </h2>
                          </div>
                          <CardContent className="p-6 space-y-3">
                            {advancedLoading ? (
                              <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                            ) : (
                              <>
                                <div>
                                  <div className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Optimal Attack Vector</div>
                                  <p className="text-[11px] leading-relaxed">{adversarialSim.simulated_strategy?.strategy || adversarialSim.strategy}</p>
                                </div>
                                {adversarialSim.similarity_score !== undefined && (
                                  <div className="pt-3 border-t border-border/30">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-muted-foreground uppercase font-bold">Pattern Match</span>
                                      <Badge variant={adversarialSim.similarity_score > ADVERSARIAL_HIGH_RISK_SIMILARITY ? "destructive" : "secondary"} className="text-[9px]">
                                        {Math.round((adversarialSim.similarity_score || 0) * 100)}% Similar
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-2">{adversarialSim.comparison_analysis || 'Comparing observed behavior to optimal adversarial strategy...'}</p>
                                  </div>
                                )}
                                {adversarialSim.risk_adjustment && (
                                  <Badge variant="destructive" className="text-[9px]">
                                    Risk Adjustment: +{adversarialSim.risk_adjustment}
                                  </Badge>
                                )}
                              </>
                            )}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-0 animate-in fade-in duration-500">
              <FlaggedBetsFeed />
            </TabsContent>

            <TabsContent value="kalshi" className="mt-0 animate-in fade-in duration-500">
              <LiveKalshiTrades
                ticker={activeContract.kalshiTicker}
                marketName={activeContract.kalshiTicker ? activeContract.name : undefined}
              />
            </TabsContent>

            <TabsContent value="overview" className="mt-0 animate-in fade-in duration-500">
              <MarketOverview contracts={allContracts} />
            </TabsContent>

            <TabsContent value="stress" className="mt-0 animate-in fade-in duration-500">
              <MarketStressAnalysis />
            </TabsContent>

            <TabsContent value="systemic" className="mt-0 animate-in fade-in duration-500">
              <SystemicRiskAnalysis />
            </TabsContent>

            <TabsContent value="poly-stress" className="mt-0 animate-in fade-in duration-500">
              <PolymarketStressAnalysis />
            </TabsContent>

            <TabsContent value="poly-risk" className="mt-0 animate-in fade-in duration-500">
              <PolymarketSystemicRiskAnalysis />
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
          <p className="text-[10px] text-muted-foreground/60 max-w-2xl leading-relaxed uppercase tracking-widest font-bold">
            DriftX models structural information asymmetry risk using statistical drift detection, behavioral sequencing analysis, cross-event correlation modeling, and sentiment divergence monitoring.
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
