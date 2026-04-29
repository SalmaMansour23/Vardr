export type WindowKey = "24h" | "7d" | "30d";

export type FeedBand = "ALL" | "INVESTIGATE" | "WATCHLIST" | "LOW";

export type UiBandMode = "INVESTIGATE_ONLY" | "WATCHLIST_PLUS" | "INCLUDE_LOW";

export type SuspiciousRow = {
  ts?: string;
  day_utc?: string;
  platform?: string;
  market_id?: string;
  market_title?: string;
  risk_score?: number | null;
  raw_risk?: number | null;
  anomaly_score?: number | null;
  p_informed?: number | null;
  info_susceptibility_score?: number | null;
  info_susceptibility_bucket?: string;
  info_susceptibility_reasons?: string;
  band?: string;
  quota_fill?: number | null;
  price?: number | null;
  trade_size?: number | null;
  time_to_resolution_hours?: number | null;
  top_features?: string;
  _window?: WindowKey;
  _source_file?: string;
  _file_updated_at?: string;
  _served_at?: string;
};
