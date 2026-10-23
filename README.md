# Chainly: the natural-language interface for Ethereum

Chainly is an AI agent for **Ethereum Sepolia** (chain ID `11155111`). You ask questions in plain English. It reads **live onchain data**, analyzes wallet activity, and **prepares** transactions that you approve in your own wallet. It never signs anything for you.

> Built by the **CSEC-ASTU Blockchain Team** for the Blockchain × AI session. Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

| Route | What it is |
|---|---|
| `/` | Landing page: hero with an animated product preview, capabilities, how it works, interactive examples |
| `/chat` | The agent workspace: collapsible history sidebar, streaming chat, tool steps, result cards, wallet |

## Features

- 💬 **Conversational agent:** a streaming chat with Markdown answers. Each tool call shows an expandable step with its raw JSON input and output, plus a rich result card.
- 🔎 **Read:** ETH balances, ERC-20 balances (USDC, WETH and LINK by symbol, or any contract), transaction details, gas prices, block info.
- 📊 **Analyze:** explorer history turned into money in and out, net flow, gas spent, counterparties, contract usage, a daily chart and insights backed by the data.
- ✍️ **Prepare:** validates the address, amount, balance and network, estimates gas, and shows a preview card. **You** sign in your wallet.
- 🛡️ **Safety:**
  - No signing tools.
  - The sender is locked to the connected wallet.
  - The preview is re-checked in the browser before the wallet opens.
  - Previews expire after 10 minutes.
  - A preview that was already submitted can't be signed again from chat history.
- 🗂️ **Local history:** conversations are saved in `localStorage`, with no database. Keyboard shortcuts: `⌘B` toggles the sidebar, `⇧⌘O` starts a new chat.
- 🌗 **Dark by default**, plus a light theme with no flash on load.

## Quick start

```bash
pnpm install
cp .env.example .env.local   # add your AI Gateway key
pnpm dev                     # http://localhost:3000
```

By default Chainly uses the [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) with the free `nvidia/nemotron-3.5-lightning-free` model. Minimum `.env.local`:

```bash
AI_GATEWAY_API_KEY=...       # Vercel dashboard → AI Gateway → API Keys
```

On Vercel deployments no key is needed: the gateway authenticates with the project's OIDC token. To try another gateway model, set `LLM_MODEL` (for example `reflection/beam-free`, or a paid one like `anthropic/claude-sonnet-5-5`).

To use a provider directly instead, set its key (and optionally `LLM_PROVIDER`):

```bash
LLM_PROVIDER=openai          # openai | anthropic | google | openai-compatible
OPENAI_API_KEY=sk-...        # or ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY
```

Any OpenAI-compatible provider (Groq, OpenRouter, Ollama) works too:

```bash
LLM_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://api.groq.com/openai/v1
OPENAI_COMPATIBLE_API_KEY=gsk_...
LLM_MODEL=llama-3.3-70b-versatile
```

Pick a model that supports **tool calling**.

### Network configuration

| Variable | Purpose | Default |
|---|---|---|
| `SEPOLIA_RPC_URL` | Server RPC (can hold an Alchemy/Infura key; never sent to the browser) | public fallbacks: publicnode → drpc → 1rpc |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | Browser RPC for the live block and wallet balance | publicnode |
| `ETHERSCAN_API_KEY` | Wallet history via Etherscan V2 (`chainid=11155111`) | keyless Blockscout (`eth-sepolia.blockscout.com`) |

