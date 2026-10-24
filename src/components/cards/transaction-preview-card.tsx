"use client";

import { AlertTriangle, ArrowRight, Check, CheckCircle2, Clock, ExternalLink, Loader2, PenLine, RotateCcw, ShieldCheck, X, XCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useConnection, useSendTransaction, useSwitchChain, useWaitForTransactionReceipt } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shortError } from "@/components/wallet/connect-button";
import { CHAIN_ID, explorerTxUrl, NETWORK_NAME } from "@/lib/blockchain/chain";
import { guardPreparedTransfer, PREVIEW_TTL_MS } from "@/lib/blockchain/signing-guard";
import { getSubmittedHash, recordSubmittedHash } from "@/lib/blockchain/tx-records";
import type { PreparedTransfer } from "@/lib/blockchain/transfer";
import { cn } from "@/lib/utils";
import { AddressLink, HashLink, ResultCard, Row } from "./primitives";

type Props = {
  data: PreparedTransfer;
  /** Hands the tx hash back to the agent for verification. */
  onAskAgent?: (text: string) => void;
};

type State = "ready" | "signing" | "submitted" | "confirmed" | "reverted" | "dismissed" | "expired";

/**
 * The human-in-the-loop step. The agent produced `data`; nothing happens until
 * the user clicks "Approve in wallet", which opens *their* wallet to sign.
 */
