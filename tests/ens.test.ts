import { parseEther, parseGwei } from "viem";
import { describe, expect, it, vi } from "vitest";
import { looksLikeEnsName, resolveAddress } from "@/lib/blockchain/ens";
import { getEthBalance } from "@/lib/blockchain/reader";
import { prepareEthTransfer } from "@/lib/blockchain/transfer";
import { fakeClient } from "./fake-client";

const ALICE = "0x2222222222222222222222222222222222222222";
const FROM = "0x1111111111111111111111111111111111111111";

describe("ENS names", () => {
  it("tells names from addresses", () => {
    expect(looksLikeEnsName("alice.eth")).toBe(true);
    expect(looksLikeEnsName(" pay.alice.eth ")).toBe(true);
    expect(looksLikeEnsName(ALICE)).toBe(false);
    expect(looksLikeEnsName("alice")).toBe(false);
  });

  it("passes 0x addresses through without an RPC call", async () => {
    const getEnsAddress = vi.fn();
    await expect(resolveAddress(fakeClient({ getEnsAddress }), ALICE.toUpperCase().replace("0X", "0x"))).resolves.toEqual({
      address: ALICE,
      ensName: null,
    });
    expect(getEnsAddress).not.toHaveBeenCalled();
  });

  it("normalizes the name and returns the checksummed address", async () => {
    const getEnsAddress = vi.fn(async () => "0xd8da6bf26964af9d7eed9e03e53415d37aa96045");
    const result = await resolveAddress(fakeClient({ getEnsAddress } as never), "  Alice.ETH ");
    expect(getEnsAddress).toHaveBeenCalledWith({ name: "alice.eth" });
    expect(result).toEqual({ address: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", ensName: "alice.eth" });
  });

  it("explains names that don't resolve on Sepolia", async () => {
    const client = fakeClient({ getEnsAddress: async () => null });
    await expect(resolveAddress(client, "nobody.eth")).rejects.toMatchObject({ code: "NOT_FOUND", message: expect.stringMatching(/Sepolia/) });
  });

  it("rejects invalid names", async () => {
    await expect(resolveAddress(fakeClient({}), "bad name.eth")).rejects.toMatchObject({ code: "INVALID_ADDRESS" });
  });

  it("includes the name in balance results", async () => {
    const client = fakeClient({
      getEnsAddress: async () => ALICE,
      getBalance: async () => parseEther("1"),
      getBlockNumber: async () => 1n,
      getCode: async () => "0x",
    });
    await expect(getEthBalance(client, "alice.eth")).resolves.toMatchObject({ address: ALICE, ensName: "alice.eth", balanceEth: "1" });
  });

  it("prepares a transfer to the resolved address and flags the name", async () => {
    const client = fakeClient({
      getEnsAddress: async () => ALICE,
      estimateFeesPerGas: async () => ({ maxFeePerGas: parseGwei("0.002"), maxPriorityFeePerGas: parseGwei("0.001") }),
      getGasPrice: async () => parseGwei("0.0015"),
      getCode: async () => undefined,
      getBalance: async () => parseEther("0.5"),
      estimateGas: async () => 21_000n,
    });
    const preview = await prepareEthTransfer(client, { from: FROM, to: "alice.eth", amountEth: "0.001" });
    expect(preview).toMatchObject({ to: ALICE, toEnsName: "alice.eth", readyToSign: true });
    expect(preview.checks.find((c) => c.id === "recipient")?.detail).toBe(`alice.eth resolves to ${ALICE}`);
    expect(preview.warnings.some((w) => w.includes("alice.eth") && w.includes(ALICE))).toBe(true);
  });

  it("refuses a name that resolves to the zero address", async () => {
    const client = fakeClient({ getEnsAddress: async () => "0x0000000000000000000000000000000000000000" });
    await expect(prepareEthTransfer(client, { from: FROM, to: "burn.eth", amountEth: "0.001" })).rejects.toThrow(/zero address/);
  });
});
