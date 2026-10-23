# Contributing to Chainly

Thanks for helping build Chainly! This guide covers everything you need to go from zero to a merged pull request.

## Setup

You need **Node.js 22+** and **pnpm 10** (`corepack enable` installs the right version automatically).

```bash
git clone https://github.com/CSEC-Blockchain/Chainly.git
cd Chainly
pnpm install
cp .env.example .env.local   # then add AI_GATEWAY_API_KEY
pnpm dev                     # http://localhost:3000
```

The app works without RPC or explorer keys (it uses public Sepolia endpoints), but chat needs an LLM key. By default it uses the Vercel AI Gateway with a free model, so an `AI_GATEWAY_API_KEY` is all you need; other providers are covered in the [README](README.md#quick-start). Get Sepolia test ETH from the [faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) and connect MetaMask on **Ethereum Sepolia**.

> Never commit `.env.local`, API keys, private keys or seed phrases. `.env*` is git-ignored except for `.env.example`.

## Workflow

1. **Pick or open an issue** so others know what you're working on.
2. **Create a branch** from `main`:
   ```bash
   git checkout main && git pull
   git checkout -b feat/token-transfers   # or fix/…, docs/…, refactor/…
   ```
3. **Make your change.** Keep PRs small and focused, since one feature or fix per PR is easier to review.
4. **Run the checks** before pushing (CI runs the same ones):
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
5. **Open a pull request** against `main` and fill in the template. CI must pass and one teammate must approve before merging.
6. **Keep your branch up to date** by merging `main` into it if there are conflicts.

## Commit messages

Write short, imperative messages that say what the commit does:

```
Add getTokenAllowance tool
Fix balance card overflow on mobile
Docs: explain Etherscan API key setup
```

## Where things live

| Folder | What goes there |
|---|---|
| `src/lib/blockchain/` | Framework-free onchain logic (viem reads, explorer client, analytics, transfer preparation). **Add tests for anything here.** |
| `src/lib/agent/` | AI tool definitions (`tools.ts`), system instructions (`prompt.ts`), LLM provider config (`model.ts`) |
| `src/app/api/chat/route.ts` | The agent loop endpoint |
| `src/components/cards/` | Result cards rendered for each tool |
| `src/components/chat/` | Chat workspace (sidebar, messages, composer, tool steps) |
| `src/components/landing/` | Landing page |
| `src/components/ui/` | Shared shadcn/ui-style primitives |
| `tests/` | Vitest unit tests |

## Adding a new agent tool

1. Write the logic as a plain function in `src/lib/blockchain/` that takes the viem client as a parameter and returns plain JSON (convert `bigint`s to strings).
2. Validate inputs with the helpers in `validation.ts` and throw `BlockchainError` with a user-friendly message.
3. Register it in `src/lib/agent/tools.ts` with a clear `description` and a zod `inputSchema`.
4. Add a label in `src/components/chat/tool-invocation.tsx` and, if useful, a result card in `src/components/cards/`.
5. Add tests in `tests/` using the `fakeClient` helper (no network needed).

## Safety rules (non-negotiable)

Chainly handles real wallets, so every PR must keep these guarantees:

- **No tool may sign or broadcast a transaction.** Tools can only read data or *prepare* a preview.
- **The sender always comes from the connected wallet**, never from LLM-provided arguments.
- **Every transaction needs explicit user approval** in the user's own wallet.
- **Secrets stay server-side.** Only `NEXT_PUBLIC_*` variables may reach the browser, and errors must not leak RPC URLs or keys.

If your change touches `transfer.ts`, `signing-guard.ts`, `tx-records.ts` or `tools.ts`, mention it in the PR and add tests.

## Code style

- TypeScript strict mode; avoid `any`.
- Match the surrounding code's naming, comments and structure.
- Use the design tokens in `src/app/globals.css` (`bg-surface`, `text-muted-foreground`, `border-border`, `text-accent`…) instead of hard-coded colors, and check both dark and light themes.
- Make UI work on mobile (≈390px wide) and keyboard-accessible.

## Questions?

Open a [discussion or issue](https://github.com/CSEC-Blockchain/Chainly/issues) or ask in the team channel.
