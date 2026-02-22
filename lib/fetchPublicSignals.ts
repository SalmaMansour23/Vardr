/**
 * Simulates fetching public financial signals/posts related to a given event
 */

export interface PublicSignal {
  text: string;
  timestamp: string;
  source: 'Twitter' | 'News' | 'Reddit';
}

interface PostTemplate {
  templates: string[];
  sources: Array<'Twitter' | 'News' | 'Reddit'>;
}

const POST_TEMPLATES: Record<string, PostTemplate> = {
  cpi: {
    templates: [
      "Hearing whispers that tomorrow's CPI numbers are going to surprise everyone. Market not ready for this.",
      "Source close to BLS says CPI data looks very different than consensus. Can't say more but watch inflation-sensitive sectors.",
      "Just spoke with someone at the Fed. They seemed unusually nervous about the CPI release. 👀",
      "CPI announcement coming soon. Analysts expect 3.2% but my sources suggest it could be closer to 4%. Buckle up.",
      "Notice how bonds are moving ahead of CPI? Someone knows something. Price action doesn't lie.",
      "Unusual options activity in inflation-protected securities. Big players positioning before CPI data.",
      "Friend who works in data collection mentioned CPI calculations this month are showing unexpected trends.",
      "Why is no one talking about the volume spike in treasury futures? CPI leak?",
      "Multiple sources saying CPI will come in hot. Energy and housing components elevated.",
      "Market seems to be pricing in higher CPI before the official release. Information asymmetry?",
      "Insider chatter suggests CPI surprise incoming. Follow the smart money.",
      "Treasury desk at major bank repositioning aggressively. They know something about CPI.",
    ],
    sources: ['Twitter', 'Reddit', 'Twitter', 'Twitter', 'Twitter', 'Twitter', 'Reddit', 'Twitter', 'News', 'Twitter', 'Reddit', 'Twitter'],
  },
  fed: {
    templates: [
      "Fed sources hinting at surprise rate decision. Not what the market expects.",
      "Multiple Fed officials canceling public appearances before FOMC. Something's up.",
      "Hearing from DC insiders that the Fed vote might not be unanimous this time.",
      "Treasury market pricing in different Fed decision than consensus. Leak or just smart positioning?",
      "Fed staffer mentioned 'intense internal debates' this cycle. Rate decision could surprise.",
      "Major banks suddenly adjusting rate forecasts 24 hours before Fed announcement. What do they know?",
      "Unusual activity in fed funds futures. Someone positioning for different outcome.",
      "Sources say Powell's statement draft has been rewritten multiple times. Uncertainty within FOMC.",
      "Regional Fed presidents showing unusual disagreement in recent speeches. Contentious meeting ahead.",
      "Fed rate decision tomorrow. My contact at the Fed seemed nervous when I asked about it.",
      "Swap markets moving strangely ahead of FOMC. Information leaking somewhere.",
      "Hearing the Fed might surprise with both rate decision AND balance sheet guidance.",
    ],
    sources: ['Twitter', 'Twitter', 'News', 'Twitter', 'Reddit', 'Twitter', 'Twitter', 'News', 'News', 'Reddit', 'Twitter', 'Twitter'],
  },
  energy: {
    templates: [
      "OPEC+ meeting outcome already leaked to select group. Output decision not what markets expect.",
      "Energy trader contacts saying major supply announcement coming. Prices will move significantly.",
      "Strategic Petroleum Reserve decision leaked to major firms. Watch energy stocks.",
      "Sources at major oil companies repositioning ahead of announcement. They have advance intel.",
      "Unusual positioning in energy derivatives. Someone knows about tomorrow's release.",
      "Pipeline capacity announcement coming. Insiders already trading on the news.",
      "OPEC members disagreeing behind closed doors. Decision might surprise markets.",
      "Natural gas storage data leaked early again. Some traders already front-running.",
      "Energy sector insiders buying aggressively. They know something about the announcement.",
      "Major energy companies adjusting hedges 48 hours before official data. Suspicious timing.",
      "Hearing production numbers will shock the market. Current forecasts way off.",
      "Refinery capacity report coming soon. Industry contacts say figures diverge from expectations.",
    ],
    sources: ['Twitter', 'News', 'Twitter', 'Reddit', 'Twitter', 'Twitter', 'News', 'Twitter', 'Twitter', 'Reddit', 'Twitter', 'News'],
  },
  trade: {
    templates: [
      "Trade deal announcement imminent. Terms already leaked to connected investors.",
      "Sources in Geneva say trade agreement contains surprise provisions. Market impact underestimated.",
      "Tariff decision expected tomorrow. Multiple sources saying it won't match expectations.",
      "Trade negotiators finalizing details. Leaked draft shows significant concessions.",
      "Currency traders positioning for trade announcement. They have advance information.",
      "Trade agreement terms leaked to major corporations. Watch downstream suppliers.",
      "Sources saying trade deal includes surprise sectors. Agricultural commodities will move.",
      "Diplomatic contacts hint trade negotiations concluded differently than public statements suggest.",
      "Import/export data coming soon. Industry insiders saying numbers will surprise.",
      "Trade policy announcement tomorrow. Connected traders already repositioning portfolios.",
      "Hearing trade agreement includes intellectual property provisions that will affect tech stocks.",
      "Multiple sources confirming trade deal terms favor specific industries. Leak appears widespread.",
    ],
    sources: ['Twitter', 'News', 'Twitter', 'Twitter', 'Twitter', 'Reddit', 'News', 'News', 'Twitter', 'Reddit', 'Twitter', 'News'],
  },
  earnings: {
    templates: [
      "Earnings release tomorrow. Supply chain contacts suggest numbers will beat significantly.",
      "Company insiders unusually quiet ahead of earnings. Could indicate major surprise.",
      "Channel checks showing much stronger quarter than consensus. Earnings leak?",
      "Multiple analysts suddenly revising estimates hours before earnings. They know something.",
      "Options flow suggests earnings surprise incoming. Institutional positioning unusual.",
      "Supplier contacts hint at production numbers that don't match guidance. Leak possible.",
      "Unusual insider trading activity before blackout period. SEC should investigate.",
      "Industry sources saying earnings will diverge significantly from expectations.",
      "Major fund repositioning ahead of earnings release. Advance information likely.",
      "Hearing guidance will shock the market. Not reflected in current positioning.",
      "Customer data suggests revenue materially different than consensus. Information asymmetry.",
      "Supply chain partners adjusting forecasts ahead of earnings. They have inside info.",
    ],
    sources: ['Twitter', 'Reddit', 'Twitter', 'Twitter', 'Twitter', 'News', 'Twitter', 'Reddit', 'Twitter', 'Twitter', 'News', 'Twitter'],
  },
  jobs: {
    templates: [
      "Jobs report tomorrow. Multiple sources saying headline number will shock markets.",
      "BLS data collectors mentioning unusual survey responses this month. Expect surprise.",
      "Employment indicators all pointing to different number than consensus. Leak or coincidence?",
      "Labor market contacts saying jobs data diverges significantly from expectations.",
      "Unusual trading in rate-sensitive sectors ahead of jobs report. Information leaking.",
      "Regional employment data suggests national numbers won't match forecasts.",
      "Jobs report coming soon. My contacts in workforce analytics seeing unexpected trends.",
      "Major firms adjusting hiring plans day before jobs report. What do they know?",
      "Employment services reporting figures that don't align with consensus. Data leak suspected.",
      "Options positioning suggests jobs report surprise. Institutional advance knowledge?",
      "Labor market insiders saying unemployment rate calculation will reveal surprises.",
      "Jobs data tomorrow. Multiple economists suddenly changing forecasts. Coordinated or leak?",
    ],
    sources: ['Twitter', 'Reddit', 'Twitter', 'News', 'Twitter', 'Twitter', 'Reddit', 'Twitter', 'News', 'Twitter', 'Twitter', 'Twitter'],
  },
};

