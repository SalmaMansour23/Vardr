import { NewsArticle } from '../data/generateSyntheticData';

/**
 * Geopolitical Analysis Agent
 * Detects macro-level risk factors and market timing anomalies
 * Analyzes news articles for geopolitical themes and lag indicators
 */

interface GeopoliticalTheme {
  name: 'conflict' | 'sanctions' | 'inflation' | 'instability' | 'interference';
  severity: 0 | 1 | 2 | 3; // 0=low, 1=moderate, 2=high, 3=critical
  count: number;
  examples: string[];
}

interface GeopoliticalReasoning {
  dominantThemes: string;
  regionalImpact: string;
  escalationTriggers: string;
  marketRelevance: string;
  newsTimingAnalysis: string;
  factualSummary: string;
}

export interface GeopoliticalAnalysisResult {
  geopoliticalRiskScore: number; // 0-1
  themeDistribution: GeopoliticalTheme[];
  escalationProbability: number; // 0-1
  newsLagIndicator: number; // 0-1 (1 = news AFTER market move)
  reasoning: GeopoliticalReasoning;
  processingTimeMs: number;
  timestamp: string;
}

/**
 * Keyword dictionaries for theme detection
 */
const THEME_KEYWORDS = {
  conflict: [
    'military', 'armed', 'war', 'attack', 'invasion', 'border', 'offensive', 
    'deployment', 'strike', 'combat', 'ceasefire', 'combatants', 'escalation', 'aggression',
    'siege', 'blockade', 'territorial', 'incursion', 'tensions', 'breach'
  ],
  sanctions: [
    'sanctions', 'tariff', 'trade war', 'embargo', 'restrictions', 'freezing assets',
    'penalties', 'blocked', 'compliance', 'export control', 'import ban', 'exclusion',
    'retaliatory', 'reciprocal', 'duty', 'quota'
  ],
  inflation: [
    'inflation', 'prices rise', 'cost of living', 'wage pressure', 'commodity prices',
    'supply chain', 'shortage', 'scarcity', 'demand surge', 'purchasing power', 'deflation',
    'stagflation', 'price spike', 'rate hike', 'monetary pressure'
  ],
  instability: [
    'unrest', 'protest', 'riot', 'civil disorder', 'coup', 'uprising', 'chaos',
    'collapse', 'crisis', 'emergency', 'instability', 'volatility', 'uncertainty',
    'fragmentation', 'polarization', 'breakdown', 'dysfunction'
  ],
  interference: [
    'interference', 'disinformation', 'propaganda', 'election', 'influence campaign',
    'manipulation', 'hacking', 'espionage', 'unauthorized access', 'infiltration',
    'foreign agent', 'intelligence operation', 'sabotage', 'disruption'
  ]
};

/**
 * Severity mapping for keywords (0-3 scale)
 */
const SEVERITY_MAPPING: Record<string, Record<string, number>> = {
  conflict: {
    'armed': 2, 'war': 3, 'attack': 3, 'invasion': 3, 'military': 1,
    'combat': 2, 'siege': 2, 'escalation': 2
  },
  sanctions: {
    'sanctions': 2, 'embargo': 3, 'trade war': 2, 'tariff': 1, 'restrictions': 1
  },
  inflation: {
    'inflation': 1, 'surge': 2, 'crisis': 2, 'shortage': 2, 'stagflation': 3
  },
  instability: {
    'coup': 3, 'collapse': 3, 'unrest': 2, 'chaos': 2, 'crisis': 2
  },
  interference: {
    'hacking': 2, 'espionage': 2, 'infiltration': 2, 'disinformation': 1, 'propaganda': 1
  }
};

/**
 * Analyze text for geopolitical themes and severity
 */
