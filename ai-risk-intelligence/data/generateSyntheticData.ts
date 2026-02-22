/**
 * Synthetic Data Generation for US Presidential Election 2028 Prediction Market Analysis
 * Generates realistic ML outputs, social media posts, market data, and news articles
 */

// ==================== TYPES ====================

interface MLModelOutput {
  riskScore: number;
  liquidityScore: number;
  volatilityIndex: number;
  abnormalBettingScore: number;
  timestamp: string;
}

interface TwitterPost {
  username: string;
  content: string;
  likes: number;
  timestamp: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'manipulation' | 'conspiracy' | 'data-driven';
}

interface RedditPost {
  username: string;
  subreddit: string;
  title: string;
  content: string;
  upvotes: number;
  timestamp: string;
  context: 'discussion' | 'disagreement' | 'betting_strategy';
}

interface KalshiComment {
  username: string;
  content: string;
  timestamp: string;
  signal: 'overpriced' | 'liquidity_spike' | 'sharp_money' | 'insider_knowledge';
}

interface NewsArticle {
  source: string;
  headline: string;
  summary: string;
  severityLevel: 'low' | 'medium' | 'high';
  topic: 'economy' | 'inflation' | 'foreign_interference' | 'campaign_funding' | 'geopolitical_tensions';
  timestamp: string;
  suspiciousEventFlag?: boolean;
}

interface MarketData {
  kalshi: {
    currentPrice: number;
    volume24h: number;
    priceChangePercent: number;
    suspiciousEventFlag?: boolean;
  };
  polymarket: {
    currentPrice: number;
    volume24h: number;
    priceChangePercent: number;
    suspiciousEventFlag?: boolean;
  };
  timestamp: string;
  suspiciousEventFlag?: boolean;
}

interface SuspiciousEvent {
  eventId: string;
  basePrice: number;
  spikePrice: number;
  priceJumpPercent: number;
  baseVolume: number;
  spikeVolume: number;
  volumeMultiplier: number;
  sentimentShiftTime: string; // 2-3 hours before spike
  marketSpikeTime: string;
  newsTime: string; // After spike
  preSentiments: TwitterPost[];
  marketTrades: Array<{
    timestamp: string;
    price: number;
    volume: number;
    size: number;
  }>;
  delayedNews: NewsArticle[];
  temporalGap: number; // minutes between sentiment and market move
}

interface AllSyntheticData {
  mlOutputs: MLModelOutput[];
  twitterPosts: TwitterPost[];
  redditPosts: RedditPost[];
  kalshiComments: KalshiComment[];
  newsArticles: NewsArticle[];
  marketData: MarketData;
  suspiciousEvents: SuspiciousEvent[];
  generatedAt: string;
  topic: string;
}

// ==================== HELPER UTILITIES ====================

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function getRandomTimestamp(daysAgo: number = 30): string {
  const now = new Date();
  const past = new Date(now.getTime() - Math.random() * daysAgo * 24 * 60 * 60 * 1000);
  return past.toISOString();
}

// ==================== DATA VOCABULARIES ====================

const firstNames = [
  'Alex', 'Jordan', 'Casey', 'Morgan', 'Riley', 'Taylor', 'Avery', 'Quinn',
  'Sam', 'Drew', 'Blake', 'Devon', 'Skylar', 'Casey', 'Phoenix', 'Dakota',
  'ChatGPT', 'TradingBot', 'Arbitrage_Master', 'Volatility_Hawk'
];

const twitterHandles = firstNames.map(name => 
  `@${name.toLowerCase()}_${getRandomInt(100, 999)}`
);

const redditUsers = firstNames.map(name => 
  `${name}${getRandomInt(1000, 9999)}`
);

const kalshiTraders = [
  'sharp_trader', 'liquidity_hunter', 'prediction_pro', 'market_watcher',
  'election_analyst', 'data_miner', 'odds_master', 'probability_guy'
];

const newsSources = [
  'Reuters', 'Associated Press', 'Bloomberg', 'CNBC', 'Fox News',
  'CNN', 'BBC', 'The Guardian', 'Financial Times', 'Wall Street Journal',
  'Politico', 'The Hill', 'NBC News', 'CBS News'
];

