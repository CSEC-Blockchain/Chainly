"use client";

import {
  AlertTriangle,
  ArrowDown,
  CheckCircle2,
  CircleX,
  ExternalLink,
  Loader2,
  PenLine,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useConnection, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortError } from "@/components/wallet/connect-button";
import { CHAIN, explorerTxUrl } from "@/lib/blockchain/chain";
import { guardPreparedTransfer } from "@/lib/blockchain/signing-guard";
import type { PreparedTransfer } from "@/lib/blockchain/transfer";
import { cn } from "@/lib/utils";
import { AddressLink, HashLink, ResultCard, Row } from "./primitives";

type Props = {
  data: PreparedTransfer;
  /** Lets the user hand the tx hash back to the agent for verification. */
  onAskAgent?: (text: string) => void;
};

/**
 * The human-in-the-loop step. The agent produced `data`; nothing happens until
 * the user clicks "Approve & sign", which opens *their* wallet.
 */
export function TransactionPreviewCard({ data, onAskAgent }: Props) {
  const { address, chainId } = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, isPending: isSigning } = useSendTransaction();
  const [hash, setHash] = useState<`0x${string}` | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const receipt = useWaitForTransactionReceipt({ hash: hash ?? undefined, chainId: CHAIN.id, query: { enabled: Boolean(hash) } });

  const failedChecks = data.checks.filter((c) => !c.passed);

  async function approve() {
    const guard = guardPreparedTransfer(data, { address });
    if (!guard.ok) {
      toast.error("Transaction blocked", { description: guard.reasons.join(" ") });
      return;
    }
    try {
      if (chainId !== CHAIN.id) await switchChainAsync({ chainId: CHAIN.id });
      const txHash = await sendTransactionAsync(guard.request);
      setHash(txHash);
      toast.success("Transaction submitted", { description: "Waiting for confirmation on Base Sepolia…" });
    } catch (e) {
      const msg = shortError(e);
      if (/rejected|denied|cancel/i.test(msg)) toast.info("You rejected the request in your wallet. Nothing was sent.");
      else toast.error("Transaction failed", { description: msg });
    }
  }

  const state = dismissed
    ? "dismissed"
    : hash
      ? receipt.data
        ? receipt.data.status === "success"
          ? "confirmed"
          : "reverted"
        : receipt.isError
          ? "unknown"
          : "submitted"
      : isSigning
        ? "signing"
        : "ready";

  return (
    <ResultCard className={cn("relative", state === "ready" && data.readyToSign && "border-primary/40 shadow-[0_0_40px_-12px_var(--glow)]")}>
      <div className="flex items-center gap-3 border-b bg-gradient-to-r from-primary/15 to-transparent px-4 py-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Send className="size-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">Transaction preview</div>
          <div className="text-xs text-muted-foreground">Prepared by the agent · requires your approval</div>
        </div>
        <StateBadge state={state} ready={data.readyToSign} />
      </div>

      <div className="px-4 pt-4">
        <div className="rounded-xl border bg-background/40 p-4 text-center">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">You send</div>
          <div className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">
            {data.valueEth} <span className="text-lg font-normal text-muted-foreground">ETH</span>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <AddressLink address={data.from} /> <ArrowDown className="size-3 -rotate-90" /> <AddressLink address={data.to} />
          </div>
        </div>
      </div>

      <div className="divide-y px-4 py-2">
        <Row label="Network"><span>{data.network} <span className="text-muted-foreground">({data.chainId})</span></span></Row>
        <Row label="Estimated fee">{data.estimatedFeeEth} ETH</Row>
        <Row label="Max fee">
          <span className="text-muted-foreground">{data.maxFeeEth} ETH · {data.maxFeePerGasGwei} gwei</span>
        </Row>
        <Row label="Gas limit">{Number(data.gasLimit).toLocaleString()}</Row>
        <Row label="Max total cost"><span className="font-medium">{data.totalCostEth} ETH</span></Row>
        {data.balanceEth && (
          <Row label="Balance → after">
            {data.balanceEth} → {data.balanceAfterEth ?? "insufficient"} ETH
          </Row>
        )}
      </div>

      <div className="space-y-1.5 border-t bg-background/20 px-4 py-3">
        {data.checks.map((c) => (
          <div key={c.id} className="flex items-start gap-2 text-xs">
            {c.passed ? <CheckCircle2 className="mt-px size-3.5 shrink-0 text-success" /> : <CircleX className="mt-px size-3.5 shrink-0 text-destructive" />}
            <span className="font-medium">{c.label}</span>
            <span className="min-w-0 truncate text-muted-foreground" title={c.detail}>{c.detail}</span>
          </div>
        ))}
        {data.warnings.map((w) => (
          <div key={w} className="flex items-start gap-2 text-xs text-warning">
            <AlertTriangle className="mt-px size-3.5 shrink-0" /> {w}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3">
        {state === "ready" && (
          <>
            <Button onClick={approve} disabled={!data.readyToSign || !address} className="flex-1 sm:flex-none">
              <PenLine /> Approve &amp; sign in wallet
            </Button>
            <Button variant="ghost" onClick={() => setDismissed(true)}>Cancel</Button>
            {!data.readyToSign && (
              <span className="text-xs text-muted-foreground">
                {failedChecks.length} check{failedChecks.length > 1 ? "s" : ""} failed — signing disabled.
              </span>
            )}
            {data.readyToSign && !address && <span className="text-xs text-muted-foreground">Connect your wallet to sign.</span>}
          </>
        )}
        {state === "signing" && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Confirm the transaction in your wallet…
          </span>
        )}
        {(state === "submitted" || state === "confirmed" || state === "reverted" || state === "unknown") && hash && (
          <div className="flex w-full flex-wrap items-center gap-2 text-sm">
            {state === "submitted" && <Loader2 className="size-4 animate-spin text-primary" />}
            {state === "confirmed" && <CheckCircle2 className="size-4 text-success" />}
            {state === "reverted" && <XCircle className="size-4 text-destructive" />}
            <span>
              {state === "submitted" ? "Pending" : state === "confirmed" ? "Confirmed" : state === "reverted" ? "Reverted" : "Submitted"}
            </span>
            <HashLink hash={hash} />
            <div className="ml-auto flex gap-2">
              {onAskAgent && state !== "submitted" && (
                <Button size="sm" variant="outline" onClick={() => onAskAgent(`Check the status of transaction ${hash}`)}>
                  Ask agent to verify
                </Button>
              )}
              <Button size="sm" variant="outline" asChild>
                <a href={explorerTxUrl(hash)} target="_blank" rel="noreferrer">
                  BaseScan <ExternalLink />
                </a>
              </Button>
            </div>
          </div>
        )}
        {state === "dismissed" && <span className="text-sm text-muted-foreground">Cancelled — nothing was signed or sent.</span>}
      </div>
    </ResultCard>
  );
}

function StateBadge({ state, ready }: { state: string; ready: boolean }) {
  if (state === "confirmed") return <Badge variant="success"><CheckCircle2 /> Confirmed</Badge>;
  if (state === "reverted") return <Badge variant="destructive"><XCircle /> Reverted</Badge>;
  if (state === "submitted" || state === "unknown") return <Badge><Loader2 className="animate-spin" /> Submitted</Badge>;
  if (state === "signing") return <Badge><PenLine /> Signing</Badge>;
  if (state === "dismissed") return <Badge variant="secondary">Cancelled</Badge>;
  return ready ? <Badge variant="success"><ShieldCheck /> Checks passed</Badge> : <Badge variant="destructive"><AlertTriangle /> Blocked</Badge>;
}
