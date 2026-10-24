import { generateText, isStepCount } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { parseEther, parseGwei } from "viem";
import { describe, expect, it } from "vitest";
import { buildInstructions } from "@/lib/agent/prompt";
import { createChainlyTools } from "@/lib/agent/tools";
import { resolveModelConfig } from "@/lib/agent/model";
import { fakeClient } from "./fake-client";

const CONNECTED = "0x1111111111111111111111111111111111111111";
const ATTACKER = "0x6666666666666666666666666666666666666666";
const RECIPIENT = "0x2222222222222222222222222222222222222222";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

const client = fakeClient({
  estimateFeesPerGas: async () => ({ maxFeePerGas: parseGwei("0.002"), maxPriorityFeePerGas: parseGwei("0.001") }),
  getGasPrice: async () => parseGwei("0.0015"),
  getCode: async () => undefined,
  getBalance: async () => parseEther("1"),
  getBlockNumber: async () => 123n,
  estimateGas: async () => 21_000n,
});

function toolCallThenText(toolName: string, input: object, text: string) {
  return new MockLanguageModelV4({
    doGenerate: [
      {
        content: [{ type: "tool-call", toolCallId: "call-1", toolName, input: JSON.stringify(input) }],
        finishReason: { unified: "tool-calls", raw: undefined },
        usage,
        warnings: [],
      },
      { content: [{ type: "text", text }], finishReason: { unified: "stop", raw: undefined }, usage, warnings: [] },
    ],
  });
}

describe("agent tools", () => {
  it("exposes only read and prepare tools — nothing that signs or sends", () => {
    const tools = createChainlyTools({ client, connectedAddress: null, explorer: {} });
    expect(Object.keys(tools).sort()).toEqual(
      [
        "analyzeWallet",
        "decodeTransaction",
        "explainContract",
        "getBlock",
        "getEthBalance",
        "getNetworkStatus",
        "getTokenBalance",
        "getTransaction",
        "prepareTokenTransfer",
        "prepareTransaction",
      ].sort(),
    );
  });

  it("uses the connected wallet as sender even if the LLM tries to inject another 'from'", async () => {
    const tools = createChainlyTools({ client, connectedAddress: CONNECTED, explorer: {} });
    const result = await generateText({
      model: toolCallThenText("prepareTransaction", { to: RECIPIENT, amountEth: "0.001", from: ATTACKER }, "Prepared."),
      tools,
      prompt: "send 0.001 eth",
      stopWhen: isStepCount(3),
    });
    const toolResult = result.steps[0].toolResults[0];
    expect(toolResult.toolName).toBe("prepareTransaction");
    expect(toolResult.output).toMatchObject({ from: CONNECTED, to: RECIPIENT, readyToSign: true });
    expect(result.text).toBe("Prepared.");
  });

  it("feeds validation errors back to the model instead of crashing the loop", async () => {
    const tools = createChainlyTools({ client, connectedAddress: null, explorer: {} });
    const result = await generateText({
      model: toolCallThenText("getEthBalance", { address: "0xnot-valid" }, "That address looks invalid."),
      tools,
      prompt: "balance of 0xnot-valid",
      stopWhen: isStepCount(3),
    });
    const errorPart = result.steps[0].content.find((p) => p.type === "tool-error");
    expect(errorPart).toBeDefined();
    expect(String((errorPart as { error: Error }).error.message)).toMatch(/not a valid address/);
    expect(result.text).toBe("That address looks invalid.");
  });

  it("defaults 'my balance' to the connected wallet", async () => {
    const tools = createChainlyTools({ client, connectedAddress: CONNECTED, explorer: {} });
    const result = await generateText({
      model: toolCallThenText("getEthBalance", {}, "You have 1 ETH."),
      tools,
      prompt: "my balance?",
      stopWhen: isStepCount(3),
    });
    expect(result.steps[0].toolResults[0].output).toMatchObject({ address: CONNECTED, balanceEth: "1" });
  });

  it("asks for a wallet when none is connected and no address is given", async () => {
    const tools = createChainlyTools({ client, connectedAddress: null, explorer: {} });
    await expect(tools.getEthBalance.execute!({}, { toolCallId: "x", messages: [] } as never)).rejects.toThrow(/no wallet is connected/);
  });
});

describe("instructions", () => {
  it("mentions the connected wallet and the no-signing rule", () => {
    const text = buildInstructions({ connectedAddress: CONNECTED });
    expect(text).toContain(CONNECTED);
    expect(text).toMatch(/NEVER sign/);
    expect(buildInstructions({ connectedAddress: null })).toMatch(/NOT connected/);
  });
});

describe("resolveModelConfig", () => {
  it("auto-detects the provider from available keys", () => {
    expect(resolveModelConfig({ ANTHROPIC_API_KEY: "x" })).toMatchObject({ configured: true, provider: "anthropic" });
    expect(resolveModelConfig({ OPENAI_API_KEY: "x", LLM_MODEL: "gpt-x" })).toMatchObject({ provider: "openai", modelId: "gpt-x" });
  });

  it("reports missing configuration without throwing", () => {
    expect(resolveModelConfig({})).toMatchObject({ configured: false });
    expect(resolveModelConfig({ LLM_PROVIDER: "google" })).toMatchObject({ configured: false, reason: expect.stringMatching(/GOOGLE_GENERATIVE_AI_API_KEY/) });
    expect(resolveModelConfig({ LLM_PROVIDER: "foo" })).toMatchObject({ configured: false, reason: expect.stringMatching(/Unknown/) });
  });
});
