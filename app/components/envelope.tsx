"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import type { Motif, Theme } from "../lib/themes";

/** Small repeating motif drawn into an SVG pattern (all original, simple geometry). */
function MotifShape({ motif, color }: { motif: Motif; color: string }) {
  switch (motif) {
    case "coins":
      return (
        <g fill="none" stroke={color} strokeWidth="1.5">
          <circle cx="12" cy="12" r="7" />
          <rect x="9" y="9" width="6" height="6" />
        </g>
      );
    case "ketupat":
      return (
        <g fill="none" stroke={color} strokeWidth="1.5">
          <path d="M12 4 L20 12 L12 20 L4 12 Z" />
          <path d="M8 8 L16 16 M16 8 L8 16" />
        </g>
      );
    case "diya":
      return (
        <g fill={color}>
          <path d="M5 14 Q12 22 19 14 Z" />
          <path d="M12 5 Q15 9 12 12 Q9 9 12 5 Z" />
        </g>
      );
    case "star":
      return (
        <path
          fill={color}
          d="M12 4 L14 10 L20 10 L15 14 L17 20 L12 16 L7 20 L9 14 L4 10 L10 10 Z"
        />
      );
    case "confetti":
      return (
        <g fill={color}>
          <rect x="5" y="6" width="3" height="6" transform="rotate(25 6 9)" />
          <circle cx="17" cy="8" r="2" />
          <rect x="13" y="15" width="6" height="3" transform="rotate(-20 16 16)" />
        </g>
      );
    case "rings":
      return (
        <g fill="none" stroke={color} strokeWidth="1.5">
          <circle cx="9" cy="13" r="5" />
          <circle cx="15" cy="13" r="5" />
        </g>
      );
    case "cap":
      return (
        <g fill={color}>
          <path d="M12 6 L21 10 L12 14 L3 10 Z" />
          <path d="M7 12 L7 16 Q12 19 17 16 L17 12 L12 14 Z" />
        </g>
      );
    default:
      return <circle cx="12" cy="12" r="2" fill={color} />;
  }
}

export function Envelope({
  theme,
  message,
  amountLabel,
  subLabel,
  className = "",
  float = true,
}: {
  theme: Theme;
  message?: string;
  amountLabel?: string;
  subLabel?: string;
  className?: string;
  float?: boolean;
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/:/g, "");
  const { from, to, accent, ink, seal } = theme.palette;

  return (
    <motion.div
      className={`relative aspect-[5/7] w-full select-none ${className}`}
      animate={float && !reduce ? { y: [0, -6, 0], rotate: [0, -0.6, 0] } : undefined}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg viewBox="0 0 250 350" className="h-full w-full drop-shadow-2xl" role="img" aria-label={`${theme.name} envelope`}>
        <defs>
          <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
          <pattern id={`p${uid}`} width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
            <g opacity="0.16">
              <MotifShape motif={theme.motif} color={accent} />
            </g>
          </pattern>
        </defs>
        <rect x="0" y="0" width="250" height="350" rx="22" fill={`url(#g${uid})`} />
        <rect x="0" y="0" width="250" height="350" rx="22" fill={`url(#p${uid})`} />
        {/* inner border */}
        <rect x="10" y="10" width="230" height="330" rx="16" fill="none" stroke={accent} strokeOpacity="0.55" strokeWidth="1.5" />
        {/* flap */}
        <path d="M0 22 Q0 0 22 0 L228 0 Q250 0 250 22 L250 70 L125 150 L0 70 Z" fill={to} opacity="0.55" />
        <path d="M0 70 L125 150 L250 70" fill="none" stroke={accent} strokeOpacity="0.7" strokeWidth="1.5" />
        {/* seal */}
        <circle cx="125" cy="150" r="30" fill={seal} />
        <circle cx="125" cy="150" r="24" fill="none" stroke={to} strokeOpacity="0.5" strokeWidth="1.5" />
        <text x="125" y="161" textAnchor="middle" fontSize="28">
          {theme.emoji}
        </text>
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[50%] flex flex-col items-center justify-center gap-1 px-6 text-center" style={{ color: ink }}>
        {amountLabel && <div className="text-2xl font-extrabold tracking-tight drop-shadow sm:text-3xl">{amountLabel}</div>}
        {subLabel && <div className="text-xs font-semibold uppercase tracking-widest opacity-80">{subLabel}</div>}
        {message && <p className="mt-2 line-clamp-3 text-sm leading-snug opacity-95">{message}</p>}
      </div>
    </motion.div>
  );
}
