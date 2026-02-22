"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Activity, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MarketAnalysis {
  ticker: string;
  title: string;
  composite_stress_score: number;
  market_state: string;
  confidence: number;
  current_price?: string | number;
  volume?: number;
}

interface AnalysisResponse {
  success: boolean;
  total: number;
  results: MarketAnalysis[];
  meta: {
    analyzed: number;
    successful: number;
    failed: number;
  };
}

export function PolymarketStressAnalysis() {
  const [analysis, setAnalysis] = useState<MarketAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<any>(null);

  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/analyze-all-polymarkets');

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const data: AnalysisResponse = await response.json();
      setAnalysis(data.results || []);
      setMeta(data.meta);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalysis();

    const interval = setInterval(fetchAnalysis, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStateColor = (state: string) => {
    switch (state) {
      case 'Stable':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Elevated Volatility':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'Stress Accumulation':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'Information Shock':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Liquidity Breakdown':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const getStressColor = (score: number) => {
    if (score >= 70) return 'text-red-500';
    if (score >= 40) return 'text-orange-500';
    if (score >= 20) return 'text-yellow-500';
    return 'text-green-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
          <p className="text-sm text-gray-400">Analyzing Polymarket with AI...</p>
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
          <Button onClick={fetchAnalysis} className="mt-4" variant="outline" size="sm">
            Retry Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Total Markets</p>
                <p className="text-2xl font-bold text-blue-400">{analysis.length}</p>
              </div>
              <Activity className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Stable</p>
                <p className="text-2xl font-bold text-green-400">
                  {analysis.filter((m) => m.composite_stress_score < 20).length}
                </p>
              </div>
              <Zap className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">High Stress</p>
                <p className="text-2xl font-bold text-orange-400">
                  {analysis.filter((m) => m.composite_stress_score >= 40 && m.composite_stress_score < 70).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Critical</p>
                <p className="text-2xl font-bold text-red-400">
                  {analysis.filter((m) => m.composite_stress_score >= 70).length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {meta && (
        <Card className="bg-gray-800/30 border-gray-700/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                Analyzed: <span className="text-white font-medium">{meta.analyzed}</span> markets
              </span>
              <span className="text-gray-400">
                Successful: <span className="text-green-400 font-medium">{meta.successful}</span> |
                Failed: <span className="text-red-400 font-medium">{meta.failed || 0}</span>
              </span>
              <Button onClick={fetchAnalysis} variant="outline" size="sm">
                Refresh Analysis
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {analysis.map((market) => (
          <Card
            key={market.ticker}
            className="bg-gray-800/40 border-gray-700/50 hover:border-gray-600/50 transition-all"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs font-mono">
                      {market.ticker.slice(0, 18)}
                    </Badge>
                    <Badge className={getStateColor(market.market_state)}>{market.market_state}</Badge>
                  </div>
                  <h3 className="text-sm font-medium text-white mb-1 truncate">{market.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {market.current_price && (
                      <span>
                        Price: <span className="text-white">${market.current_price}</span>
                      </span>
                    )}
                    {market.volume && (
                      <span>
                        Volume: <span className="text-white">{market.volume.toLocaleString()}</span>
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs text-gray-400 mb-1">Stress Score</div>
                  <div className={`text-3xl font-bold ${getStressColor(market.composite_stress_score)}`}>
                    {market.composite_stress_score}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Confidence: {(market.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>

              <div className="mt-3 h-2 bg-gray-700/50 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    market.composite_stress_score >= 70
                      ? 'bg-red-500'
                      : market.composite_stress_score >= 40
                      ? 'bg-orange-500'
                      : market.composite_stress_score >= 20
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(market.composite_stress_score, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
