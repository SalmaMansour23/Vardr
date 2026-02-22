interface Trade {
  timestamp: string;
  price: string | number;
  size: number;
  side: string;
  trade_id?: string;
}

interface BehavioralMetrics {
  avg_trade_size: number;
  median_trade_size: number;
  trade_size_stddev: number;
  trade_frequency_per_hour: number;
  concentration_index: number; // Herfindahl index (0-1)
  directional_skew: number; // -1 (all NO) to +1 (all YES)
  whale_concentration: number; // % of volume from top 5% trades
  large_trade_ratio: number; // % of trades above 75th percentile
  total_trades: number;
  total_volume: number;
}

/**
 * Compute behavioral aggregation metrics from trade history
 */
export function computeBehavioralAggregation(trades: Trade[]): BehavioralMetrics {
  if (trades.length === 0) {
    return {
      avg_trade_size: 0,
      median_trade_size: 0,
      trade_size_stddev: 0,
      trade_frequency_per_hour: 0,
      concentration_index: 0,
      directional_skew: 0,
      whale_concentration: 0,
      large_trade_ratio: 0,
      total_trades: 0,
      total_volume: 0,
    };
  }

  // 1. Compute trade size statistics
  const tradeSizes = trades.map((t) => t.size);
  const totalVolume = tradeSizes.reduce((sum, size) => sum + size, 0);
  const avgTradeSize = totalVolume / trades.length;
  const medianTradeSize = computeMedian(tradeSizes);
  const tradeSizeStddev = computeStdDev(tradeSizes, avgTradeSize);

  // 2. Compute trade frequency (trades per hour)
  const tradeFrequency = computeTradeFrequency(trades);

  // 3. Compute Herfindahl concentration index
  const concentrationIndex = computeHerfindahlIndex(tradeSizes, totalVolume);

  // 4. Compute directional skew (YES vs NO bias)
  const directionalSkew = computeDirectionalSkew(trades, totalVolume);

  // 5. Compute whale concentration (top 5% volume share)
  const whaleConcentration = computeWhaleConcentration(tradeSizes, totalVolume);

  // 6. Compute large trade ratio (trades above 75th percentile)
  const largeTradeRatio = computeLargeTradeRatio(tradeSizes);

  return {
    avg_trade_size: Number(avgTradeSize.toFixed(2)),
    median_trade_size: Number(medianTradeSize.toFixed(2)),
    trade_size_stddev: Number(tradeSizeStddev.toFixed(2)),
    trade_frequency_per_hour: Number(tradeFrequency.toFixed(2)),
    concentration_index: Number(concentrationIndex.toFixed(4)),
    directional_skew: Number(directionalSkew.toFixed(3)),
    whale_concentration: Number(whaleConcentration.toFixed(2)),
    large_trade_ratio: Number(largeTradeRatio.toFixed(2)),
    total_trades: trades.length,
    total_volume: totalVolume,
  };
}

/**
 * Compute median of an array of numbers
 */
function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

/**
 * Compute standard deviation
 */
function computeStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0;

  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Compute trade frequency (trades per hour)
 */
function computeTradeFrequency(trades: Trade[]): number {
  if (trades.length < 2) return 0;

  // Parse timestamps and compute time range
  const timestamps = trades
    .map((t) => new Date(t.timestamp).getTime())
    .filter((ts) => !isNaN(ts))
    .sort((a, b) => a - b);

  if (timestamps.length < 2) return 0;

  const earliestTime = timestamps[0];
  const latestTime = timestamps[timestamps.length - 1];
  const timeRangeHours = (latestTime - earliestTime) / (1000 * 60 * 60);

  if (timeRangeHours === 0) return 0;

  return trades.length / timeRangeHours;
}

/**
 * Compute Herfindahl concentration index
 * Measures market concentration (0 = perfect competition, 1 = monopoly)
 */
