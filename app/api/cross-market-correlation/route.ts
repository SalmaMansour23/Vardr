import { NextRequest, NextResponse } from 'next/server';

interface MarketWithStress {
  ticker: string;
  title: string;
  composite_stress_score: number;
  market_state?: string;
  confidence?: number;
  price_history?: number[];
  trades?: Array<{ timestamp: string; price: string | number }>;
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
  stress_level: string;
  markets: string[];
}

interface SystemicRiskResponse {
  systemic_clusters: StressCluster[];
  leading_markets: string[];
  contagion_risk_level: string;
  reasoning: string;
}

interface CrossMarketAnalysisInput {
  markets: MarketWithStress[];
}

export async function POST(request: NextRequest) {
  let markets: MarketWithStress[] = [];
  
  try {
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      console.warn('NVIDIA_API_KEY not configured - returning fallback analysis');
      return NextResponse.json({
        success: true,
        analysis: generateFallbackSystemicRisk([]),
        meta: { analyzed: 0, successful: 0 },
        raw_data: { correlations: [], lead_lag: [], clusters: [] },
      });
    }

    const body: CrossMarketAnalysisInput = await request.json();
    markets = body.markets || [];

    // Validate input
    if (!Array.isArray(markets) || markets.length === 0) {
      console.warn('No markets provided for correlation analysis');
      return NextResponse.json({
        success: true,
        analysis: generateFallbackSystemicRisk([]),
        meta: { analyzed: 0, successful: 0 },
        raw_data: { correlations: [], lead_lag: [], clusters: [] },
      });
    }

    console.log('Analyzing', markets.length, 'markets for systemic risk');

    // For single market, provide limited analysis
    if (markets.length < 2) {
      console.warn('Only 1 market provided, returning minimal analysis');
      return NextResponse.json({
        success: true,
        analysis: generateFallbackSystemicRisk(markets),
        meta: { analyzed: markets.length, successful: 1 },
        raw_data: { correlations: [], lead_lag: [], clusters: [] },
      });
    }

    // Step 1: Compute correlation matrix of price movements
    const correlations = computeCorrelationMatrix(markets);

    // Step 2: Detect lead-lag relationships
    const leadLagRelationships = detectLeadLag(markets);

    // Step 3: Cluster markets by stress levels
    const stressClusters = clusterMarketsByStress(markets);

    // Step 4: Call Nemotron for systemic risk analysis
    const systemicAnalysis = await analyzeSystemicRisk(
      markets,
      correlations,
      leadLagRelationships,
      stressClusters,
      apiKey
    );

    return NextResponse.json({
      success: true,
      analysis: systemicAnalysis,
      meta: {
        total_markets: markets.length,
        correlation_pairs: correlations.length,
        lead_lag_relationships: leadLagRelationships.length,
        clusters: stressClusters.length,
      },
      raw_data: {
        correlations: correlations.slice(0, 10), // Top 10 correlations
        lead_lag: leadLagRelationships.slice(0, 5), // Top 5 lead-lag pairs
        clusters: stressClusters,
      },
    });

  } catch (error) {
    console.error('Cross-market correlation API error:', error);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.warn('Returning fallback analysis due to error:', errorMsg);
    
    return NextResponse.json({
      success: true,
      analysis: generateFallbackSystemicRisk(markets),
      meta: { analyzed: markets.length, successful: 0, error: errorMsg },
      raw_data: { correlations: [], lead_lag: [], clusters: [] },
    });
  }
}

/**
 * Compute pairwise correlation matrix for price movements
 */
function computeCorrelationMatrix(markets: MarketWithStress[]): CorrelationResult[] {
  const correlations: CorrelationResult[] = [];

  // Extract price histories or generate from trades
  const marketPrices = markets.map((m) => {
    if (m.price_history && m.price_history.length > 0) {
      return { ticker: m.ticker, prices: m.price_history };
    } else if (m.trades && m.trades.length > 0) {
      return {
        ticker: m.ticker,
        prices: m.trades.map((t) => parseFloat(String(t.price))),
      };
    } else {
      return { ticker: m.ticker, prices: [] };
    }
  });

  // Compute pairwise correlations
  for (let i = 0; i < marketPrices.length; i++) {
    for (let j = i + 1; j < marketPrices.length; j++) {
      const prices1 = marketPrices[i].prices;
      const prices2 = marketPrices[j].prices;

      if (prices1.length < 2 || prices2.length < 2) continue;

      const correlation = computePearsonCorrelation(prices1, prices2);
      
      if (!isNaN(correlation)) {
        correlations.push({
          market1: marketPrices[i].ticker,
          market2: marketPrices[j].ticker,
          correlation: Number(correlation.toFixed(3)),
        });
      }
    }
  }

  // Sort by absolute correlation (strongest first)
  return correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
}

