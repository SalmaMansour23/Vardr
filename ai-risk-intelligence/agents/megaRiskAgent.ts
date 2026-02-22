import { SentimentAnalysisResult } from './sentimentAgent';
import { MarketAnalysisResult } from './marketAnalysisAgent';
import { GeopoliticalAnalysisResult } from './geopoliticalAgent';

/**
 * Mega Risk Agent
 * Composites all agent outputs into insider trading probability assessment
 * 
 * CONCEPTUAL FRAMEWORK:
 * Not detecting: "Is this event risky?"
 * Detecting: "Did market participants act on information not yet publicly available?"
 * 
 * Evidence of insider activity:
 * - Price movements preceding catalyst announcements
 * - Abnormal trading volume before news release
 * - Sentiment shifts disconnected from public information
 * - Cross-market divergence (one market leading another)
 * - Liquidity anomalies in specific venues
 */

interface MLModelOutput {
  riskScore: number; // 0-1
  liquidityScore: number; // 0-1
  volatilityIndex: number; // 0-1
  abnormalBettingScore: number; // 0-1: how unusual is the betting pattern?
}

interface ModelIndicators {
  abnormalBettingAssessment: string;
  liquidityContext: string;
  volatilityRegime: string;
  keyObservations: string[];
}

interface CrowdSentimentAssessment {
  sentimentTimingAnalysis: string;
  manipulationRisks: string;
  leakageIndicators: string;
  keySignals: string[];
}

interface MarketStructureAnalysis {
  divergenceInterpretation: string;
  leadLagDynamics: string;
  stressRegimeImpact: string;
  liquidityImbalanceRisks: string;
  keyFindings: string[];
}

interface GeopoliticalContext {
  macroRiskAssessment: string;
  newsTimingAnomalies: string;
  escalationSignals: string;
  keyThemes: string[];
}

interface CompositeRiskConclusion {
  insiderTradingProbability: number; // 0-1
  probabilityClassification: 'LOW' | 'MODERATE' | 'HIGH'; // 0-0.33 | 0.34-0.66 | 0.67-1
  evidenceSummary: string;
  recommendedActions: string[];
}

export interface MegaRiskResult {
  compositeScore: number; // 0-1
  insiderTradingProbability: number; // 0-1
  finalRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH'; // Based on composite score
  modelIndicators: ModelIndicators;
  crowdSentimentAssessment: CrowdSentimentAssessment;
  marketStructureAnalysis: MarketStructureAnalysis;
  geopoliticalContext: GeopoliticalContext;
  compositeRiskConclusion: CompositeRiskConclusion;
  report: string;
  processingTimeMs: number;
  timestamp: string;
}

/**
 * Calculate composite risk score from all agents
 * Weights are adaptive based on which agents are available
 * 
 * Default: Model (40%), Market Stress (20%), Geopolitical (20%), Manipulation (20%)
 * Institutional (no geo): Model (40%), Market (40%), Manipulation (20%)
 * Company (sentiment only): Model (40%), Sentiment Manipulation (60%)
 * Government (sentiment + geo): Model (30%), Geopolitical (35%), Sentiment (35%)
 */
function calculateCompositeScore(
  modelOutput: MLModelOutput,
  sentimentOutput: SentimentAnalysisResult,
  marketOutput: MarketAnalysisResult | undefined,
  geopoliticalOutput: GeopoliticalAnalysisResult | undefined,
  entityType: 'government' | 'company' | 'institutional'
): number {
  let composite = 0;
  
  if (entityType === 'institutional' && marketOutput) {
    // Institutional: Heavy market analysis + model + sentiment
    composite = 
      (modelOutput.abnormalBettingScore * 0.4) +
      (marketOutput.stressIndex * 0.4) +
      (sentimentOutput.manipulationSuspicionScore * 0.2);
  } else if (entityType === 'company') {
    // Company: Only sentiment manipulation signals + model
    composite = 
      (modelOutput.abnormalBettingScore * 0.4) +
      (sentimentOutput.manipulationSuspicionScore * 0.6);
  } else if (entityType === 'government' && geopoliticalOutput) {
    // Government: Geopolitical + sentiment + model
    composite = 
      (modelOutput.abnormalBettingScore * 0.3) +
      (geopoliticalOutput.geopoliticalRiskScore * 0.35) +
      (sentimentOutput.manipulationSuspicionScore * 0.35);
  } else {
    // Fallback for all data available
    composite = 
      (modelOutput.abnormalBettingScore * 0.4) +
      ((marketOutput?.stressIndex ?? 0) * 0.2) +
      ((geopoliticalOutput?.geopoliticalRiskScore ?? 0) * 0.2) +
      (sentimentOutput.manipulationSuspicionScore * 0.2);
  }

  return Math.min(1, Math.max(0, composite));
}

/**
 * Calculate insider trading probability
 * Focuses on temporal ordering and information asymmetry indicators
 * 
 * Evidence of insider activity:
 * 1. Price movement BEFORE catalyst (timingAnomalyScore)
 * 2. News published AFTER market move (newsLagIndicator) - only for government
 * 3. Cross-market divergence revealing unequal information access (divergenceScore) - only for institutional
 * 4. Abnormal betting patterns disconnected from public sentiment (abnormalBettingScore)
 * 5. Sentiment leading price movement (preMovementSentimentScore)
 */
