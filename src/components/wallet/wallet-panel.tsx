"use client";

import {
  Activity,
  ArrowUpRight,
  Blocks,
  Check,
  Coins,
  Copy,
  Droplets,
  Fuel,
  Receipt,
  Search,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useBalance, useBlockNumber, useConnection } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCopy } from "@/hooks/use-copy";
import { CHAIN, explorerAddressUrl, FAUCET_URL } from "@/lib/blockchain/chain";
import { formatEth, shortAddress } from "@/lib/blockchain/format";

type Props = { onPrompt: (text: string) => void; disabled?: boolean };

export function WalletPanel({ onPrompt, disabled }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <WalletOverview onPrompt={onPrompt} disabled={disabled} />
      <QuickActions onPrompt={onPrompt} disabled={disabled} />
      <Toolbox />
      <SafetyCard />
    </div>
  );
}

function WalletOverview({ onPrompt, disabled }: Props) {
  const { address, status, chainId } = useConnection();
  const mounted = useMounted();
  const { data: balance, isLoading, isError } = useBalance({
    address,
    chainId: CHAIN.id,
    query: { enabled: Boolean(address), refetchInterval: 15_000 },
  });
  const { data: blockNumber } = useBlockNumber({ chainId: CHAIN.id, watch: { enabled: true, pollingInterval: 6_000 } });
  const { copied, copy } = useCopy();

  const connected = mounted && status === "connected" && address;

  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-primary/25 blur-3xl" />
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-primary" /> Wallet overview
          </CardTitle>
          <CardDescription className="mt-1.5">{CHAIN.name} · chain {CHAIN.id}</CardDescription>
        </div>
        <Badge variant={connected ? (chainId === CHAIN.id ? "success" : "warning") : "secondary"}>
          {connected ? (chainId === CHAIN.id ? "Connected" : "Wrong network") : "Not connected"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {connected ? (
          <>
            <div>
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : isError ? (
                  <span className="text-sm text-destructive">RPC unavailable</span>
                ) : (
                  <>
                    <span className="text-3xl font-semibold tracking-tight tabular-nums">
                      {balance ? formatEth(balance.value, 5) : "0"}
                    </span>
                    <span className="text-sm text-muted-foreground">ETH</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-background/40 px-3 py-2">
              <span className="font-mono text-xs">{shortAddress(address, 6)}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon-sm" onClick={() => copy(address)} aria-label="Copy address">
                  {copied ? <Check className="text-success" /> : <Copy />}
                </Button>
                <Button variant="ghost" size="icon-sm" asChild>
                  <a href={explorerAddressUrl(address)} target="_blank" rel="noreferrer" aria-label="View on explorer">
                    <ArrowUpRight />
                  </a>
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" disabled={disabled} onClick={() => onPrompt("Analyze my wallet's recent activity.")}>
                <Activity /> Analyze
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={FAUCET_URL} target="_blank" rel="noreferrer">
                  <Droplets /> Faucet
                </a>
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Connect a browser wallet to ask about <span className="text-foreground">your</span> balance and to approve prepared
            transactions. Read-only questions work for any address without connecting.
          </p>
        )}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success" />
            </span>
            Live block
          </span>
          <span className="font-mono tabular-nums">{blockNumber ? `#${blockNumber.toLocaleString()}` : "—"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

const QUICK_PROMPTS = [
  { icon: Coins, label: "My ETH balance", prompt: "What's my ETH balance?" },
  { icon: Fuel, label: "Gas & latest block", prompt: "What are the current gas prices and latest block on Base Sepolia?" },
  { icon: Search, label: "USDC balance", prompt: "What's my USDC balance on Base Sepolia?" },
  { icon: Send, label: "Prepare 0.001 ETH", prompt: "Prepare a transaction to send 0.001 ETH to 0x000000000000000000000000000000000000dEaD" },
];

function QuickActions({ onPrompt, disabled }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-1.5">
        {QUICK_PROMPTS.map(({ icon: Icon, label, prompt }) => (
          <button
            key={label}
            type="button"
            disabled={disabled}
            onClick={() => onPrompt(prompt)}
            className="group flex items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            <span className="flex size-7 items-center justify-center rounded-md border bg-background/50 group-hover:border-primary/40 group-hover:text-primary">
              <Icon className="size-3.5" />
            </span>
            {label}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

const TOOLS = [
  { icon: Coins, name: "getEthBalance", desc: "Native ETH balance" },
  { icon: Coins, name: "getTokenBalance", desc: "ERC-20 balances" },
  { icon: Receipt, name: "getTransaction", desc: "Tx details & status" },
  { icon: Fuel, name: "getNetworkStatus", desc: "Gas & latest block" },
  { icon: Blocks, name: "getBlock", desc: "Block details" },
  { icon: Activity, name: "analyzeWallet", desc: "Explorer history + insights" },
  { icon: Send, name: "prepareTransaction", desc: "Build a tx preview (no signing)" },
];

function Toolbox() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent toolbox</CardTitle>
        <Badge variant="secondary">{TOOLS.length} tools</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        {TOOLS.map(({ icon: Icon, name, desc }) => (
          <div key={name} className="flex items-center gap-2.5 text-xs">
            <Icon className="size-3.5 text-primary" />
            <code className="font-mono text-foreground">{name}</code>
            <span className="ml-auto truncate text-muted-foreground">{desc}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function SafetyCard() {
  return (
    <Card className="border-success/20 bg-success/[0.04]">
      <CardContent className="flex gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Human-in-the-loop by design</p>
          <p>
            The agent can only <em>prepare</em> transactions. Nothing is signed or broadcast until you approve it in your own
            wallet. Private keys never touch Chainly.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
