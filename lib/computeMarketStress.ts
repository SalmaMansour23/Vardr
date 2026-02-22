interface Trade {
  timestamp: string;
  price: string | number;
  size: number;
  side: string;
}

interface MarketMetadata {
  event_date?: string | null;
  liquidity?: number;
  open_interest?: number;
  volume?: number;
  status?: string;
}

interface MarketStressMetrics {
  volatility_index: number;
  imbalance_ratio: number;
  volume_spike_score: number;
  liquidity_stress: number;
  acceleration_score: number;
  composite_stress_score: number;
}

/**
 * Compute comprehensive market stress indicators from trade data
 */
export function computeMarketStress(
  trades: Trade[],
  metadata: MarketMetadata
): MarketStressMetrics {
  // Handle edge cases
  if (trades.length === 0) {
    return {
      volatility_index: 0,
      imbalance_ratio: 0,
      volume_spike_score: 0,
      liquidity_stress: 0,
      acceleration_score: 0,
      composite_stress_score: 0,
    };
  }

  // Sort trades by timestamp (newest first)
  const sortedTrades = [...trades].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // 1. Volatility Index - Rolling standard deviation of price changes
  const volatility_index = computeVolatility(sortedTrades);

  // 2. Order Imbalance Ratio - YES vs NO trade imbalance
  const imbalance_ratio = computeOrderImbalance(sortedTrades);

  // 3. Volume Spike Score - Current volume vs historical average
  const volume_spike_score = computeVolumeSpike(sortedTrades, metadata);

  // 4. Liquidity Stress - Pre-event concentration and liquidity compression
  const liquidity_stress = computeLiquidityStress(sortedTrades, metadata);

  // 5. Price Acceleration - Second derivative of price movement
  const acceleration_score = computePriceAcceleration(sortedTrades);

  // 6. Composite Stress Score - Weighted combination of all metrics
  const composite_stress_score = computeCompositeScore({
    volatility_index,
    imbalance_ratio,
    volume_spike_score,
    liquidity_stress,
    acceleration_score,
  });

  return {
    volatility_index: Number(volatility_index.toFixed(2)),
    imbalance_ratio: Number(imbalance_ratio.toFixed(2)),
    volume_spike_score: Number(volume_spike_score.toFixed(2)),
    liquidity_stress: Number(liquidity_stress.toFixed(2)),
    acceleration_score: Number(acceleration_score.toFixed(2)),
    composite_stress_score: Number(composite_stress_score.toFixed(2)),
  };
}

/**
 * Compute rolling standard deviation of price changes
 */
function computeVolatility(trades: Trade[]): number {
  if (trades.length < 2) return 0;

  const prices = trades.map((t) => parseFloat(String(t.price)));
  const priceChanges: number[] = [];

  for (let i = 0; i < prices.length - 1; i++) {
    const change = Math.abs(prices[i] - prices[i + 1]);
    priceChanges.push(change);
  }

  if (priceChanges.length === 0) return 0;

  const mean = priceChanges.reduce((sum, val) => sum + val, 0) / priceChanges.length;
  const variance =
    priceChanges.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    priceChanges.length;
  const stdDev = Math.sqrt(variance);

  // Normalize to 0-100 scale (assuming typical price range 0-1)
  return Math.min(stdDev * 100, 100);
}

/**
 * Compute order imbalance between YES and NO trades
 */
function computeOrderImbalance(trades: Trade[]): number {
  let yesVolume = 0;
  let noVolume = 0;

  trades.forEach((trade) => {
    const volume = trade.size;
    if (trade.side.toUpperCase() === 'YES') {
      yesVolume += volume;
    } else {
      noVolume += volume;
    }
  });

  const totalVolume = yesVolume + noVolume;
  if (totalVolume === 0) return 0;

  // Compute imbalance ratio: -100 (all NO) to +100 (all YES)
  const ratio = ((yesVolume - noVolume) / totalVolume) * 100;
  
  // Return absolute imbalance as stress indicator (0-100)
  return Math.abs(ratio);
}