const subreddits = [
  'r/PredictionMarkets', 'r/Politics', 'r/Economics', 'r/investing',
  'r/CryptoCurrency', 'r/OptionTraders', 'r/DataScience', 'r/MarketAnalysis'
];

// ==================== INSIDER ANOMALY SIMULATION ====================

// Pre-spike suspicious sentiment hints (posted BEFORE market moves)
const preSpikeHints = [
  "Just got a tip from someone in the know. Can't say more but watch the market closely.",
  "The smart money is positioning for a major shift. They rarely get this wrong.",
  "Seen unusual activity in the prediction markets. Something's about to break.",
  "The odds are completely wrong. I have high conviction on this. Very high.",
  "There's been a massive capital reallocation behind the scenes. Market doesn't know yet.",
  "Just connected with someone from campaign HQ. The internal polling is WAY different from public.",
  "Watching the order flow. The institutional buyers loaded up aggressively today.",
  "The probability here is mispriced by at least 15 points. This will correct hard.",
  "Major news is about to drop. Position accordingly. Seriously.",
  "The market doesn't understand what's happening internally. Sharp money knows.",
  "I've never seen this level of conviction from institutional traders. Something big.",
  "The data shows a complete reversal from what we thought. Major catalyst coming.",
  "Inside source confirms the race dynamics have shifted dramatically. Market will catch up.",
  "You want to know what REALLY matters? It's things most people haven't seen yet.",
  "Huge position building happening. This isn't normal retail activity. Watch.",
];

// Post-spike news articles (appear AFTER market moves)
const postSpikeNewsTopics = [
  "Breaking: Major poll aggregator releases unexpected results showing significant shift",
  "Market-moving report: Internal campaign data reveals surprising momentum shift",
  "Economic data release shows stronger than expected performance for incumbent",
  "Unexpected endorsement from key demographic group shifts race analysis",
  "New field poll contradicts earlier consensus, shows dramatic swing",
  "Election betting markets react sharply to fresh intelligence on voter enthusiasm",
  "Surprise development in campaign funding reshapes electoral landscape",
  "Major research institute publishes bombshell analysis of swing state trends",
  "Institutional investors revise predictions based on newly available data",
  "Breaking poll shows unexpected 12-point move in key metrics",
  "Hidden demographic shift emerges in latest comprehensive analysis",
  "Surprise momentum for incumbent in critical battleground states",
];

// ==================== GENERATED CONTENT ====================

// Bullish takes on 2028 election
const bullishPosts = [
  "The incumbent is polling way above historical averages. Market looks mispriced at these odds.",
  "Economic fundamentals are incredibly strong going into the election. This should shift the needle.",
  "Historical precedent suggests the party in power wins ~65% of the time. Odds don't reflect this.",
  "Money is flowing into prediction markets at record pace. Smart money knows something.",
  "The opposition is completely fractured. Incumbent has massive advantage.",
  "Early voting patterns suggest higher turnout for incumbent coalition. Bullish signal.",
  "Tech sector donations heavily favor incumbent. That's a leading indicator historically.",
  "Swing state polling aggregates show 8 point lead. Market only pricing in 5.",
];

// Bearish takes
const bearishPosts = [
  "Incumbent approval is in historical lows for re-election cycles. This is a squeeze.",
  "Generic ballot shows opposition gaining 3 points in latest aggregate. Trajectory matters.",
  "Voter enthusiasm metrics heavily favor opposition. They're more motivated.",
  "Historical comparison to 2020, 2016 suggests this is not the incumbent's year.",
  "The youth vote skews heavily against incumbent. Demographics are destiny.",
  "Inflation concerns still elevated. This is typically catastrophic for incumbent parties.",
  "Betting markets are irrational. Fundame ntals clearly favor opposition.",
];

