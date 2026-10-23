## What does this PR do?

<!-- One or two sentences. Link the issue it closes, e.g. "Closes #12". -->

## Type of change

- [ ] Bug fix
- [ ] New feature (e.g. a new agent tool or UI)
- [ ] Refactor / cleanup
- [ ] Docs
- [ ] Other:

## How was it tested?

<!-- Commands you ran, what you checked in the browser, the prompts you tried. -->

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` pass locally
- [ ] Tried it in the browser (`pnpm dev`) on Ethereum Sepolia
- [ ] Added or updated tests for new logic in `src/lib/`

## Screenshots

<!-- For UI changes: before / after, desktop and mobile. Delete if not relevant. -->

## Safety checklist (if this touches transactions or tools)

- [ ] No new tool can sign or broadcast transactions
- [ ] The sender still comes from the connected wallet, not from LLM input
- [ ] No API keys or RPC URLs are exposed to the browser or in error messages