const DEFAULT_TEMPLATES: PostTemplate = {
  templates: [
    "Major market-moving announcement expected soon. Connected traders already positioning.",
    "Sources say tomorrow's data release will surprise markets significantly.",
    "Unusual institutional activity ahead of announcement. Information asymmetry likely.",
    "Multiple contacts hinting at unexpected outcome. Watch for volatility.",
    "Data release coming soon. Industry insiders saying consensus is way off.",
    "Hearing advance information leaked to select group. Market will reprice sharply.",
    "Announcement tomorrow. Pre-event positioning suggests some traders have inside info.",
    "Sources close to the situation say outcome will diverge from expectations.",
    "Major funds repositioning ahead of release. They know something markets don't.",
    "Event announcement imminent. Smart money already moving.",
  ],
  sources: ['Twitter', 'Twitter', 'News', 'Reddit', 'Twitter', 'Twitter', 'Twitter', 'News', 'Twitter', 'Reddit'],
};

/**
 * Generates realistic timestamps within 48 hours before an event
 */
function generateTimestamps(count: number, hoursBeforeEvent: number = 48, driftTime?: string): string[] {
  const eventTime = driftTime ? new Date(driftTime).getTime() : Date.now();
  const timestamps: string[] = [];
  
  for (let i = 0; i < count; i++) {
    // Distribute posts more heavily closer to the event (logarithmic distribution)
    const timeRatio = Math.pow(Math.random(), 2); // Skew towards recent times
    const hoursAgo = timeRatio * hoursBeforeEvent;
    const millisecondsAgo = hoursAgo * 60 * 60 * 1000;
    
    timestamps.push(new Date(eventTime - millisecondsAgo).toISOString());
  }
  
  // Sort chronologically (oldest first)
  return timestamps.sort();
}

