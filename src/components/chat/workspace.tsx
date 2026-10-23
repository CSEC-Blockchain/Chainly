"use client";

import { generateId } from "ai";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { chatStore } from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import { ChatView } from "./chat-view";
import { Sidebar } from "./sidebar";

const COLLAPSED_KEY = "chainly-sidebar-collapsed";
const COLLAPSED_EVENT = "chainly:sidebar";

function subscribeCollapsed(cb: () => void) {
  window.addEventListener(COLLAPSED_EVENT, cb);
  return () => window.removeEventListener(COLLAPSED_EVENT, cb);
}

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(COLLAPSED_EVENT));
}

/** The /chat app shell: collapsible history sidebar + the active conversation. */
export function Workspace() {
  const searchParams = useSearchParams();
  const chats = useSyncExternalStore(chatStore.subscribe, chatStore.getSnapshot, chatStore.getServerSnapshot);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const [activeId, setActiveId] = useState(() => generateId());
  const [promptChatId] = useState(activeId);
  const [initialQuery] = useState(() => searchParams.get("q") ?? undefined);

  // Consume ?q= once so it doesn't re-fill the composer later.
  useEffect(() => {
    if (initialQuery) window.history.replaceState(null, "", "/chat");
  }, [initialQuery]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeChat = chats.find((c) => c.id === activeId);

  const newChat = useCallback(() => {
    setActiveId(generateId());
    setMobileOpen(false);
  }, []);

  const select = (id: string) => {
    setActiveId(id);
    setMobileOpen(false);
  };

  const remove = (id: string) => {
    chatStore.remove(id);
    if (id === activeId) newChat();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        writeCollapsed(!readCollapsed());
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        newChat();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat]);

  const sidebarProps = {
    chats,
    activeId,
    onNewChat: newChat,
    onSelect: select,
    onDelete: remove,
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside
        className={cn(
          "hidden shrink-0 border-r bg-surface transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:block",
          collapsed ? "w-14" : "w-64",
        )}
        aria-label="Sidebar"
      >
        <div className={cn("h-full", collapsed ? "w-14" : "w-64")}>
          <Sidebar {...sidebarProps} collapsed={collapsed} onToggle={() => writeCollapsed(!collapsed)} />
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="bg-surface md:hidden">
          <SheetTitle className="sr-only">Chainly sidebar</SheetTitle>
          <Sidebar {...sidebarProps} />
        </SheetContent>
      </Sheet>

      <main className="flex min-w-0 flex-1">
        <ChatView
          key={activeId}
          chatId={activeId}
          title={activeChat?.title ?? "New chat"}
          initialMessages={activeChat?.messages ?? []}
          initialPrompt={!activeChat && activeId === promptChatId ? initialQuery : undefined}
          onOpenSidebar={() => setMobileOpen(true)}
        />
      </main>
    </div>
  );
}