// Manipulation suspicious posts
const manipulationPosts = [
  "That 2M volume spike at 3AM is NOT normal. Someone has inside info.",
  "The price movement doesn't match polling data at all. Manipulation obvious.",
  "Whales are loading up on NO contracts. They know something.",
  "The order flow is completely one-sided right now. Not retail behavior.",
  "Someone just took OUT a $50M position. This reeks of front-running.",
  "The bid-ask spread just blew out to 15 cents. Indicates institutional positioning.",
];

// Neutral takes
const neutralPosts = [
  "Latest poll aggregate: 51% - 49%. Still early though, lots can change.",
  "Both candidates have clear paths to victory depending on turnout models.",
  "Historical error bars suggest +/- 4 points minimum. Markets pricing uncertainty reasonably.",
  "The race is essentially a toss-up. Markets reflecting that.",
];

// Conspiracy takes
const conspiracyPosts = [
  "WAKE UP. The media is hiding the real polling data. Check alternative sources.",
  "There's clearly coordination between prediction markets and mainstream narratives.",
  "The deep state wants you to BELIEVE one side is winning. Don't fall for it.",
  "Follow the money. The arbitrage opportunities are TOO obvious. It's a setup.",
  "They're using prediction markets to shape perception. It's psychological warfare.",
];

// Data-driven analysis
const dataPost = [
  "Running Bayesian model aggregation across 47 datasets. P(incumbent wins) = 0.563 with 95% CI [0.521, 0.605]",
  "Sentiment analysis across 100K tweets shows -0.23 correlation with betting odds. Mispricing detected.",
  "Time-series decomposition reveals 68% of recent price movement is seasonal, not fundamental.",
  "Regression analysis: each 1pp polling move = 2.3pp odds move. Current bid-ask premiums suggest arb opp.",
  "Kalman filter on market microstructure data suggests true implied probability ~52%. Current odds = 48%.",
  "ML model trained on 20 years of election data: accuracy 73%. Current market scenario = 0.15 probability.",
];

// Reddit discussion titles
const redditTitles = [
  "Why the election market is massively undervaluing X factor",
  "I compiled all the polling data and here's what it really means",
  "The market is ignoring macroeconomic fundamentals",
  "Historical precedent from 2016/2020 suggests...",
  "Campaign spending data shows a clear winner",
  "The debate performance metrics nobody is talking about",
  "Turnout modeling for swing states: deep dive analysis",
  "Prediction markets have gotten this wrong before",
];

// Reddit discussion posts (long-form)
const redditDiscussions = [
  `I spent all weekend aggregating polling data from 12 different pollsters, weighted by historical accuracy. The real picture is way different from what the prediction markets are pricing in. Here's my methodology...\n\n[detailed breakdown of polling aggregation methodology]\n\nThe bottom line: the markets are systematically underweighting X factor.`,
  
  `Everyone keeps citing the same three polls. But if you actually dig into the crosstabs and demographic weighting, the story changes dramatically. Here's what I found when I controlled for party identification rates from prior cycles...\n\nKey insight: sector-specific turnout patterns have shifted since 2020.`,
  
  `The media is obsessing over national polling but completely missing regional trends. I mapped out precinct-level data for all 2380 swing precincts and the patterns are stark. Three regions show 15+ point swings vs 2020...`,
  
  `Campaign finance data just dropped. If you track the spending patterns by category (TV, digital, ground game), there's a clear frontrunner. The prediction markets haven't priced this in yet. Excel file with my analysis attached.`,
  
  `Taking a step back: what historically matters most for incumbent re-election? I charted 100 years of data and the three most predictive factors are [X, Y, Z]. Current values suggest... you're not going to like this but the math is clear.`,
];

// Kalshi comments
const kalshiSignals = [
  "Just saw a $5M market order. That's not retail. They know something.",
  "The liquidity just disappeared on the NO side. All the smart money bailing out?",
  "That was a perfect pump and dump pattern. Textbook manipulation.",
  "Someone knows something. The order flow right now is INSANELY one-sided.",
  "The vol is pricing in scenarios that aren't in the polls at all. Disconnected.",
  "I see institutional fingerprints all over this. The bid-ask spread tells the tale.",
  "Sharp money just loaded up. This is a contrarian indicator historically.",
  "The overnight Asian markets moved this 3%. Nobody here noticed yet.",
];

