import { formatEther, formatGwei, formatUnits } from "viem";

/** Format wei as ETH with a sensible number of significant digits. */
export function formatEth(wei: bigint, maxDecimals = 6): string {
  return trimDecimals(formatEther(wei), maxDecimals);
}

export function formatToken(amount: bigint, decimals: number, maxDecimals = 6): string {
  return trimDecimals(formatUnits(amount, decimals), maxDecimals);
}

export function formatGweiValue(wei: bigint, maxDecimals = 4): string {
  return trimDecimals(formatGwei(wei), maxDecimals);
}

/**
 * Trim a decimal string to `maxDecimals` places without rounding up to zero:
 * tiny non-zero values keep their first significant digits instead.
 */
export function trimDecimals(value: string, maxDecimals: number): string {
  const [int, frac = ""] = value.split(".");
  if (!frac) return int;
  let cut = frac.slice(0, maxDecimals).replace(/0+$/, "");
  if (!cut && /[1-9]/.test(frac) && int.replace("-", "") === "0") {
    const firstSig = frac.search(/[1-9]/);
    cut = frac.slice(0, firstSig + 3).replace(/0+$/, "");
  }
  return cut ? `${int}.${cut}` : int;
}

export function shortAddress(address: string, chars = 4) {
  if (!address || address.length < 2 + chars * 2) return address;
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`;
}

export function shortHash(hash: string) {
  return shortAddress(hash, 6);
}
