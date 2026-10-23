import { useMemo } from "react";
import { cn } from "@/lib/utils";

/** Deterministic, monochrome 5×5 mirrored identicon derived from an address. */
export function Identicon({ address, className }: { address: string; className?: string }) {
  const cells = useMemo(() => {
    const hex = address.toLowerCase().replace(/^0x/, "");
    const out: boolean[] = [];
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        const nibble = parseInt(hex[(row * 3 + col) % hex.length] ?? "0", 16);
        out.push(nibble % 2 === 0);
      }
    }
    return out;
  }, [address]);

  return (
    <svg viewBox="0 0 5 5" className={cn("size-5 rounded-full bg-surface-2", className)} aria-hidden shapeRendering="crispEdges">
      {cells.map((on, i) => {
        if (!on) return null;
        const row = Math.floor(i / 3);
        const col = i % 3;
        return (
          <g key={i} className="fill-foreground/80">
            <rect x={col} y={row} width="1" height="1" />
            {col < 2 && <rect x={4 - col} y={row} width="1" height="1" />}
          </g>
        );
      })}
    </svg>
  );
}