Explorer links point to [sepolia.etherscan.io](https://sepolia.etherscan.io). Get test ETH from the [Google Cloud Sepolia faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia). The wallet button prompts **Switch to Sepolia** when your wallet is on another network.

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build && pnpm start` | Production build and run |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Next route types + `tsc --noEmit` |
| `pnpm test` | Vitest unit tests |

## Architecture

```
 Browser (React, wagmi)                         Server (Next.js route handler)
┌───────────────────────────────┐   POST      ┌──────────────────────────────────────┐
│ /chat  useChat ── messages ───┼────────────▶│ /api/chat                            │
│        + connected address    │             │  streamText(model, instructions,     │
│                               │  SSE stream │             tools, stopWhen=8 steps) │
│ tool steps + result cards ◀───┼◀────────────┤        │            ▲                │
│                               │             │        ▼            │ JSON           │
│ TransactionPreviewCard        │             │  lib/agent/tools.ts (7 typed tools)  │
│  └ signing-guard (re-check)   │             │        │                             │
│  └ wallet.sendTransaction ◀── user click    │        ▼                             │
└──────────────┬────────────────┘             │  lib/blockchain/* (pure, tested)     │
               │ user signs                   │   reader · activity · transfer       │
               ▼                              │   explorer (Blockscout / Etherscan)  │
       Ethereum Sepolia ◀──────── viem RPC ───┤                                      │
                                              └──────────────────────────────────────┘
```

```
src/
├─ app/
│  ├─ page.tsx                ← landing page
│  ├─ chat/page.tsx           ← agent workspace
│  ├─ api/chat/route.ts       ← the agent loop (LLM ⇄ tools, streamed)
│  └─ api/status/route.ts     ← non-secret config (LLM configured? which explorer?)
├─ lib/
│  ├─ agent/                  ← model provider, tool definitions, instructions, types
│  ├─ blockchain/             ← chain config, reader, explorer, activity, transfer,
│  │                             signing-guard, tx-records, validation, errors
│  ├─ web3/wagmi.ts           ← browser wallet config (injected wallets, Sepolia)
│  └─ chat-store.ts           ← localStorage chat history
└─ components/
   ├─ landing/                ← hero, product preview, sections
   ├─ chat/                   ← workspace, sidebar, chat view, composer, messages, tool steps
   ├─ cards/                  ← balance, token, tx, network, block, activity, tx preview
   ├─ wallet/                 ← wallet button + menu, network indicator, identicon
   └─ ui/                     ← shadcn/ui-style primitives
```

The network lives in one file, `src/lib/blockchain/chain.ts`. Changing chains means editing that file (plus the token list in `reader.ts`).

### Agent tools

| Tool | Input | Source | Returns |
|---|---|---|---|
| `getEthBalance` | `address?` (defaults to connected wallet) | RPC | balance, EOA/contract, block |
| `getTokenBalance` | `address?`, `token` (symbol or contract) | RPC (`erc20Abi`) | balance with decimals, token metadata |
| `getTransaction` | `hash` | RPC tx + receipt + block | status, value, fee, gas, confirmations |
| `getNetworkStatus` | none | RPC | latest block, gas price, base/priority fee, utilization |
| `getBlock` | `blockNumber?` | RPC | block stats |
| `analyzeWallet` | `address?`, `limit` | Blockscout / Etherscan V2 | stats, counterparties, daily chart, insights |
| `prepareTransaction` | `to`, `amountEth` | RPC (fees, balance, estimateGas, getCode) | a **preview** with checks, `readyToSign` |

### Transaction safety model

1. **No capability:** the toolbox has nothing that signs or broadcasts, and the server holds no keys.
2. **No spoofing:** the sender comes from the connected wallet (captured in a closure), not from the LLM's arguments. This is unit-tested.
3. **Validated intent:**
   - checksummed addresses and a zero-address block
   - locale-safe amounts (`"1,5"` is rejected, not guessed)
   - a 10 ETH ceiling
   - a balance check covering amount plus max gas
   - a warning when the recipient is a contract
4. **Human in the loop:** only a click on **Approve in wallet** opens the wallet.
5. **Defense in depth:** `signing-guard.ts` re-checks the chain ID, sender, amount and gas bounds, and a 10-minute expiry. `tx-records.ts` stops a submitted preview from being re-signed when a chat is reopened.
6. **No leaks:** viem errors (which can include RPC URLs with keys) are mapped to clean messages.

## Design system

- **Type:** Geist Sans for UI and Geist Mono for data (addresses, hashes, tool names).
- **Color:** a monochrome neutral scale with a single violet accent (`--accent`), used for focus, live and active states only. Status colors (success, warning, destructive) are muted.
- **Surfaces:** `background` → `surface` → `surface-2` with hairline borders (8% and 14% alpha). Tokens live in `src/app/globals.css`.
- **Motion:** short fade-up and fade-in entrances, a shimmer for the "thinking" state, scroll reveals, and an animated hero replay. All respect `prefers-reduced-motion`.

## Demo script (≈10 minutes)

1. Open `/` and let the hero preview cycle through Read → Analyze → Prepare. Then walk through **How it works** (Ask → Reason → Execute tools → Respond).
2. In **Examples**, pick a query and click **Try it in Chainly**. The query arrives pre-filled in the composer.
3. *"What's the ETH balance of 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14?"* (Sepolia WETH). Expand the tool step to show the raw JSON.
4. *"How busy is Ethereum Sepolia right now?"*: gas, base fee and block utilization.
5. Connect MetaMask on Sepolia, then: *"Analyze my wallet's recent activity."*
6. *"Check my balance, then prepare a transaction to send 0.001 ETH to 0x…"*. Review the checks, click **Approve in wallet**, sign, and watch it confirm. Click **Ask agent to verify**.
7. Try to break it: a typo'd address, `"1,5 ETH"`, or *"send from 0xSomeoneElse"*.
8. Code tour: `api/chat/route.ts` → `agent/tools.ts` → `blockchain/transfer.ts` → `signing-guard.ts`.

## Testing

```bash
pnpm test
```

The tests cover:
- validation and error redaction
- explorer parsing (Blockscout and Etherscan V2 for chainid 11155111)
- the wallet analytics math
- transaction preparation
- the signing guard and tx records
- the agent tool loop with a mocked LLM, including a prompt-injected `from` that is ignored

## Troubleshooting

- **"LLM not configured" notice:** set `AI_GATEWAY_API_KEY` (or another provider's key) in `.env.local` and restart.
- **RPC errors:** public endpoints are rate limited; set `SEPOLIA_RPC_URL`.
- **Explorer rate limit:** add a free `ETHERSCAN_API_KEY`.
- **Wrong network:** use the **Switch to Sepolia** button in the header.
