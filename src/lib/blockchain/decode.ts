import {
  decodeEventLog,
  decodeFunctionData,
  erc20Abi,
  erc721Abi,
  maxUint256,
  parseAbi,
  zeroAddress,
  type Abi,
  type Address,
  type Log,
} from "viem";
import type { ChainClient } from "./types";
import { NETWORK_NAME, explorerTxUrl } from "./chain";
import { BlockchainError, toBlockchainError } from "./errors";
import { explorerName, fetchContractSource, type ExplorerConfig } from "./explorer";
import { formatEth, formatToken, shortAddress } from "./format";
import { parseTxHash } from "./validation";

/**
 * Turn a transaction into plain English: which function it called (with
 * arguments) and what its events did (token transfers, approvals, wraps...).
 *
 * Calldata is decoded with the target contract's verified ABI when the
 * explorer has one, and otherwise with common standard ABIs.
 */

const wethAbi = parseAbi([
  "function deposit() payable",
  "function withdraw(uint256 wad)",
  "event Deposit(address indexed dst, uint256 wad)",
  "event Withdrawal(address indexed src, uint256 wad)",
]);

/** Fallback ABIs for calldata when the target isn't verified. */
const KNOWN_CALL_ABIS: Abi[] = [erc20Abi, erc721Abi, wethAbi];

const MAX_EVENTS = 30;
const MAX_TOKENS = 10;
/** Approvals at or above this are effectively unlimited (many apps use max/2 or similar). */
const UNLIMITED_APPROVAL = maxUint256 / 2n;

export type DecodedArg = { name: string; type: string; value: unknown };

export type DecodedEvent = {
  address: Address;
  logIndex: number;
  name: string | null;
  args: DecodedArg[];
  summary: string;
};

export type TransactionFlag = { id: "unlimited_approval" | "approval_for_all" | "failed" | "unverified_target"; detail: string };

export async function decodeTransaction(client: ChainClient, hashInput: string, explorer: ExplorerConfig) {
  const hash = parseTxHash(hashInput);
  try {
    const tx = await client.getTransaction({ hash }).catch((e) => {
      const err = toBlockchainError(e);
      if (err.code === "NOT_FOUND") {
        throw new BlockchainError("NOT_FOUND", `Transaction ${hash} was not found on ${NETWORK_NAME}. It may be on another network or not yet broadcast.`);
      }
      throw err;
    });
    const receipt = tx.blockNumber ? await client.getTransactionReceipt({ hash }).catch(() => null) : null;

    const notes: string[] = [];
    const flags: TransactionFlag[] = [];
    const isCall = tx.input !== "0x";

    // The target's verified ABI (the implementation's, for proxies) decodes its calldata and events.
    let targetAbi: Abi | null = null;
    let targetName: string | null = null;
    if (tx.to && isCall) {
      const source = await fetchContractSource(tx.to, explorer).catch(() => {
        notes.push(`${explorerName(explorer)} was unavailable, so only standard ABIs were used.`);
        return null;
      });
      const impl = source?.implementation ? await fetchContractSource(source.implementation, explorer).catch(() => null) : null;
      targetAbi = impl?.abi ?? source?.abi ?? null;
      targetName = safeName(impl?.name ?? null) ?? safeName(source?.name ?? null);
      if (source && !targetAbi) flags.push({ id: "unverified_target", detail: "The called contract is not verified, so the call may only be partly decoded." });
    }

    const method = isCall ? decodeCall(tx.input, targetAbi) : null;
    const logs = receipt?.logs ?? [];
    const tokens = await loadTokenMetadata(client, logs);
    const events = logs.slice(0, MAX_EVENTS).map((log) => decodeLog(log, tx.to && log.address.toLowerCase() === tx.to.toLowerCase() ? targetAbi : null, tokens, flags));
    if (logs.length > MAX_EVENTS) notes.push(`Only the first ${MAX_EVENTS} of ${logs.length} events are shown.`);

    const status = receipt ? receipt.status : "pending";
    if (status === "reverted") flags.push({ id: "failed", detail: "The transaction reverted: none of its effects happened, but the gas fee was still paid." });
    if (!receipt) notes.push("The transaction is still pending, so its events aren't known yet.");

    const fee = receipt ? receipt.gasUsed * receipt.effectiveGasPrice : null;
    const target = targetName ?? (tx.to ? shortAddress(tx.to) : "a new contract");
    const action = !isCall
      ? `Sent ${formatEth(tx.value, 8)} ETH from ${shortAddress(tx.from)} to ${tx.to ? shortAddress(tx.to) : "nobody"}`
      : !tx.to
        ? `Deployed a new contract${receipt?.contractAddress ? ` at ${shortAddress(receipt.contractAddress)}` : ""}`
        : `Called ${method?.name ?? `unknown function ${method?.selector}`} on ${target}${tx.value > 0n ? ` with ${formatEth(tx.value, 8)} ETH` : ""}`;

    return {
      hash,
      network: NETWORK_NAME,
      status,
      from: tx.from,
      to: tx.to,
      contractName: targetName,
      contractCreated: receipt?.contractAddress ?? null,
      valueEth: formatEth(tx.value, 8),
      feeEth: fee !== null ? formatEth(fee, 10) : null,
      action,
      method,
      events,
      summary: [action, ...events.map((e) => e.summary)],
      flags,
      notes,
      source: explorerName(explorer),
      explorerUrl: explorerTxUrl(hash),
    };
  } catch (error) {
    throw toBlockchainError(error);
  }
}

