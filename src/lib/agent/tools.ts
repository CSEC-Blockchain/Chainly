import { tool, type InferUITools } from "ai";
import type { ChainClient } from "../blockchain/types";
import type { Address } from "viem";
import { z } from "zod";
import { analyzeWalletActivity } from "../blockchain/activity";
import { explainContract } from "../blockchain/contracts";
import { decodeTransaction } from "../blockchain/decode";
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
import { prepareTokenTransfer } from "../blockchain/token-transfer";
import { prepareEthTransfer } from "../blockchain/transfer";
import { resolveAddress } from "../blockchain/ens";

/**
 * The agent's toolbox. Each tool is a thin, typed wrapper around a reusable
 * function in `lib/blockchain` — the LLM decides *when* to call a tool, but the
 * tool code decides *what actually happens*.
 *
 * Security model:
 *  - Every tool is read-only, except `prepareTransaction` and
 *    `prepareTokenTransfer`, which only *build* a proposal. There is no tool
 *    that signs or broadcasts.
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
  .describe("A 0x-prefixed EVM address or an ENS name (e.g. alice.eth). Use the connected wallet address when the user says 'my wallet'.");

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
      description: "Get the native ETH balance of an address on Ethereum Sepolia. Also tells whether the address is a smart contract.",
      inputSchema: z.object({ address: addressSchema.optional() }),
      execute: async ({ address }) => getEthBalance(ctx.client, requireAddress(address)),
    }),

    getTokenBalance: tool({
      description: `Get an ERC-20 token balance on Ethereum Sepolia. 'token' may be a contract address or a known symbol (${Object.keys(KNOWN_TOKENS).join(", ")}).`,
      inputSchema: z.object({
        address: addressSchema.optional(),
        token: z.string().describe("ERC-20 contract address or known symbol like USDC"),
      }),
      execute: async ({ address, token }) => getTokenBalance(ctx.client, requireAddress(address), token),
    }),

    getTransaction: tool({
      description: "Read the details and status of a transaction by hash on Ethereum Sepolia (value, gas, fee, confirmations, success/failure).",
      inputSchema: z.object({ hash: z.string().describe("0x-prefixed 32-byte transaction hash") }),
      execute: async ({ hash }) => getTransactionDetails(ctx.client, hash),
    }),

    decodeTransaction: tool({
      description:
        "Explain what a transaction did in plain English: the function it called (with decoded arguments) and the events it emitted, such as token transfers, mints, approvals (flagging unlimited approvals) and WETH wraps. Use this when the user asks what happened in a transaction; use getTransaction for status, gas and fees.",
      inputSchema: z.object({ hash: z.string().describe("0x-prefixed 32-byte transaction hash") }),
      execute: async ({ hash }) => decodeTransaction(ctx.client, hash, ctx.explorer),
    }),

    explainContract: tool({
      description:
        "Explain a smart contract: its name, whether the source is verified, token standards (ERC-20/721/1155), proxy/upgradeability, owner, paused state, its read and write functions, and privileged functions like mint, pause or upgrade that give someone special powers. Accepts an address or ENS name.",
      inputSchema: z.object({ address: z.string().describe("Contract 0x address or ENS name") }),
      execute: async ({ address }) => explainContract(ctx.client, address, ctx.explorer),
    }),

    getNetworkStatus: tool({
      description: "Get live Ethereum Sepolia network info: latest block, gas price, base fee, priority fee, block utilization, and the cost of a simple ETH transfer.",
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
        const { address: target, ensName } = await resolveAddress(ctx.client, requireAddress(address));
        const [txs, tokenTransfers] = await Promise.all([
          fetchTransactions(target, limit, ctx.explorer),
          // Token history is a nice-to-have: don't fail the whole analysis on it.
          fetchTokenTransfers(target, limit, ctx.explorer).catch(() => []),
        ]);
        return {
          ...analyzeWalletActivity(target, txs, tokenTransfers),
          ensName,
          analyzedLimit: limit,
          source: explorerName(ctx.explorer),
        };
      },
    }),

    prepareTransaction: tool({
      description:
        "Prepare a native ETH transfer from the user's connected wallet on Ethereum Sepolia. Validates the recipient and amount, checks the balance, estimates gas and returns a preview. This does NOT send anything: the user must review and approve it in their wallet. Also use this to estimate the gas fee of a transfer.",
      inputSchema: z.object({
        to: z.string().describe("Recipient 0x address or ENS name (e.g. alice.eth)"),
        amountEth: z.string().describe("Amount of ETH as a decimal string, e.g. '0.001'"),
      }),
      execute: async ({ to, amountEth }) =>
        prepareEthTransfer(ctx.client, { from: ctx.connectedAddress, to, amountEth }),
    }),

    prepareTokenTransfer: tool({
      description: `Prepare an ERC-20 token transfer from the user's connected wallet on Ethereum Sepolia. 'token' may be a contract address or a known symbol (${Object.keys(KNOWN_TOKENS).join(", ")}). Validates the token, recipient and amount, checks the token balance and ETH for gas, estimates gas and returns a preview. This does NOT send anything: the user must review and approve it in their wallet.`,
      inputSchema: z.object({
        token: z.string().describe("ERC-20 contract address or known symbol like USDC"),
        to: z.string().describe("Recipient 0x address or ENS name (e.g. alice.eth)"),
        amount: z.string().describe("Amount of tokens as a decimal string in whole tokens, e.g. '12.5' (not base units)"),
      }),
      execute: async ({ token, to, amount }) =>
        prepareTokenTransfer(ctx.client, { from: ctx.connectedAddress, token, to, amount }),
    }),
  };
}

export type ChainlyTools = ReturnType<typeof createChainlyTools>;
export type ChainlyUITools = InferUITools<ChainlyTools>;
