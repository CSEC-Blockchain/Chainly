import { baseSepolia } from "viem/chains";

/**
 * The single network Chainly operates on. Keeping this in one place makes it
 * easy to explain (and to swap) during the workshop.
 */
export const CHAIN = baseSepolia;
export const CHAIN_ID = baseSepolia.id; // 84532

export const EXPLORER_URL = "https://sepolia.basescan.org";

export const DEFAULT_RPC_URLS = [
  "https://sepolia.base.org",
  "https://base-sepolia-rpc.publicnode.com",
] as const;

export const FAUCET_URL =
  "https://docs.base.org/base-chain/tools/network-faucets";

export function explorerTxUrl(hash: string) {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddressUrl(address: string) {
  return `${EXPLORER_URL}/address/${address}`;
}

export function explorerBlockUrl(block: string | number | bigint) {
  return `${EXPLORER_URL}/block/${block.toString()}`;
}
