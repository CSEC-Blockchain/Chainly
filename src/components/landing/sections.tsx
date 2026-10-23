"use client";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Brain,
  Check,
  Fingerprint,
  KeyRound,
  Lock,
  MessageSquare,
  Send,
  ShieldCheck,
  Wallet,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useReveal } from "@/hooks/use-reveal";
import { CHAIN_ID, EXPLORER_URL, FAUCET_URL } from "@/lib/blockchain/chain";
import { cn } from "@/lib/utils";
import { ProductPreview } from "./product-preview";

const REPO_URL = "https://github.com/CSEC-Blockchain/Chainly";

/* ───────────────────────── Building blocks ───────────────────────── */

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, className }: { eyebrow: string; title: ReactNode; description?: ReactNode; className?: string }) {
  return (
    <Reveal className={cn("max-w-2xl", className)}>
      <div className="font-mono text-xs uppercase tracking-[0.14em] text-accent">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-[15px] leading-relaxed text-pretty text-muted-foreground sm:text-base">{description}</p>}
    </Reveal>
  );
}

function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-8", className)}>{children}</div>;
}

/* ───────────────────────── Header ───────────────────────── */

const NAV = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#examples", label: "Examples" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-colors duration-300",
        scrolled ? "border-border bg-background/85 backdrop-blur-md" : "border-transparent",
      )}
    >
      <Container className="flex h-14 items-center gap-8">
        <Logo />
        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
              {n.label}
            </a>
          ))}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
            GitHub
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button asChild size="sm">
            <Link href="/chat">Launch Agent</Link>
          </Button>
        </div>
      </Container>
    </header>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,black,transparent)]" aria-hidden />
      <Container className="relative pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div className="mx-auto max-w-3xl text-center">
          <a
            href="#how"
            className="inline-flex animate-fade-up items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground"
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative size-1.5 rounded-full bg-success" />
            </span>
            Live on Ethereum Sepolia
            <ArrowRight className="size-3" />
          </a>
          <h1
            className="mt-6 animate-fade-up text-[2.6rem] leading-[1.04] font-semibold tracking-[-0.045em] text-balance sm:text-6xl md:text-7xl"
            style={{ animationDelay: "60ms" }}
          >
            Talk to Ethereum.
            <br />
            <span className="text-muted-foreground">It talks back.</span>
          </h1>
          <p
            className="mx-auto mt-6 max-w-xl animate-fade-up text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            Chainly is an AI agent for the onchain world. It reads live data, analyzes wallets and prepares transactions. You approve every signature yourself.
          </p>
          <div className="mt-9 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "180ms" }}>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/chat">
                Launch Agent <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <a href="#features">Explore Features</a>
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl animate-fade-up sm:mt-20" style={{ animationDelay: "260ms" }}>
          <ProductPreview />
        </div>
      </Container>
    </section>
  );
}

/* ───────────────────────── Capabilities ───────────────────────── */

