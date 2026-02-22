# DriftX v3.0 - Real-Time Kalshi Surveillance Dashboard

## 🔍 Data Source & Real-Time Updates

### Current Status: **TRANSITIONING FROM MOCK TO REAL DATA**

## 📊 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER OPENS DASHBOARD                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         Frontend: SystemicRiskAnalysis.tsx Component             │
│         - Fetches data every 30 seconds (auto-refresh)          │
│         - Manual refresh button available                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend: /api/analyze-all-markets                   │
│              - Orchestrates full analysis pipeline               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         Step 1: Fetch Real-Time Markets from Kalshi              │
│         GET /api/kalshi/markets?status=active&limit=20          │
│                                                                  │
│         Authentication: RSA-signed requests using:               │
│         - KALSHI_API_KEY (from .env.local)                      │
│         - RSA Private Key (from rsa.txt)                        │
│         - kalshi-typescript SDK handles signing                  │
│                                                                  │
│         Returns: List of active markets with:                    │
│         - Ticker, Title, Status                                  │
│         - Current price (YES/NO bid/ask)                        │
│         - Volume, Open Interest, Liquidity                       │
│                                                                  │
│         FALLBACK: If authentication fails → generateMockMarkets()│
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│       Step 2: Fetch Real-Time Trades for Each Market            │
│       For each market ticker:                                    │
│       GET /api/kalshi/market/[ticker]/trades?limit=500          │
│                                                                  │
│       Returns: Recent 500 trades with:                           │
│       - Timestamp, Price, Size                                   │
│       - Side (YES/NO)                                           │
│       - Trade ID                                                │
│                                                                  │
│       FALLBACK: If API fails → generateMockTrades()             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│          Step 3: Compute Statistical Stress Metrics              │
│          lib/computeMarketStress.ts                              │
│                                                                  │
│          Calculates (on real or mock data):                      │
│          • Price Volatility (std dev of returns)                 │
│          • Order Imbalance (YES vs NO ratio)                    │
│          • Volume Spike Detection                                │
│          • Liquidity Stress (bid-ask spread)                    │
│          • Price Acceleration (2nd derivative)                   │
│          • Composite Score (0-100 normalized)                    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│          Step 4: AI Analysis with Nemotron 70B                   │
│          POST /api/market-health                                 │
│                                                                  │
│          Sends to NVIDIA API:                                    │
│          - Market metadata + stress metrics + trade summary      │
│                                                                  │
│          AI Returns:                                             │
│          - Market State: Stable/Elevated/Stress/Shock/Breakdown  │
│          - Confidence Level (0-1)                                │
│          - Reasoning (natural language explanation)              │
│                                                                  │
│          FALLBACK: Rule-based classification if AI fails         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│        Step 5: Cross-Market Systemic Risk Analysis               │
│        POST /api/cross-market-correlation                        │
│                                                                  │
│        Computes:                                                 │
│        • Price correlation matrix (Pearson coefficients)         │
│        • Lead-lag relationships (time-series cross-correlation)  │
│        • Stress clustering (group by severity)                   │
│                                                                  │
│        AI Analyzes:                                              │
│        • Contagion Risk Level (Low → Critical)                  │
│        • Leading Markets (driving system stress)                 │
│        • Systemic Clusters (interconnected groups)               │
│                                                                  │
│        FALLBACK: Rule-based risk assessment if AI fails          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Display Results in UI                          │
│                                                                  │
│   Tab 6: Market Stress Analysis                                 │
│   - Stats: Total/Stable/High Stress/Critical counts             │
│   - Grid: Each market with stress bar, state, confidence        │
│   - Auto-refresh: Every 30 seconds                              │
│                                                                  │
│   Tab 7: Systemic Risk Analysis                                 │
│   - Contagion Risk Meter (color-coded gauge)                    │
│   - Leading Markets list                                        │
│   - Stress Clusters breakdown                                   │
│   - AI Reasoning explanation                                    │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Features Implemented

### **Tab 6: Market Stress Analysis**
**Purpose:** Real-time monitoring of individual market health using AI classification

**Data Source:** 
- **Trying:** Real Kalshi markets + trades via authenticated API
- **Currently:** Mock data (due to authentication issues)

**Features:**
1. **Stats Cards:**
   - Total Markets Analyzed
   - Stable Markets Count
   - High Stress Markets Count  
   - Critical Markets Count

2. **Market Grid (20 markets):**
   - Market ticker + full title
   - Composite stress score (0-100 bar)
   - AI state classification with color coding:
     - 🟢 **Stable** (0-30): Normal market conditions
     - 🟡 **Elevated** (30-50): Increased volatility
     - 🟠 **Stress** (50-70): High unusual activity
     - 🔴 **Shock** (70-85): Extreme price movements
     - ⚫ **Breakdown** (85-100): Total market dysfunction
   - Confidence level percentage

3. **Refresh Button:** Manual re-fetch and re-analysis

**Update Frequency:** Auto-refreshes every 30 seconds

---

### **Tab 7: Systemic Risk Analysis**
**Purpose:** Cross-market contagion risk and interconnection analysis

**Data Source:**
- **Trying:** Real Kalshi markets + trades
 - **Currently:** Mock data (authentication issues)

**Features:**
1. **Contagion Risk Meter:**
   - Overall system risk level:
     - 🟢 **Low**: Isolated stress
     - 🟡 **Moderate**: Some correlations
     - 🟠 **Elevated**: Multiple clusters affected
     - 🔴 **High**: Widespread contagion
     - ⚫ **Critical**: System-wide breakdown
   
