import { NextResponse } from "next/server";
import { getPortfolioApi } from "@/lib/kalshi-server";

export async function GET() {
  try {
    const portfolioApi = getPortfolioApi();
    const response = await portfolioApi.getFills(undefined, undefined, undefined, undefined, 100);
    return NextResponse.json(response.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch fills";
    const status = message.includes("Missing API key") || message.includes("Missing private key") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
