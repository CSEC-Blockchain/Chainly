import Link from "next/link";
import { cn } from "@/lib/utils";

/** Chainly mark: two linked blocks — a chain, drawn with one stroke weight. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={cn("size-5", className)}>
      <rect x="3" y="3" width="11" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <rect x="10" y="10" width="11" height="11" rx="3" fill="currentColor" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2 rounded-md text-foreground", className)} aria-label="Chainly home">
      <LogoMark className="transition-transform duration-300 group-hover:rotate-90" />
      <span className="text-[15px] font-semibold tracking-tight">Chainly</span>
    </Link>
  );
}
