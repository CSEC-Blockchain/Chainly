import type { Address } from "viem";
import { formatEth, formatToken, shortAddress } from "./format";
import type { ExplorerTokenTransfer, ExplorerTx } from "./explorer";

/**
 * Pure wallet-activity analysis. Takes raw explorer rows and returns
 * aggregated, LLM-friendly stats. No network calls → fully unit-testable.
 */

export type Direction = "in" | "out" | "self";

export type ActivityTx = {
  hash: string;
  timestamp: string;
  direction: Direction;
  counterparty: string | null;
  valueEth: string;
  kind: "transfer" | "contract_call" | "contract_creation";
  method: string | null;
  failed: boolean;
  feeEth: string | null;
};

export type WalletActivity = ReturnType<typeof analyzeWalletActivity>;

export function analyzeWalletActivity(
  address: Address,
  txs: ExplorerTx[],
  tokenTransfers: ExplorerTokenTransfer[] = [],
  now: Date = new Date(),
) {
  const me = address.toLowerCase();

  let incomingCount = 0;
  let outgoingCount = 0;
  let selfCount = 0;
  let failedCount = 0;
  let contractCalls = 0;
  let receivedWei = 0n;
  let sentWei = 0n;
  let gasSpentWei = 0n;
  let largestOut: { wei: bigint; hash: string; to: string | null } | null = null;
  let largestIn: { wei: bigint; hash: string; from: string } | null = null;

  const counterparties = new Map<string, { address: string; txCount: number; sentWei: bigint; receivedWei: bigint }>();
  const methods = new Map<string, number>();
  const daily = new Map<string, { date: string; inWei: bigint; outWei: bigint; txCount: number }>();
  const recent: ActivityTx[] = [];

  for (const tx of txs) {
    const from = tx.from?.toLowerCase() ?? "";
    const to = tx.to ? tx.to.toLowerCase() : "";
    const value = safeBigInt(tx.value);
    const failed = tx.isError === "1";
    const direction: Direction = from === me && to === me ? "self" : from === me ? "out" : "in";
    const isCreation = !to;
    const isCall = !isCreation && Boolean(tx.input) && tx.input !== "0x";
    const fee = direction !== "in" ? safeBigInt(tx.gasUsed) * safeBigInt(tx.gasPrice) : 0n;
    const method = isCall ? normalizeMethod(tx.functionName, tx.methodId ?? tx.input?.slice(0, 10)) : null;
    const counterparty = direction === "out" ? (tx.to || tx.contractAddress || null) : direction === "in" ? tx.from : null;

    if (direction === "in") incomingCount++;
    else if (direction === "out") outgoingCount++;
    else selfCount++;
    if (failed) failedCount++;
    if (isCall) contractCalls++;
    if (method) methods.set(method, (methods.get(method) ?? 0) + 1);
    gasSpentWei += fee;

    if (!failed) {
      if (direction === "in") {
        receivedWei += value;
        if (!largestIn || value > largestIn.wei) largestIn = { wei: value, hash: tx.hash, from: tx.from };
      } else if (direction === "out") {
        sentWei += value;
        if (!largestOut || value > largestOut.wei) largestOut = { wei: value, hash: tx.hash, to: tx.to || null };
      }
    }

    if (counterparty) {
      const key = counterparty.toLowerCase();
      const entry = counterparties.get(key) ?? { address: counterparty, txCount: 0, sentWei: 0n, receivedWei: 0n };
      entry.txCount++;
      if (!failed && direction === "out") entry.sentWei += value;
      if (!failed && direction === "in") entry.receivedWei += value;
      counterparties.set(key, entry);
    }

    const ts = Number(tx.timeStamp) * 1000;
    const date = Number.isFinite(ts) ? new Date(ts).toISOString().slice(0, 10) : "unknown";
    const day = daily.get(date) ?? { date, inWei: 0n, outWei: 0n, txCount: 0 };
    day.txCount++;
    if (!failed && direction === "in") day.inWei += value;
    if (!failed && direction === "out") day.outWei += value;
    daily.set(date, day);

    if (recent.length < 10) {
      recent.push({
        hash: tx.hash,
        timestamp: Number.isFinite(ts) ? new Date(ts).toISOString() : "",
        direction,
        counterparty,
        valueEth: formatEth(value, 6),
        kind: isCreation ? "contract_creation" : isCall ? "contract_call" : "transfer",
        method,
        failed,
        feeEth: direction !== "in" ? formatEth(fee, 8) : null,
      });
    }
  }

  // ERC-20 token flows, grouped by token symbol.
  const tokens = new Map<string, { symbol: string; address: string; decimals: number; inRaw: bigint; outRaw: bigint; transfers: number }>();
  for (const t of tokenTransfers) {
    const key = t.contractAddress.toLowerCase();
    const decimals = Number(t.tokenDecimal) || 0;
    const entry = tokens.get(key) ?? { symbol: t.tokenSymbol || "?", address: t.contractAddress, decimals, inRaw: 0n, outRaw: 0n, transfers: 0 };
    const amount = safeBigInt(t.value);
    entry.transfers++;
    if (t.to?.toLowerCase() === me) entry.inRaw += amount;
    if (t.from?.toLowerCase() === me) entry.outRaw += amount;
    tokens.set(key, entry);
  }

  const timestamps = txs.map((t) => Number(t.timeStamp)).filter((n) => Number.isFinite(n) && n > 0);
  const firstTs = timestamps.length ? Math.min(...timestamps) : null;
  const lastTs = timestamps.length ? Math.max(...timestamps) : null;
  const spanDays = firstTs && lastTs ? Math.max(1, Math.ceil((lastTs - firstTs) / 86_400)) : 0;

  const topCounterparties = [...counterparties.values()]
    .sort((a, b) => b.txCount - a.txCount || Number(b.sentWei + b.receivedWei - (a.sentWei + a.receivedWei)))
    .slice(0, 5)
    .map((c) => ({
      address: c.address,
      txCount: c.txCount,
      sentEth: formatEth(c.sentWei),
      receivedEth: formatEth(c.receivedWei),
    }));

  const topMethods = [...methods.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([method, count]) => ({ method, count }));

  const dailyActivity = [...daily.values()]
    .filter((d) => d.date !== "unknown")
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({ date: d.date, txCount: d.txCount, inEth: Number(formatEth(d.inWei, 6)), outEth: Number(formatEth(d.outWei, 6)) }));

  const tokenActivity = [...tokens.values()]
    .sort((a, b) => b.transfers - a.transfers)
    .slice(0, 6)
    .map((t) => ({
      symbol: t.symbol,
      address: t.address,
      transfers: t.transfers,
      received: formatToken(t.inRaw, t.decimals),
      sent: formatToken(t.outRaw, t.decimals),
    }));

  const summary = {
    totalTransactions: txs.length,
    incomingCount,
    outgoingCount,
    selfCount,
    failedCount,
    contractCalls,
    plainTransfers: txs.length - contractCalls,
    receivedEth: formatEth(receivedWei),
    sentEth: formatEth(sentWei),
    netFlowEth: (receivedWei >= sentWei ? "+" : "-") + formatEth(receivedWei >= sentWei ? receivedWei - sentWei : sentWei - receivedWei),
    gasSpentEth: formatEth(gasSpentWei, 8),
    uniqueCounterparties: counterparties.size,
    firstSeen: firstTs ? new Date(firstTs * 1000).toISOString() : null,
    lastSeen: lastTs ? new Date(lastTs * 1000).toISOString() : null,
    activeDays: dailyActivity.length,
    spanDays,
    largestIncoming: largestIn ? { valueEth: formatEth(largestIn.wei), from: largestIn.from, hash: largestIn.hash } : null,
    largestOutgoing: largestOut ? { valueEth: formatEth(largestOut.wei), to: largestOut.to, hash: largestOut.hash } : null,
  };

  return {
    address,
    summary,
    topCounterparties,
    topMethods,
    tokenActivity,
    dailyActivity,
    recentTransactions: recent,
    insights: buildInsights({ summary, sentWei, receivedWei, gasSpentWei, topCounterparties, topMethods, tokenActivity, lastTs, now }),
  };
}

