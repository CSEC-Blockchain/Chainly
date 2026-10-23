"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Activity, AlertTriangle, ArrowDown, Blocks, Fuel, Menu, RotateCcw, Send, Wallet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useConnection } from "wagmi";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { NetworkIndicator } from "@/components/wallet/network-indicator";
import { WalletButton } from "@/components/wallet/connect-button";
import type { ChainlyMessage } from "@/lib/agent/types";
import { NETWORK_NAME } from "@/lib/blockchain/chain";
import { shortAddress } from "@/lib/blockchain/format";
import { chatStore } from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";
import { Message, ThinkingIndicator } from "./message";

const transport = new DefaultChatTransport<ChainlyMessage>({ api: "/api/chat" });

type Status = { llm: { configured: true; provider: string; model: string } | { configured: false; reason: string } };

type Props = {
  chatId: string;
  title: string;
  initialMessages: ChainlyMessage[];
  initialPrompt?: string;
  onOpenSidebar: () => void;
};

export function ChatView({ chatId, title, initialMessages, initialPrompt, onOpenSidebar }: Props) {
  const { address } = useConnection();
  const [input, setInput] = useState(initialPrompt ?? "");
  const [llm, setLlm] = useState<Status["llm"] | null>(null);
  const [stuckToBottom, setStuckToBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, error, stop, regenerate, clearError } = useChat<ChainlyMessage>({
    id: chatId,
    messages: initialMessages,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";

  // Persist finished turns to local history.
  useEffect(() => {
    if ((status === "ready" || status === "error") && messages.length > 0) chatStore.save(chatId, messages);
  }, [status, messages, chatId]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/status")
      .then((r) => r.json() as Promise<Status>)
      .then((s) => !cancelled && setLlm(s.llm))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Follow the stream only while the user is at the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stuckToBottom) el.scrollTo({ top: el.scrollHeight, behavior: status === "streaming" ? "auto" : "smooth" });
  }, [messages, status, stuckToBottom]);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      if (error) clearError();
      setStuckToBottom(true);
      // The connected address travels with each request so "my wallet" works.
      sendMessage({ text: trimmed }, { body: { connectedAddress: address ?? null } });
      setInput("");
    },
    [address, busy, error, clearError, sendMessage],
  );

  const last = messages[messages.length - 1];
  const thinking = status === "submitted" || (status === "streaming" && last?.role === "assistant" && last.parts.length === 0);
  const empty = messages.length === 0;
  const composerFooter = address ? (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-1.5 rounded-full bg-success" /> {shortAddress(address)} · you approve every transaction
    </span>
  ) : (
    "Read-only · connect a wallet to transact"
  );

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 px-3 sm:px-4">
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onOpenSidebar} aria-label="Open sidebar">
          <Menu />
        </Button>
        <h1 className="min-w-0 truncate text-sm font-medium text-muted-foreground">{empty ? "New chat" : title}</h1>
        <div className="ml-auto flex items-center gap-2">
          <NetworkIndicator className="hidden sm:inline-flex" />
          <WalletButton />
        </div>
      </header>

      {empty ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 pb-16">
          <EmptyState onPick={send} connected={Boolean(address)} llmIssue={llm && !llm.configured ? llm.reason : null} />
          <Composer
            ref={inputRef}
            value={input}
            onChange={setInput}
            onSubmit={() => send(input)}
            onStop={stop}
            busy={busy}
            footer={composerFooter}
            className="mt-8 max-w-2xl animate-fade-up [animation-delay:120ms]"
          />
          <Suggestions onPick={send} connected={Boolean(address)} />
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              setStuckToBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
            }}
            className="scrollbar-thin relative min-h-0 flex-1 overflow-y-auto"
          >
            <div className="mx-auto w-full max-w-3xl space-y-8 px-4 pt-6 pb-10 sm:px-6">
              {messages.map((m, i) => (
                <Message key={m.id} message={m} streaming={busy && i === messages.length - 1} onAskAgent={send} />
              ))}
              {thinking && <ThinkingIndicator />}
              {error && (
                <div className="flex animate-fade-up items-start gap-3 rounded-xl border border-destructive/30 px-4 py-3 text-sm" role="alert">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">Something went wrong</div>
                    <div className="mt-0.5 text-muted-foreground">{readableError(error)}</div>
                  </div>
                  <Button size="xs" variant="outline" onClick={() => regenerate({ body: { connectedAddress: address ?? null } })}>
                    <RotateCcw /> Retry
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="relative shrink-0 px-4 pb-4 sm:px-6">
            <button
              type="button"
              onClick={() => {
                setStuckToBottom(true);
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
              }}
              className={cn(
                "absolute -top-12 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-md transition-all duration-200 hover:text-foreground",
                stuckToBottom ? "pointer-events-none translate-y-2 opacity-0" : "opacity-100",
              )}
              aria-label="Scroll to latest"
              tabIndex={stuckToBottom ? -1 : 0}
            >
              <ArrowDown className="size-4" />
            </button>
            <Composer
              ref={inputRef}
              value={input}
              onChange={setInput}
              onSubmit={() => send(input)}
              onStop={stop}
              busy={busy}
              footer={composerFooter}
              placeholder="Ask a follow-up…"
              className="mx-auto max-w-3xl"
            />
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ connected, llmIssue }: { onPick: (t: string) => void; connected: boolean; llmIssue: string | null }) {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center text-center">
      <div className="flex size-11 animate-fade-up items-center justify-center rounded-xl border">
        <LogoMark className="size-5" />
      </div>
      <h2 className="mt-6 animate-fade-up text-2xl font-semibold tracking-[-0.03em] text-balance [animation-delay:40ms] sm:text-3xl">
        What do you want to know onchain?
      </h2>
      <p className="mt-2 animate-fade-up text-sm text-muted-foreground [animation-delay:80ms]">
        Live data from {NETWORK_NAME}.{" "}
        {connected ? "Your wallet is connected, so try asking about “my” balance." : "Paste any address, or connect a wallet."}
      </p>
      {llmIssue && (
        <div className="mt-5 flex items-start gap-2 rounded-lg border border-warning/30 px-3 py-2 text-left text-xs text-warning">
          <AlertTriangle className="mt-px size-3.5 shrink-0" /> {llmIssue}
        </div>
      )}
    </div>
  );
}

