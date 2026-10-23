import { cookieStorage, createConfig, createStorage, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { CHAIN, DEFAULT_RPC_URLS } from "@/lib/blockchain/chain";

/**
 * Browser wallet config. The wallet (MetaMask, Coinbase Wallet, Rabby, ...)
 * holds the keys and signs — Chainly never sees them.
 */
export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [CHAIN.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || DEFAULT_RPC_URLS[0]),
  },
  // Plain RPC calls (no Multicall3 batching) work on any node, incl. local forks.
  batch: { multicall: false },
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
