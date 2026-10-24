import { decodeFunctionData, erc20Abi, getAddress, isAddress, isHex, parseEther, type Address, type Hex } from "viem";
import { CHAIN, NETWORK_NAME } from "./chain";
import type { PreparedTokenTransfer } from "./token-transfer";
import type { PreparedTransfer } from "./transfer";
import { MAX_TRANSFER_ETH } from "./validation";

/** Anything the agent can prepare for the user to sign. */
export type PreparedPreview = PreparedTransfer | PreparedTokenTransfer;

/** Prepared previews go stale (gas, balance); require a fresh one after this. */
export const PREVIEW_TTL_MS = 10 * 60 * 1000;

export type SigningRequest = { to: Address; value: bigint; gas: bigint; chainId: typeof CHAIN.id; data?: Hex };

export type GuardResult = { ok: true; request: SigningRequest } | { ok: false; reasons: string[] };

/**
 * Last line of defence, run in the browser right before opening the wallet.
 * It re-validates the preview independently of the server/LLM, so even a
 * tampered or stale tool result can't produce an unexpected wallet request.
 */
export function guardPreparedTransfer(
  preview: PreparedPreview,
  wallet: { address: string | undefined },
  now: number = Date.now(),
): GuardResult {
  const reasons: string[] = [];

  if (preview.kind !== "eth_transfer" && preview.kind !== "erc20_transfer") reasons.push("Unsupported transaction type.");
  if (preview.chainId !== CHAIN.id) reasons.push(`Preview is for chain ${preview.chainId}, expected ${NETWORK_NAME}.`);
  if (!preview.readyToSign) reasons.push("Not all safety checks passed.");
  if (!wallet.address) reasons.push("No wallet connected.");
  else if (!preview.from || preview.from.toLowerCase() !== wallet.address.toLowerCase()) {
    reasons.push("The connected wallet differs from the sender in this preview. Ask the agent to prepare it again.");
  }
  if (!isAddress(preview.to, { strict: false })) reasons.push("Invalid recipient address.");

  let gas = 0n;
  try {
    gas = BigInt(preview.gasLimit);
  } catch {
    reasons.push("Malformed gas limit.");
  }
  if (gas < 21_000n || gas > 1_000_000n) reasons.push("Gas limit is outside the expected range.");

  const age = now - new Date(preview.preparedAt).getTime();
  if (!Number.isFinite(age) || age > PREVIEW_TTL_MS) reasons.push("This preview is older than 10 minutes. Ask the agent to prepare it again.");

  if (preview.kind === "erc20_transfer") {
    const call = checkTokenCall(preview, reasons);
    if (reasons.length || !call) return { ok: false, reasons };
    return { ok: true, request: { to: call.token, value: 0n, gas, chainId: CHAIN.id, data: call.data } };
  }

  let value = 0n;
  try {
    value = BigInt(preview.valueWei);
  } catch {
    reasons.push("Malformed amount.");
  }
  if (value <= 0n) reasons.push("Amount must be greater than zero.");
  if (value > parseEther(MAX_TRANSFER_ETH)) reasons.push(`Amount exceeds the ${MAX_TRANSFER_ETH} ETH safety limit.`);

  if (reasons.length) return { ok: false, reasons };
  return { ok: true, request: { to: getAddress(preview.to), value, gas, chainId: CHAIN.id } };
}

/**
 * Decode the calldata independently and require it to be exactly
 * `transfer(recipient, amount)` as shown on the card — nothing else.
 */
function checkTokenCall(preview: PreparedTokenTransfer, reasons: string[]): { token: Address; data: Hex } | null {
  if (!preview.token || !isAddress(preview.token.address, { strict: false })) {
    reasons.push("Invalid token contract address.");
    return null;
  }
  if (!isHex(preview.data)) {
    reasons.push("Malformed transaction data.");
    return null;
  }
  let amount: bigint;
  try {
    amount = BigInt(preview.amountRaw);
  } catch {
    reasons.push("Malformed token amount.");
    return null;
  }
  if (amount <= 0n) reasons.push("Amount must be greater than zero.");

  try {
    const call = decodeFunctionData({ abi: erc20Abi, data: preview.data });
    if (call.functionName !== "transfer") {
      reasons.push(`The transaction calls ${call.functionName}, not a plain token transfer.`);
    } else {
      const [recipient, value] = call.args;
      if (recipient.toLowerCase() !== preview.to.toLowerCase()) reasons.push("The transaction data sends to a different recipient than shown.");
      if (value !== amount) reasons.push("The transaction data sends a different amount than shown.");
    }
  } catch {
    reasons.push("The transaction data is not a token transfer.");
  }
  return { token: getAddress(preview.token.address), data: preview.data };
}
