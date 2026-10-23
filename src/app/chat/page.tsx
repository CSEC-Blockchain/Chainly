import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace } from "@/components/chat/workspace";

export const metadata: Metadata = { title: "Agent" };

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-background" />}>
      <Workspace />
    </Suspense>
  );
}