/**
 * Compute Pearson correlation coefficient
 */
function computePearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;

  const x_slice = x.slice(0, n);
  const y_slice = y.slice(0, n);

  const mean_x = x_slice.reduce((sum, val) => sum + val, 0) / n;
  const mean_y = y_slice.reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let sum_x_sq = 0;
  let sum_y_sq = 0;

  for (let i = 0; i < n; i++) {
    const dx = x_slice[i] - mean_x;
    const dy = y_slice[i] - mean_y;
    numerator += dx * dy;
    sum_x_sq += dx * dx;
    sum_y_sq += dy * dy;
  }

  const denominator = Math.sqrt(sum_x_sq * sum_y_sq);
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Detect lead-lag relationships between markets
 */
function detectLeadLag(markets: MarketWithStress[]): LeadLagResult[] {
  const leadLagPairs: LeadLagResult[] = [];

  // For simplicity, use stress scores and synthetic timing analysis
  // In production, would use actual time-series cross-correlation
  
  const sortedByStress = [...markets].sort(
    (a, b) => b.composite_stress_score - a.composite_stress_score
  );

  // High-stress markets tend to lead (information-driven price discovery)
  for (let i = 0; i < Math.min(3, sortedByStress.length); i++) {
    for (let j = i + 1; j < Math.min(5, sortedByStress.length); j++) {
      const stressDiff = sortedByStress[i].composite_stress_score - 
                        sortedByStress[j].composite_stress_score;
      
      if (stressDiff > 10) {
        leadLagPairs.push({
          leader: sortedByStress[i].ticker,
          follower: sortedByStress[j].ticker,
          lag_minutes: Math.min(30, Math.floor(stressDiff / 2)),
          confidence: Math.min(0.9, 0.5 + (stressDiff / 100)),
        });
      }
    }
  }

  return leadLagPairs;
}

/**
 * Cluster markets by stress levels
 */
function clusterMarketsByStress(markets: MarketWithStress[]): StressCluster[] {
  const clusters: StressCluster[] = [];

  // Simple threshold-based clustering
  const critical = markets.filter((m) => m.composite_stress_score >= 70);
  const high = markets.filter((m) => m.composite_stress_score >= 40 && m.composite_stress_score < 70);
  const moderate = markets.filter((m) => m.composite_stress_score >= 20 && m.composite_stress_score < 40);
  const low = markets.filter((m) => m.composite_stress_score < 20);

  if (critical.length > 0) {
    clusters.push({
      cluster_name: 'Critical Stress',
      stress_level: 'Critical (70+)',
      markets: critical.map((m) => `${m.ticker}: ${m.title}`),
    });
  }

  if (high.length > 0) {
    clusters.push({
      cluster_name: 'High Stress',
      stress_level: 'High (40-69)',
      markets: high.map((m) => `${m.ticker}: ${m.title}`),
    });
  }

  if (moderate.length > 0) {
    clusters.push({
      cluster_name: 'Moderate Stress',
      stress_level: 'Moderate (20-39)',
      markets: moderate.map((m) => `${m.ticker}: ${m.title}`),
    });
  }

  if (low.length > 0) {
    clusters.push({
      cluster_name: 'Low Stress',
      stress_level: 'Low (<20)',
      markets: low.map((m) => `${m.ticker}: ${m.title}`),
    });
  }

  return clusters;
}

/**
 * Analyze systemic risk using Nemotron
 */
