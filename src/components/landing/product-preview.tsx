"use client";

import { Activity, ArrowUp, Check, Fuel, Loader2, PenLine, Plus, Send, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

/**
 * An animated, illustrative replay of a Chainly conversation for the landing
 * hero. Everything is derived from a single `elapsed` clock so the animation
 * is deterministic, pausable and honours reduced-motion. Values are examples.
 */

type ToolStep = { label: string; name: string };
type Scenario = {
  id: string;
  tab: string;
  icon: typeof Wallet;
  prompt: string;
  tools: ToolStep[];
  card: ReactNode;
  answer: string;
};

const SCENARIOS: Scenario[] = [
  {
    id: "read",
    tab: "Read",
    icon: Wallet,
    prompt: "What's the ETH balance of 0x71C7…976F?",
    tools: [{ label: "Read ETH balance", name: "getEthBalance" }],
    card: <BalancePreview />,
    answer: "The wallet holds 2.4180 ETH on Ethereum Sepolia. It's a regular account (EOA), not a contract.",
  },
  {
    id: "analyze",
    tab: "Analyze",
    icon: Activity,
    prompt: "Analyze my wallet's activity this month",
    tools: [
      { label: "Fetched wallet history", name: "analyzeWallet" },
      { label: "Checked network status", name: "getNetworkStatus" },
    ],
    card: <ActivityPreview />,
    answer: "You're mostly a sender: 18 of 27 transactions were outgoing, and most of them were contract calls. Gas was about 0.4% of the ETH you moved.",
  },
  {
    id: "prepare",
    tab: "Prepare",
    icon: Send,
    prompt: "Send 0.05 ETH to 0x9F2c…41aB",
    tools: [
      { label: "Read ETH balance", name: "getEthBalance" },
      { label: "Validated & prepared transaction", name: "prepareTransaction" },
    ],
    card: <TxPreview />,
    answer: "Ready for review. All checks passed. Nothing is sent until you approve it in your wallet.",
  },
];

const TYPE_MS = 26;
const TOOL_MS = 650;
const WORD_MS = 45;
const HOLD_MS = 2600;

function timeline(s: Scenario) {
  const typed = s.prompt.length * TYPE_MS;
  const sent = typed + 300;
  const thinkingEnd = sent + 700;
  const toolsEnd = thinkingEnd + s.tools.length * TOOL_MS;
  const cardAt = toolsEnd + 150;
  const answerAt = cardAt + 500;
  const words = s.answer.split(" ").length;
  const answerEnd = answerAt + words * WORD_MS;
  return { typed, sent, thinkingEnd, toolsEnd, cardAt, answerAt, answerEnd, total: answerEnd + HOLD_MS };
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCED_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

export function ProductPreview() {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const [inView, setInView] = useState(true);
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  const scenario = SCENARIOS[index];
  const t = useMemo(() => timeline(scenario), [scenario]);
  const now = reduced ? t.answerEnd : elapsed;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.2 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !inView) return;
    const id = window.setInterval(() => {
      const next = elapsedRef.current + 50;
      if (next >= t.total) {
        elapsedRef.current = 0;
        setIndex((i) => (i + 1) % SCENARIOS.length);
        setElapsed(0);
      } else {
        elapsedRef.current = next;
        setElapsed(next);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [reduced, inView, t.total]);

  const select = (i: number) => {
    elapsedRef.current = 0;
    setIndex(i);
    setElapsed(0);
  };

  const typedText = scenario.prompt.slice(0, Math.floor(now / TYPE_MS));
  const isSent = now >= t.sent;
  const thinking = isSent && now < t.thinkingEnd;
  const words = scenario.answer.split(" ");
  const shownWords = now >= t.answerAt ? Math.min(words.length, Math.floor((now - t.answerAt) / WORD_MS) + 1) : 0;

  return (
    <div ref={rootRef} className="w-full">
      <div className="overflow-hidden rounded-xl border border-border-strong bg-background shadow-[0_30px_80px_-30px_rgb(0_0_0/0.45)] dark:shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)]">
        {/* Window chrome */}
        <div className="flex h-10 items-center gap-3 border-b px-3.5">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full border border-border-strong" />
            <span className="size-2.5 rounded-full border border-border-strong" />
            <span className="size-2.5 rounded-full border border-border-strong" />
          </div>
          <div className="mx-auto font-mono text-[11px] text-subtle-foreground">chainly / chat</div>
          <div className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" /> Ethereum Sepolia
          </div>
        </div>

        <div className="grid h-[440px] grid-cols-1 sm:h-[460px] md:grid-cols-[200px_1fr]">
          {/* Mini sidebar */}
          <aside className="hidden flex-col border-r bg-surface p-3 md:flex" aria-hidden>
            <div className="flex items-center gap-2 px-1.5 pb-3 text-[13px] font-semibold">
              <LogoMark className="size-4" /> Chainly
            </div>
            <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs text-muted-foreground">
              <Plus className="size-3.5" /> New chat
            </div>
            <div className="mt-4 px-1.5 text-[10px] font-medium uppercase tracking-wider text-subtle-foreground">Recent</div>
            <div className="mt-1.5 space-y-0.5">
              {SCENARIOS.map((s, i) => (
                <div
                  key={s.id}
                  className={cn(
                    "truncate rounded-md px-2 py-1.5 text-xs transition-colors",
                    i === index ? "bg-surface-2 text-foreground" : "text-muted-foreground",
                  )}
                >
                  {s.prompt}
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-center gap-2 rounded-md border bg-background px-2 py-1.5">
              <span className="size-4 rounded-full bg-foreground/80" />
              <span className="font-mono text-[11px] text-muted-foreground">0x71C7…976F</span>
            </div>
          </aside>

          {/* Conversation */}
          <div className="relative flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-hidden px-4 pt-5 sm:px-8" aria-live="off">
              {isSent && (
                <div className="flex justify-end animate-fade-up">
                  <div className="max-w-[85%] rounded-2xl bg-surface-2 px-3.5 py-2 text-[13px]">{scenario.prompt}</div>
                </div>
              )}

              {isSent && (
                <div className="flex gap-3">
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border">
                    <LogoMark className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    {thinking && <div className="text-shimmer pt-0.5 text-[13px]">Thinking…</div>}
                    {now >= t.thinkingEnd &&
                      scenario.tools.map((tool, i) => {
                        const start = t.thinkingEnd + i * TOOL_MS;
                        if (now < start) return null;
                        const done = now >= start + TOOL_MS - 150;
                        return (
                          <div key={tool.name} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] animate-fade-up">
                            <span
                              className={cn(
                                "flex size-4 items-center justify-center rounded-full",
                                done ? "bg-foreground text-background" : "text-accent",
                              )}
                            >
                              {done ? <Check className="size-2.5" strokeWidth={3} /> : <Loader2 className="size-3.5 animate-spin" />}
                            </span>
                            <span className={done ? "" : "text-shimmer"}>{tool.label}</span>
                            <span className="ml-auto font-mono text-[10px] text-subtle-foreground">{tool.name}</span>
                          </div>
                        );
                      })}
                    {now >= t.cardAt && <div className="animate-fade-up">{scenario.card}</div>}
                    {shownWords > 0 && (
                      <p className="text-[13px] leading-relaxed text-foreground">
                        {words.slice(0, shownWords).join(" ")}
                        {shownWords < words.length && <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-caret bg-foreground" />}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="p-3 sm:px-8 sm:pb-5">
              <div className="flex items-center gap-2 rounded-xl border border-border-strong bg-background px-3.5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px]">
                  {!isSent && typedText ? (
                    <>
                      {typedText}
                      <span className="ml-px inline-block h-3.5 w-px translate-y-0.5 animate-caret bg-foreground" />
                    </>
                  ) : (
                    <span className="text-subtle-foreground">Ask anything onchain…</span>
                  )}
                </span>
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-md transition-colors",
                    !isSent && typedText ? "bg-foreground text-background" : "bg-surface-2 text-subtle-foreground",
                  )}
                >
                  <ArrowUp className="size-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scenario switcher */}
      <div className="mx-auto mt-5 flex w-fit items-center gap-1 rounded-full border bg-background p-1" role="tablist" aria-label="Preview scenarios">
        {SCENARIOS.map((s, i) => {
          const Icon = s.icon;
          const active = i === index;
          return (
            <button
              key={s.id}
              role="tab"
              aria-selected={active}
              onClick={() => select(i)}
              className={cn(
                "relative flex items-center gap-1.5 overflow-hidden rounded-full px-3.5 py-1.5 text-[13px] transition-colors",
                active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {s.tab}
              {active && !reduced && (
                <span
                  className="absolute inset-x-3 bottom-0.5 h-px origin-left bg-accent"
                  style={{ transform: `scaleX(${Math.min(1, elapsed / t.total)})` }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MiniPanel({ icon, title, right, children }: { icon: ReactNode; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-surface">
      <div className="flex items-center gap-2 border-b px-3 py-2 text-[11px] text-muted-foreground [&_svg]:size-3.5">
        {icon}
        <span className="font-medium text-foreground">{title}</span>
        <span className="ml-auto">{right}</span>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function BalancePreview() {
  return (
    <MiniPanel icon={<Wallet />} title="ETH balance" right={<span className="font-mono">0x71C7…976F</span>}>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">
          2.4180 <span className="text-sm font-normal text-muted-foreground">ETH</span>
        </div>
        <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">EOA</span>
      </div>
    </MiniPanel>
  );
}

const BARS = [3, 5, 2, 6, 4, 8, 3, 5, 7, 2, 4, 6, 9, 5];

function ActivityPreview() {
  return (
    <MiniPanel icon={<Activity />} title="Wallet activity" right="27 txs">
      <div className="grid grid-cols-3 gap-3 text-[11px]">
        {[
          ["Received", "1.25 ETH"],
          ["Sent", "0.84 ETH"],
          ["Gas", "0.0031 ETH"],
        ].map(([k, v]) => (
          <div key={k}>
            <div className="text-subtle-foreground">{k}</div>
            <div className="mt-0.5 font-medium tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-10 items-end gap-1" aria-hidden>
        {BARS.map((h, i) => (
          <div key={i} className={cn("flex-1 rounded-sm", i === 12 ? "bg-accent" : "bg-foreground/15")} style={{ height: `${h * 10}%` }} />
        ))}
      </div>
    </MiniPanel>
  );
}

function TxPreview() {
  return (
    <MiniPanel icon={<Fuel />} title="Transaction preview" right={<span className="text-success">Checks passed</span>}>
      <div className="flex items-baseline justify-between">
        <div className="text-xl font-semibold tabular-nums">
          0.05 <span className="text-sm font-normal text-muted-foreground">ETH</span>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">→ 0x9F2c…41aB</div>
      </div>
      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
        {["Valid recipient", "Balance covers amount + gas", "Ethereum Sepolia · 11155111"].map((c) => (
          <div key={c} className="flex items-center gap-1.5">
            <ShieldCheck className="size-3 text-success" /> {c}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2.5 py-1 text-[11px] font-medium text-background">
          <PenLine className="size-3" /> Approve in wallet
        </span>
        <span className="text-[11px] text-subtle-foreground">Cancel</span>
      </div>
    </MiniPanel>
  );
}
