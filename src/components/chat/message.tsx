"use client";

import { Check, Copy } from "lucide-react";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/use-copy";
import type { ChainlyMessage } from "@/lib/agent/types";
import { ToolInvocation, type ToolPart } from "./tool-invocation";

type Props = { message: ChainlyMessage; streaming?: boolean; onAskAgent?: (text: string) => void };

function textOf(message: ChainlyMessage) {
  return message.parts.map((p) => (p.type === "text" ? p.text : "")).join("\n").trim();
}

export const Message = memo(function Message({ message, streaming, onAskAgent }: Props) {
  if (message.role === "user") {
    return (
      <div className="flex animate-fade-up justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {textOf(message)}
        </div>
      </div>
    );
  }

  const text = textOf(message);

  return (
    <div className="group flex animate-fade-in gap-3.5">
      <AgentAvatar />
      <div className="min-w-0 flex-1 space-y-3">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return part.text ? (
              <div key={i} className="prose-chat">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}>
                  {part.text}
                </ReactMarkdown>
              </div>
            ) : null;
          }
          if (part.type.startsWith("tool-")) {
            return <ToolInvocation key={i} part={part as ToolPart} onAskAgent={onAskAgent} />;
          }
          return null;
        })}
        {!streaming && text && <MessageActions text={text} />}
      </div>
    </div>
  );
});

function MessageActions({ text }: { text: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="-ml-2 flex opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-100">
      <Button variant="ghost" size="xs" onClick={() => copy(text)} aria-label="Copy response">
        {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function AgentAvatar() {
  return (
    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-background">
      <LogoMark className="size-4" />
    </div>
  );
}

export function ThinkingIndicator() {
  return (
    <div className="flex animate-fade-in gap-3.5" role="status" aria-label="Chainly is thinking">
      <AgentAvatar />
      <div className="text-shimmer pt-1 text-[15px]">Thinking…</div>
    </div>
  );
}
