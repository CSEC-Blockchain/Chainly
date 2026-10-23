import { parseEther } from "viem";
import { describe, expect, it } from "vitest";
import { guardPreparedTransfer, PREVIEW_TTL_MS } from "@/lib/blockchain/signing-guard";
import type { PreparedTransfer } from "@/lib/blockchain/transfer";

const FROM = "0x1111111111111111111111111111111111111111";
const NOW = Date.parse("2026-10-23T12:00:00Z");

const base: PreparedTransfer = {
  kind: "eth_transfer",
  chainId: 84532,
  network: "Base Sepolia",
  from: FROM,
  to: "0x2222222222222222222222222222222222222222",
  valueWei: parseEther("0.001").toString(),
  valueEth: "0.001",
  gasLimit: "21000",
  maxFeePerGasGwei: "0.002",
  maxPriorityFeePerGasGwei: "0.001",
  estimatedFeeEth: "0",
  maxFeeEth: "0",
  totalCostEth: "0.001",
  balanceEth: "1",
  balanceAfterEth: "0.999",
  recipientIsContract: false,
  checks: [],
  warnings: [],
  readyToSign: true,
  preparedAt: new Date(NOW - 1000).toISOString(),
  recipientExplorerUrl: "",
};

describe("guardPreparedTransfer", () => {
  it("builds the exact wallet request for a valid preview", () => {
    const result = guardPreparedTransfer(base, { address: FROM.toUpperCase().replace("0X", "0x") }, NOW);
    expect(result).toEqual({
      ok: true,
      request: { to: base.to, value: parseEther("0.001"), gas: 21000n, chainId: 84532 },
    });
  });

  it.each<[string, Partial<PreparedTransfer>, string | undefined, RegExp]>([
    ["wrong chain", { chainId: 1 }, FROM, /expected Base Sepolia/],
    ["failed checks", { readyToSign: false }, FROM, /safety checks/],
    ["different sender", {}, "0x9999999999999999999999999999999999999999", /differs/],
    ["no wallet", {}, undefined, /No wallet/],
    ["huge amount", { valueWei: parseEther("50").toString() }, FROM, /safety limit/],
    ["bad recipient", { to: "0xdead" as `0x${string}` }, FROM, /Invalid recipient/],
    ["bad gas", { gasLimit: "5" }, FROM, /Gas limit/],
    ["stale preview", { preparedAt: new Date(NOW - PREVIEW_TTL_MS - 1).toISOString() }, FROM, /older than 10 minutes/],
    ["malformed value", { valueWei: "1.5" }, FROM, /Malformed/],
  ])("blocks %s", (_name, patch, address, reason) => {
    const result = guardPreparedTransfer({ ...base, ...patch }, { address }, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(" ")).toMatch(reason);
  });
});
