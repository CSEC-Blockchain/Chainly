import type { PublicClient, Transport } from "viem";
import type { CHAIN } from "./chain";

/** A viem public client bound to Base Sepolia (includes OP-stack tx formatters). */
export type ChainClient = PublicClient<Transport, typeof CHAIN>;
