/**
 * Simulates fetching public posts related to CPI (Consumer Price Index)
 * from an external API. Returns mock posts with timestamps.
 */

export interface Post {
  id: string;
  text: string;
  timestamp: string;
  author: string;
  platform: string;
}

export async function fetchCPIPosts(): Promise<Post[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const now = new Date();
  
  const mockPosts: Post[] = [
    {
      id: '1',
      text: 'Hearing whispers that tomorrow\'s CPI numbers are going to surprise everyone. Market not ready for this.',
      timestamp: new Date(now.getTime() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
      author: '@MarketInsider_2026',
      platform: 'Twitter',
    },
    {
      id: '2',
      text: 'Source close to BLS says CPI data looks very different than consensus. Can\'t say more but watch inflation-sensitive sectors.',
      timestamp: new Date(now.getTime() - 20 * 60 * 60 * 1000).toISOString(), // 20 hours ago
      author: '@EconLeaks',
      platform: 'Twitter',
    },
    {
      id: '3',
      text: 'Just spoke with someone at the Fed. They seemed unusually nervous about tomorrow\'s CPI release. 👀',
      timestamp: new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString(), // 18 hours ago
      author: '@FedWatcher',
      platform: 'Twitter',
    },
    {
      id: '4',
      text: 'CPI announcement in 12 hours. Analysts expect 3.2% but my sources suggest it could be closer to 4%. Buckle up.',
      timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
      author: '@InflationTracker',
      platform: 'Twitter',
    },
    {
      id: '5',
      text: 'Notice how bonds are moving ahead of CPI? Someone knows something. Price action doesn\'t lie.',
      timestamp: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString(), // 10 hours ago
      author: '@BondVigilante',
      platform: 'Twitter',
    },
    {
      id: '6',
      text: 'Unusual options activity in inflation-protected securities. Big players positioning before CPI data.',
      timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
      author: '@OptionsFlow',
      platform: 'Twitter',
    },
    {
      id: '7',
      text: 'Friend who works in data collection mentioned CPI calculations this month are showing unexpected trends. Not financial advice.',
      timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      author: '@DataNerd_Anon',
      platform: 'Reddit',
    },
    {
      id: '8',
      text: 'Why is no one talking about the volume spike in treasury futures right before the close? CPI leak?',
      timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
      author: '@TreasuryWatch',
      platform: 'Twitter',
    },
    {
      id: '9',
      text: 'Regular market commentary: CPI release scheduled for 8:30 AM ET. Consensus is 3.2% year-over-year.',
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      author: '@BloombergNews',
      platform: 'Twitter',
    },
    {
      id: '10',
      text: 'CPI data just released: 3.8% YoY, above consensus expectations. Market reacting strongly.',
      timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
      author: '@ReutersEcon',
      platform: 'Twitter',
    },
  ];

  return mockPosts;
}

/**
 * Simulates fetching posts for a custom time range
 */
export async function fetchCPIPostsInRange(
  startTime: Date,
  endTime: Date
): Promise<Post[]> {
  const allPosts = await fetchCPIPosts();
  
  return allPosts.filter((post) => {
    const postDate = new Date(post.timestamp);
    return postDate >= startTime && postDate <= endTime;
  });
}

/**
 * Generates mock posts with custom timestamps for testing
 */
export function generateMockCPIPosts(count: number): Post[] {
  const templates = [
    'Hearing rumors about upcoming CPI data...',
    'Source says inflation numbers will surprise the market.',
    'Unusual trading activity before CPI release.',
    'Someone leaked CPI numbers to major institutions.',
    'Bond market moving suspiciously ahead of announcement.',
    'My contact at the Fed mentioned concerning trends.',
    'Options traders seem to know something about CPI.',
    'Price action suggests advance knowledge of data.',
  ];

  const platforms = ['Twitter', 'Reddit', 'StockTwits', 'LinkedIn'];
  const now = Date.now();

  return Array.from({ length: count }, (_, i) => ({
    id: `mock-${i + 1}`,
    text: templates[i % templates.length],
    timestamp: new Date(now - (count - i) * 60 * 60 * 1000).toISOString(),
    author: `@User${i + 1}`,
    platform: platforms[i % platforms.length],
  }));
}