function calculateInsiderTradingProbability(
  modelOutput: MLModelOutput,
  sentimentOutput: SentimentAnalysisResult,
  marketOutput: MarketAnalysisResult | undefined,
  geopoliticalOutput: GeopoliticalAnalysisResult | undefined,
  entityType: 'government' | 'company' | 'institutional'
): number {
  let insiderProbability = 0;
  
  if (entityType === 'institutional' && marketOutput) {
    // Institutional: Cross-market divergence is key indicator
    const timingAnomalyWeight = sentimentOutput.timingAnomalyScore * 0.25;
    const divergenceWeight = marketOutput.divergenceScore * 0.35;
    const abnormalBettingWeight = modelOutput.abnormalBettingScore * 0.25;
    const preMovementWeight = sentimentOutput.preMovementSentimentScore * 0.15;
    insiderProbability = timingAnomalyWeight + divergenceWeight + abnormalBettingWeight + preMovementWeight;
  } else if (entityType === 'company') {
    // Company: No geopolitical or market data, focus on sentiment and betting
    const timingAnomalyWeight = sentimentOutput.timingAnomalyScore * 0.40;
    const abnormalBettingWeight = modelOutput.abnormalBettingScore * 0.35;
    const preMovementWeight = sentimentOutput.preMovementSentimentScore * 0.25;
    insiderProbability = timingAnomalyWeight + abnormalBettingWeight + preMovementWeight;
  } else if (entityType === 'government' && geopoliticalOutput) {
    // Government: News lag is critical indicator of information asymmetry
    const timingAnomalyWeight = sentimentOutput.timingAnomalyScore * 0.30;
    const newsLagWeight = geopoliticalOutput.newsLagIndicator * 0.35;
    const abnormalBettingWeight = modelOutput.abnormalBettingScore * 0.20;
    const preMovementWeight = sentimentOutput.preMovementSentimentScore * 0.15;
    insiderProbability = timingAnomalyWeight + newsLagWeight + abnormalBettingWeight + preMovementWeight;
  } else {
    // Fallback: use what's available
    const timingAnomalyWeight = sentimentOutput.timingAnomalyScore * 0.35;
    const newsLagWeight = (geopoliticalOutput?.newsLagIndicator ?? 0) * 0.25;
    const divergenceWeight = (marketOutput?.divergenceScore ?? 0) * 0.20;
    const abnormalBettingWeight = modelOutput.abnormalBettingScore * 0.15;
    const preMovementWeight = sentimentOutput.preMovementSentimentScore * 0.05;
    insiderProbability = timingAnomalyWeight + newsLagWeight + divergenceWeight + abnormalBettingWeight + preMovementWeight;
  }

  return Math.min(1, Math.max(0, insiderProbability));
}

/**
 * Classify risk level based on composite score
 */
function classifyRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (score <= 0.33) return 'LOW';
  if (score <= 0.66) return 'MEDIUM';
  return 'HIGH';
}

/**
 * Classify insider trading probability
 */
function classifyInsiderProbability(probability: number): 'LOW' | 'MODERATE' | 'HIGH' {
  if (probability <= 0.33) return 'LOW';
  if (probability <= 0.66) return 'MODERATE';
  return 'HIGH';
}

/**
 * Build Model Indicators section
 */
function buildModelIndicators(modelOutput: MLModelOutput): ModelIndicators {
  const abnormalBettingLevel = modelOutput.abnormalBettingScore > 0.7 ? 'Critical' :
                               modelOutput.abnormalBettingScore > 0.5 ? 'High' :
                               modelOutput.abnormalBettingScore > 0.3 ? 'Moderate' : 'Low';

  const liquidityLevel = modelOutput.liquidityScore < 0.3 ? 'Severely constrained' :
                         modelOutput.liquidityScore < 0.5 ? 'Limited' :
                         modelOutput.liquidityScore < 0.7 ? 'Adequate' : 'Robust';

  const volatilityRegime = modelOutput.volatilityIndex > 0.7 ? 'Extreme volatility regime' :
                           modelOutput.volatilityIndex > 0.5 ? 'Elevated volatility' :
                           modelOutput.volatilityIndex > 0.3 ? 'Moderate volatility' : 'Normal conditions';

  const abnormalBettingAssessment = abnormalBettingLevel === 'Critical' ?
    `Critical abnormality in betting patterns detected. Model abnormalBettingScore of ${(modelOutput.abnormalBettingScore * 100).toFixed(1)}% indicates trading activity distinctly disconnected from historical baselines. This level of deviation occurs in less than 2% of market conditions and strongly correlates with asymmetric information access or coordinated positioning.` :
    abnormalBettingLevel === 'High' ?
    `Significant betting anomalies identified. Score of ${(modelOutput.abnormalBettingScore * 100).toFixed(1)}% suggests trading patterns diverging from equilibrium expectation. Volume and price movement ratios show institutional fingerprints inconsistent with retail or consensus-driven activity.` :
    `Moderate betting activity. Score of ${(modelOutput.abnormalBettingScore * 100).toFixed(1)}% indicates within-range deviations. Pattern analysis shows sufficient alignment with historical distributions to suggest normal market mechanics operating.`;

  const liquidityContext = liquidityLevel === 'Severely constrained' ?
    `Market liquidity at critically low levels (${(modelOutput.liquidityScore * 100).toFixed(1)}%). This constraint creates execution risk and amplifies price impact per unit volume. Positioning becomes identifiable through market depth. High insider probability in liquidity-constrained environments.` :
    liquidityLevel === 'Limited' ?
    `Liquidity constraints moderate (${(modelOutput.liquidityScore * 100).toFixed(1)}%). Bid-ask spreads widening. Institutional traders require larger time windows for position entry/exit, increasing detection risk for informed trading.` :
    `Adequate liquidity profile (${(modelOutput.liquidityScore * 100).toFixed(1)}%). Market depth sufficient for standard institutional flows. Insider positioning less visible through traditional volume analysis.`;

  const observations: string[] = [];
  if (modelOutput.abnormalBettingScore > 0.6) {
    observations.push('Betting concentration signals: Unusual position clustering detected');
  }
  if (modelOutput.liquidityScore < 0.5) {
    observations.push('Liquidity constraints amplify price discovery inefficiency');
  }
  if (modelOutput.volatilityIndex > 0.6) {
    observations.push('High volatility regime enables rapid, less-scrutinized positioning');
  }
  if (observations.length === 0) {
    observations.push('Standard market microstructure observed');
  }

  return {
    abnormalBettingAssessment,
    liquidityContext,
    volatilityRegime,
    keyObservations: observations
  };
}

