import type { Address } from "viem";
import { normalize } from "viem/ens";
import type { ChainClient } from "./types";
import { NETWORK_NAME } from "./chain";
import { BlockchainError, toBlockchainError } from "./errors";
import { parseAddress } from "./validation";

/**
 * ENS support. Names are resolved on Ethereum Sepolia's own ENS deployment,
 * which is separate from mainnet: a name registered on mainnet does not
 * automatically exist (or point to the same address) on Sepolia.
 */

export type ResolvedAddress = { address: Address; ensName: string | null };

/** Anything that isn't 0x-prefixed but contains a dot, e.g. "alice.eth". */
export function looksLikeEnsName(input: string) {
  const value = input.trim();
  return !/^0x/i.test(value) && value.includes(".");
}

/**
 * Accept either a 0x address or an ENS name and return a checksummed address.
 * The resolved address is what gets used (and shown), never the name alone.
 */
export async function resolveAddress(client: ChainClient, input: string, label = "address"): Promise<ResolvedAddress> {
  const value = input?.trim() ?? "";
  if (!looksLikeEnsName(value)) return { address: parseAddress(value, label), ensName: null };

  let name: string;
  try {
    name = normalize(value);
  } catch {
    throw new BlockchainError("INVALID_ADDRESS", `"${truncate(value)}" is not a valid ENS name.`);
  }

  let resolved: Address | null;
  try {
    resolved = await client.getEnsAddress({ name });
  } catch (error) {
    throw toBlockchainError(error);
  }
  if (!resolved) {
    throw new BlockchainError(
      "NOT_FOUND",
      `The ENS name ${name} does not resolve to an address on ${NETWORK_NAME}. Sepolia has its own ENS registry, so mainnet names may not exist there.`,
    );
  }
  return { address: parseAddress(resolved, label), ensName: name };
}

function truncate(s: string, max = 48) {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
