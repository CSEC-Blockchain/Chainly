import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { isAddress, getAddress } from "viem";
import { getLanguageModel, resolveModelConfig } from "@/lib/agent/model";
import { buildInstructions } from "@/lib/agent/prompt";
import { createChainlyTools } from "@/lib/agent/tools";
import { getPublicClient } from "@/lib/blockchain/client";
import { BlockchainError } from "@/lib/blockchain/errors";

export const maxDuration = 60;

type ChatRequest = { messages?: UIMessage[]; connectedAddress?: string | null };

/**
 * The agent loop:
 *   browser (useChat) ──POST──▶ this route ──▶ LLM ⇄ tools (viem / explorer)
 *                     ◀─stream── text + tool calls + tool results
 */
export async function POST(req: Request) {
  const modelConfig = resolveModelConfig();
  if (!modelConfig.configured) {
    return Response.json({ error: modelConfig.reason }, { status: 503 });
  }

  let body: ChatRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages must be a non-empty array." }, { status: 400 });
  }

  // The connected wallet is only used as the *sender* of prepared transactions.
  // It grants no signing ability — the browser wallet still has to approve.
  const connectedAddress =
    body.connectedAddress && isAddress(body.connectedAddress) ? getAddress(body.connectedAddress) : null;

  const tools = createChainlyTools({
    client: getPublicClient(),
    connectedAddress,
    explorer: { apiKey: process.env.ETHERSCAN_API_KEY || undefined },
  });

  const result = streamText({
    model: getLanguageModel(modelConfig),
    instructions: buildInstructions({ connectedAddress }),
    messages: await convertToModelMessages(body.messages.slice(-30)),
    tools,
    stopWhen: isStepCount(8),
    abortSignal: req.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream, onError: toSafeErrorMessage }),
  });
}

/** Errors shown in the UI: friendly for known errors, generic otherwise (no secrets/URLs). */
function toSafeErrorMessage(error: unknown): string {
  if (error instanceof BlockchainError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  if (/api key|apikey|unauthorized|401|authentication/i.test(message)) {
    return "The LLM provider rejected the request. Check the API key configured on the server.";
  }
  if (/rate limit|429|quota/i.test(message)) {
    return "The LLM provider is rate limiting requests. Please wait a moment and try again.";
  }
  if (/model.*(not found|does not exist)|404/i.test(message)) {
    return "The configured LLM model was not found. Check LLM_MODEL on the server.";
  }
  console.error("[chat] unexpected error:", error);
  return "Something went wrong while running the agent. Please try again.";
}