export function Capabilities() {
  return (
    <section id="features" className="scroll-mt-16 border-t py-24 sm:py-32">
      <Container>
        <SectionHeading
          eyebrow="Capabilities"
          title="Read. Analyze. Prepare."
          description="Three things Chainly does well, built on real tools rather than guesses. Every answer is backed by a live call to Ethereum Sepolia or a block explorer."
        />

        <div className="mt-14 grid overflow-hidden rounded-xl border md:grid-cols-3">
          <Reveal className="flex flex-col border-b p-6 sm:p-8 md:border-r md:border-b-0">
            <CapabilityHead icon={<BookOpen />} title="Read" text="Balances, ERC-20 tokens, transactions, gas and blocks. Fetched live from the RPC and explained in plain language." />
            <div className="mt-8 space-y-px overflow-hidden rounded-lg border font-mono text-[11.5px]">
              {[
                ["getEthBalance", "2.418 ETH"],
                ["getTokenBalance", "120 USDC"],
                ["getTransaction", "success"],
                ["getNetworkStatus", "1.2 gwei"],
              ].map(([fn, out]) => (
                <div key={fn} className="flex items-center justify-between bg-surface px-3 py-2">
                  <span>
                    <span className="text-accent">{fn}</span>
                    <span className="text-subtle-foreground">()</span>
                  </span>
                  <span className="text-muted-foreground">{out}</span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={80} className="flex flex-col border-b p-6 sm:p-8 md:border-r md:border-b-0">
            <CapabilityHead icon={<Activity />} title="Analyze" text="Turns raw explorer history into insight: flows in and out, gas spend, counterparties, contract usage and patterns." />
            <div className="mt-8 rounded-lg border bg-surface p-4">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Daily activity</span>
                <span className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-foreground/70" /> out</span>
                  <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-accent" /> in</span>
                </span>
              </div>
              <div className="mt-4 flex h-20 items-end gap-1.5" aria-hidden>
                {[[4, 2], [6, 1], [3, 4], [7, 2], [5, 3], [8, 5], [4, 2], [6, 6], [3, 1], [9, 3]].map(([out, inn], i) => (
                  <div key={i} className="flex flex-1 flex-col justify-end gap-0.5">
                    <div className="rounded-sm bg-accent" style={{ height: `${inn * 7}px` }} />
                    <div className="rounded-sm bg-foreground/70" style={{ height: `${out * 5}px` }} />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={160} className="flex flex-col p-6 sm:p-8">
            <CapabilityHead icon={<Send />} title="Prepare" text="Describe a transfer in words. Chainly validates it, estimates gas and builds a preview. Then it waits for you." />
            <div className="mt-8 rounded-lg border bg-surface p-4 text-[12px]">
              {["Recipient checksum valid", "Balance covers amount + gas", `Chain ID ${CHAIN_ID}`].map((c) => (
                <div key={c} className="flex items-center gap-2 py-1 text-muted-foreground">
                  <span className="flex size-4 items-center justify-center rounded-full bg-success/15 text-success">
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                  {c}
                </div>
              ))}
              <div className="mt-3 flex items-center justify-between rounded-md border border-dashed border-border-strong bg-background px-3 py-2">
                <span className="text-muted-foreground">Awaiting your signature</span>
                <KeyRound className="size-3.5 text-accent" />
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function CapabilityHead({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div>
      <div className="flex size-9 items-center justify-center rounded-lg border bg-surface [&_svg]:size-4">{icon}</div>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

/* ───────────────────────── How it works ───────────────────────── */

const STEPS = [
  {
    icon: MessageSquare,
    title: "Ask",
    text: "Ask in plain English. Your connected wallet travels along as context, so “my balance” just works.",
    trace: [{ k: "user", v: "Is it a good time to send 0.01 ETH?" }],
  },
  {
    icon: Brain,
    title: "Reason",
    text: "The model plans which facts it needs and picks tools from a typed toolbox. It never makes up numbers.",
    trace: [{ k: "plan", v: "need gas price → getNetworkStatus" }],
  },
  {
    icon: Wrench,
    title: "Execute tools",
    text: "Tools run on the server: viem for RPC reads, an explorer for history. Results are validated and returned as JSON.",
    trace: [
      { k: "call", v: "getNetworkStatus()" },
      { k: "result", v: '{ gasPriceGwei: "1.21", blockNumber: "8 412 907" }' },
    ],
  },
  {
    icon: Fingerprint,
    title: "Respond",
    text: "The answer streams back with rich cards. Anything that moves funds becomes a preview that only you can sign.",
    trace: [{ k: "agent", v: "Gas is low right now. A simple transfer costs ~0.000025 ETH." }],
  },
];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % STEPS.length), 3200);
    return () => window.clearInterval(id);
  }, [auto]);

  return (
    <section id="how" className="scroll-mt-16 border-t py-24 sm:py-32">
      <Container>
        <SectionHeading
          className="max-w-3xl"
          eyebrow="How it works"
          title="Ask → Reason → Execute tools → Respond"
          description="Chainly is a tool-calling agent loop. The model decides what it needs to know, and deterministic code does the actual work."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <Reveal>
            <ol className="relative">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                const isActive = i === active;
                return (
                  <li key={step.title} className="relative pb-2 pl-12 last:pb-0">
                    {i < STEPS.length - 1 && <span className="absolute top-10 bottom-0 left-[17px] w-px bg-border" aria-hidden />}
                    <span
                      className={cn(
                        "absolute top-2 left-0 flex size-9 items-center justify-center rounded-lg border transition-colors duration-300",
                        isActive ? "border-accent/50 bg-accent-soft text-accent" : "bg-background text-muted-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActive(i);
                        setAuto(false);
                      }}
                      className={cn("w-full rounded-lg px-3 py-2.5 text-left transition-colors", isActive ? "bg-surface" : "hover:bg-surface/60")}
                      aria-current={isActive ? "step" : undefined}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="font-mono text-[11px] text-subtle-foreground">0{i + 1}</span>
                        <span className={cn("font-medium transition-colors", isActive ? "text-foreground" : "text-muted-foreground")}>{step.title}</span>
                      </div>
                      <div className={cn("grid transition-all duration-300", isActive ? "mt-1.5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                        <p className="overflow-hidden text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </Reveal>

          <Reveal delay={100}>
            <div className="overflow-hidden rounded-xl border bg-surface">
              <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-[11px] text-subtle-foreground">
                <span>agent trace</span>
                <span>POST /api/chat</span>
              </div>
              <div className="space-y-1 p-4 font-mono text-[12px] leading-relaxed">
                {STEPS.flatMap((step, i) =>
                  step.trace.map((line, j) => (
                    <div
                      key={`${i}-${j}`}
                      className={cn(
                        "flex gap-3 rounded-md px-2 py-1.5 transition-all duration-300",
                        i === active ? "bg-background text-foreground" : i < active ? "text-muted-foreground" : "text-subtle-foreground/60",
                      )}
                    >
                      <span className={cn("w-12 shrink-0", i === active ? "text-accent" : "")}>{line.k}</span>
                      <span className="min-w-0 break-words">{line.v}</span>
                    </div>
                  )),
                )}
                <div className="flex items-center gap-2 px-2 pt-3 text-[11px] text-subtle-foreground">
                  <Lock className="size-3" /> no signing tools · keys never leave your wallet
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

/* ───────────────────────── Examples ───────────────────────── */

const EXAMPLES = [
  {
    query: "What's my ETH balance?",
    tools: ["getEthBalance"],
    result: "Your live balance and whether the address is a wallet or a contract.",
  },
  {
    query: "How busy is Ethereum Sepolia right now?",
    tools: ["getNetworkStatus"],
    result: "Latest block, gas price, base and priority fees, block utilization and the cost of a simple transfer.",
  },
  {
    query: "Analyze my wallet's recent activity and spending patterns.",
    tools: ["analyzeWallet"],
    result: "Money in and out, net flow, gas spent, top counterparties, contract usage, a daily chart and plain-English insights.",
  },
  {
    query: "How much USDC and LINK do I hold?",
    tools: ["getTokenBalance", "getTokenBalance"],
    result: "ERC-20 balances, with the correct decimals applied, for well-known Sepolia tokens or any contract address.",
  },
  {
    query: "Check my balance, then prepare a transaction to send 0.001 ETH to 0x000000000000000000000000000000000000dEaD.",
    tools: ["getEthBalance", "prepareTransaction"],
    result: "A transaction preview with fees, validation checks and an Approve button that opens your wallet.",
  },
  {
    query: "Explain the latest block.",
    tools: ["getBlock"],
    result: "Block number, timestamp, transaction count, gas usage and base fee.",
  },
];

export function Examples() {
  const [selected, setSelected] = useState(0);
  const ex = EXAMPLES[selected];

  return (
    <section id="examples" className="scroll-mt-16 border-t py-24 sm:py-32">
      <Container>
        <SectionHeading
          eyebrow="Examples"
          title="Just ask."
          description="No ABIs, hex or explorer tabs. Pick a query to see which tools Chainly would call, then try it yourself."
        />
        <Reveal className="mt-14 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr] [&>*]:min-w-0">
          <div className="flex flex-col gap-1.5" role="listbox" aria-label="Example queries">
            {EXAMPLES.map((e, i) => (
              <button
                key={e.query}
                role="option"
                aria-selected={i === selected}
                onClick={() => setSelected(i)}
                onMouseEnter={() => setSelected(i)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-all duration-200",
                  i === selected ? "border-border-strong bg-surface text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <span className={cn("font-mono text-xs transition-colors", i === selected ? "text-accent" : "text-subtle-foreground")}>›</span>
                <span className="line-clamp-1 min-w-0 break-all sm:break-normal">{e.query}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col rounded-xl border bg-surface p-6" aria-live="polite">
            <div className="text-xs text-subtle-foreground">You ask</div>
            <p key={ex.query} className="mt-2 animate-fade-in text-[15px] font-medium leading-snug break-words">“{ex.query}”</p>
            <div className="mt-6 text-xs text-subtle-foreground">Chainly calls</div>
            <div key={`t-${selected}`} className="mt-2 flex flex-wrap gap-1.5">
              {ex.tools.map((t, i) => (
                <span
                  key={i}
                  className="animate-fade-up rounded-md border bg-background px-2 py-1 font-mono text-[11.5px] text-accent"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  {t}()
                </span>
              ))}
            </div>
            <div className="mt-6 text-xs text-subtle-foreground">You get</div>
            <p key={`r-${selected}`} className="mt-2 animate-fade-in text-sm leading-relaxed text-muted-foreground">
              {ex.result}
            </p>
            <div className="mt-auto pt-8">
              <Button asChild variant="outline" size="sm">
                <Link href={`/chat?q=${encodeURIComponent(ex.query)}`}>
                  Try it in Chainly <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

/* ───────────────────────── Trust ───────────────────────── */

const GUARANTEES = [
  { icon: Wallet, title: "No signing tools", text: "The agent's toolbox can read and prepare. It has no way to sign or broadcast anything." },
  { icon: ShieldCheck, title: "Sender locked to you", text: "The sender always comes from your connected wallet, never from the model. Prompt injection can't change who pays." },
  { icon: KeyRound, title: "Checked twice", text: "Every preview is validated on the server and checked again in your browser before your wallet opens." },
];

export function Trust() {
  return (
    <section className="border-t py-24 sm:py-32">
      <Container>
        <SectionHeading eyebrow="Trust" title="Your keys. Your signature. Always." />
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {GUARANTEES.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 80}>
              <Icon className="size-5 text-accent" />
              <h3 className="mt-4 font-medium">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* ───────────────────────── Final CTA & footer ───────────────────────── */

export function FinalCta() {
  return (
    <section className="border-t">
      <Container className="py-24 text-center sm:py-32">
        <Reveal>
          <h2 className="mx-auto max-w-2xl text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-5xl">Ethereum, in plain English.</h2>
          <p className="mx-auto mt-4 max-w-md text-muted-foreground">Connect a Sepolia wallet, or just paste an address. No sign-up needed.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/chat">
                Launch Agent <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="w-full sm:w-auto">
              <a href={FAUCET_URL} target="_blank" rel="noreferrer">
                Get Sepolia ETH <ArrowUpRight />
              </a>
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="text-xs text-subtle-foreground">Built for the CSEC-ASTU Blockchain × AI session</span>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-muted-foreground" aria-label="Footer">
          <Link href="/chat" className="hover:text-foreground">Agent</Link>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
          <a href={EXPLORER_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">Sepolia Etherscan</a>
          <a href={FAUCET_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">Faucet</a>
        </nav>
      </Container>
    </footer>
  );
}
