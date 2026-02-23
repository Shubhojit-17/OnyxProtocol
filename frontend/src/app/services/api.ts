const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  const contentType = res.headers.get("content-type");
  if (contentType && !contentType.includes("application/json")) {
    return (await res.text()) as unknown as T;
  }

  return res.json();
}

function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ─── User ──────────────────────────────────────────────
export const userApi = {
  connect: (walletAddress: string) =>
    post<{ user: any }>("/users/connect", { walletAddress }),
  getMe: (walletAddress: string) =>
    get<{ user: any }>(`/users/me?walletAddress=${walletAddress}`),
  updateSettings: (walletAddress: string, settings: Record<string, unknown>) =>
    put<{ settings: any }>("/users/settings", { walletAddress, ...settings }),
};

// ─── Dashboard ─────────────────────────────────────────
export const dashboardApi = {
  getOverview: (walletAddress?: string) =>
    get<any>(
      `/dashboard/overview${walletAddress ? `?walletAddress=${walletAddress}` : ""}`
    ),
};

// ─── Vault ─────────────────────────────────────────────
export const vaultApi = {
  getBalances: (walletAddress: string) =>
    get<any>(`/vault/balances?walletAddress=${walletAddress}`),
  getActivity: (walletAddress: string) =>
    get<any[]>(`/vault/activity?walletAddress=${walletAddress}`),
  deposit: (walletAddress: string, assetSymbol: string, amount: number) =>
    post<any>("/vault/deposit", { walletAddress, assetSymbol, amount }),
  withdraw: (walletAddress: string, assetSymbol: string, amount: number) =>
    post<any>("/vault/withdraw", { walletAddress, assetSymbol, amount }),
  shield: (walletAddress: string, assetSymbol: string, amount: number) =>
    post<any>("/vault/shield", { walletAddress, assetSymbol, amount }),
  unshield: (walletAddress: string, assetSymbol: string, amount: number) =>
    post<any>("/vault/unshield", { walletAddress, assetSymbol, amount }),
};

// ─── Orders ────────────────────────────────────────────
export const orderApi = {
  create: (params: {
    walletAddress: string;
    assetIn: string;
    assetOut: string;
    orderType: "BUY" | "SELL";
    amount: number;
    price: number;
    commitmentHash?: string;
    expiresAt?: string;
  }) => post<{ order: any }>("/orders/create", params),
  list: (walletAddress: string) =>
    get<{ orders: any[] }>(`/orders/list?walletAddress=${walletAddress}`),
  getPool: () => get<any>("/orders/pool"),
};

// ─── Execution / Matching ──────────────────────────────
export const executionApi = {
  getTimeline: (walletAddress: string) =>
    get<{ executions: any[] }>(
      `/execution/timeline?walletAddress=${walletAddress}`
    ),
  getStats: () => get<any>("/execution/stats"),
  getMatches: (walletAddress: string) =>
    get<{ matches: any[] }>(`/matches/list?walletAddress=${walletAddress}`),
  runMatcher: () => post<any>("/matcher/run", {}),
};

// ─── Proofs ────────────────────────────────────────────
export const proofApi = {
  generate: (matchId: string) =>
    post<any>("/proofs/generate", { matchId }),
  getStatus: (matchId: string) =>
    get<any>(`/proofs/status/${matchId}`),
};

// ─── Analytics ─────────────────────────────────────────
export const analyticsApi = {
  getVolume: (range = "7d") =>
    get<any[]>(`/analytics/volume?range=${range}`),
  getAnonymitySet: (range = "7d") =>
    get<any[]>(`/analytics/anonymity-set?range=${range}`),
  getProofVelocity: () =>
    get<any[]>("/analytics/proof-velocity"),
  getLiquidityGrowth: (range = "7d") =>
    get<any[]>(`/analytics/liquidity-growth?range=${range}`),
  getDensity: () =>
    get<any[]>("/analytics/density"),
  getKpis: () =>
    get<any[]>("/analytics/kpis"),
};

// ─── History ───────────────────────────────────────────
export const historyApi = {
  getTrades: (walletAddress: string) =>
    get<{ trades: any[]; summary: any }>(
      `/history/trades?walletAddress=${walletAddress}`
    ),
  exportTrades: (walletAddress: string, format = "csv") =>
    get<string>(
      `/history/export?walletAddress=${walletAddress}&format=${format}`
    ),
};

// ─── Compliance ────────────────────────────────────────
export const complianceApi = {
  generateViewingKey: (
    walletAddress: string,
    matchId: string,
    expiresAt: string
  ) =>
    post<any>("/compliance/generate-viewing-key", {
      walletAddress,
      matchId,
      expiresAt,
    }),
  viewByKey: (viewingKey: string) =>
    get<any>(`/compliance/view/${viewingKey}`),
  getSummary: (walletAddress: string) =>
    get<any>(`/compliance/summary?walletAddress=${walletAddress}`),
  revoke: (walletAddress: string, viewingKeyId: string) =>
    post<any>("/compliance/revoke", { walletAddress, viewingKeyId }),
};

// ─── Dark Pool ─────────────────────────────────────────
export const darkPoolApi = {
  getStats: () => get<any>("/darkpool/stats"),
};

// ─── Starknet ──────────────────────────────────────────
export const starknetApi = {
  getStatus: () => get<{
    enabled: boolean;
    network: string;
    rpcUrl: string;
    contractAddress: string;
    contractDeployed: boolean;
    operatorAddress: string | null;
    blockNumber: number;
    explorerUrl: string;
    onChainCommitments: number;
    onChainMatches: number;
  }>("/starknet/status"),
};

// ─── WebSocket ─────────────────────────────────────────
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3001/ws";

export function createWebSocket(
  onMessage: (event: { type: string; data: any; timestamp: string }) => void
): WebSocket {
  const ws = new WebSocket(WS_URL);

  ws.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      onMessage(parsed);
    } catch {
      // ignore non-JSON messages
    }
  };

  ws.onerror = (err) => {
    console.error("[WS] Error:", err);
  };

  return ws;
}
