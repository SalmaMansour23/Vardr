# Vardr

Market integrity and insider-risk dashboard for prediction markets. Vardr monitors information asymmetry, detects potential information leaks around market events, and surfaces risk via the Vardr Model: ML-scored trades (Kalshi and Polymarket), AI signal analysis, and actionable flagged-bets feeds.

## Tech stack

- **Framework:** Next.js 15, React 19, TypeScript
- **UI:** Tailwind CSS, Radix UI, Lucide icons, Recharts, React Flow
- **AI:** Genkit (Google AI / Gemini), Open Router (expert panel and adversarial simulation, e.g. Nemotron)
- **Data:** Firebase, Kalshi Trade API, Polymarket (CLOB client), ML Insider pipeline (Python) for scored reports

## Features

- **Flagged Bets:** Primary feed of ML-scored suspicious trades from Kalshi and Polymarket. Filter by time window (24h / 7d / 30d), band (Investigate / Watchlist / All), and keyword search. Data is served from `reports/suspicious_*.csv` via `/api/suspicious`.
- **Risk Officer Report:** AI risk intelligence view (AiRiskIntelligencePage) for synthesized risk analysis.
- **Simulation:** Information propagation analysis, probability charts, anomaly breakdown, social signal panel, and timeline risk. Run “Simulate Information Leak” to trigger AI timeline classification and risk scoring.
- **Trader intelligence:** Drill-down into trader profiles and flag reasons from the simulation view.
- **APIs for insider risk:** Next.js routes read ML Insider outputs: `/api/insider/alerts`, `/api/insider/markets`, `/api/insider/meta` (see [docs/ML_INSIDER_APP.md](docs/ML_INSIDER_APP.md)).

## ML Insider pipeline (backend scoring)

This repo does not use a root `main.py`. The backend scoring pipeline is launched from the Python module entrypoint:

```bash
python -m ml_insider.cli run-all
```

That command ingests Kalshi and Polymarket data, builds a unified events table, trains anomaly (and optionally supervised) models, scores trades, and writes:

- `reports/suspicious_24h.csv`, `suspicious_7d.csv`, `suspicious_30d.csv`, `suspicious_all.csv`
- `reports/suspicious_*_markets.csv`
- `artifacts/latest/meta.json`

The Next.js app reads these files via the API routes above. See [docs/ML_INSIDER_APP.md](docs/ML_INSIDER_APP.md) for run order and integration details.

## Feature configuration

- **Server / API:** `app/lib/feature-config.ts` – Kalshi stream poll interval, adversarial thresholds, account risk weights. Env: `KALSHI_POLL_INTERVAL_MS`, `KALSHI_MAX_SEEN_IDS`, `ADVERSARIAL_SIMILARITY_THRESHOLD`, `KALSHI_API_BASE_URL`, etc. (see `.env.local.example`).
- **Contracts / scenario:** `src/lib/data-generator.ts` – `CONTRACT_CONFIG`, event keywords, risk formula weights.
- **UI thresholds:** `src/lib/ui-thresholds.ts` – adversarial similarity badge, causal graph cutoffs, social signal confidence.
- **API base URLs:** `OPEN_ROUTER_BASE_URL`, `KALSHI_API_BASE_URL` in `.env.local` for proxies or staging.

## Project structure

- `app/` – Next.js App Router entry: `layout.tsx` (Vardr branding, metadata), `page.tsx` (re-exports main dashboard), `globals.css`
- `app/api/` – API routes:
  - **Insider risk:** `insider/alerts`, `insider/markets`, `insider/meta` (read ML Insider CSVs and meta.json)
  - **Flagged feed:** `suspicious`, `flagged-bets-context` (suspicious trade feed for the UI)
  - **Kalshi:** `kalshi/markets`, `kalshi/market/[ticker]/trades`, `kalshi/trades`, `kalshi/trades/stream`
  - **Polymarket:** `polymarket/markets`, `polymarket/market/[conditionId]/trades`
  - **AI:** `classify-post`, `analyze-timeline`, `generate-causal-graph`, `cross-event-analysis`, `adversarial-simulation`, `expert-panel`
  - **Other:** `account-risk-profile`, `market-health`, `cross-market-correlation`, `analyze-all-polymarkets`, `analyze-all-markets`
