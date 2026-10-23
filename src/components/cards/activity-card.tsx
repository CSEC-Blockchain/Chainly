"use client";

import { Activity, ArrowDownLeft, ArrowUpRight, FileCode2, Lightbulb, Repeat, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ChainlyUITools } from "@/lib/agent/tools";
import { cn } from "@/lib/utils";
import { AddressLink, ExplorerButton, HashLink, ResultCard, ResultHeader, Stat, timeAgo } from "./primitives";
import { explorerAddressUrl } from "@/lib/blockchain/chain";

type Data = ChainlyUITools["analyzeWallet"]["output"];

export function ActivityCard({ data }: { data: Data }) {
  const s = data.summary;
  const [tab, setTab] = useState<"insights" | "recent" | "counterparties">("insights");
  const inShare = s.totalTransactions ? (s.incomingCount / s.totalTransactions) * 100 : 0;
  const outShare = s.totalTransactions ? (s.outgoingCount / s.totalTransactions) * 100 : 0;

  return (
    <ResultCard>
      <ResultHeader
        icon={<Activity />}
        title="Wallet activity analysis"
        subtitle={
          <span>
            <AddressLink address={data.address} chars={6} /> · last {s.totalTransactions} txs via {data.source}
          </span>
        }
        right={<ExplorerButton href={explorerAddressUrl(data.address)} />}
      />

      {s.totalTransactions === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">{data.insights[0]}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 px-4 pt-4 sm:grid-cols-4">
            <Stat label="Received" value={<span className="text-success">{s.receivedEth}</span>} sub={`ETH · ${s.incomingCount} txs`} />
            <Stat label="Sent" value={<span className="text-[oklch(0.75_0.15_25)]">{s.sentEth}</span>} sub={`ETH · ${s.outgoingCount} txs`} />
            <Stat label="Net flow" value={s.netFlowEth} sub="ETH" />
            <Stat label="Gas spent" value={s.gasSpentEth} sub="ETH" />
          </div>

          <div className="space-y-1.5 px-4 pt-4">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="bg-success" style={{ width: `${inShare}%` }} />
              <div className="bg-[oklch(0.68_0.18_25)]" style={{ width: `${outShare}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><ArrowDownLeft className="size-3 text-success" /> {s.incomingCount} in</span>
              <span className="flex items-center gap-1"><ArrowUpRight className="size-3 text-[oklch(0.75_0.15_25)]" /> {s.outgoingCount} out</span>
              <span className="flex items-center gap-1"><FileCode2 className="size-3" /> {s.contractCalls} contract calls</span>
              {s.failedCount > 0 && <span className="flex items-center gap-1 text-destructive"><XCircle className="size-3" /> {s.failedCount} failed</span>}
              <span className="flex items-center gap-1"><Repeat className="size-3" /> {s.uniqueCounterparties} counterparties</span>
            </div>
          </div>

          {data.dailyActivity.length > 1 && <DailyChart days={data.dailyActivity} />}

          <div className="mt-4 flex gap-1 border-y bg-background/30 px-3 py-1.5">
            {(["insights", "recent", "counterparties"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs capitalize transition-colors",
                  tab === t ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="px-4 py-3">
            {tab === "insights" && (
              <ul className="space-y-2">
                {data.insights.map((insight) => (
                  <li key={insight} className="flex gap-2 text-sm">
                    <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-warning" />
                    <span className="text-muted-foreground">{insight}</span>
                  </li>
                ))}
                {data.tokenActivity.length > 0 && (
                  <li className="flex flex-wrap gap-1.5 pt-1">
                    {data.tokenActivity.map((t) => (
                      <Badge key={t.address} variant="secondary">
                        {t.symbol} · {t.transfers} transfers
                      </Badge>
                    ))}
                  </li>
                )}
              </ul>
            )}

            {tab === "recent" && (
              <div className="divide-y">
                {data.recentTransactions.map((tx) => (
                  <div key={tx.hash} className="flex items-center gap-3 py-2 text-sm">
                    <div
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full border",
                        tx.direction === "in" ? "border-success/30 text-success" : "border-border text-muted-foreground",
                      )}
                    >
                      {tx.direction === "in" ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{tx.method ?? (tx.kind === "transfer" ? "Transfer" : tx.kind.replace("_", " "))}</span>
                        {tx.failed && <Badge variant="destructive">failed</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <HashLink hash={tx.hash} /> · {timeAgo(tx.timestamp)}
                      </div>
                    </div>
                    <div className={cn("text-right tabular-nums", tx.direction === "in" ? "text-success" : "")}>
                      {tx.direction === "in" ? "+" : tx.direction === "out" ? "−" : ""}
                      {tx.valueEth} ETH
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "counterparties" && (
              <div className="divide-y">
                {data.topCounterparties.map((c) => (
                  <div key={c.address} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <AddressLink address={c.address} chars={6} />
                    <div className="text-right text-xs text-muted-foreground">
                      <div className="text-foreground">{c.txCount} txs</div>
                      <div>↑ {c.sentEth} · ↓ {c.receivedEth} ETH</div>
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

function DailyChart({ days }: { days: Data["dailyActivity"] }) {
  const recent = days.slice(-30);
  const max = Math.max(...recent.map((d) => d.txCount), 1);
  return (
    <div className="px-4 pt-4">
      <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>Daily transactions</span>
        <span>
          {recent[0].date} → {recent[recent.length - 1].date}
        </span>
      </div>
      <div className="flex h-16 items-end gap-[3px]" role="img" aria-label="Daily transaction count chart">
        {recent.map((d) => (
          <div
            key={d.date}
            title={`${d.date}: ${d.txCount} txs · +${d.inEth} / −${d.outEth} ETH`}
            className="min-w-[3px] flex-1 rounded-t-sm bg-primary/70 transition-colors hover:bg-primary"
            style={{ height: `${Math.max(6, (d.txCount / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}
