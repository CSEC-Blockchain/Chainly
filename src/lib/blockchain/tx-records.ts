import type { PreparedPreview } from "./signing-guard";

/**
 * Remembers which prepared previews were already submitted, so a preview
 * restored from chat history can never be signed (and sent) a second time.
 */

const STORAGE_KEY = "chainly-submitted-txs-v1";

type KeyFields =
  | { kind?: "eth_transfer"; preparedAt: string; from: string | null; to: string; valueWei: string }
  | { kind: "erc20_transfer"; preparedAt: string; from: string | null; to: string; amountRaw: string; token: { address: string } };

export function previewKey(p: KeyFields) {
  if (p.kind === "erc20_transfer") {
    return `${p.preparedAt}|${p.from ?? ""}|${p.token.address}|${p.to}|${p.amountRaw}`.toLowerCase();
  }
  return `${p.preparedAt}|${p.from ?? ""}|${p.to}|${p.valueWei}`.toLowerCase();
}

function readAll(): Record<string, `0x${string}`> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getSubmittedHash(preview: PreparedPreview): `0x${string}` | null {
  if (typeof window === "undefined") return null;
  return readAll()[previewKey(preview)] ?? null;
}

export function recordSubmittedHash(preview: PreparedPreview, hash: `0x${string}`) {
  try {
    const all = readAll();
    all[previewKey(preview)] = hash;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // storage unavailable — the in-memory card state still prevents re-signing
  }
}
