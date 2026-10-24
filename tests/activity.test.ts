import { parseEther, type Address } from "viem";
import { describe, expect, it } from "vitest";
import { analyzeWalletActivity } from "@/lib/blockchain/activity";
import type { ExplorerTokenTransfer, ExplorerTx } from "@/lib/blockchain/explorer";

const ME = "0x1111111111111111111111111111111111111111" as Address;
const ALICE = "0x2222222222222222222222222222222222222222";
const BOB = "0x3333333333333333333333333333333333333333";
const DEX = "0x4444444444444444444444444444444444444444";
const NOW = new Date("2026-10-23T12:00:00Z");
const day = (d: number) => String(Math.floor(new Date(`2026-10-${String(d).padStart(2, "0")}T10:00:00Z`).getTime() / 1000));

function tx(partial: Partial<ExplorerTx>): ExplorerTx {
  return {
    hash: `0x${Math.random().toString(16).slice(2).padEnd(64, "0")}`,
    blockNumber: "1",
    timeStamp: day(20),
    from: ME,
    to: ALICE,
    value: "0",
    gasUsed: "21000",
    gasPrice: "1000000000", // 1 gwei
    isError: "0",
    input: "0x",
    ...partial,
  };
}

describe("analyzeWalletActivity", () => {
  const txs: ExplorerTx[] = [
    tx({ from: ALICE, to: ME, value: parseEther("1").toString(), timeStamp: day(22) }),
    tx({ from: ME, to: BOB, value: parseEther("0.25").toString(), timeStamp: day(21) }),
    tx({ from: ME, to: BOB, value: parseEther("0.25").toString(), timeStamp: day(21) }),
    tx({ from: ME, to: DEX, value: parseEther("0.1").toString(), input: "0x38ed1739abcd", functionName: "swapExactTokensForTokens(uint256,uint256)", gasUsed: "150000", timeStamp: day(20) }),
    // Failed tx: value must not count, but gas still does.
    tx({ from: ME, to: DEX, value: parseEther("5").toString(), input: "0x38ed1739abcd", functionName: "swapExactTokensForTokens(uint256)", isError: "1", gasUsed: "50000", timeStamp: day(20) }),
  ];
  const tokens: ExplorerTokenTransfer[] = [
    { hash: "0xa", timeStamp: day(20), from: DEX, to: ME, value: "2500000", contractAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", tokenName: "USD Coin", tokenSymbol: "USDC", tokenDecimal: "6" },
  ];

  const result = analyzeWalletActivity(ME, txs, tokens, NOW);

  it("counts directions, failures and contract calls", () => {
    expect(result.summary).toMatchObject({
      totalTransactions: 5,
      incomingCount: 1,
      outgoingCount: 4,
      failedCount: 1,
      contractCalls: 2,
      plainTransfers: 3,
      uniqueCounterparties: 3,
    });
  });

  it("sums volumes excluding failed transactions", () => {
    expect(result.summary.receivedEth).toBe("1");
    expect(result.summary.sentEth).toBe("0.6");
    expect(result.summary.netFlowEth).toBe("+0.4");
  });

  it("charges gas for every outgoing tx, including failed ones", () => {
    // (21000*2 + 150000 + 50000) gas * 1 gwei = 0.000242 ETH
    expect(result.summary.gasSpentEth).toBe("0.000242");
  });

  it("ranks counterparties and methods", () => {
    expect(result.topCounterparties[0].txCount).toBe(2);
    expect(result.topMethods).toEqual([{ method: "swapExactTokensForTokens", count: 2 }]);
  });

  it("builds a daily series in chronological order", () => {
    expect(result.dailyActivity.map((d) => d.date)).toEqual(["2026-10-20", "2026-10-21", "2026-10-22"]);
    expect(result.dailyActivity[1]).toMatchObject({ txCount: 2, outEth: 0.5 });
  });

  it("builds a running net-flow series that includes gas", () => {
    // Oct 20: −0.1 sent − 0.0002 gas · Oct 21: −0.5 sent − 0.000042 gas · Oct 22: +1 received
    expect(result.flowSeries).toEqual([
      { date: "2026-10-20", netEth: -0.1002, cumulativeEth: -0.1002 },
      { date: "2026-10-21", netEth: -0.500042, cumulativeEth: -0.600242 },
      { date: "2026-10-22", netEth: 1, cumulativeEth: 0.399758 },
    ]);
  });

  it("breaks gas down by activity, largest first", () => {
    expect(result.gasBreakdown).toEqual([
      { label: "swapExactTokensForTokens", gasEth: "0.0002", txCount: 2, sharePercent: 82.64 },
      { label: "ETH transfers", gasEth: "0.000042", txCount: 2, sharePercent: 17.35 },
    ]);
  });

  it("folds gas beyond the top five activities into Other", () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      tx({ to: DEX, input: "0x12345678", functionName: `method${i}()`, gasUsed: String((i + 1) * 10_000) }),
    );
    const { gasBreakdown } = analyzeWalletActivity(ME, many, [], NOW);
    expect(gasBreakdown.map((g) => g.label)).toEqual(["method6", "method5", "method4", "method3", "method2", "Other"]);
    expect(gasBreakdown[5]).toMatchObject({ txCount: 2, gasEth: "0.00003" });
  });

  it("summarizes token flows with decimals", () => {
    expect(result.tokenActivity).toEqual([
      expect.objectContaining({ symbol: "USDC", transfers: 1, received: "2.5", sent: "0" }),
    ]);
  });

  it("produces data-backed insights", () => {
    expect(result.insights.join(" ")).toMatch(/sender/i);
    expect(result.insights.join(" ")).toMatch(/reverted/);
    expect(result.insights.join(" ")).toMatch(/USDC/);
    expect(result.summary.largestOutgoing?.valueEth).toBe("0.25");
  });

  it("handles an empty wallet", () => {
    const empty = analyzeWalletActivity(ME, [], [], NOW);
    expect(empty.summary.totalTransactions).toBe(0);
    expect(empty.insights[0]).toMatch(/No transactions/);
    expect(empty.summary.netFlowEth).toBe("+0");
  });

  it("detects dormancy", () => {
    const old = analyzeWalletActivity(ME, [tx({ timeStamp: String(Math.floor(new Date("2026-08-01").getTime() / 1000)) })], [], NOW);
    expect(old.insights.join(" ")).toMatch(/Dormant/);
  });
});