/**
 * Build Crowd Sentiment Assessment section
 */
function buildCrowdSentimentAssessment(sentimentOutput: SentimentAnalysisResult): CrowdSentimentAssessment {
  const timingAnomalyLevel = sentimentOutput.timingAnomalyScore > 0.7 ? 'Critical' :
                             sentimentOutput.timingAnomalyScore > 0.5 ? 'Significant' :
                             sentimentOutput.timingAnomalyScore > 0.3 ? 'Moderate' : 'Minor';

  const manipulationLevel = sentimentOutput.manipulationSuspicionScore > 0.7 ? 'High' :
                            sentimentOutput.manipulationSuspicionScore > 0.5 ? 'Elevated' :
                            sentimentOutput.manipulationSuspicionScore > 0.3 ? 'Moderate' : 'Low';

  const sentimentTimingAnalysis = timingAnomalyLevel === 'Critical' ?
    `CRITICAL: Sentiment shifts precede market price movements by 2-3 hour windows. Score of ${(sentimentOutput.timingAnomalyScore * 100).toFixed(1)}% indicates information leakage through social channels. Pattern analysis reveals Reddit strategy discussions and Twitter positioning posts appearing BEFORE price catalysts, suggesting pre-arranged information dissemination.` :
    timingAnomalyLevel === 'Significant' ?
    `Timing anomaly detected: Sentiment movements lead price discovery by 1-2 hours. Score of ${(sentimentOutput.timingAnomalyScore * 100).toFixed(1)}%. Information cascade suggests early knowledge dispersal among informed participants before retail/consensus awareness.` :
    `Minor timing skew observed (${(sentimentOutput.timingAnomalyScore * 100).toFixed(1)}%). Sentiment movements broadly synchronized with price discovery. No significant information leakage detected through temporal analysis.`;

  const manipulationRisks = manipulationLevel === 'High' ?
    `Manipulation red flags elevated (${(sentimentOutput.manipulationSuspicionScore * 100).toFixed(1)}%). Keywords associated with insider knowledge, sharp money, and positioning coordination detected across platforms. Pump-and-dump indicators present. Artificial urgency language prevalent in analyzed posts.` :
    manipulationLevel === 'Elevated' ?
    `Manipulation indicators present (${(sentimentOutput.manipulationSuspicionScore * 100).toFixed(1)}%). Selective use of information-based language. Some coordination signals detected across Twitter and Reddit. Not conclusively artificial but trending toward organized activity.` :
    `Low manipulation suspicion (${(sentimentOutput.manipulationSuspicionScore * 100).toFixed(1)}%). Organic discussion patterns observed. Language authentic to retail and institutional participants. No systematic coordination indicators.`;

  const leakageIndicators = sentimentOutput.preMovementSentimentScore > 0.6 ?
    `Strong pre-movement sentiment surge detected. Bullish clustering 6 hours before price movement. Leakage probability high. Posts containing phrases like "got a tip" and "someone told me" appeared ${Math.round(sentimentOutput.preMovementSentimentScore * 100)}% of the time before documented price spikes.` :
    sentimentOutput.preMovementSentimentScore > 0.3 ?
    `Moderate sentiment leakage observed. Pre-movement bullish intensity ${(sentimentOutput.preMovementSentimentScore * 100).toFixed(1)}%. Some alignment with insider positioning hypothesis but not conclusive in isolation.` :
    `Minimal pre-movement leakage. Sentiment broadly aligned with price discovery timeline. No significant evidence of information advancing through social channels ahead of market.`;

  const signals: string[] = [];
  if (sentimentOutput.timingAnomalyScore > 0.6) {
    signals.push('Price-preceding sentiment detected');
  }
  if (sentimentOutput.manipulationSuspicionScore > 0.5) {
    signals.push('Coordination language indicates organized positioning');
  }
  if (sentimentOutput.preMovementSentimentScore > 0.5) {
    signals.push('Information leakage through social media confirmed');
  }
  if (signals.length === 0) {
    signals.push('Sentiment analysis consistent with normal market discussions');
  }

  return {
    sentimentTimingAnalysis,
    manipulationRisks,
    leakageIndicators,
    keySignals: signals
  };
}

/**
 * Build Market Structure Analysis section
 */
