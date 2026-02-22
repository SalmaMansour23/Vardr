import {
  generateAllSyntheticInputs,
  AllSyntheticData,
  MLModelOutput
} from './data/generateSyntheticData';
import {
  getTopicData,
  TopicId,
  HARDCODED_TOPIC_DATA
} from './data/hardcodedTopicData';
import {
  runSentimentAgent,
  SentimentAnalysisResult
} from './agents/sentimentAgent';
import {
  runMarketAnalysisAgent,
  MarketAnalysisResult
} from './agents/marketAnalysisAgent';
import {
  runGeopoliticalAgent,
  GeopoliticalAnalysisResult
} from './agents/geopoliticalAgent';
import {
  runMegaRiskAgent,
  MegaRiskResult
} from './agents/megaRiskAgent';

/**
 * Complete AI Risk Intelligence Pipeline Output
 */
export interface AiRiskPipelineOutput {
  syntheticData: AllSyntheticData;
  sentimentAnalysis: SentimentAnalysisResult;
  marketAnalysis?: MarketAnalysisResult;
  geopoliticalAnalysis?: GeopoliticalAnalysisResult;
  megaRiskAssessment: MegaRiskResult;
  pipelineExecutionTimeMs: number;
  timestamp: string;
  entityType: 'government' | 'company' | 'institutional';
  topicId?: TopicId;
}

/**
 * AI Risk Intelligence Pipeline Orchestrator
 * 
 * Executes agents based on entity type:
 * - Government: Sentiment + Geopolitical + Mega Risk
 * - Company: Sentiment + Mega Risk
 * - Institutional: Sentiment + Market Analysis + Mega Risk
 * 
 * Uses hard-coded topic data for specific market scenarios:
 * - '2028-election': Presidential election prediction
 * - 'fed-rate': Federal Reserve rate decision
 * - 'tech-earnings': Tech company earnings beat
 * - 'geopolitical': Geopolitical escalation event
 */
