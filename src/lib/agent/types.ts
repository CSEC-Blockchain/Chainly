import type { UIMessage } from "ai";
import type { ChainlyUITools } from "./tools";

/** Fully typed chat message: tool parts are `tool-getEthBalance`, `tool-analyzeWallet`, ... */
export type ChainlyMessage = UIMessage<never, never, ChainlyUITools>;

export type ChainlyToolName = keyof ChainlyUITools;
