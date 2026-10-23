import { HttpRequestError, parseEther, parseGwei } from "viem";
import { describe, expect, it, vi } from "vitest";
import { prepareEthTransfer } from "@/lib/blockchain/transfer";
import { fakeClient } from "./fake-client";

const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x2222222222222222222222222222222222222222";

function client(overrides: Record<string, (...args: never[]) => unknown> = {}) {
  return fakeClient({
    estimateFeesPerGas: async () => ({ maxFeePerGas: parseGwei("0.002"), maxPriorityFeePerGas: parseGwei("0.001") }),
    getGasPrice: async () => parseGwei("0.0015"),
    getCode: async () => undefined,
    getBalance: async () => parseEther("0.5"),
    estimateGas: async () => 21_000n,
    ...overrides,
  });
}

describe("prepareEthTransfer", () => {
  it("prepares a ready-to-sign preview when all checks pass", async () => {
    const preview = await prepareEthTransfer(client(), { from: FROM, to: TO, amountEth: "0.001" });
    expect(preview).toMatchObject({
      chainId: 84532,
      from: FROM,
      to: TO,
      valueWei: parseEther("0.001").toString(),
      gasLimit: "21000",
      readyToSign: true,
      recipientIsContract: false,
    });
    // 21000 * 0.002 gwei = 0.000000042 ETH max fee
    expect(preview.maxFeeEth).toBe("0.000000042");
    expect(preview.estimatedFeeEth).toBe("0.0000000315");
    expect(preview.checks.every((c) => c.passed)).toBe(true);
  });

  it("blocks signing when the balance can't cover amount + gas", async () => {
    const preview = await prepareEthTransfer(
      client({ getBalance: async () => parseEther("0.001"), estimateGas: async () => { throw new Error("insufficient funds"); } }),
      { from: FROM, to: TO, amountEth: "0.001" },
    );
    expect(preview.readyToSign).toBe(false);
    expect(preview.checks.find((c) => c.id === "balance")?.passed).toBe(false);
    expect(preview.balanceAfterEth).toBeNull();
    expect(preview.gasLimit).toBe("21000"); // fallback for EOAs
  });

  it("still previews without a wallet, but cannot be signed", async () => {
    const getBalance = vi.fn();
    const preview = await prepareEthTransfer(client({ getBalance }), { from: null, to: TO, amountEth: "0.01" });
    expect(getBalance).not.toHaveBeenCalled();
    expect(preview.readyToSign).toBe(false);
    expect(preview.checks.find((c) => c.id === "wallet")?.passed).toBe(false);
  });

  it("warns and adds a gas buffer for contract recipients", async () => {
    const preview = await prepareEthTransfer(
      client({ getCode: async () => "0x6080", estimateGas: async () => 50_000n }),
      { from: FROM, to: TO, amountEth: "0.001" },
    );
    expect(preview.recipientIsContract).toBe(true);
    expect(preview.gasLimit).toBe("60000");
    expect(preview.warnings.join(" ")).toMatch(/smart contract/);
  });

  it("warns on self-transfers", async () => {
    const preview = await prepareEthTransfer(client(), { from: FROM, to: FROM, amountEth: "0.001" });
    expect(preview.warnings.join(" ")).toMatch(/yourself/);
  });

  it.each([
    [{ to: "0x0000000000000000000000000000000000000000", amountEth: "1" }, /zero address/],
    [{ to: "not-an-address", amountEth: "1" }, /not a valid recipient address/],
    [{ to: TO, amountEth: "0" }, /greater than zero/],
    [{ to: TO, amountEth: "100" }, /up to 10 ETH/],
  ])("rejects invalid intent %j before touching the RPC", async (input, message) => {
    const estimateFeesPerGas = vi.fn();
    await expect(prepareEthTransfer(client({ estimateFeesPerGas }), { from: FROM, ...input })).rejects.toThrow(message);
    expect(estimateFeesPerGas).not.toHaveBeenCalled();
  });

  it("maps RPC outages to a friendly error", async () => {
    const down = client({
      estimateFeesPerGas: async () => {
        throw new HttpRequestError({ url: "https://rpc.example/key=abc", status: 502 });
      },
    });
    const err = await prepareEthTransfer(down, { from: FROM, to: TO, amountEth: "0.001" }).catch((e) => e);
    expect(err.code).toBe("RPC_ERROR");
    expect(err.message).not.toContain("key=abc");
  });
});