async function analyzeSystemicRisk(
  markets: MarketWithStress[],
  correlations: CorrelationResult[],
  leadLag: LeadLagResult[],
  clusters: StressCluster[],
  apiKey: string
): Promise<SystemicRiskResponse> {
  const systemPrompt = `You are a systemic risk analyst specializing in financial market interconnections.

Given correlation data, lead-lag relationships, and stress clustering across multiple markets, identify systemic risk propagation patterns.

Return structured JSON ONLY (no markdown, no explanation):

{
  "systemic_clusters": [{"cluster_name": "", "risk_description": "", "markets": []}],
  "leading_markets": [],
  "contagion_risk_level": "",
  "reasoning": ""
}

Contagion risk levels: "Low", "Moderate", "Elevated", "High", "Critical"

Do not hallucinate. Only reason from provided data.`;

  const topCorrelations = correlations.slice(0, 10);
  const topLeadLag = leadLag.slice(0, 5);

  const userPrompt = `Market Stress Overview:
${markets.map((m) => `- ${m.ticker} (${m.title}): Stress Score ${m.composite_stress_score}/100, State: ${m.market_state || 'Unknown'}`).join('\n')}

Top Price Correlations:
${topCorrelations.length > 0 ? topCorrelations.map((c) => `- ${c.market1} ↔ ${c.market2}: ${c.correlation.toFixed(2)}`).join('\n') : 'No significant correlations detected'}

Lead-Lag Relationships:
${topLeadLag.length > 0 ? topLeadLag.map((l) => `- ${l.leader} leads ${l.follower} by ~${l.lag_minutes}min (confidence: ${l.confidence.toFixed(2)})`).join('\n') : 'No clear lead-lag patterns detected'}

Stress Clusters:
${clusters.map((c) => `- ${c.cluster_name} (${c.stress_level}): ${c.markets.length} markets`).join('\n')}

Identify systemic risk propagation patterns across these markets.`;

  try {
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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`AI API failed: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || '';

    // Parse AI response
    let cleanedResponse = aiResponse.trim();
    cleanedResponse = cleanedResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }

    const analysis: SystemicRiskResponse = JSON.parse(cleanedResponse);

    // Validate structure
    if (!analysis.contagion_risk_level || !Array.isArray(analysis.leading_markets)) {
      throw new Error('Invalid AI response structure');
    }

    return analysis;

  } catch (error) {
    console.warn('Failed to get AI analysis, using fallback:', error);
    return generateFallbackSystemicAnalysis(markets, clusters, correlations);
  }
}

/**
 * Quick fallback for missing API key or minimal data
 */
function generateFallbackSystemicRisk(markets: MarketWithStress[]): SystemicRiskResponse {
  if (!markets || markets.length === 0) {
    return {
      systemic_clusters: [],
      leading_markets: [],
      contagion_risk_level: 'Low',
      reasoning: 'No market data available for analysis.',
    };
  }

  const clusters = clusterMarketsByStress(markets);
  const correlations: CorrelationResult[] = [];
  
  return generateFallbackSystemicAnalysis(markets, clusters, correlations);
}

/**
 * Generate fallback systemic analysis
 */
function generateFallbackSystemicAnalysis(
  markets: MarketWithStress[],
  clusters: StressCluster[],
  correlations: CorrelationResult[]
): SystemicRiskResponse {
  const avgStress = markets.reduce((sum, m) => sum + m.composite_stress_score, 0) / markets.length;
  const highStressCount = markets.filter((m) => m.composite_stress_score >= 60).length;
  const strongCorrelations = correlations.filter((c) => Math.abs(c.correlation) > 0.7).length;

  let contagion_risk_level: string;
  if (avgStress > 60 || highStressCount > markets.length * 0.5) {
    contagion_risk_level = 'Critical';
  } else if (avgStress > 45 || highStressCount > markets.length * 0.3) {
    contagion_risk_level = 'High';
  } else if (avgStress > 30 || strongCorrelations > 3) {
    contagion_risk_level = 'Elevated';
  } else if (avgStress > 15) {
    contagion_risk_level = 'Moderate';
  } else {
    contagion_risk_level = 'Low';
  }

  const topStressMarkets = [...markets]
    .sort((a, b) => b.composite_stress_score - a.composite_stress_score)
    .slice(0, 5)
    .map((m) => m.ticker);

  return {
    systemic_clusters: clusters.map((c) => ({
      cluster_name: c.cluster_name,
      stress_level: c.stress_level,
      markets: c.markets,
    })),
    leading_markets: topStressMarkets,
    contagion_risk_level,
    reasoning: `Average market stress is ${avgStress.toFixed(1)}/100. ${highStressCount} markets show high stress (≥60). ${strongCorrelations} strong correlation pairs detected. ${contagion_risk_level} contagion risk based on stress concentration and market interconnections.`,
  };
}
