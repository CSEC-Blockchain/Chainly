import { BaseError } from "viem";

export type BlockchainErrorCode =
  | "INVALID_ADDRESS"
  | "INVALID_AMOUNT"
  | "INVALID_HASH"
  | "NOT_FOUND"
  | "RPC_ERROR"
  | "EXPLORER_ERROR"
  | "INSUFFICIENT_FUNDS"
  | "WALLET_NOT_CONNECTED"
  | "UNKNOWN";

/**
 * An error whose message is safe to show to users and to the LLM.
 * Never put RPC URLs, API keys or stack traces in `message`.
 */
export class BlockchainError extends Error {
  readonly code: BlockchainErrorCode;

  constructor(code: BlockchainErrorCode, message: string) {
    super(message);
    this.name = "BlockchainError";
    this.code = code;
  }
}

/**
 * Convert any thrown value into a BlockchainError with a clean message.
 *
 * viem errors include request details (such as the RPC URL, which may embed an
 * API key) in their `message`, so we only ever surface the `shortMessage`.
 */
export function toBlockchainError(error: unknown): BlockchainError {
  if (error instanceof BlockchainError) return error;

  if (error instanceof BaseError) {
    const name = error.walk((e) => e instanceof BaseError && e.name !== error.name)?.name ?? error.name;
    const short = error.shortMessage;

    if (/NotFound/i.test(error.name) || /could not be found/i.test(short)) {
      return new BlockchainError("NOT_FOUND", short);
    }
    if (/InsufficientFunds/i.test(name) || /insufficient funds/i.test(short)) {
      return new BlockchainError(
        "INSUFFICIENT_FUNDS",
        "The sender does not have enough ETH to cover the amount plus gas.",
      );
    }
    if (/InvalidAddress/i.test(error.name)) {
      return new BlockchainError("INVALID_ADDRESS", short);
    }
    if (/HttpRequest|Timeout|RpcRequest|WebSocket|Fallback/i.test(name) || /HTTP request failed|took too long/i.test(short)) {
      return new BlockchainError(
        "RPC_ERROR",
        "The Base Sepolia RPC endpoint is unavailable or timed out. Please try again in a moment.",
      );
    }
    return new BlockchainError("UNKNOWN", short);
  }

  if (error instanceof Error && error.name === "TimeoutError") {
    return new BlockchainError("RPC_ERROR", "The request timed out. Please try again.");
  }

  return new BlockchainError("UNKNOWN", "An unexpected error occurred while reading the blockchain.");
}
