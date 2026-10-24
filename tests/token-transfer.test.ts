import { decodeFunctionData, encodeFunctionData, erc20Abi, parseEther, parseGwei } from "viem";
import { describe, expect, it } from "vitest";
import { guardPreparedTransfer } from "@/lib/blockchain/signing-guard";
import { prepareTokenTransfer, type PreparedTokenTransfer } from "@/lib/blockchain/token-transfer";
import { previewKey } from "@/lib/blockchain/tx-records";
import { parseTokenAmount } from "@/lib/blockchain/validation";
import { fakeClient } from "./fake-client";

const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x2222222222222222222222222222222222222222";
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

function client(overrides: Record<string, (...args: never[]) => unknown> = {}, balances = { token: 50_000_000n, eth: parseEther("0.5") }) {
  const values: Record<string, unknown> = { decimals: 6, symbol: "USDC", name: "USD Coin", balanceOf: balances.token };
  return fakeClient({
    getCode: async ({ address }: { address: string }) => (address.toLowerCase() === USDC.toLowerCase() ? "0x6080" : undefined),
    readContract: async ({ functionName }: { functionName: string }) => values[functionName],
    estimateFeesPerGas: async () => ({ maxFeePerGas: parseGwei("0.002"), maxPriorityFeePerGas: parseGwei("0.001") }),
    getGasPrice: async () => parseGwei("0.0015"),
    getBalance: async () => balances.eth,
    estimateGas: async () => 50_000n,
    ...overrides,
  } as never);
}

describe("parseTokenAmount", () => {
  it("respects the token's decimals", () => {
    expect(parseTokenAmount("12.5", 6, "USDC")).toBe(12_500_000n);
    expect(parseTokenAmount("3 usdc", 6, "USDC")).toBe(3_000_000n);
    expect(() => parseTokenAmount("1.1234567", 6, "USDC")).toThrow(/at most 6 decimal places/);
    expect(() => parseTokenAmount("0", 6, "USDC")).toThrow(/greater than zero/);
    expect(() => parseTokenAmount("1,5", 6, "USDC")).toThrow(/Ambiguous/);
  });
});

describe("prepareTokenTransfer", () => {
  it("builds transfer(to, amount) calldata for the token contract", async () => {
    const preview = await prepareTokenTransfer(client(), { from: FROM, token: "usdc", to: TO, amount: "12.5" });
    expect(preview).toMatchObject({
      kind: "erc20_transfer",
      from: FROM,
      to: TO,
      token: { address: USDC, symbol: "USDC", decimals: 6 },
      amountRaw: "12500000",
      amount: "12.5",
      gasLimit: "60000", // 50k + 20%
      tokenBalanceAfter: "37.5",
      readyToSign: true,
    });
    const call = decodeFunctionData({ abi: erc20Abi, data: preview.data });
    expect(call).toEqual({ functionName: "transfer", args: [TO, 12_500_000n] });
  });

  it("blocks signing without enough tokens or ETH for gas", async () => {
    const preview = await prepareTokenTransfer(client({}, { token: 1_000_000n, eth: 0n }), { from: FROM, token: USDC, to: TO, amount: "5" });
    expect(preview.readyToSign).toBe(false);
    expect(preview.checks.find((c) => c.id === "token-balance")?.passed).toBe(false);
    expect(preview.checks.find((c) => c.id === "gas-balance")?.passed).toBe(false);
  });

  it("refuses to send tokens to the token contract itself or the zero address", async () => {
    await expect(prepareTokenTransfer(client(), { from: FROM, token: "USDC", to: USDC, amount: "1" })).rejects.toThrow(/token's own contract/);
    await expect(
      prepareTokenTransfer(client(), { from: FROM, token: "USDC", to: "0x0000000000000000000000000000000000000000", amount: "1" }),
    ).rejects.toThrow(/zero address/);
  });

  it("rejects contracts that aren't ERC-20 tokens", async () => {
    const notToken = client({ readContract: async () => { throw new Error("revert"); } });
    await expect(prepareTokenTransfer(notToken, { from: FROM, token: "USDC", to: TO, amount: "1" })).rejects.toThrow(/does not look like an ERC-20/);
  });
});

describe("guardPreparedTransfer for tokens", () => {
  async function preview() {
    return prepareTokenTransfer(client(), { from: FROM, token: "USDC", to: TO, amount: "12.5" });
  }

  it("sends the calldata to the token contract with zero ETH", async () => {
    const p = await preview();
    const result = guardPreparedTransfer(p, { address: FROM });
    expect(result).toEqual({ ok: true, request: { to: USDC, value: 0n, gas: 60_000n, chainId: 11155111, data: p.data } });
  });

  it.each<[string, (p: PreparedTokenTransfer) => Partial<PreparedTokenTransfer>, RegExp]>([
    ["calldata for another recipient", () => ({ data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: ["0x6666666666666666666666666666666666666666", 12_500_000n] }) }), /different recipient/],
    ["calldata for another amount", () => ({ data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [TO, 10n ** 18n] }) }), /different amount/],
    ["an approve instead of a transfer", () => ({ data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [TO, 12_500_000n] }) }), /calls approve/],
    ["garbage calldata", () => ({ data: "0xdeadbeef" }), /not a token transfer/],
    ["a bad token address", (p) => ({ token: { ...p.token, address: "0xdead" as `0x${string}` } }), /Invalid token contract/],
  ])("blocks %s", async (_name, patch, reason) => {
    const p = await preview();
    const result = guardPreparedTransfer({ ...p, ...patch(p) }, { address: FROM });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reasons.join(" ")).toMatch(reason);
  });

  it("keys submitted token transfers by token, recipient and amount", async () => {
    const p = await preview();
    expect(previewKey(p)).not.toBe(previewKey({ ...p, amountRaw: "1" }));
    expect(previewKey(p)).not.toBe(previewKey({ ...p, token: { ...p.token, address: TO } }));
  });
});
