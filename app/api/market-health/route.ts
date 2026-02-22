import { NextRequest, NextResponse } from 'next/server';

interface MarketMetadata {
  ticker?: string;
  title?: string;
  event_date?: string | null;
  liquidity?: number;
  open_interest?: number;
  volume?: number;
  status?: string;
  current_price?: string | number;
}

interface StressMetrics {
  volatility_index: number;
  imbalance_ratio: number;
  volume_spike_score: number;
  liquidity_stress: number;
  acceleration_score: number;
  composite_stress_score: number;
}

interface TradeSummary {
  total_trades?: number;
  total_volume?: number;
  price_range?: { min: number; max: number };
  yes_volume?: number;
  no_volume?: number;
  recent_trend?: string;
}

interface MarketHealthInput {
  market_metadata: MarketMetadata;
  stress_metrics: StressMetrics;
  recent_trade_summary: TradeSummary;
}

interface MarketHealthResponse {
  market_state: string;
  confidence: number;
  primary_drivers: string[];
  risk_explanation: string;
  short_term_outlook: string;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'NVIDIA_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body: MarketHealthInput = await request.json();
    const { market_metadata, stress_metrics, recent_trade_summary } = body;

    // Validate input
    if (!market_metadata || !stress_metrics || !recent_trade_summary) {
      return NextResponse.json(
        { error: 'Missing required fields: market_metadata, stress_metrics, recent_trade_summary' },
        { status: 400 }
      );
    }

    // Construct analysis prompt
    const systemPrompt = `You are a financial market microstructure analyst.

Given the following structured metrics, assess whether this market is:

- Stable
- Elevated Volatility
- Stress Accumulation
- Information Shock
- Liquidity Breakdown

Return structured JSON ONLY (no markdown, no explanation):

{
  "market_state": "",
  "confidence": 0-1,
  "primary_drivers": [],
  "risk_explanation": "",
  "short_term_outlook": ""
}

Do not hallucinate. Only reason from provided metrics.`;

    const userPrompt = `Market Metadata:
- Ticker: ${market_metadata.ticker || 'N/A'}
- Title: ${market_metadata.title || 'N/A'}
- Current Price: ${market_metadata.current_price || 'N/A'}
- Event Date: ${market_metadata.event_date || 'N/A'}
- Liquidity: ${market_metadata.liquidity || 0}
- Open Interest: ${market_metadata.open_interest || 0}
- Volume: ${market_metadata.volume || 0}
- Status: ${market_metadata.status || 'N/A'}

Stress Metrics:
- Volatility Index: ${stress_metrics.volatility_index}/100
- Order Imbalance Ratio: ${stress_metrics.imbalance_ratio}/100
- Volume Spike Score: ${stress_metrics.volume_spike_score}/100
- Liquidity Stress: ${stress_metrics.liquidity_stress}/100
- Price Acceleration: ${stress_metrics.acceleration_score}/100
- Composite Stress Score: ${stress_metrics.composite_stress_score}/100

Recent Trade Summary:
- Total Trades: ${recent_trade_summary.total_trades || 0}
- Total Volume: ${recent_trade_summary.total_volume || 0}
- YES Volume: ${recent_trade_summary.yes_volume || 0}
- NO Volume: ${recent_trade_summary.no_volume || 0}
- Price Range: ${recent_trade_summary.price_range ? `${recent_trade_summary.price_range.min} - ${recent_trade_summary.price_range.max}` : 'N/A'}
- Recent Trend: ${recent_trade_summary.recent_trend || 'N/A'}

Analyze the market state based on these metrics only.`;

    // Call Nemotron API
    const response = await fetch(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-70b-instruct',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: userPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Nemotron API error:', response.status, errorText);
      console.warn('Falling back to rule-based assessment');
      
      // Fall back to rule-based assessment
      return NextResponse.json(
        generateFallbackAssessment(stress_metrics),
        { status: 200 }
      );
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';

    // Parse AI response
    let healthAssessment: MarketHealthResponse;
    try {
      // Clean response (remove markdown if present)
      let cleanedResponse = aiResponse.trim();
      cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Extract JSON via regex if needed
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

      healthAssessment = JSON.parse(cleanedResponse);

      // Validate structure
      if (
        !healthAssessment.market_state ||
        healthAssessment.confidence === undefined ||
        !Array.isArray(healthAssessment.primary_drivers)
      ) {
        throw new Error('Invalid response structure from AI');
      }

    } catch (parseError) {
      console.warn('Failed to parse AI response, using fallback:', parseError);
      
      // Fallback: rule-based assessment
      healthAssessment = generateFallbackAssessment(stress_metrics);
    }

    return NextResponse.json({
      success: true,
      assessment: healthAssessment,
      meta: {
        ticker: market_metadata.ticker,
        composite_stress: stress_metrics.composite_stress_score,
      },
    });

  } catch (error) {
    console.error('Market health API error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Generate fallback assessment using rule-based logic
 */
function generateFallbackAssessment(stress_metrics: StressMetrics): MarketHealthResponse {
  const composite = stress_metrics.composite_stress_score;
  
  let market_state: string;
  let confidence: number;
  let primary_drivers: string[];
  let risk_explanation: string;
  let short_term_outlook: string;

  if (composite < 20) {
    market_state = 'Stable';
    confidence = 0.85;
    primary_drivers = ['Low volatility', 'Balanced order flow'];
    risk_explanation = 'Market conditions appear normal with minimal stress indicators.';
    short_term_outlook = 'Stable trading expected to continue.';
  } else if (composite < 40) {
    market_state = 'Elevated Volatility';
    confidence = 0.75;
    primary_drivers = ['Moderate price swings', 'Increased trading activity'];
    risk_explanation = 'Market showing elevated activity but within normal ranges.';
    short_term_outlook = 'Continued volatility likely in near term.';
  } else if (composite < 60) {
    market_state = 'Stress Accumulation';
    confidence = 0.70;
    primary_drivers = ['High volatility', 'Order imbalance', 'Volume spikes'];
    risk_explanation = 'Multiple stress indicators suggest building market pressure.';
    short_term_outlook = 'Monitor closely for potential escalation.';
  } else if (composite < 80) {
    market_state = 'Information Shock';
    confidence = 0.65;
    primary_drivers = ['Rapid price acceleration', 'Extreme order imbalance', 'Liquidity stress'];
    risk_explanation = 'Market reacting to significant new information or event.';
    short_term_outlook = 'High uncertainty; expect continued volatility.';
  } else {
    market_state = 'Liquidity Breakdown';
    confidence = 0.80;
    primary_drivers = ['Critical liquidity stress', 'Extreme volatility', 'Price acceleration'];
    risk_explanation = 'Market showing signs of liquidity crisis or major disruption.';
    short_term_outlook = 'High risk; potential for further deterioration.';
  }

  return {
    market_state,
    confidence,
    primary_drivers,
    risk_explanation,
    short_term_outlook,
  };
}
