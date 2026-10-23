import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createGateway, type LanguageModel } from "ai";

/**
 * Configurable LLM provider. Defaults to the Vercel AI Gateway with a free
 * model. Pick another with LLM_PROVIDER, or let Chainly auto-detect from
 * whichever API key is present. All keys stay server-side.
 */

export type ProviderId = "gateway" | "openai" | "anthropic" | "google" | "openai-compatible";

export const DEFAULT_PROVIDER: ProviderId = "gateway";

const DEFAULT_MODELS: Record<ProviderId, string> = {
  // Free on AI Gateway (served by NVIDIA), supports tool calling.
  gateway: "nvidia/nemotron-3.5-lightning-free",
  openai: "gpt-5-mini",
  anthropic: "claude-sonnet-5-5",
  google: "gemini-2.5-flash",
  "openai-compatible": "llama-3.3-70b-versatile",
};

/** Env vars that configure each provider; any one of them is enough. Order = auto-detect priority. */
const KEY_ENV: Record<ProviderId, string[]> = {
  // On Vercel deployments the OIDC token is injected automatically, so no key is needed.
  gateway: ["AI_GATEWAY_API_KEY", "VERCEL_OIDC_TOKEN"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  google: ["GOOGLE_GENERATIVE_AI_API_KEY"],
  "openai-compatible": ["OPENAI_COMPATIBLE_BASE_URL"],
};

export type ModelConfig =
  | { configured: true; provider: ProviderId; modelId: string }
  | { configured: false; provider: ProviderId | null; modelId: string | null; reason: string };

export function resolveModelConfig(env: Record<string, string | undefined> = process.env): ModelConfig {
  const explicit = env.LLM_PROVIDER?.trim().toLowerCase() as ProviderId | undefined;
  if (explicit && !(explicit in DEFAULT_MODELS)) {
    return {
      configured: false,
      provider: null,
      modelId: null,
      reason: `Unknown LLM_PROVIDER "${explicit}". Use one of: ${Object.keys(DEFAULT_MODELS).join(", ")}.`,
    };
  }

  const hasKey = (p: ProviderId) => KEY_ENV[p].some((name) => Boolean(env[name]));
  const provider =
    explicit || (Object.keys(KEY_ENV) as ProviderId[]).find(hasKey) || DEFAULT_PROVIDER;

  const modelId = env.LLM_MODEL?.trim() || DEFAULT_MODELS[provider];
  if (!hasKey(provider)) {
    const reason =
      provider === "gateway"
        ? "No LLM provider is configured. Set AI_GATEWAY_API_KEY in .env.local (or deploy on Vercel), or pick another provider with LLM_PROVIDER."
        : `LLM_PROVIDER is "${provider}" but ${KEY_ENV[provider][0]} is not set.`;
    return { configured: false, provider, modelId, reason };
  }
  return { configured: true, provider, modelId };
}

export function getLanguageModel(config: Extract<ModelConfig, { configured: true }>): LanguageModel {
  const env = process.env;
  switch (config.provider) {
    case "gateway":
      // Without an API key the gateway falls back to the Vercel OIDC token.
      return createGateway({ apiKey: env.AI_GATEWAY_API_KEY || undefined })(config.modelId);
    case "openai":
      return createOpenAI({ apiKey: env.OPENAI_API_KEY })(config.modelId);
    case "anthropic":
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(config.modelId);
    case "google":
      return createGoogle({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })(config.modelId);
    case "openai-compatible":
      // Groq, OpenRouter, Together, Ollama, LM Studio, ...
      return createOpenAICompatible({
        name: "openai-compatible",
        baseURL: env.OPENAI_COMPATIBLE_BASE_URL!,
        apiKey: env.OPENAI_COMPATIBLE_API_KEY,
      }).chatModel(config.modelId);
  }
}