function analyzeGeopoliticalThemes(text: string): Map<string, { severity: number; count: number; examples: string[] }> {
  const lowerText = text.toLowerCase();
  const themeResults = new Map<string, { severity: number; count: number; examples: string[] }>();

  // Initialize all themes
  Object.keys(THEME_KEYWORDS).forEach(theme => {
    themeResults.set(theme, { severity: 0, count: 0, examples: [] });
  });

  // Scan for theme keywords
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    const themeData = themeResults.get(theme)!;

    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      let match;

      while ((match = regex.exec(lowerText)) !== null) {
        themeData.count++;

        // Get severity for this keyword
        const keywordSeverity = SEVERITY_MAPPING[theme]?.[keyword] ?? 1;
        themeData.severity = Math.max(themeData.severity, keywordSeverity);

        // Capture example snippet (context window)
        const start = Math.max(0, match.index - 30);
        const end = Math.min(lowerText.length, match.index + keyword.length + 30);
        const snippet = text.substring(start, end).trim();

        if (!themeData.examples.includes(snippet) && themeData.examples.length < 2) {
          themeData.examples.push(snippet);
        }
      }
    }
  }

  return themeResults;
}

/**
 * Calculate geopolitical risk score from theme distribution
 * Weights severity and prevalence
 */
function calculateGeopoliticalRiskScore(themeResults: Map<string, any>): number {
  let weightedRisk = 0;
  let totalWeight = 0;

  const themes = Array.from(themeResults.entries());

  for (const [theme, data] of themes) {
    if (data.count > 0) {
      // Severity (0-3) normalized to 0-1
      const severityComponent = (data.severity / 3) * 0.7; // 70% weight to severity
      
      // Prevalence (how many articles mention this)
      const prevalenceComponent = Math.min(1, data.count / 10) * 0.3; // 30% weight to prevalence
      
      const themeRisk = severityComponent + prevalenceComponent;
      weightedRisk += themeRisk * data.count;
      totalWeight += data.count;
    }
  }

  if (totalWeight === 0) return 0;
  return Math.min(1, weightedRisk / totalWeight);
}

/**
 * Calculate escalation probability based on theme patterns
 */
function calculateEscalationProbability(themeResults: Map<string, any>): number {
  const themes = Array.from(themeResults.entries());
  let escalationSignals = 0;

  // Conflict + Sanctions = escalation scenario
  const conflictData = themeResults.get('conflict')!;
  const sanctionsData = themeResults.get('sanctions')!;
  if (conflictData.count > 0 && sanctionsData.count > 0) {
    escalationSignals += 2;
  } else if (conflictData.count > 2) {
    escalationSignals += 1.5;
  }

  // Instability + Interference = systemic breakdown
  const instabilityData = themeResults.get('instability')!;
  const interferenceData = themeResults.get('interference')!;
  if (instabilityData.count > 0 && interferenceData.count > 0) {
    escalationSignals += 1.5;
  }

  // Multiple high-severity themes
  const highSeverityThemes = themes.filter(([, data]) => data.severity >= 2).length;
  escalationSignals += highSeverityThemes * 0.5;

  // Normalize to 0-1 (max 5 signals = 1.0)
  return Math.min(1, escalationSignals / 5);
}

/**
 * Detect news lag indicator
 * Examines if news was published AFTER suspicious market activity
 */
function detectNewsLagIndicator(newsArticles: NewsArticle[], marketTimestamp?: number): number {
  if (!marketTimestamp || newsArticles.length === 0) return 0;

  const flaggedArticles = newsArticles.filter(article => article.suspiciousEventFlag);
  if (flaggedArticles.length === 0) return 0;

  // Parse news publication times
  const newsTimestamps = flaggedArticles.map(article => new Date(article.timestamp).getTime());
  const avgNewsTimestamp = newsTimestamps.reduce((a, b) => a + b, 0) / newsTimestamps.length;

  // Check if news comes AFTER market movement (lag = positive time delta)
  const timeDeltaMs = avgNewsTimestamp - marketTimestamp;
  
  // If news is 30+ minutes AFTER market move, it's a lag indicator
  const lagThreshold = 30 * 60 * 1000; // 30 minutes
  
  if (timeDeltaMs > lagThreshold) {
    // Strong lag signal: news well after market
    return Math.min(1, timeDeltaMs / (2 * lagThreshold)); // 0.5 at 60min lag
  } else if (timeDeltaMs > 0) {
    // Weak lag: news slightly after
    return timeDeltaMs / lagThreshold * 0.5;
  }

  // News before market = no lag indicator
  return 0;
}

/**
 * Build dominant themes summary
 */
