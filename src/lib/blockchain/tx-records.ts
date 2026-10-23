import type { PreparedTransfer } from "./transfer";

/**
 * Remembers which prepared previews were already submitted, so a preview
 * restored from chat history can never be signed (and sent) a second time.
 */

const STORAGE_KEY = "chainly-submitted-txs-v1";

export function previewKey(p: Pick<PreparedTransfer, "preparedAt" | "from" | "to" | "valueWei">) {
  return `${p.preparedAt}|${p.from ?? ""}|${p.to}|${p.valueWei}`.toLowerCase();
}

function readAll(): Record<string, `0x${string}`> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getSubmittedHash(preview: PreparedTransfer): `0x${string}` | null {
  if (typeof window === "undefined") return null;
  return readAll()[previewKey(preview)] ?? null;
}

export function recordSubmittedHash(preview: PreparedTransfer, hash: `0x${string}`) {
  try {
    const all = readAll();
    all[previewKey(preview)] = hash;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // storage unavailable — the in-memory card state still prevents re-signing
  }
}
