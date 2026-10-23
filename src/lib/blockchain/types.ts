import type { PublicClient, Transport } from "viem";
import type { CHAIN } from "./chain";

/** A viem public client bound to Ethereum Sepolia. */
export type ChainClient = PublicClient<Transport, typeof CHAIN>;
