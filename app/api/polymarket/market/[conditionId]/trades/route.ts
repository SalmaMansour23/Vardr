import { NextRequest, NextResponse } from 'next/server';
import { getPolymarketClient } from '@/lib/polymarket-client';

interface TradeResponse {
  timestamp: string;
  price: string;
  size: number;
  side: string;
  trade_id: string;
  ticker: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conditionId: string }> }
) {
  let conditionId = '';

  try {
    const resolved = await params;
    conditionId = resolved.conditionId;

    if (!conditionId) {
      return NextResponse.json(
        { error: 'conditionId is required', trades: [] },
        { status: 400 }
      );
    }

    const client = await getPolymarketClient();
    const trades = await client.getTrades({ market: conditionId }, true);

    if (!Array.isArray(trades) || trades.length === 0) {
      return NextResponse.json({
        success: true,
        total: 50,
        ticker: conditionId,
        trades: generateMockTrades(conditionId, 50),
        note: 'Mock data - no live trades returned',
      });
    }

    const structuredTrades: TradeResponse[] = trades.map((trade: any) => ({
      timestamp: trade?.match_time ?? trade?.last_update ?? new Date().toISOString(),
      price: Number(trade?.price ?? 0).toFixed(2),
      size: Number(trade?.size ?? 1),
      side: inferSide(trade),
      trade_id: String(trade?.id ?? `trade_${Math.random().toString(36).slice(2)}`),
      ticker: conditionId,
    }));

    return NextResponse.json({
      success: true,
      total: structuredTrades.length,
      ticker: conditionId,
      trades: structuredTrades,
    });
  } catch (error) {
    console.error('Polymarket trades API error:', error);

    return NextResponse.json({
      success: true,
      total: 50,
      ticker: conditionId,
      trades: generateMockTrades(conditionId, 50),
      note: 'Mock data - Polymarket trades unavailable',
    });
  }
}

function inferSide(trade: any): string {
  const outcome = String(trade?.outcome ?? '').toUpperCase();
  if (outcome.includes('YES')) return 'YES';
  if (outcome.includes('NO')) return 'NO';

  const side = String(trade?.side ?? '').toUpperCase();
  return side === 'BUY' ? 'YES' : 'NO';
}

function generateMockTrades(conditionId: string, count: number): TradeResponse[] {
  const now = Date.now();
  const trades: TradeResponse[] = [];

  for (let i = 0; i < count; i++) {
    const minutesAgo = Math.floor(Math.random() * 1440);
    const price = 0.25 + Math.random() * 0.5;

    trades.push({
      timestamp: new Date(now - minutesAgo * 60000).toISOString(),
      price: price.toFixed(2),
      size: Math.floor(25 + Math.random() * 3000),
      side: Math.random() > 0.5 ? 'YES' : 'NO',
      trade_id: `poly_mock_${conditionId}_${i}`,
      ticker: conditionId,
    });
  }

  return trades;
}