export async function runAiRiskPipeline(
  entityType: 'government' | 'company' | 'institutional' = 'government',
  topicId: TopicId = '2028-election'
): Promise<AiRiskPipelineOutput> {
  const pipelineStartTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log('\n' + '═'.repeat(80));
  console.log(`🚀 AI RISK INTELLIGENCE PIPELINE - ${entityType.toUpperCase()} | ${topicId.toUpperCase()}`);
  console.log('═'.repeat(80));

  try {
    // ════════════════════════════════════════════════════════════════════════════════
    // STAGE 1: DATA LOADING (Hard-coded Topic Data)
    // ════════════════════════════════════════════════════════════════════════════════
    console.log('\n📊 Stage 1/5: Data Loading');
    console.log('─'.repeat(80));
    console.log(`Loading hard-coded data for topic: ${topicId}`);

    const syntheticData = getTopicData(topicId);

    console.log('✅ Topic Data Loaded');
    console.log(`   • ML Model Outputs: ${syntheticData.mlOutputs.length} predictions`);
    console.log(`   • Twitter Posts: ${syntheticData.twitterPosts.length} posts`);
    console.log(`   • Reddit Posts: ${syntheticData.redditPosts.length} posts`);
    console.log(`   • Kalshi Comments: ${syntheticData.kalshiComments.length} comments`);
    console.log(`   • News Articles: ${syntheticData.newsArticles.length} articles`);
    console.log(`   • Market Data: 2 venues (Kalshi + Polymarket)`);
    console.log(`   • Suspicious Events: ${syntheticData.suspiciousEvents.length} events`);

    // ════════════════════════════════════════════════════════════════════════════════
    // STAGE 2: SENTIMENT ANALYSIS AGENT
    // ════════════════════════════════════════════════════════════════════════════════
    console.log('\n🧠 Stage 2/5: Sentiment Analysis');
    console.log('─'.repeat(80));
    console.log('Sentiment Agent Running...');

    const sentimentAnalysis = await runSentimentAgent({
      twitterPosts: syntheticData.twitterPosts,
      redditPosts: syntheticData.redditPosts,
      kalshiComments: syntheticData.kalshiComments,
      newsArticles: syntheticData.newsArticles
    });

    console.log('✅ Sentiment Analysis Complete');
    console.log(`   • Overall Sentiment: ${(sentimentAnalysis.overallSentimentScore * 100).toFixed(1)}%`);
    console.log(`   • Manipulation Suspicion: ${(sentimentAnalysis.manipulationSuspicionScore * 100).toFixed(1)}%`);
    console.log(`   • Pre-Movement Score: ${(sentimentAnalysis.preMovementSentimentScore * 100).toFixed(1)}%`);
    console.log(`   • Timing Anomaly: ${(sentimentAnalysis.timingAnomalyScore * 100).toFixed(1)}%`);
    console.log(`   • Processing Time: ${sentimentAnalysis.processingTimeMs}ms`);

    // Track which agents are active for this entity type
    const activeAgents = ['sentiment'];

    // ════════════════════════════════════════════════════════════════════════════════
    // STAGE 3: MARKET ANALYSIS AGENT (Institutional Only)
    // ════════════════════════════════════════════════════════════════════════════════
    let marketAnalysis: MarketAnalysisResult | undefined;
    if (entityType === 'institutional') {
      console.log('\n📈 Stage 3/5: Market Analysis');
      console.log('─'.repeat(80));
      console.log('Market Agent Running...');

      marketAnalysis = await runMarketAnalysisAgent({
        marketData: [syntheticData.marketData]
      });

      activeAgents.push('market');

      console.log('✅ Market Analysis Complete');
      console.log(`   • Divergence Score: ${(marketAnalysis.divergenceScore * 100).toFixed(1)}%`);
      console.log(`   • Liquidity Imbalance: ${(marketAnalysis.liquidityImbalance * 100).toFixed(1)}%`);
      console.log(`   • Stress Index: ${(marketAnalysis.stressIndex * 100).toFixed(1)}%`);
      console.log(`   • Processing Time: ${marketAnalysis.processingTimeMs}ms`);
    } else {
      console.log('\n📈 Stage 3/5: Market Analysis - SKIPPED (not applicable for ${entityType} entity)');
    }

    // ════════════════════════════════════════════════════════════════════════════════
    // STAGE 4: GEOPOLITICAL ANALYSIS AGENT (Government Only)
    // ════════════════════════════════════════════════════════════════════════════════
    let geopoliticalAnalysis: GeopoliticalAnalysisResult | undefined;
    if (entityType === 'government') {
      console.log('\n🌍 Stage 4/5: Geopolitical Analysis');
      console.log('─'.repeat(80));
      console.log('Geopolitical Agent Running...');

      geopoliticalAnalysis = await runGeopoliticalAgent(syntheticData.newsArticles);

      activeAgents.push('geopolitical');

      console.log('✅ Geopolitical Analysis Complete');
      console.log(`   • Geopolitical Risk: ${(geopoliticalAnalysis.geopoliticalRiskScore * 100).toFixed(1)}%`);
      console.log(`   • Escalation Probability: ${(geopoliticalAnalysis.escalationProbability * 100).toFixed(1)}%`);
      console.log(`   • News Lag Indicator: ${(geopoliticalAnalysis.newsLagIndicator * 100).toFixed(1)}%`);
      console.log(`   • Dominant Themes: ${geopoliticalAnalysis.themeDistribution.map(t => t.name).join(', ')}`);
      console.log(`   • Processing Time: ${geopoliticalAnalysis.processingTimeMs}ms`);
    } else {
      console.log('\n🌍 Stage 4/5: Geopolitical Analysis - SKIPPED (not applicable for ${entityType} entity)');
    }

    // ════════════════════════════════════════════════════════════════════════════════
    // STAGE 5: MEGA RISK AGENT (COMPOSITE)
    // ════════════════════════════════════════════════════════════════════════════════
    console.log('\n🏛️  Stage 5/5: Composite Risk Assessment');
    console.log('─'.repeat(80));
    console.log(`Generating Final Risk Report (${entityType.toUpperCase()} Entity)...`);
    console.log(`Active Agents: ${activeAgents.join(', ')}`);

    // Select primary model output for mega agent
    const primaryModelOutput: MLModelOutput = syntheticData.mlOutputs[0] || {
      riskScore: 0.5,
      liquidityScore: 0.6,
      volatilityIndex: 0.4,
      abnormalBettingScore: 0.35
    };

    const megaRiskAssessment = await runMegaRiskAgent({
      modelOutput: primaryModelOutput,
      sentimentOutput: sentimentAnalysis,
      marketOutput: marketAnalysis,
      geopoliticalOutput: geopoliticalAnalysis,
      entityType,
      activeAgents
    });

    activeAgents.push('mega');

    console.log('✅ Final Risk Report Generated');
    console.log(`   • Composite Score: ${(megaRiskAssessment.compositeScore * 100).toFixed(1)}% (${megaRiskAssessment.finalRiskLevel})`);
    console.log(`   • Insider Trading Probability: ${(megaRiskAssessment.insiderTradingProbability * 100).toFixed(1)}% (${megaRiskAssessment.compositeRiskConclusion.probabilityClassification})`);
    console.log(`   • Processing Time: ${megaRiskAssessment.processingTimeMs}ms`);

    // ════════════════════════════════════════════════════════════════════════════════
    // PIPELINE COMPLETE
    // ════════════════════════════════════════════════════════════════════════════════
    const pipelineExecutionTimeMs = Date.now() - pipelineStartTime;

    console.log('\n' + '═'.repeat(80));
    console.log('✅ AI RISK INTELLIGENCE PIPELINE - COMPLETE');
    console.log('═'.repeat(80));
    console.log(`Total Execution Time: ${pipelineExecutionTimeMs}ms (${(pipelineExecutionTimeMs / 1000).toFixed(1)}s)`);
    console.log(`Timestamp: ${timestamp}`);
    console.log('═'.repeat(80) + '\n');

    // Return consolidated output
    return {
      syntheticData,
      sentimentAnalysis,
      marketAnalysis,
      geopoliticalAnalysis,
      megaRiskAssessment,
      pipelineExecutionTimeMs,
      timestamp,
      entityType,
      topicId
    };

  } catch (error) {
    console.error('\n❌ PIPELINE ERROR:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : '');
    throw error;
  }
}

/**
 * Helper function to pretty-print pipeline results
 */
export function printPipelineResults(output: AiRiskPipelineOutput): void {
  console.log('\n' + '═'.repeat(80));
  console.log('📋 AI RISK INTELLIGENCE PIPELINE RESULTS SUMMARY');
  console.log('═'.repeat(80));
  console.log(`\nEntity Type: ${output.entityType.toUpperCase()}`);

  console.log('\n🧠 SENTIMENT ANALYSIS');
  console.log('─'.repeat(80));
  console.log(`Overall Sentiment Score: ${(output.sentimentAnalysis.overallSentimentScore * 100).toFixed(1)}%`);
  console.log(`Sentiment Intensity: ${(output.sentimentAnalysis.sentimentIntensity * 100).toFixed(1)}%`);
  console.log(`Manipulation Suspicion: ${(output.sentimentAnalysis.manipulationSuspicionScore * 100).toFixed(1)}%`);
  console.log(`Pre-Movement Score: ${(output.sentimentAnalysis.preMovementSentimentScore * 100).toFixed(1)}%`);
  console.log(`Timing Anomaly Score: ${(output.sentimentAnalysis.timingAnomalyScore * 100).toFixed(1)}%`);
  console.log(`Reasoning: ${output.sentimentAnalysis.reasoning.analyticalSummary}`);

  if (output.marketAnalysis) {
    console.log('\n📈 MARKET ANALYSIS');
    console.log('─'.repeat(80));
    console.log(`Divergence Score: ${(output.marketAnalysis.divergenceScore * 100).toFixed(1)}%`);
    console.log(`Liquidity Imbalance: ${(output.marketAnalysis.liquidityImbalance * 100).toFixed(1)}%`);
    console.log(`Stress Index: ${(output.marketAnalysis.stressIndex * 100).toFixed(1)}%`);
    console.log(`Market Alignment: ${output.marketAnalysis.reasoning.marketAlignment}`);
  }

  if (output.geopoliticalAnalysis) {
    console.log('\n🌍 GEOPOLITICAL ANALYSIS');
    console.log('─'.repeat(80));
    console.log(`Geopolitical Risk: ${(output.geopoliticalAnalysis.geopoliticalRiskScore * 100).toFixed(1)}%`);
    console.log(`Escalation Probability: ${(output.geopoliticalAnalysis.escalationProbability * 100).toFixed(1)}%`);
    console.log(`News Lag Indicator: ${(output.geopoliticalAnalysis.newsLagIndicator * 100).toFixed(1)}%`);
    console.log(`Themes: ${output.geopoliticalAnalysis.themeDistribution.map(t => `${t.name}(${t.count})`).join(', ')}`);
  }

  console.log('\n🏛️  COMPOSITE RISK ASSESSMENT');
  console.log('─'.repeat(80));
  console.log(`Composite Score: ${(output.megaRiskAssessment.compositeScore * 100).toFixed(1)}%`);
  console.log(`Risk Level: ${output.megaRiskAssessment.finalRiskLevel}`);
  console.log(`Insider Trading Probability: ${(output.megaRiskAssessment.insiderTradingProbability * 100).toFixed(1)}%`);
  console.log(`Classification: ${output.megaRiskAssessment.compositeRiskConclusion.probabilityClassification}`);
  console.log(`\nRecommended Actions:`);
  output.megaRiskAssessment.compositeRiskConclusion.recommendedActions.forEach((action, i) => {
    console.log(`  ${i + 1}. ${action}`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log(`Pipeline Execution Time: ${output.pipelineExecutionTimeMs}ms (${(output.pipelineExecutionTimeMs / 1000).toFixed(1)}s)`);
  console.log(`Generated: ${output.timestamp}`);
  console.log(`Entity Type: ${output.entityType.toUpperCase()}`);
  console.log('═'.repeat(80) + '\n');
}