type InsightInput = {
  summary: {
    totalTransactions: number;
    incomingCount: number;
    outgoingCount: number;
    failedCount: number;
    contractCalls: number;
    activeDays: number;
    spanDays: number;
  };
  sentWei: bigint;
  receivedWei: bigint;
  gasSpentWei: bigint;
  topCounterparties: { address: string; txCount: number }[];
  topMethods: { method: string; count: number }[];
  tokenActivity: { symbol: string; transfers: number }[];
  lastTs: number | null;
  now: Date;
};

/** Deterministic, data-backed observations the LLM can build its narrative on. */
export function buildInsights(input: InsightInput): string[] {
  const { summary: s } = input;
  const insights: string[] = [];

  if (s.totalTransactions === 0) {
    return ["No transactions found for this wallet in the analyzed window — it is new or unused on Ethereum Sepolia."];
  }

  if (s.outgoingCount > s.incomingCount * 2) insights.push("Mostly a sender: outgoing transactions dominate this wallet's history.");
  else if (s.incomingCount > s.outgoingCount * 2) insights.push("Mostly a receiver: this wallet receives far more often than it sends.");
  else insights.push("Balanced usage: the wallet both sends and receives regularly.");

  const callShare = s.contractCalls / s.totalTransactions;
  if (callShare >= 0.6) insights.push(`DeFi/dApp heavy: ${Math.round(callShare * 100)}% of transactions are smart-contract interactions.`);
  else if (callShare <= 0.2) insights.push("Simple usage pattern: most activity is plain ETH transfers.");

  if (input.gasSpentWei > 0n && input.sentWei > 0n) {
    const ratio = Number((input.gasSpentWei * 10_000n) / input.sentWei) / 100;
    if (ratio > 10) insights.push(`Gas is a large share of spending: fees equal ~${ratio.toFixed(1)}% of the ETH value sent.`);
  }

  const failRate = s.failedCount / s.totalTransactions;
  if (s.failedCount > 0) {
    insights.push(
      failRate > 0.1
        ? `High failure rate: ${s.failedCount} of ${s.totalTransactions} transactions reverted (gas was still paid).`
        : `${s.failedCount} transaction(s) reverted.`,
    );
  }

  const top = input.topCounterparties[0];
  if (top && top.txCount >= 3 && top.txCount / s.totalTransactions >= 0.3) {
    insights.push(`Concentrated activity: ${shortAddress(top.address)} appears in ${top.txCount} transactions.`);
  }

  if (input.topMethods[0]) insights.push(`Most used contract function: ${input.topMethods[0].method} (${input.topMethods[0].count}×).`);
  if (input.tokenActivity.length) insights.push(`Token activity detected in ${input.tokenActivity.map((t) => t.symbol).join(", ")}.`);

  if (input.lastTs) {
    const idleDays = Math.floor((input.now.getTime() / 1000 - input.lastTs) / 86_400);
    if (idleDays >= 30) insights.push(`Dormant: no activity for ${idleDays} days.`);
    else if (idleDays <= 1) insights.push("Recently active: transacted within the last day.");
  }

  if (s.spanDays > 0) {
    const perDay = s.totalTransactions / s.spanDays;
    if (perDay >= 5) insights.push(`High frequency: ~${perDay.toFixed(1)} transactions per day over ${s.spanDays} days.`);
  }

  return insights;
}

function normalizeMethod(functionName?: string, methodId?: string): string | null {
  if (functionName) {
    const name = functionName.split("(")[0].trim();
    if (name) return name;
  }
  return methodId && methodId !== "0x" ? methodId : null;
}

function safeBigInt(value: string | undefined): bigint {
  try {
    return value ? BigInt(value) : 0n;
  } catch {
    return 0n;
  }
}
