"use client";

import { Sparkles } from "lucide-react";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChainlyMessage } from "@/lib/agent/types";
import { ToolInvocation } from "./tool-invocation";

type Props = { message: ChainlyMessage; onAskAgent?: (text: string) => void };

export const Message = memo(function Message({ message, onAskAgent }: Props) {
  if (message.role === "user") {
    const text = message.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
    return (
      <div className="flex justify-end animate-in fade-in-0 slide-in-from-bottom-1">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary/90 px-4 py-2.5 text-[0.95rem] text-primary-foreground shadow-[0_8px_24px_-12px_var(--glow)]">
          {text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 animate-in fade-in-0">
      <AgentAvatar />
      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return part.text ? (
              <div key={i} className="markdown">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}
                >
                  {part.text}
                </ReactMarkdown>
              </div>
            ) : null;
          }
          if (part.type.startsWith("tool-")) {
            return <ToolInvocation key={i} part={part as Parameters<typeof ToolInvocation>[0]["part"]} onAskAgent={onAskAgent} />;
          }
          return null;
        })}
      </div>
    </div>
  );
});

export function AgentAvatar() {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-gradient-to-br from-primary/40 to-primary/5 text-primary shadow-[0_0_20px_-6px_var(--glow)]">
      <Sparkles className="size-4" />
    </div>
  );
}

export function ThinkingIndicator() {
  return (
    <div className="flex gap-3">
      <AgentAvatar />
      <div className="flex items-center gap-1 pt-2.5" aria-label="Agent is thinking">
        {[0, 150, 300].map((d) => (
          <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </div>
  );
}
