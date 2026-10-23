import { describe, expect, it } from "vitest";
import { resolveModelConfig } from "@/lib/agent/model";

describe("resolveModelConfig", () => {
  it("defaults to the AI Gateway free model", () => {
    expect(resolveModelConfig({ AI_GATEWAY_API_KEY: "key" })).toEqual({
      configured: true,
      provider: "gateway",
      modelId: "nvidia/nemotron-3.5-lightning-free",
    });
  });

  it("uses the Vercel OIDC token when no gateway key is set", () => {
    expect(resolveModelConfig({ VERCEL_OIDC_TOKEN: "token" })).toMatchObject({ configured: true, provider: "gateway" });
  });

  it("reports the gateway as missing when nothing is configured", () => {
    const config = resolveModelConfig({});
    expect(config).toMatchObject({ configured: false, provider: "gateway" });
    if (!config.configured) expect(config.reason).toContain("AI_GATEWAY_API_KEY");
  });

  it("prefers the gateway over other keys when auto-detecting", () => {
    expect(resolveModelConfig({ AI_GATEWAY_API_KEY: "key", OPENAI_API_KEY: "sk" })).toMatchObject({ provider: "gateway" });
  });

  it("falls back to another provider whose key is set", () => {
    expect(resolveModelConfig({ OPENAI_API_KEY: "sk" })).toMatchObject({
      configured: true,
      provider: "openai",
      modelId: "gpt-5-mini",
    });
  });

  it("honours LLM_PROVIDER and LLM_MODEL", () => {
    const env = { LLM_PROVIDER: "Anthropic", LLM_MODEL: "claude-opus-5-5", ANTHROPIC_API_KEY: "k", AI_GATEWAY_API_KEY: "g" };
    expect(resolveModelConfig(env)).toEqual({ configured: true, provider: "anthropic", modelId: "claude-opus-5-5" });
  });

  it("overrides the gateway model with LLM_MODEL", () => {
    expect(resolveModelConfig({ AI_GATEWAY_API_KEY: "key", LLM_MODEL: "reflection/beam-free" })).toMatchObject({
      modelId: "reflection/beam-free",
    });
  });

  it("flags an explicit provider without its key", () => {
    const config = resolveModelConfig({ LLM_PROVIDER: "google", AI_GATEWAY_API_KEY: "key" });
    expect(config).toMatchObject({ configured: false, provider: "google" });
    if (!config.configured) expect(config.reason).toContain("GOOGLE_GENERATIVE_AI_API_KEY");
  });

  it("rejects an unknown provider", () => {
    expect(resolveModelConfig({ LLM_PROVIDER: "nope" })).toMatchObject({ configured: false, provider: null });
  });
});