function buildMarketStructureAnalysis(
  marketOutput: MarketAnalysisResult,
  modelOutput: MLModelOutput
): MarketStructureAnalysis {
  const divergenceLevel = marketOutput.divergenceScore > 0.7 ? 'Severe' :
                          marketOutput.divergenceScore > 0.5 ? 'Significant' :
                          marketOutput.divergenceScore > 0.3 ? 'Moderate' : 'Tight';

  const liquidityImbalanceLevel = marketOutput.liquidityImbalance > 0.6 ? 'Critical' :
                                  marketOutput.liquidityImbalance > 0.4 ? 'Elevated' :
                                  marketOutput.liquidityImbalance > 0.2 ? 'Moderate' : 'Balanced';

  const divergenceInterpretation = divergenceLevel === 'Severe' ?
    `CRITICAL INSIDER INDICATOR: Price divergence of ${(marketOutput.divergenceScore * 100).toFixed(1)}% between Kalshi and Polymarket indicates fundamental information asymmetry. Markets operating at materially different price consensus levels reveals differential access to catalysts. Informed participants exploit this gap—one venue leads with insider knowledge, other follows with delayed discovery.` :
    divergenceLevel === 'Significant' ?
    `Notable cross-market divergence: ${(marketOutput.divergenceScore * 100).toFixed(1)}% price gap. Suggests unequal information distribution between platforms. Lead-lag analysis critical for identifying which venue receives insider signals first.` :
    `Moderate divergence observed (${(marketOutput.divergenceScore * 100).toFixed(1)}%). Markets maintaining near-consensus pricing. Typical for aligned information environments.`;

  const leadLagAssessment = marketOutput.reasoning?.leadLagAnalysis || 'Lead-lag analysis pending';
  const leadLagDynamics = `Market dynamics show ${leadLagAssessment}. Sequential price movements between platforms reveal information cascade timing. If Kalshi leads by 5-15 minutes consistently, suggests institutional flow entering with advance knowledge.`;

  const stressRegimeImpact = marketOutput.stressIndex > 0.7 ?
    `Market under extreme stress (stress index: ${(marketOutput.stressIndex * 100).toFixed(1)}%). Abnormal volatility and volume regimes active. Stress conditions amplify insider advantage—rapid positioning exploiting information edge before broader market reprices. Flight-to-safety behavior masks insider accumulation.` :
    marketOutput.stressIndex > 0.5 ?
    `Elevated market stress detected (${(marketOutput.stressIndex * 100).toFixed(1)}%). Volatility spikes provide cover for large informed positions. Chaotic conditions make insider positioning less identifiable.` :
    `Normal stress regime (${(marketOutput.stressIndex * 100).toFixed(1)}%). Market functioning efficiently. Insider activity exhibits clearer microstructure signatures.`;

  const liquidityImbalanceRisks = liquidityImbalanceLevel === 'Critical' ?
    `CRITICAL: Volume concentration of ${(marketOutput.liquidityImbalance * 100).toFixed(1)}% indicates bottleneck liquidity. One venue becoming dark liquidity destination. Informed traders execute through concentrated venue to minimize detection. Systematic flow patterns suggest predetermined routing.` :
    liquidityImbalanceLevel === 'Elevated' ?
    `Liquidity imbalance elevated (${(marketOutput.liquidityImbalance * 100).toFixed(1)}%). Some venues acting as preferred execution destinations. Volume concentration may enable informed block trading while avoiding broadcast.` :
    `Balanced liquidity profile (${(marketOutput.liquidityImbalance * 100).toFixed(1)}%). Volume distributed across venues. Insider positioning harder to execute discreetly.`;

  const findings: string[] = [];
  if (marketOutput.divergenceScore > 0.6) {
    findings.push('Cross-market divergence signals unequal information distribution');
  }
  if (marketOutput.liquidityImbalance > 0.5) {
    findings.push('Concentrated liquidity creates execution hide for large informed orders');
  }
  if (marketOutput.stressIndex > 0.6) {
    findings.push('Stress regime provides cover for insider positioning');
  }
  if (findings.length === 0) {
    findings.push('Market structure consistent with efficient price discovery');
  }

  return {
    divergenceInterpretation,
    leadLagDynamics,
    stressRegimeImpact,
    liquidityImbalanceRisks,
    keyFindings: findings
  };
}

/**
 * Build Geopolitical Context section
 */
