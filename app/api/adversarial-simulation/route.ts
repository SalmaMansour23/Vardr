import { NextRequest, NextResponse } from 'next/server';
import { openRouterChat, getAgentModel } from '../../lib/openrouter';
import {
  LAST_HOUR_MS,
  LAST_24H_MS,
  RAPID_SEQUENCE_WINDOW_MS,
  LAST_HOUR_CONCENTRATION_RATIO,
  TRADER_CONCENTRATION_MIN,
  MIN_TRADERS_FOR_CONCENTRATION,
  SIMILARITY_THRESHOLD,
  RAPID_SEQUENCE_MIN_COUNT,
  RAPID_SEQUENCE_RATIO,
} from '../../lib/feature-config';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPEN_ROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPEN_ROUTER_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Parse request body (support frontend shape: market_structure, information, actual_pattern)
    const body = await request.json();
    let { contract_data, trade_data } = body;

    if ((!contract_data || typeof contract_data !== 'object') && body.actual_pattern) {
      contract_data = {
        name: body.market_structure?.type ?? 'Prediction market',
        description: body.information ?? 'N/A',
        announcementTime: body.actual_pattern.drift_time ?? null,
        currentPrice: 'N/A',
        riskScore: 'N/A',
      };
    }
    if (!Array.isArray(trade_data)) {
      trade_data = [];
    }

    if (!contract_data || typeof contract_data !== 'object') {
      return NextResponse.json(
        { error: 'Missing or invalid "contract_data" or "actual_pattern" field' },
        { status: 400 }
      );
    }

    // Build summary of contract and trade data
    const contractSummary = `
Contract: ${contract_data.name || 'Unknown'}
Description: ${contract_data.description || 'N/A'}
Announcement Time: ${contract_data.announcementTime ? new Date(contract_data.announcementTime).toISOString() : 'N/A'}
Current Price: ${contract_data.currentPrice || 'N/A'}
Total Trades: ${trade_data.length}
`;

    // Analyze trade patterns
    const tradeSummary = trade_data.slice(0, 50).map((trade: any, i: number) => {
      const timestamp = trade.timestamp ? new Date(trade.timestamp).toISOString() : 'N/A';
      const traderId = trade.traderId || 'Unknown';
      const size = trade.size || 0;
      const direction = trade.direction || 'N/A';
      return `Trade ${i + 1}: ${traderId} | ${direction} | Size: ${size} | Time: ${timestamp}`;
    }).join('\n');

    const systemPrompt = `You are a market manipulation detection expert. Analyze this prediction market and simulate what an optimal manipulation strategy would look like if a coordinated group wanted to profit from advance information before the official announcement.

MARKET DATA:
${contractSummary}

ACTUAL TRADES (Sample):
${tradeSummary}

ADVERSARIAL SIMULATION TASK:
If a coordinated group with advance information wanted to manipulate this market before the announcement, describe the OPTIMAL strategy they would use.

Consider:
1. **Trade Timing Pattern**: When would they enter positions? (e.g., "gradual accumulation 48-24 hours before", "sudden spike 2 hours before")
2. **Volume Pattern**: How would they size their trades? (e.g., "small incremental buys to avoid detection", "large coordinated buys")
3. **Coordination Pattern**: How would multiple accounts coordinate? (e.g., "sequential trades across accounts", "simultaneous entries")
4. **Narrative Seeding**: What social signals would they plant? (e.g., "leak rumors 12 hours prior", "spread misinformation")

CRITICAL: Return ONLY valid JSON. No markdown, no explanation outside JSON.

Format:
{
  "simulated_strategy": {
    "timing_pattern": "detailed description of optimal timing",
    "volume_pattern": "detailed description of optimal sizing",
    "coordination_pattern": "detailed description of coordination approach",
    "narrative_pattern": "detailed description of narrative seeding"
  },
  "key_indicators": [
    "specific indicator 1",
    "specific indicator 2"
  ]
}`;

    const result = await openRouterChat(apiKey, {
      model: getAgentModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the adversarial simulation now. Return only JSON.' },
      ],
      temperature: 0.5,
      max_tokens: 1200,
    });

    if ('error' in result) {
      console.error('Open Router API error:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    let generatedText = result.content;

    // Clean up response - remove markdown code blocks if present
    generatedText = generatedText.trim();
    if (generatedText.startsWith('```json')) {
      generatedText = generatedText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (generatedText.startsWith('```')) {
      generatedText = generatedText.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    // Parse the JSON response from the model
    try {
      const parsedResult = JSON.parse(generatedText);

      // Validate the structure
      if (!parsedResult.simulated_strategy) {
        console.warn('Invalid response: missing simulated_strategy', parsedResult);
        return NextResponse.json(
          { error: 'Invalid response structure: missing simulated_strategy' },
          { status: 500 }
        );
      }

      const strategy = parsedResult.simulated_strategy;
      if (!strategy.timing_pattern || !strategy.volume_pattern || !strategy.coordination_pattern) {
        console.warn('Invalid strategy structure:', strategy);
        return NextResponse.json(
          { error: 'Invalid strategy structure: missing required patterns' },
          { status: 500 }
        );
      }

      // Compare simulated strategy to actual trade patterns
      const comparison = compareStrategyToActual(parsedResult.simulated_strategy, trade_data, contract_data);

      // Return both the simulation and the comparison
      return NextResponse.json({
        simulated_strategy: parsedResult.simulated_strategy,
        key_indicators: parsedResult.key_indicators || [],
        actual_pattern_analysis: comparison.analysis,
        similarity_score: comparison.similarity_score,
        risk_adjustment: comparison.risk_adjustment,
        anomalies_detected: comparison.anomalies,
      });
    } catch (parseError) {
      console.error('Failed to parse model response as JSON:', generatedText);
      return NextResponse.json(
        {
          error: 'Failed to parse model response as JSON',
          rawResponse: generatedText.substring(0, 500),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Adversarial simulation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Compare simulated manipulation strategy to actual trade patterns
 */
function compareStrategyToActual(
  simulatedStrategy: any,
  tradeData: any[],
  contractData: any
): {
  analysis: string;
  similarity_score: number;
  risk_adjustment: number;
  anomalies: string[];
} {
  const anomalies: string[] = [];
  let similarityScore = 0;
  const factors = [];

  if (tradeData.length === 0) {
    return {
      analysis: 'Insufficient trade data for comparison',
      similarity_score: 0,
      risk_adjustment: 0,
      anomalies: [],
    };
  }

  const announcementTime = contractData.announcementTime || Date.now();
  
  // Analyze timing patterns
  const preEventTrades = tradeData.filter((t: any) => 
    t.timestamp && t.timestamp < announcementTime
  );
  
  const lastHourTrades = preEventTrades.filter((t: any) =>
    announcementTime - t.timestamp < LAST_HOUR_MS
  );

  const last24HourTrades = preEventTrades.filter((t: any) =>
    announcementTime - t.timestamp < LAST_24H_MS
  );

  if (lastHourTrades.length > preEventTrades.length * LAST_HOUR_CONCENTRATION_RATIO) {
    anomalies.push('High concentration of trades in final hour before announcement');
    similarityScore += 25;
    factors.push('Timing concentration matches manipulation pattern');
  }

  // Analyze volume patterns
  const tradeSizes = tradeData.map((t: any) => t.size || 0);
  const avgSize = tradeSizes.reduce((a: number, b: number) => a + b, 0) / tradeSizes.length;
  const preEventSizes = preEventTrades.map((t: any) => t.size || 0);
  const preEventAvg = preEventSizes.reduce((a: number, b: number) => a + b, 0) / preEventSizes.length;

  if (preEventAvg > avgSize * 1.5) {
    anomalies.push('Pre-event trade sizes significantly larger than average');
    similarityScore += 25;
    factors.push('Volume pattern consistent with coordinated accumulation');
  }

  // Analyze coordination patterns (trader concentration)
  const traderCounts: Record<string, number> = {};
  preEventTrades.forEach((t: any) => {
    const trader = t.traderId || 'unknown';
    traderCounts[trader] = (traderCounts[trader] || 0) + 1;
  });

  const traders = Object.keys(traderCounts);
  const maxTradesPerTrader = Math.max(...Object.values(traderCounts));
  const concentration = maxTradesPerTrader / preEventTrades.length;

  if (concentration > TRADER_CONCENTRATION_MIN && traders.length < MIN_TRADERS_FOR_CONCENTRATION) {
    anomalies.push('High concentration of trades from few accounts');
    similarityScore += 25;
    factors.push('Coordination pattern suggests organized activity');
  }

  // Check for sequential patterns
  const tradeSequences = analyzeTradeSequences(preEventTrades);
  if (tradeSequences.hasRapidSequence) {
    anomalies.push('Rapid sequential trades detected from multiple accounts');
    similarityScore += 25;
    factors.push('Sequential coordination detected');
  }

  let riskAdjustment = 0;
  if (similarityScore >= SIMILARITY_THRESHOLD) {
    riskAdjustment = Math.min(30, Math.floor((similarityScore - SIMILARITY_THRESHOLD) / 2));
  }

  const analysis = factors.length > 0
    ? `Pattern analysis reveals ${factors.length} indicators matching simulated manipulation strategy: ${factors.join('; ')}`
    : 'No significant pattern matches detected with simulated manipulation strategy';

  return {
    analysis,
    similarity_score: Math.min(100, similarityScore),
    risk_adjustment: riskAdjustment,
    anomalies,
  };
}

/**
 * Analyze trade sequences for patterns
 */
function analyzeTradeSequences(trades: any[]): { hasRapidSequence: boolean } {
  if (trades.length < 3) return { hasRapidSequence: false };

  const sortedTrades = [...trades].sort((a, b) => 
    (a.timestamp || 0) - (b.timestamp || 0)
  );

  let rapidCount = 0;
  for (let i = 1; i < sortedTrades.length; i++) {
    const timeDiff = sortedTrades[i].timestamp - sortedTrades[i - 1].timestamp;
    if (timeDiff < RAPID_SEQUENCE_WINDOW_MS && sortedTrades[i].traderId !== sortedTrades[i - 1].traderId) {
      rapidCount++;
    }
  }

  return {
    hasRapidSequence: rapidCount > Math.min(RAPID_SEQUENCE_MIN_COUNT, sortedTrades.length * RAPID_SEQUENCE_RATIO),
  };
}
