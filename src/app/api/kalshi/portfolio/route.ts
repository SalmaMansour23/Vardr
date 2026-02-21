import { NextResponse } from "next/server";
import { getPortfolioApi } from "@/lib/kalshi-server";

export async function GET() {
  try {
    const portfolioApi = getPortfolioApi();
    const [balanceRes, positionsRes] = await Promise.all([
      portfolioApi.getBalance(),
      portfolioApi.getPositions(undefined, 50),
    ]);
    return NextResponse.json({
      balance: balanceRes.data,
      positions: positionsRes.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch portfolio";
    const status =
      message.includes("Missing API key") || message.includes("Missing private key") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
