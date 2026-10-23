import { tool, type InferUITools } from "ai";
import type { ChainClient } from "../blockchain/types";
import type { Address } from "viem";
import { z } from "zod";
import { analyzeWalletActivity } from "../blockchain/activity";
import { BlockchainError } from "../blockchain/errors";
import { explorerName, fetchTokenTransfers, fetchTransactions, type ExplorerConfig } from "../blockchain/explorer";
import {
  getBlockDetails,
  getEthBalance,
  getNetworkStatus,
  getTokenBalance,
  getTransactionDetails,
  KNOWN_TOKENS,
} from "../blockchain/reader";
import { prepareEthTransfer } from "../blockchain/transfer";
import { parseAddress } from "../blockchain/validation";

/**
 * The agent's toolbox. Each tool is a thin, typed wrapper around a reusable
 * function in `lib/blockchain` — the LLM decides *when* to call a tool, but the
 * tool code decides *what actually happens*.
 *
 * Security model:
 *  - Every tool is read-only, except `prepareTransaction`, which only *builds*
 *    a proposal. There is no tool that signs or broadcasts.
 *  - The sender for a transaction comes from the connected wallet passed in by
 *    the app (closure below), never from the LLM's arguments.
 */

export type ToolsContext = {
  client: ChainClient;
  connectedAddress: Address | null;
  explorer: ExplorerConfig;
};

const addressSchema = z
  .string()
  .describe("A 0x-prefixed EVM address. Use the connected wallet address when the user says 'my wallet'.");

export function createChainlyTools(ctx: ToolsContext) {
  const requireAddress = (address: string | undefined) => {
    const value = address || ctx.connectedAddress;
    if (!value) {
      throw new BlockchainError("WALLET_NOT_CONNECTED", "No address was given and no wallet is connected. Ask the user for an address or to connect a wallet.");
    }
    return value;
  };

  return {
    getEthBalance: tool({
      description: "Get the native ETH balance of an address on Base Sepolia. Also tells whether the address is a smart contract.",
      inputSchema: z.object({ address: addressSchema.optional() }),
      execute: async ({ address }) => getEthBalance(ctx.client, requireAddress(address)),
    }),

    getTokenBalance: tool({
      description: `Get an ERC-20 token balance on Base Sepolia. 'token' may be a contract address or a known symbol (${Object.keys(KNOWN_TOKENS).join(", ")}).`,
      inputSchema: z.object({
        address: addressSchema.optional(),
        token: z.string().describe("ERC-20 contract address or known symbol like USDC"),
      }),
      execute: async ({ address, token }) => getTokenBalance(ctx.client, requireAddress(address), token),
    }),

    getTransaction: tool({
      description: "Read the details and status of a transaction by hash on Base Sepolia (value, gas, fee, confirmations, success/failure).",
      inputSchema: z.object({ hash: z.string().describe("0x-prefixed 32-byte transaction hash") }),
      execute: async ({ hash }) => getTransactionDetails(ctx.client, hash),
    }),

    getNetworkStatus: tool({
      description: "Get live Base Sepolia network info: latest block, gas price, base fee, priority fee, block utilization, and the cost of a simple ETH transfer.",
      inputSchema: z.object({}),
      execute: async () => getNetworkStatus(ctx.client),
    }),

    getBlock: tool({
      description: "Get details of a specific block (or the latest block if no number is given).",
      inputSchema: z.object({ blockNumber: z.string().optional().describe("Block number in decimal, omit for latest") }),
      execute: async ({ blockNumber }) => getBlockDetails(ctx.client, blockNumber),
    }),

    analyzeWallet: tool({
      description:
        "Fetch a wallet's recent transactions and ERC-20 transfers from the block explorer and compute activity stats: incoming vs outgoing, volumes, gas spent, counterparties, contract usage, daily activity and insights.",
      inputSchema: z.object({
        address: addressSchema.optional(),
        limit: z.number().int().min(5).max(200).default(50).describe("How many recent transactions to analyze"),
      }),
      execute: async ({ address, limit }) => {
        const target = parseAddress(requireAddress(address));
        const [txs, tokenTransfers] = await Promise.all([
          fetchTransactions(target, limit, ctx.explorer),
          // Token history is a nice-to-have: don't fail the whole analysis on it.
          fetchTokenTransfers(target, limit, ctx.explorer).catch(() => []),
        ]);
        return {
          ...analyzeWalletActivity(target, txs, tokenTransfers),
          analyzedLimit: limit,
          source: explorerName(ctx.explorer),
        };
      },
    }),

    prepareTransaction: tool({
      description:
        "Prepare a native ETH transfer from the user's connected wallet on Base Sepolia. Validates the recipient and amount, checks the balance, estimates gas and returns a preview. This does NOT send anything: the user must review and approve it in their wallet. Also use this to estimate the gas fee of a transfer.",
      inputSchema: z.object({
        to: z.string().describe("Recipient 0x address"),
        amountEth: z.string().describe("Amount of ETH as a decimal string, e.g. '0.001'"),
      }),
      execute: async ({ to, amountEth }) =>
        prepareEthTransfer(ctx.client, { from: ctx.connectedAddress, to, amountEth }),
    }),
  };
}

export type ChainlyTools = ReturnType<typeof createChainlyTools>;
export type ChainlyUITools = InferUITools<ChainlyTools>;
