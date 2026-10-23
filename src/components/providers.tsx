"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { WagmiProvider } from "wagmi";
import { TooltipProvider } from "@/components/ui/tooltip";
import { wagmiConfig } from "@/lib/web3/wagmi";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: "!rounded-xl !border-border !bg-background !text-foreground !shadow-xl",
                description: "!text-muted-foreground",
              },
            }}
          />
        </TooltipProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
