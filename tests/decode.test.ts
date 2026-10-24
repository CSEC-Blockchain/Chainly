import { encodeAbiParameters, encodeEventTopics, encodeFunctionData, erc20Abi, erc721Abi, maxUint256, parseEther } from "viem";
import { describe, expect, it } from "vitest";
import { decodeTransaction } from "@/lib/blockchain/decode";
import type { ExplorerConfig } from "@/lib/blockchain/explorer";
import { fakeClient } from "./fake-client";

const HASH = `0x${"a".repeat(64)}`;
const FROM = "0x1111111111111111111111111111111111111111";
const TO = "0x2222222222222222222222222222222222222222";
const SPENDER = "0x4444444444444444444444444444444444444444";
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const NFT = "0x5555555555555555555555555555555555555555";

/** Explorer with no verified contracts: decoding falls back to standard ABIs. */
const unverified: ExplorerConfig = {
  fetchImpl: (async () => new Response(JSON.stringify({ status: "0", message: "NOTOK", result: "Contract source code not verified" }))) as unknown as typeof fetch,
};

function erc20Log(eventName: "Transfer" | "Approval", args: Record<string, `0x${string}`>, value: bigint, logIndex = 0) {
  return {
    address: USDC,
    logIndex,
    topics: encodeEventTopics({ abi: erc20Abi, eventName, args } as never),
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
  };
}

function client(tx: Record<string, unknown>, logs: unknown[], status = "success") {
  return fakeClient({
    getTransaction: async () => ({ hash: HASH, from: FROM, value: 0n, blockNumber: 10n, ...tx }),
    getTransactionReceipt: async () => ({ status, logs, gasUsed: 50_000n, effectiveGasPrice: 1_000_000_000n, contractAddress: null }),
    readContract: async ({ functionName }: { functionName: string }) => ({ symbol: "USDC", decimals: 6 })[functionName as "symbol"],
  } as never);
}

describe("decodeTransaction", () => {
  it("decodes an ERC-20 transfer call and its Transfer event", async () => {
    const input = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [TO, 12_500_000n] });
    const result = await decodeTransaction(client({ to: USDC, input }, [erc20Log("Transfer", { from: FROM, to: TO }, 12_500_000n)]), HASH, unverified);
    expect(result.method).toMatchObject({ name: "transfer", decoded: true, args: [{ name: "recipient", value: TO }, { name: "amount", value: "12500000" }] });
    expect(result.events[0]).toMatchObject({ name: "Transfer", summary: "Transferred 12.5 USDC from 0x1111…1111 to 0x2222…2222" });
    expect(result.summary[0]).toBe("Called transfer on 0x1c7D…7238");
    expect(result.feeEth).toBe("0.00005");
  });

  it("flags unlimited approvals", async () => {
    const input = encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [SPENDER, maxUint256] });
    const result = await decodeTransaction(client({ to: USDC, input }, [erc20Log("Approval", { owner: FROM, spender: SPENDER }, maxUint256)]), HASH, unverified);
    expect(result.events[0].summary).toBe("Approved 0x4444…4444 to spend unlimited USDC from 0x1111…1111");
    expect(result.flags.map((f) => f.id)).toContain("unlimited_approval");
  });

  it("tells ERC-721 transfers apart from ERC-20 ones", async () => {
    const log = {
      address: NFT,
      logIndex: 0,
      topics: encodeEventTopics({ abi: erc721Abi, eventName: "Transfer", args: { from: "0x0000000000000000000000000000000000000000", to: TO, tokenId: 7n } }),
      data: "0x",
    };
    const result = await decodeTransaction(client({ to: NFT, input: "0x40c10f19" }, [log]), HASH, unverified);
    expect(result.events[0].summary).toBe("Minted NFT #7 of 0x5555…5555 to 0x2222…2222");
    expect(result.method).toMatchObject({ decoded: false, selector: "0x40c10f19", name: null });
  });

  it("describes a plain ETH transfer without calling the explorer", async () => {
    const result = await decodeTransaction(client({ to: TO, input: "0x", value: parseEther("0.25") }, []), HASH, {});
    expect(result.method).toBeNull();
    expect(result.summary).toEqual(["Sent 0.25 ETH from 0x1111…1111 to 0x2222…2222"]);
  });

  it("flags reverted transactions and marks unknown events", async () => {
    const unknown = { address: NFT, logIndex: 0, topics: [`0x${"b".repeat(64)}`], data: "0x" };
    const result = await decodeTransaction(client({ to: NFT, input: "0x12345678" }, [unknown], "reverted"), HASH, unverified);
    expect(result.flags.map((f) => f.id)).toEqual(expect.arrayContaining(["failed", "unverified_target"]));
    expect(result.events[0]).toMatchObject({ name: null, summary: "Unknown event from 0x5555…5555" });
  });

  it("rejects malformed hashes", async () => {
    await expect(decodeTransaction(client({}, []), "0x1234", {})).rejects.toThrow(/not a valid transaction hash/);
  });
});
