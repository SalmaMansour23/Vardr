/**
 * Server-side Kalshi API client with proper RSA authentication
 */

import { readFileSync } from "fs";
import { Configuration, MarketApi, ExchangeApi } from "kalshi-typescript";

const BASE_PATH = "https://api.elections.kalshi.com/trade-api/v2";

function getApiKey(): string {
  const apiKey = process.env.API_KEY ?? process.env.KALSHI_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "Missing API key. Set API_KEY or KALSHI_API_KEY in environment or .env"
    );
  }
  return apiKey;
}

function getPrivateKey(): string {
  const pemEnv = process.env.PRIVATE_KEY_PEM ?? process.env.KALSHI_PRIVATE_KEY_PEM;
  if (pemEnv) {
    return pemEnv.replace(/\\n/g, "\n");
  }
  
  const pathEnv = process.env.PRIVATE_KEY_PATH ?? process.env.KALSHI_PRIVATE_KEY_PATH;
  if (pathEnv) {
    try {
      return readFileSync(pathEnv, "utf-8");
    } catch (error) {
      throw new Error(`Failed to read private key from ${pathEnv}: ${error}`);
    }
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

export function getMarketApi(): MarketApi {
  const config = new Configuration(getKalshiConfig());
  return new MarketApi(config);
}

export function getExchangeApi(): ExchangeApi {
  const config = new Configuration(getKalshiConfig());
  return new ExchangeApi(config);
}
