import { connection } from "next/server";
import { resolveModelConfig } from "@/lib/agent/model";
import { explorerName } from "@/lib/blockchain/explorer";

/** Non-secret runtime info for the dashboard header (never returns keys). */
export async function GET() {
  await connection();
  const model = resolveModelConfig();
  return Response.json({
    llm: model.configured
      ? { configured: true, provider: model.provider, model: model.modelId }
      : { configured: false, reason: model.reason },
    explorer: explorerName({ apiKey: process.env.ETHERSCAN_API_KEY }),
    customRpc: Boolean(process.env.BASE_SEPOLIA_RPC_URL),
  });
}