// News headlines
const newsHeadlines = {
  economy: [
    "Unexpected Q4 GDP Report Signals Economic Resilience",
    "Unemployment Falls Below Expectations for Third Consecutive Month",
    "Consumer Spending Patterns Show Divergence by Income Group",
    "Recession Probability Models Update: Markets React",
  ],
  inflation: [
    "Core Inflation Rate Holds Steady at 3.2% Year-over-Year",
    "Energy Prices Fluctuate on Geopolitical Uncertainty",
    "Housing Affordability Index Reaches New Historical Low",
    "Wage Growth Outpaces Inflation in Recent Economic Data",
  ],
  foreign_interference: [
    "Intelligence Agencies Brief Congress on Election Security Measures",
    "Foreign Disinformation Campaigns Detected Across Social Platforms",
    "Cybersecurity Commission Releases Threat Assessment Report",
    "International Observers Arrive for Election Monitoring",
  ],
  campaign_funding: [
    "Record Campaign Spending Reported in Latest Disclosure Filing",
    "Super PAC Contributions Surge to Unprecedented Levels",
    "Dark Money Groups Increase Political Advertising Spending",
    "Foreign Investment Scrutiny Increases for Political Donors",
  ],
  geopolitical_tensions: [
    "International Relations Shift as Election Cycle Intensifies",
    "Global Markets React to Potential Policy Changes",
    "Trade Negotiations Signal New Direction in Foreign Policy",
    "Regional Conflicts Complicate Election Year Diplomacy",
  ],
};

const newsSummaries = {
  economy: [
    "Economic indicators remain mixed as quarterly data reveals uneven growth across sectors.",
    "Labor market continues to show resilience despite predictions of downturn.",
    "Consumer confidence indices suggest shifting expectations for economic policy.",
  ],
  inflation: [
    "Price pressures remain concentrated in specific sectors while core measures stabilize.",
    "Federal Reserve faces complex decisions amid inflation data releases.",
    "Households show differing impacts from inflation based on spending patterns.",
  ],
  foreign_interference: [
    "Authorities report sophisticated information operations detected online.",
    "Election security infrastructure receives additional resources for protection.",
    "Fact-checking organizations report increased activity during election period.",
  ],
  campaign_funding: [
    "Political organizations report record-breaking fundraising in recent quarter.",
    "Transparency advocates raise concerns about disclosure requirements.",
    "Economic sectors show divergent support patterns in campaign contributions.",
  ],
  geopolitical_tensions: [
    "Strategic partnerships evolve as nations reassess international relationships.",
    "Market uncertainty reflects potential policy implications of election outcome.",
    "Diplomatic channels remain active despite election cycle complexities.",
  ],
};

// ==================== GENERATION FUNCTIONS ====================

/**
 * Generate realistic ML model outputs
 */
function generateFakeModelOutput(): MLModelOutput {
  // Create realistic correlations between metrics
  const riskScore = getRandomFloat(0.2, 0.9, 3);
  const volatilityIndex = getRandomFloat(15, 45, 2);
  
  // Risk and volatility are correlated
  const adjustedLiquidity = 75 - (riskScore * 40) - (volatilityIndex * 0.3);
  const liquidityScore = Math.max(20, Math.min(100, adjustedLiquidity + getRandomFloat(-10, 10, 2)));
  
  // Abnormal betting correlates with risk
  const abnormalBettingScore = Math.min(10, (riskScore * 8) + getRandomFloat(-2, 3, 2));

  return {
    riskScore,
    liquidityScore,
    volatilityIndex,
    abnormalBettingScore: Math.max(0, abnormalBettingScore),
    timestamp: getRandomTimestamp()
  };
}

/**
 * Generate 500 realistic Twitter posts
 */