export function TransactionPreviewCard({ data, onAskAgent }: Props) {
  const { address, chainId } = useConnection();
  const { switchChainAsync } = useSwitchChain();
  const { sendTransactionAsync, isPending: isSigning } = useSendTransaction();
  // Restore a previous submission so a reopened chat can never re-send it.
  const [hash, setHash] = useState<`0x${string}` | null>(() => getSubmittedHash(data));
  const [openedAt] = useState(() => Date.now());
  const expiredOnOpen = openedAt - new Date(data.preparedAt).getTime() > PREVIEW_TTL_MS;
  const [dismissed, setDismissed] = useState(false);
  const receipt = useWaitForTransactionReceipt({ hash: hash ?? undefined, chainId: CHAIN_ID, query: { enabled: Boolean(hash) } });

  const failedChecks = data.checks.filter((c) => !c.passed);

  async function approve() {
    const guard = guardPreparedTransfer(data, { address });
    if (!guard.ok) {
      toast.error("Transaction blocked", { description: guard.reasons.join(" ") });
      return;
    }
    try {
      if (chainId !== CHAIN_ID) await switchChainAsync({ chainId: CHAIN_ID });
      const txHash = await sendTransactionAsync(guard.request);
      recordSubmittedHash(data, txHash);
      setHash(txHash);
      toast("Transaction submitted", { description: `Waiting for confirmation on ${NETWORK_NAME}…` });
    } catch (e) {
      const msg = shortError(e);
      if (/rejected|denied|cancel/i.test(msg)) toast("Request rejected in your wallet", { description: "Nothing was signed or sent." });
      else toast.error("Transaction failed", { description: msg });
    }
  }

  const state: State = dismissed
    ? "dismissed"
    : hash
      ? receipt.data
        ? receipt.data.status === "success"
          ? "confirmed"
          : "reverted"
        : "submitted"
      : isSigning
        ? "signing"
        : expiredOnOpen
          ? "expired"
          : "ready";

  return (
    <ResultCard className={cn(state === "ready" && data.readyToSign && "border-border-strong", (state === "dismissed" || state === "expired") && "opacity-80")}>
      <div className="flex items-center gap-2.5 border-b px-4 py-2.5">
        <PenLine className="size-4 text-muted-foreground" />
        <span className="text-[13px] font-medium">Transaction preview</span>
        <span className="hidden text-xs text-subtle-foreground sm:inline">requires your approval</span>
        <span className="ml-auto">
          <StateBadge state={state} ready={data.readyToSign} />
        </span>
      </div>

      <div className="px-4 pt-5 pb-4">
        <div className="text-xs text-subtle-foreground">You send</div>
        <div className="mt-1 text-[2rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">
          {data.valueEth} <span className="text-base font-normal tracking-normal text-muted-foreground">ETH</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-muted-foreground">
          <AddressLink address={data.from} />
          <ArrowRight className="size-3.5 text-subtle-foreground" />
          <AddressLink address={data.to} name={data.toEnsName} />
        </div>
      </div>

      <div className="divide-y border-t px-4">
        <Row label="Network">
          {data.network} <span className="text-subtle-foreground">· {data.chainId}</span>
        </Row>
        <Row label="Estimated fee">{data.estimatedFeeEth} ETH</Row>
        <Row label="Max fee">
          <span className="text-muted-foreground">
            {data.maxFeeEth} ETH · {data.maxFeePerGasGwei} gwei
          </span>
        </Row>
        <Row label="Max total">
          <span className="font-medium">{data.totalCostEth} ETH</span>
        </Row>
        {data.balanceEth && (
          <Row label="Balance after">
            <span className={cn(!data.balanceAfterEth && "text-destructive")}>{data.balanceAfterEth ? `${data.balanceAfterEth} ETH` : "Insufficient"}</span>
          </Row>
        )}
      </div>

      <ul className="space-y-1.5 border-t bg-surface px-4 py-3" aria-label="Safety checks">
        {data.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-xs">
            {c.passed ? (
              <span className="mt-px flex size-3.5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            ) : (
              <span className="mt-px flex size-3.5 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <X className="size-2.5" strokeWidth={3} />
              </span>
            )}
            <span className="shrink-0 font-medium">{c.label}</span>
            <span className="min-w-0 truncate text-muted-foreground" title={c.detail}>
              {c.detail}
            </span>
          </li>
        ))}
        {data.warnings.map((w) => (
          <li key={w} className="flex items-start gap-2 text-xs text-warning">
            <AlertTriangle className="mt-px size-3.5 shrink-0" /> {w}
          </li>
        ))}
      </ul>

      <div className="flex min-h-14 flex-wrap items-center gap-2 border-t px-4 py-3">
        {state === "ready" && (
          <>
            <Button size="sm" onClick={approve} disabled={!data.readyToSign || !address}>
              <PenLine /> Approve in wallet
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              Cancel
            </Button>
            <span className="ml-auto text-xs text-subtle-foreground">
              {!data.readyToSign
                ? `${failedChecks.length} check${failedChecks.length === 1 ? "" : "s"} failed`
                : !address
                  ? "Connect your wallet to sign"
                  : "You'll confirm in your wallet"}
            </span>
          </>
        )}
        {state === "signing" && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Confirm in your wallet…
          </span>
        )}
        {(state === "submitted" || state === "confirmed" || state === "reverted") && hash && (
          <>
            <span className="flex items-center gap-2 text-sm">
              {state === "submitted" && <Loader2 className="size-4 animate-spin text-accent" />}
              {state === "confirmed" && <CheckCircle2 className="size-4 text-success" />}
              {state === "reverted" && <XCircle className="size-4 text-destructive" />}
              {state === "submitted" ? "Pending" : state === "confirmed" ? "Confirmed" : "Reverted"}
              <HashLink hash={hash} />
            </span>
            <div className="ml-auto flex gap-1.5">
              {onAskAgent && state !== "submitted" && (
                <Button size="xs" variant="outline" onClick={() => onAskAgent(`Check the status of transaction ${hash}`)}>
                  Ask agent to verify
                </Button>
              )}
              <Button size="xs" variant="ghost" asChild>
                <a href={explorerTxUrl(hash)} target="_blank" rel="noreferrer">
                  Etherscan <ExternalLink />
                </a>
              </Button>
            </div>
          </>
        )}
        {state === "dismissed" && <span className="text-sm text-muted-foreground">Cancelled. Nothing was signed or sent.</span>}
        {state === "expired" && (
          <>
            <span className="text-sm text-muted-foreground">This preview has expired. Fees and balances may have changed.</span>
            {onAskAgent && (
              <Button
                size="xs"
                variant="outline"
                className="ml-auto"
                onClick={() => onAskAgent(`Prepare a transaction to send ${data.valueEth} ETH to ${data.to}`)}
              >
                <RotateCcw /> Prepare again
              </Button>
            )}
          </>
        )}
      </div>
    </ResultCard>
  );
}

function StateBadge({ state, ready }: { state: State; ready: boolean }) {
  switch (state) {
    case "confirmed":
      return <Badge variant="success"><CheckCircle2 /> Confirmed</Badge>;
    case "reverted":
      return <Badge variant="destructive"><XCircle /> Reverted</Badge>;
    case "submitted":
      return <Badge variant="accent"><Loader2 className="animate-spin" /> Submitted</Badge>;
    case "signing":
      return <Badge variant="accent"><PenLine /> Signing</Badge>;
    case "dismissed":
      return <Badge>Cancelled</Badge>;
    case "expired":
      return <Badge><Clock /> Expired</Badge>;
    default:
      return ready ? (
        <Badge variant="success"><ShieldCheck /> Checks passed</Badge>
      ) : (
        <Badge variant="destructive"><AlertTriangle /> Blocked</Badge>
      );
  }
}
