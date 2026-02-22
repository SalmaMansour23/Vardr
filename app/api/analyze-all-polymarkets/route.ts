import { NextRequest, NextResponse } from 'next/server';
import { computeMarketStress } from '@/lib/computeMarketStress';

interface Market {
  market_id: string;
  ticker: string;
  title: string;
  current_price?: string | number;
  event_date?: string | null;
  liquidity?: number;
  open_interest?: number;
  volume?: number;
  status?: string;
}

interface Trade {
  timestamp: string;
  price: string | number;
  size: number;
  side: string;
}

interface MarketAnalysisResult {
  ticker: string;
  title: string;
  composite_stress_score: number;
  market_state: string;
  confidence: number;
  current_price?: string | number;
  volume?: number;
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    const baseUrl = request.nextUrl.origin;

    const marketsResponse = await fetch(`${baseUrl}/api/polymarket/markets?limit=20`, {
      next: { revalidate: 0 },
    });

    let markets: Market[] = [];

    if (!marketsResponse.ok) {
      const errorText = await marketsResponse.text();
      console.warn('Failed to fetch Polymarket markets:', marketsResponse.status, errorText);
      markets = generateMockPolymarketMarkets();
    } else {
      const marketsData = await marketsResponse.json();
      markets = marketsData.markets || [];

      if (markets.length === 0) {
        markets = generateMockPolymarketMarkets();
      }
    }

    const topMarkets = markets.slice(0, 20);

    const analysisPromises = topMarkets.map((market) =>
      analyzeMarket(market, baseUrl).catch((error) => ({
        ticker: market.ticker,
        title: market.title,
        composite_stress_score: 0,
        market_state: 'Unknown',
        confidence: 0,
        current_price: market.current_price,
        volume: market.volume,
        error: error instanceof Error ? error.message : 'Analysis failed',
      }))
    );

    const results = await Promise.all(analysisPromises);
    const successfulResults = results.filter((r) => !r.error);
    const failedResults = results.filter((r) => r.error);

    const sortedResults = successfulResults.sort(
      (a, b) => b.composite_stress_score - a.composite_stress_score
    );

    return NextResponse.json({
      success: true,
      total: sortedResults.length,
      results: sortedResults,
      meta: {
        analyzed: topMarkets.length,
        successful: successfulResults.length,
        failed: failedResults.length,
        source: 'polymarket',
      },
    });
  } catch (error) {
    console.error('Analyze all polymarkets error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze Polymarket markets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function analyzeMarket(market: Market, baseUrl: string): Promise<MarketAnalysisResult> {
  const tradesResponse = await fetch(
    `${baseUrl}/api/polymarket/market/${encodeURIComponent(market.ticker)}/trades`,
    { next: { revalidate: 0 } }
  );

  if (!tradesResponse.ok) {
    throw new Error(`Failed to fetch trades for ${market.ticker}`);
  }

  const tradesData = await tradesResponse.json();
  const trades: Trade[] = tradesData.trades || [];

  if (trades.length === 0) {
    return {
      ticker: market.ticker,
      title: market.title,
      composite_stress_score: 0,
      market_state: 'Stable',
      confidence: 0.5,
      current_price: market.current_price,
      volume: market.volume,
    };
  }

  const stressMetrics = computeMarketStress(trades, {
    event_date: market.event_date,
    liquidity: market.liquidity,
    open_interest: market.open_interest,
    volume: market.volume,
    status: market.status,
  });

  const tradeSummary = computeTradeSummary(trades);

  const healthResponse = await fetch(`${baseUrl}/api/market-health`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      market_metadata: {
        ticker: market.ticker,
        title: market.title,
        current_price: market.current_price,
        event_date: market.event_date,
        liquidity: market.liquidity,
        open_interest: market.open_interest,
        volume: market.volume,
        status: market.status,
      },
      stress_metrics: stressMetrics,
      recent_trade_summary: tradeSummary,
    }),
    next: { revalidate: 0 },
  });

  if (!healthResponse.ok) {
    throw new Error(`Failed to assess health for ${market.ticker}`);
  }

  const healthData = await healthResponse.json();
  const assessment = healthData.assessment || {};

  return {
    ticker: market.ticker,
    title: market.title,
    composite_stress_score: stressMetrics.composite_stress_score,
    market_state: assessment.market_state || 'Unknown',
    confidence: assessment.confidence || 0,
    current_price: market.current_price,
    volume: market.volume,
  };
}

function computeTradeSummary(trades: Trade[]) {
  const prices = trades.map((t) => parseFloat(String(t.price))).filter((p) => !Number.isNaN(p));
  const yesVolume = trades
    .filter((t) => t.side.toUpperCase() === 'YES')
    .reduce((sum, t) => sum + t.size, 0);
  const noVolume = trades
    .filter((t) => t.side.toUpperCase() === 'NO')
    .reduce((sum, t) => sum + t.size, 0);
  const totalVolume = trades.reduce((sum, t) => sum + t.size, 0);

  const recentTrades = trades.slice(0, Math.min(10, trades.length));
  const recentPrices = recentTrades.map((t) => parseFloat(String(t.price))).filter((p) => !Number.isNaN(p));
  let recent_trend = 'Stable';

  if (recentPrices.length >= 2) {
    const firstPrice = recentPrices[recentPrices.length - 1];
    const lastPrice = recentPrices[0];
    const change = ((lastPrice - firstPrice) / firstPrice) * 100;

    if (change > 5) recent_trend = 'Upward';
    else if (change < -5) recent_trend = 'Downward';
  }

  return {
    total_trades: trades.length,
    total_volume: totalVolume,
    yes_volume: yesVolume,
    no_volume: noVolume,
    price_range: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    },
    recent_trend,
  };
}

function generateMockPolymarketMarkets(): Market[] {
  return Array.from({ length: 10 }).map((_, index) => ({
    market_id: `poly_mock_${index + 1}`,
    ticker: `poly_mock_${index + 1}`,
    title: `Mock Polymarket ${index + 1}: macro event outcome`,
    current_price: Number((0.2 + Math.random() * 0.6).toFixed(2)),
    event_date: new Date(Date.now() + (index + 1) * 86400000).toISOString(),
    liquidity: Math.floor(25000 + Math.random() * 80000),
    open_interest: Math.floor(10000 + Math.random() * 50000),
    volume: Math.floor(5000 + Math.random() * 120000),
    status: 'active',
  }));
}
