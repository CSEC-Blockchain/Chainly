import { parseEther } from "viem";
import { describe, expect, it } from "vitest";
import { getEthBalance, getTokenBalance, getTransactionDetails, resolveToken } from "@/lib/blockchain/reader";
import { fakeClient } from "./fake-client";

const ADDR = "0x1111111111111111111111111111111111111111";

describe("reader", () => {
  it("returns a formatted ETH balance and contract flag", async () => {
    const client = fakeClient({
      getBalance: async () => parseEther("1.23456789"),
      getBlockNumber: async () => 99n,
      getCode: async () => "0x",
    });
    await expect(getEthBalance(client, ADDR)).resolves.toMatchObject({
      balanceEth: "1.23456789",
      isContract: false,
      blockNumber: "99",
      explorerUrl: `https://sepolia.etherscan.io/address/${ADDR}`,
    });
  });

  it("resolves known token symbols case-insensitively", () => {
    expect(resolveToken("usdc")).toBe("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
    expect(() => resolveToken("DOGE")).toThrow(/token contract address/);
  });

  it("reads an ERC-20 balance with decimals", async () => {
    const values: Record<string, unknown> = { balanceOf: 2_500_000n, decimals: 6, symbol: "USDC", name: "USD Coin" };
    const client = fakeClient({
      getCode: async () => "0x6080",
      readContract: async ({ functionName }: { functionName: string }) => values[functionName],
    } as never);
    await expect(getTokenBalance(client, ADDR, "USDC")).resolves.toMatchObject({ balance: "2.5", token: { symbol: "USDC", decimals: 6 } });
  });

  it("errors clearly when the token address has no contract", async () => {
    const client = fakeClient({ getCode: async () => undefined });
    await expect(getTokenBalance(client, ADDR, ADDR)).rejects.toThrow(/No contract is deployed/);
  });

  it("validates hashes before calling the RPC", async () => {
    await expect(getTransactionDetails(fakeClient({}), "0x1234")).rejects.toThrow(/not a valid transaction hash/);
  });
});
