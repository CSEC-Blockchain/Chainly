import { CHAIN_ID } from "./chain";
import { BlockchainError } from "./errors";

/**
 * Minimal client for Etherscan-compatible explorer APIs.
 *
 * - With ETHERSCAN_API_KEY set, uses the Etherscan V2 multichain API (chainid=84532).
 * - Otherwise uses Blockscout's free, keyless Etherscan-compatible API for Base Sepolia.
 *
 * Both return `{ status, message, result }`, so one parser handles both.
 */

export type ExplorerTx = {
  hash: string;
  blockNumber: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  isError: string;
  input: string;
  functionName?: string;
  methodId?: string;
  contractAddress?: string;
};

export type ExplorerTokenTransfer = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
};

type ExplorerResponse<T> = { status: string; message: string; result: T[] | string };

export type ExplorerConfig = {
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

const BLOCKSCOUT_API = "https://base-sepolia.blockscout.com/api";
const ETHERSCAN_V2_API = "https://api.etherscan.io/v2/api";

export function explorerName(config: ExplorerConfig = {}) {
  return config.apiKey ? "Etherscan V2" : "Blockscout";
}

export function buildExplorerUrl(params: Record<string, string>, config: ExplorerConfig = {}) {
  const url = new URL(config.apiKey ? ETHERSCAN_V2_API : BLOCKSCOUT_API);
  if (config.apiKey) url.searchParams.set("chainid", String(CHAIN_ID));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (config.apiKey) url.searchParams.set("apikey", config.apiKey);
  return url;
}

/** Parse an Etherscan-style response, mapping "no results" to an empty list. */
export function parseExplorerResponse<T>(body: unknown): T[] {
  const data = body as ExplorerResponse<T> | null;
  if (!data || typeof data !== "object" || !("result" in data)) {
    throw new BlockchainError("EXPLORER_ERROR", "The block explorer returned an unexpected response.");
  }
  if (Array.isArray(data.result)) return data.result;

  const detail = `${data.message ?? ""} ${typeof data.result === "string" ? data.result : ""}`;
  if (/no (transactions|token transfers|records) found/i.test(detail)) return [];
  if (/rate limit/i.test(detail)) {
    throw new BlockchainError("EXPLORER_ERROR", "The block explorer rate limit was reached. Please retry in a few seconds.");
  }
  if (/invalid api key|missing\/invalid api key/i.test(detail)) {
    throw new BlockchainError("EXPLORER_ERROR", "The explorer API key is invalid. Check ETHERSCAN_API_KEY on the server.");
  }
  throw new BlockchainError("EXPLORER_ERROR", "The block explorer could not return this wallet's history.");
}

async function explorerGet<T>(params: Record<string, string>, config: ExplorerConfig): Promise<T[]> {
  const fetchImpl = config.fetchImpl ?? fetch;
  // Never include the URL in error messages — it contains the API key.
  let res: Response;
  try {
    res = await fetchImpl(buildExplorerUrl(params, config), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });
  } catch {
    throw new BlockchainError("EXPLORER_ERROR", `${explorerName(config)} is unreachable right now. Please try again.`);
  }
  if (res.status === 429) {
    throw new BlockchainError("EXPLORER_ERROR", "The block explorer rate limit was reached. Please retry in a few seconds.");
  }
  if (!res.ok) {
    throw new BlockchainError("EXPLORER_ERROR", `${explorerName(config)} responded with HTTP ${res.status}.`);
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new BlockchainError("EXPLORER_ERROR", "The block explorer returned invalid JSON.");
  }
  return parseExplorerResponse<T>(body);
}

export function fetchTransactions(address: string, limit: number, config: ExplorerConfig = {}) {
  return explorerGet<ExplorerTx>(
    { module: "account", action: "txlist", address, page: "1", offset: String(limit), sort: "desc" },
    config,
  );
}

export function fetchTokenTransfers(address: string, limit: number, config: ExplorerConfig = {}) {
  return explorerGet<ExplorerTokenTransfer>(
    { module: "account", action: "tokentx", address, page: "1", offset: String(limit), sort: "desc" },
    config,
  );
}
