"use client";

import { Blocks, CheckCircle2, Clock, Coins, Fuel, Receipt, Wallet, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChainlyUITools } from "@/lib/agent/tools";
import { AddressLink, ExplorerLink, HashLink, Meter, ResultCard, ResultHeader, Row, Stat, StatGrid, timeAgo } from "./primitives";

type Out<K extends keyof ChainlyUITools> = ChainlyUITools[K]["output"];

function BigValue({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="text-[2rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">
      {value} <span className="text-base font-normal tracking-normal text-muted-foreground">{unit}</span>
    </div>
  );
}

export function BalanceCard({ data }: { data: Out<"getEthBalance"> }) {
  return (
    <ResultCard>
      <ResultHeader icon={<Wallet />} title="ETH balance" meta={<AddressLink address={data.address} />} right={<ExplorerLink href={data.explorerUrl} />} />
      <div className="flex items-end justify-between gap-4 px-4 py-5">
        <BigValue value={data.balanceEth} unit="ETH" />
        <div className="flex flex-col items-end gap-1.5">
          <Badge>{data.isContract ? "Contract" : "Wallet · EOA"}</Badge>
          <span className="font-mono text-[11px] text-subtle-foreground">block #{Number(data.blockNumber).toLocaleString("en-US")}</span>
        </div>
      </div>
    </ResultCard>
  );
}

export function TokenBalanceCard({ data }: { data: Out<"getTokenBalance"> }) {
  return (
    <ResultCard>
      <ResultHeader
        icon={<Coins />}
        title={data.token.symbol}
        meta={data.token.name}
        right={<ExplorerLink href={data.explorerUrl} />}
      />
      <div className="flex items-end justify-between gap-4 px-4 py-5">
        <BigValue value={data.balance} unit={data.token.symbol} />
        <div className="text-right text-[11px] text-subtle-foreground">
          <div>holder</div>
          <AddressLink address={data.address} />
        </div>
      </div>
    </ResultCard>
  );
}

const TX_TYPE = { eth_transfer: "ETH transfer", contract_call: "Contract call", contract_creation: "Contract creation" } as const;

export function TransactionCard({ data }: { data: Out<"getTransaction"> }) {
  const status =
    data.status === "success" ? (
      <Badge variant="success"><CheckCircle2 /> Success</Badge>
    ) : data.status === "reverted" ? (
      <Badge variant="destructive"><XCircle /> Reverted</Badge>
    ) : (
      <Badge variant="warning"><Clock /> Pending</Badge>
    );

  return (
    <ResultCard>
      <ResultHeader icon={<Receipt />} title={TX_TYPE[data.type]} meta={<HashLink hash={data.hash} />} right={status} />
      <StatGrid className="sm:grid-cols-3">
        <Stat label="Value" value={`${data.valueEth} ETH`} />
        <Stat label="Fee" value={data.feeEth ? `${data.feeEth} ETH` : "—"} sub={data.effectiveGasPriceGwei ? `${data.effectiveGasPriceGwei} gwei` : undefined} />
        <Stat label="Confirmations" value={Number(data.confirmations).toLocaleString("en-US")} sub={timeAgo(data.timestamp)} className="col-span-2 sm:col-span-1" />
      </StatGrid>
      <div className="divide-y border-t px-4">
        <Row label="From"><AddressLink address={data.from} /></Row>
        <Row label="To"><AddressLink address={data.to ?? data.contractCreated} /></Row>
        <Row label="Block">{data.blockNumber ? `#${Number(data.blockNumber).toLocaleString("en-US")}` : "—"}</Row>
        <Row label="Gas used / limit">
          {data.gasUsed ? Number(data.gasUsed).toLocaleString("en-US") : "—"} / {Number(data.gasLimit).toLocaleString("en-US")}
        </Row>
        {data.methodId && <Row label="Method"><code className="font-mono text-xs">{data.methodId}</code></Row>}
      </div>
      <div className="flex justify-end border-t px-4 py-2.5">
        <ExplorerLink href={data.explorerUrl} label="View on Etherscan" />
      </div>
    </ResultCard>
  );
}

export function NetworkCard({ data }: { data: Out<"getNetworkStatus"> }) {
  return (
    <ResultCard>
      <ResultHeader
        icon={<Fuel />}
        title="Network status"
        meta={`${data.network} · #${Number(data.blockNumber).toLocaleString("en-US")} · ${data.blockAgeSeconds}s ago`}
        right={<ExplorerLink href={data.explorerUrl} label="Block" />}
      />
      <StatGrid>
        <Stat label="Gas price" value={data.gasPriceGwei} sub="gwei" />
        <Stat label="Base fee" value={data.baseFeeGwei ?? "—"} sub="gwei" />
        <Stat label="Priority fee" value={data.maxPriorityFeePerGasGwei ?? "—"} sub="gwei" />
        <Stat label="ETH transfer" value={data.simpleTransferCostEth} sub="ETH · 21k gas" />
      </StatGrid>
      <div className="space-y-2 border-t px-4 py-3">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Block utilization · {data.transactionsInBlock} txs</span>
          <span className="tabular-nums">{data.utilizationPercent.toFixed(1)}%</span>
        </div>
        <Meter percent={data.utilizationPercent} />
      </div>
    </ResultCard>
  );
}

export function BlockCard({ data }: { data: Out<"getBlock"> }) {
  return (
    <ResultCard>
      <ResultHeader
        icon={<Blocks />}
        title={`Block #${Number(data.number).toLocaleString("en-US")}`}
        meta={timeAgo(data.timestamp)}
        right={<ExplorerLink href={data.explorerUrl} />}
      />
      <StatGrid className="sm:grid-cols-3">
        <Stat label="Transactions" value={data.transactions} />
        <Stat label="Base fee" value={data.baseFeeGwei ?? "—"} sub="gwei" />
        <Stat label="Gas used" value={`${data.utilizationPercent.toFixed(1)}%`} sub={Number(data.gasUsed).toLocaleString("en-US")} className="col-span-2 sm:col-span-1" />
      </StatGrid>
      <div className="border-t px-4 py-3">
        <Meter percent={data.utilizationPercent} />
      </div>
    </ResultCard>
  );
}
