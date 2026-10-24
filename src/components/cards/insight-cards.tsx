"use client";

import { AlertTriangle, CheckCircle2, Clock, FileCode2, Info, ScrollText, ShieldAlert, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ChainlyUITools } from "@/lib/agent/tools";
import { AddressLink, ExplorerLink, HashLink, ResultCard, ResultHeader, Row } from "./primitives";

type Out<K extends keyof ChainlyUITools> = ChainlyUITools[K]["output"];

export function ContractCard({ data }: { data: Out<"explainContract"> }) {
  return (
    <ResultCard>
      <ResultHeader
        icon={<FileCode2 />}
        title={data.name ?? "Contract"}
        meta={<AddressLink address={data.address} name={data.ensName} />}
        right={
          data.verified ? (
            <Badge variant="success"><CheckCircle2 /> Verified</Badge>
          ) : (
            <Badge variant="warning"><AlertTriangle /> Unverified</Badge>
          )
        }
      />

      {data.standards.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b px-4 py-3">
          {data.standards.map((s) => (
            <Badge key={s}>{s}</Badge>
          ))}
        </div>
      )}

      <div className="divide-y px-4">
        {data.token && (
          <Row label="Token">
            {data.token.name} ({data.token.symbol}) <span className="text-subtle-foreground">· supply {data.token.totalSupply}</span>
          </Row>
        )}
        {data.owner && (
          <Row label="Owner">{data.ownerRenounced ? <span className="text-muted-foreground">Renounced (zero address)</span> : <AddressLink address={data.owner} />}</Row>
        )}
        {data.proxy && (
          <Row label="Implementation">
            <AddressLink address={data.proxy.implementation} />
          </Row>
        )}
        {data.paused !== null && <Row label="Paused">{data.paused ? <span className="text-warning">Yes</span> : "No"}</Row>}
        <Row label="Functions">
          {data.totalReadFunctions} read · {data.totalWriteFunctions} write
        </Row>
        {data.compilerVersion && (
          <Row label="Compiler">
            <code className="font-mono text-xs">{data.compilerVersion}</code>
          </Row>
        )}
      </div>

      {data.privilegedFunctions.length > 0 && (
        <ul className="space-y-1.5 border-t bg-surface px-4 py-3" aria-label="Privileged functions">
          {data.privilegedFunctions.map((f) => (
            <li key={f.signature} className="flex items-start gap-2 text-xs">
              <ShieldAlert className="mt-px size-3.5 shrink-0 text-warning" />
              <code className="shrink-0 font-mono">{f.name}</code>
              <span className="min-w-0 truncate text-muted-foreground">{f.risk}</span>
            </li>
          ))}
        </ul>
      )}

      <Notes notes={data.notes} />
      <div className="flex justify-end border-t px-4 py-2.5">
        <ExplorerLink href={data.explorerUrl} label="View on Etherscan" />
      </div>
    </ResultCard>
  );
}

export function DecodedTransactionCard({ data }: { data: Out<"decodeTransaction"> }) {
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
      <ResultHeader icon={<ScrollText />} title={data.method?.name ?? (data.method ? "Unknown call" : "ETH transfer")} meta={<HashLink hash={data.hash} />} right={status} />

      <ol className="space-y-1.5 px-4 py-3 text-[13px]" aria-label="What happened">
        {data.summary.map((line, i) => (
          <li key={`${i}-${line}`} className="flex gap-2">
            <span className="w-4 shrink-0 text-right text-subtle-foreground tabular-nums">{i + 1}.</span>
            <span className="min-w-0">{line}</span>
          </li>
        ))}
      </ol>

      {data.flags.length > 0 && (
        <ul className="space-y-1.5 border-t px-4 py-3" aria-label="Warnings">
          {data.flags.map((f) => (
            <li key={`${f.id}-${f.detail}`} className="flex items-start gap-2 text-xs text-warning">
              <AlertTriangle className="mt-px size-3.5 shrink-0" /> {f.detail}
            </li>
          ))}
        </ul>
      )}

      {data.method && data.method.args.length > 0 && (
        <div className="divide-y border-t px-4">
          {data.method.args.slice(0, 8).map((a) => (
            <Row key={a.name} label={a.name}>
              <code className="font-mono text-xs" title={JSON.stringify(a.value)}>
                {typeof a.value === "string" ? a.value : JSON.stringify(a.value)}
              </code>
            </Row>
          ))}
        </div>
      )}

      <div className="divide-y border-t px-4">
        <Row label="From"><AddressLink address={data.from} /></Row>
        <Row label="To"><AddressLink address={data.to ?? data.contractCreated} name={data.contractName} /></Row>
        <Row label="Fee">{data.feeEth ? `${data.feeEth} ETH` : "—"}</Row>
      </div>

      <Notes notes={data.notes} />
      <div className="flex justify-end border-t px-4 py-2.5">
        <ExplorerLink href={data.explorerUrl} label="View on Etherscan" />
      </div>
    </ResultCard>
  );
}

function Notes({ notes }: { notes: string[] }) {
  if (!notes.length) return null;
  return (
    <ul className="space-y-1 border-t px-4 py-2.5">
      {notes.map((n) => (
        <li key={n} className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" /> {n}
        </li>
      ))}
    </ul>
  );
}
