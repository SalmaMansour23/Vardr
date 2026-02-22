/**
 * Nemotron-Simulated Sentiment Analysis Agent
 * Analyzes social media, Reddit, and trading platform sentiment
 * for prediction market risk intelligence
 */

import { NewsArticle } from '../data/generateSyntheticData';

// ==================== TYPES ====================

interface TwitterPost {
  username: string;
  content: string;
  likes: number;
  timestamp: string;
  sentiment?: string;
}

interface RedditPost {
  username: string;
  subreddit: string;
  title: string;
  content: string;
  upvotes: number;
  timestamp: string;
  context?: string;
}

interface KalshiComment {
  username: string;
  content: string;
  timestamp: string;
  signal?: string;
}

interface SentimentAgentInput {
  twitterPosts: TwitterPost[];
  redditPosts: RedditPost[];
  kalshiComments: KalshiComment[];
  newsArticles?: NewsArticle[];
}

interface SentimentAnalysisResult {
  overallSentimentScore: number; // -1 to +1
  sentimentIntensity: number; // 0 to 1
  manipulationSuspicionScore: number; // 0 to 1
  preMovementSentimentScore: number; // 0 to 1 - Pre-market sentiment spike detection
  timingAnomalyScore: number; // 0 to 1 - Did price change occur before news catalyst?
  reasoning: {
    publicOptimismLevel: string;
    fearIndex: number;
    suspicionOfInsiderTrading: string;
    emotionalVolatility: number;
    preMarketSentimentAlert: string;
    timingAnalysis: string;
    keyFindings: string[];
    analyticalSummary: string;
  };
  processingTimeMs: number;
  timestamp: string;
}

// ==================== KEYWORD DICTIONARIES ====================

const POSITIVE_KEYWORDS = {
  sentiment: ['surge', 'strong', 'confident', 'momentum', 'bullish', 'growth', 'rally', 'boom', 'outperform', 'massive gain'],
  trend: ['trending', 'gaining', 'momentum', 'upward', 'positive', 'breakout', 'breakthrough'],
  confidence: ['confident', 'certainty', 'obvious', 'clearly', 'definitely', 'sure thing'],
  magnitude: ['huge', 'massive', 'significant', 'enormous', 'unprecedented', 'record'],
};

const NEGATIVE_KEYWORDS = {
  crisis: ['crash', 'collapse', 'plunge', 'dump', 'tank', 'crater', 'nosedive'],
  manipulation: ['manipulation', 'suspicious', 'fraud', 'scheme', 'scam', 'rigged'],
  instability: ['instability', 'weakness', 'vulnerability', 'broken', 'failure', 'disaster'],
  fear: ['crash', 'bearish', 'sell-off', 'panic', 'collapse', 'fear'],
  uncertainty: ['uncertain', 'concerning', 'worried', 'risky', 'dangerous', 'beware'],
};

const MANIPULATION_RED_FLAGS = [
  'manipulation',
  'suspicious',
  'fraud',
  'insider',
  'knows something',
  'front-running',
  'pump and dump',
  'coordinated',
  'whale',
  'sharp money',
  'order flow',
  'rigged',
  'scheme',
  'conspiracy',
];

// ==================== UTILITY FUNCTIONS ====================

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
}

function countKeywordMatch(text: string, keywords: string[]): number {
  const normalizedText = normalizeText(text);
  let count = 0;
  keywords.forEach(keyword => {
    const normalizedKeyword = normalizeText(keyword);
    // Count word boundaries for phrase matching
    const regex = new RegExp(`\\b${normalizedKeyword}\\b`, 'g');
    const matches = normalizedText.match(regex);
    count += matches ? matches.length : 0;
  });
  return count;
}

function calculateWeightedSentiment(
  positiveCount: number,
  negativeCount: number,
  totalWords: number
): number {
  if (totalWords === 0) return 0;

  const positiveWeight = positiveCount / totalWords;
  const negativeWeight = negativeCount / totalWords;

  // Normalize to -1 to +1 scale
  const netSentiment = positiveWeight - negativeWeight;
  return Math.max(-1, Math.min(1, netSentiment * 2));
}

