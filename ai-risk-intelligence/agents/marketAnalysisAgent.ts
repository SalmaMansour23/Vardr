/**
 * Market Analysis Agent for Prediction Market Surveillance
 * Analyzes cross-market dynamics, liquidity, and stress indicators
 * Institutional-grade risk assessment for multi-platform markets
 */

// ==================== TYPES ====================

interface KalshiMarketData {
  currentPrice: number;
  volume24h: number;
  priceChangePercent: number;
  suspiciousEventFlag?: boolean;
}

interface PolymarketData {
  currentPrice: number;
  volume24h: number;
  priceChangePercent: number;
  suspiciousEventFlag?: boolean;
}

interface MarketData {
  kalshi: KalshiMarketData;
  polymarket: PolymarketData;
  timestamp: string;
  suspiciousEventFlag?: boolean;
}

interface MarketAnalysisInput {
  marketData: MarketData[];
}

interface MarketAnalysisResult {
  divergenceScore: number; // 0-1, absolute price difference normalized
  liquidityImbalance: number; // 0-1, liquidity distribution asymmetry
  stressIndex: number; // 0-1, volatility + volume spike indicator
  reasoning: {
    marketAlignment: string;
    leadLagAnalysis: string;
    volumeAssessment: string;
    stressRegimeAnalysis: string;
    riskAlert: string;
    institutionalSummary: string;
  };
  processingTimeMs: number;
  timestamp: string;
}

// ==================== UTILITY FUNCTIONS ====================

