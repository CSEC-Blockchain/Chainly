"use client";

import { Blocks, CheckCircle2, Clock, Coins, FileCode2, Fuel, Receipt, Wallet, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChainlyUITools } from "@/lib/agent/tools";
import { AddressLink, ExplorerButton, HashLink, ResultCard, ResultHeader, Row, Stat, timeAgo } from "./primitives";

type Out<K extends keyof ChainlyUITools> = ChainlyUITools[K]["output"];

export function BalanceCard({ data }: { data: Out<"getEthBalance"> }) {
  return (
    <ResultCard>
      <ResultHeader
        icon={<Wallet />}
        title="ETH balance"
        subtitle={<AddressLink address={data.address} chars={6} />}
        right={<ExplorerButton href={data.explorerUrl} />}
      />
      <div className="flex items-end justify-between gap-4 px-4 py-4">
        <div>
          <div className="text-3xl font-semibold tracking-tight tabular-nums">
            {data.balanceEth} <span className="text-base font-normal text-muted-foreground">ETH</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {data.network} · block #{Number(data.blockNumber).toLocaleString()}
          </div>
        </div>
        <Badge variant={data.isContract ? "warning" : "secondary"}>
          {data.isContract ? <FileCode2 /> : <Wallet />} {data.isContract ? "Contract" : "Wallet (EOA)"}
        </Badge>
      </div>
    </ResultCard>
  );
}

export function TokenBalanceCard({ data }: { data: Out<"getTokenBalance"> }) {
  return (
    <ResultCard>
      <ResultHeader
        icon={<Coins />}
        title={`${data.token.name} (${data.token.symbol})`}
        subtitle={<AddressLink address={data.address} chars={6} />}
        right={<ExplorerButton href={data.explorerUrl} />}
      />
      <div className="flex items-end justify-between gap-4 px-4 py-4">
        <div className="text-3xl font-semibold tracking-tight tabular-nums">
          {data.balance} <span className="text-base font-normal text-muted-foreground">{data.token.symbol}</span>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Token contract</div>
          <AddressLink address={data.token.address} />
        </div>
      </div>
    </ResultCard>
  );
}

export function TransactionCard({ data }: { data: Out<"getTransaction"> }) {
  const status =
    data.status === "success" ? (
      <Badge variant="success"><CheckCircle2 /> Success</Badge>
    ) : data.status === "reverted" ? (
      <Badge variant="destructive"><XCircle /> Reverted</Badge>
    ) : (
      <Badge variant="warning"><Clock /> Pending</Badge>
    );
  const typeLabel = { eth_transfer: "ETH transfer", contract_call: "Contract call", contract_creation: "Contract creation" }[data.type];

  return (
    <ResultCard>
      <ResultHeader icon={<Receipt />} title={typeLabel} subtitle={<HashLink hash={data.hash} />} right={status} />
      <div className="grid grid-cols-2 gap-2 px-4 pt-4 sm:grid-cols-3">
        <Stat label="Value" value={`${data.valueEth} ETH`} />
        <Stat label="Fee" value={data.feeEth ? `${data.feeEth} ETH` : "—"} sub={data.effectiveGasPriceGwei ? `${data.effectiveGasPriceGwei} gwei` : undefined} />
        <Stat label="Confirmations" value={Number(data.confirmations).toLocaleString()} sub={timeAgo(data.timestamp)} className="col-span-2 sm:col-span-1" />
      </div>
      <div className="divide-y px-4 py-2">
        <Row label="From"><AddressLink address={data.from} /></Row>
        <Row label="To"><AddressLink address={data.to ?? data.contractCreated} /></Row>
        <Row label="Block">{data.blockNumber ? `#${Number(data.blockNumber).toLocaleString()}` : "—"}</Row>
        <Row label="Gas used / limit">
          {data.gasUsed ? Number(data.gasUsed).toLocaleString() : "—"} / {Number(data.gasLimit).toLocaleString()}
        </Row>
        {data.methodId && <Row label="Method"><code className="font-mono text-xs">{data.methodId}</code></Row>}
        <Row label="Nonce · Logs">{data.nonce} · {data.logsCount}</Row>
      </div>
      <div className="flex justify-end border-t px-4 py-2.5">
        <ExplorerButton href={data.explorerUrl} label="View on BaseScan" />
      </div>
    </ResultCard>
  );
}

function UtilizationBar({ percent }: { percent: number }) {
  const color = percent > 90 ? "bg-destructive" : percent > 50 ? "bg-warning" : "bg-success";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

export function NetworkCard({ data }: { data: Out<"getNetworkStatus"> }) {
  return (
    <ResultCard>
      <ResultHeader
        icon={<Fuel />}
        title={`${data.network} network status`}
        subtitle={`Block #${Number(data.blockNumber).toLocaleString()} · ${data.blockAgeSeconds}s ago`}
        right={<ExplorerButton href={data.explorerUrl} label="Block" />}
      />
      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
        <Stat label="Gas price" value={`${data.gasPriceGwei}`} sub="gwei" />
        <Stat label="Base fee" value={data.baseFeeGwei ?? "—"} sub="gwei" />
        <Stat label="Priority fee" value={data.maxPriorityFeePerGasGwei ?? "—"} sub="gwei" />
        <Stat label="ETH transfer" value={`${data.simpleTransferCostEth}`} sub="ETH (21k gas)" />
      </div>
      <div className="space-y-1.5 px-4 pb-4">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Block utilization · {data.transactionsInBlock} txs</span>
          <span className="tabular-nums">{data.utilizationPercent.toFixed(2)}%</span>
        </div>
        <UtilizationBar percent={data.utilizationPercent} />
      </div>
    </ResultCard>
  );
}

export function BlockCard({ data }: { data: Out<"getBlock"> }) {
  return (
    <ResultCard>
      <ResultHeader
        icon={<Blocks />}
        title={`Block #${Number(data.number).toLocaleString()}`}
        subtitle={`${new Date(data.timestamp).toLocaleString()} · ${timeAgo(data.timestamp)}`}
        right={<ExplorerButton href={data.explorerUrl} />}
      />
      <div className="grid grid-cols-3 gap-2 p-4">
        <Stat label="Transactions" value={data.transactions} />
        <Stat label="Base fee" value={data.baseFeeGwei ?? "—"} sub="gwei" />
        <Stat label="Gas used" value={`${data.utilizationPercent.toFixed(1)}%`} sub={Number(data.gasUsed).toLocaleString()} />
      </div>
      <div className="px-4 pb-4"><UtilizationBar percent={data.utilizationPercent} /></div>
    </ResultCard>
  );
}
