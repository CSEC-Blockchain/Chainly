"use client";

import { useBlockNumber } from "wagmi";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CHAIN_ID, NETWORK_NAME } from "@/lib/blockchain/chain";
import { cn } from "@/lib/utils";

/** Network pill with a live block number from the browser RPC. */
export function NetworkIndicator({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { data: block, isError } = useBlockNumber({ chainId: CHAIN_ID, watch: { enabled: true, pollingInterval: 12_000 } });
  const healthy = !isError;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs text-muted-foreground",
            compact && "w-8 justify-center px-0",
            className,
          )}
          role="status"
          aria-label={`${NETWORK_NAME}${block ? `, block ${block}` : ""}`}
        >
          <span className="relative flex size-1.5 shrink-0">
            {healthy && <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50" />}
            <span className={cn("relative size-1.5 rounded-full", healthy ? "bg-success" : "bg-warning")} />
          </span>
          {!compact && (
            <>
              <span className="text-foreground">{NETWORK_NAME}</span>
              {block !== undefined && <span className="hidden font-mono tabular-nums text-subtle-foreground sm:inline">#{block.toLocaleString("en-US")}</span>}
            </>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {healthy ? `Chain ID ${CHAIN_ID} · live block ${block?.toLocaleString("en-US") ?? "…"}` : "Browser RPC unreachable"}
      </TooltipContent>
    </Tooltip>
  );
}