- `app/lib/` – Shared utilities and types (e.g. `insider-types.ts`, `parse-csv.ts`, `feature-config.ts`)
- `src/app/` – Main dashboard page (`page.tsx`), layout and globals
- `src/components/dashboard/` – FlaggedBetsFeed, ProbabilityChart, AnomalyBreakdown, SocialSignalPanel, TimelineRiskPanel, TraderIntelligence, etc.
- `components/dashboard/` – AiRiskIntelligencePage, InsiderRiskPanel, and other shared dashboard components
- `src/components/ui/` – Shared UI primitives (Radix-based)
- `src/lib/` – Data generation, Kalshi client, fetch helpers, utils
- `src/hooks/` – `use-signal-trace` (AI classification and timeline), `use-mobile`, `use-toast`
- `src/ai/` – Genkit setup (`genkit.ts`, `dev.ts`)
- `ml_insider/` – Python pipeline: ingest (Kalshi + Polymarket), build (events table), train (anomaly + supervised), score (reports and artifacts)
- `api/` – Optional FastAPI service for a standalone suspicious-trades API
- `web/` – Optional standalone Next.js app for a dedicated flagged-bets UI

## Getting started

1. **Install and run**

   ```bash
   npm install
   npm run dev
   ```

   App runs at [http://localhost:9002](http://localhost:9002).

2. **Kalshi (optional)**

   Copy `.env.local.example` to `.env.local` and set:

   - `KALSHI_API_KEY`
   - `KALSHI_PRIVATE_KEY_PATH` or `KALSHI_PRIVATE_KEY_PEM`

   Credentials: [Kalshi API](https://kalshi.com/account/api).

3. **Advanced AI (optional)**

   In `.env.local` set `OPEN_ROUTER_API_KEY` from [Open Router](https://openrouter.ai/keys). Optionally set `OPEN_ROUTER_AGENT_MODEL` (default: `nvidia/nemotron-3-nano-30b-a3b`).

4. **Flagged Bets / ML Insider data**

   The Flagged Bets tab and insider APIs use CSV reports written by the ML Insider pipeline. Run the pipeline at least once from the repo root so `reports/` and `artifacts/latest/` exist (see [ML Insider pipeline](#ml-insider-pipeline-backend-scoring) and [docs/ML_INSIDER_APP.md](docs/ML_INSIDER_APP.md)).

For a local Polymarket-only pipeline that does not require Kalshi credentials, use:

```bash
python -m ml_insider.cli run-polymarket-only
```

This command ingests public Polymarket Gamma + Data API data only, builds the event table, trains models, and writes the same report CSVs.

## Scripts

- `npm run dev` – Next.js dev server (port 9002)
- `npm run genkit:dev` – Genkit dev server with `src/ai/dev.ts`
- `npm run genkit:watch` – Genkit with watch mode
- `npm run build` – Production build
- `npm run start` – Production server
- `npm run lint` – Next lint
- `npm run typecheck` – `tsc --noEmit`

## Optional: Standalone Flagged Bets API and web app

The repo includes an optional FastAPI + Next.js stack for a separate suspicious-trades API and UI:

- **API (`api/`):** FastAPI app that serves rows from the same ML Insider CSVs.

  ```bash
  pip install -r api/requirements.txt
  uvicorn api.main:app --reload --port 8000
  ```

  Endpoint: `GET /api/suspicious?window=24h|7d|30d&band=INVESTIGATE|WATCHLIST|LOW|ALL&limit=1000`

- **Web UI (`web/`):** Next.js app for a dedicated flagged-bets dashboard.

  ```bash
  cd web
  npm install
  npm run dev
  ```

  Default: [http://localhost:3001](http://localhost:3001). Set `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`), `REFRESH_SECONDS`, and optionally `AI_INTEL_BASE_URL` in `web/.env.local`.

The main Vardr app (root `npm run dev`) already includes a Flagged Bets tab that uses the Next.js route `/api/suspicious` and reads from the same `reports/` CSVs; the `api/` and `web/` setup is for a standalone deployment if needed.
