"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Network, TrendingUp, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MarketWithStress {
  ticker: string;
  title: string;
  composite_stress_score: number;
  market_state?: string;
  confidence?: number;
}

interface CorrelationResult {
  market1: string;
  market2: string;
  correlation: number;
}

interface LeadLagResult {
  leader: string;
  follower: string;
  lag_minutes: number;
  confidence: number;
}

interface StressCluster {
  cluster_name: string;
  stress_level?: string;
  risk_description?: string;
  markets: string[];
}

interface SystemicAnalysis {
  systemic_clusters: StressCluster[];
  leading_markets: string[];
  contagion_risk_level: string;
  reasoning: string;
}

function generateFallbackSystemicAnalysis(markets: MarketWithStress[]): SystemicAnalysis {
  const avgStress = markets.reduce((sum, m) => sum + m.composite_stress_score, 0) / markets.length;

  const contagion_risk_level =
    avgStress > 60 ? 'High' : avgStress > 45 ? 'Elevated' : avgStress > 30 ? 'Moderate' : 'Low';

  return {
    systemic_clusters: [],
    leading_markets: [...markets]
      .sort((a, b) => b.composite_stress_score - a.composite_stress_score)
      .slice(0, 5)
      .map((m) => m.ticker),
    contagion_risk_level,
    reasoning: `Average Polymarket stress: ${avgStress.toFixed(1)}/100. Fallback systemic estimate.`,
  };
}

export function PolymarketSystemicRiskAnalysis() {
  const [markets, setMarkets] = useState<MarketWithStress[]>([]);
  const [analysis, setAnalysis] = useState<SystemicAnalysis | null>(null);
  const [correlations, setCorrelations] = useState<CorrelationResult[]>([]);
  const [leadLag, setLeadLag] = useState<LeadLagResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSystemicRisk = async () => {
    setLoading(true);
    setError(null);

    try {
      const marketsResponse = await fetch('/api/analyze-all-polymarkets');

      if (!marketsResponse.ok) {
        throw new Error('Failed to fetch Polymarket market data');
      }

      const marketsData = await marketsResponse.json();
      const marketResults: MarketWithStress[] = marketsData.results || [];
      setMarkets(marketResults);

      if (marketResults.length === 0) {
        setError('No Polymarket markets available');
        setLoading(false);
        return;
      }

      const sanitizedMarkets = marketResults.map((m) => ({
        ticker: m.ticker,
        title: m.title,
        composite_stress_score: m.composite_stress_score,
        market_state: m.market_state,
        confidence: m.confidence,
      }));

      const riskResponse = await fetch('/api/cross-market-correlation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markets: sanitizedMarkets }),
      });

      if (!riskResponse.ok) {
        const fallbackAnalysis = generateFallbackSystemicAnalysis(marketResults);
        setAnalysis(fallbackAnalysis);
        return;
      }

      const riskData = await riskResponse.json();
      setAnalysis(riskData.analysis);
      setCorrelations(riskData.raw_data?.correlations || []);
      setLeadLag(riskData.raw_data?.lead_lag || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      if (markets.length > 0) {
        setAnalysis(generateFallbackSystemicAnalysis(markets));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemicRisk();
    const interval = setInterval(fetchSystemicRisk, 30000);
    return () => clearInterval(interval);
  }, []);

  const getContagionColor = (level: string) => {
    switch (level) {
      case 'Low':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Moderate':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Elevated':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'High':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Critical':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="text-sm text-gray-400">Analyzing Polymarket systemic risk...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-500/5 border-red-500/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <p className="text-red-500 font-medium">Analysis Error</p>
              <p className="text-sm text-gray-400">{error}</p>
            </div>
          </div>
          <Button onClick={fetchSystemicRisk} className="mt-4" variant="outline" size="sm">
            Retry Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="bg-gray-800/30 border-gray-700/50">
        <CardContent className="p-8 text-center">
          <p className="text-gray-400">No Polymarket systemic analysis available</p>
          <Button onClick={fetchSystemicRisk} className="mt-4" variant="outline" size="sm">
            Run Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Network className="h-12 w-12 text-purple-500" />
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">Polymarket Contagion Risk</p>
                <Badge className={`${getContagionColor(analysis.contagion_risk_level)} text-lg px-3 py-1`}>
                  {analysis.contagion_risk_level}
                </Badge>
              </div>
            </div>
            <Button onClick={fetchSystemicRisk} variant="outline" size="sm">
              Refresh Analysis
            </Button>
          </div>
          <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <p className="text-sm text-gray-300">{analysis.reasoning}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-800/40 border-gray-700/50">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300 mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-orange-500" /> Leading Markets
            </h3>
            <div className="space-y-2">
              {analysis.leading_markets.length > 0 ? (
                analysis.leading_markets.map((market, idx) => (
                  <div key={market} className="flex items-center justify-between p-2 bg-gray-900/30 rounded">
                    <span className="text-xs font-mono text-gray-300 truncate max-w-[80%]">{market}</span>
                    <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500">No leading markets identified</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800/40 border-gray-700/50">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300 mb-4 flex items-center gap-2">
              <Link2 size={14} className="text-cyan-500" /> Top Correlations
            </h3>
            <div className="space-y-2">
              {correlations.slice(0, 5).map((corr) => (
                <div key={`${corr.market1}-${corr.market2}`} className="p-2 bg-gray-900/30 rounded">
                  <div className="text-[11px] text-gray-300 truncate">{corr.market1.slice(0, 12)} ↔ {corr.market2.slice(0, 12)}</div>
                  <div className="text-[10px] text-cyan-400">ρ={corr.correlation.toFixed(2)}</div>
                </div>
              ))}
              {correlations.length === 0 && <p className="text-xs text-gray-500">No correlation data available</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-800/40 border-gray-700/50">
        <CardContent className="p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-300 mb-4">Lead-Lag Signals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {leadLag.slice(0, 6).map((pair) => (
              <div key={`${pair.leader}-${pair.follower}`} className="p-3 bg-gray-900/30 rounded">
                <p className="text-xs text-gray-300 truncate">
                  <span className="text-orange-400">{pair.leader.slice(0, 12)}</span> →{' '}
                  <span className="text-cyan-400">{pair.follower.slice(0, 12)}</span>
                </p>
                <p className="text-[10px] text-gray-500 mt-1">
                  Lag: {pair.lag_minutes}m | Conf: {(pair.confidence * 100).toFixed(0)}%
                </p>
              </div>
            ))}
            {leadLag.length === 0 && <p className="text-xs text-gray-500">No lead-lag data available</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
