import type { ChainClient } from "@/lib/blockchain/types";

/** Build a stub viem client: only the methods a test needs. */
export function fakeClient(methods: Record<string, (...args: never[]) => unknown>): ChainClient {
  return methods as unknown as ChainClient;
}
