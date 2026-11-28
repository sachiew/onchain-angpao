"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Envelope } from "./envelope";
import type { Theme } from "../lib/themes";
import { useT } from "../lib/i18n";

export function haptic(ms = 25) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}

/**
 * Closed envelope → tap → flips over to reveal `children` on a themed card.
 * With reduced motion, it cross-fades instead of flipping.
 */
export function OpenEnvelope({
  theme,
  open,
  onOpen,
  closedLabel,
  subLabel,
  message,
  canOpen,
  children,
}: {
  theme: Theme;
  open: boolean;
  onOpen: () => void;
  closedLabel?: string;
  subLabel?: string;
  message?: string;
  canOpen: boolean;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  const t = useT();
  const { from, to, accent, ink } = theme.palette;

  return (
    <div className="relative mx-auto w-72 [perspective:1200px]">
      <AnimatePresence mode="wait" initial={false}>
        {!open ? (
          <motion.div
            key="closed"
            exit={reduce ? { opacity: 0 } : { rotateY: 90, scale: 1.05, opacity: 0.6 }}
            transition={{ duration: 0.35, ease: "easeIn" }}
            className="space-y-5"
          >
            <motion.button
              type="button"
              disabled={!canOpen}
              onClick={() => {
                haptic(30);
                onOpen();
              }}
              whileTap={reduce || !canOpen ? undefined : { scale: 0.96, rotate: -1.5 }}
              whileHover={reduce || !canOpen ? undefined : { scale: 1.02 }}
              className="block w-full cursor-pointer disabled:cursor-default"
              aria-label={t.claim.openAria}
            >
              <Envelope theme={theme} amountLabel={closedLabel} subLabel={subLabel} message={message} float={canOpen} />
            </motion.button>
            {canOpen && (
              <motion.p
                className="text-center text-sm font-bold uppercase tracking-[0.2em]"
                animate={reduce ? undefined : { opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              >
                {t.claim.tapToOpen}
              </motion.p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="open"
            initial={reduce ? { opacity: 0 } : { rotateY: -90, opacity: 0.6 }}
            animate={reduce ? { opacity: 1 } : { rotateY: 0, opacity: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative overflow-hidden rounded-[22px] p-6 shadow-2xl"
            style={{ background: `linear-gradient(160deg, ${from}, ${to})`, color: ink }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-2.5 rounded-2xl border"
              style={{ borderColor: `${accent}88` }}
            />
            <div className="relative">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