/**
 * Compute volume spike relative to historical average
 */
function computeVolumeSpike(trades: Trade[], metadata: MarketMetadata): number {
  if (trades.length < 10) return 0;

  // Split trades into recent (last 20%) and historical (rest)
  const splitPoint = Math.floor(trades.length * 0.2);
  const recentTrades = trades.slice(0, splitPoint);
  const historicalTrades = trades.slice(splitPoint);

  const recentVolume = recentTrades.reduce((sum, t) => sum + t.size, 0);
  const historicalVolume = historicalTrades.reduce((sum, t) => sum + t.size, 0);

  const recentAvg = recentVolume / recentTrades.length;
  const historicalAvg = historicalVolume / historicalTrades.length;

  if (historicalAvg === 0) return 0;

  // Compute spike ratio (normalized to 0-100)
  const spikeRatio = (recentAvg / historicalAvg - 1) * 100;
  return Math.max(0, Math.min(spikeRatio, 100));
}

/**
 * Compute liquidity compression and pre-event concentration
 */
function computeLiquidityStress(trades: Trade[], metadata: MarketMetadata): number {
  let stressScore = 0;

  // Factor 1: Liquidity compression (if liquidity data available)
  if (metadata.liquidity !== undefined && metadata.open_interest !== undefined) {
    if (metadata.open_interest > 0) {
      const liquidityRatio = metadata.liquidity / metadata.open_interest;
      // Low liquidity relative to open interest = high stress
      stressScore += Math.max(0, (1 - liquidityRatio) * 50);
    }
  }

  // Factor 2: Pre-event concentration (if event approaching)
  if (metadata.event_date) {
    const now = new Date();
    const eventDate = new Date(metadata.event_date);
    const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilEvent > 0 && hoursUntilEvent < 48) {
      // Event within 48 hours - check for concentration
      const recentTrades = trades.slice(0, Math.min(50, trades.length));
      const recentVolume = recentTrades.reduce((sum, t) => sum + t.size, 0);
      const totalVolume = metadata.volume || 1;
      
      // High concentration in recent trades = high stress
      const concentrationRatio = (recentVolume / totalVolume) * 100;
      stressScore += Math.min(concentrationRatio * 0.5, 50);
    }
  }

  return Math.min(stressScore, 100);
}

/**
 * Compute price acceleration (second derivative)
 */
function computePriceAcceleration(trades: Trade[]): number {
  if (trades.length < 3) return 0;

  const prices = trades.map((t) => parseFloat(String(t.price)));
  const accelerations: number[] = [];

  // Compute second derivative (acceleration)
  for (let i = 0; i < prices.length - 2; i++) {
    const velocity1 = prices[i] - prices[i + 1];
    const velocity2 = prices[i + 1] - prices[i + 2];
    const acceleration = velocity1 - velocity2;
    accelerations.push(Math.abs(acceleration));
  }

  if (accelerations.length === 0) return 0;

  // Average absolute acceleration
  const avgAcceleration =
    accelerations.reduce((sum, val) => sum + val, 0) / accelerations.length;

  // Normalize to 0-100 scale
  return Math.min(avgAcceleration * 1000, 100);
}

/**
 * Compute composite stress score from all metrics
 */
function computeCompositeScore(metrics: {
  volatility_index: number;
  imbalance_ratio: number;
  volume_spike_score: number;
  liquidity_stress: number;
  acceleration_score: number;
}): number {
  // Weighted combination of metrics
  const weights = {
    volatility: 0.25,
    imbalance: 0.20,
    volume_spike: 0.20,
    liquidity: 0.20,
    acceleration: 0.15,
  };

  const composite =
    metrics.volatility_index * weights.volatility +
    metrics.imbalance_ratio * weights.imbalance +
    metrics.volume_spike_score * weights.volume_spike +
    metrics.liquidity_stress * weights.liquidity +
    metrics.acceleration_score * weights.acceleration;

  return Math.min(composite, 100);
}
