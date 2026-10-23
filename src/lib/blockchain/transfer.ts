import type { Address } from "viem";
import type { ChainClient } from "./types";
import { CHAIN, explorerAddressUrl } from "./chain";
import { BlockchainError, toBlockchainError } from "./errors";
import { formatEth, formatGweiValue } from "./format";
import { isZeroAddress, parseAddress, parseEthAmount } from "./validation";

/**
 * Prepare (never send!) a native ETH transfer.
 *
 * The output is a *proposal*: the browser shows it as a preview card, and only
 * an explicit click opens the user's wallet to sign. The server has no keys and
 * no way to broadcast.
 */

export type TransferCheck = { id: string; label: string; passed: boolean; detail: string };

export type PreparedTransfer = {
  kind: "eth_transfer";
  chainId: number;
  network: string;
  from: Address | null;
  to: Address;
  valueWei: string;
  valueEth: string;
  gasLimit: string;
  maxFeePerGasGwei: string;
  maxPriorityFeePerGasGwei: string;
  estimatedFeeEth: string;
  maxFeeEth: string;
  totalCostEth: string;
  balanceEth: string | null;
  balanceAfterEth: string | null;
  recipientIsContract: boolean;
  checks: TransferCheck[];
  warnings: string[];
  readyToSign: boolean;
  preparedAt: string;
  recipientExplorerUrl: string;
};

export type PrepareTransferInput = {
  /** The connected wallet — supplied by the app, never chosen by the LLM. */
  from?: string | null;
  to: string;
  amountEth: string | number;
};

/** Gas safety margin applied to estimates (+20%). */
const GAS_BUFFER_BPS = 12_000n;

export async function prepareEthTransfer(client: ChainClient, input: PrepareTransferInput): Promise<PreparedTransfer> {
  // 1. Validate user intent (throws a friendly BlockchainError on bad input).
  const to = parseAddress(input.to, "recipient address");
  if (isZeroAddress(to)) {
    throw new BlockchainError("INVALID_ADDRESS", "Sending to the zero address would burn the funds. Please provide a real recipient.");
  }
  const value = parseEthAmount(input.amountEth);
  const from = input.from ? parseAddress(input.from, "sender address") : null;

  try {
    // 2. Read live chain state in parallel.
    const [fees, gasPrice, recipientCode, balance, gasEstimate] = await Promise.all([
      client.estimateFeesPerGas(),
      client.getGasPrice(),
      client.getCode({ address: to }),
      from ? client.getBalance({ address: from }) : Promise.resolve(null),
      client
        .estimateGas({ account: from ?? undefined, to, value: from ? value : 0n })
        .catch((e) => ({ error: toBlockchainError(e) })),
    ]);

    const recipientIsContract = Boolean(recipientCode && recipientCode !== "0x");

    // estimateGas fails when the sender can't afford the value; fall back to the
    // 21k intrinsic cost for EOAs so we can still show a useful preview.
    const estimated = typeof gasEstimate === "bigint" ? gasEstimate : recipientIsContract ? 100_000n : 21_000n;
    const gasLimit = recipientIsContract ? (estimated * GAS_BUFFER_BPS) / 10_000n : estimated;

    // gasPrice ≈ current base fee + tip, i.e. what the user will most likely pay;
    // maxFeePerGas is the worst case the wallet will allow.
    const expectedFee = gasLimit * (gasPrice < fees.maxFeePerGas ? gasPrice : fees.maxFeePerGas);
    const maxFee = gasLimit * fees.maxFeePerGas;
    const totalMax = value + maxFee;

    // 3. Safety checks — every one must pass before the UI enables signing.
    const checks: TransferCheck[] = [
      { id: "recipient", label: "Recipient address", passed: true, detail: `Valid checksummed address ${to}` },
      { id: "amount", label: "Amount", passed: true, detail: `${formatEth(value, 18)} ETH` },
      { id: "network", label: "Network", passed: true, detail: `${CHAIN.name} (chain ID ${CHAIN.id}) — testnet ETH only` },
      {
        id: "wallet",
        label: "Wallet connected",
        passed: Boolean(from),
        detail: from ? `Sender ${from}` : "Connect a wallet so the transaction can be signed.",
      },
    ];

    if (from && balance !== null) {
      const enough = balance >= totalMax;
      checks.push({
        id: "balance",
        label: "Sufficient balance",
        passed: enough,
        detail: enough
          ? `Balance ${formatEth(balance)} ETH covers amount + max gas (${formatEth(totalMax)} ETH)`
          : `Balance ${formatEth(balance)} ETH is below the ${formatEth(totalMax)} ETH needed (amount + max gas). Get testnet ETH from a faucet.`,
      });
    }

    const warnings: string[] = [];
    if (from && from.toLowerCase() === to.toLowerCase()) warnings.push("You are sending ETH to yourself — only the gas fee will be spent.");
    if (recipientIsContract) warnings.push("The recipient is a smart contract. Make sure it can accept ETH, or the transaction may revert.");
    if (typeof gasEstimate !== "bigint" && gasEstimate.error.code !== "INSUFFICIENT_FUNDS" && from) {
      warnings.push(`Gas estimation failed (${gasEstimate.error.message}); a default gas limit is used.`);
    }

    return {
      kind: "eth_transfer",
      chainId: CHAIN.id,
      network: CHAIN.name,
      from,
      to,
      valueWei: value.toString(),
      valueEth: formatEth(value, 18),
      gasLimit: gasLimit.toString(),
      maxFeePerGasGwei: formatGweiValue(fees.maxFeePerGas, 6),
      maxPriorityFeePerGasGwei: formatGweiValue(fees.maxPriorityFeePerGas, 6),
      estimatedFeeEth: formatEth(expectedFee, 10),
      maxFeeEth: formatEth(maxFee, 10),
      totalCostEth: formatEth(totalMax, 10),
      balanceEth: balance !== null ? formatEth(balance, 8) : null,
      balanceAfterEth: balance !== null && balance >= totalMax ? formatEth(balance - value - expectedFee, 8) : null,
      recipientIsContract,
      checks,
      warnings,
      readyToSign: checks.every((c) => c.passed),
      preparedAt: new Date().toISOString(),
      recipientExplorerUrl: explorerAddressUrl(to),
    };
  } catch (error) {
    throw toBlockchainError(error);
  }
}
