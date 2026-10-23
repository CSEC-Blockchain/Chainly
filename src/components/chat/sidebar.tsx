"use client";

import { ArrowUpRight, Droplets, Home, MessageSquare, PanelLeft, SquarePen, Trash2 } from "lucide-react";
import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NetworkIndicator } from "@/components/wallet/network-indicator";
import { EXPLORER_URL, FAUCET_URL } from "@/lib/blockchain/chain";
import type { StoredChat } from "@/lib/chat-store";
import { cn } from "@/lib/utils";

type Props = {
  chats: StoredChat[];
  activeId: string;
  collapsed?: boolean;
  onToggle?: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
};

function IconTip({ label, children, shortcut }: { label: string; children: React.ReactNode; shortcut?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="flex items-center gap-2">
        {label}
        {shortcut && <span className="font-mono text-[10px] opacity-60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ chats, activeId, collapsed = false, onToggle, onNewChat, onSelect, onDelete }: Props) {
  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-1 py-3">
        <IconTip label="Expand sidebar" shortcut="⌘B">
          <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label="Expand sidebar" className="group">
            <LogoMark className="size-4 group-hover:hidden" />
            <PanelLeft className="hidden group-hover:block" />
          </Button>
        </IconTip>
        <IconTip label="New chat" shortcut="⇧⌘O">
          <Button variant="ghost" size="icon-sm" onClick={onNewChat} aria-label="New chat">
            <SquarePen />
          </Button>
        </IconTip>
        <div className="mt-auto flex flex-col items-center gap-1">
          <NetworkIndicator compact />
          <ThemeToggle />
          <IconTip label="Home">
            <Button variant="ghost" size="icon-sm" asChild>
              <Link href="/" aria-label="Home">
                <Home />
              </Link>
            </Button>
          </IconTip>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between pr-2 pl-4">
        <Logo />
        {onToggle && (
          <IconTip label="Collapse sidebar" shortcut="⌘B">
            <Button variant="ghost" size="icon-sm" onClick={onToggle} aria-label="Collapse sidebar">
              <PanelLeft />
            </Button>
          </IconTip>
        )}
      </div>

      <div className="px-2">
        <button
          type="button"
          onClick={onNewChat}
          className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
        >
          <SquarePen className="size-4 text-muted-foreground group-hover:text-foreground" />
          New chat
          <Kbd className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">⇧⌘O</Kbd>
        </button>
      </div>

      <nav className="scrollbar-thin mt-4 min-h-0 flex-1 overflow-y-auto px-2" aria-label="Chat history">
        <div className="px-2.5 pb-1.5 text-[11px] font-medium text-subtle-foreground">Recent</div>
        {chats.length === 0 ? (
          <p className="px-2.5 py-2 text-[13px] leading-relaxed text-subtle-foreground">Your conversations are saved locally in this browser.</p>
        ) : (
          <ul className="space-y-px">
            {chats.map((chat) => {
              const active = chat.id === activeId;
              return (
                <li key={chat.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(chat.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg py-2 pr-8 pl-2.5 text-left text-[13px] transition-colors",
                      active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <MessageSquare className="size-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{chat.title}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(chat.id)}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-md p-1 text-subtle-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                    aria-label={`Delete chat "${chat.title}"`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>

      <div className="space-y-2 border-t p-3">
        <div className="grid grid-cols-2 gap-1">
          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Droplets className="size-3.5" /> Faucet
          </a>
          <a
            href={EXPLORER_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <ArrowUpRight className="size-3.5" /> Etherscan
          </a>
        </div>
        <div className="flex items-center justify-between gap-2">
          <NetworkIndicator className="min-w-0 flex-1 justify-start" />
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
