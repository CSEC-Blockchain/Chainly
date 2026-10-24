import { erc20Abi, type Address } from "viem";
import type { ChainClient } from "./types";
import { CHAIN_ID, NETWORK_NAME, explorerAddressUrl, explorerBlockUrl, explorerTxUrl } from "./chain";
import { resolveAddress } from "./ens";
import { BlockchainError, toBlockchainError } from "./errors";
import { formatEth, formatGweiValue, formatToken } from "./format";
import { parseAddress, parseTxHash } from "./validation";

/**
 * Read-only onchain queries. Every function:
 *  - validates its input,
 *  - takes the viem client as a parameter (easy to test / reuse),
 *  - returns plain JSON (bigints as strings) that the LLM and the UI can read.
 */

export async function getEthBalance(client: ChainClient, addressInput: string) {
  const { address, ensName } = await resolveAddress(client, addressInput);
  try {
    const [balance, blockNumber, code] = await Promise.all([
      client.getBalance({ address }),
      client.getBlockNumber(),
      client.getCode({ address }),
    ]);
    return {
      address,
      ensName,
      network: NETWORK_NAME,
      balanceWei: balance.toString(),
      balanceEth: formatEth(balance, 8),
      isContract: Boolean(code && code !== "0x"),
      blockNumber: blockNumber.toString(),
      explorerUrl: explorerAddressUrl(address),
    };
  } catch (error) {
    throw toBlockchainError(error);
  }
}

/** Well-known ERC-20 tokens on Ethereum Sepolia so users can say "USDC". */
export const KNOWN_TOKENS: Record<string, Address> = {
  USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle testnet USDC
  WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", // Canonical Sepolia WETH9
  LINK: "0x779877A7B0D9E8603169DdbD7836e478b4624789", // Chainlink testnet LINK
};

export function resolveToken(tokenInput: string): Address {
  const symbol = tokenInput.trim().toUpperCase();
  if (KNOWN_TOKENS[symbol]) return KNOWN_TOKENS[symbol];
  return parseAddress(tokenInput, "token contract address");
}

export async function getTokenBalance(client: ChainClient, addressInput: string, tokenInput: string) {
  const token = resolveToken(tokenInput);
  const { address, ensName } = await resolveAddress(client, addressInput);
  try {
    const code = await client.getCode({ address: token });
    if (!code || code === "0x") {
      throw new BlockchainError("NOT_FOUND", `No contract is deployed at ${token} on ${NETWORK_NAME}.`);
    }
    const contract = { address: token, abi: erc20Abi } as const;
    const [balance, decimals, symbol, name] = await Promise.all([
      client.readContract({ ...contract, functionName: "balanceOf", args: [address] }),
      client.readContract({ ...contract, functionName: "decimals" }),
      client.readContract({ ...contract, functionName: "symbol" }).catch(() => "UNKNOWN"),
      client.readContract({ ...contract, functionName: "name" }).catch(() => "Unknown token"),
    ]);
    return {
      address,
      ensName,
      network: NETWORK_NAME,
      token: { address: token, symbol, name, decimals },
      balanceRaw: balance.toString(),
      balance: formatToken(balance, decimals),
      explorerUrl: explorerAddressUrl(address),
    };
  } catch (error) {
    const err = toBlockchainError(error);
    if (err.code === "UNKNOWN") {
      throw new BlockchainError(
        "NOT_FOUND",
        `The contract at ${token} does not look like an ERC-20 token (balanceOf/decimals failed).`,
      );
    }
    throw err;
  }
}

