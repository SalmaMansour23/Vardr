export interface Trade {
  tradeId: string;
  contractId: string;
  traderId: string;
  timestamp: number;
  direction: 'Yes' | 'No';
  price: number;
  size: number;
  isAnomaly?: boolean;
  relativeTimeStr: string;
  isPreEvent?: boolean;
}

export interface TraderProfile {
  traderId: string;
  totalTrades: number;
  winRate: number;
  avgSize: number;
  preEventRatio: number;
  riskContribution: number;
  trades: Trade[];
  behaviorSummary: string;
  flagReasons: string[];
}

export interface TradeData {
  timestamp: number;
  probability: number;
  buyVolume: number;
  sellVolume: number;
  traderId: string;
  isAnomaly?: boolean;
  sentiment?: number; // -1 to 1
}

export interface SocialSignal {
  id: string;
  author: string;
  text: string;
  timestamp: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: 'high' | 'medium' | 'low';
}

export interface RiskAnalysis {
  riskScore: number;
  driftDeviationScore: number;
  imbalanceScore: number;
  volumeSpikeScore: number;
  sequencePatternScore: number;
  preEventConcentrationScore: number;
  crossEventAlignmentScore: number;
  leadLagScore: number;
  socialSentimentDivergenceScore: number;
  anomalyTimestamps: number[];
  networkNodes: { id: string; group: number }[];
  networkLinks: { source: string; target: string; value: number }[];
  crossContractLag?: number;
}

export interface Contract extends RiskAnalysis {
  id: string;
  name: string;
  description: string;
  announcementTime: number;
  currentPrice: number;
  preEventVolumePct: number;
  hasCoordination: boolean;
  hasLeadLag: boolean;
  data: TradeData[];
  trades: Trade[];
  socialSignals: SocialSignal[];
}

export const NAMED_TRADERS = [
  'Trader_Apollo',
  'Trader_Vega',
  'Trader_Atlas',
  'Trader_Nova',
  'Trader_Orion',
  'Trader_Zenith'
];

const CONTRACT_TEMPLATES = [
  {
    id: 'FED-MAR-2026',
    name: 'Fed Rate Cut (March 2026)',
    description: 'Will the Fed cut rates in March 2026?',
    announcementOffset: 15 * 60000, // 15 mins from now
  },
  {
    id: 'CPI-APR-2026',
    name: 'US CPI > 3.5% (April 2026)',
    description: 'Will US CPI exceed 3.5% in April 2026?',
    announcementOffset: 25 * 60000,
  },
  {
    id: 'NVDA-Q1-2026',
    name: 'NVIDIA > $950 (Q1 2026)',
    description: 'Will NVIDIA stock close above $950 after Q1 2026 earnings?',
    announcementOffset: 45 * 60000,
  },
  {
    id: 'TRADE-JUL-2026',
    name: 'US-China Trade Deal',
    description: 'Will a US–China trade agreement be announced before July 1, 2026?',
    announcementOffset: 60 * 60000,
  }
];

const SOCIAL_SAMPLES = [
  "Something big coming tomorrow morning 👀",
  "Rates decision going to surprise markets.",
  "Trade deal rumors heating up.",
  "Watching the CPI print closely, asymmetry detected.",
  "NVIDIA guidance might be the leak of the year.",
  "Heavy positioning in the front-end before the announcement."
];

export function generateSeededData(leaked: boolean = false, templateIndex: number = 0): Contract {
  const template = CONTRACT_TEMPLATES[templateIndex];
  const data: TradeData[] = [];
  const trades: Trade[] = [];
  const announcementTime = Date.now() + template.announcementOffset;
  const marketStartTime = Date.now() - 100 * 60000;
  
  let currentProb = 0.5;
  const points = 120;

  for (let i = 0; i < points; i++) {
    const timestamp = marketStartTime + i * 60000;
    const isPreEventWindow = leaked && timestamp > announcementTime - 10 * 60000 && timestamp < announcementTime;
    
    // Simulate drift
    const drift = isPreEventWindow ? 0.02 : (Math.random() - 0.5) * 0.008;
    currentProb = Math.max(0.01, Math.min(0.99, currentProb + drift));
    
    const buyVol = Math.floor(Math.random() * 800) + (isPreEventWindow ? 8000 : 0);
    const sellVol = Math.floor(Math.random() * 800);
    
    // Assign "Atlas" to the suspicious pre-event window if leaked
    const traderId = isPreEventWindow 
      ? (Math.random() > 0.3 ? 'Trader_Atlas' : NAMED_TRADERS[Math.floor(Math.random() * NAMED_TRADERS.length)])
      : NAMED_TRADERS[Math.floor(Math.random() * NAMED_TRADERS.length)];

    data.push({
      timestamp,
      probability: Number(currentProb.toFixed(4)),
      buyVolume: buyVol,
      sellVolume: sellVol,
      traderId,
      isAnomaly: isPreEventWindow,
      sentiment: isPreEventWindow ? 0.8 : (Math.random() - 0.5) * 0.2
    });

    const tradeTimestamp = timestamp + (Math.random() - 0.5) * 30000;
    const minsToEvent = Math.round((announcementTime - tradeTimestamp) / 60000);

    trades.push({
      tradeId: `TR-${Math.random().toString(36).substr(2, 9)}`,
      contractId: template.id,
      traderId,
      timestamp: tradeTimestamp,
      direction: isPreEventWindow ? 'Yes' : (Math.random() > 0.5 ? 'Yes' : 'No'),
      price: Number(currentProb.toFixed(2)),
      size: Math.floor(Math.random() * 400) + (isPreEventWindow ? 3000 : 0),
      isAnomaly: isPreEventWindow,
      isPreEvent: tradeTimestamp < announcementTime && tradeTimestamp > announcementTime - 30 * 60000,
      relativeTimeStr: minsToEvent > 0 ? `-${minsToEvent}m` : `+${Math.abs(minsToEvent)}m`
    });
  }

  const socialSignals: SocialSignal[] = Array.from({ length: 5 }, (_, i) => ({
    id: `SOC-${i}`,
    author: `User_${Math.floor(Math.random() * 1000)}`,
    text: SOCIAL_SAMPLES[Math.floor(Math.random() * SOCIAL_SAMPLES.length)],
    timestamp: announcementTime - (15 - i) * 60000,
    sentiment: leaked ? 'positive' : 'neutral',
    impact: leaked ? 'high' : 'low'
  }));

  const analysis = analyzeData(data, leaked);

  return {
    ...analysis,
    id: template.id,
    name: template.name,
    description: template.description,
    announcementTime,
    currentPrice: currentProb,
    preEventVolumePct: Math.round((trades.filter(t => t.isPreEvent).reduce((a, b) => a + b.size, 0) / trades.reduce((a, b) => a + b.size, 1)) * 100),
    hasCoordination: analysis.sequencePatternScore > 60,
    hasLeadLag: leaked && template.id === 'CPI-APR-2026',
    data,
    trades: trades.sort((a, b) => b.timestamp - a.timestamp),
    socialSignals
  };
}

