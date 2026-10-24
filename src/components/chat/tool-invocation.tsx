"use client";

import { AlertCircle, Check, ChevronRight, Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { ActivityCard } from "@/components/cards/activity-card";
import { ContractCard, DecodedTransactionCard } from "@/components/cards/insight-cards";
import { BalanceCard, BlockCard, NetworkCard, TokenBalanceCard, TransactionCard } from "@/components/cards/read-cards";
import { TransactionPreviewCard } from "@/components/cards/transaction-preview-card";
import { useCopy } from "@/hooks/use-copy";
import type { ChainlyMessage, ChainlyToolName } from "@/lib/agent/types";
import { cn } from "@/lib/utils";

export type ToolPart = Extract<ChainlyMessage["parts"][number], { type: `tool-${string}` }>;

const TOOL_LABELS: Record<ChainlyToolName, { running: string; done: string }> = {
  getEthBalance: { running: "Reading ETH balance", done: "Read ETH balance" },
  getTokenBalance: { running: "Reading token balance", done: "Read token balance" },
  getTransaction: { running: "Fetching transaction", done: "Fetched transaction" },
  decodeTransaction: { running: "Decoding transaction", done: "Decoded transaction" },
  explainContract: { running: "Inspecting contract", done: "Inspected contract" },
  getNetworkStatus: { running: "Checking network status", done: "Checked network status" },
  getBlock: { running: "Fetching block", done: "Fetched block" },
  analyzeWallet: { running: "Analyzing wallet history", done: "Analyzed wallet history" },
  prepareTransaction: { running: "Validating & preparing transaction", done: "Prepared transaction" },
  prepareTokenTransfer: { running: "Validating & preparing token transfer", done: "Prepared token transfer" },
};

/** One tool call: a compact, expandable step plus its rich result card. */
export function ToolInvocation({ part, onAskAgent }: { part: ToolPart; onAskAgent?: (text: string) => void }) {
  const name = part.type.slice(5) as ChainlyToolName;
  const labels = TOOL_LABELS[name] ?? { running: `Running ${name}`, done: name };
  const running = part.state === "input-streaming" || part.state === "input-available";
  const failed = part.state === "output-error" || part.state === "output-denied";
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2.5">
      <div className={cn("rounded-lg border transition-colors", open && "border-border-strong", failed && "border-destructive/30")}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="group flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px]"
          aria-expanded={open}
        >
          <StatusDot running={running} failed={failed} />
          <span className={cn("truncate", running ? "text-shimmer" : failed ? "text-destructive" : "text-foreground")}>
            {running ? `${labels.running}…` : failed ? `${labels.running} failed` : labels.done}
          </span>
          <code className="hidden truncate font-mono text-[11px] text-subtle-foreground sm:inline">{name}</code>
          <ChevronRight className={cn("ml-auto size-3.5 shrink-0 text-subtle-foreground transition-transform duration-200 group-hover:text-foreground", open && "rotate-90")} />
        </button>

        <div className={cn("grid transition-[grid-template-rows] duration-200 ease-out", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
            <div className="space-y-3 border-t px-3 py-3">
              <Payload label="Input" value={part.input ?? {}} />
              {part.state === "output-available" && <Payload label="Output" value={part.output} />}
            </div>
          </div>
        </div>

        {part.state === "output-error" && (
          <div className="border-t border-destructive/20 px-3 py-2 text-[13px] text-destructive">{part.errorText}</div>
        )}
      </div>

      {part.state === "output-available" && <ToolResult part={part} onAskAgent={onAskAgent} />}
    </div>
  );
}

function StatusDot({ running, failed }: { running: boolean; failed: boolean }) {
  if (running) return <Loader2 className="size-3.5 shrink-0 animate-spin text-accent" />;
  if (failed) return <AlertCircle className="size-3.5 shrink-0 text-destructive" />;
  return (
    <span className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
      <Check className="size-2.5" strokeWidth={3} />
    </span>
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
    case "tool-decodeTransaction":
      return <DecodedTransactionCard data={part.output} />;
    case "tool-explainContract":
      return <ContractCard data={part.output} />;
    case "tool-getNetworkStatus":
      return <NetworkCard data={part.output} />;
    case "tool-getBlock":
      return <BlockCard data={part.output} />;
    case "tool-analyzeWallet":
      return <ActivityCard data={part.output} />;
    case "tool-prepareTransaction":
      return <TransactionPreviewCard data={part.output} onAskAgent={onAskAgent} />;
    case "tool-prepareTokenTransfer":
      return <TransactionPreviewCard data={part.output} onAskAgent={onAskAgent} />;
    default:
      return null;
  }
}

function Payload({ label, value }: { label: string; value: unknown }) {
  const json = JSON.stringify(value, null, 2);
  const { copied, copy } = useCopy();
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium text-subtle-foreground">{label}</span>
        <button
          type="button"
          onClick={() => copy(json)}
          className="flex items-center gap-1 text-[11px] text-subtle-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="scrollbar-thin max-h-60 overflow-auto rounded-md bg-surface p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {json}
      </pre>
    </div>
  );
}