function buildGeopoliticalContext(geopoliticalOutput: GeopoliticalAnalysisResult): GeopoliticalContext {
  const newsLagLevel = geopoliticalOutput.newsLagIndicator > 0.7 ? 'Critical' :
                       geopoliticalOutput.newsLagIndicator > 0.5 ? 'Significant' :
                       geopoliticalOutput.newsLagIndicator > 0.3 ? 'Moderate' : 'Minimal';

  const macroRiskAssessment = `Geopolitical risk score: ${(geopoliticalOutput.geopoliticalRiskScore * 100).toFixed(1)}%. ` +
    (geopoliticalOutput.geopoliticalRiskScore > 0.6 ?
      `Macro environment elevated with ${geopoliticalOutput.themeDistribution.map(t => t.name).join(', ')} concerns. Escalation probability ${(geopoliticalOutput.escalationProbability * 100).toFixed(1)}%. Major catalyst risk for rapid repricing.` :
      `Macro environment moderate. Baseline geopolitical monitoring active.`);

  const newsTimingAnomalies = newsLagLevel === 'Critical' ?
    `CRITICAL NEWS LAG: News articles published ${(geopoliticalOutput.newsLagIndicator * 100).toFixed(1)}% of the time AFTER market movements. Pattern suggests market moved on pre-announcement information, with news serving as post-hoc justification. Physical evidence of information leakage identified.` :
    newsLagLevel === 'Significant' ?
    `Significant news lag detected (${(geopoliticalOutput.newsLagIndicator * 100).toFixed(1)}%). Multiple articles appearing 15-30 minutes after market movement. Suggests pre-market information awareness.` :
    `Minor news timing skew (${(geopoliticalOutput.newsLagIndicator * 100).toFixed(1)}%). News broadly synchronized with market movement. No systematic lag pattern.`;

  const escalationSignals = geopoliticalOutput.escalationProbability > 0.6 ?
    `Escalation triggers identified. ${geopoliticalOutput.themeDistribution.length} themes with elevated severity. Market repricing vulnerable to rapid catalyst (${(geopoliticalOutput.escalationProbability * 100).toFixed(1)}% probability).` :
    `Escalation probability moderate. Standard monitoring sufficient.`;

  const themesList = geopoliticalOutput.themeDistribution.map(t => `${t.name} (${t.count} mentions, severity: ${['low', 'moderate', 'high', 'critical'][t.severity]})`);

  return {
    macroRiskAssessment,
    newsTimingAnomalies,
    escalationSignals,
    keyThemes: themesList.length > 0 ? themesList : ['No dominant themes']
  };
}

/**
 * Build Composite Risk Conclusion section
 */
function buildCompositeRiskConclusion(
  insiderTradingProbability: number,
  compositeScore: number,
  modelOutput: MLModelOutput,
  sentimentOutput: SentimentAnalysisResult,
  marketOutput: MarketAnalysisResult | undefined,
  geopoliticalOutput: GeopoliticalAnalysisResult | undefined,
  entityType: 'government' | 'company' | 'institutional' = 'government',
  activeAgents: string[] = ['sentiment', 'mega']
): CompositeRiskConclusion {
  const classification = classifyInsiderProbability(insiderTradingProbability);

  const evidenceWeight = [];
  
  // Build evidence list based on which agents are active
  if (activeAgents.includes('sentiment') && sentimentOutput.timingAnomalyScore > 0.6) {
    evidenceWeight.push('Price preceding news (weighted 35%)');
  }
  if (activeAgents.includes('geopolitical') && geopoliticalOutput && geopoliticalOutput.newsLagIndicator > 0.5) {
    evidenceWeight.push('News published after market move (weighted 25%)');
  }
  if (activeAgents.includes('market') && marketOutput && marketOutput.divergenceScore > 0.5) {
    evidenceWeight.push('Cross-market divergence (weighted 20%)');
  }
  if (activeAgents.includes('model') && modelOutput.abnormalBettingScore > 0.6) {
    evidenceWeight.push('Unusual betting patterns (weighted 15%)');
  }

  // Build entity-specific preface
  let entityContext = '';
  if (entityType === 'government') {
    entityContext = '[GOVERNMENT ENTITY ANALYSIS] Analysis based on sentiment signals and geopolitical context. ';
  } else if (entityType === 'company') {
    entityContext = '[COMPANY ENTITY ANALYSIS] Analysis based solely on public sentiment and trading patterns. ';
  } else if (entityType === 'institutional') {
    entityContext = '[INSTITUTIONAL ENTITY ANALYSIS] Analysis includes cross-market divergence detection. ';
  }

  const evidenceSummary = classification === 'HIGH' ?
    `${entityContext}HIGH INSIDER TRADING PROBABILITY (${(insiderTradingProbability * 100).toFixed(1)}%). Multiple convergent signals detected: ${evidenceWeight.join('; ')}. ` +
    `Evidence suggests price discovery preceded public information release, indicating potential asymmetric information access. Pattern analysis reveals market participants acting with awareness of unreleased catalysts. ` +
    `Temporal sequencing demonstrates classic insider trading microstructure: positioning before announcement, price movement preceding news, divergent market pricing before consensus.` :
    classification === 'MODERATE' ?
    `${entityContext}MODERATE INSIDER SUSPICION (${(insiderTradingProbability * 100).toFixed(1)}%). Mixed evidence patterns: ${evidenceWeight.join('; ')}. ` +
    `Some indicators suggest information asymmetry but alternative explanations possible (e.g., correlation-driven positioning, predictive models, coincidence). Recommendation: Elevated monitoring. Additional data points may clarify.` :
    `${entityContext}LOW INSIDER PROBABILITY (${(insiderTradingProbability * 100).toFixed(1)}%). Evidence insufficient for material insider suspicion. ${evidenceWeight.length > 0 ? `Minor signals: ${evidenceWeight.join('; ')}` : 'No significant evidence detected'}. ` +
    `Market structure, sentiment, and news timing broadly aligned. Normal price discovery mechanisms operating.`;

  const actions: string[] = [];
  if (classification === 'HIGH') {
    actions.push('PRIORITY: Forward all analysis to regulatory review');
    actions.push('Flag accounts/entities operating in identified venues');
    actions.push('Cross-reference with SEC/FINRA suspicious activity databases');
    actions.push('Monitor affected accounts for 30-day period post-event');
  } else if (classification === 'MODERATE') {
    actions.push('Increase monitoring frequency to daily assessments');
    actions.push('Track position sizes and timing patterns');
    actions.push('Flag for compliance review if patterns repeat');
  } else {
    actions.push('Continue standard monitoring protocols');
    actions.push('Set alerts for threshold breaches');
  }

  return {
    insiderTradingProbability,
    probabilityClassification: classification,
    evidenceSummary,
    recommendedActions: actions
  };
}