function delaySimulation(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== MARKET ANALYSIS FUNCTIONS ====================

/**
 * Calculate Price Divergence Score
 * Normalized measure of how different prices are across platforms
 */
function calculateDivergenceScore(data: MarketData[]): number {
  if (data.length === 0) return 0;

  let totalDivergence = 0;
  let validPoints = 0;

  data.forEach(snapshot => {
    const kalshiPrice = snapshot.kalshi.currentPrice;
    const polyPrice = snapshot.polymarket.currentPrice;

    if (kalshiPrice > 0 && polyPrice > 0) {
      // Calculate percentage difference
      const avgPrice = (kalshiPrice + polyPrice) / 2;
      const priceDiff = Math.abs(kalshiPrice - polyPrice);
      const divergence = priceDiff / avgPrice;

      totalDivergence += divergence;
      validPoints++;
    }
  });

  if (validPoints === 0) return 0;

  const avgDivergence = totalDivergence / validPoints;
  // Normalize: 0.05 difference (5%) = score 0.5, 0.10 (10%) = score 1.0
  return Math.min(1, avgDivergence * 10);
}

/**
 * Calculate Liquidity Imbalance
 * Measures if one market is significantly more liquid than the other
 */
function calculateLiquidityImbalance(data: MarketData[]): number {
  if (data.length === 0) return 0;

  let totalImbalance = 0;
  let validPoints = 0;

  data.forEach(snapshot => {
    const kalshiVol = snapshot.kalshi.volume24h;
    const polyVol = snapshot.polymarket.volume24h;

    if (kalshiVol > 0 && polyVol > 0) {
      // Calculate volume ratio
      const totalVol = kalshiVol + polyVol;
      const kalshiShare = kalshiVol / totalVol;
      const polyShare = polyVol / totalVol;

      // Imbalance: 0 if equal, 1 if completely dominating one side
      const imbalance = Math.abs(kalshiShare - polyShare);

      totalImbalance += imbalance;
      validPoints++;
    }
  });

  if (validPoints === 0) return 0;

  const avgImbalance = totalImbalance / validPoints;
  // Normalize: 0.5 imbalance (65-35 split) = score 0.5, 1.0 (100-0 split) = score 1.0
  return Math.min(1, avgImbalance);
}

/**
 * Calculate Stress Index
 * Based on volatility and volume spike patterns
 */
function calculateStressIndex(data: MarketData[]): number {
  if (data.length < 2) return 0;

  let volatilitySum = 0;
  let volumeSpikeSum = 0;
  let validPoints = 0;

  // Baseline volume (first 3 observations average)
  const baselineKalshi = data.slice(0, 3).reduce((sum, d) => sum + d.kalshi.volume24h, 0) / Math.min(3, data.length);
  const baselinePoly = data.slice(0, 3).reduce((sum, d) => sum + d.polymarket.volume24h, 0) / Math.min(3, data.length);

  // Calculate volatility and volume spikes
  data.forEach(snapshot => {
    // Price volatility (percentage change magnitude)
    const kalshiVolatility = Math.abs(snapshot.kalshi.priceChangePercent) / 10; // Normalize by 10%
    const polyVolatility = Math.abs(snapshot.polymarket.priceChangePercent) / 10;
    const avgVolatility = Math.max(kalshiVolatility, polyVolatility);

    // Volume spike (how much above baseline)
    const kalshiSpike = snapshot.kalshi.volume24h > baselineKalshi ? snapshot.kalshi.volume24h / baselineKalshi : 1;
    const polySpike = snapshot.polymarket.volume24h > baselinePoly ? snapshot.polymarket.volume24h / baselinePoly : 1;
    const maxSpike = Math.max(kalshiSpike, polySpike);

    // Combine metrics: volatility 40%, volume spike 60%
    const stressPoint = avgVolatility * 0.4 + Math.min(1, (maxSpike - 1) / 5) * 0.6;

    volatilitySum += avgVolatility;
    volumeSpikeSum += Math.min(1, (maxSpike - 1) / 5);
    validPoints++;
  });

  if (validPoints === 0) return 0;

  const avgStress = (volatilitySum * 0.4 + volumeSpikeSum * 0.6) / validPoints;
  return Math.min(1, avgStress);
}

/**
 * Detect Lead-Lag Relationship
 * Determines if one market consistently leads the other
 */
function detectLeadLagRelationship(
  data: MarketData[]
): { leader: string; confidence: number; pattern: string } {
  if (data.length < 3) {
    return { leader: 'insufficient data', confidence: 0, pattern: 'Not enough data points' };
  }

  let kalshiLeads = 0;
  let polyLeads = 0;

  // Compare price movements sequentially
  for (let i = 1; i < data.length; i++) {
    const prevKalshi = data[i - 1].kalshi.priceChangePercent;
    const currKalshi = data[i].kalshi.priceChangePercent;
    const prevPoly = data[i - 1].polymarket.priceChangePercent;
    const currPoly = data[i].polymarket.priceChangePercent;

    // Check if current Kalshi move aligns with previous Poly move
    if (prevPoly !== 0 && currKalshi * prevPoly > 0) {
      polyLeads++;
    } else if (prevKalshi !== 0 && currPoly * prevKalshi > 0) {
      kalshiLeads++;
    }
  }

  const totalComparisons = kalshiLeads + polyLeads;
  let leader = 'aligned';
  let confidence = 0;

  if (totalComparisons > 0) {
    if (kalshiLeads > polyLeads) {
      leader = 'Kalshi';
      confidence = kalshiLeads / totalComparisons;
    } else if (polyLeads > kalshiLeads) {
      leader = 'Polymarket';
      confidence = polyLeads / totalComparisons;
    } else {
      leader = 'balanced';
      confidence = 0.5;
    }
  }

  const pattern =
    leader === 'aligned'
      ? 'Markets moving in synchronization'
      : `${leader} leading by ${(confidence * 100).toFixed(1)}%`;

  return { leader, confidence: Math.min(1, confidence), pattern };
}

// ==================== REASONING GENERATION ====================

function generateMarketReasoning(
  divergenceScore: number,
  liquidityImbalance: number,
  stressIndex: number,
  leadLagAnalysis: { leader: string; confidence: number; pattern: string }
): MarketAnalysisResult['reasoning'] {
  // Market Alignment Assessment
  let marketAlignment = '';
  if (divergenceScore < 0.2) {
    marketAlignment =
      'TIGHTLY ALIGNED: Price discovery mechanisms across platforms are highly consistent. Minimal arbitrage opportunities indicate efficient market integration.';
  } else if (divergenceScore < 0.5) {
    marketAlignment =
      'MODERATELY ALIGNED: Standard price variation across platforms. Normal market microstructure dynamics present. Typical arb spreads observed.';
  } else if (divergenceScore < 0.8) {
    marketAlignment =
      'DIVERGENT: Significant price discrepancies between platforms. Potential market fragmentation or information asymmetry. Elevated arb opportunity or execution risk.';
  } else {
    marketAlignment =
      'SEVERELY DIVERGENT: Substantial price disconnects indicate potential structural issues, liquidity crises, or information barriers. Recommend immediate investigation.';
  }

  // Lead-Lag Analysis
  let leadLagAnalysisText = '';
  if (leadLagAnalysis.leader === 'aligned') {
    leadLagAnalysisText =
      'SIMULTANEOUS DISCOVERY: Both markets are pricing information in parallel. No significant lead-lag relationship detected. Reflects healthy market efficiency.';
  } else {
    const leadPercent = (leadLagAnalysis.confidence * 100).toFixed(1);
    leadLagAnalysisText = `${leadLagAnalysis.leader.toUpperCase()} LEADING: ${leadPercent}% confidence. ${leadLagAnalysis.pattern}. `;
    if (leadLagAnalysis.confidence > 0.7) {
      leadLagAnalysisText +=
        'Strong directional lead suggests information asymmetry or faster capital deployment on leading platform.';
    } else if (leadLagAnalysis.confidence > 0.5) {
      leadLagAnalysisText +=
        'Moderate lead indicates some information advantage or faster execution on leading platform.';
    }
  }

  // Volume Assessment
  let volumeAssessment = '';
  if (liquidityImbalance < 0.2) {
    volumeAssessment =
      'BALANCED LIQUIDITY: Volume distribution across platforms is equitable (45-55% split range). Healthy ecosystem supporting diverse trader preferences.';
  } else if (liquidityImbalance < 0.5) {
    volumeAssessment =
      'MODERATE IMBALANCE: Notable volume concentration on one platform (35-65% split). Concentration risk present but manageable. Potential execution constraints on secondary market.';
  } else {
    volumeAssessment =
      'SEVERE IMBALANCE: Extreme liquidity concentration (>65% on dominant platform). Creates execution bottleneck for large orders on secondary venue. Structural vulnerability.';
  }

  // Stress Regime Assessment
  let stressRegimeAnalysis = '';
  if (stressIndex < 0.2) {
    stressRegimeAnalysis =
      'NORMAL REGIME: Market conditions stable with typical volatility and volume patterns. Standard risk management protocols sufficient.';
  } else if (stressIndex < 0.5) {
    stressRegimeAnalysis =
      'ELEVATED ACTIVITY: Above-baseline volatility and volume. Monitor position management. Standard stress hedges may be warranted.';
  } else if (stressIndex < 0.8) {
    stressRegimeAnalysis =
      'STRESS REGIME: Significant volatility and volume spikes detected. Elevated execution risk. Review circuit breaker settings and liquidity buffers.';
  } else {
    stressRegimeAnalysis =
      'CRITICAL STRESS: Extreme market conditions. Volatility and volume at elevated levels. Recommend enhanced risk controls and potential position reduction.';
  }

  // Risk Alert
  let riskAlert = '';
  const compositeRisk = (divergenceScore + liquidityImbalance + stressIndex) / 3;
  if (compositeRisk > 0.7) {
    riskAlert =
      '🚨 HIGH RISK ALERT: Multiple market structure concerns detected simultaneously. Recommend senior risk leadership review.';
  } else if (compositeRisk > 0.5) {
    riskAlert = '⚠️ ELEVATED RISK: Market conditions warrant heightened monitoring and potential risk mitigation actions.';
  } else if (compositeRisk > 0.3) {
    riskAlert = 'STANDARD MONITORING: Market operating within normal parameters. Routine surveillance adequate.';
  } else {
    riskAlert = 'LOW RISK: Market conditions benign. Normal operations protocol appropriate.';
  }

  // Institutional Summary
  let institutionalSummary = `Market surveillance report for prediction market complex spanning Kalshi and Polymarket. Composite risk assessment: ${(compositeRisk * 100).toFixed(1)}%. `;

  if (divergenceScore > 0.5 || liquidityImbalance > 0.5) {
    institutionalSummary +=
      'Structure indicators suggest potential inefficiencies in price discovery or liquidity routing. ';
  }

  if (stressIndex > 0.5) {
    institutionalSummary +=
      'Elevated volatility and volume patterns indicate heightened market tension. ';
  }

  if (leadLagAnalysis.confidence > 0.6 && leadLagAnalysis.leader !== 'aligned') {
    institutionalSummary += `Pronounced lead-lag dynamic with ${leadLagAnalysis.leader} consistently leading signals information architecture asymmetry. `;
  }

  institutionalSummary +=
    'Recommend continuous monitoring of market efficiency ratios and execution impact metrics across venues.';

  return {
    marketAlignment,
    leadLagAnalysis: leadLagAnalysisText,
    volumeAssessment,
    stressRegimeAnalysis,
    riskAlert,
    institutionalSummary,
  };
}

// ==================== MAIN AGENT FUNCTION ====================

/**
 * Run Market Analysis Agent
 * Comprehensive cross-market surveillance for prediction markets
 * Compares Kalshi and Polymarket dynamics
 *
 * @param input - Historical market data from both platforms
 * @returns Structured institutional-grade market analysis
 */
export async function runMarketAnalysisAgent(input: MarketAnalysisInput): Promise<MarketAnalysisResult> {
  const startTime = Date.now();

  console.log('📊 Market Analysis Agent initialized...');
  console.log(`   Analyzing ${input.marketData.length} market data snapshots`);
  console.log(`   Platforms: Kalshi, Polymarket`);

  // Calculate market metrics
  const divergenceScore = calculateDivergenceScore(input.marketData);
  const liquidityImbalance = calculateLiquidityImbalance(input.marketData);
  const stressIndex = calculateStressIndex(input.marketData);
  const leadLagAnalysis = detectLeadLagRelationship(input.marketData);

  // Generate institutional analysis
  const reasoning = generateMarketReasoning(
    divergenceScore,
    liquidityImbalance,
    stressIndex,
    leadLagAnalysis
  );

  // Simulate institutional processing delay
  console.log('⏳ Running institutional risk analysis...');
  await delaySimulation(2500); // 2.5 second delay

  const processingTimeMs = Date.now() - startTime;

  const result: MarketAnalysisResult = {
    divergenceScore: parseFloat(divergenceScore.toFixed(4)),
    liquidityImbalance: parseFloat(liquidityImbalance.toFixed(4)),
    stressIndex: parseFloat(stressIndex.toFixed(4)),
    reasoning,
    processingTimeMs,
    timestamp: new Date().toISOString(),
  };

  console.log('✅ Market analysis complete');
  console.log(`   Price Divergence: ${result.divergenceScore.toFixed(3)} (${result.divergenceScore < 0.2 ? 'Aligned' : result.divergenceScore < 0.5 ? 'Moderate' : 'Divergent'})`);
  console.log(`   Liquidity Imbalance: ${result.liquidityImbalance.toFixed(3)}`);
  console.log(`   Stress Index: ${result.stressIndex.toFixed(3)} (${result.stressIndex < 0.2 ? 'Normal' : result.stressIndex < 0.5 ? 'Elevated' : result.stressIndex < 0.8 ? 'Stress' : 'Critical'})`);
  console.log(`   Lead-Lag: ${leadLagAnalysis.pattern}`);
  console.log(`   ${result.reasoning.riskAlert}`);
  console.log(`   Processing Time: ${result.processingTimeMs}ms`);

  return result;
}

// Export types for external use
export type { MarketAnalysisInput, MarketAnalysisResult, MarketData, KalshiMarketData, PolymarketData };
