/**
 * Hard-coded Synthetic Data for 4 Specific Market Topics
 * Each topic contains realistic data pre-generated and cached for consistent analysis
 */

import {
  AllSyntheticData,
  MLModelOutput,
  TwitterPost,
  RedditPost,
  KalshiComment,
  NewsArticle,
  MarketData,
  SuspiciousEvent
} from './generateSyntheticData';

export type TopicId = '2028-election' | 'fed-rate' | 'tech-earnings' | 'geopolitical';

export const TOPIC_METADATA: Record<TopicId, { name: string; description: string; category: string }> = {
  '2028-election': {
    name: 'US Presidential Election 2028',
    description: 'Will Trump win the 2028 presidential election?',
    category: 'Political'
  },
  'fed-rate': {
    name: 'Federal Reserve Rate Decision',
    description: 'Will the Fed raise interest rates in March 2026?',
    category: 'Economic'
  },
  'tech-earnings': {
    name: 'Tech Company Quarterly Earnings',
    description: 'Will Meta beat Q4 2025 earnings expectations?',
    category: 'Corporate'
  },
  'geopolitical': {
    name: 'Geopolitical Tensions Escalation',
    description: 'Will a major geopolitical event occur within 90 days?',
    category: 'Geopolitical'
  }
};

// ═══════════════════════════════════════════════════════════════════════════════════
// TOPIC 1: 2028 PRESIDENTIAL ELECTION
// ═══════════════════════════════════════════════════════════════════════════════════
const election2028Data: AllSyntheticData = {
  mlOutputs: [
    {
      riskScore: 0.72,
      liquidityScore: 0.85,
      volatilityIndex: 0.58,
      abnormalBettingScore: 0.68,
      timestamp: '2026-02-22T08:15:00Z'
    }
  ],
  twitterPosts: [
    {
      username: '@PoliticalAnalyst',
      content: 'Trump rally in Iowa draws record crowds. Markets pricing in 65% probability.',
      likes: 2840,
      timestamp: '2026-02-22T06:12:00Z',
      sentiment: 'bullish'
    },
    {
      username: '@CapitalMarketsGuy',
      content: 'Sharp money accumulating Trump positions on Kalshi past 3 days. Something\'s up.',
      likes: 1920,
      timestamp: '2026-02-22T07:45:00Z',
      sentiment: 'data-driven'
    },
    {
      username: '@ElectionObs',
      content: 'Insider tip: Major donor committed $50M yesterday. Breaking news within hours.',
      likes: 3100,
      timestamp: '2026-02-22T08:02:00Z',
      sentiment: 'manipulation'
    },
    {
      username: '@TradingDesk',
      content: 'Massive volume spike Trump YES contracts 8:30am this morning. Pre-announcement?',
      likes: 4200,
      timestamp: '2026-02-22T08:35:00Z',
      sentiment: 'data-driven'
    }
  ],
  redditPosts: [
    {
      username: 'u/PredictionMarkets',
      subreddit: 'r/kalshi',
      title: 'Trump 2028 positions: DD on institutional accumulation',
      content: 'I\'ve been tracking Kalshi order book. Institutions buying large blocks 72 hours before poll release.',
      upvotes: 856,
      timestamp: '2026-02-22T07:30:00Z',
      context: 'betting_strategy'
    },
    {
      username: 'u/MarketMaker',
      subreddit: 'r/predictit',
      title: 'Liquidity drying up on YES side',
      content: 'Bid-ask spread tripled in last 24h. Coordinated accumulation or whale positioning?',
      upvotes: 423,
      timestamp: '2026-02-22T08:10:00Z',
      context: 'discussion'
    }
  ],
  kalshiComments: [
    {
      username: 'sharp_trader_23',
      content: 'Trump YES contracts underpriced. $2M accumulation at 0.63 yesterday',
      timestamp: '2026-02-22T06:45:00Z',
      signal: 'sharp_money'
    },
    {
      username: 'insider_knowledge_claims',
      content: 'Got a tip from DC insider. Something dropping today at 10am.',
      timestamp: '2026-02-22T08:05:00Z',
      signal: 'insider_knowledge'
    },
    {
      username: 'liquidity_watcher',
      content: 'Massive liquidity spike YES side. Coordinated positioning',
      timestamp: '2026-02-22T08:20:00Z',
      signal: 'liquidity_spike'
    }
  ],
  newsArticles: [
    {
      source: 'Reuters',
      headline: 'Trump announces major campaign event',
      summary: 'Presidential candidate Trump to hold rally in Iowa, expected to draw 15,000+',
      severityLevel: 'medium',
      topic: 'campaign_funding',
      timestamp: '2026-02-22T10:30:00Z',
      suspiciousEventFlag: false
    },
    {
      source: 'Bloomberg',
      headline: 'Super PAC receives largest single donation of cycle',
      summary: '$50M donation to Trump-aligned Super PAC from undisclosed source',
      severityLevel: 'high',
      topic: 'campaign_funding',
      timestamp: '2026-02-22T10:45:00Z',
      suspiciousEventFlag: true
    }
  ],
  marketData: {
    kalshi: {
      currentPrice: 0.68,
      volume24h: 12500000,
      priceChangePercent: 2.3,
      suspiciousEventFlag: true
    },
    polymarket: {
      currentPrice: 0.65,
      volume24h: 8900000,
      priceChangePercent: 1.8,
      suspiciousEventFlag: true
    },
    timestamp: '2026-02-22T09:00:00Z',
    suspiciousEventFlag: true
  },
  suspiciousEvents: [
    {
      eventId: 'evt_001',
      basePrice: 0.62,
      spikePrice: 0.68,
      priceJumpPercent: 9.7,
      baseVolume: 1200000,
      spikeVolume: 2800000,
      volumeMultiplier: 2.33,
      sentimentShiftTime: '2026-02-22T07:45:00Z',
      marketSpikeTime: '2026-02-22T08:22:00Z',
      newsTime: '2026-02-22T10:45:00Z',
      preSentiments: [
        {
          username: '@CapitalMarketsGuy',
          content: 'Sharp money accumulating Trump positions on Kalshi past 3 days. Something\'s up.',
          likes: 1920,
          timestamp: '2026-02-22T07:45:00Z',
          sentiment: 'data-driven'
        }
      ],
      marketTrades: [
        {
          timestamp: '2026-02-22T08:20:00Z',
          price: 0.67,
          volume: 850000,
          size: 1200
        },
        {
          timestamp: '2026-02-22T08:22:00Z',
          price: 0.68,
          volume: 2100000,
          size: 2800
        }
      ],
      delayedNews: [
        {
          source: 'Bloomberg',
          headline: 'Super PAC receives largest single donation of cycle',
          summary: '$50M donation to Trump-aligned Super PAC from undisclosed source',
          severityLevel: 'high',
          topic: 'campaign_funding',
          timestamp: '2026-02-22T10:45:00Z',
          suspiciousEventFlag: true
        }
      ],
      temporalGap: 158
    }
  ],
  generatedAt: '2026-02-22T09:00:00Z',
  topic: 'election'
};