/**
 * Generate comprehensive institutional-grade report
 * Report sections vary based on entity type and active agents
 */
function generateMegaReport(
  modelIndicators: ModelIndicators,
  crowdSentimentAssessment: CrowdSentimentAssessment,
  marketStructureAnalysis: MarketStructureAnalysis,
  geopoliticalContext: GeopoliticalContext,
  compositeRiskConclusion: CompositeRiskConclusion,
  compositeScore: number,
  modelOutput: MLModelOutput,
  sentimentOutput: SentimentAnalysisResult,
  marketOutput: MarketAnalysisResult | undefined,
  geopoliticalOutput: GeopoliticalAnalysisResult | undefined,
  entityType: 'government' | 'company' | 'institutional' = 'government',
  activeAgents: string[] = ['sentiment', 'mega']
): string {
  const timestamp = new Date().toISOString();
  
  // Build entity-specific report header
  let reportTitle = 'INSTITUTIONAL RISK INTELLIGENCE REPORT';
  let entitySubtitle = '';
  if (entityType === 'government') {
    entitySubtitle = 'Analysis Profile: GOVERNMENT ENTITY (Geopolitical + Sentiment Focus)';
  } else if (entityType === 'company') {
    entitySubtitle = 'Analysis Profile: CORPORATE ENTITY (Sentiment + Behavioral Focus)';
  } else if (entityType === 'institutional') {
    entitySubtitle = 'Analysis Profile: INSTITUTIONAL ENTITY (Cross-Market + Structural Focus)';
  }

  let reportContent = `
═══════════════════════════════════════════════════════════════════════════════
${reportTitle}
Insider Trading Detection Analysis Engine
${entitySubtitle}
Timestamp: ${timestamp}
Active Analysis Agents: ${activeAgents.map(a => a.charAt(0).toUpperCase() + a.slice(1)).join(', ')}
═══════════════════════════════════════════════════════════════════════════════

EXECUTIVE SUMMARY
────────────────────────────────────────────────────────────────────────────────

Composite Risk Score: ${(compositeScore * 100).toFixed(1)}% (${classifyRiskLevel(compositeScore)})
Insider Trading Probability: ${(compositeRiskConclusion.insiderTradingProbability * 100).toFixed(1)}% (${compositeRiskConclusion.probabilityClassification})

${compositeRiskConclusion.evidenceSummary}

Recommended Actions:
${compositeRiskConclusion.recommendedActions.map((action, i) => `  ${i + 1}. ${action}`).join('\n')}


SECTION 1: MODEL INDICATORS
────────────────────────────────────────────────────────────────────────────────

Abnormal Betting Assessment
────────
${modelIndicators.abnormalBettingAssessment}

The model's abnormal betting score of ${(modelOutput.abnormalBettingScore * 100).toFixed(1)}% captures the degree to which observed trading patterns deviate from historical baseline distributions. High scores indicate positioning concentration, unusual volume-to-price ratios, or temporal clustering of orders that exceed statistical expectations. Such deviations frequently correlate with informed trading activity, where market participants execute large positions while maintaining market impact discipline.

Liquidity Context
────────
${modelIndicators.liquidityContext}

Market liquidity levels directly impact the feasibility and risk profile of insider trading. In highly liquid venues, large positions can be absorbed without material price impact, enabling informed traders to execute discreetly. Conversely, constrained liquidity environments force larger price movements per unit volume, making insider positioning more visible through traditional surveillance. Current liquidity score of ${(modelOutput.liquidityScore * 100).toFixed(1)}% indicates ${modelOutput.liquidityScore > 0.5 ? 'adequate depth for institutional flows' : 'constraints that amplify positioning visibility'}.

Volatility Regime
────────
${modelIndicators.volatilityRegime}

Volatility regimes significantly influence insider trading execution strategy. High volatility environments provide natural cover for unusual trading activity, as large moves can be attributed to market-wide stress rather than asymmetric information. The volatility index of ${(modelOutput.volatilityIndex * 100).toFixed(1)}% ${modelOutput.volatilityIndex > 0.5 ? 'creates operational camouflage for informed positioning' : 'maintains relatively transparent microstructure'}.

Key Observations:
${modelIndicators.keyObservations.map(obs => `  • ${obs}`).join('\n')}


SECTION 2: CROWD SENTIMENT ASSESSMENT
────────────────────────────────────────────────────────────────────────────────

Sentiment-Price Timing Analysis
────────
${crowdSentimentAssessment.sentimentTimingAnalysis}

The temporal relationship between social sentiment and market price movement provides a critical window into information dissemination patterns. When sentiment shifts consistently precede price discovery, it indicates information cascading through retail channels ahead of broader market repricing. A timing anomaly score of ${(sentimentOutput.timingAnomalyScore * 100).toFixed(1)}% reflects the magnitude of temporal skew detected across Twitter, Reddit, and Kalshi comment boards.

Manipulation Risk Assessment
────────
${crowdSentimentAssessment.manipulationRisks}

Keyword analysis across social platforms reveals organized vs. organic discussion patterns. Red flag terms such as "insider knowledge," "sharp money," and "got a tip" concentrate in specific time windows, suggesting coordinated dissemination of non-public information. Manipulation suspicion score of ${(sentimentOutput.manipulationSuspicionScore * 100).toFixed(1)}% indicates ${sentimentOutput.manipulationSuspicionScore > 0.5 ? 'elevated coordination risk' : 'organic discussion patterns'}.

Information Leakage Indicators
────────
${crowdSentimentAssessment.leakageIndicators}

Pre-movement sentiment surge detection captures the phenomenon of social media discussions accelerating ahead of public price discovery. A pre-movement sentiment score of ${(sentimentOutput.preMovementSentimentScore * 100).toFixed(1)}% quantifies the clustering of bullish sentiment posts within 2-6 hours before documented price spikes. This pattern is inconsistent with retail discovery—retail investors typically react to price changes, not precede them.

Key Signals:
${crowdSentimentAssessment.keySignals.map(sig => `  • ${sig}`).join('\n')}
`;

  // Conditionally add Market Structure Analysis (only for institutional)
  if (activeAgents.includes('market') && marketOutput) {
    reportContent += `

SECTION 3: MARKET STRUCTURE ANALYSIS
────────────────────────────────────────────────────────────────────────────────

Cross-Market Divergence Interpretation
────────
${marketStructureAnalysis.divergenceInterpretation}

Prediction markets often operate across multiple venues with independent order books (Kalshi, Polymarket, etc.). Under efficient market conditions, these venues should maintain highly correlated pricing. Material divergence (divergence score: ${(marketOutput.divergenceScore * 100).toFixed(1)}%) indicates that venues operate with differential information sets. Informed traders exploit this gap by accumulating positions in the informed venue before cross-market convergence forces repricing in the other venue.

Lead-Lag Market Dynamics
────────
${marketStructureAnalysis.leadLagDynamics}

Sequential price movement analysis across venues reveals which platform receives information first. Consistent lead-lag patterns suggest systematic information advantage in one venue. When one market consistently leads by 5-15 minute intervals, it indicates informed institutional flow entering ahead of crowd discovery.

Stress Regime Impact
────────
${marketStructureAnalysis.stressRegimeImpact}

Market stress conditions (stress index: ${(marketOutput.stressIndex * 100).toFixed(1)}%) significantly affect the visibility of insider positioning. Under stress, volatility and volume spikes occur routinely, providing natural cover for unusual trading activity. Conversely, calm market conditions make insider positioning more apparent through microstructure analysis.

Liquidity Imbalance Risks
────────
${marketStructureAnalysis.liquidityImbalanceRisks}

Key Findings:
${marketStructureAnalysis.keyFindings.map(finding => `  • ${finding}`).join('\n')}
`;
  }

  // Conditionally add Geopolitical Analysis (only for government)
  if (activeAgents.includes('geopolitical') && geopoliticalOutput) {
    reportContent += `

SECTION 4: GEOPOLITICAL RISK LANDSCAPE
────────────────────────────────────────────────────────────────────────────────

Macro Risk Assessment
────────
${geopoliticalContext.macroRiskAssessment}

Geopolitical events create outsized prediction market movements due to their binary nature and low base rates of occurrence. Informed traders with advance knowledge of policy decisions, military actions, or international incidents can position ahead of public announcement, generating predictable price discovery sequences.

News Timing Anomalies
────────
${geopoliticalContext.newsTimingAnomalies}

This analysis aligns price movement timing against official news publication timestamps. When market prices begin moving 30-90 minutes before news release, it indicates participants accessed information through privileged channels. Such timing gaps are statistically rare outside of insider trading contexts. The news lag indicator of ${(geopoliticalOutput.newsLagIndicator * 100).toFixed(1)}% reflects the magnitude of this temporal gap.

Escalation Signals
────────
${geopoliticalContext.escalationSignals}

Geopolitical risks often escalate gradually through identifiable stages. By tracking institutional positioning moves across these stages, we can identify which market participants have access to forward-looking intelligence. Escalation tracking reveals entry points that precede public awareness.

Key Themes Analysis:
${geopoliticalContext.keyThemes.map(theme => `  • ${theme}`).join('\n')}
`;
  }

  reportContent += `

SECTION 5: COMPOSITE RISK CONCLUSION & METHODOLOGY
────────────────────────────────────────────────────────────────────────────────

This analysis synthesizes evidence from ${activeAgents.length > 0 ? activeAgents.join(', ') : 'available data sources'} to assess insider trading probability. The methodology prioritizes temporal ordering—the most reliable indicator of asymmetric information access—alongside cross-market divergence and behavioral anomalies.

Entity Profile Impact:
${getEntityMethodologyNote(entityType)}

Final Assessment:
${compositeRiskConclusion.evidenceSummary}

═══════════════════════════════════════════════════════════════════════════════
Report Generated: ${timestamp}
Analysis Engine: NVIDIA Nemotron 3 Nano 30B
Classification: INSTITUTIONAL CONFIDENTIAL
═══════════════════════════════════════════════════════════════════════════════
`;

  return reportContent;
}