function generateFakeTwitterPosts(): TwitterPost[] {
  const posts: TwitterPost[] = [];
  const sentiments: Array<TwitterPost['sentiment']> = ['bullish', 'bearish', 'neutral', 'manipulation', 'conspiracy', 'data-driven'];
  const contentMap = {
    bullish: bullishPosts,
    bearish: bearishPosts,
    manipulation: manipulationPosts,
    neutral: neutralPosts,
    conspiracy: conspiracyPosts,
    'data-driven': dataPost,
  };

  for (let i = 0; i < 500; i++) {
    const sentiment = getRandomElement(sentiments);
    const contentArray = contentMap[sentiment];
    let content = getRandomElement(contentArray);
    
    // Add variation by tweaking content
    if (Math.random() > 0.5) {
      const variations = [
        `${content} #ElectionMarkets #2028`,
        `hot take: ${content}`,
        `BREAKING: ${content}`,
        `analyzing: ${content}`,
        content,
      ];
      content = getRandomElement(variations);
    }

    posts.push({
      username: getRandomElement(twitterHandles),
      content: content.substring(0, 280), // Twitter limit
      likes: getRandomInt(5, 15000),
      timestamp: getRandomTimestamp(),
      sentiment,
    });
  }

  return posts;
}

/**
 * Generate 300 realistic Reddit posts
 */
function generateFakeRedditPosts(): RedditPost[] {
  const posts: RedditPost[] = [];
  const contexts: Array<RedditPost['context']> = ['discussion', 'disagreement', 'betting_strategy'];

  for (let i = 0; i < 300; i++) {
    const context = getRandomElement(contexts);
    const subreddit = getRandomElement(subreddits);
    const title = getRandomElement(redditTitles);
    const content = getRandomElement(redditDiscussions);

    // Modify content based on context
    let contextualContent = content;
    if (context === 'disagreement') {
      contextualContent = `I respectfully disagree with the consensus here. ${content}`;
    } else if (context === 'betting_strategy') {
      contextualContent = `Based on this analysis, my trading strategy is: ${content.substring(0, 200)}...`;
    }

    posts.push({
      username: getRandomElement(redditUsers),
      subreddit,
      title,
      content: contextualContent,
      upvotes: getRandomInt(10, 50000),
      timestamp: getRandomTimestamp(),
      context,
    });
  }

  return posts;
}

/**
 * Generate 200 realistic Kalshi trader comments
 */
function generateFakeKalshiComments(): KalshiComment[] {
  const comments: KalshiComment[] = [];
  const signals: Array<KalshiComment['signal']> = ['overpriced', 'liquidity_spike', 'sharp_money', 'insider_knowledge'];

  for (let i = 0; i < 200; i++) {
    const signal = getRandomElement(signals);
    let content = getRandomElement(kalshiSignals);

    // Personalize based on signal type
    if (signal === 'overpriced') {
      content = `Market overpriced at current odds. ${content}`;
    } else if (signal === 'liquidity_spike') {
      content = `Huge liquidity spike detected. ${content}`;
    } else if (signal === 'sharp_money') {
      content = `Sharp money moving. ${content}`;
    } else if (signal === 'insider_knowledge') {
      content = `Something's going on. ${content}`;
    }

    comments.push({
      username: getRandomElement(kalshiTraders),
      content,
      timestamp: getRandomTimestamp(),
      signal,
    });
  }

  return comments;
}

/**
 * Generate 100 fake news articles
 */
function generateFakeNewsArticles(): NewsArticle[] {
  const articles: NewsArticle[] = [];
  const topics: Array<NewsArticle['topic']> = ['economy', 'inflation', 'foreign_interference', 'campaign_funding', 'geopolitical_tensions'];
  const severities: Array<NewsArticle['severityLevel']> = ['low', 'medium', 'high'];

  for (let i = 0; i < 100; i++) {
    const topic = getRandomElement(topics);

    articles.push({
      source: getRandomElement(newsSources),
      headline: getRandomElement(newsHeadlines[topic]),
      summary: getRandomElement(newsSummaries[topic]),
      severityLevel: getRandomElement(severities),
      topic,
      timestamp: getRandomTimestamp(),
    });
  }

  return articles;
}

/**
 * Generate realistic market data for both platforms
 */
