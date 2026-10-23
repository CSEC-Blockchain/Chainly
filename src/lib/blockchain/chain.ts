import { sepolia } from "viem/chains";

/**
 * The single network Chainly operates on. Keeping this in one place makes it
 * easy to explain (and to swap) during the workshop.
 */
export const CHAIN = sepolia;
export const CHAIN_ID = sepolia.id; // 11155111

/** Human-friendly name (viem calls it just "Sepolia"). */
export const NETWORK_NAME = "Ethereum Sepolia";

export const EXPLORER_URL = "https://sepolia.etherscan.io";
export const EXPLORER_NAME = "Etherscan";

/** Public, keyless Sepolia RPCs used as fallbacks after SEPOLIA_RPC_URL. */
export const DEFAULT_RPC_URLS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.drpc.org",
  "https://1rpc.io/sepolia",
] as const;

export const FAUCET_URL = "https://cloud.google.com/application/web3/faucet/ethereum/sepolia";

export function explorerTxUrl(hash: string) {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddressUrl(address: string) {
  return `${EXPLORER_URL}/address/${address}`;
}

export function explorerBlockUrl(block: string | number | bigint) {
  return `${EXPLORER_URL}/block/${block.toString()}`;
}
