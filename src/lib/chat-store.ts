"use client";

import type { ChainlyMessage } from "@/lib/agent/types";

/**
 * Tiny localStorage-backed chat history (no database needed for the MVP).
 * Exposed as an external store for React's useSyncExternalStore.
 */

export type StoredChat = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChainlyMessage[];
};

const STORAGE_KEY = "chainly-chats-v1";
const MAX_CHATS = 40;
const EMPTY: StoredChat[] = [];

let cache: StoredChat[] | null = null;
const listeners = new Set<() => void>();

function load(): StoredChat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredChat[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(chats: StoredChat[]) {
  cache = chats;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  } catch {
    // Quota exceeded or storage disabled — keep the in-memory copy.
  }
  listeners.forEach((l) => l());
}

export function titleFromMessages(messages: ChainlyMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  const text = first?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim() ?? "";
  if (!text) return "New chat";
  return text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text;
}

export const chatStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        cache = load();
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  },
  getSnapshot(): StoredChat[] {
    if (cache === null) cache = load();
    return cache;
  },
  getServerSnapshot(): StoredChat[] {
    return EMPTY;
  },
  get(id: string) {
    return chatStore.getSnapshot().find((c) => c.id === id);
  },
  save(id: string, messages: ChainlyMessage[]) {
    if (messages.length === 0) return;
    const chats = chatStore.getSnapshot();
    const existing = chats.find((c) => c.id === id);
    const now = Date.now();
    const chat: StoredChat = {
      id,
      title: existing?.title && existing.title !== "New chat" ? existing.title : titleFromMessages(messages),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      messages,
    };
    persist([chat, ...chats.filter((c) => c.id !== id)].slice(0, MAX_CHATS));
  },
  remove(id: string) {
    persist(chatStore.getSnapshot().filter((c) => c.id !== id));
  },
};