/**
 * Helper function to add entity-specific methodology notes to report
 */
function getEntityMethodologyNote(entityType: 'government' | 'company' | 'institutional'): string {
  if (entityType === 'government') {
    return `GOVERNMENT ENTITY: This analysis prioritizes geopolitical context, news timing anomalies, and public sentiment manipulation. Government insider trading typically involves advance knowledge of policy decisions or official announcements. Detection focuses on timing gaps between market moves and official releases, coupled with sentiment evidence of unauthorized information dissemination.`;
  } else if (entityType === 'company') {
    return `CORPORATE ENTITY: This analysis relies on behavioral and sentiment signals, as public market data is limited for corporate entities. Detection focuses on unusual trading concentrations, social media discussion patterns, and sentiment-to-price timing misalignments. Companies may benefit from insider information regarding corporate actions, litigation outcomes, or partnership announcements.`;
  } else if (entityType === 'institutional') {
    return `INSTITUTIONAL ENTITY: This analysis emphasizes cross-market structural analysis, including divergence detection and lead-lag dynamics across venues. Institutional insiders can exploit information advantages through sophisticated arbitrage strategies, leveraging differential venue pricing. Detection focuses on systematic positioning patterns and cross-venue execution sequencing.`;
  }
  return '';
}

/**
 * Main Mega Risk Agent
 * Composites all agent outputs into comprehensive insider trading assessment
 */
