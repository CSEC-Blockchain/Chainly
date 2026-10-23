import { getAddress, isAddress, parseEther, type Address } from "viem";
import { CHAIN } from "./chain";
import type { PreparedTransfer } from "./transfer";
import { MAX_TRANSFER_ETH } from "./validation";

/** Prepared previews go stale (gas, balance); require a fresh one after this. */
export const PREVIEW_TTL_MS = 10 * 60 * 1000;

export type SigningRequest = { to: Address; value: bigint; gas: bigint; chainId: typeof CHAIN.id };

export type GuardResult = { ok: true; request: SigningRequest } | { ok: false; reasons: string[] };

/**
 * Last line of defence, run in the browser right before opening the wallet.
 * It re-validates the preview independently of the server/LLM, so even a
 * tampered or stale tool result can't produce an unexpected wallet request.
 */
export function guardPreparedTransfer(
  preview: PreparedTransfer,
  wallet: { address: string | undefined },
  now: number = Date.now(),
): GuardResult {
  const reasons: string[] = [];

  if (preview.kind !== "eth_transfer") reasons.push("Unsupported transaction type.");
  if (preview.chainId !== CHAIN.id) reasons.push(`Preview is for chain ${preview.chainId}, expected ${CHAIN.name}.`);
  if (!preview.readyToSign) reasons.push("Not all safety checks passed.");
  if (!wallet.address) reasons.push("No wallet connected.");
  else if (!preview.from || preview.from.toLowerCase() !== wallet.address.toLowerCase()) {
    reasons.push("The connected wallet differs from the sender in this preview. Ask the agent to prepare it again.");
  }
  if (!isAddress(preview.to, { strict: false })) reasons.push("Invalid recipient address.");

  let value = 0n;
  let gas = 0n;
  try {
    value = BigInt(preview.valueWei);
    gas = BigInt(preview.gasLimit);
  } catch {
    reasons.push("Malformed amount or gas limit.");
  }
  if (value <= 0n) reasons.push("Amount must be greater than zero.");
  if (value > parseEther(MAX_TRANSFER_ETH)) reasons.push(`Amount exceeds the ${MAX_TRANSFER_ETH} ETH safety limit.`);
  if (gas < 21_000n || gas > 1_000_000n) reasons.push("Gas limit is outside the expected range.");

  const age = now - new Date(preview.preparedAt).getTime();
  if (!Number.isFinite(age) || age > PREVIEW_TTL_MS) reasons.push("This preview is older than 10 minutes. Ask the agent to prepare it again.");

  if (reasons.length) return { ok: false, reasons };
  return { ok: true, request: { to: getAddress(preview.to), value, gas, chainId: CHAIN.id } };
}