function generateMarketData(): MarketData {
  // Generate base Kalshi price
  const kalshiPrice = getRandomFloat(0.35, 0.75, 2);
  const kalshiVolume = getRandomInt(5000000, 50000000);
  
  // Polymarket is slightly divergent (realistic for same market on different platforms)
  const polymarketPrice = kalshiPrice + getRandomFloat(-0.08, 0.08, 2);
  const polymarketDivergence = Math.abs(polymarketPrice - kalshiPrice) / kalshiPrice * 100;

  return {
    kalshi: {
      currentPrice: Math.max(0.01, Math.min(0.99, kalshiPrice)),
      volume24h: kalshiVolume,
      priceChangePercent: getRandomFloat(-5, 5, 2),
      suspiciousEventFlag: false,
    },
    polymarket: {
      currentPrice: Math.max(0.01, Math.min(0.99, polymarketPrice)),
      volume24h: getRandomInt(3000000, 40000000),
      priceChangePercent: getRandomFloat(-5, 5, 2),
      suspiciousEventFlag: false,
    },
    timestamp: new Date().toISOString(),
    suspiciousEventFlag: false,
  };
}

/**
 * Generate suspicious betting event with temporal misalignment
 */
function generateSuspiciousEvent(eventIndex: number): SuspiciousEvent {
  // Base price and timestamp for the event
  const basePrice = getRandomFloat(0.40, 0.65, 3);
  const baseVolume = getRandomInt(8000000, 20000000);
  
  // Price jump: 15-30% increase
  const priceJumpPercent = getRandomInt(15, 30);
  const spikePrice = parseFloat((basePrice * (1 + priceJumpPercent / 100)).toFixed(3));
  
  // Volume spike: 5x baseline
  const volumeMultiplier = 5;
  const spikeVolume = baseVolume * volumeMultiplier;
  
  // Create timeline: sentiment shift 2-3 hours before market spike
  const temporalGapMinutes = getRandomInt(120, 180); // 2-3 hours
  const marketSpikeTime = new Date(Date.now() - getRandomInt(1, 14) * 24 * 60 * 60 * 1000);
  const sentimentShiftTime = new Date(marketSpikeTime.getTime() - temporalGapMinutes * 60 * 1000);
  const newsTime = new Date(marketSpikeTime.getTime() + getRandomInt(15, 60) * 60 * 1000);
  
  // Generate pre-spike sentiment posts (2-3 hours before market move)
  const preSentiments: TwitterPost[] = [];
  for (let i = 0; i < getRandomInt(3, 6); i++) {
    preSentiments.push({
      username: getRandomElement(twitterHandles),
      content: getRandomElement(preSpikeHints),
      likes: getRandomInt(500, 5000),
      timestamp: new Date(sentimentShiftTime.getTime() + getRandomInt(-30, 30) * 60 * 1000).toISOString(),
      sentiment: 'bullish',
    });
  }
  
  // Generate market trades showing the spike (happens RIGHT AFTER sentiment)
  const marketTrades = [];
  for (let i = 0; i < getRandomInt(15, 25); i++) {
    const tradeTime = new Date(marketSpikeTime.getTime() + getRandomInt(0, 30) * 60 * 1000);
    const progression = i / 20;
    const tradePrice = basePrice + (spikePrice - basePrice) * progression;
    marketTrades.push({
      timestamp: tradeTime.toISOString(),
      price: parseFloat(tradePrice.toFixed(3)),
      volume: Math.floor(spikeVolume / 20),
      size: getRandomInt(1000, 5000),
    });
  }
  
  // Generate delayed news articles (AFTER market already moved)
  const delayedNews: NewsArticle[] = [];
  const newsTopics: Array<NewsArticle['topic']> = ['economy', 'inflation', 'campaign_funding'];
  for (let i = 0; i < getRandomInt(2, 4); i++) {
    const topic = getRandomElement(newsTopics);
    delayedNews.push({
      source: getRandomElement(newsSources),
      headline: getRandomElement(postSpikeNewsTopics),
      summary: newsSummaries[topic][getRandomInt(0, newsSummaries[topic].length - 1)],
      severityLevel: 'high',
      topic,
      timestamp: new Date(newsTime.getTime() + getRandomInt(0, 120) * 60 * 1000).toISOString(),
    });
  }
  
  return {
    eventId: `suspicious_event_${eventIndex}_${Date.now()}`,
    basePrice,
    spikePrice,
    priceJumpPercent,
    baseVolume,
    spikeVolume,
    volumeMultiplier,
    sentimentShiftTime: sentimentShiftTime.toISOString(),
    marketSpikeTime: marketSpikeTime.toISOString(),
    newsTime: newsTime.toISOString(),
    preSentiments,
    marketTrades,
    delayedNews,
    temporalGap: temporalGapMinutes,
  };
}

