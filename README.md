# DriftX

Market integrity risk dashboard for prediction markets. DriftX monitors information asymmetry, detects potential information leaks around market events (e.g. CPI releases), and surfaces risk via AI-powered signal analysis, causal graphs, and live Kalshi integration.

## Tech stack

- **Framework:** Next.js 15 (Turbopack), React 19, TypeScript
- **UI:** Tailwind CSS, Radix UI, Lucide icons, Recharts, React Flow
- **AI:** Genkit (Google AI / Gemini), Open Router (agent models for expert panel and adversarial simulation using Nemotron)
- **Data:** Firebase, Kalshi Trade API (elections)

## Features

- **Intelligence dashboard:** Probability charts, information propagation analysis, anomaly breakdown, trader network graph, social signal panel, timeline risk (AI-classified posts and timeline analysis)
- **Advanced AI:** Causal network graph, cross-event correlation, adversarial strategy simulation, expert panel consensus (run after "Simulate Information Leak")
- **Market activity:** Trade table, high-risk accounts, trader intelligence overlay
- **Kalshi Live:** Live trades stream and Kalshi integration (trades, orders, fills, portfolio) when credentials are set
- **Global overview:** Multi-contract market overview

## Feature configuration

Behavior and thresholds are configurable so you can tune detection and UI without changing code.

- **Server (API routes):** `app/lib/feature-config.ts` – stream poll interval and max seen IDs, adversarial simulation time windows and thresholds, account risk profile windows and risk weights. Optional env overrides: `KALSHI_POLL_INTERVAL_MS`, `KALSHI_MAX_SEEN_IDS`, `ADVERSARIAL_SIMILARITY_THRESHOLD`, `RISK_WEIGHT_*`, `KALSHI_API_BASE_URL`, etc. (see `.env.local.example`).
- **Contracts and scenario:** `src/lib/data-generator.ts` – `CONTRACT_CONFIG` (contract list, Kalshi tickers, event keywords, related events), demo timing constants, risk formula weights. Scenario (drift/announcement times, signal-trace event type) is derived from the active contract.
- **UI risk display:** `src/lib/ui-thresholds.ts` – adversarial similarity badge threshold, causal graph edge weight cutoffs, social signal confidence threshold.
- **API base URLs:** Set `OPEN_ROUTER_BASE_URL` and/or `KALSHI_API_BASE_URL` in `.env.local` to point at a proxy or staging endpoint.

## Project structure

- `src/app/` – Next.js app router: `page.tsx` (main DriftX dashboard), `layout.tsx`, `globals.css`
- `src/app/api/kalshi/` – Kalshi proxy API routes: trades, trades/stream, orders, fills, portfolio
- `app/api/` – AI API routes: `classify-post`, `analyze-timeline`, `generate-causal-graph`, `cross-event-analysis`, `adversarial-simulation`, `expert-panel`
- `src/components/dashboard/` – Dashboard UI: ProbabilityChart, TraderNetworkGraph, SocialSignalPanel, TimelineRiskPanel, CausalGraphVisualizer, LiveKalshiTrades, TradeTable, MarketOverview, etc.
- `src/components/ui/` – Shared UI primitives (Radix-based)
- `src/lib/` – Data generation, Kalshi client, public signals, utils
- `src/hooks/` – `use-signal-trace` (AI classification + timeline), `use-mobile`, `use-toast`
- `src/ai/` – Genkit setup (`genkit.ts`, `dev.ts`)

## Getting started

1. **Install and run**

   ```bash
   npm install
   npm run dev
   ```

   App runs at [http://localhost:9002](http://localhost:9002).

2. **Kalshi**

   Copy `.env.local.example` to `.env.local` and set:

   - `KALSHI_API_KEY`
   - `KALSHI_PRIVATE_KEY_PATH` or `KALSHI_PRIVATE_KEY_PEM`

   Get credentials from [Kalshi API](https://kalshi.com/account/api).

3. **Advanced AI (expert panel, adversarial simulation)**

   In `.env.local` set `OPEN_ROUTER_API_KEY` from [Open Router](https://openrouter.ai/keys). Set `OPEN_ROUTER_AGENT_MODEL` (default: `nvidia/nemotron-3-nano-30b-a3b`) if you want a different model.

## Scripts

- `npm run dev` – Next.js dev server (Turbopack, port 9002)
- `npm run genkit:dev` – Genkit dev server with `src/ai/dev.ts`
- `npm run genkit:watch` – Genkit with watch mode
- `npm run build` – Production build
- `npm run start` – Production server
- `npm run lint` – Next lint
- `npm run typecheck` – `tsc --noEmit`

## Flagged Bets feed (new lightweight stack)

This repo now includes a lightweight backend + frontend pair for insider-risk flagged bets:

- `api/` – FastAPI service that serves suspicious feed rows from CSVs
- `web/` – Next.js (App Router + TypeScript + Tailwind) UI for flagged bets

### 1) Run API (FastAPI)

```bash
cd /Users/timothylawrence/mlmodeltest
.venv/bin/pip install -r api/requirements.txt
.venv/bin/uvicorn api.main:app --reload --port 8000
```

API endpoint:

- `GET /api/suspicious?window=24h|7d|30d&band=INVESTIGATE|WATCHLIST|LOW|ALL&limit=1000`

Example:

```bash
curl "http://localhost:8000/api/suspicious?window=24h&band=ALL&limit=200"
```

CSV inputs read per request:

- `reports/suspicious_24h.csv`
- `reports/suspicious_7d.csv`
- `reports/suspicious_30d.csv`

### 2) Run web UI (Next.js)

```bash
cd /Users/timothylawrence/mlmodeltest/web
npm install
npm run dev
```

UI runs at [http://localhost:3001](http://localhost:3001).

### 3) Environment variables for web

Create `web/.env.local` (or export env vars) with:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
REFRESH_SECONDS=60
AI_INTEL_BASE_URL=https://your-ai-tool-url
```

Notes:

- `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:8000`
- `REFRESH_SECONDS` defaults to `60`
- `AI_INTEL_BASE_URL` is used to build the “Open AI intelligence tool” row link
