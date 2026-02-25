/**
 * Live price service — fetches STRK, ETH prices from CoinGecko.
 * oETH mirrors ETH price, oSEP is pegged at $1.00.
 * Caches for 60 seconds to avoid rate limits.
 */

interface PriceCache {
  strk: number;
  eth: number;
  oETH: number;
  oSEP: number;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=starknet,ethereum&vs_currencies=usd";

let cache: PriceCache | null = null;

async function fetchPrices(): Promise<PriceCache> {
  // Return cache if still valid
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }

  try {
    const res = await fetch(COINGECKO_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`CoinGecko HTTP ${res.status}`);
    }

    const data = await res.json();
    const ethPrice = data.ethereum?.usd ?? 0;
    cache = {
      strk: data.starknet?.usd ?? 0,
      eth: ethPrice,
      oETH: ethPrice,        // oETH mirrors real ETH price
      oSEP: 1.0,             // oSEP pegged at $1.00
      fetchedAt: Date.now(),
    };

    console.log(
      `[price] Fetched live prices — STRK: $${cache.strk}, ETH: $${cache.eth}, oETH: $${cache.oETH}, oSEP: $${cache.oSEP}`
    );
    return cache;
  } catch (err: any) {
    console.warn(`[price] CoinGecko fetch failed: ${err.message}`);
    // Return stale cache or zeros
    if (cache) return cache;
    return { strk: 0, eth: 0, oETH: 0, oSEP: 1.0, fetchedAt: 0 };
  }
}

/**
 * Get price for a given asset symbol.
 */
export async function getAssetPrice(symbol: string): Promise<number> {
  const prices = await fetchPrices();
  switch (symbol) {
    case "STRK":
      return prices.strk;
    case "ETH":
      return prices.eth;
    case "oETH":
      return prices.oETH;
    case "oSEP":
      return prices.oSEP;
    default:
      return 1;
  }
}

/**
 * Get all prices at once.
 */
export async function getAllPrices() {
  return fetchPrices();
}

/**
 * Get exchange rate between two assets (how much of `quote` per 1 `base`).
 */
export async function getExchangeRate(base: string, quote: string): Promise<number> {
  const prices = await fetchPrices();
  const basePrice = await getAssetPrice(base);
  const quotePrice = await getAssetPrice(quote);
  if (quotePrice === 0) return 0;
  return basePrice / quotePrice;
}
