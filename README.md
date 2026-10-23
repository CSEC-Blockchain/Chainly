# Chainly: an AI blockchain agent

Chainly is a conversational AI agent for **Base Sepolia**. You can ask it questions in plain English. It reads **live onchain data**, analyzes wallet activity, and **prepares** transactions. Every transaction still has to be approved by you in your own wallet.

> Built for the **CSEC-ASTU Blockchain Team, Blockchain × AI session**.

![stack](https://img.shields.io/badge/Next.js-16-black) ![stack](https://img.shields.io/badge/AI_SDK-7-blue) ![stack](https://img.shields.io/badge/viem%20%2B%20wagmi-Base%20Sepolia-0052FF)

## Features

| | |
|---|---|
| 💬 **Conversational agent** | ChatGPT-style UI with streaming answers. Each tool call shows a live indicator and a rich result card. |
| 🔎 **Onchain reader** | ETH balances, ERC-20 balances (USDC/EURC/WETH by symbol, or any contract), transaction details and status, gas prices, block info. |
| 📊 **Wallet analyzer** | Explorer history in and out, volumes, net flow, gas spent, counterparties, contract usage, a daily activity chart, plus insights backed by the data. |
| ✍️ **Transaction assistant** | Validates the address, amount, balance and network, estimates gas, and shows a preview card. **You** sign in your wallet. |
| 🛡️ **Safety by design** | The LLM has no tool that signs or broadcasts. The sender comes from the connected wallet, never from the LLM. The browser re-validates every request before opening the wallet. No private keys are ever handled. |

## Quick start

```bash
pnpm install
cp .env.example .env.local   # add ONE LLM key (see below)
pnpm dev                     # http://localhost:3000
```

Minimum `.env.local`:

```bash
OPENAI_API_KEY=sk-...        # or ANTHROPIC_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY
```

For a free option, use Groq (or a local Ollama) through the OpenAI-compatible provider:

```bash
LLM_PROVIDER=openai-compatible
OPENAI_COMPATIBLE_BASE_URL=https://api.groq.com/openai/v1
OPENAI_COMPATIBLE_API_KEY=gsk_...
LLM_MODEL=llama-3.3-70b-versatile
```

Pick a model that supports **tool calling**. The RPC and the explorer work without keys: Chainly uses the public Base Sepolia RPC and Blockscout. Get testnet ETH from the [Base faucets](https://docs.base.org/base-chain/tools/network-faucets).

### Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build && pnpm start` | Production build and run |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Next route types + `tsc --noEmit` |
| `pnpm test` | Vitest unit tests (81 tests) |

## Architecture

```
 Browser (React, wagmi)                         Server (Next.js route handler)
┌───────────────────────────────┐   POST      ┌──────────────────────────────────────┐
│ useChat ── messages + wallet ─┼────────────▶│ /api/chat                            │
│                               │             │  streamText(model, instructions,     │
│ Tool cards ◀── UI stream ─────┼◀────────────┤             tools, stopWhen=8 steps) │
│                               │  SSE        │        │            ▲                │
│ TransactionPreviewCard        │             │        ▼            │ JSON results   │
│  └ signing-guard (re-check)   │             │  lib/agent/tools.ts (7 typed tools)  │
│  └ wallet.sendTransaction ◀── user click    │        │                             │
└──────────────┬────────────────┘             │        ▼                             │
               │ signs with user's keys       │  lib/blockchain/*  (pure, reusable)  │
               ▼                              │   reader · activity · transfer       │
         Base Sepolia  ◀──────── viem RPC ────┤   explorer (Blockscout / Etherscan)  │
                                              └──────────────────────────────────────┘
```

### Folder map

```
src/
├─ app/
│  ├─ api/chat/route.ts       ← the agent loop (LLM ⇄ tools, streamed to UI)
│  ├─ api/status/route.ts     ← non-secret config for the header badge
│  └─ page.tsx / layout.tsx
├─ lib/
│  ├─ agent/
│  │  ├─ model.ts             ← configurable LLM provider (OpenAI/Anthropic/Google/compatible)
│  │  ├─ tools.ts             ← AI tool definitions (zod schemas → blockchain functions)
│  │  ├─ prompt.ts            ← system instructions + safety rules
│  │  └─ types.ts             ← typed UI messages (tool-<name> parts)
│  ├─ blockchain/             ← framework-free, unit-tested
│  │  ├─ client.ts            ← viem client with RPC fallback (server-only)
│  │  ├─ reader.ts            ← balances, tokens, tx, network, blocks
│  │  ├─ explorer.ts          ← Etherscan-compatible history API
│  │  ├─ activity.ts          ← pure wallet analytics + insights
│  │  ├─ transfer.ts          ← prepare (never send) ETH transfers
│  │  ├─ signing-guard.ts     ← client-side last-line validation
│  │  ├─ validation.ts        ← address / amount / hash parsing
│  │  └─ errors.ts            ← safe, friendly errors (no URLs/keys leaked)
│  └─ web3/wagmi.ts           ← browser wallet config (injected wallets)
└─ components/
   ├─ dashboard.tsx           ← layout, chat state, composer
   ├─ chat/                   ← messages + tool execution indicators
   ├─ cards/                  ← result cards per tool (+ transaction preview)
   ├─ wallet/                 ← connect button, wallet overview panel
   └─ ui/                     ← shadcn/ui-style primitives
```

### The agent tools

| Tool | Input | Source | Returns |
|---|---|---|---|
| `getEthBalance` | `address?` (defaults to connected wallet) | RPC | balance, EOA/contract, block |
| `getTokenBalance` | `address?`, `token` (symbol or contract) | RPC (`erc20Abi`) | balance with decimals, token metadata |
| `getTransaction` | `hash` | RPC tx + receipt + block | status, value, fee, gas, confirmations |
| `getNetworkStatus` | none | RPC | latest block, gas price, base/priority fee, utilization |
| `getBlock` | `blockNumber?` | RPC | block stats |
| `analyzeWallet` | `address?`, `limit` | Blockscout / Etherscan V2 | stats, counterparties, daily chart, insights |
| `prepareTransaction` | `to`, `amountEth` | RPC (fees, balance, estimateGas, getCode) | a **preview** with checks, `readyToSign` |

Each tool is a thin `tool({ description, inputSchema, execute })` wrapper around a plain function in `lib/blockchain`. **The LLM decides _when_ to call a tool. The code decides _what actually happens_.**

### Transaction safety model (worth explaining on stage)

1. **No capability:** the LLM's toolbox has nothing that signs or broadcasts, and the server holds no keys.
2. **No spoofing:** the sender is taken from the connected wallet (captured in a closure when the tools are created). It is not a tool argument, so a prompt injection cannot change who pays. This is unit-tested.
3. **Validated intent:** checksummed addresses, a zero-address block, decimal and locale checks (`"1,5"` is rejected, not guessed), a 10 ETH demo ceiling, a balance check covering amount plus max gas, and a contract-recipient warning.
4. **Human in the loop:** the preview card shows every number and check. Only a click on **Approve & sign** opens the wallet.
5. **Defense in depth:** `signing-guard.ts` re-validates the preview in the browser before calling the wallet: chain ID, sender = connected account, amount and gas bounds, and a 10-minute expiry.
6. **No leaks:** viem error messages can include RPC URLs, which may contain API keys. Chainly maps all errors to clean messages, and keys stay in server env vars.

## Demo script (≈10 minutes)

1. **The idea (1 min):** "LLMs can't read the chain. Tools fix that." Show the toolbox panel on the right.
2. **Read data:** *"What's the ETH balance of 0x4200000000000000000000000000000000000006?"* Open the tool indicator to show the raw JSON input and output, then point out that the answer comes from live data.
3. **Network:** *"How busy is Base Sepolia right now? Show gas prices and the latest block."*
4. **Transaction lookup:** paste any tx hash from [BaseScan Sepolia](https://sepolia.basescan.org).
5. **Connect a wallet** (MetaMask on Base Sepolia), then: *"Analyze my wallet's recent activity and spending patterns."* Walk through the stats, chart and insights tabs.
6. **The safety moment:** *"Check my balance, then prepare a transaction to send 0.001 ETH to 0x…"*. The agent prepares, the card shows the checks, you click **Approve & sign**, MetaMask pops up, and the card goes from submitted to confirmed. Click **Ask agent to verify** to close the loop.
7. **Try to break it:** *"Send 0.001 ETH from 0xSomeoneElse…"*. The sender stays your wallet. Also try *"Send 1,5 ETH"* or a typo'd address and watch the validation errors.
8. **Code tour:** `app/api/chat/route.ts` → `lib/agent/tools.ts` → `lib/blockchain/transfer.ts` → `signing-guard.ts`.

## Testing

```bash
pnpm test
```

The tests cover address, hash and amount validation, error redaction (an RPC API key never reaches messages), explorer parsing (empty results, rate limits, bad keys), the wallet analytics math, transaction preparation (ready path, insufficient funds, no wallet, contract recipient, invalid intent, RPC outage), the signing guard, and the agent tool loop with a mocked LLM. That last group includes a test where the LLM tries to inject a different `from`.

## Troubleshooting

- **"LLM not configured" badge:** set a key in `.env.local` and restart.
- **"RPC endpoint is unavailable":** the public RPC is rate limited; set `BASE_SEPOLIA_RPC_URL`.
- **Explorer rate limit:** add a free `ETHERSCAN_API_KEY`.
- **Wrong network:** the header shows **Switch to Base Sepolia**.
