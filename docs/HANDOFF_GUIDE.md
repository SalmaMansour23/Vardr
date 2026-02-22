# ML Insider Risk System: Technical Handoff Guide

## 1) What this system does
This backend ingests Kalshi + Polymarket market/trade data, builds a unified event table, trains models, and scores each trade with insider-risk signals.

Pipeline order:
1. `ingest`
2. `build`
3. `train`
4. `score`

Primary output artifacts:
- `artifacts/latest/meta.json`
- `artifacts/latest/anomaly_*.pkl`
- `artifacts/latest/supervised_model.pkl` (when supervised training succeeds)
- `artifacts/latest/feature_importance_gain.csv`
- `artifacts/latest/shap_top.csv` (optional)
- `reports/suspicious_24h.csv`
- `reports/suspicious_7d.csv`
- `reports/suspicious_30d.csv`
- `reports/suspicious_all.csv`

## 2) How to export this to GitHub (safe handoff)
Current workspace note: this folder is not currently a git repo (`git rev-parse` returns `no-git`).

### Step-by-step
1. Initialize git and set default branch:

```bash
cd /Users/timothylawrence/mlmodeltest
git init
git branch -M main
```

2. Create remote repo in GitHub UI (empty repo, no README/license if you want clean push), then add remote:

```bash
git remote add origin git@github.com:<YOUR_ORG_OR_USER>/<REPO_NAME>.git
# or HTTPS:
# git remote add origin https://github.com/<YOUR_ORG_OR_USER>/<REPO_NAME>.git
```

3. Security preflight before first commit:

```bash
# inspect candidate files
git status --short

# verify secrets are excluded
rg -n "KALSHI|PRIVATE KEY|BEGIN RSA|ACCESS_KEY|proxywallet" .
```

4. Ensure these are ignored before commit:
- `.venv/`
- `APIKey.txt`
- `.kalshi_access_key`
- `.kalshi.key`
- `data/raw/`, `data/processed/`
- `artifacts/latest/`
- `reports/`

5. First commit:

```bash
git add .
git commit -m "Initial backend for insider-risk scoring"
git push -u origin main
```

6. Recommended release/handoff tags:

```bash
git tag -a v1.0-handoff -m "Backend handoff to full-stack"
git push origin v1.0-handoff
```

### Suggested handoff package to full-stack team
- Repo URL + tag (`v1.0-handoff`)
- Latest `artifacts/latest/meta.json`
- Latest `reports/suspicious_24h.csv`
- This document (`docs/HANDOFF_GUIDE.md`)

## 3) Repository map (what each file/folder is)

### Root
- `README.md`: quick setup/run + high-level output contract.
- `requirements.txt`: runtime dependencies.
- `pytest.ini`: pytest config.
- `scripts/debug_polymarket_trades.py`: one-off API debugging helper.
- `tests/`: lightweight tests for CLI and feature builder.
- `data/`: raw and processed parquet datasets (ignored in git).
- `artifacts/`: trained model artifacts + metrics metadata (ignored in git).
- `reports/`: scored CSV outputs and tuning logs (ignored in git).
- `docs/HANDOFF_GUIDE.md`: this handoff spec.

### Package: `ml_insider/`
- `ml_insider/cli.py`: CLI entrypoint (`ingest`, `build`, `train`, `score`, `report`, `run-all`).

#### `ml_insider/ingest/`
- `run_ingest.py`: orchestration of all ingest sources.
- `polymarket.py`: pulls Gamma `/events`, flattens `event.markets` into `polymarket_markets.parquet`.
- `polymarket_trades.py`: pulls Data API `/trades` (event-based first), saves `polymarket_trades.parquet`.
- `kalshi.py`: pulls Kalshi markets + trades with RSA-signed API calls.
- `kalshi_auth.py`: request signing (`RSA-PSS SHA256`).
- `secrets.py`: secure credential resolution for Kalshi key id + private key.
- `polysights.py`: optional Playwright scrape of Polysights table.

#### `ml_insider/build/`
- `make_events.py`: writes unified `data/processed/events.parquet`.
- `features.py`: schema normalization, joins, feature engineering, and build-time validation checks.