export async function getTransactionDetails(client: ChainClient, hashInput: string) {
  const hash = parseTxHash(hashInput);
  try {
    const tx = await client.getTransaction({ hash }).catch((e) => {
      const err = toBlockchainError(e);
      if (err.code === "NOT_FOUND") {
        throw new BlockchainError(
          "NOT_FOUND",
          `Transaction ${hash} was not found on ${NETWORK_NAME}. It may be on another network or not yet broadcast.`,
        );
      }
      throw err;
    });

    const receipt = tx.blockNumber
      ? await client.getTransactionReceipt({ hash }).catch(() => null)
      : null;
    const [block, latest] = await Promise.all([
      tx.blockNumber ? client.getBlock({ blockNumber: tx.blockNumber }) : null,
      client.getBlockNumber(),
    ]);

    const fee = receipt ? receipt.gasUsed * receipt.effectiveGasPrice : null;
    const isContractCall = tx.input !== "0x";

    return {
      hash,
      network: NETWORK_NAME,
      status: receipt ? receipt.status : "pending",
      from: tx.from,
      to: tx.to,
      contractCreated: receipt?.contractAddress ?? null,
      valueWei: tx.value.toString(),
      valueEth: formatEth(tx.value, 8),
      type: (isContractCall ? (tx.to ? "contract_call" : "contract_creation") : "eth_transfer") as "contract_call" | "contract_creation" | "eth_transfer",
      methodId: isContractCall ? tx.input.slice(0, 10) : null,
      nonce: tx.nonce,
      blockNumber: tx.blockNumber?.toString() ?? null,
      confirmations: tx.blockNumber ? (latest - tx.blockNumber + 1n).toString() : "0",
      timestamp: block ? new Date(Number(block.timestamp) * 1000).toISOString() : null,
      gasLimit: tx.gas.toString(),
      gasUsed: receipt?.gasUsed.toString() ?? null,
      effectiveGasPriceGwei: receipt ? formatGweiValue(receipt.effectiveGasPrice) : null,
      feeEth: fee !== null ? formatEth(fee, 10) : null,
      logsCount: receipt?.logs.length ?? 0,
      explorerUrl: explorerTxUrl(hash),
    };
  } catch (error) {
    throw toBlockchainError(error);
  }
}

export async function getNetworkStatus(client: ChainClient) {
  try {
    const [block, gasPrice, fees] = await Promise.all([
      client.getBlock({ blockTag: "latest" }),
      client.getGasPrice(),
      client.estimateFeesPerGas().catch(() => null),
    ]);
    const utilization = block.gasLimit > 0n ? Number((block.gasUsed * 10_000n) / block.gasLimit) / 100 : 0;
    const simpleTransferCost = gasPrice * 21_000n;

    return {
      network: NETWORK_NAME,
      chainId: CHAIN_ID,
      blockNumber: block.number.toString(),
      blockTimestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
      blockAgeSeconds: Math.max(0, Math.round(Date.now() / 1000 - Number(block.timestamp))),
      transactionsInBlock: block.transactions.length,
      gasUsed: block.gasUsed.toString(),
      gasLimit: block.gasLimit.toString(),
      utilizationPercent: utilization,
      baseFeeGwei: block.baseFeePerGas != null ? formatGweiValue(block.baseFeePerGas, 6) : null,
      gasPriceGwei: formatGweiValue(gasPrice, 6),
      maxFeePerGasGwei: fees ? formatGweiValue(fees.maxFeePerGas, 6) : null,
      maxPriorityFeePerGasGwei: fees ? formatGweiValue(fees.maxPriorityFeePerGas, 6) : null,
      simpleTransferCostEth: formatEth(simpleTransferCost, 10),
      explorerUrl: explorerBlockUrl(block.number),
    };
  } catch (error) {
    throw toBlockchainError(error);
  }
}

export async function getBlockDetails(client: ChainClient, blockNumber?: string | number) {
  let blockNum: bigint | undefined;
  if (blockNumber !== undefined && blockNumber !== "" && blockNumber !== "latest") {
    if (!/^\d+$/.test(String(blockNumber))) {
      throw new BlockchainError("INVALID_AMOUNT", `"${blockNumber}" is not a valid block number.`);
    }
    blockNum = BigInt(blockNumber);
  }
  try {
    const block = blockNum !== undefined
      ? await client.getBlock({ blockNumber: blockNum })
      : await client.getBlock({ blockTag: "latest" });
    return {
      network: NETWORK_NAME,
      number: block.number.toString(),
      hash: block.hash,
      timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
      transactions: block.transactions.length,
      gasUsed: block.gasUsed.toString(),
      gasLimit: block.gasLimit.toString(),
      utilizationPercent: block.gasLimit > 0n ? Number((block.gasUsed * 10_000n) / block.gasLimit) / 100 : 0,
      baseFeeGwei: block.baseFeePerGas != null ? formatGweiValue(block.baseFeePerGas, 6) : null,
      miner: block.miner,
      explorerUrl: explorerBlockUrl(block.number),
    };
  } catch (error) {
    const err = toBlockchainError(error);
    if (err.code === "NOT_FOUND" || /BlockNotFound/.test(String((error as Error)?.name))) {
      throw new BlockchainError("NOT_FOUND", `Block ${blockNumber} does not exist yet on ${NETWORK_NAME}.`);
    }
    throw err;
  }
}