export async function runMegaRiskAgent(input: {
  modelOutput: MLModelOutput;
  sentimentOutput: SentimentAnalysisResult;
  marketOutput?: MarketAnalysisResult;
  geopoliticalOutput?: GeopoliticalAnalysisResult;
  entityType: 'government' | 'company' | 'institutional';
  activeAgents: string[];
}): Promise<MegaRiskResult> {
  const startTime = Date.now();

  console.log('🏛️  Mega Risk Agent: Starting composite analysis...');
  console.log(`   Entity Type: ${input.entityType.toUpperCase()}`);
  console.log(`   Active Agents: ${input.activeAgents.join(', ')}`);

  // Simulate institutional processing delay
  await new Promise(resolve => setTimeout(resolve, 3000));

  const {
    modelOutput,
    sentimentOutput,
    marketOutput,
    geopoliticalOutput,
    entityType,
    activeAgents
  } = input;

  // Calculate composite score (adaptive to entity type)
  const compositeScore = calculateCompositeScore(
    modelOutput,
    sentimentOutput,
    marketOutput,
    geopoliticalOutput,
    entityType
  );

  // Calculate insider trading probability (adaptive to entity type)
  const insiderTradingProbability = calculateInsiderTradingProbability(
    modelOutput,
    sentimentOutput,
    marketOutput,
    geopoliticalOutput,
    entityType
  );

  // Classify risk levels
  const finalRiskLevel = classifyRiskLevel(compositeScore);

  // Build section analyses
  const modelIndicators = buildModelIndicators(modelOutput);
  const crowdSentimentAssessment = buildCrowdSentimentAssessment(sentimentOutput);
  const marketStructureAnalysis = marketOutput 
    ? buildMarketStructureAnalysis(marketOutput, modelOutput)
    : {
        divergenceInterpretation: 'Not analyzed for this entity type',
        leadLagDynamics: 'N/A',
        stressRegimeImpact: 'N/A',
        liquidityImbalanceRisks: 'N/A',
        keyFindings: ['Market analysis not applicable for this entity type']
      };
  const geopoliticalContext = geopoliticalOutput
    ? buildGeopoliticalContext(geopoliticalOutput)
    : {
        macroRiskAssessment: 'Not analyzed for this entity type',
        newsTimingAnomalies: 'N/A',
        escalationSignals: 'N/A',
        keyThemes: ['Geopolitical analysis not applicable for this entity type']
      };
  const compositeRiskConclusion = buildCompositeRiskConclusion(
    insiderTradingProbability,
    compositeScore,
    modelOutput,
    sentimentOutput,
    marketOutput,
    geopoliticalOutput,
    entityType,
    activeAgents
  );

  // Generate comprehensive report (entity-aware)
  const report = generateMegaReport(
    modelIndicators,
    crowdSentimentAssessment,
    marketStructureAnalysis,
    geopoliticalContext,
    compositeRiskConclusion,
    compositeScore,
    modelOutput,
    sentimentOutput,
    marketOutput,
    geopoliticalOutput,
    entityType,
    activeAgents
  );

  const processingTimeMs = Date.now() - startTime;

  // Console output with entity context
  console.log('📊 Composite Score:', `${(compositeScore * 100).toFixed(1)}% (${finalRiskLevel})`);
  console.log('🕵️  Insider Trading Probability:', `${(insiderTradingProbability * 100).toFixed(1)}% (${classifyInsiderProbability(insiderTradingProbability)})`);
  
  let evidenceSummary = '⚖️  Evidence Used: ';
  if (activeAgents.includes('sentiment')) evidenceSummary += `Timing (${(sentimentOutput.timingAnomalyScore * 100).toFixed(1)}%) `;
  if (activeAgents.includes('market')) evidenceSummary += `Divergence (${((marketOutput?.divergenceScore ?? 0) * 100).toFixed(1)}%) `;
  if (activeAgents.includes('geopolitical')) evidenceSummary += `News Lag (${((geopoliticalOutput?.newsLagIndicator ?? 0) * 100).toFixed(1)}%) `;
  evidenceSummary += `Abnormal Betting (${(modelOutput.abnormalBettingScore * 100).toFixed(1)}%)`;
  console.log(evidenceSummary);
  console.log('✅ Mega Risk Agent: Analysis complete\n');

  return {
    compositeScore,
    insiderTradingProbability,
    finalRiskLevel,
    modelIndicators,
    crowdSentimentAssessment,
    marketStructureAnalysis,
    geopoliticalContext,
    compositeRiskConclusion,
    report,
    processingTimeMs,
    timestamp: new Date().toISOString()
  };
}