function buildDominantThemesSummary(themeResults: Map<string, any>): string {
  const themes = Array.from(themeResults.entries())
    .filter(([, data]) => data.count > 0)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 3);

  if (themes.length === 0) return 'No significant geopolitical themes detected.';

  const descriptions = themes.map(([name, data]) => {
    const severityName = ['minimal', 'moderate', 'high', 'critical'][data.severity];
    return `${name.charAt(0).toUpperCase() + name.slice(1)}: ${data.count} mentions (${severityName} severity)`;
  });

  return descriptions.join('. ') + '.';
}

/**
 * Assess regional and sector impact
 */
function assessRegionalImpact(themeResults: Map<string, any>): string {
  const themes = Array.from(themeResults.entries());
  
  const conflicts = themeResults.get('conflict')!.count;
  const sanctions = themeResults.get('sanctions')!.count;
  const inflation = themeResults.get('inflation')!.count;
  const instability = themeResults.get('instability')!.count;
  const interference = themeResults.get('interference')!.count;

  if (conflicts > 0 && sanctions > 0) {
    return 'Geopolitical confrontation scenario. International relations stressed. Trade channels at risk.';
  } else if (sanctions > 1) {
    return 'Escalating economic sanctions. Supply chain disruptions expected. Currency volatility high.';
  } else if (inflation > 2 && conflicts > 0) {
    return 'Supply-linked inflation pressures amid conflict. Commodity markets vulnerable. Credit spreads widening.';
  } else if (instability > 2 && interference > 0) {
    return 'Institutional instability with external influence detected. Policy uncertainty elevated. Capital flight risk.';
  } else if (inflation > 1) {
    return 'Inflationary pressures from macro stress. Central bank policy response expected. Rate volatility likely.';
  } else if (instability > 1) {
    return 'Domestic instability signals. Political uncertainty premium factored in. Equity hedging advisable.';
  }

  return 'Baseline geopolitical risk environment. Standard monitoring protocols active.';
}

/**
 * Identify escalation triggers
 */
function identifyEscalationTriggers(themeResults: Map<string, any>, escalationProbability: number): string {
  const conflicts = themeResults.get('conflict')!.count;
  const sanctions = themeResults.get('sanctions')!.count;
  const interference = themeResults.get('interference')!.count;

  const triggers: string[] = [];

  if (escalationProbability > 0.7) {
    if (conflicts > 2 && sanctions > 0) {
      triggers.push('Critical: Military + sanctions combo detected. De-escalation protocol unlikely.');
    }
    if (conflicts > 3) {
      triggers.push('Military movements concentrated. Blockade or offensive posture identified.');
    }
    if (interference > 2 && conflicts > 1) {
      triggers.push('Coordinated interference with conflict. Third-party involvement suspected.');
    }
  } else if (escalationProbability > 0.4) {
    if (conflicts > 1 && sanctions > 0) {
      triggers.push('Moderate: Conflict + sanctions situation. Diplomatic channels strained.');
    }
    if (sanctions > 1) {
      triggers.push('Retaliatory sanctions cycle possible. Negotiation deadlock observed.');
    }
  }

  if (triggers.length === 0) {
    triggers.push('Escalation probability: Low to Moderate. Standard containment measures sufficient.');
  }

  return triggers.join(' ');
}

/**
 * Generate market relevance assessment
 */
function assessMarketRelevance(riskScore: number, escalationProbability: number): string {
  if (riskScore > 0.7 || escalationProbability > 0.6) {
    return 'High market relevance. Risk-off positioning recommended. Volatility premium warranted. Flight-to-safety flows likely.';
  } else if (riskScore > 0.5 || escalationProbability > 0.4) {
    return 'Moderate market relevance. Headline-driven trading expected. Hedging positions advisable. Correlations may spike.';
  } else if (riskScore > 0.3) {
    return 'Marginal market impact. Background risk factor. Monitor for threshold breaches. Standard hedging sufficient.';
  }

  return 'Low market relevance. Baseline risk profile maintained. Routine monitoring adequate.';
}

/**
 * Analyze news timing relative to market anomalies
 */