export const FETCH_PUBLIC_SIGNALS_DEFAULT_COUNT = 8;
export const FETCH_PUBLIC_SIGNALS_DEFAULT_HOURS_BEFORE_EVENT = 48;

/**
 * Fetches simulated public financial signals related to a given event
 *
 * @param eventKeyword - Keyword to determine which type of posts to generate (cpi, fed, energy, trade, earnings, jobs)
 * @param count - Number of posts to generate (default: FETCH_PUBLIC_SIGNALS_DEFAULT_COUNT)
 * @param hoursBeforeEvent - Time window in hours before event (default: FETCH_PUBLIC_SIGNALS_DEFAULT_HOURS_BEFORE_EVENT)
 * @returns Array of public signals with text, timestamp, and source
 */
export function fetchPublicSignals(
  eventKeyword: string,
  driftTime: string,
  count: number = FETCH_PUBLIC_SIGNALS_DEFAULT_COUNT,
  hoursBeforeEvent: number = FETCH_PUBLIC_SIGNALS_DEFAULT_HOURS_BEFORE_EVENT
): PublicSignal[] {
  
  const keyword = eventKeyword.toLowerCase();
  
  // Find matching template set
  let templateSet = DEFAULT_TEMPLATES;
  for (const [key, templates] of Object.entries(POST_TEMPLATES)) {
    if (keyword.includes(key)) {
      templateSet = templates;
      break;
    }
  }
  
  // Generate posts with timestamps relative to drift time
  const timestamps = generateTimestamps(count, hoursBeforeEvent, driftTime);
  const signals: PublicSignal[] = [];
  
  for (let i = 0; i < count; i++) {
    const templateIndex = i % templateSet.templates.length;
    const sourceIndex = i % templateSet.sources.length;
    
    signals.push({
      text: templateSet.templates[templateIndex],
      timestamp: timestamps[i],
      source: templateSet.sources[sourceIndex],
    });
  }
  
  return signals;
}

/**
 * Generates posts for multiple event types simultaneously
 */
export function fetchMultipleEventSignals(
  eventKeywords: string[],
  driftTime: string,
  postsPerEvent: number = 5
): Record<string, PublicSignal[]> {
  const results: Record<string, PublicSignal[]> = {};
  
  eventKeywords.forEach((keyword) => {
    results[keyword] = fetchPublicSignals(keyword, driftTime, postsPerEvent);
  });
  
  return results;
}