#### `ml_insider/modeling/`
- `anomaly.py`: IsolationForest anomaly model and artifact I/O.
- `pseudo_labels.py`: Polymarket wallet-based pseudo labeling.
- `supervised.py`: supervised model training/prediction (LightGBM + calibration, fallback model).
- `train.py`: train orchestration, metrics, thresholds, artifact writes, tuning logs.
- `score.py`: scoring pipeline, contextual adjustments, banding, report CSV generation.
- `contextual_adjustments.py`: market crowding penalty.
- `metrics.py`: validation metrics and meta file I/O.
- `explain.py`: LightGBM gain importance + optional SHAP output.
- `report.py`: generates `reports/model_report.md`.
- `polysights_model.py`: optional separate model for Polysights scraped data.

#### `ml_insider/context/`
- `leak_plausibility.py`: market-level information susceptibility scoring rules.
- `plausibility_audit.py`: counterfactual audit for concentration/bias checks.

#### `ml_insider/config/`
- `profiles.py`: profile loader utility for env mappings (note: CLI currently does not expose `--profile` flag).

## 4) End-to-end data flow

### Stage 1: Ingest
Input: external APIs (Kalshi + Polymarket + optional Polysights).
Output files (raw):
- `data/raw/kalshi_markets.parquet`
- `data/raw/kalshi_trades.parquet`
- `data/raw/polymarket_markets.parquet`
- `data/raw/polymarket_trades.parquet`
- `data/raw/polysights.parquet` (optional)

Important fix already implemented:
- Polymarket markets ingestion now uses Gamma `/events` and flattens nested `event.markets` so conditionId joins match trade data.

### Stage 2: Build
Input: raw parquet files.
Output:
- `data/processed/events.parquet` (canonical table used for train/score).

Critical validation at build time:
- If Polymarket `time_to_resolution_hours` is missing for >10% of rows after markets join, build raises a hard error instructing re-ingest.

### Stage 3: Train
1. Always trains anomaly model.
2. Tries supervised mode:
- first with ground-truth `flagged` (if available)
- otherwise with pseudo labels (`pseudo_flagged`) from wallet behavior.
3. Writes metrics/thresholds to `meta.json`.
4. Writes explainability artifacts if supervised succeeds.

### Stage 4: Score
1. Loads artifacts + events table.
2. Computes `anomaly_score` and optional `p_informed`.
3. Computes `raw_risk`.
4. Applies information susceptibility score and market crowding penalty to get final `risk_score`.
5. Applies thresholds to assign `LOW/WATCHLIST/INVESTIGATE`.
6. Writes suspicious CSVs (24h/7d/30d/all + market rollups).

## 5) Inputs and required fields

### Required canonical fields in `events.parquet`
- `ts`
- `platform`
- `market_id`
- `price`
- `trade_size`
- `time_to_resolution_hours`
- `liquidity_impact`
- `flagged`

### Source field expectations
Kalshi:
- trades: `created_time`, `ticker`, `count`, `yes_price`/`yes_price_dollars`
- markets: `ticker`, `close_time`, `liquidity_dollars`/`liquidity`

Polymarket:
- trades: `timestamp`, `conditionid`/`condition_id`, `size`, `price`
- markets: `conditionid`/`id`, `enddate`/`closedtime`, `liquiditynum`/`liquidity`

## 6) Features (definitions)

### Canonical numerical features
1. `price`
- Trade price normalized to [0,1] when available.

2. `trade_size`
- Trade quantity/size from source API.

3. `time_to_resolution_hours`
- Formula: `(market_end_ts - trade_ts) / 3600`.

4. `liquidity_impact`
- Formula: `trade_size / (liquidity + 1)`.

### Derived features
5. `trade_size_log`
- Formula: `log1p(max(trade_size, 0))`.

6. `price_distance_from_50`
- Formula: `abs(price - 0.5)`.

7. `time_to_resolution_bucket`
- `0` if `time_to_resolution_hours <= 24`
- `1` if `24 < time_to_resolution_hours <= 168`
- `2` otherwise (including missing fallback behavior in feature build path).

8. `z_score_trade_size`
- Computed within each `(platform, market_id)` group:
- Formula: `(trade_size - mean_group_trade_size) / std_group_trade_size`
- If group std is 0, value set to `0.0`.

