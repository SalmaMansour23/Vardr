# DriftX

Market integrity risk dashboard for prediction markets. DriftX monitors information asymmetry, detects potential information leaks around market events (e.g. CPI releases), and surfaces risk via AI-powered signal analysis, causal graphs, and live Kalshi integration.

## Tech stack

- **Framework:** Next.js 15 (Turbopack), React 19, TypeScript
- **UI:** Tailwind CSS, Radix UI, Lucide icons, Recharts, React Flow
- **AI:** Genkit (Google AI / Gemini), Open Router (optional agent models for expert panel and adversarial simulation)
- **Data:** Firebase, Kalshi Trade API (elections)

## Features

- **Intelligence dashboard:** Probability charts, information propagation analysis, anomaly breakdown, trader network graph, social signal panel, timeline risk (AI-classified posts and timeline analysis)
- **Advanced AI:** Causal network graph, cross-event correlation, adversarial strategy simulation, expert panel consensus (run after "Simulate Information Leak")
- **Market activity:** Trade table, high-risk accounts, trader intelligence overlay
- **Kalshi Live:** Live trades stream and Kalshi integration (trades, orders, fills, portfolio) when credentials are set
- **Global overview:** Multi-contract market overview

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

2. **Optional: Kalshi**

   Copy `.env.local.example` to `.env.local` and set:

   - `KALSHI_API_KEY`
   - `KALSHI_PRIVATE_KEY_PATH` or `KALSHI_PRIVATE_KEY_PEM`

   Get credentials from [Kalshi API](https://kalshi.com/account/api).

3. **Optional: Advanced AI (expert panel, adversarial simulation)**

   In `.env.local` set `OPEN_ROUTER_API_KEY` from [Open Router](https://openrouter.ai/keys). Optionally set `OPEN_ROUTER_AGENT_MODEL` (default: `nvidia/nemotron-3-nano-30b-a3b`).

## Scripts

- `npm run dev` – Next.js dev server (Turbopack, port 9002)
- `npm run genkit:dev` – Genkit dev server with `src/ai/dev.ts`
- `npm run genkit:watch` – Genkit with watch mode
- `npm run build` – Production build
- `npm run start` – Production server
- `npm run lint` – Next lint
- `npm run typecheck` – `tsc --noEmit`
