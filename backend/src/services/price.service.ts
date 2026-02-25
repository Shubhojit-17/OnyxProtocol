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

// ─── Price History (CoinGecko market_chart) ─────────────

// Map our asset symbols to CoinGecko IDs
const COINGECKO_IDS: Record<string, string> = {
  STRK: "starknet",
  ETH: "ethereum",
  oETH: "ethereum",  // oETH mirrors ETH
  oSEP: "",           // stablecoin, no CoinGecko id
};

interface PriceHistoryCache {
  data: { time: string; price: number }[];
  fetchedAt: number;
}

const historyCache = new Map<string, PriceHistoryCache>();
const HISTORY_CACHE_TTL = 5 * 60_000; // 5 minutes

/**
 * Get 24h price history for a trading pair (base/quote).
 * Returns hourly data points with the exchange rate.
 */
export async function getPriceHistory(
  base: string,
  quote: string
): Promise<{ time: string; price: number }[]> {
  const cacheKey = `${base}/${quote}`;
  const cached = historyCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < HISTORY_CACHE_TTL) {
    return cached.data;
  }

  try {
    const baseId = COINGECKO_IDS[base];
    const quoteId = COINGECKO_IDS[quote];

    // Both need CoinGecko data (neither is a stablecoin)
    if (baseId && quoteId) {
      const [baseHistory, quoteHistory] = await Promise.all([
        fetchCoinGeckoHistory(baseId),
        fetchCoinGeckoHistory(quoteId),
      ]);

      // Align timestamps and compute ratio
      const data = baseHistory.map((bp, i) => {
        const qp = quoteHistory[i] || quoteHistory[quoteHistory.length - 1];
        const rate = qp.price > 0 ? bp.price / qp.price : 0;
        return { time: bp.time, price: rate };
      });

      historyCache.set(cacheKey, { data, fetchedAt: Date.now() });
      return data;
    }

    // Base has CoinGecko data, quote is stablecoin ($1)
    if (baseId && !quoteId) {
      const data = await fetchCoinGeckoHistory(baseId);
      historyCache.set(cacheKey, { data, fetchedAt: Date.now() });
      return data;
    }

    // Base is stablecoin, quote has CoinGecko data → invert
    if (!baseId && quoteId) {
      const raw = await fetchCoinGeckoHistory(quoteId);
      const data = raw.map((p) => ({
        time: p.time,
        price: p.price > 0 ? 1 / p.price : 0,
      }));
      historyCache.set(cacheKey, { data, fetchedAt: Date.now() });
      return data;
    }

    // Both stablecoins — flat line at 1
    const data = Array.from({ length: 24 }, (_, i) => ({
      time: `${i}:00`,
      price: 1,
    }));
    historyCache.set(cacheKey, { data, fetchedAt: Date.now() });
    return data;
  } catch (err: any) {
    console.warn(`[price] History fetch failed for ${cacheKey}: ${err.message}`);
    // Return cached data if available, otherwise empty
    if (cached) return cached.data;
    return [];
  }
}

async function fetchCoinGeckoHistory(
  coinId: string
): Promise<{ time: string; price: number }[]> {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
  const json = await res.json();
  const prices: [number, number][] = json.prices || [];

  return prices.map(([ts, price]) => {
    const d = new Date(ts);
    return {
      time: `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`,
      price,
    };
  });
}
