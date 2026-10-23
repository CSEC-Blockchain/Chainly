import { describe, expect, it } from "vitest";
import { parseEther } from "viem";
import { BlockchainError } from "@/lib/blockchain/errors";
import { trimDecimals } from "@/lib/blockchain/format";
import { parseAddress, parseEthAmount, parseTxHash } from "@/lib/blockchain/validation";

const CHECKSUMMED = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";

describe("parseAddress", () => {
  it("checksums a lowercase address", () => {
    expect(parseAddress(CHECKSUMMED.toLowerCase())).toBe(CHECKSUMMED);
  });

  it("accepts a correctly checksummed address and trims whitespace", () => {
    expect(parseAddress(`  ${CHECKSUMMED} `)).toBe(CHECKSUMMED);
  });

  it("rejects a mixed-case address with a bad checksum (likely typo)", () => {
    const typo = CHECKSUMMED.replace("aA", "Aa");
    expect(() => parseAddress(typo)).toThrow(/checksum/);
  });

  it.each(["", "0x123", "hello", "0xZZZeb6053F3E94C9b9A09f33669435E7Ef1BeAed", "vitalik.eth"])(
    "rejects invalid input %j",
    (value) => {
      expect(() => parseAddress(value)).toThrow(BlockchainError);
    },
  );
});

describe("parseTxHash", () => {
  it("accepts a 32-byte hash", () => {
    const hash = `0x${"ab".repeat(32)}`;
    expect(parseTxHash(hash.toUpperCase().replace("0X", "0x"))).toBe(hash);
  });

  it("rejects an address passed as hash", () => {
    expect(() => parseTxHash(CHECKSUMMED)).toThrow(/not a valid transaction hash/);
  });
});

describe("parseEthAmount", () => {
  it.each([
    ["0.001", parseEther("0.001")],
    ["0.001 ETH", parseEther("0.001")],
    [".5", parseEther("0.5")],
    [0.0000001, parseEther("0.0000001")],
    ["0.000000000000000001", 1n],
  ])("parses %j", (input, expected) => {
    expect(parseEthAmount(input)).toBe(expected);
  });

  it.each(["0", "0.0", "-1", "abc", "1e18", "", "0.0000000000000000001"])("rejects %j", (input) => {
    expect(() => parseEthAmount(input)).toThrow(BlockchainError);
  });

  it("rejects comma amounts instead of guessing the locale", () => {
    expect(() => parseEthAmount("1,5")).toThrow(/Ambiguous/);
    expect(() => parseEthAmount("1,000")).toThrow(/Ambiguous/);
  });

  it("enforces the safety ceiling", () => {
    expect(() => parseEthAmount("10.000001")).toThrow(/up to 10 ETH/);
    expect(parseEthAmount("10")).toBe(parseEther("10"));
  });
});

describe("trimDecimals", () => {
  it("cuts to max decimals and strips trailing zeros", () => {
    expect(trimDecimals("1.234567890", 4)).toBe("1.2345");
    expect(trimDecimals("2.500000", 6)).toBe("2.5");
    expect(trimDecimals("3", 6)).toBe("3");
  });

  it("keeps significant digits for tiny values instead of showing 0", () => {
    expect(trimDecimals("0.0000000123", 6)).toBe("0.0000000123");
    expect(trimDecimals("0.000000000000000001", 6)).toBe("0.000000000000000001");
  });
});