function decodeCall(input: `0x${string}`, targetAbi: Abi | null) {
  const selector = input.slice(0, 10);
  for (const abi of targetAbi ? [targetAbi, ...KNOWN_CALL_ABIS] : KNOWN_CALL_ABIS) {
    try {
      const { functionName, args } = decodeFunctionData({ abi, data: input });
      const fn = abi.find((i) => i.type === "function" && i.name === functionName && i.inputs.length === (args?.length ?? 0));
      const inputs = fn && fn.type === "function" ? fn.inputs : [];
      return {
        selector,
        name: safeName(functionName) ?? "unknown",
        decoded: true as const,
        args: (args ?? []).map((value, i) => ({ name: safeName(inputs[i]?.name ?? "") ?? `arg${i}`, type: inputs[i]?.type ?? "unknown", value: toJson(value) })),
      };
    } catch {
      // try the next ABI
    }
  }
  return { selector, name: null, decoded: false as const, args: [] as DecodedArg[] };
}

type TokenMeta = { symbol: string; decimals: number };

/** Symbol and decimals for every contract that emitted an ERC-20-shaped Transfer or Approval. */
async function loadTokenMetadata(client: ChainClient, logs: Log[]) {
  const transferTopics = new Set([TRANSFER_TOPIC, APPROVAL_TOPIC]);
  const addresses = [...new Set(logs.filter((l) => l.topics.length === 3 && transferTopics.has(l.topics[0] ?? "")).map((l) => l.address.toLowerCase()))].slice(0, MAX_TOKENS);
  const entries = await Promise.all(
    addresses.map(async (address) => {
      const contract = { address: address as Address, abi: erc20Abi } as const;
      const [symbol, decimals] = await Promise.all([
        client.readContract({ ...contract, functionName: "symbol" }).catch(() => null),
        client.readContract({ ...contract, functionName: "decimals" }).catch(() => null),
      ]);
      return [address, { symbol: typeof symbol === "string" ? symbol.slice(0, 16) : "tokens", decimals: typeof decimals === "number" ? decimals : 0 }] as const;
    }),
  );
  return new Map<string, TokenMeta>(entries);
}

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";

