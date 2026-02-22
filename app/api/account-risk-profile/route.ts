import { NextRequest, NextResponse } from 'next/server';
import { openRouterChat } from '../../lib/openrouter';
import {
  TEMPORAL_ALIGNMENT_WINDOW_MS,
  CONCENTRATION_WINDOW_MS,
  RISK_WEIGHTS,
  RISK_CATEGORY_BOUNDARIES,
} from '../../lib/feature-config';

interface Trade {
  timestamp: string;
  position_size: number;
  price: number;
  side: 'buy' | 'sell';
}

interface PublicSignal {
  text: string;
  timestamp: string;
  classification?: string;
  confidence?: number;
}

interface CrossEventData {
  event_type: string;
  relationship_strength: number;
  reasoning?: string;
}

interface RequestBody {
  account_id: string;
  trade_history: Trade[];
  public_signal_data: PublicSignal[];
  cross_event_data: CrossEventData[];
}

interface RiskFeatures {
  temporal_alignment_score: number;
  position_concentration: number;
  timing_precision: number;
  cross_event_exposure: number;
  signal_correlation: number;
}

/**
 * Computes structured risk features from account trading behavior
 */
function computeRiskFeatures(
  trade_history: Trade[],
  public_signal_data: PublicSignal[],
  cross_event_data: CrossEventData[]
): RiskFeatures {
  // Temporal Alignment Score: How closely trades align with public signals
  let temporal_alignment_score = 0;
  if (public_signal_data.length > 0 && trade_history.length > 0) {
    let alignment_count = 0;
    trade_history.forEach(trade => {
      const tradeTime = new Date(trade.timestamp).getTime();
      const hasNearbySignal = public_signal_data.some(signal => {
        const signalTime = new Date(signal.timestamp).getTime();
        const timeDiff = Math.abs(tradeTime - signalTime);
        return timeDiff < TEMPORAL_ALIGNMENT_WINDOW_MS;
      });
      if (hasNearbySignal) alignment_count++;
    });
    temporal_alignment_score = (alignment_count / trade_history.length) * 100;
  }

  // Position Concentration: How concentrated positions are in short time windows
  let position_concentration = 0;
  if (trade_history.length > 0) {
    const sortedTrades = [...trade_history].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    const windowSizes: number[] = [];
    for (let i = 0; i < sortedTrades.length; i++) {
      const windowStart = new Date(sortedTrades[i].timestamp).getTime();
      const windowEnd = windowStart + CONCENTRATION_WINDOW_MS;
      
      let windowVolume = 0;
      for (let j = i; j < sortedTrades.length; j++) {
        const tradeTime = new Date(sortedTrades[j].timestamp).getTime();
        if (tradeTime <= windowEnd) {
          windowVolume += sortedTrades[j].position_size;
        } else {
          break;
        }
      }
      windowSizes.push(windowVolume);
    }
    
    const totalVolume = trade_history.reduce((sum, t) => sum + t.position_size, 0);
    const maxWindowVolume = Math.max(...windowSizes);
    position_concentration = totalVolume > 0 ? (maxWindowVolume / totalVolume) * 100 : 0;
  }

  // Timing Precision: How precisely timed trades are (low variance = high precision)
  let timing_precision = 0;
  if (trade_history.length > 1) {
    const intervals: number[] = [];
    for (let i = 1; i < trade_history.length; i++) {
      const time1 = new Date(trade_history[i - 1].timestamp).getTime();
      const time2 = new Date(trade_history[i].timestamp).getTime();
      intervals.push(time2 - time1);
    }
    
    const mean = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0; // coefficient of variation
    
    // Lower CV = higher precision (invert and scale to 0-100)
    timing_precision = Math.max(0, Math.min(100, (1 - Math.min(cv, 1)) * 100));
  }

  // Cross-Event Exposure: Strength of connection to related events
  let cross_event_exposure = 0;
  if (cross_event_data.length > 0) {
    const avgStrength = cross_event_data.reduce((sum, e) => sum + e.relationship_strength, 0) / cross_event_data.length;
    cross_event_exposure = avgStrength * 100;
  }

  // Signal Correlation: How many signals are classified as high-risk
  let signal_correlation = 0;
  if (public_signal_data.length > 0) {
    const highRiskSignals = public_signal_data.filter(s => 
      s.classification && (s.classification.toLowerCase().includes('leak') || 
      s.classification.toLowerCase().includes('rumor'))
    ).length;
    signal_correlation = (highRiskSignals / public_signal_data.length) * 100;
  }

  return {
    temporal_alignment_score: Math.round(temporal_alignment_score * 10) / 10,
    position_concentration: Math.round(position_concentration * 10) / 10,
    timing_precision: Math.round(timing_precision * 10) / 10,
    cross_event_exposure: Math.round(cross_event_exposure * 10) / 10,
    signal_correlation: Math.round(signal_correlation * 10) / 10
  };
}

/**
 * Calls Open Router (Nemotron) API to generate evidence-based risk explanation
 */