// ═══════════════════════════════════════════════════════════════════════════════════
// TOPIC 2: FEDERAL RESERVE RATE DECISION
// ═══════════════════════════════════════════════════════════════════════════════════
const fedRateDecisionData: AllSyntheticData = {
  mlOutputs: [
    {
      riskScore: 0.81,
      liquidityScore: 0.92,
      volatilityIndex: 0.71,
      abnormalBettingScore: 0.76,
      timestamp: '2026-02-22T08:15:00Z'
    }
  ],
  twitterPosts: [
    {
      username: '@FedWatcher',
      content: 'Powell\'s recent comments suggest hawkish stance. Rate hike probability just jumped.',
      likes: 3450,
      timestamp: '2026-02-21T16:30:00Z',
      sentiment: 'bullish'
    },
    {
      username: '@TreasuryAnalyst',
      content: 'Unusual futures positioning ahead of FOMC meeting. Someone knows something.',
      likes: 2210,
      timestamp: '2026-02-22T07:15:00Z',
      sentiment: 'data-driven'
    },
    {
      username: '@MarketInsider',
      content: 'FOMC leak: Rate hike approved. Meeting today. Spreading the word early.',
      likes: 5600,
      timestamp: '2026-02-22T08:18:00Z',
      sentiment: 'manipulation'
    }
  ],
  redditPosts: [
    {
      username: 'u/FedAnalysis',
      subreddit: 'r/investing',
      title: 'FOMC Meeting Today: Rate Hike Priced In?',
      content: 'Looking at Kalshi orderbook, YES (rate hike) side showing coordinated institutional buying.',
      upvotes: 1234,
      timestamp: '2026-02-22T07:45:00Z',
      context: 'betting_strategy'
    }
  ],
  kalshiComments: [
    {
      username: 'macro_trader',
      content: 'Rate hike YES contracts: $5M buy wall at 0.72. Institutional presence.',
      timestamp: '2026-02-22T08:05:00Z',
      signal: 'sharp_money'
    },
    {
      username: 'fed_insider',
      content: 'Confirmed: FOMC votes to raise rates. Decision at 2pm announcement.',
      timestamp: '2026-02-22T08:12:00Z',
      signal: 'insider_knowledge'
    }
  ],
  newsArticles: [
    {
      source: 'CNBC',
      headline: 'Fed Chair Powell testifies before Congress',
      summary: 'Powell signals potential rate adjustment coming amid inflation concerns',
      severityLevel: 'medium',
      topic: 'inflation',
      timestamp: '2026-02-22T09:30:00Z',
      suspiciousEventFlag: false
    },
    {
      source: 'MarketWatch',
      headline: 'FOMC votes to raise federal funds rate by 25 basis points',
      summary: 'Federal Reserve announces rate hike decision in scheduled FOMC meeting',
      severityLevel: 'high',
      topic: 'inflation',
      timestamp: '2026-02-22T14:05:00Z',
      suspiciousEventFlag: true
    }
  ],
  marketData: {
    kalshi: {
      currentPrice: 0.76,
      volume24h: 24100000,
      priceChangePercent: 4.1,
      suspiciousEventFlag: true
    },
    polymarket: {
      currentPrice: 0.74,
      volume24h: 18700000,
      priceChangePercent: 3.7,
      suspiciousEventFlag: true
    },
    timestamp: '2026-02-22T09:00:00Z',
    suspiciousEventFlag: true
  },
  suspiciousEvents: [
    {
      eventId: 'evt_002',
      basePrice: 0.70,
      spikePrice: 0.76,
      priceJumpPercent: 8.6,
      baseVolume: 4200000,
      spikeVolume: 10100000,
      volumeMultiplier: 2.40,
      sentimentShiftTime: '2026-02-22T07:15:00Z',
      marketSpikeTime: '2026-02-22T08:30:00Z',
      newsTime: '2026-02-22T14:05:00Z',
      preSentiments: [
        {
          username: '@TreasuryAnalyst',
          content: 'Unusual futures positioning ahead of FOMC meeting. Someone knows something.',
          likes: 2210,
          timestamp: '2026-02-22T07:15:00Z',
          sentiment: 'data-driven'
        }
      ],
      marketTrades: [
        {
          timestamp: '2026-02-22T08:20:00Z',
          price: 0.73,
          volume: 5200000,
          size: 3800
        },
        {
          timestamp: '2026-02-22T08:30:00Z',
          price: 0.76,
          volume: 8900000,
          size: 6200
        }
      ],
      delayedNews: [
        {
          source: 'MarketWatch',
          headline: 'FOMC votes to raise federal funds rate by 25 basis points',
          summary: 'Federal Reserve announces rate hike decision in scheduled FOMC meeting',
          severityLevel: 'high',
          topic: 'inflation',
          timestamp: '2026-02-22T14:05:00Z',
          suspiciousEventFlag: true
        }
      ],
      temporalGap: 355
    }
  ],
  generatedAt: '2026-02-22T09:00:00Z',
  topic: 'inflation'
};

