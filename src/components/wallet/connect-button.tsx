"use client";

import { AlertTriangle, ArrowUpRight, Check, Copy, Droplets, LogOut, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useBalance, useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/hooks/use-copy";
import { useMounted } from "@/hooks/use-mounted";
import { CHAIN_ID, explorerAddressUrl, FAUCET_URL, NETWORK_NAME } from "@/lib/blockchain/chain";
import { formatEth, shortAddress } from "@/lib/blockchain/format";
import { cn } from "@/lib/utils";
import { Identicon } from "./identicon";

export function shortError(e: unknown) {
  if (e && typeof e === "object" && "shortMessage" in e && typeof e.shortMessage === "string") return e.shortMessage;
  if (e instanceof Error) return e.message.split("\n")[0];
  return "Unknown error";
}

export function useConnectWallet() {
  const connectors = useConnectors();
  const { connect, isPending } = useConnect();
  const run = () => {
    if (typeof window !== "undefined" && !("ethereum" in window)) {
      toast.error("No browser wallet found", { description: "Install MetaMask, Rabby or Coinbase Wallet to connect." });
      return;
    }
    connect(
      { connector: connectors[0], chainId: CHAIN_ID },
      { onError: (e) => toast.error("Couldn't connect", { description: shortError(e) }) },
    );
  };
  return { connect: run, isPending };
}

/** Minimal wallet control: connect → switch network → account menu. */
export function WalletButton({ className, align = "end" }: { className?: string; align?: "start" | "end" }) {
  const mounted = useMounted();
  const { address, status, chainId } = useConnection();
  const { connect, isPending } = useConnectWallet();
  const { switchChain, isPending: switching } = useSwitchChain();

  if (!mounted || status === "reconnecting") {
    return <Skeleton className={cn("h-8 w-32 rounded-lg", className)} />;
  }

  if (status !== "connected" || !address) {
    return (
      <Button size="sm" variant="outline" onClick={connect} disabled={isPending} className={className}>
        <Wallet /> {isPending ? "Connecting…" : "Connect wallet"}
      </Button>
    );
  }

  if (chainId !== CHAIN_ID) {
    return (
      <Button
        size="sm"
        variant="outline"
        className={cn("border-warning/40 text-warning hover:text-warning", className)}
        disabled={switching}
        onClick={() =>
          switchChain({ chainId: CHAIN_ID }, { onError: (e) => toast.error("Couldn't switch network", { description: shortError(e) }) })
        }
      >
        <AlertTriangle /> {switching ? "Switching…" : "Switch to Sepolia"}
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className={cn("gap-2 pl-1.5 font-mono text-xs", className)} aria-label="Wallet menu">
          <Identicon address={address} />
          {shortAddress(address)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align}>
        <WalletMenu address={address} />
      </PopoverContent>
    </Popover>
  );
}

function WalletMenu({ address }: { address: `0x${string}` }) {
  const { disconnect } = useDisconnect();
  const { copied, copy } = useCopy();
  const { data: balance, isLoading, isError } = useBalance({ address, chainId: CHAIN_ID, query: { refetchInterval: 15_000 } });

  return (
    <div>
      <div className="flex items-center gap-3 p-3">
        <Identicon address={address} className="size-9" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm">{shortAddress(address, 6)}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" /> {NETWORK_NAME}
          </div>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={() => copy(address)} aria-label="Copy address">
          {copied ? <Check className="text-success" /> : <Copy />}
        </Button>
      </div>
      <div className="mx-3 mb-2 rounded-lg border bg-surface px-3 py-2.5">
        <div className="text-[11px] text-subtle-foreground">Balance</div>
        <div className="mt-0.5 text-xl font-semibold tracking-tight tabular-nums">
          {isLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : isError ? (
            <span className="text-sm font-normal text-destructive">RPC unavailable</span>
          ) : (
            <>
              {balance ? formatEth(balance.value, 5) : "0"} <span className="text-sm font-normal text-muted-foreground">ETH</span>
            </>
          )}
        </div>
      </div>
      <div className="border-t p-1">
        <MenuLink href={explorerAddressUrl(address)} icon={<ArrowUpRight />}>View on Etherscan</MenuLink>
        <MenuLink href={FAUCET_URL} icon={<Droplets />}>Get Sepolia ETH</MenuLink>
        <button
          type="button"
          onClick={() => disconnect()}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground [&_svg]:size-4"
        >
          <LogOut /> Disconnect
        </button>
      </div>
    </div>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground [&_svg]:size-4"
    >
      {icon}
      {children}
    </a>
  );
}