async function callNemotron(prompt: string): Promise<string> {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPEN_ROUTER_API_KEY is not configured');
  }

  const result = await openRouterChat(apiKey, {
    messages: [
      {
        role: 'system',
        content: 'You are an expert financial compliance analyst specializing in market manipulation detection and information asymmetry risk assessment. Provide evidence-based, structured analysis using quantitative features.'
      },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  if ('error' in result) {
    throw new Error(`Open Router API error: ${result.error}`);
  }

  return result.content || 'No response generated';
}

/**
 * Determines risk category based on composite risk score
 */
function determineRiskCategory(risk_score: number): string {
  const { critical, high, moderate, low } = RISK_CATEGORY_BOUNDARIES;
  if (risk_score >= critical) return 'Critical Risk';
  if (risk_score >= high) return 'High Risk';
  if (risk_score >= moderate) return 'Moderate Risk';
  if (risk_score >= low) return 'Low Risk';
  return 'Minimal Risk';
}

/**
 * Calculates composite risk score from features
 */
function calculateRiskScore(features: RiskFeatures): number {
  const w = RISK_WEIGHTS;
  const score =
    features.temporal_alignment_score * w.temporal_alignment_score +
    features.position_concentration * w.position_concentration +
    features.timing_precision * w.timing_precision +
    features.cross_event_exposure * w.cross_event_exposure +
    features.signal_correlation * w.signal_correlation;

  return Math.round(score * 10) / 10;
}

/**
 * Extracts evidence bullets from AI analysis
 */
function extractEvidence(aiAnalysis: string): string[] {
  const lines = aiAnalysis.split('\n').filter(line => line.trim());
  const evidence: string[] = [];
  
  for (const line of lines) {
    // Look for bullet points, numbered lists, or sentences with strong indicators
    if (line.match(/^[-*•]\s/) || line.match(/^\d+\.\s/) || 
        line.toLowerCase().includes('evidence:') ||
        line.toLowerCase().includes('observed:') ||
        line.toLowerCase().includes('detected:')) {
      const cleaned = line.replace(/^[-*•]\s/, '').replace(/^\d+\.\s/, '').trim();
      if (cleaned.length > 10 && cleaned.length < 200) {
        evidence.push(cleaned);
      }
    }
  }
  
  // If no bullets found, extract key sentences
  if (evidence.length === 0) {
    const sentences = aiAnalysis.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 4).map(s => s.trim());
  }
  
  return evidence.slice(0, 5); // Max 5 evidence points
}

/**
 * Calculates confidence based on data quality and consistency
 */
function calculateConfidence(
  trade_history: Trade[],
  public_signal_data: PublicSignal[],
  features: RiskFeatures
): number {
  let confidence = 50; // Base confidence
  
  // More data = higher confidence
  if (trade_history.length >= 10) confidence += 15;
  else if (trade_history.length >= 5) confidence += 10;
  else if (trade_history.length >= 3) confidence += 5;
  
  if (public_signal_data.length >= 10) confidence += 15;
  else if (public_signal_data.length >= 5) confidence += 10;
  
  // Consistent features = higher confidence
  const featureValues = Object.values(features);
  const mean = featureValues.reduce((sum, val) => sum + val, 0) / featureValues.length;
  const variance = featureValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / featureValues.length;
  
  if (variance < 200) confidence += 10; // Low variance = consistent signal
  if (variance < 100) confidence += 10;
  
  return Math.min(95, Math.max(20, confidence));
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    
    // Validate input
    if (!body.account_id || !body.trade_history || !body.public_signal_data) {
      return NextResponse.json(
        { error: 'Missing required fields: account_id, trade_history, public_signal_data' },
        { status: 400 }
      );
    }

    // Step 1: Compute structured risk features
    const features = computeRiskFeatures(
      body.trade_history,
      body.public_signal_data,
      body.cross_event_data || []
    );

    // Step 2: Calculate composite risk score
    const risk_score = calculateRiskScore(features);
    const risk_category = determineRiskCategory(risk_score);

    // Step 3: Build prompt for Nemotron
    const prompt = `Analyze the following account trading behavior for information asymmetry risk:

Account ID: ${body.account_id}

Quantitative Risk Features:
- Temporal Alignment Score: ${features.temporal_alignment_score}/100 (trades aligned with public signals)
- Position Concentration: ${features.position_concentration}/100 (position clustering in time windows)
- Timing Precision: ${features.timing_precision}/100 (consistency of trade timing)
- Cross-Event Exposure: ${features.cross_event_exposure}/100 (correlation with related events)
- Signal Correlation: ${features.signal_correlation}/100 (proportion of high-risk signals)

Trading Activity:
- Total Trades: ${body.trade_history.length}
- Public Signals: ${body.public_signal_data.length}
- Related Events: ${body.cross_event_data?.length || 0}

Composite Risk Score: ${risk_score}/100
Risk Category: ${risk_category}

Based on these structured features, provide:
1. A concise evidence-based explanation of the risk assessment
2. Key behavioral patterns that contribute to the risk score
3. Specific observations about temporal alignment and position sizing
4. Any indicators of potential information asymmetry

Format your response as clear, factual bullet points focusing on observable patterns.`;

    // Step 4: Call Nemotron for evidence-based explanation
    const aiAnalysis = await callNemotron(prompt);

    // Step 5: Extract evidence points
    const evidence = extractEvidence(aiAnalysis);

    // Step 6: Calculate confidence
    const confidence = calculateConfidence(
      body.trade_history,
      body.public_signal_data,
      features
    );

    // Step 7: Generate disclaimer
    const disclaimer = "This risk assessment is generated using statistical models and AI analysis for informational purposes only. It does not constitute legal advice, regulatory findings, or definitive proof of misconduct. Human review and contextual judgment are required for any enforcement action.";

    // Return structured response
    return NextResponse.json({
      account_id: body.account_id,
      risk_score,
      confidence,
      risk_category,
      evidence,
      features,
      disclaimer,
      analysis: aiAnalysis
    });

  } catch (error: any) {
    console.error('Account risk profile error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate account risk profile',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
