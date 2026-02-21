/**
 * Server-only Kalshi API config and clients.
 * Do not import this file from client components.
 */

import { readFileSync } from "fs";
import { Configuration, OrdersApi, PortfolioApi } from "kalshi-typescript";

const BASE_PATH = "https://api.elections.kalshi.com/trade-api/v2";

function getApiKey(): string {
  const apiKey =
    process.env.API_KEY ?? process.env.KALSHI_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "Missing API key. Set API_KEY or KALSHI_API_KEY in environment or .env"
    );
  }
  return apiKey;
}

function getPrivateKey(): string {
  const pemEnv =
    process.env.PRIVATE_KEY_PEM ?? process.env.KALSHI_PRIVATE_KEY_PEM;
  if (pemEnv) {
    return pemEnv.replace(/\\n/g, "\n");
  }
  const pathEnv =
    process.env.PRIVATE_KEY_PATH ?? process.env.KALSHI_PRIVATE_KEY_PATH;
  if (pathEnv) {
    return readFileSync(pathEnv, "utf-8");
  }
  throw new Error(
    "Missing private key. Set PRIVATE_KEY_PATH/KALSHI_PRIVATE_KEY_PATH or PRIVATE_KEY_PEM/KALSHI_PRIVATE_KEY_PEM in .env"
  );
}

export function getKalshiConfig(): {
  apiKey: string;
  privateKeyPem: string;
  basePath: string;
} {
  return {
    apiKey: getApiKey(),
    privateKeyPem: getPrivateKey(),
    basePath: BASE_PATH,
  };
}

export function getPortfolioApi(): PortfolioApi {
  const config = new Configuration(getKalshiConfig());
  return new PortfolioApi(config);
}

export function getOrdersApi(): OrdersApi {
  const config = new Configuration(getKalshiConfig());
  return new OrdersApi(config);
}
