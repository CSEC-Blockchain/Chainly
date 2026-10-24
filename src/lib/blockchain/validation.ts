import { getAddress, isAddress, isHash, parseEther, parseUnits, zeroAddress, type Address, type Hash } from "viem";
import { BlockchainError } from "./errors";

/** Hard ceiling for a single prepared transfer — this is a testnet demo agent. */
export const MAX_TRANSFER_ETH = "10";

/**
 * Validate and checksum an EVM address.
 * Accepts all-lowercase / all-uppercase input, but rejects mixed-case input
 * with a wrong checksum (which usually means a typo).
 */
export function parseAddress(input: string, label = "address"): Address {
  const value = input?.trim();
  if (!value || !isAddress(value, { strict: false })) {
    throw new BlockchainError(
      "INVALID_ADDRESS",
      `"${truncate(value ?? "")}" is not a valid ${label}. Addresses are 0x followed by 40 hex characters.`,
    );
  }
  const hex = value.slice(2);
  const isMixedCase = hex !== hex.toLowerCase() && hex !== hex.toUpperCase();
  if (isMixedCase && !isAddress(value, { strict: true })) {
    throw new BlockchainError(
      "INVALID_ADDRESS",
      `The ${label} ${truncate(value)} has an invalid checksum — it may contain a typo.`,
    );
  }
  return getAddress(value);
}

export function isZeroAddress(address: Address) {
  return address.toLowerCase() === zeroAddress;
}

export function parseTxHash(input: string): Hash {
  const value = input?.trim();
  if (!value || !isHash(value)) {
    throw new BlockchainError(
      "INVALID_HASH",
      `"${truncate(value ?? "")}" is not a valid transaction hash. Hashes are 0x followed by 64 hex characters.`,
    );
  }
  return value.toLowerCase() as Hash;
}

/**
 * Parse a human ETH amount (e.g. "0.001") into wei.
 * Rejects negatives, zero, scientific notation, >18 decimals and huge values.
 */
export function parseEthAmount(input: string | number, maxEth: string = MAX_TRANSFER_ETH): bigint {
  const wei = parseDecimalAmount(input, 18, "ETH");
  if (wei > parseEther(maxEth)) {
    throw new BlockchainError(
      "INVALID_AMOUNT",
      `For safety, Chainly only prepares transfers up to ${maxEth} ETH.`,
    );
  }
  return wei;
}

/** Parse a human token amount (e.g. "12.5") into base units, with the same strict rules as ETH. */
export function parseTokenAmount(input: string | number, decimals: number, symbol: string): bigint {
  return parseDecimalAmount(input, decimals, symbol);
}

function parseDecimalAmount(input: string | number, decimals: number, unit: string): bigint {
  const raw = typeof input === "number" ? numberToPlainString(input) : String(input ?? "").trim();
  // Allow a trailing unit, e.g. "0.5 ETH" or "10 usdc".
  const value = raw.replace(new RegExp(`\\s*${escapeRegExp(unit)}$`, "i"), "");

  // "1,5" could mean 1.5 or 15 depending on locale — never guess with money.
  if (value.includes(",")) {
    throw new BlockchainError("INVALID_AMOUNT", `Ambiguous amount "${truncate(raw)}". Use a dot for decimals, e.g. 0.001.`);
  }

  if (!/^\d*\.?\d+$|^\d+\.$/.test(value)) {
    throw new BlockchainError("INVALID_AMOUNT", `"${truncate(raw)}" is not a valid ${unit} amount.`);
  }
  const fractionDigits = value.includes(".") ? value.split(".")[1].length : 0;
  if (fractionDigits > decimals) {
    throw new BlockchainError("INVALID_AMOUNT", `${unit} supports at most ${decimals} decimal places.`);
  }

  const units = parseUnits(value, decimals);
  if (units <= 0n) {
    throw new BlockchainError("INVALID_AMOUNT", "The amount must be greater than zero.");
  }
  return units;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function numberToPlainString(n: number) {
  if (!Number.isFinite(n)) return String(n);
  // Avoid "1e-7" style output for small numbers.
  return n.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 18 });
}

function truncate(s: string, max = 48) {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
