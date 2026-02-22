import { Chain, ClobClient } from '@polymarket/clob-client';
import { Wallet } from 'ethers';

const HOST = 'https://clob.polymarket.com';

let cachedClient: Promise<ClobClient> | null = null;

export async function getPolymarketClient(): Promise<ClobClient> {
  if (!cachedClient) {
    cachedClient = createClient();
  }
  return cachedClient;
}

async function createClient(): Promise<ClobClient> {
  const privateKey = process.env.PRIVATE_KEY || process.env.POLYMARKET_PRIVATE_KEY;
  const funderAddress = process.env.POLYMARKET_FUNDER_ADDRESS;

  if (!privateKey) {
    return new ClobClient(HOST, Chain.POLYGON);
  }

  try {
    const signer = new Wallet(privateKey);
    const tempClient = new ClobClient(HOST, Chain.POLYGON, signer);
    const apiCreds = await tempClient.createOrDeriveApiKey();

    return new ClobClient(
      HOST,
      Chain.POLYGON,
      signer,
      apiCreds,
      0,
      funderAddress || signer.address
    );
  } catch (error) {
    console.warn('Polymarket L2 auth failed, using public client:', error);
    return new ClobClient(HOST, Chain.POLYGON);
  }
}