// ═══════════════════════════════════════════════════════════════════════════════════
// TOPIC 3: TECH COMPANY EARNINGS
// ═══════════════════════════════════════════════════════════════════════════════════
const techEarningsData: AllSyntheticData = {
  mlOutputs: [
    {
      riskScore: 0.64,
      liquidityScore: 0.78,
      volatilityIndex: 0.52,
      abnormalBettingScore: 0.59,
      timestamp: '2026-02-22T08:15:00Z'
    }
  ],
  twitterPosts: [
    {
      username: '@EarningsWatcher',
      content: 'Meta Q4 earnings call at 4:30pm. Market expects $2.15 EPS. Priced at 55% on Kalshi.',
      likes: 2100,
      timestamp: '2026-02-21T14:20:00Z',
      sentiment: 'neutral'
    },
    {
      username: '@CorporateInsider',
      content: 'Someone just accumulated $3M in Meta BEAT options. Institutional knowledge?',
      likes: 3800,
      timestamp: '2026-02-22T07:50:00Z',
      sentiment: 'data-driven'
    },
    {
      username: '@WallStLeaker',
      content: 'Meta crushed earnings estimates. Beat by $0.35 per share. Spreading fast.',
      likes: 6200,
      timestamp: '2026-02-22T16:31:00Z',
      sentiment: 'manipulation'
    }
  ],
  redditPosts: [
    {
      username: 'u/EarningsTrader',
      subreddit: 'r/investing',
      title: 'Meta Earnings: Institutional Positioning Analysis',
      content: 'Massive volume on BEAT contracts starting 2pm yesterday. Retail still sleeping.',
      upvotes: 945,
      timestamp: '2026-02-22T08:00:00Z',
      context: 'betting_strategy'
    }
  ],
  kalshiComments: [
    {
      username: 'earnings_specialist',
      content: 'Meta BEAT contracts: $2M accumulation at 0.55. Volume tripled.',
      timestamp: '2026-02-22T06:45:00Z',
      signal: 'sharp_money'
    },
    {
      username: 'cfo_connection',
      content: 'Confirmed: Meta beat estimates by wide margin. Numbers leaked internally.',
      timestamp: '2026-02-22T16:20:00Z',
      signal: 'insider_knowledge'
    }
  ],
  newsArticles: [
    {
      source: 'Bloomberg',
      headline: 'Meta prepares to announce Q4 earnings',
      summary: 'Facebook parent company Meta to release fourth quarter 2025 financial results',
      severityLevel: 'low',
      topic: 'campaign_funding',
      timestamp: '2026-02-22T14:00:00Z',
      suspiciousEventFlag: false
    },
    {
      source: 'Reuters',
      headline: 'Meta beats Q4 earnings estimates, exceeds revenue expectations',
      summary: 'Meta Inc reports earnings of $2.50 per share, beating consensus of $2.15',
      severityLevel: 'high',
      topic: 'economy',
      timestamp: '2026-02-22T16:32:00Z',
      suspiciousEventFlag: true
    }
  ],
  marketData: {
    kalshi: {
      currentPrice: 0.58,
      volume24h: 8900000,
      priceChangePercent: 3.2,
      suspiciousEventFlag: true
    },
    polymarket: {
      currentPrice: 0.56,
      volume24h: 6200000,
      priceChangePercent: 2.8,
      suspiciousEventFlag: true
    },
    timestamp: '2026-02-22T09:00:00Z',
    suspiciousEventFlag: true
  },
  suspiciousEvents: [
    {
      eventId: 'evt_003',
      basePrice: 0.55,
      spikePrice: 0.82,
      priceJumpPercent: 49.1,
      baseVolume: 950000,
      spikeVolume: 2100000,
      volumeMultiplier: 2.21,
      sentimentShiftTime: '2026-02-22T07:50:00Z',
      marketSpikeTime: '2026-02-22T16:35:00Z',
      newsTime: '2026-02-22T16:32:00Z',
      preSentiments: [
        {
          username: '@CorporateInsider',
          content: 'Someone just accumulated $3M in Meta BEAT options. Institutional knowledge?',
          likes: 3800,
          timestamp: '2026-02-22T07:50:00Z',
          sentiment: 'data-driven'
        }
      ],
      marketTrades: [
        {
          timestamp: '2026-02-22T14:00:00Z',
          price: 0.55,
          volume: 1100000,
          size: 950
        },
        {
          timestamp: '2026-02-22T16:35:00Z',
          price: 0.82,
          volume: 3200000,
          size: 2100
        }
      ],
      delayedNews: [
        {
          source: 'Reuters',
          headline: 'Meta beats Q4 earnings estimates, exceeds revenue expectations',
          summary: 'Meta Inc reports earnings of $2.50 per share, beating consensus of $2.15',
          severityLevel: 'high',
          topic: 'economy',
          timestamp: '2026-02-22T16:32:00Z',
          suspiciousEventFlag: true
        }
      ],
      temporalGap: 525
    }
  ],
  generatedAt: '2026-02-22T09:00:00Z',
  topic: 'earnings'
};

