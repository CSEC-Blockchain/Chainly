import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

/**
 * Configurable LLM provider. Pick one with LLM_PROVIDER, or let Chainly
 * auto-detect from whichever API key is present. All keys stay server-side.
 */

export type ProviderId = "openai" | "anthropic" | "google" | "openai-compatible";

const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: "gpt-5-mini",
  anthropic: "claude-sonnet-5-5",
  google: "gemini-2.5-flash",
  "openai-compatible": "llama-3.3-70b-versatile",
};

const KEY_ENV: Record<ProviderId, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  "openai-compatible": "OPENAI_COMPATIBLE_BASE_URL",
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

  const provider =
    explicit ?? (Object.keys(KEY_ENV) as ProviderId[]).find((p) => Boolean(env[KEY_ENV[p]]));

  if (!provider) {
    return {
      configured: false,
      provider: null,
      modelId: null,
      reason: "No LLM provider is configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY or OPENAI_COMPATIBLE_BASE_URL in .env.local.",
    };
  }

  const modelId = env.LLM_MODEL?.trim() || DEFAULT_MODELS[provider];
  if (!env[KEY_ENV[provider]]) {
    return { configured: false, provider, modelId, reason: `LLM_PROVIDER is "${provider}" but ${KEY_ENV[provider]} is not set.` };
  }
  return { configured: true, provider, modelId };
}

export function getLanguageModel(config: Extract<ModelConfig, { configured: true }>): LanguageModel {
  const env = process.env;
  switch (config.provider) {
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
