"use client";

import { Activity, ArrowDownLeft, ArrowUpRight, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ChainlyUITools } from "@/lib/agent/tools";
import { explorerAddressUrl } from "@/lib/blockchain/chain";
import { cn } from "@/lib/utils";
import { AddressLink, ExplorerLink, HashLink, ResultCard, ResultHeader, Stat, StatGrid, timeAgo } from "./primitives";

type Data = ChainlyUITools["analyzeWallet"]["output"];
type Tab = "insights" | "transactions" | "counterparties";

export function ActivityCard({ data }: { data: Data }) {
  const s = data.summary;
  const [tab, setTab] = useState<Tab>("insights");
  const total = s.incomingCount + s.outgoingCount || 1;

  return (
    <ResultCard>
      <ResultHeader
        icon={<Activity />}
        title="Wallet activity"
        meta={
          <span>
            <AddressLink address={data.address} name={data.ensName} /> · {s.totalTransactions} txs · {data.source}
          </span>
        }
        right={<ExplorerLink href={explorerAddressUrl(data.address)} />}
      />

      {s.totalTransactions === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">{data.insights[0]}</p>
      ) : (
        <>
          <StatGrid>
            <Stat label="Received" value={`${s.receivedEth} ETH`} sub={`${s.incomingCount} incoming`} />
            <Stat label="Sent" value={`${s.sentEth} ETH`} sub={`${s.outgoingCount} outgoing`} />
            <Stat label="Net flow" value={`${s.netFlowEth} ETH`} sub={`${s.uniqueCounterparties} counterparties`} />
            <Stat label="Gas spent" value={`${s.gasSpentEth} ETH`} sub={`${s.contractCalls} contract calls`} />
          </StatGrid>

          <div className="space-y-4 border-t px-4 py-4">
            <div>
              <div className="flex h-1.5 overflow-hidden rounded-full bg-surface-2" aria-label="Incoming versus outgoing transactions">
                <div className="bg-accent transition-[width] duration-700" style={{ width: `${(s.incomingCount / total) * 100}%` }} />
                <div className="bg-foreground/60 transition-[width] duration-700" style={{ width: `${(s.outgoingCount / total) * 100}%` }} />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <Legend className="bg-accent" label={`${s.incomingCount} in`} />
                <Legend className="bg-foreground/60" label={`${s.outgoingCount} out`} />
                {s.failedCount > 0 && <span className="text-destructive">{s.failedCount} failed</span>}
                {s.lastSeen && <span className="ml-auto">last active {timeAgo(s.lastSeen)}</span>}
              </div>
            </div>
            {data.dailyActivity.length > 1 && <DailyChart days={data.dailyActivity} />}
          </div>

          <div className="flex gap-1 border-t px-3 pt-2" role="tablist">
            {(["insights", "transactions", "counterparties"] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  "relative px-2 pb-2 text-xs capitalize transition-colors",
                  tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
                {tab === t && <span className="absolute inset-x-2 -bottom-px h-px bg-foreground" />}
              </button>
            ))}
          </div>

          <div className="border-t px-4 py-3">
            {tab === "insights" && (
              <ul className="space-y-2.5">
                {data.insights.map((insight) => (
                  <li key={insight} className="flex gap-2.5 text-[13px] leading-relaxed">
                    <Sparkles className="mt-1 size-3 shrink-0 text-accent" />
                    <span className="text-muted-foreground">{insight}</span>
                  </li>
                ))}
                {data.tokenActivity.length > 0 && (
                  <li className="flex flex-wrap gap-1.5 pt-1">
                    {data.tokenActivity.map((t) => (
                      <Badge key={t.address}>
                        {t.symbol} · {t.transfers}
                      </Badge>
                    ))}
                  </li>
                )}
              </ul>
            )}

            {tab === "transactions" && (
              <div className="divide-y">
                {data.recentTransactions.map((tx) => (
                  <div key={tx.hash} className="flex items-center gap-3 py-2.5 text-[13px]">
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full border",
                        tx.direction === "in" ? "text-accent" : "text-muted-foreground",
                      )}
                    >
                      {tx.direction === "in" ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{tx.method ?? (tx.kind === "transfer" ? "Transfer" : tx.kind.replace("_", " "))}</span>
                        {tx.failed && <Badge variant="destructive">failed</Badge>}
                      </div>
                      <div className="text-[11px] text-subtle-foreground">
                        <HashLink hash={tx.hash} /> · {timeAgo(tx.timestamp)}
                      </div>
                    </div>
                    <span className={cn("shrink-0 font-medium tabular-nums", tx.direction === "in" && "text-accent")}>
                      {tx.direction === "in" ? "+" : tx.direction === "out" ? "−" : ""}
                      {tx.valueEth}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {tab === "counterparties" && (
              <div className="divide-y">
                {data.topCounterparties.map((c) => (
                  <div key={c.address} className="flex items-center justify-between gap-3 py-2.5 text-[13px]">
                    <AddressLink address={c.address} chars={6} />
                    <div className="text-right text-xs text-muted-foreground">
                      <span className="text-foreground">{c.txCount} txs</span> · ↑ {c.sentEth} · ↓ {c.receivedEth}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </ResultCard>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", className)} />
      {label}
    </span>
  );
}

function DailyChart({ days }: { days: Data["dailyActivity"] }) {
  const recent = days.slice(-30);
  const max = Math.max(...recent.map((d) => d.txCount), 1);
  return (
    <div>
      <div className="mb-2 flex justify-between text-[11px] text-subtle-foreground">
        <span>Daily transactions</span>
        <span className="font-mono">
          {recent[0].date} → {recent[recent.length - 1].date}
        </span>
      </div>
      <div className="flex h-14 items-end gap-[3px]" role="img" aria-label="Daily transaction count">
        {recent.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.txCount} txs · +${d.inEth} / −${d.outEth} ETH`}
            className="min-w-[2px] flex-1 rounded-[2px] bg-foreground/20 transition-colors hover:bg-accent"
            style={{ height: `${Math.max(8, (d.txCount / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
