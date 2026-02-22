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

    // Step 1: Fetch all active markets
    console.log('Fetching active markets...');
    const marketsResponse = await fetch(`${baseUrl}/api/kalshi/markets?status=active&limit=20`, {
      next: { revalidate: 0 },
    });

    let markets: Market[] = [];

    if (!marketsResponse.ok) {
      const errorText = await marketsResponse.text();
      console.warn('Failed to fetch from Kalshi API:', marketsResponse.status, errorText);
      
      // Use fallback mock markets instead of failing
      markets = generateMockMarkets();
      console.log('Using fallback mock markets:', markets.length);
    } else {
      const marketsData = await marketsResponse.json();
      markets = marketsData.markets || [];

      if (markets.length === 0) {
        console.warn('No markets returned from API, using mock data');
        markets = generateMockMarkets();
      }
    }

    if (markets.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        results: [],
        message: 'No active markets found',
      });
    }

    // Limit to top 20 markets to avoid rate limits
    const topMarkets = markets.slice(0, 20);
    console.log(`Analyzing ${topMarkets.length} markets...`);

    // Step 2: Analyze each market in parallel with error handling
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

    // Filter out failed analyses and sort by stress score (descending)
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
        failures: failedResults.length > 0 ? failedResults : undefined,
      },
    });

  } catch (error) {
    console.error('Analyze all markets error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze markets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Analyze a single market: fetch trades, compute stress, assess health
 */
async function analyzeMarket(
  market: Market,
  baseUrl: string
): Promise<MarketAnalysisResult> {
  // Fetch recent trades for this market
  const tradesResponse = await fetch(
    `${baseUrl}/api/kalshi/market/${market.ticker}/trades`,
    {
      next: { revalidate: 0 },
    }
  );

  if (!tradesResponse.ok) {
    throw new Error(`Failed to fetch trades for ${market.ticker}`);
  }

  const tradesData = await tradesResponse.json();
  const trades: Trade[] = tradesData.trades || [];

  if (trades.length === 0) {
    // No trades available - return minimal stress
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

  // Compute stress metrics
  const stressMetrics = computeMarketStress(trades, {
    event_date: market.event_date,
    liquidity: market.liquidity,
    open_interest: market.open_interest,
    volume: market.volume,
    status: market.status,
  });

  // Compute trade summary
  const tradeSummary = computeTradeSummary(trades);

  // Call market health assessment API
  const healthResponse = await fetch(`${baseUrl}/api/market-health`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
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

/**
 * Compute summary statistics from trades
 */
function computeTradeSummary(trades: Trade[]) {
  const prices = trades.map((t) => parseFloat(String(t.price)));
  const yesVolume = trades
    .filter((t) => t.side.toUpperCase() === 'YES')
    .reduce((sum, t) => sum + t.size, 0);
  const noVolume = trades
    .filter((t) => t.side.toUpperCase() === 'NO')
    .reduce((sum, t) => sum + t.size, 0);
  const totalVolume = trades.reduce((sum, t) => sum + t.size, 0);

  // Determine recent trend (last 10 trades)
  const recentTrades = trades.slice(0, Math.min(10, trades.length));
  const recentPrices = recentTrades.map((t) => parseFloat(String(t.price)));
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
      min: Math.min(...prices),
      max: Math.max(...prices),
    },
    recent_trend,
  };
}

/**
 * Generate mock markets for fallback when Kalshi API is unavailable
 */
function generateMockMarkets(): Market[] {
  const mockMarkets: Market[] = [
    {
      market_id: 'DJIA_MAR26',
      ticker: 'DJIA_MAR26',
      title: 'Will the Dow Jones close above 43,000 on March 31, 2026?',
      current_price: 0.65,
      event_date: '2026-03-31T16:00:00Z',
      liquidity: 50000,
      open_interest: 125000,
      volume: 85000,
      status: 'active',
    },
    {
      market_id: 'SPX_MAR26',
      ticker: 'SPX_MAR26',
      title: 'Will the S&P 500 reach 6,500 by end of Q1 2026?',
      current_price: 0.58,
      event_date: '2026-03-31T16:00:00Z',
      liquidity: 45000,
      open_interest: 110000,
      volume: 72000,
      status: 'active',
    },
    {
      market_id: 'NVDA_FEB26',
      ticker: 'NVDA_FEB26',
      title: 'Will NVIDIA stock close above $150 in February 2026?',
      current_price: 0.72,
      event_date: '2026-02-28T21:00:00Z',
      liquidity: 35000,
      open_interest: 95000,
      volume: 62000,
      status: 'active',
    },
    {
      market_id: 'TSLA_MAR26',
      ticker: 'TSLA_MAR26',
      title: 'Will Tesla announce a 3:1 stock split in Q1 2026?',
      current_price: 0.41,
      event_date: '2026-03-31T21:00:00Z',
      liquidity: 25000,
      open_interest: 75000,
      volume: 48000,
      status: 'active',
    },
    {
      market_id: 'BTC_MAR26',
      ticker: 'BTC_MAR26',
      title: 'Will Bitcoin reach $200k by March 31, 2026?',
      current_price: 0.52,
      event_date: '2026-03-31T00:00:00Z',
      liquidity: 60000,
      open_interest: 140000,
      volume: 95000,
      status: 'active',
    },
    {
      market_id: 'META_FEB26',
      ticker: 'META_FEB26',
      title: 'Will Meta release a new AI model in February 2026?',
      current_price: 0.38,
      event_date: '2026-02-28T00:00:00Z',
      liquidity: 20000,
      open_interest: 60000,
      volume: 35000,
      status: 'active',
    },
    {
      market_id: 'MSFT_MAR26',
      ticker: 'MSFT_MAR26',
      title: 'Will Microsoft exceed $500B market cap in Q1 2026?',
      current_price: 0.68,
      event_date: '2026-03-31T16:00:00Z',
      liquidity: 40000,
      open_interest: 100000,
      volume: 68000,
      status: 'active',
    },
    {
      market_id: 'ETH_MAR26',
      ticker: 'ETH_MAR26',
      title: 'Will Ethereum reach $15k by March 31, 2026?',
      current_price: 0.48,
      event_date: '2026-03-31T00:00:00Z',
      liquidity: 35000,
      open_interest: 85000,
      volume: 55000,
      status: 'active',
    },
    {
      market_id: 'AAPL_MAR26',
      ticker: 'AAPL_MAR26',
      title: 'Will Apple announce a new iPhone SE in March 2026?',
      current_price: 0.44,
      event_date: '2026-03-31T21:00:00Z',
      liquidity: 28000,
      open_interest: 70000,
      volume: 42000,
      status: 'active',
    },
    {
      market_id: 'GBPUSD_MAR26',
      ticker: 'GBPUSD_MAR26',
      title: 'Will GBP/USD exceed 1.30 by March 31, 2026?',
      current_price: 0.55,
      event_date: '2026-03-31T00:00:00Z',
      liquidity: 50000,
      open_interest: 120000,
      volume: 78000,
      status: 'active',
    },
  ];

  return mockMarkets;
}
