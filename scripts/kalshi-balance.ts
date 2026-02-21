import "dotenv/config";
import { readFileSync } from "fs";
import { Configuration, PortfolioApi } from "kalshi-typescript";

const BASE_PATH = "https://api.elections.kalshi.com/trade-api/v2";

function getApiKey(): string {
  const apiKey = process.env.API_KEY ?? process.env.KALSHI_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "Missing API key. Set API_KEY or KALSHI_API_KEY in environment or .env",
    );
  }
  return apiKey;
}

function getPrivateKey(): string {
  const pemEnv = process.env.PRIVATE_KEY_PEM ?? process.env.KALSHI_PRIVATE_KEY_PEM;
  if (pemEnv) {
    return pemEnv.replace(/\\n/g, "\n");
  }

  const pathEnv =
    process.env.PRIVATE_KEY_PATH ?? process.env.KALSHI_PRIVATE_KEY_PATH;
  if (pathEnv) {
    return readFileSync(pathEnv, "utf-8");
  }

  throw new Error(
    "Missing private key. Set PRIVATE_KEY_PATH/KALSHI_PRIVATE_KEY_PATH or PRIVATE_KEY_PEM/KALSHI_PRIVATE_KEY_PEM in .env",
  );
}

async function main(): Promise<void> {
  const apiKey = getApiKey();
  const privateKey = getPrivateKey();

  const config = new Configuration({
    apiKey,
    privateKeyPem: privateKey,
    basePath: BASE_PATH,
  });

  const portfolioApi = new PortfolioApi(config);
  const balanceResponse = await portfolioApi.getBalance();
  const balanceCents = balanceResponse.data.balance ?? 0;
  const balanceDollars = balanceCents / 100;

  // Match the Python script behavior
  console.log(`Balance: $${balanceDollars.toFixed(2)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

