"use client";

import { AlertCircle, Check, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { ActivityCard } from "@/components/cards/activity-card";
import { BalanceCard, BlockCard, NetworkCard, TokenBalanceCard, TransactionCard } from "@/components/cards/read-cards";
import { TransactionPreviewCard } from "@/components/cards/transaction-preview-card";
import type { ChainlyMessage, ChainlyToolName } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

type ToolPart = Extract<ChainlyMessage["parts"][number], { type: `tool-${string}` }>;

const TOOL_LABELS: Record<ChainlyToolName, { running: string; done: string }> = {
  getEthBalance: { running: "Reading ETH balance", done: "Read ETH balance" },
  getTokenBalance: { running: "Reading ERC-20 balance", done: "Read token balance" },
  getTransaction: { running: "Fetching transaction", done: "Fetched transaction" },
  getNetworkStatus: { running: "Checking gas & latest block", done: "Checked network status" },
  getBlock: { running: "Fetching block", done: "Fetched block" },
  analyzeWallet: { running: "Analyzing wallet history", done: "Analyzed wallet history" },
  prepareTransaction: { running: "Validating & preparing transaction", done: "Prepared transaction" },
};

export function ToolInvocation({ part, onAskAgent }: { part: ToolPart; onAskAgent?: (text: string) => void }) {
  const name = part.type.slice(5) as ChainlyToolName;
  const labels = TOOL_LABELS[name] ?? { running: `Running ${name}`, done: name };
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error" || part.state === "output-denied";
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="rounded-lg border bg-card/40 text-xs">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left"
          aria-expanded={open}
        >
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-full border",
              running && "border-primary/40 text-primary",
              failed && "border-destructive/40 text-destructive",
              !running && !failed && "border-success/40 text-success",
            )}
          >
            {running ? <Loader2 className="size-3 animate-spin" /> : failed ? <AlertCircle className="size-3" /> : <Check className="size-3" />}
          </span>
          <span className={cn("font-medium", running && "shimmer-text")}>{running ? `${labels.running}…` : failed ? `${labels.running} failed` : labels.done}</span>
          <code className="hidden font-mono text-[11px] text-muted-foreground sm:inline">{name}</code>
          <ChevronRight className={cn("ml-auto size-3.5 text-muted-foreground transition-transform", open && "rotate-90")} />
        </button>
        {open && (
          <div className="space-y-2 border-t px-3 py-2">
            <Payload label="Input" value={part.input ?? {}} />
            {part.state === "output-available" && <Payload label="Output" value={part.output} />}
          </div>
        )}
        {part.state === "output-error" && (
          <div className="border-t border-destructive/20 bg-destructive/5 px-3 py-2 text-destructive">{part.errorText}</div>
        )}
      </div>
      {part.state === "output-available" && <ToolResult part={part} onAskAgent={onAskAgent} />}
    </div>
  );
}

function ToolResult({ part, onAskAgent }: { part: ToolPart; onAskAgent?: (text: string) => void }) {
  if (part.state !== "output-available") return null;
  switch (part.type) {
    case "tool-getEthBalance":
      return <BalanceCard data={part.output} />;
    case "tool-getTokenBalance":
      return <TokenBalanceCard data={part.output} />;
    case "tool-getTransaction":
      return <TransactionCard data={part.output} />;
    case "tool-getNetworkStatus":
      return <NetworkCard data={part.output} />;
    case "tool-getBlock":
      return <BlockCard data={part.output} />;
    case "tool-analyzeWallet":
      return <ActivityCard data={part.output} />;
    case "tool-prepareTransaction":
      return <TransactionPreviewCard data={part.output} onAskAgent={onAskAgent} />;
    default:
      return null;
  }
}

function Payload({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <pre className="scrollbar-thin max-h-56 overflow-auto rounded-md bg-background/60 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