### Optional supervised-only extras (disabled unless env enabled)
When `ML_INSIDER_USE_EXTRA_STRUCTURAL_FEATURES=1`:
- `size_percentile_market`: percentile rank of `trade_size` within `(platform, market_id)`.
- `impact_percentile_market`: percentile rank of `liquidity_impact` within `(platform, market_id)`.
- `timing_percentile_market`: percentile rank of `-time_to_resolution_hours` within `(platform, market_id)`.
- `trade_count_5m_z`: z-score of rolling 5-minute trade count per market.
- `trade_count_15m_z`: z-score of rolling 15-minute trade count per market.

## 7) Models and score formulas

## Model 1: Anomaly model (IsolationForest)
Implementation: `ml_insider/modeling/anomaly.py`

Inputs (strict):
- `z_score_trade_size`
- `liquidity_impact`
- `time_to_resolution_hours`
- `price_distance_from_50`
- `trade_size_log`

Preprocess:
- `SimpleImputer(strategy="median")`

Model:
- `IsolationForest(contamination=0.01, random_state=42)`

Output:
- Raw: `decision_function(X)`
- Converted to anomaly risk via min-max scaling on `-decision_function(X)` and clipped to [0,1].
- Final field: `anomaly_score`.

## Pseudo-labeling (when no ground-truth positives)
Implementation: `ml_insider/modeling/pseudo_labels.py`

Wallet id candidates:
- `api_trade_proxywallet` (preferred)
- fallback wallet columns if present.

Per-trade suspicion components:
- `timing_risk = 1 / (max(time_to_resolution_hours, 0) + 1)`
- `size_risk = max(z_score_trade_size, 0)`
- `impact_risk = max(liquidity_impact, 0)`
- `distance_risk = max(price_distance_from_50, 0)`

Per-trade suspicion score:
- `trade_suspicion = 0.40*size_risk + 0.25*timing_risk + 0.20*impact_risk + 0.15*distance_risk`

Wallet score (default tail mode):
- `wallet_score = 0.45*p99 + 0.25*p95 + 0.10*p90 + 0.15*timing_p95 + 0.05*timing_mean`

Selection:
- keep wallets with `n_trades >= min_trades_per_wallet`
- select top `suspicious_top_pct`
- label all Polymarket rows from selected wallets as `pseudo_flagged=1`, else 0.

## Model 2: Supervised model (PU-style)
Implementation: `ml_insider/modeling/supervised.py`

Train/val/test split (time-based):
- Earliest 80% -> train pool
- Latest 20% -> test
- From train pool, latest 20% -> validation

Inputs:
- Structural features + `anomaly_score`
- No wallet-specific columns are fed into model inputs.

Weights:
- Sample weights by label:
- positive: `weight_positive` (runtime configurable)
- negative: `1.0`

Base model:
- LightGBM (`LGBMClassifier`) if available/safe
- fallback: `GradientBoostingClassifier`

Calibration:
- `CalibratedClassifierCV(..., method=isotonic or sigmoid, cv='prefit')`

Output:
- `p_informed = calibrated_model.predict_proba(X)[:,1]`

## Raw risk formula
If supervised exists:
- `raw_risk = 0.65 * p_informed + 0.35 * anomaly_score`

If supervised missing:
- `raw_risk = anomaly_score`

## Information susceptibility / leak plausibility
Implementation: `ml_insider/context/leak_plausibility.py`

Per-market score in [0,1]: `info_susceptibility_score`

Base factors:
1. Horizon factor:
- `>720h: 0.10`
- `168-720h: 0.30`
- `72-168h: 0.60`
- `<=72h: 1.00`
- missing: `0.50` + reason `missing_time_to_resolution`

2. Keyword factor starts at `0.50`, then adjusted by rule hits.

3. Downweights:
- long-horizon nomination/election terms with year >= 2027 -> floor to 0.05
- speculative price-target markets -> cap at 0.30 unless discrete catalyst terms present
- long-horizon regime/collapse terms -> cap at 0.25

4. Upweight/floor logic for discrete institutional events (decision + institution terms), geopolitics, fed-policy, award decisions, executive-policy events.

5. Anti-overfit guardrail:
- Max uplift over base score is capped by `ML_INSIDER_PLAUSIBILITY_MAX_RULE_UPLIFT` (default profile-dependent).