const SAMPLE_ADDRESS = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";

function Suggestions({ onPick, connected }: { onPick: (t: string) => void; connected: boolean }) {
  const items = [
    connected
      ? { icon: Wallet, title: "My balance", prompt: "What's my ETH balance?" }
      : { icon: Wallet, title: "Check a balance", prompt: `What's the ETH balance of ${SAMPLE_ADDRESS}?` },
    { icon: Fuel, title: "Gas right now", prompt: `How busy is ${NETWORK_NAME} right now? Show gas prices and the latest block.` },
    connected
      ? { icon: Activity, title: "Analyze my wallet", prompt: "Analyze my wallet's recent activity and spending patterns." }
      : { icon: Blocks, title: "Latest block", prompt: "Explain the latest block." },
    {
      icon: Send,
      title: "Prepare a transfer",
      prompt: "Check my balance, then prepare a transaction to send 0.001 ETH to 0x000000000000000000000000000000000000dEaD and estimate the gas fee.",
    },
  ];
  return (
    <div className="mt-4 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
      {items.map(({ icon: Icon, title, prompt }, i) => (
        <button
          key={title}
          type="button"
          onClick={() => onPick(prompt)}
          className="group flex animate-fade-up items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface"
          style={{ animationDelay: `${180 + i * 50}ms` }}
        >
          <Icon className="mt-0.5 size-4 shrink-0 text-subtle-foreground transition-colors group-hover:text-accent" />
          <span className="min-w-0">
            <span className="block text-[13px] font-medium">{title}</span>
            <span className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{prompt}</span>
          </span>
        </button>
      ))}
    </div>
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
