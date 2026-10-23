import { HttpRequestError, TransactionNotFoundError } from "viem";
import { describe, expect, it } from "vitest";
import { BlockchainError, toBlockchainError } from "@/lib/blockchain/errors";

describe("toBlockchainError", () => {
  it("maps RPC failures to RPC_ERROR without leaking the RPC URL / API key", () => {
    const err = new HttpRequestError({ url: "https://base-sepolia.g.alchemy.com/v2/SECRET_KEY_123", status: 503 });
    expect(err.message).toContain("SECRET_KEY_123"); // viem's raw message does leak it…
    const mapped = toBlockchainError(err);
    expect(mapped.code).toBe("RPC_ERROR");
    expect(mapped.message).not.toContain("SECRET_KEY_123"); // …ours does not.
  });

  it("maps not-found errors", () => {
    const mapped = toBlockchainError(new TransactionNotFoundError({ hash: `0x${"1".repeat(64)}` }));
    expect(mapped.code).toBe("NOT_FOUND");
  });

  it("passes BlockchainError through unchanged", () => {
    const original = new BlockchainError("INVALID_AMOUNT", "bad");
    expect(toBlockchainError(original)).toBe(original);
  });

  it("hides unknown error details", () => {
    const mapped = toBlockchainError(new Error("internal stack details"));
    expect(mapped.message).not.toContain("internal");
  });
});
