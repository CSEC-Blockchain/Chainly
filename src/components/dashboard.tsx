"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Activity,
  AlertTriangle,
  ArrowUp,
  Bot,
  Coins,
  Fuel,
  PanelRight,
  Receipt,
  RotateCcw,
  Send,
  Square,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection } from "wagmi";
import { Message, ThinkingIndicator } from "@/components/chat/message";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ConnectButton } from "@/components/wallet/connect-button";
import { WalletPanel } from "@/components/wallet/wallet-panel";
import type { ChainlyMessage } from "@/lib/agent/types";
import { CHAIN } from "@/lib/blockchain/chain";

type Status = {
  llm: { configured: true; provider: string; model: string } | { configured: false; reason: string };
  explorer: string;
};

export function Dashboard() {
  const { address } = useConnection();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status: chatStatus, error, stop, regenerate, setMessages, clearError } = useChat<ChainlyMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  // Keep the newest message in view while streaming.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 240;
    if (nearBottom || chatStatus === "submitted") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, chatStatus]);

  const busy = chatStatus === "submitted" || chatStatus === "streaming";

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      if (error) clearError();
      // The connected address travels with every request so "my wallet" works.
      sendMessage({ text: trimmed }, { body: { connectedAddress: address ?? null } });
      setInput("");
      setSheetOpen(false);
    },
    [address, busy, error, clearError, sendMessage],
  );

  const lastMessage = messages[messages.length - 1];
  const showThinking = chatStatus === "submitted" || (chatStatus === "streaming" && lastMessage?.role === "assistant" && lastMessage.parts.length === 0);

  return (
    <div className="app-backdrop relative flex h-dvh flex-col overflow-hidden">
      <div className="app-grid pointer-events-none absolute inset-0" />

      <header className="relative z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/50 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">Chainly</span>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            <span className="size-1.5 rounded-full bg-primary" /> {CHAIN.name}
          </Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {status && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="hidden md:inline-flex">
                  <Badge variant={status.llm.configured ? "outline" : "warning"}>
                    <Bot /> {status.llm.configured ? `${status.llm.provider} · ${status.llm.model}` : "LLM not configured"}
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {status.llm.configured ? `Explorer: ${status.explorer}. Keys stay on the server.` : status.llm.reason}
              </TooltipContent>
            </Tooltip>
          )}
          <ConnectButton />
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon-sm" className="lg:hidden" aria-label="Open wallet panel">
                <PanelRight />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="text-sm font-semibold">Dashboard</SheetTitle>
              <WalletPanel onPrompt={send} disabled={busy} />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="relative z-0 flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
              {messages.length === 0 ? (
                <EmptyState onPrompt={send} connected={Boolean(address)} llmIssue={status && !status.llm.configured ? status.llm.reason : null} />
              ) : (
                messages.map((m) => <Message key={m.id} message={m} onAskAgent={send} />)
              )}
              {showThinking && <ThinkingIndicator />}
              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="flex-1">
                    <div className="font-medium text-destructive">The agent hit an error</div>
                    <div className="text-muted-foreground">{readableError(error)}</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => regenerate({ body: { connectedAddress: address ?? null } })}>
                    <RotateCcw /> Retry
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 px-4 pb-4">
            <form
              className="mx-auto w-full max-w-3xl"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <div className="rounded-2xl border bg-card/80 p-2 pl-4 shadow-2xl shadow-black/40 backdrop-blur-xl transition-colors focus-within:border-primary/50">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  placeholder="Ask about balances, transactions, gas, wallets — or prepare a transfer…"
                  className="max-h-40 py-2"
                  rows={1}
                  aria-label="Message the agent"
                />
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-muted-foreground">
                    {address ? "Wallet connected · agent prepares, you approve" : "Read-only mode · connect a wallet to transact"}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    {messages.length > 0 && !busy && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setMessages([])} aria-label="New chat">
                            <Trash2 />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>New chat</TooltipContent>
                      </Tooltip>
                    )}
                    {busy ? (
                      <Button type="button" size="icon-sm" variant="secondary" onClick={() => stop()} aria-label="Stop">
                        <Square className="fill-current" />
                      </Button>
                    ) : (
                      <Button type="submit" size="icon-sm" disabled={!input.trim()} aria-label="Send">
                        <ArrowUp />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        </main>

        <aside className="scrollbar-thin hidden w-[22rem] shrink-0 overflow-y-auto border-l bg-background/30 p-4 backdrop-blur-sm lg:block">
          <WalletPanel onPrompt={send} disabled={busy} />
        </aside>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  { icon: Coins, title: "Check a balance", prompt: "What's the ETH balance of 0x4200000000000000000000000000000000000006?" },
  { icon: Activity, title: "Analyze a wallet", prompt: "Analyze my wallet's recent activity and spending patterns." },
  { icon: Fuel, title: "Gas & blocks", prompt: "How busy is Base Sepolia right now? Show gas prices and the latest block." },
  { icon: Send, title: "Prepare a transfer", prompt: "Check my balance, then prepare a transaction to send 0.001 ETH to 0x000000000000000000000000000000000000dEaD and estimate the gas fee." },
  { icon: Receipt, title: "Read a transaction", prompt: "Explain this transaction: " },
];

function EmptyState({ onPrompt, connected, llmIssue }: { onPrompt: (t: string) => void; connected: boolean; llmIssue: string | null }) {
  return (
    <div className="flex flex-col items-center pt-6 text-center sm:pt-14">
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-2xl bg-primary/40 blur-2xl" />
        <div className="relative flex size-14 items-center justify-center rounded-2xl border border-primary/40 bg-gradient-to-br from-primary to-primary/40 shadow-xl">
          <Logo className="size-7 text-white" />
        </div>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your AI agent for the onchain world</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Ask in plain English. Chainly reads live data from {CHAIN.name}, analyzes wallets and prepares transactions — you always
        sign.
      </p>
      {llmIssue && (
        <div className="mt-5 flex max-w-lg items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-left text-xs text-warning">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> {llmIssue}
        </div>
      )}
      <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.filter((s) => connected || !s.prompt.includes("my")).slice(0, 4).map(({ icon: Icon, title, prompt }) => (
          <button
            key={title}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="group flex items-start gap-3 rounded-xl border bg-card/50 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background/50 text-muted-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium">{title}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{prompt}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Logo({ className = "size-6 text-primary" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M9 7.5 12 6l3 1.5v3L12 12 9 10.5v-3Z" fill="currentColor" opacity=".9" />
      <path d="M4 13.5 7 12l3 1.5v3L7 18l-3-1.5v-3ZM14 13.5l3-1.5 3 1.5v3L17 18l-3-1.5v-3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function readableError(error: Error) {
  try {
    const parsed = JSON.parse(error.message);
    if (parsed?.error) return String(parsed.error);
  } catch {
    // not JSON
  }
  return error.message || "Unknown error";
}
