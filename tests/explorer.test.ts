import { describe, expect, it, vi } from "vitest";
import { BlockchainError } from "@/lib/blockchain/errors";
import { buildExplorerUrl, fetchTransactions, parseExplorerResponse } from "@/lib/blockchain/explorer";

describe("buildExplorerUrl", () => {
  it("uses keyless Blockscout by default", () => {
    const url = buildExplorerUrl({ module: "account", action: "txlist" });
    expect(url.origin).toBe("https://base-sepolia.blockscout.com");
    expect(url.searchParams.get("apikey")).toBeNull();
  });

  it("uses Etherscan V2 with chainid 84532 when a key is set", () => {
    const url = buildExplorerUrl({ module: "account" }, { apiKey: "K" });
    expect(url.hostname).toBe("api.etherscan.io");
    expect(url.searchParams.get("chainid")).toBe("84532");
    expect(url.searchParams.get("apikey")).toBe("K");
  });
});

describe("parseExplorerResponse", () => {
  it("returns the result array", () => {
    expect(parseExplorerResponse({ status: "1", message: "OK", result: [{ a: 1 }] })).toEqual([{ a: 1 }]);
  });

  it("treats 'no transactions found' as an empty list", () => {
    expect(parseExplorerResponse({ status: "0", message: "No transactions found", result: [] })).toEqual([]);
    expect(parseExplorerResponse({ status: "0", message: "No transactions found", result: "" })).toEqual([]);
  });

  it("maps rate limits and bad keys to friendly errors", () => {
    expect(() => parseExplorerResponse({ status: "0", message: "NOTOK", result: "Max rate limit reached" })).toThrow(/rate limit/);
    expect(() => parseExplorerResponse({ status: "0", message: "NOTOK", result: "Invalid API Key" })).toThrow(/API key is invalid/);
  });

  it("rejects malformed payloads", () => {
    expect(() => parseExplorerResponse("<html>")).toThrow(BlockchainError);
    expect(() => parseExplorerResponse(null)).toThrow(BlockchainError);
  });
});

describe("fetchTransactions", () => {
  it("never leaks the API key in errors", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED https://api.etherscan.io/v2/api?apikey=TOPSECRET"));
    const err = await fetchTransactions("0x1", 10, { apiKey: "TOPSECRET", fetchImpl }).catch((e) => e);
    expect(err).toBeInstanceOf(BlockchainError);
    expect(err.message).not.toContain("TOPSECRET");
  });

  it("maps HTTP 429 to a rate-limit error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("", { status: 429 }));
    await expect(fetchTransactions("0x1", 10, { fetchImpl })).rejects.toThrow(/rate limit/);
  });

  it("requests the newest transactions first with the given limit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({ status: "1", message: "OK", result: [] }));
    await fetchTransactions("0xabc", 25, { fetchImpl });
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.searchParams.get("action")).toBe("txlist");
    expect(url.searchParams.get("sort")).toBe("desc");
    expect(url.searchParams.get("offset")).toBe("25");
  });
});