Score combine:
- `base_plausibility = clip(horizon_factor * keyword_factor, 0, 1)`
- then floor/cap rules -> final `info_susceptibility_score`
- bucket:
  - `<0.20`: `LOW`
  - `0.20-0.60`: `MED`
  - `>0.60`: `HIGH`

Auditability fields:
- `info_susceptibility_reasons` (JSON string list)
- `info_susceptibility_bucket`

## Market crowding penalty
Implementation: `ml_insider/modeling/contextual_adjustments.py`

After contextual plausibility:
- `context_risk = raw_risk * info_susceptibility_score`

Within each `(platform, market_id)`, rank rows by descending risk (`rank=0` highest).

Multiplier:
- `market_crowding_multiplier = 1 / (1 + alpha * rank)`

Final score:
- `risk_score = context_risk * market_crowding_multiplier`

`alpha` from env: `ML_INSIDER_MARKET_CROWDING_ALPHA`.

## Band assignment
In score stage:
- initialize `band = LOW`
- if `risk_score >= watchlist_threshold`: `WATCHLIST`
- if `risk_score >= investigate_threshold`: `INVESTIGATE`

Optional quota fill (`ML_INSIDER_MIN_FLAGGED_PER_DAY > 0`):
- if daily flagged count is below target, promote highest remaining `LOW` rows to `WATCHLIST_QUOTA`.

## 8) Validation metrics and thresholds
Metrics computed on validation split:
- PR-AUC
- Brier score
- Precision@50
- Precision@200
- Recall@80% precision
- Recall@90% precision
- Contextual ranking metrics: Precision@50/200 using contextual risk

Current thresholding in train pipeline:
- Uses validation contextual risk percentile cutoffs from env:
- `investigate_threshold = percentile(risk_val, ML_INSIDER_INVESTIGATE_PERCENTILE)`
- `watchlist_threshold = percentile(risk_val, ML_INSIDER_WATCHLIST_PERCENTILE)`

Thresholds and metrics are persisted to:
- `artifacts/latest/meta.json`

## 9) Output contracts

### Trade-level CSV columns (`reports/suspicious_*.csv`)
1. `ts`: trade timestamp (UTC parseable)
2. `platform`: `kalshi` or `polymarket`
3. `market_id`: canonical market identifier
4. `market_title`: title/question
5. `price`
6. `trade_size`
7. `time_to_resolution_hours`
8. `time_to_resolution_bucket`
9. `liquidity_impact`
10. `z_score_trade_size`
11. `price_distance_from_50`
12. `trade_size_log`
13. `anomaly_score`
14. `p_informed` (NaN when supervised unavailable)
15. `raw_risk`
16. `info_susceptibility_score`
17. `info_susceptibility_bucket`
18. `info_susceptibility_reasons` (JSON array string)
19. `market_crowding_multiplier`
20. `risk_score` (final score used for banding)
21. `band`
22. `quota_fill` (1 if watchlist quota promotion)
23. `flagged` (ground truth if present)
24. `pseudo_flagged` (pseudo label used in training)
25. `wallet` (coalesced wallet identifier)
26. `source_trade_id` (coalesced source id)

### Market-level rollup CSV columns (`reports/suspicious_*_markets.csv`)
- `platform`
- `market_id`
- `latest_ts`
- `market_trade_count`
- `investigate_trade_count`
- `watchlist_trade_count`
- `max_raw_risk`
- `max_risk_score`
- `mean_risk_score`
- `market_title`
- `market_band`
- `info_susceptibility_score`
- `info_susceptibility_bucket`
- `info_susceptibility_reasons`

## 10) Libraries and frameworks used
Core:
- `pandas`
- `numpy`
- `scikit-learn`
- `lightgbm`
- `pyarrow`
- `requests`
- `cryptography`

Optional:
- `shap` (explainability)
- `playwright` + `beautifulsoup4` (Polysights scraping)
- `pytest` (tests)

## 11) Key runtime knobs (env vars)

Pseudo-labeling + supervised:
- `ML_INSIDER_PSEUDO_TOP_PCT`
- `ML_INSIDER_PSEUDO_MIN_TRADES`
- `ML_INSIDER_PSEUDO_SCORE_RECENT_DAYS`
- `ML_INSIDER_PSEUDO_SCORE_MAX_TTR_HOURS`
- `ML_INSIDER_PSEUDO_WALLET_SCORE_MODE`
- `ML_INSIDER_PSEUDO_MIN_LATE_SHARE_24H`
- `ML_INSIDER_SUPERVISED_WEIGHT_POSITIVE`
- `ML_INSIDER_SUPERVISED_PLATFORM_SCOPE`
- `ML_INSIDER_CALIBRATION_METHOD`

