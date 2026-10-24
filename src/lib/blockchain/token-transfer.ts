import { encodeFunctionData, erc20Abi, type Address, type Hex } from "viem";
import type { ChainClient } from "./types";
import { CHAIN, NETWORK_NAME, explorerAddressUrl } from "./chain";
import { resolveAddress } from "./ens";
import { BlockchainError, toBlockchainError } from "./errors";
import { formatEth, formatGweiValue, formatToken } from "./format";
import { resolveToken } from "./reader";
import type { TransferCheck } from "./transfer";
import { isZeroAddress, parseAddress, parseTokenAmount } from "./validation";

/**
 * Prepare (never send!) an ERC-20 `transfer(to, amount)`.
 *
 * Like ETH transfers, the result is only a proposal: the wallet request goes to
 * the token contract with this calldata, and the browser re-decodes the
 * calldata before signing to make sure it matches what the user sees.
 */

export type PreparedTokenTransfer = {
  kind: "erc20_transfer";
  chainId: number;
  network: string;
  from: Address | null;
  /** The token recipient (not the contract the wallet calls). */
  to: Address;
  toEnsName: string | null;
  token: { address: Address; symbol: string; name: string; decimals: number };
  amountRaw: string;
  amount: string;
  /** `transfer(to, amountRaw)` calldata, sent to `token.address` with zero ETH. */
  data: Hex;
  gasLimit: string;
  maxFeePerGasGwei: string;
  maxPriorityFeePerGasGwei: string;
  estimatedFeeEth: string;
  maxFeeEth: string;
  tokenBalance: string | null;
  tokenBalanceAfter: string | null;
  ethBalanceEth: string | null;
  recipientIsContract: boolean;
  checks: TransferCheck[];
  warnings: string[];
  readyToSign: boolean;
  preparedAt: string;
  recipientExplorerUrl: string;
};

export type PrepareTokenTransferInput = {
  /** The connected wallet — supplied by the app, never chosen by the LLM. */
  from?: string | null;
  token: string;
  to: string;
  amount: string | number;
};

/** Used when gas can't be estimated (no wallet, or the call would revert). */
const FALLBACK_GAS = 80_000n;
/** Gas safety margin applied to estimates (+20%). */
const GAS_BUFFER_BPS = 12_000n;