function computeHerfindahlIndex(tradeSizes: number[], totalVolume: number): number {
  if (totalVolume === 0) return 0;

  // Compute sum of squared market shares
  const sumOfSquares = tradeSizes.reduce((sum, size) => {
    const marketShare = size / totalVolume;
    return sum + Math.pow(marketShare, 2);
  }, 0);

  return sumOfSquares;
}

/**
 * Compute directional skew (YES vs NO trade bias)
 * Returns -1 (all NO) to +1 (all YES)
 */
function computeDirectionalSkew(trades: Trade[], totalVolume: number): number {
  if (totalVolume === 0) return 0;

  let yesVolume = 0;
  let noVolume = 0;

  trades.forEach((trade) => {
    const side = trade.side.toUpperCase();
    if (side === 'YES') {
      yesVolume += trade.size;
    } else if (side === 'NO') {
      noVolume += trade.size;
    }
  });

  const netVolume = yesVolume - noVolume;
  return netVolume / totalVolume;
}

/**
 * Compute whale concentration (top 5% of trades by volume)
 * Returns percentage of total volume controlled by largest trades
 */
function computeWhaleConcentration(tradeSizes: number[], totalVolume: number): number {
  if (totalVolume === 0 || tradeSizes.length === 0) return 0;

  // Sort trade sizes descending
  const sortedSizes = [...tradeSizes].sort((a, b) => b - a);

  // Compute top 5% threshold
  const top5percentCount = Math.max(1, Math.ceil(sortedSizes.length * 0.05));

  // Sum volume of top 5% trades
  const whaleVolume = sortedSizes
    .slice(0, top5percentCount)
    .reduce((sum, size) => sum + size, 0);

  return (whaleVolume / totalVolume) * 100;
}

/**
 * Compute large trade ratio (trades above 75th percentile)
 * Returns percentage of trades that are "large"
 */
function computeLargeTradeRatio(tradeSizes: number[]): number {
  if (tradeSizes.length === 0) return 0;

  // Compute 75th percentile
  const sorted = [...tradeSizes].sort((a, b) => a - b);
  const p75Index = Math.floor(sorted.length * 0.75);
  const p75Threshold = sorted[p75Index];

  // Count trades above threshold
  const largeTrades = tradeSizes.filter((size) => size > p75Threshold).length;

  return (largeTrades / tradeSizes.length) * 100;
}

/**
 * Compute advanced distribution metrics for trade sizes
 */
export function computeDistributionMetrics(trades: Trade[]): {
  skewness: number;
  kurtosis: number;
  percentiles: { p25: number; p50: number; p75: number; p90: number; p95: number };
} {
  if (trades.length === 0) {
    return {
      skewness: 0,
      kurtosis: 0,
      percentiles: { p25: 0, p50: 0, p75: 0, p90: 0, p95: 0 },
    };
  }

  const tradeSizes = trades.map((t) => t.size);
  const mean = tradeSizes.reduce((sum, val) => sum + val, 0) / tradeSizes.length;
  const stdDev = computeStdDev(tradeSizes, mean);

  // Compute skewness (measure of asymmetry)
  const skewness =
    stdDev === 0
      ? 0
      : tradeSizes.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) /
        tradeSizes.length;

  // Compute kurtosis (measure of tail heaviness)
  const kurtosis =
    stdDev === 0
      ? 0
      : tradeSizes.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0) /
        tradeSizes.length;

  // Compute percentiles
  const sorted = [...tradeSizes].sort((a, b) => a - b);
  const percentiles = {
    p25: sorted[Math.floor(sorted.length * 0.25)],
    p50: sorted[Math.floor(sorted.length * 0.50)],
    p75: sorted[Math.floor(sorted.length * 0.75)],
    p90: sorted[Math.floor(sorted.length * 0.90)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
  };

  return {
    skewness: Number(skewness.toFixed(3)),
    kurtosis: Number(kurtosis.toFixed(3)),
    percentiles,
  };
}
