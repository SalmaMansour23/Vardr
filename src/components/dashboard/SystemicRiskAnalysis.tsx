"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Network, TrendingUp, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MarketWithStress {
  ticker: string;
  title: string;
  composite_stress_score: number;
  market_state?: string;
  confidence?: number;
  current_price?: string | number;
  volume?: number;
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

/**
 * Generate fallback systemic analysis when API is unavailable
 */
function generateFallbackSystemicAnalysis(markets: MarketWithStress[]): SystemicAnalysis {
  const avgStress = markets.reduce((sum, m) => sum + m.composite_stress_score, 0) / markets.length;
  const highStressCount = markets.filter((m) => m.composite_stress_score >= 60).length;
  const criticalCount = markets.filter((m) => m.composite_stress_score >= 70).length;

  let contagion_risk_level: string;
  if (avgStress > 60 || criticalCount > 0) {
    contagion_risk_level = 'High';
  } else if (avgStress > 45 || highStressCount > markets.length * 0.3) {
    contagion_risk_level = 'Elevated';
  } else if (avgStress > 30) {
    contagion_risk_level = 'Moderate';
  } else {
    contagion_risk_level = 'Low';
  }

  const topStressMarkets = [...markets]
    .sort((a, b) => b.composite_stress_score - a.composite_stress_score)
    .slice(0, 5)
    .map((m) => m.ticker);

  const criticalCluster = markets
    .filter((m) => m.composite_stress_score >= 70)
    .map((m) => `${m.ticker}: ${m.title}`);
  const highCluster = markets
    .filter((m) => m.composite_stress_score >= 40 && m.composite_stress_score < 70)
    .map((m) => `${m.ticker}: ${m.title}`);

  const clusters: StressCluster[] = [];
  if (criticalCluster.length > 0) {
    clusters.push({
      cluster_name: 'Critical Stress',
      risk_description: `${criticalCluster.length} markets in critical stress`,
      markets: criticalCluster,
    });
  }
  if (highCluster.length > 0) {
    clusters.push({
      cluster_name: 'High Stress',
      risk_description: `${highCluster.length} markets in high stress`,
      markets: highCluster,
    });
  }

  return {
    systemic_clusters: clusters,
    leading_markets: topStressMarkets,
    contagion_risk_level,
    reasoning: `Average market stress: ${avgStress.toFixed(1)}/100. Fallback analysis based on available data.`,
  };
}

