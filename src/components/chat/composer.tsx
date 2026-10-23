"use client";

import { ArrowUp, Square } from "lucide-react";
import { forwardRef, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  placeholder?: string;
  className?: string;
  footer?: React.ReactNode;
};

export const Composer = forwardRef<HTMLTextAreaElement, Props>(function Composer(
  { value, onChange, onSubmit, onStop, busy, placeholder = "Ask anything onchain…", className, footer },
  ref,
) {
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!busy && value.trim()) onSubmit();
  };

  return (
    <form onSubmit={submit} className={cn("w-full", className)}>
      <div className="rounded-2xl border border-border-strong bg-background p-2 shadow-[0_8px_30px_-12px_rgb(0_0_0/0.25)] transition-[border-color,box-shadow] duration-200 focus-within:border-foreground/30 focus-within:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.35)] dark:shadow-[0_8px_30px_-12px_rgb(0_0_0/0.8)]">
        <Textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          rows={1}
          className="max-h-48 min-h-11 px-2.5 py-2 text-[15px]"
          aria-label="Message Chainly"
        />
        <div className="flex items-center gap-2 px-1 pt-1">
          <div className="min-w-0 flex-1 truncate text-xs text-subtle-foreground">{footer}</div>
          <span className="hidden items-center gap-1 text-[11px] text-subtle-foreground sm:flex">
            <Kbd>↵</Kbd> send <Kbd className="ml-1">⇧↵</Kbd> new line
          </span>
          {busy ? (
            <Button type="button" size="icon-sm" variant="secondary" onClick={onStop} aria-label="Stop generating">
              <Square className="size-3 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon-sm" disabled={!value.trim()} aria-label="Send message">
              <ArrowUp />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
});