// ═══════════════════════════════════════════════════════════════════════════════════
// TOPIC 4: GEOPOLITICAL ESCALATION
// ═══════════════════════════════════════════════════════════════════════════════════
const geopoliticalData: AllSyntheticData = {
  mlOutputs: [
    {
      riskScore: 0.89,
      liquidityScore: 0.71,
      volatilityIndex: 0.84,
      abnormalBettingScore: 0.82,
      timestamp: '2026-02-22T08:15:00Z'
    }
  ],
  twitterPosts: [
    {
      username: '@GeopoliticalAnalyst',
      content: 'Tension rising between major powers. Intelligence community on high alert.',
      likes: 4200,
      timestamp: '2026-02-21T18:15:00Z',
      sentiment: 'bearish'
    },
    {
      username: '@DefenseExpert',
      content: 'Military mobilization detected in region. Classified briefing today. Market about to move.',
      likes: 3900,
      timestamp: '2026-02-22T07:22:00Z',
      sentiment: 'data-driven'
    },
    {
      username: '@ForeignPolicy',
      content: 'BREAKING: Officials confirm major escalation. Sanctions imminent. Early warning for those who knew.',
      likes: 8100,
      timestamp: '2026-02-22T08:45:00Z',
      sentiment: 'manipulation'
    }
  ],
  redditPosts: [
    {
      username: 'u/Geopolitics',
      subreddit: 'r/worldnews',
      title: 'Institutional traders accumulating YES contracts on geopolitical event',
      content: 'Day traders notice institutions buying escalation contracts 36 hours before announcement.',
      upvotes: 2341,
      timestamp: '2026-02-22T07:30:00Z',
      context: 'betting_strategy'
    }
  ],
  kalshiComments: [
    {
      username: 'geopolitical_trader',
      content: 'Major escalation YES: $10M volume overnight. Institutional conviction.',
      timestamp: '2026-02-22T06:15:00Z',
      signal: 'sharp_money'
    },
    {
      username: 'state_dept_leak',
      content: 'Official statement releasing in 3 hours. Escalation confirmed. Spreading ahead.',
      timestamp: '2026-02-22T08:30:00Z',
      signal: 'insider_knowledge'
    }
  ],
  newsArticles: [
    {
      source: 'AP News',
      headline: 'State Department holds emergency press briefing',
      summary: 'U.S. State Department convenes emergency meeting regarding international tension',
      severityLevel: 'high',
      topic: 'geopolitical_tensions',
      timestamp: '2026-02-22T08:15:00Z',
      suspiciousEventFlag: false
    },
    {
      source: 'BBC News',
      headline: 'Major powers announce coordinated sanctions package',
      summary: 'U.S., EU announce new sanctions against foreign adversary over escalating tensions',
      severityLevel: 'high',
      topic: 'geopolitical_tensions',
      timestamp: '2026-02-22T09:12:00Z',
      suspiciousEventFlag: true
    }
  ],
  marketData: {
    kalshi: {
      currentPrice: 0.82,
      volume24h: 31200000,
      priceChangePercent: 5.8,
      suspiciousEventFlag: true
    },
    polymarket: {
      currentPrice: 0.79,
      volume24h: 22100000,
      priceChangePercent: 5.2,
      suspiciousEventFlag: true
    },
    timestamp: '2026-02-22T09:00:00Z',
    suspiciousEventFlag: true
  },
  suspiciousEvents: [
    {
      eventId: 'evt_004',
      basePrice: 0.72,
      spikePrice: 0.82,
      priceJumpPercent: 13.9,
      baseVolume: 8200000,
      spikeVolume: 23100000,
      volumeMultiplier: 2.82,
      sentimentShiftTime: '2026-02-22T07:22:00Z',
      marketSpikeTime: '2026-02-22T08:50:00Z',
      newsTime: '2026-02-22T09:12:00Z',
      preSentiments: [
        {
          username: '@DefenseExpert',
          content: 'Military mobilization detected in region. Classified briefing today. Market about to move.',
          likes: 3900,
          timestamp: '2026-02-22T07:22:00Z',
          sentiment: 'data-driven'
        }
      ],
      marketTrades: [
        {
          timestamp: '2026-02-22T08:00:00Z',
          price: 0.75,
          volume: 12100000,
          size: 8200
        },
        {
          timestamp: '2026-02-22T08:50:00Z',
          price: 0.82,
          volume: 20200000,
          size: 12800
        }
      ],
      delayedNews: [
        {
          source: 'BBC News',
          headline: 'Major powers announce coordinated sanctions package',
          summary: 'U.S., EU announce new sanctions against foreign adversary over escalating tensions',
          severityLevel: 'high',
          topic: 'geopolitical_tensions',
          timestamp: '2026-02-22T09:12:00Z',
          suspiciousEventFlag: true
        }
      ],
      temporalGap: 22
    }
  ],
  generatedAt: '2026-02-22T09:00:00Z',
  topic: 'geopolitical'
};

// Export all topic data
export const HARDCODED_TOPIC_DATA: Record<TopicId, AllSyntheticData> = {
  '2028-election': election2028Data,
  'fed-rate': fedRateDecisionData,
  'tech-earnings': techEarningsData,
  'geopolitical': geopoliticalData
};

/**
 * Get cached data for a specific topic
 */
export function getTopicData(topicId: TopicId): AllSyntheticData {
  return HARDCODED_TOPIC_DATA[topicId] || HARDCODED_TOPIC_DATA['2028-election'];
}

/**
 * Get all available topics
 */
export function getAllTopics(): TopicId[] {
  return Object.keys(HARDCODED_TOPIC_DATA) as TopicId[];
}