function analyzeNewsTiming(newsArticles: NewsArticle[], newsLagIndicator: number): string {
  const flaggedArticles = newsArticles.filter(a => a.suspiciousEventFlag);
  
  if (newsLagIndicator > 0.7) {
    return `Critical timing anomaly: News published significantly AFTER market movement. ${flaggedArticles.length} articles flagged as post-hoc justifications. Information leakage suspected.`;
  } else if (newsLagIndicator > 0.4) {
    return `Moderate timing anomaly: News lag of 15-30 minutes detected. ${flaggedArticles.length} flagged articles. Possible pre-announcement market positioning.`;
  } else if (newsLagIndicator > 0.1) {
    return `Minor timing skew: News published 5-15 minutes after market move. ${flaggedArticles.length} flagged. Micro-structure effect possible.`;
  }

  return `No timing anomaly detected. News timing aligned with market movement. ${flaggedArticles.length} articles reviewed. Normal information flow observed.`;
}

/**
 * Generate comprehensive geopolitical reasoning
 */
function generateGeopoliticalReasoning(
  themeResults: Map<string, any>,
  riskScore: number,
  escalationProbability: number,
  newsArticles: NewsArticle[],
  newsLagIndicator: number
): GeopoliticalReasoning {
  return {
    dominantThemes: buildDominantThemesSummary(themeResults),
    regionalImpact: assessRegionalImpact(themeResults),
    escalationTriggers: identifyEscalationTriggers(themeResults, escalationProbability),
    marketRelevance: assessMarketRelevance(riskScore, escalationProbability),
    newsTimingAnalysis: analyzeNewsTiming(newsArticles, newsLagIndicator),
    factualSummary: `Geopolitical risk assessment for election market. Risk score: ${(riskScore * 100).toFixed(1)}%. ` +
      `Escalation probability: ${(escalationProbability * 100).toFixed(1)}%. ` +
      `News lag indicator: ${(newsLagIndicator * 100).toFixed(1)}%. ` +
      `${newsArticles.length} articles analyzed. Assessment complete.`
  };
}

/**
 * Extract distribution array of dominant themes
 */
function extractThemeDistribution(themeResults: Map<string, any>): GeopoliticalTheme[] {
  return Array.from(themeResults.entries())
    .filter(([, data]) => data.count > 0)
    .map(([name, data]) => ({
      name: name as 'conflict' | 'sanctions' | 'inflation' | 'instability' | 'interference',
      severity: data.severity as 0 | 1 | 2 | 3,
      count: data.count,
      examples: data.examples
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Main Geopolitical Analysis Agent
 * Processes news articles to detect macro-level risk and timing anomalies
 */
export async function runGeopoliticalAgent(
  newsArticles: NewsArticle[]
): Promise<GeopoliticalAnalysisResult> {
  const startTime = Date.now();

  console.log('🌍 Geopolitical Agent: Starting analysis...');

  // Simulate institutional processing delay
  await new Promise(resolve => setTimeout(resolve, 2500));

  // Consolidate all news text
  const consolidatedText = newsArticles
    .map(article => `${article.headline} ${article.summary}`)
    .join(' ');

  // Analyze themes across all articles
  const themeResults = analyzeGeopoliticalThemes(consolidatedText);

  // Calculate metrics
  const geopoliticalRiskScore = calculateGeopoliticalRiskScore(themeResults);
  const escalationProbability = calculateEscalationProbability(themeResults);
  const newsLagIndicator = detectNewsLagIndicator(newsArticles, Date.now() - 60 * 60 * 1000); // Assume 1hr market window

  // Extract distribution
  const themeDistribution = extractThemeDistribution(themeResults);

  // Generate reasoning
  const reasoning = generateGeopoliticalReasoning(
    themeResults,
    geopoliticalRiskScore,
    escalationProbability,
    newsArticles,
    newsLagIndicator
  );

  const processingTimeMs = Date.now() - startTime;

  // Console output with emoji indicators
  console.log('📊 Geopolitical Risk Score:', `${(geopoliticalRiskScore * 100).toFixed(1)}%`);
  console.log('📈 Escalation Probability:', `${(escalationProbability * 100).toFixed(1)}%`);
  console.log('⏱️  News Lag Indicator:', `${(newsLagIndicator * 100).toFixed(1)}%`);
  console.log('🏷️  Dominant Themes:', themeDistribution.map(t => `${t.name}(${t.count})`).join(', '));
  console.log('✅ Geopolitical Agent: Analysis complete\n');

  return {
    geopoliticalRiskScore,
    themeDistribution,
    escalationProbability,
    newsLagIndicator,
    reasoning,
    processingTimeMs,
    timestamp: new Date().toISOString()
  };
}