/**
 * Generate 3-5 suspicious betting events
 */
function generateSuspiciousEvents(): SuspiciousEvent[] {
  const eventCount = getRandomInt(3, 5);
  const events: SuspiciousEvent[] = [];
  
  for (let i = 0; i < eventCount; i++) {
    events.push(generateSuspiciousEvent(i));
  }
  
  return events;
}

// ==================== MASTER EXPORT FUNCTION ====================

/**
 * Generate all synthetic data for the AI Risk Intelligence analysis pipeline
 * Returns comprehensive dataset for US Presidential Election 2028 prediction market analysis
 */
export function generateAllSyntheticInputs(): AllSyntheticData {
  console.log('🤖 Generating synthetic data for election market analysis...');

  const startTime = Date.now();

  // Generate ML outputs (10 recent predictions)
  const mlOutputs: MLModelOutput[] = [];
  for (let i = 0; i < 10; i++) {
    mlOutputs.push(generateFakeModelOutput());
  }

  // Generate social media posts
  const twitterPosts = generateFakeTwitterPosts();
  const redditPosts = generateFakeRedditPosts();
  const kalshiComments = generateFakeKalshiComments();

  // Generate news and market data
  const newsArticles = generateFakeNewsArticles();
  const marketData = generateMarketData();
  
  // Generate suspicious insider betting events (3-5 events)
  const suspiciousEvents = generateSuspiciousEvents();
  
  // Mark market data as suspicious if events detected
  if (suspiciousEvents.length > 0) {
    marketData.suspiciousEventFlag = true;
    marketData.kalshi.suspiciousEventFlag = true;
    marketData.polymarket.suspiciousEventFlag = true;
  }

  const endTime = Date.now();
  const generationTime = (endTime - startTime) / 1000;

  const result: AllSyntheticData = {
    mlOutputs,
    twitterPosts,
    redditPosts,
    kalshiComments,
    newsArticles,
    marketData,
    suspiciousEvents,
    generatedAt: new Date().toISOString(),
    topic: 'US Presidential Election 2028 Outcome',
  };

  console.log(`✅ Generation complete in ${generationTime.toFixed(2)}s`);
  console.log(`   📊 ML Outputs: ${mlOutputs.length}`);
  console.log(`   🐦 Twitter Posts: ${twitterPosts.length}`);
  console.log(`   📱 Reddit Posts: ${redditPosts.length}`);
  console.log(`   💬 Kalshi Comments: ${kalshiComments.length}`);
  console.log(`   📰 News Articles: ${newsArticles.length}`);
  console.log(`   📈 Market Data (2 platforms)`);
  console.log(`   🚨 Suspicious Insider Events: ${suspiciousEvents.length}`);
  console.log(`      - Each with 15-30% price jumps`);
  console.log(`      - 5x volume spikes`);
  console.log(`      - 2-3 hour sentiment pre-shifts`);
  console.log(`      - Delayed news (post-spike)`);
  console.log(`   ⏰ Temporal misalignment indicators: ENABLED`);
  console.log(`   Total Data Points: ${mlOutputs.length + twitterPosts.length + redditPosts.length + kalshiComments.length + newsArticles.length}`);

  return result;
}

// Export types for external use
export type {
  MLModelOutput,
  TwitterPost,
  RedditPost,
  KalshiComment,
  NewsArticle,
  MarketData,
  SuspiciousEvent,
  AllSyntheticData,
};
