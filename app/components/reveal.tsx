"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import confetti from "canvas-confetti";
import type { Theme } from "../lib/themes";
import { haptic } from "./open-envelope";
import { useT } from "../lib/i18n";

/** "You got RM 8.88!" with a confetti burst in the theme's colours (skipped for reduced motion). */
export function Reveal({
  theme,
  primary,
  secondary,
  celebrate,
  luckiest,
}: {
  theme: Theme;
  primary: string;
  secondary?: string;
  celebrate: boolean;
  luckiest?: boolean;
}) {
  const reduce = useReducedMotion();
  const t = useT();

  useEffect(() => {
    if (!celebrate) return;
    haptic(60);
    const colors = [theme.palette.accent, theme.palette.seal, "#ffffff", theme.palette.from];
    const opts = { colors, disableForReducedMotion: true, zIndex: 60 };
    confetti({ ...opts, particleCount: 120, spread: 80, origin: { y: 0.45 } });
    const t = setTimeout(
      () => confetti({ ...opts, particleCount: 60, spread: 120, startVelocity: 25, origin: { y: 0.4 } }),
      350,
    );
    return () => clearTimeout(t);
  }, [celebrate, theme]);

  return (
    <div className="space-y-2 py-4 text-center">
      <p className="text-sm font-semibold uppercase tracking-widest opacity-80">{luckiest ? t.claim.luckiest : t.claim.youGot}</p>
      <motion.p
        initial={reduce || !celebrate ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 14 }}
        className="text-5xl font-black tracking-tight tabular-nums"
      >
        {primary}
      </motion.p>
      {secondary && <p className="text-sm font-medium opacity-85">{secondary}</p>}
    </div>
  );
}
