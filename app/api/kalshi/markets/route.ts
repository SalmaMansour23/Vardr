import { NextRequest, NextResponse } from 'next/server';
import { getMarketApi } from '@/lib/kalshi-client';

interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  market_ticker: string;
  title: string;
  subtitle?: string;
  open_time?: string;
  close_time?: string;
  expiration_time?: string;
  status: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  previous_yes_bid?: number;
  volume?: number;
  volume_24h?: number;
  liquidity?: number;
  open_interest?: number;
  result?: string;
  can_close_early?: boolean;
  expiration_value?: string;
  category?: string;
  risk_limit_cents?: number;
  strike_type?: string;
  floor_strike?: number;
  cap_strike?: number;
}

interface KalshiMarketsResponse {
  cursor?: string;
  markets: KalshiMarket[];
}

export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const status = searchParams.get('status') || 'active';
    const cursor = searchParams.get('cursor') || undefined;

    // Use Kalshi TypeScript SDK with proper authentication
    try {
      const marketApi = getMarketApi();
      
      const response = await marketApi.getMarkets(
        limit,      // limit
        cursor,     // cursor
        undefined,  // eventTicker
        undefined,  // seriesTicker
        undefined,  // minCreatedTs
        undefined,  // maxCreatedTs
        undefined,  // minUpdatedTs
        undefined,  // maxCloseTs
        undefined,  // minCloseTs
        undefined,  // minSettledTs
        undefined,  // maxSettledTs
        status as any // status (position 12!)
      );

      const data = response.data;

      if (!data.markets || data.markets.length === 0) {
        console.warn('No markets returned from Kalshi API, using fallback');
        return NextResponse.json(
          { error: 'No markets available', markets: generateFallbackMarkets(20) },
          { status: 200 }
        );
      }

      // Transform to structured format
      const structuredMarkets = data.markets.map((market: any) => {
      // Calculate current price (midpoint of yes bid/ask)
      let current_price = market.last_price;
      if (!current_price && market.yes_bid !== undefined && market.yes_ask !== undefined) {
        current_price = (market.yes_bid + market.yes_ask) / 2;
      }

      // Determine event date (use close_time or expiration_time)
      const event_date = market.close_time || market.expiration_time || null;

      return {
        market_id: market.market_ticker || market.ticker,
        ticker: market.ticker,
        event_ticker: market.event_ticker,
        title: market.title,
        subtitle: market.subtitle,
        current_price: current_price ? (current_price / 100).toFixed(2) : null, // Convert cents to dollars
        yes_bid: market.yes_bid ? (market.yes_bid / 100).toFixed(2) : null,
        yes_ask: market.yes_ask ? (market.yes_ask / 100).toFixed(2) : null,
        no_bid: market.no_bid ? (market.no_bid / 100).toFixed(2) : null,
        no_ask: market.no_ask ? (market.no_ask / 100).toFixed(2) : null,
        volume: market.volume || market.volume_24h || 0,
        liquidity: market.liquidity || 0,
        open_interest: market.open_interest || 0,
        event_date,
        status: market.status,
        category: market.category || 'Unknown',
        open_time: market.open_time,
        close_time: market.close_time,
        result: market.result,
      };
    });

    return NextResponse.json({
      success: true,
      total: structuredMarkets.length,
      cursor: data.cursor,
      markets: structuredMarkets,
    });

    } catch (authError) {
      console.error('Kalshi authentication error:', authError);
      console.warn('Using fallback mock markets due to auth failure');
      return NextResponse.json({
        success: true,
        total: 20,
        markets: generateFallbackMarkets(20),
        note: 'Using mock data - Kalshi authentication failed'
      });
    }

  } catch (error) {
    console.error('Kalshi markets API error:', error);
    return NextResponse.json(
      { 
        success: true,
        total: 20,
        markets: generateFallbackMarkets(20),
        note: 'Using mock data - API error'
      },
      { status: 200 }
    );
  }
}

/**
 * Generate fallback markets when Kalshi API unavailable
 */
function generateFallbackMarkets(count: number) {
  const tickers = [
    'PREZ-2028', 'FED-MAR26', 'SPX-Q1-2026', 'BTC-50K', 'TECH-RALLY',
    'GDP-Q1', 'UNEMP-FEB', 'INFLATION-MAR', 'OIL-100', 'GOLD-3K',
    'CHIPS-PASS', 'AI-BILL', 'CLIMATE-2026', 'TAX-REFORM', 'NATO-EXPAND',
    'TESLA-SPLIT', 'APPLE-5T', 'NVIDIA-AI', 'META-VR', 'AMAZON-DRONE'
  ];

  return tickers.slice(0, count).map((ticker, i) => ({
    ticker,
    title: `Mock Market: ${ticker}`,
    status: 'active',
    current_price: 0.30 + Math.random() * 0.40,
    volume_24h: Math.floor(Math.random() * 100000),
    open_interest: Math.floor(Math.random() * 50000),
  }));
}

