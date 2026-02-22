/**
 * Server-only feature config for API routes.
 * Do not import from client components.
 * Values can be overridden via environment variables where noted.
 */

const envNumber = (key: string, defaultVal: number): number => {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultVal;
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultVal;
};

const envFloat = (key: string, defaultVal: number): number => {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultVal;
  const n = Number(v);
  return Number.isFinite(n) ? n : defaultVal;
};

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;

export const POLL_INTERVAL_MS = envNumber("KALSHI_POLL_INTERVAL_MS", 2000);
export const MAX_SEEN_IDS = envNumber("KALSHI_MAX_SEEN_IDS", 5000);

export const LAST_HOUR_MS = 3600000;
export const LAST_24H_MS = 86400000;
export const RAPID_SEQUENCE_WINDOW_MS = 5 * MS_PER_MINUTE;

export const LAST_HOUR_CONCENTRATION_RATIO = 0.3;
export const TRADER_CONCENTRATION_MIN = 0.3;
export const MIN_TRADERS_FOR_CONCENTRATION = 10;
export const SIMILARITY_THRESHOLD = envNumber("ADVERSARIAL_SIMILARITY_THRESHOLD", 50);
export const RAPID_SEQUENCE_MIN_COUNT = 5;
export const RAPID_SEQUENCE_RATIO = 0.2;

export const TEMPORAL_ALIGNMENT_WINDOW_MS = 30 * MS_PER_MINUTE;
export const CONCENTRATION_WINDOW_MS = 1 * MS_PER_HOUR;

export const RISK_WEIGHTS = {
  temporal_alignment_score: envFloat("RISK_WEIGHT_TEMPORAL_ALIGNMENT", 0.3),
  position_concentration: envFloat("RISK_WEIGHT_POSITION_CONCENTRATION", 0.2),
  timing_precision: envFloat("RISK_WEIGHT_TIMING_PRECISION", 0.15),
  cross_event_exposure: envFloat("RISK_WEIGHT_CROSS_EVENT", 0.2),
  signal_correlation: envFloat("RISK_WEIGHT_SIGNAL_CORRELATION", 0.15),
} as const;

export const RISK_CATEGORY_BOUNDARIES = {
  critical: 80,
  high: 60,
  moderate: 40,
  low: 20,
} as const;

export const KALSHI_BASE_URL = process.env.KALSHI_API_BASE_URL ?? 'https://api.elections.kalshi.com/trade-api/v2';