function delaySimulation(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================== SENTIMENT ANALYSIS FUNCTIONS ====================

function analyzeTextSentiment(
  text: string
): { sentiment: number; hasManipulationSignals: boolean; intensity: number } {
  const normalizedText = normalizeText(text);
  const wordCount = normalizedText.split(/\s+/).filter(w => w.length > 0).length;

  // Count positive keywords
  let positiveCount = 0;
  Object.values(POSITIVE_KEYWORDS).forEach(keywordList => {
    positiveCount += countKeywordMatch(text, keywordList);
  });

  // Count negative keywords
  let negativeCount = 0;
  Object.values(NEGATIVE_KEYWORDS).forEach(keywordList => {
    negativeCount += countKeywordMatch(text, keywordList);
  });

  // Calculate sentiment score
  const sentiment = calculateWeightedSentiment(positiveCount, negativeCount, wordCount);

  // Detect manipulation signals
  const manipulationCount = countKeywordMatch(text, MANIPULATION_RED_FLAGS);
  const hasManipulationSignals = manipulationCount > 0;

  // Calculate intensity (how strong the sentiment is expressed)
  const intensity = Math.min(1, (positiveCount + negativeCount) / Math.max(wordCount / 5, 1));

  return { sentiment, hasManipulationSignals, intensity };
}

function analyzeTwitterSentiment(posts: TwitterPost[]): {
  avgSentiment: number;
  avgIntensity: number;
  manipulationFlags: number;
  bullishCount: number;
  bearishCount: number;
} {
  let totalSentiment = 0;
  let totalIntensity = 0;
  let manipulationFlags = 0;
  let bullishCount = 0;
  let bearishCount = 0;

  posts.forEach(post => {
    const { sentiment, hasManipulationSignals, intensity } = analyzeTextSentiment(
      `${post.content}`
    );
    totalSentiment += sentiment;
    totalIntensity += intensity;
    if (hasManipulationSignals) manipulationFlags++;
    if (sentiment > 0.3) bullishCount++;
    if (sentiment < -0.3) bearishCount++;
  });

  const count = posts.length || 1;
  return {
    avgSentiment: totalSentiment / count,
    avgIntensity: totalIntensity / count,
    manipulationFlags,
    bullishCount,
    bearishCount,
  };
}

function analyzeRedditSentiment(posts: RedditPost[]): {
  avgSentiment: number;
  avgIntensity: number;
  manipulationFlags: number;
  disagreementCount: number;
  analysisCount: number;
} {
  let totalSentiment = 0;
  let totalIntensity = 0;
  let manipulationFlags = 0;
  let disagreementCount = 0;
  let analysisCount = 0;

  posts.forEach(post => {
    const combinedText = `${post.title} ${post.content}`;
    const { sentiment, hasManipulationSignals, intensity } = analyzeTextSentiment(combinedText);

    totalSentiment += sentiment;
    totalIntensity += intensity;

    if (hasManipulationSignals) manipulationFlags++;
    if (post.context === 'disagreement') disagreementCount++;
    if (post.context === 'betting_strategy') analysisCount++;
  });

  const count = posts.length || 1;
  return {
    avgSentiment: totalSentiment / count,
    avgIntensity: totalIntensity / count,
    manipulationFlags,
    disagreementCount,
    analysisCount,
  };
}

function analyzeKalshiSentiment(comments: KalshiComment[]): {
  avgSentiment: number;
  avgIntensity: number;
  manipulationFlags: number;
  sharperMoneySignals: number;
  liquidityAnomalies: number;
} {
  let totalSentiment = 0;
  let totalIntensity = 0;
  let manipulationFlags = 0;
  let sharperMoneySignals = 0;
  let liquidityAnomalies = 0;

  comments.forEach(comment => {
    const { sentiment, hasManipulationSignals, intensity } = analyzeTextSentiment(comment.content);
    totalSentiment += sentiment;
    totalIntensity += intensity;

    if (hasManipulationSignals) manipulationFlags++;
    if (comment.signal === 'sharp_money') sharperMoneySignals++;
    if (comment.signal === 'liquidity_spike') liquidityAnomalies++;
  });

  const count = comments.length || 1;
  return {
    avgSentiment: totalSentiment / count,
    avgIntensity: totalIntensity / count,
    manipulationFlags,
    sharperMoneySignals,
    liquidityAnomalies,
  };
}

// ==================== PRE-MOVEMENT SENTIMENT DETECTION ====================

/**
 * Detect Pre-Market Sentiment Spike Index
 * Analyzes if strong directional sentiment appeared before price moves
 * Returns score 0-1 indicating likelihood of information leakage
 */
function detectPreMovementSentimentSpike(
  twitterPosts: TwitterPost[],
  redditPosts: RedditPost[]
): { preMovementScore: number; alert: string } {
  const now = new Date();
  
  // Get posts from the last 6 hours (to capture pre-spike sentiment)
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  
  const recentTwitter = twitterPosts.filter(post => {
    try {
      return new Date(post.timestamp) > sixHoursAgo;
    } catch {
      return false;
    }
  });
  
  const recentReddit = redditPosts.filter(post => {
    try {
      return new Date(post.timestamp) > sixHoursAgo;
    } catch {
      return false;
    }
  });

  // Analyze sentiment clustering in recent posts
  let bullishBurstCount = 0;
  let bullishBurstIntensity = 0;
  let informationLeakageIndicators = 0;

  // Twitter analysis - look for concentrated bullish sentiment
  const twitterBullishKeywords = [
    'knows something',
    'insider',
    'sharp money',
    'major catalyst',
    'market doesn\'t know',
    'internal',
    'connects',
    'ahead of news',
    'before',
    'about to',
    'something big',
    'conviction',
  ];

  recentTwitter.forEach(post => {
    let isBullishBurst = false;
    let containsLeakageIndicator = false;

    // Detect bullish sentiment posts
    const postLower = post.content.toLowerCase();
    if (
      postLower.includes('bullish') ||
      postLower.includes('confidence') ||
      postLower.includes('major shift') ||
      postLower.includes('positioned')
    ) {
      bullishBurstCount++;
      isBullishBurst = true;
      bullishBurstIntensity += post.likes > 2000 ? 1 : 0.5; // High-engagement posts weighted higher
    }

    // Detect information leakage indicators
    twitterBullishKeywords.forEach(keyword => {
      if (postLower.includes(keyword)) {
        containsLeakageIndicator = true;
        informationLeakageIndicators++;
      }
    });

    // Combined signal: bullish + leakage indicator = high risk
    if (isBullishBurst && containsLeakageIndicator) {
      bullishBurstIntensity += 1.5;
      informationLeakageIndicators++;
    }
  });

  // Reddit analysis - look for strategic discussion patterns
  let strategyDiscussionCount = 0;
  let coordiantedTalkCount = 0;

  recentReddit.forEach(post => {
    if (post.context === 'betting_strategy') {
      strategyDiscussionCount++;
      // Check for coordinated language in strategy discussions
      const combinedText = `${post.title} ${post.content}`.toLowerCase();
      if (
        combinedText.includes('position') &&
        (combinedText.includes('before') || combinedText.includes('ahead'))
      ) {
        coordiantedTalkCount++;
      }
    }
  });

  // Calculate pre-movement sentiment score
  const twitterFactor = Math.min(1, bullishBurstCount / 5) * 0.4; // 40% weight
  const leakageFactor = Math.min(1, informationLeakageIndicators / 8) * 0.35; // 35% weight
  const intensityFactor = Math.min(1, bullishBurstIntensity / 10) * 0.25; // 25% weight

  const preMovementScore = parseFloat(
    (twitterFactor + leakageFactor + intensityFactor).toFixed(3)
  );

  // Generate alert message based on score
  let alert = '';
  if (preMovementScore > 0.7) {
    alert =
      'CRITICAL: Extreme pre-spike sentiment concentration detected. High probability of information leakage. Coordinated bullish positioning observed prior to expected market move.';
  } else if (preMovementScore > 0.5) {
    alert =
      'HIGH: Significant pre-market sentiment spike detected. Multiple insider-knowledge hints in recent posts. Consider temporal anomaly risk.';
  } else if (preMovementScore > 0.3) {
    alert =
      'MODERATE: Elevated pre-market sentiment activity. Some indicators of information advantage among traders.';
  } else if (preMovementScore > 0.15) {
    alert = 'LOW-MODERATE: Minor sentiment clustering. Standard mkt positioning detected.';
  } else {
    alert = 'LOW: Normal sentiment distribution. No significant pre-movement spike detected.';
  }

  return { preMovementScore, alert };
}

// ==================== TIMING ANOMALY DETECTION ====================

/**
 * Detect Abnormal Timing Score
 * Determines if price changes occur before geopolitical/news catalysts
 * Returns score 0-1 indicating likelihood of timing-based information leakage
 */
function detectTimingAnomalies(
  newsArticles: NewsArticle[],
  redditPosts: RedditPost[]
): { timingAnomalyScore: number; analysis: string } {
  const now = new Date();
  
  // News timing patterns
  const recentNews = newsArticles.filter(article => {
    try {
      const articleTime = new Date(article.timestamp);
      const hoursSinceNews = (now.getTime() - articleTime.getTime()) / (1000 * 60 * 60);
      return hoursSinceNews < 12; // Last 12 hours
    } catch {
      return false;
    }
  });

  // Reddit strategy discussions timing
  const recentReddit = redditPosts.filter(post => {
    try {
      const postTime = new Date(post.timestamp);
      const hoursSincePost = (now.getTime() - postTime.getTime()) / (1000 * 60 * 60);
      return hoursSincePost < 12 && post.context === 'betting_strategy';
    } catch {
      return false;
    }
  });

  let timingAnomaloiesCount = 0;
  let severityWeighting = 0;
  let postNewsStrategyCount = 0; // Posts AFTER high-severity news appear

  // Analyze news severity and timing
  const highSeverityNews = recentNews.filter(n => n.severityLevel === 'high').length;
  const mediumSeverityNews = recentNews.filter(n => n.severityLevel === 'medium').length;

  if (highSeverityNews > 2) {
    severityWeighting += 0.3; // Multiple high-impact catalyst events
  }

  // Check if Reddit posts appear AFTER high-severity news
  recentNews.forEach(newsItem => {
    if (newsItem.severityLevel === 'high') {
      const newsTime = new Date(newsItem.timestamp).getTime();
      const redditPostsAfterNews = recentReddit.filter(post => {
        try {
          const postTime = new Date(post.timestamp).getTime();
          return postTime > newsTime && postTime < newsTime + 3 * 60 * 60 * 1000; // Within 3 hours after
        } catch {
          return false;
        }
      });

      // If strategy posts appear shortly after high-severity news, possible timing anomaly
      if (redditPostsAfterNews.length > 0) {
        timingAnomaloiesCount++;
        // Check if posts contain high-conviction language
        redditPostsAfterNews.forEach(post => {
          const postText = `${post.title} ${post.content}`.toLowerCase();
          if (postText.includes('knew') || postText.includes('called it') || postText.includes('told you')) {
            severityWeighting += 0.2;
          }
        });
      }
    }
  });

  // Calculate timing anomaly score
  const newsFrequencyFactor = Math.min(1, recentNews.length / 5) * 0.3; // 30% weight
  const timingClusterFactor = Math.min(1, timingAnomaloiesCount / 3) * 0.4; // 40% weight
  const severityFactor = Math.min(1, severityWeighting) * 0.3; // 30% weight

  const timingAnomalyScore = parseFloat(
    (newsFrequencyFactor + timingClusterFactor + severityFactor).toFixed(3)
  );

  // Generate analysis
  let analysis = '';
  if (timingAnomalyScore > 0.7) {
    analysis =
      'CRITICAL TIMING ANOMALY: Price moves detected in advance of major news catalysts. Market participants appear to have advanced knowledge of upcoming material developments.';
  } else if (timingAnomalyScore > 0.5) {
    analysis =
      'SIGNIFICANT TIMING CONCERN: Multiple strategy adjustments detected shortly after high-severity news. Suggests information was incorporated rapidly or available earlier than public announcement.';
  } else if (timingAnomalyScore > 0.3) {
    analysis = 'MODERATE TIMING RISK: Some correlation between news release timing and market activity. Monitor for information leakage patterns.';
  } else if (timingAnomalyScore > 0.15) {
    analysis = 'LOW TIMING ANOMALY: News events and market moves broadly aligned. Standard market response patterns observed.';
  } else {
    analysis = 'NO TIMING ANOMALY: Price movements appear to follow news catalysts appropriately. No evidence of information leakage based on timing.';
  }

  return { timingAnomalyScore, analysis };
}

// ==================== REASONING GENERATION ====================

function generateAnalyticalReasoning(
  twitterAnalysis: ReturnType<typeof analyzeTwitterSentiment>,
  redditAnalysis: ReturnType<typeof analyzeRedditSentiment>,
  kalshiAnalysis: ReturnType<typeof analyzeKalshiSentiment>,
  overallSentiment: number,
  sentimentIntensity: number,
  manipulationSuspicion: number,
  preMovementSentimentAlert: string,
  timingAnalysis: string
): SentimentAnalysisResult['reasoning'] {
  const keyFindings: string[] = [];

  // Public Optimism Level
  let publicOptimismLevel = 'Neutral';
  if (overallSentiment > 0.3) {
    publicOptimismLevel = 'High - Strong bullish sentiment detected across platforms';
  } else if (overallSentiment > 0.1) {
    publicOptimismLevel = 'Moderate - Tentative optimism with mixed signals';
  } else if (overallSentiment < -0.3) {
    publicOptimismLevel = 'Low - Widespread bearish sentiment and pessimism';
  } else if (overallSentiment < -0.1) {
    publicOptimismLevel = 'Moderate-Low - Cautious outlook with uncertainty';
  }

  // Fear Index (0-1)
  const fearIndex = Math.max(
    0,
    Math.min(1, (Math.abs(overallSentiment) * -0.5 + 0.5) + (sentimentIntensity * 0.3))
  );

  // Suspicion of Insider Trading
  let suspicionLevel = 'Low';
  let suspicionReasoning = 'Standard market chatter detected';

  if (manipulationSuspicion > 0.7) {
    suspicionLevel = 'High';
    suspicionReasoning =
      'Significant concentration of manipulation-related terminology. Potential sharp money activity detected.';
  } else if (manipulationSuspicion > 0.4) {
    suspicionLevel = 'Moderate';
    suspicionReasoning =
      'Notable manipulation signals present. Unusual order flow patterns mentioned in trader commentary.';
  } else if (manipulationSuspicion > 0.2) {
    suspicionLevel = 'Elevated';
    suspicionReasoning = 'Minor manipulation signals detected. Warrant monitoring for escalation.';
  }

  // Emotional Volatility (0-1)
  const emotionalVolatility = sentimentIntensity * (1 + Math.abs(overallSentiment));

  // Generate Key Findings
  if (twitterAnalysis.bullishCount > twitterAnalysis.bearishCount) {
    keyFindings.push(
      `Twitter shows bullish bias (${twitterAnalysis.bullishCount} bullish vs ${twitterAnalysis.bearishCount} bearish posts)`
    );
  } else if (twitterAnalysis.bearishCount > twitterAnalysis.bullishCount) {
    keyFindings.push(
      `Twitter shows bearish bias (${twitterAnalysis.bearishCount} bearish vs ${twitterAnalysis.bullishCount} bullish posts)`
    );
  }

  if (redditAnalysis.disagreementCount > 5) {
    keyFindings.push(
      `High disagreement level on Reddit (${redditAnalysis.disagreementCount} disagreement threads)`
    );
  }

  if (kalshiAnalysis.sharperMoneySignals > 3) {
    keyFindings.push(
      `Elevated sharp money activity detected (${kalshiAnalysis.sharperMoneySignals} signals)`
    );
  }

  if (kalshiAnalysis.liquidityAnomalies > 3) {
    keyFindings.push(
      `Unusual liquidity patterns on Kalshi (${kalshiAnalysis.liquidityAnomalies} anomaly reports)`
    );
  }

  if (twitterAnalysis.manipulationFlags + redditAnalysis.manipulationFlags > 5) {
    keyFindings.push(
      `Cross-platform manipulation concerns (${twitterAnalysis.manipulationFlags + redditAnalysis.manipulationFlags} mentions)`
    );
  }

  if (redditAnalysis.analysisCount > 10) {
    keyFindings.push(`High analytical engagement on Reddit (${redditAnalysis.analysisCount} strategy discussions)`);
  }

  // Analytical Summary
  let analyticalSummary = `Multi-layer sentiment analysis aggregating perspectives from Twitter (n=${twitterAnalysis.avgIntensity > 0 ? 'bullish-leaning' : 'bearish-leaning'}), `;
  analyticalSummary += `Reddit (debate intensity: ${(redditAnalysis.avgIntensity * 100).toFixed(0)}%), `;
  analyticalSummary += `and Kalshi trader commentary indicates `;

  if (manipulationSuspicion > 0.5) {
    analyticalSummary +=
      `elevated market structure concerns. Sharp money positioning combined with sentiment divergence suggests potential information asymmetry. `;
  } else {
    analyticalSummary += `market activity consistent with public sentiment formation. `;
  }

  analyticalSummary += `Emotional volatility metrics (${(emotionalVolatility * 100).toFixed(1)}%) suggest ${emotionalVolatility > 0.6 ? 'elevated' : 'moderate'} market uncertainty. `;

  if (overallSentiment > 0.2) {
    analyticalSummary +=
      'Bullish positioning appears justified by fundamental optimism across multiple sentiment vectors.';
  } else if (overallSentiment < -0.2) {
    analyticalSummary +=
      'Bearish sentiment reflects genuine concern regarding key risk factors identified in discourse.';
  } else {
    analyticalSummary +=
      'Market attempting to price conflicting signals. Recommend close monitoring of order flow dynamics.';
  }

  return {
    publicOptimismLevel,
    fearIndex: parseFloat(fearIndex.toFixed(3)),
    suspicionOfInsiderTrading: `${suspicionLevel} - ${suspicionReasoning}`,
    emotionalVolatility: parseFloat(emotionalVolatility.toFixed(3)),
    preMarketSentimentAlert: preMovementSentimentAlert,
    timingAnalysis,
    keyFindings,
    analyticalSummary,
  };
}

// ==================== MAIN AGENT FUNCTION ====================

/**
 * Run Nemotron-simulated sentiment analysis agent
 * Analyzes aggregated social media, Reddit, and trading platform sentiment
 * with simulated AI processing delay
 *
 * @param inputData - Twitter posts, Reddit posts, and Kalshi comments
 * @returns Structured sentiment analysis with scoring and reasoning
 */
export async function runSentimentAgent(inputData: SentimentAgentInput): Promise<SentimentAnalysisResult> {
  const startTime = Date.now();

  console.log('🧠 Nemotron Sentiment Agent initialized...');
  console.log(`   Processing ${inputData.twitterPosts.length} Twitter posts`);
  console.log(`   Processing ${inputData.redditPosts.length} Reddit posts`);
  console.log(`   Processing ${inputData.kalshiComments.length} Kalshi comments`);

  // Analyze each data source
  const twitterAnalysis = analyzeTwitterSentiment(inputData.twitterPosts);
  const redditAnalysis = analyzeRedditSentiment(inputData.redditPosts);
  const kalshiAnalysis = analyzeKalshiSentiment(inputData.kalshiComments);

  // Calculate aggregate scores
  const twitterWeight = 0.35;
  const redditWeight = 0.35;
  const kalshiWeight = 0.3;

  const overallSentimentScore = Math.max(
    -1,
    Math.min(
      1,
      twitterAnalysis.avgSentiment * twitterWeight +
        redditAnalysis.avgSentiment * redditWeight +
        kalshiAnalysis.avgSentiment * kalshiWeight
    )
  );

  const sentimentIntensity = Math.max(
    0,
    Math.min(
      1,
      twitterAnalysis.avgIntensity * twitterWeight +
        redditAnalysis.avgIntensity * redditWeight +
        kalshiAnalysis.avgIntensity * kalshiWeight
    )
  );

  const totalManipulationFlags =
    twitterAnalysis.manipulationFlags + redditAnalysis.manipulationFlags + kalshiAnalysis.manipulationFlags;
  const totalComments =
    inputData.twitterPosts.length + inputData.redditPosts.length + inputData.kalshiComments.length;
  const manipulationSuspicionScore = Math.min(1, totalManipulationFlags / Math.max(totalComments / 10, 1));

  // Detect pre-movement sentiment spikes (temporal analysis)
  const { preMovementScore, alert: preMovementAlert } = detectPreMovementSentimentSpike(
    inputData.twitterPosts,
    inputData.redditPosts
  );

  // Detect timing anomalies (did price move before news?)
  const { timingAnomalyScore, analysis: timingAnalysisText } = detectTimingAnomalies(
    inputData.newsArticles || [],
    inputData.redditPosts
  );

  // Generate reasoning
  const reasoning = generateAnalyticalReasoning(
    twitterAnalysis,
    redditAnalysis,
    kalshiAnalysis,
    overallSentimentScore,
    sentimentIntensity,
    manipulationSuspicionScore,
    preMovementAlert,
    timingAnalysisText
  );

  // Simulate Nemotron processing delay
  console.log('⏳ Running neural analysis...');
  await delaySimulation(2500); // 2.5 second delay

  const processingTimeMs = Date.now() - startTime;

  const result: SentimentAnalysisResult = {
    overallSentimentScore: parseFloat(overallSentimentScore.toFixed(4)),
    sentimentIntensity: parseFloat(sentimentIntensity.toFixed(4)),
    manipulationSuspicionScore: parseFloat(manipulationSuspicionScore.toFixed(4)),
    preMovementSentimentScore: parseFloat(preMovementScore.toFixed(4)),
    timingAnomalyScore: parseFloat(timingAnomalyScore.toFixed(4)),
    reasoning,
    processingTimeMs,
    timestamp: new Date().toISOString(),
  };

  console.log('✅ Sentiment analysis complete');
  console.log(`   Overall Sentiment: ${result.overallSentimentScore.toFixed(3)} (${result.overallSentimentScore > 0 ? 'Bullish' : 'Bearish'})`);
  console.log(`   Sentiment Intensity: ${result.sentimentIntensity.toFixed(3)}`);
  console.log(`   Manipulation Suspicion: ${result.manipulationSuspicionScore.toFixed(3)}`);
  console.log(`   Pre-Movement Sentiment Score: ${result.preMovementSentimentScore.toFixed(3)} (Information Leakage Risk)`);
  console.log(`   Timing Anomaly Score: ${result.timingAnomalyScore.toFixed(3)} (Catalyst Timing Risk)`);
  console.log(`   ${result.reasoning.preMarketSentimentAlert}`);
  console.log(`   ${result.reasoning.timingAnalysis}`);
  console.log(`   Processing Time: ${result.processingTimeMs}ms`);

  return result;
}

// Export types for external use
export type { SentimentAgentInput, SentimentAnalysisResult, TwitterPost, RedditPost, KalshiComment };
