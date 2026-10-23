"use client";

import { AlertTriangle, LogOut, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CHAIN } from "@/lib/blockchain/chain";
import { shortAddress } from "@/lib/blockchain/format";

export function ConnectButton() {
  const { address, status, chainId } = useConnection();
  const connectors = useConnectors();
  const { connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const mounted = useMounted();

  if (!mounted || status === "reconnecting") {
    return <Button variant="outline" size="sm" disabled className="w-36">Loading…</Button>;
  }

  if (status === "connected" && address) {
    if (chainId !== CHAIN.id) {
      return (
        <Button
          size="sm"
          variant="outline"
          className="border-warning/40 text-warning"
          disabled={isSwitching}
          onClick={() =>
            switchChain(
              { chainId: CHAIN.id },
              { onError: (e) => toast.error("Could not switch network", { description: shortError(e) }) },
            )
          }
        >
          <AlertTriangle /> Switch to {CHAIN.name}
        </Button>
      );
    }
    return (
      <div className="flex items-center gap-1 rounded-lg border bg-card/60 p-1 pl-3">
        <span className="size-2 rounded-full bg-success shadow-[0_0_8px_var(--success)]" />
        <span className="font-mono text-xs">{shortAddress(address)}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => disconnect()} aria-label="Disconnect wallet">
              <LogOut />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Disconnect</TooltipContent>
        </Tooltip>
      </div>
    );
  }

  const connector = connectors[0];
  const hasInjected = typeof window !== "undefined" && "ethereum" in window;

  return (
    <Button
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (!hasInjected) {
          toast.error("No browser wallet detected", {
            description: "Install MetaMask, Coinbase Wallet or Rabby to connect.",
          });
          return;
        }
        connect(
          { connector, chainId: CHAIN.id },
          { onError: (e) => toast.error("Connection failed", { description: shortError(e) }) },
        );
      }}
    >
      <Wallet /> {isPending ? "Connecting…" : "Connect wallet"}
    </Button>
  );
}

export function shortError(e: unknown) {
  if (e && typeof e === "object" && "shortMessage" in e && typeof e.shortMessage === "string") return e.shortMessage;
  if (e instanceof Error) return e.message.split("\n")[0];
  return "Unknown error";
}