2. **Leading Markets:**
   - Top 5 markets driving system stress
   - Markets with highest stress scores
   - Potential contagion sources

3. **Stress Clusters:**
   - Markets grouped by severity:
     - Critical Stress (70+)
     - High Stress (40-69)
     - Moderate Stress (20-39)
     - Low Stress (<20)
   
4. **AI Reasoning:**
   - Natural language explanation from Nemotron
   - Identifies correlation patterns
   - Explains contagion pathways

**Update Frequency:** Auto-refreshes every 30 seconds

---

## ⚠️ Current Authentication Issue

### The Problem:
The dashboard is **currently displaying mock data** because Kalshi API authentication is failing with **401 Unauthorized** errors.

### Why It's Failing:
Kalshi recently migrated their API and now requires **RSA-signed authentication** instead of simple Bearer tokens.

### What Was Changed:
✅ Updated API endpoints from `trading-api.kalshi.com` → `api.elections.kalshi.com`  
✅ Installed `kalshi-typescript` SDK for proper authentication  
✅ Created `lib/kalshi-client.ts` with RSA key signing  
✅ Updated `/api/kalshi/markets` to use TypeScript SDK  
✅ Updated `/api/kalshi/market/[ticker]/trades` to use TypeScript SDK  
✅ Added fallback mock data generators for graceful degradation  

### What You Need to Do:

#### **Option 1: Get New API Credentials (Recommended)**
1. Go to https://kalshi.com/
2. Sign in to your account
3. Navigate to **API Settings** or **Developer Settings**
4. Generate new API credentials compatible with the new authentication system
5. Update `.env.local`:
   ```bash
   KALSHI_API_KEY=your_new_api_key_here
   KALSHI_PRIVATE_KEY_PATH=./rsa.txt
   ```
6. Ensure `rsa.txt` contains your valid RSA private key (already exists)
7. Restart the server: `npm run dev`

#### **Option 2: Verify Existing Credentials**
Your current `.env.local` has:
```bash
KALSHI_API_KEY=cad2a36f-bae5-4b9f-8f3f-be7ca67799a4
```

This key may be:
- Expired
- Invalid format for new API
- Missing required permissions

Test it manually:
```bash
curl -X POST https://api.elections.kalshi.com/trade-api/v2/login \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your_key", "signature": "..."}'
```

---

## 🔧 How Real-Time Updates Work

### Continuous Data Flow:
```
User Dashboard → Auto-refresh Timer (30s) → API Calls → Kalshi API
                       ↓                                    ↓
                 Display Updates  ← AI Analysis ← Stress Metrics
```

### Performance Optimizations:
- ✅ **Caching**: API responses cached for 60s (markets) / 10s (trades)
- ✅ **Incremental Loading**: Stats calculated progressively
- ✅ **Parallel Fetching**: Multiple market trades fetched simultaneously
- ✅ **Graceful Degradation**: Falls back to mock data instead of crashing

### What Happens When Real Data Flows:
1. **Every 30 seconds**, frontend calls `/api/analyze-all-markets`
2. Backend fetches **latest 20 active markets** from Kalshi
3. For each market, fetches **last 500 trades** (real-time order flow)
4. Computes stress metrics on **actual price movements and volume**
5. Nemotron AI analyzes **real microstructure data** for manipulation patterns
6. Cross-correlation detects **real contagion** between markets
7. Dashboard updates with **live risk assessment**

---

## 📈 Statistical Metrics Explained

### Individual Market Metrics:
- **Volatility**: Standard deviation of price changes → detects stability
- **Imbalance**: YES vs NO order flow ratio → detects directional pressure
- **Volume Spike**: Current vs historical volume → detects unusual activity
- **Liquidity Stress**: Bid-ask spread widening → detects market depth issues
- **Price Acceleration**: Rate of price change increase → detects momentum shifts

### Systemic Risk Metrics:
- **Correlation Matrix**: How markets move together → identifies clusters
- **Lead-Lag Analysis**: Which markets lead others → finds information flow
- **Contagion Channels**: How stress propagates → maps risk transmission

---

## 🚀 Next Steps

### To Activate Real-Time Data:
1. **Fix Kalshi Authentication** (see authentication section above)
2. **Verify API Connection:**
   ```bash
   npm run dev
   # Check console for "Successfully authenticated with Kalshi"
   ```
3. **Monitor Dashboard:** Open http://localhost:9002
4. **Watch Console:** Should see "Analyzing X real markets" (not "Using fallback mock markets")

### To Customize Update Frequency:
Edit [components/dashboard/SystemicRiskAnalysis.tsx](components/dashboard/SystemicRiskAnalysis.tsx):
```typescript
useEffect(() => {
  fetchSystemicRisk();
  const interval = setInterval(fetchSystemicRisk, 30000); // Change 30000 to desired ms
  return () => clearInterval(interval);
}, []);
```

---

## 📝 Summary

| Feature | Status | Data Source | AI Model |
|---------|--------|-------------|----------|
| Market Stress Analysis | ✅ Working | Mock (should be real) | Nemotron 70B |
| Systemic Risk Analysis | ✅ Working | Mock (should be real) | Nemotron 70B |
| Auto-Refresh | ✅ Working | Every 30s | - |
| Kalshi Authentication | ⚠️ **BROKEN** | Needs fixing | - |
| Fallback Gracefully | ✅ Working | Mock data | Rule-based |

**Bottom Line:** The dashboard is **fully functional** but using **mock data** until you fix the Kalshi API authentication. Once authenticated, it will automatically start analyzing **real-time prediction market data** from Kalshi with AI-powered surveillance every 30 seconds.
