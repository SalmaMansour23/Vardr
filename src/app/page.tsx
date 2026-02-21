"use client"

import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Zap, AlertTriangle, Clock, Activity, LayoutDashboard, ListFilter, UserCheck, Globe, X, MessageSquare, TrendingUp, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { generateSeededData, Contract, TraderProfile, getTraderProfile, NAMED_TRADERS } from '@/lib/data-generator';
import { ProbabilityChart } from '@/components/dashboard/ProbabilityChart';
import { RiskMeter } from '@/components/dashboard/RiskMeter';
import { AnomalyBreakdown } from '@/components/dashboard/AnomalyBreakdown';
import { TraderNetworkGraph } from '@/components/dashboard/TraderNetworkGraph';
import { MarketOverview } from '@/components/dashboard/MarketOverview';
import { TraderIntelligence } from '@/components/dashboard/TraderIntelligence';
import { LiveKalshiTrades } from '@/components/dashboard/LiveKalshiTrades';
import { Input } from '@/components/ui/input';

export default function LeakLensDashboard() {
  const [isLeaked, setIsLeaked] = useState(false);
  const [activeContractIndex, setActiveContractIndex] = useState(0);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [selectedTrader, setSelectedTrader] = useState<TraderProfile | null>(null);

  useEffect(() => {
    const contracts = [
      generateSeededData(isLeaked, 0),
      generateSeededData(false, 1),
      generateSeededData(false, 2),
      generateSeededData(false, 3)
    ];
    setAllContracts(contracts);
  }, [isLeaked]);

  const activeContract = useMemo(() => allContracts[activeContractIndex], [allContracts, activeContractIndex]);

  const handleSimulateLeak = () => {
    setIsLeaked(!isLeaked);
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
                <div className={`w-2 h-2 rounded-full ${activeContract.riskScore > 60 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                <span className={`text-sm font-bold uppercase ${activeContract.riskScore > 60 ? 'text-red-500' : 'text-green-500'}`}>
                  {activeContract.riskScore > 60 ? 'Critical Asymmetry' : 'Market Integrity High'}
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
                <TabsTrigger value="activity" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <ListFilter size={14} /> Market Activity
                </TabsTrigger>
                <TabsTrigger value="overview" className="gap-2 text-xs uppercase font-bold px-4 py-2 rounded-lg">
                  <Globe size={14} /> Global Overview
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
                    <TraderNetworkGraph analysis={activeContract} />
                    <Card className="border-border/50 bg-card/30 rounded-2xl shadow-xl flex flex-col">
                      <div className="p-4 border-b border-border/50 flex items-center justify-between">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                          <MessageSquare size={14} /> Sentiment Signals
                        </h2>
                        <Badge variant="secondary" className="text-[9px]">Simulated Feed</Badge>
                      </div>
                      <div className="flex-1 p-4 space-y-4 overflow-y-auto max-h-[300px]">
                        {activeContract.socialSignals.map((signal) => (
                          <div key={signal.id} className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold text-primary">@{signal.author}</span>
                              <Badge variant={signal.sentiment === 'positive' ? 'default' : 'secondary'} className="text-[8px] h-4">
                                {signal.sentiment}
                              </Badge>
                            </div>
                            <p className="text-[11px] leading-relaxed italic">"{signal.text}"</p>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </div>
                </div>

                {/* Right Column (Risk Breakdown) */}
                <div className="lg:col-span-4 space-y-8">
                  <Card className="border-border/50 bg-card/30 rounded-2xl overflow-hidden shadow-2xl">
                    <CardContent className="p-8 space-y-8">
                      <RiskMeter score={activeContract.riskScore} />
                      <div className="h-px bg-border/50 w-full" />
                      <AnomalyBreakdown analysis={activeContract} />
                    </CardContent>
                  </Card>

                  {activeContract.riskScore > 60 && (
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

            <TabsContent value="activity" className="mt-0 animate-in fade-in duration-500">
              <LiveKalshiTrades
                ticker={activeContract.kalshiTicker}
                marketName={activeContract.kalshiTicker ? activeContract.name : undefined}
              />
            </TabsContent>

            <TabsContent value="overview" className="mt-0 animate-in fade-in duration-500">
              <MarketOverview contracts={allContracts} />
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