Thresholds and scoring behavior:
- `ML_INSIDER_INVESTIGATE_PERCENTILE`
- `ML_INSIDER_WATCHLIST_PERCENTILE`
- `ML_INSIDER_MIN_FLAGGED_PER_DAY`
- `ML_INSIDER_MARKET_CROWDING_ALPHA`
- `ML_INSIDER_PLAUSIBILITY_PROFILE`
- `ML_INSIDER_PLAUSIBILITY_MAX_RULE_UPLIFT`

LightGBM params:
- `ML_INSIDER_LGBM_N_ESTIMATORS`
- `ML_INSIDER_LGBM_LEARNING_RATE`
- `ML_INSIDER_LGBM_MAX_DEPTH`
- `ML_INSIDER_LGBM_NUM_LEAVES`
- `ML_INSIDER_LGBM_MIN_DATA_IN_LEAF`
- `ML_INSIDER_LGBM_REG_LAMBDA`
- `ML_INSIDER_LGBM_REG_ALPHA`
- `ML_INSIDER_LGBM_MIN_GAIN_TO_SPLIT`

Ingest knobs:
- `POLYMARKET_TRADES_NO_CUTOFF`
- `POLYMARKET_FALLBACK_MAX_MARKETS`
- `POLYMARKET_FALLBACK_MAX_CONSECUTIVE_ERRORS`
- `KALSHI_MARKETS_PAGE_SIZE`
- `KALSHI_MARKETS_MAX_PAGES`
- `KALSHI_MARKETS_MAX`
- `KALSHI_TRADES_MAX_PAGES`
- `KALSHI_SAVE_RAW_JSON`

## 12) Guidance by team

### Frontend team
- Treat `risk_score` as the final ranking score.
- Use `raw_risk` + susceptibility fields for explainability UI.
- Show `info_susceptibility_reasons` as an expandable JSON reasons list.
- Prefer market-level page using `suspicious_*_markets.csv` and drill down to trade-level rows.

### Full-stack team
- Wrap pipeline as async jobs (ingest/build/train/score).
- Persist historical snapshots of `meta.json` and suspicious CSV outputs.
- Add API endpoints:
  - `/alerts?window=24h|7d|30d`
  - `/markets?window=24h`
  - `/meta/latest`
- Add observability:
  - runtime per stage
  - rows ingested/built/scored
  - threshold values and band counts

### ML engineer
- Validate pseudo-label quality regularly (wallet counts, positives, class balance).
- Track drift in `meta.json` across runs.
- Watch concentration risk via `reports/plausibility_audit_summary.json` and `plausibility_counterfactual_top.csv`.
- Keep train/score settings versioned via env snapshots or config profiles.

### Pitching team
Use this narrative:
1. Multi-source ingestion (Kalshi + Polymarket)
2. Two-model risk stack:
- structural anomaly detection
- supervised informed-trade likelihood
3. Contextual intelligence layer:
- market leak-plausibility scoring
- market crowding de-duplication
4. Actionable outputs:
- explainable alert bands
- per-trade and per-market audit trails

## 13) Known caveats
- No online serving API is included; output is batch CSV/artifact based.
- `ml_insider/config/profiles.py` exists, but CLI currently does not expose `--profile`.
- Supervised model quality depends on pseudo-label quality when no ground truth labels exist.
- Global/system Python may fail with NumPy/Pandas mismatch; use `.venv/bin/python` for project commands.

## 14) Quick command cookbook
Run all:

```bash
cd /Users/timothylawrence/mlmodeltest
.venv/bin/python -m ml_insider.cli run-all
```

Run stage-by-stage:

```bash
.venv/bin/python -m ml_insider.cli ingest
.venv/bin/python -m ml_insider.cli build
.venv/bin/python -m ml_insider.cli train
.venv/bin/python -m ml_insider.cli score
```

Generate human-readable model report:

```bash
.venv/bin/python -m ml_insider.cli report
```