export async function prepareTokenTransfer(client: ChainClient, input: PrepareTokenTransferInput): Promise<PreparedTokenTransfer> {
  // 1. Validate user intent before touching the chain where possible.
  const tokenAddress = resolveToken(input.token);
  const from = input.from ? parseAddress(input.from, "sender address") : null;
  const { address: to, ensName: toEnsName } = await resolveAddress(client, input.to, "recipient address");
  if (isZeroAddress(to)) {
    throw new BlockchainError("INVALID_ADDRESS", "Sending to the zero address would burn the tokens. Please provide a real recipient.");
  }
  if (to.toLowerCase() === tokenAddress.toLowerCase()) {
    throw new BlockchainError("INVALID_ADDRESS", "That is the token's own contract address. Tokens sent there are usually lost forever, so Chainly won't prepare it.");
  }

  try {
    // 2. Make sure the token is a real ERC-20 and read its metadata.
    const code = await client.getCode({ address: tokenAddress });
    if (!code || code === "0x") {
      throw new BlockchainError("NOT_FOUND", `No contract is deployed at ${tokenAddress} on ${NETWORK_NAME}.`);
    }
    const contract = { address: tokenAddress, abi: erc20Abi } as const;
    const [decimals, symbol, name] = await Promise.all([
      client.readContract({ ...contract, functionName: "decimals" }).catch(() => {
        throw new BlockchainError("NOT_FOUND", `The contract at ${tokenAddress} does not look like an ERC-20 token (decimals() failed).`);
      }),
      client.readContract({ ...contract, functionName: "symbol" }).catch(() => "TOKEN"),
      client.readContract({ ...contract, functionName: "name" }).catch(() => "Unknown token"),
    ]);

    const amount = parseTokenAmount(input.amount, decimals, symbol);
    const data = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, amount] });

    // 3. Live chain state in parallel.
    const [fees, gasPrice, recipientCode, tokenBalance, ethBalance, gasEstimate] = await Promise.all([
      client.estimateFeesPerGas(),
      client.getGasPrice(),
      client.getCode({ address: to }),
      from ? client.readContract({ ...contract, functionName: "balanceOf", args: [from] }) : Promise.resolve(null),
      from ? client.getBalance({ address: from }) : Promise.resolve(null),
      from
        ? client.estimateGas({ account: from, to: tokenAddress, data, value: 0n }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const recipientIsContract = Boolean(recipientCode && recipientCode !== "0x");
    const gasLimit = gasEstimate ? (gasEstimate * GAS_BUFFER_BPS) / 10_000n : FALLBACK_GAS;
    const expectedFee = gasLimit * (gasPrice < fees.maxFeePerGas ? gasPrice : fees.maxFeePerGas);
    const maxFee = gasLimit * fees.maxFeePerGas;

    // 4. Safety checks — every one must pass before the UI enables signing.
    const checks: TransferCheck[] = [
      {
        id: "recipient",
        label: "Recipient address",
        passed: true,
        detail: toEnsName ? `${toEnsName} resolves to ${to}` : `Valid checksummed address ${to}`,
      },
      { id: "token", label: "Token contract", passed: true, detail: `${name} (${symbol}) at ${tokenAddress}` },
      { id: "amount", label: "Amount", passed: true, detail: `${formatToken(amount, decimals, decimals)} ${symbol}` },
      { id: "network", label: "Network", passed: true, detail: `${NETWORK_NAME} (chain ID ${CHAIN.id}) — testnet tokens only` },
      {
        id: "wallet",
        label: "Wallet connected",
        passed: Boolean(from),
        detail: from ? `Sender ${from}` : "Connect a wallet so the transaction can be signed.",
      },
    ];

    if (from && tokenBalance !== null) {
      const enough = tokenBalance >= amount;
      checks.push({
        id: "token-balance",
        label: `Sufficient ${symbol}`,
        passed: enough,
        detail: enough
          ? `Balance ${formatToken(tokenBalance, decimals)} ${symbol} covers the amount`
          : `Balance ${formatToken(tokenBalance, decimals)} ${symbol} is below the ${formatToken(amount, decimals)} ${symbol} to send.`,
      });
    }
    if (from && ethBalance !== null) {
      const enough = ethBalance >= maxFee;
      checks.push({
        id: "gas-balance",
        label: "ETH for gas",
        passed: enough,
        detail: enough
          ? `Balance ${formatEth(ethBalance)} ETH covers the max gas fee (${formatEth(maxFee, 10)} ETH)`
          : `Balance ${formatEth(ethBalance)} ETH can't cover the max gas fee (${formatEth(maxFee, 10)} ETH). Get testnet ETH from a faucet.`,
      });
    }

    const warnings: string[] = [];
    if (toEnsName) {
      warnings.push(`Recipient resolved from the ENS name ${toEnsName}. Check that ${to} is who you expect: the name's owner can change where it points.`);
    }
    if (from && from.toLowerCase() === to.toLowerCase()) warnings.push(`You are sending ${symbol} to yourself — only the gas fee will be spent.`);
    if (recipientIsContract) {
      warnings.push("The recipient is a smart contract. Tokens sent to a contract that can't handle them may be stuck forever.");
    }
    if (from && !gasEstimate && tokenBalance !== null && tokenBalance >= amount) {
      warnings.push("Gas estimation failed, so a default gas limit is used. The token contract may reject this transfer.");
    }

    return {
      kind: "erc20_transfer",
      chainId: CHAIN.id,
      network: NETWORK_NAME,
      from,
      to,
      toEnsName,
      token: { address: tokenAddress, symbol, name, decimals },
      amountRaw: amount.toString(),
      amount: formatToken(amount, decimals, decimals),
      data,
      gasLimit: gasLimit.toString(),
      maxFeePerGasGwei: formatGweiValue(fees.maxFeePerGas, 6),
      maxPriorityFeePerGasGwei: formatGweiValue(fees.maxPriorityFeePerGas, 6),
      estimatedFeeEth: formatEth(expectedFee, 10),
      maxFeeEth: formatEth(maxFee, 10),
      tokenBalance: tokenBalance !== null ? formatToken(tokenBalance, decimals) : null,
      tokenBalanceAfter: tokenBalance !== null && tokenBalance >= amount ? formatToken(tokenBalance - amount, decimals) : null,
      ethBalanceEth: ethBalance !== null ? formatEth(ethBalance, 8) : null,
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