export function SystemicRiskAnalysis() {
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
      // First, fetch all markets analysis
      console.log('Fetching systemic risk analysis...');
      const marketsResponse = await fetch('/api/analyze-all-markets');
      
      if (!marketsResponse.ok) {
        const errorText = await marketsResponse.text();
        console.error('Market fetch error:', marketsResponse.status, errorText);
        throw new Error('Failed to fetch market data');
      }

      const marketsData = await marketsResponse.json();
      const marketResults: MarketWithStress[] = marketsData.results || [];
      console.log('Markets fetched:', marketResults.length);
      setMarkets(marketResults);

      if (marketResults.length === 0) {
        console.warn('No markets available for analysis');
        setError('No markets available');
        setLoading(false);
        return;
      }

      // Create a sanitized version for serialization
      const sanitizedMarkets = marketResults.map(m => ({
        ticker: m.ticker,
        title: m.title,
        composite_stress_score: m.composite_stress_score,
        market_state: m.market_state,
        confidence: m.confidence,
      }));

      // Then, analyze systemic risk
      console.log('Calling cross-market-correlation with', sanitizedMarkets.length, 'markets');
      const riskResponse = await fetch('/api/cross-market-correlation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          markets: sanitizedMarkets,
        }),
      });

      if (!riskResponse.ok) {
        const errorText = await riskResponse.text();
        console.error('Systemic risk API error:', riskResponse.status, errorText);
        
        // Use fallback analysis if API fails
        console.warn('Using fallback systemic analysis');
        const fallbackAnalysis = generateFallbackSystemicAnalysis(marketResults);
        setAnalysis(fallbackAnalysis);
        return;
      }

      const riskData = await riskResponse.json();
      console.log('Systemic analysis received:', riskData);
      setAnalysis(riskData.analysis);
      setCorrelations(riskData.raw_data?.correlations || []);
      setLeadLag(riskData.raw_data?.lead_lag || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error('Systemic risk analysis error:', errorMsg, err);
      setError(errorMsg);
      
      // Try to provide fallback analysis
      if (markets.length > 0) {
        console.warn('Providing fallback analysis due to error');
        const fallbackAnalysis = generateFallbackSystemicAnalysis(markets);
        setAnalysis(fallbackAnalysis);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemicRisk();
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
          <p className="text-sm text-gray-400">Analyzing systemic risk patterns...</p>
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
          <p className="text-gray-400">No systemic risk analysis available</p>
          <Button onClick={fetchSystemicRisk} className="mt-4" variant="outline" size="sm">
            Run Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Contagion Risk Header */}
      <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Network className="h-12 w-12 text-purple-500" />
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">Systemic Contagion Risk</p>
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
        {/* Leading Markets */}
        <Card className="bg-gray-800/40 border-gray-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Leading Markets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400 mb-4">Markets driving price discovery</p>
            <div className="space-y-2">
              {analysis.leading_markets.length > 0 ? (
                analysis.leading_markets.map((ticker, idx) => {
                  const market = markets.find(m => m.ticker === ticker);
                  return (
                    <div
                      key={ticker}
                      className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/30"
                    >
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          #{idx + 1}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium text-white">{ticker}</p>
                          {market && (
                            <p className="text-xs text-gray-400 line-clamp-1">{market.title}</p>
                          )}
                        </div>
                      </div>
                      {market && (
                        <Badge variant="outline" className="text-xs">
                          Stress: {market.composite_stress_score}
                        </Badge>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-400">No leading markets identified</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stress Clusters */}
        <Card className="bg-gray-800/40 border-gray-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Network className="h-5 w-5 text-orange-500" />
              Stress Clusters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-400 mb-4">Markets grouped by stress level</p>
            <div className="space-y-3">
              {analysis.systemic_clusters.map((cluster, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-white">{cluster.cluster_name}</p>
                    <Badge variant="outline" className="text-xs">
                      {cluster.markets.length} markets
                    </Badge>
                  </div>
                  {cluster.risk_description && (
                    <p className="text-xs text-gray-400 mb-2">{cluster.risk_description}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {cluster.markets.slice(0, 5).map((market, mIdx) => (
                      <Badge key={mIdx} variant="secondary" className="text-xs">
                        {market.split(':')[0]}
                      </Badge>
                    ))}
                    {cluster.markets.length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{cluster.markets.length - 5} more
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Correlations */}
      {correlations.length > 0 && (
        <Card className="bg-gray-800/40 border-gray-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Link2 className="h-5 w-5 text-green-500" />
              Top Price Correlations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {correlations.slice(0, 6).map((corr, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/30"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs font-mono">
                      {corr.market1}
                    </Badge>
                    <span className="text-gray-500">↔</span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {corr.market2}
                    </Badge>
                  </div>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      Math.abs(corr.correlation) > 0.7 
                        ? 'text-red-400 border-red-400/30' 
                        : 'text-yellow-400 border-yellow-400/30'
                    }`}
                  >
                    {corr.correlation.toFixed(2)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lead-Lag Relationships */}
      {leadLag.length > 0 && (
        <Card className="bg-gray-800/40 border-gray-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-purple-500" />
              Lead-Lag Relationships
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {leadLag.map((rel, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/30"
                >
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline" className="text-xs font-mono bg-blue-500/10 text-blue-400">
                      {rel.leader}
                    </Badge>
                    <span className="text-gray-500">leads</span>
                    <Badge variant="outline" className="text-xs font-mono">
                      {rel.follower}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      ~{rel.lag_minutes}min lag
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {(rel.confidence * 100).toFixed(0)}% conf
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
