"use client";

import { ArrowUpRight, Check, Copy } from "lucide-react";
import type { ReactNode } from "react";
import { useCopy } from "@/hooks/use-copy";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/blockchain/chain";
import { shortAddress, shortHash } from "@/lib/blockchain/format";
import { cn } from "@/lib/utils";

export function ResultCard({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card/80 shadow-[0_1px_0_0_oklch(1_0_0/4%)_inset] backdrop-blur-sm", className)}>
      {children}
    </div>
  );
}

export function ResultHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b bg-background/30 px-4 py-3">
      <div className="flex size-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary [&_svg]:size-4">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 rounded-lg border bg-background/30 px-3 py-2.5", className)}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-base font-semibold tabular-nums">{value}</div>
      {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right tabular-nums">{children}</span>
    </div>
  );
}

export function AddressLink({ address, chars = 4 }: { address: string | null | undefined; chars?: number }) {
  const { copied, copy } = useCopy();
  if (!address) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer" className="hover:text-primary hover:underline" title={address}>
        {shortAddress(address, chars)}
      </a>
      <button type="button" onClick={() => copy(address)} className="text-muted-foreground hover:text-foreground" aria-label="Copy address">
        {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
      </button>
    </span>
  );
}

export function HashLink({ hash }: { hash: string }) {
  return (
    <a href={explorerTxUrl(hash)} target="_blank" rel="noreferrer" className="font-mono text-xs hover:text-primary hover:underline" title={hash}>
      {shortHash(hash)}
    </a>
  );
}

export function ExplorerButton({ href, label = "Explorer" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
    >
      {label} <ArrowUpRight className="size-3" />
    </a>
  );
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 0) return "just now";
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86_400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86_400)}d ago`;
}