function decodeLog(log: Log, targetAbi: Abi | null, tokens: Map<string, TokenMeta>, flags: TransactionFlag[]): DecodedEvent {
  const base = { address: log.address, logIndex: log.logIndex ?? 0 };
  // ERC-20 and ERC-721 share event signatures; the number of indexed topics tells them apart.
  const candidates: Abi[] = [...(targetAbi ? [targetAbi] : []), log.topics.length === 4 ? erc721Abi : erc20Abi, wethAbi];
  for (const abi of candidates) {
    try {
      const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics as [`0x${string}`, ...`0x${string}`[]] });
      const name = safeName(decoded.eventName ?? "") ?? "unknown";
      const raw = (decoded.args ?? {}) as Record<string, unknown>;
      const args = Object.entries(raw)
        .filter(([key]) => !/^\d+$/.test(key))
        .map(([key, value]) => ({ name: safeName(key) ?? "arg", type: typeof value === "bigint" ? "uint256" : typeof value, value: toJson(value) }));
      return { ...base, name, args, summary: summarizeEvent(name, raw, log, tokens, flags) };
    } catch {
      // try the next ABI
    }
  }
  return { ...base, name: null, args: [], summary: `Unknown event from ${shortAddress(log.address)}` };
}

function summarizeEvent(name: string, args: Record<string, unknown>, log: Log, tokens: Map<string, TokenMeta>, flags: TransactionFlag[]): string {
  const token = tokens.get(log.address.toLowerCase());
  const amount = (v: unknown) => (token && typeof v === "bigint" ? `${formatToken(v, token.decimals)} ${token.symbol}` : String(v));
  const who = (v: unknown) => (typeof v === "string" ? (v.toLowerCase() === zeroAddress ? "the zero address" : shortAddress(v)) : "?");
  const contract = shortAddress(log.address);

  if (name === "Transfer" && log.topics.length === 4) {
    const [from, to, tokenId] = [args.from, args.to, args.tokenId];
    if (from === zeroAddress) return `Minted NFT #${tokenId} of ${contract} to ${who(to)}`;
    if (to === zeroAddress) return `Burned NFT #${tokenId} of ${contract}`;
    return `Moved NFT #${tokenId} of ${contract} from ${who(from)} to ${who(to)}`;
  }
  if (name === "Transfer") {
    const [from, to, value] = [args.from, args.to, args.value];
    if (from === zeroAddress) return `Minted ${amount(value)} to ${who(to)}`;
    if (to === zeroAddress) return `Burned ${amount(value)} from ${who(from)}`;
    return `Transferred ${amount(value)} from ${who(from)} to ${who(to)}`;
  }
  if (name === "Approval" && log.topics.length === 3) {
    const [owner, spender, value] = [args.owner, args.spender, args.value];
    if (typeof value === "bigint" && value === 0n) return `Revoked ${who(spender)}'s permission to spend ${who(owner)}'s ${token?.symbol ?? "tokens"}`;
    if (typeof value === "bigint" && value >= UNLIMITED_APPROVAL) {
      flags.push({ id: "unlimited_approval", detail: `${who(spender)} may spend an unlimited amount of ${who(owner)}'s ${token?.symbol ?? "tokens"} until the approval is revoked.` });
      return `Approved ${who(spender)} to spend unlimited ${token?.symbol ?? "tokens"} from ${who(owner)}`;
    }
    return `Approved ${who(spender)} to spend ${amount(value)} from ${who(owner)}`;
  }
  if (name === "ApprovalForAll") {
    if (args.approved === true) {
      flags.push({ id: "approval_for_all", detail: `${who(args.operator)} can move all of ${who(args.owner)}'s NFTs in ${contract}.` });
      return `Gave ${who(args.operator)} control of all ${who(args.owner)}'s NFTs in ${contract}`;
    }
    return `Removed ${who(args.operator)}'s control of ${who(args.owner)}'s NFTs in ${contract}`;
  }
  if (name === "Deposit" && typeof args.wad === "bigint") return `Wrapped ${formatEth(args.wad, 8)} ETH into WETH`;
  if (name === "Withdrawal" && typeof args.wad === "bigint") return `Unwrapped ${formatEth(args.wad, 8)} WETH into ETH`;
  return `${name} emitted by ${contract}`;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]{0,63}$/;

function safeName(name: string | null) {
  return name && IDENTIFIER.test(name) ? name : null;
}

/** Make decoded values JSON-safe: bigints as strings, long byte strings truncated. */
function toJson(value: unknown, depth = 0): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  if (depth > 4) return "…";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => toJson(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 20).map(([k, v]) => [k, toJson(v, depth + 1)]));
  }
  return value;
}
