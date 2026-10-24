"use client";

import { ArrowUpRight, Check, Copy } from "lucide-react";
import type { ReactNode } from "react";
import { useCopy } from "@/hooks/use-copy";
import { explorerAddressUrl, explorerTxUrl } from "@/lib/blockchain/chain";
import { shortAddress, shortHash } from "@/lib/blockchain/format";
import { cn } from "@/lib/utils";

/** Base container for every tool result card. */
export function ResultCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("animate-fade-up overflow-hidden rounded-xl border bg-background", className)}>{children}</div>;
}

export function ResultHeader({ icon, title, meta, right }: { icon: ReactNode; title: ReactNode; meta?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b px-4 py-2.5">
      <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
      <span className="text-[13px] font-medium">{title}</span>
      {meta && <span className="min-w-0 truncate text-xs text-subtle-foreground">{meta}</span>}
      <span className="ml-auto flex shrink-0 items-center gap-2">{right}</span>
    </div>
  );
}

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-xs text-subtle-foreground">{label}</div>
      <div className="mt-1 truncate text-[15px] font-medium tabular-nums">{value}</div>
      {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

/** A row of stats separated by hairlines. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-px bg-border sm:grid-cols-4 [&>*]:bg-background [&>*]:px-4 [&>*]:py-3", className)}>{children}</div>
  );
}

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-[13px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right tabular-nums">{children}</span>
    </div>
  );
}

export function AddressLink({ address, name, chars = 4 }: { address: string | null | undefined; name?: string | null; chars?: number }) {
  const { copied, copy } = useCopy();
  if (!address) return <span className="text-subtle-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 font-mono text-xs">
      <a
        href={explorerAddressUrl(address)}
        target="_blank"
        rel="noreferrer"
        className="underline-offset-2 hover:text-foreground hover:underline"
        title={name ? `${name} → ${address}` : address}
      >
        {name ? (
          <>
            <span className="font-sans font-medium">{name}</span> <span className="text-subtle-foreground">{shortAddress(address, chars)}</span>
          </>
        ) : (
          shortAddress(address, chars)
        )}
      </a>
      <button
        type="button"
        onClick={() => copy(address)}
        className="rounded p-0.5 text-subtle-foreground transition-colors hover:text-foreground"
        aria-label="Copy address"
      >
        {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
      </button>
    </span>
  );
}

export function HashLink({ hash }: { hash: string }) {
  return (
    <a href={explorerTxUrl(hash)} target="_blank" rel="noreferrer" className="font-mono text-xs underline-offset-2 hover:underline" title={hash}>
      {shortHash(hash)}
    </a>
  );
}

export function ExplorerLink({ href, label = "Etherscan" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {label}
      <ArrowUpRight className="size-3" />
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

export function Meter({ percent, className }: { percent: number; className?: string }) {
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-700", percent > 90 ? "bg-destructive" : percent > 60 ? "bg-warning" : "bg-foreground/70")}
        style={{ width: `${Math.min(100, Math.max(1, percent))}%` }}
      />
    </div>
  );
}
