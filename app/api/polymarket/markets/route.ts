import { NextRequest, NextResponse } from 'next/server';
import { getPolymarketClient } from '@/lib/polymarket-client';

interface PolymarketMarket {
  market_id: string;
  ticker: string;
  title: string;
  current_price?: number;
  event_date?: string | null;
  liquidity?: number;
  open_interest?: number;
  volume?: number;
  status?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '20');
    const cursor = searchParams.get('cursor') || undefined;

    const client = await getPolymarketClient();
    const payload = await client.getSimplifiedMarkets(cursor);

    const rawMarkets = Array.isArray(payload?.data) ? payload.data : [];
    const markets = rawMarkets.slice(0, limit).map(normalizeMarket).filter((m) => !!m.ticker);

    if (markets.length === 0) {
      return NextResponse.json({
        success: true,
        total: 10,
        markets: generateMockPolymarketMarkets(10),
        note: 'Mock data - no live Polymarket markets returned',
      });
    }

    return NextResponse.json({
      success: true,
      total: markets.length,
      cursor: payload?.next_cursor,
      markets,
    });
  } catch (error) {
    console.error('Polymarket markets API error:', error);
    return NextResponse.json({
      success: true,
      total: 10,
      markets: generateMockPolymarketMarkets(10),
      note: 'Mock data - Polymarket API unavailable',
    });
  }
}

function normalizeMarket(market: any): PolymarketMarket {
  const conditionId = String(
    market?.condition_id ?? market?.conditionId ?? market?.id ?? market?.market ?? market?.slug ?? ''
  );

  const title = String((market?.question ?? market?.title ?? market?.name ?? conditionId) || 'Polymarket Market');

  const yesPrice = toNumber(
    market?.yes_price ?? market?.yesPrice ?? market?.last_trade_price ?? market?.lastTradePrice
  );

  const noPrice = toNumber(market?.no_price ?? market?.noPrice);

  const currentPrice =
    yesPrice ??
    (typeof noPrice === 'number' ? Math.max(0, Math.min(1, 1 - noPrice)) : undefined) ??
    extractPriceFromOutcomes(market);

  const volume = toNumber(market?.volume ?? market?.volume_24h ?? market?.volumeNum) ?? 0;
  const liquidity = toNumber(market?.liquidity ?? market?.liquidity_num ?? market?.liquidityClob) ?? 0;
  const openInterest = toNumber(market?.open_interest ?? market?.openInterest) ?? 0;
  const active = market?.active ?? market?.is_active;

  return {
    market_id: conditionId,
    ticker: conditionId,
    title,
    current_price: currentPrice,
    event_date: market?.end_date_iso ?? market?.end_date ?? market?.endDate ?? null,
    liquidity,
    open_interest: openInterest,
    volume,
    status: active === false ? 'closed' : 'active',
  };
}

function extractPriceFromOutcomes(market: any): number | undefined {
  const outcomes = market?.outcomes;
  if (!Array.isArray(outcomes) || outcomes.length === 0) {
    return undefined;
  }

  const yesOutcome = outcomes.find((o: any) => {
    const label = String(o?.name ?? o?.label ?? '').toUpperCase();
    return label.includes('YES');
  });

  if (!yesOutcome) {
    return undefined;
  }

  return toNumber(yesOutcome?.price ?? yesOutcome?.last_price ?? yesOutcome?.lastTradePrice);
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function generateMockPolymarketMarkets(count: number): PolymarketMarket[] {
  const now = Date.now();

  return Array.from({ length: count }).map((_, index) => {
    const id = `poly_mock_${index + 1}`;
    return {
      market_id: id,
      ticker: id,
      title: `Mock Polymarket ${index + 1}: Sample outcome market`,
      current_price: Number((0.2 + Math.random() * 0.6).toFixed(2)),
      event_date: new Date(now + (index + 1) * 86400000).toISOString(),
      liquidity: Math.floor(25000 + Math.random() * 80000),
      open_interest: Math.floor(10000 + Math.random() * 50000),
      volume: Math.floor(5000 + Math.random() * 120000),
      status: 'active',
    };
  });
}
