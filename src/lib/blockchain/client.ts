import "server-only";
import { createPublicClient, fallback, http } from "viem";
import type { ChainClient } from "./types";
import { CHAIN, DEFAULT_RPC_URLS } from "./chain";

let client: ChainClient | undefined;

/**
 * Server-side viem client for Base Sepolia.
 *
 * Uses the RPC from BASE_SEPOLIA_RPC_URL first (e.g. an Alchemy URL with a key —
 * it never leaves the server), then falls back to public endpoints so a single
 * RPC outage doesn't break the demo.
 */
export function getPublicClient(): ChainClient {
  if (client) return client;

  const urls = [process.env.BASE_SEPOLIA_RPC_URL, ...DEFAULT_RPC_URLS].filter(
    (u): u is string => Boolean(u),
  );

  client = createPublicClient({
    chain: CHAIN,
    transport: fallback(
      urls.map((url) => http(url, { timeout: 10_000, retryCount: 1 })),
      { rank: false },
    ),
  });
  return client;
}
