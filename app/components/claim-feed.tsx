"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Address } from "@solana/kit";
import { ellipsify } from "../lib/explorer";
import { type FeedEntry } from "../lib/feed";
import { timeAgoT, useT } from "../lib/i18n";
import { formatSol, lamportsToSol } from "../lib/split";
import { formatFiat, type FiatCode } from "../lib/fiat";

/** Stable colour per address for the little avatar dot. */
function hue(addr: string) {
  let h = 0;
  for (let i = 0; i < addr.length; i++) h = (h * 31 + addr.charCodeAt(i)) % 360;
  return h;
}

export function ClaimFeed({
  entries,
  me,
  now,
  fiat,
  solPrice,
}: {
  entries: FeedEntry[];
  me?: Address;
  now: number;
  fiat: FiatCode;
  solPrice?: number;
}) {
  const reduce = useReducedMotion();
  const t = useT();
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted">{t.claim.noClaims}</p>;
  }
  return (
    <ul className="divide-y divide-border-low">
      <AnimatePresence initial={false}>
        {entries.map((e) => (
          <motion.li
            key={e.index}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: -12, backgroundColor: "rgba(246,196,69,0.25)" }}
            animate={{ opacity: 1, y: 0, backgroundColor: "rgba(246,196,69,0)" }}
            transition={{ duration: 0.6 }}
            className="flex items-center gap-3 px-2 py-3"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm"
              style={{ background: `hsl(${hue(e.claimer)} 70% 55%)` }}
            >
              {e.luckiest ? "👑" : "🧧"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate text-sm font-semibold">
                <span className="font-mono">{ellipsify(e.claimer, 4)}</span>
                {e.claimer === me && (
                  <span className="rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">{t.claim.you}</span>
                )}
                {e.luckiest && (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-black">{t.claim.luckiestTag}</span>
                )}
              </p>
              <p className="text-xs text-muted">{timeAgoT(t, e.ts, now)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums">
                {solPrice ? formatFiat(lamportsToSol(e.amount) * solPrice, fiat) : `${formatSol(e.amount)} SOL`}
              </p>
              {solPrice && <p className="text-xs tabular-nums text-muted">{formatSol(e.amount, 6)} SOL</p>}
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
