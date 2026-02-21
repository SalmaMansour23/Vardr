import { NextResponse } from "next/server";
import { getOrdersApi } from "@/lib/kalshi-server";

export async function GET() {
  try {
    const ordersApi = getOrdersApi();
    const response = await ordersApi.getOrders(undefined, undefined, undefined, undefined, undefined, 100);
    return NextResponse.json(response.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch orders";
    const status = message.includes("Missing API key") || message.includes("Missing private key") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
