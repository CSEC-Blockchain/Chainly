"use client";

import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ChainlyUITools } from "@/lib/agent/tools";
import { cn } from "@/lib/utils";

type Data = ChainlyUITools["analyzeWallet"]["output"];

const W = 600;
const H = 140;

/** Running net ETH flow (received − sent − gas) per day, with a crosshair tooltip. */
export function FlowChart({ series }: { series: Data["flowSeries"] }) {
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();

  const { points, zeroY, min, max } = useMemo(() => {
    const values = series.map((p) => p.cumulativeEth);
    const lo = Math.min(0, ...values);
    const hi = Math.max(0, ...values);
    const pad = (hi - lo || 1) * 0.12;
    const [yMin, yMax] = [lo - pad, hi + pad];
    const y = (v: number) => H - ((v - yMin) / (yMax - yMin)) * H;
    const x = (i: number) => (series.length === 1 ? W / 2 : (i / (series.length - 1)) * W);
    return { points: series.map((p, i) => ({ x: x(i), y: y(p.cumulativeEth) })), zeroY: y(0), min: lo, max: hi };
  }, [series]);

  if (series.length < 2) return null;

  const last = series[series.length - 1];
  const shown = active ?? series.length - 1;
  const point = series[shown];
  const pos = points[shown];

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    setActive(Math.round(ratio * (series.length - 1)));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const step = e.key === "ArrowLeft" ? -1 : 1;
    setActive((i) => Math.min(series.length - 1, Math.max(0, (i ?? series.length - 1) + step)));
  }

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[11px] text-subtle-foreground">
        <span>Net ETH flow, running total</span>
        {/* The readout doubles as the tooltip, so it never covers the line. */}
        <span className="tabular-nums text-foreground" aria-live="polite">
          {active === null ? (
            <>
              {signed(last.cumulativeEth)} ETH <span className="text-subtle-foreground">over {series.length} active days</span>
            </>
          ) : (
            <>
              <span className="font-mono text-subtle-foreground">{point.date}</span> · {signed(point.cumulativeEth)} ETH{" "}
              <span className="text-subtle-foreground">({signed(point.netEth)} that day)</span>
            </>
          )}
        </span>
      </figcaption>

      <div
        className="relative h-36 touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="img"
        aria-label={`Running net ETH flow from ${series[0].date} to ${last.date}, ending at ${signed(last.cumulativeEth)} ETH. Use the arrow keys to read each day.`}
        aria-describedby={tableId}
        tabIndex={0}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
          <line x1={0} x2={W} y1={zeroY} y2={zeroY} className="stroke-border-strong" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            className="stroke-chart-1"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Crosshair and marker are HTML so they don't stretch with the SVG. */}
        <div className={cn("pointer-events-none absolute inset-y-0 w-px bg-border-strong", active === null && "hidden")} style={{ left: `${(pos.x / W) * 100}%` }} />
        <div
          className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-1 ring-2 ring-background"
          style={{ left: `${(pos.x / W) * 100}%`, top: `${(pos.y / H) * 100}%` }}
        />
      </div>

      <div className="flex justify-between font-mono text-[10px] text-subtle-foreground">
        <span>{series[0].date}</span>
        <span>
          range {signed(min)} … {signed(max)} ETH
        </span>
        <span>{last.date}</span>
      </div>

      <details id={tableId} className="text-[11px] text-muted-foreground">
        <summary className="cursor-pointer select-none text-subtle-foreground hover:text-foreground">Show data</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead className="text-subtle-foreground">
            <tr>
              <th className="py-1 text-left font-normal">Day</th>
              <th className="py-1 text-right font-normal">Net</th>
              <th className="py-1 text-right font-normal">Running total</th>
            </tr>
          </thead>
          <tbody>
            {series.map((p) => (
              <tr key={p.date} className="border-t">
                <td className="py-1 font-mono">{p.date}</td>
                <td className="py-1 text-right">{signed(p.netEth)}</td>
                <td className="py-1 text-right text-foreground">{signed(p.cumulativeEth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <p className="text-[10px] text-subtle-foreground">
        Received − sent − gas within the analyzed transactions. Starts at 0, so it is not your balance, and internal contract transfers aren&apos;t included.
      </p>
    </figure>
  );
}

/** Where the gas went: one bar per activity, largest first, values labeled. */
export function GasChart({ breakdown }: { breakdown: Data["gasBreakdown"] }) {
  const [active, setActive] = useState<string | null>(null);
  if (breakdown.length === 0) return null;
  const max = Math.max(...breakdown.map((g) => g.sharePercent), 1);

  return (
    <figure className="space-y-2">
      <figcaption className="text-[11px] text-subtle-foreground">Gas spent by activity</figcaption>
      <ul className="space-y-1.5">
        {breakdown.map((g) => (
          <li
            key={g.label}
            tabIndex={0}
            onPointerEnter={() => setActive(g.label)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(g.label)}
            onBlur={() => setActive(null)}
            aria-label={`${g.label}: ${g.gasEth} ETH, ${g.sharePercent}% of gas, ${g.txCount} transactions`}
            className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 rounded-md py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className={cn("truncate", active === g.label ? "text-foreground" : "text-muted-foreground")} title={g.label}>
              {g.label}
            </span>
            <span className="h-2.5 rounded-full bg-surface-2">
              <span
                className={cn("block h-full rounded-r-[4px] rounded-l-full bg-chart-1 transition-opacity", active && active !== g.label && "opacity-40")}
                style={{ width: `${Math.max(2, (g.sharePercent / max) * 100)}%` }}
              />
            </span>
            <span className="tabular-nums text-foreground">
              {g.gasEth} ETH{" "}
              <span className="text-subtle-foreground">
                · {active === g.label ? `${g.txCount} tx${g.txCount === 1 ? "" : "s"}` : `${Math.round(g.sharePercent)}%`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function signed(n: number) {
  const s = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 6 });
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : "0";
}