export function getTraderProfile(traderId: string, allTrades: Trade[]): TraderProfile {
  const traderTrades = allTrades.filter(t => t.traderId === traderId);
  const preEventTrades = traderTrades.filter(t => t.isAnomaly);
  
  const totalTrades = traderTrades.length;
  const preEventRatio = totalTrades > 0 ? (preEventTrades.length / totalTrades) * 100 : 0;
  const avgSize = totalTrades > 0 ? traderTrades.reduce((acc, t) => acc + t.size, 0) / totalTrades : 0;
  
  let riskContribution = 10;
  let behaviorSummary = "Standard market participant with diversified timing. No significant pre-disclosure correlation detected.";
  const flagReasons: string[] = [];

  if (traderId === 'Trader_Atlas' && preEventRatio > 30) {
    riskContribution = 88;
    behaviorSummary = "High Information Asymmetry Risk Pattern. This trader displays statistically significant accumulation sequences immediately preceding macro disclosures.";
    flagReasons.push(`${Math.round(preEventRatio)}% of directional volume placed within 10 minutes before announcements`);
    flagReasons.push("Detected accumulation sequence within 5-minute pre-event window");
    flagReasons.push("Historical win rate during high-volatility event windows exceeds 75%");
    flagReasons.push("Trade timing statistically deviates from population baseline (p < 0.01)");
    flagReasons.push("Cross-contract directional alignment detected before correlated macro events");
  } else if (preEventRatio > 40) {
    riskContribution = 65;
    behaviorSummary = "Elevated Pre-Disclosure Behavioral Pattern. Consistent positioning in pre-event windows with above-average accuracy.";
    flagReasons.push("Consistent pre-announcement positioning across multiple contracts");
    flagReasons.push("Position sizing scales significantly in pre-disclosure windows");
  }

  return {
    traderId,
    totalTrades,
    winRate: traderId === 'Trader_Atlas' ? 78 : 54,
    avgSize: Math.round(avgSize),
    preEventRatio: Math.round(preEventRatio),
    riskContribution,
    trades: traderTrades,
    behaviorSummary,
    flagReasons
  };
}

export function analyzeData(data: TradeData[], leaked: boolean): RiskAnalysis {
  const drift = leaked ? 75 : 12;
  const imbalance = leaked ? 82 : 15;
  const volume = leaked ? 90 : 8;
  const sequence = leaked ? 78 : 10;
  const preEvent = leaked ? 85 : 14;
  const crossEvent = leaked ? 70 : 5;
  const leadLag = leaked ? 92 : 4;
  const social = leaked ? 68 : 12;

  const riskScore = Math.round(
    (drift * 0.15) + 
    (imbalance * 0.1) + 
    (volume * 0.1) + 
    (sequence * 0.15) + 
    (preEvent * 0.15) + 
    (crossEvent * 0.1) + 
    (leadLag * 0.15) + 
    (social * 0.1)
  );

  return {
    riskScore,
    driftDeviationScore: drift,
    imbalanceScore: imbalance,
    volumeSpikeScore: volume,
    sequencePatternScore: sequence,
    preEventConcentrationScore: preEvent,
    crossEventAlignmentScore: crossEvent,
    leadLagScore: leadLag,
    socialSentimentDivergenceScore: social,
    anomalyTimestamps: leaked ? [data[data.length - 10].timestamp] : [],
    networkNodes: NAMED_TRADERS.map(id => ({ id, group: id === 'Trader_Atlas' ? 1 : 0 })),
    networkLinks: leaked ? [{ source: 'Trader_Atlas', target: 'Trader_Vega', value: 2 }] : []
  };
}