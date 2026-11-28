"use client";

import Link from "next/link";
import { Envelope } from "./components/envelope";
import { THEMES } from "./lib/themes";
import { NETWORK } from "./lib/config";
import { useT } from "./lib/i18n";

/** Simple 24×24 stroke icons (original, no icon library). */
const ICONS = {
  packet: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <path d="M5 7.5c2.2 2 4.5 3 7 3s4.8-1 7-3" />
      <circle cx="12" cy="13.5" r="2.2" />
      <path d="M9 18h6" />
    </>
  ),
  share: (
    <>
      <path d="M21.5 2.5 10.5 13.5" />
      <path d="M21.5 2.5 14.5 21.5l-4-8-8-4 19-7Z" />
    </>
  ),
  rush: (
    <>
      <path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2Z" />
    </>
  ),
};

const STEP_ICONS = [ICONS.packet, ICONS.share, ICONS.rush];
const ROADMAP_EMOJI = ["🐐", "💵", "🧑", "📱"];

/** Privy (email/Google wallets) is optional; without it, first-timers get an in-browser wallet. */
const SOCIAL_WALLETS = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export default function Home() {
  const t = useT();
  const steps = t.home.steps.map((s, i) => ({ ...s, n: i + 1, icon: STEP_ICONS[i] }));
  const noWalletPoints = [
    { emoji: "✨", title: t.home.points.walletTitle, body: SOCIAL_WALLETS ? t.home.points.walletSocial : t.home.points.walletBurner },
    { emoji: "⛽", title: t.home.points.feesTitle, body: t.home.points.feesBody },
    { emoji: "📱", title: t.home.points.phoneTitle, body: t.home.points.phoneBody },
  ];
  const roadmap = t.home.roadmap.map((r, i) => ({ ...r, emoji: ROADMAP_EMOJI[i] }));
  return (
    <div className="flex flex-col gap-16 pt-10 sm:pt-16">
      <section className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="inline-flex rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
              {t.home.pill}
            </p>
            {NETWORK !== "mainnet" && (
              <p className="inline-flex items-center gap-1.5 rounded-full border border-[#f6a945]/40 bg-[#f6a945]/10 px-3 py-1 text-xs font-semibold text-[#f6a945]">
                <span aria-hidden>🐐</span> {t.home.mainnetSoon}
              </p>
            )}
          </div>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            {t.home.h1a}
            <br />
            <span className="bg-gradient-to-r from-[#e63946] to-[#f6a945] bg-clip-text text-transparent">
              {t.home.h1b}
            </span>
          </h1>
          <p className="text-xl font-bold tracking-wide text-[#f6a945]" lang="zh">
            {t.home.tagline}
          </p>
          <p className="max-w-md text-lg text-muted">
            {t.home.sub}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/create"
              className="rounded-xl bg-[#c8102e] px-6 py-3 text-base font-bold text-white shadow-lg shadow-red-900/20 transition hover:brightness-110 active:scale-[0.98]"
            >
              {t.home.ctaCreate}
            </Link>
            <Link href="/dashboard" className="rounded-xl border border-border px-6 py-3 text-base font-semibold hover:bg-accent">
              {t.home.ctaMine}
            </Link>
          </div>
        </div>
        <div className="mx-auto w-56 sm:w-72">
          <Envelope theme={THEMES[0]} amountLabel="$88.00" subLabel={`${t.common.packets(8)} · ${t.common.lucky}`} message="Huat ah! 恭喜发财" />
        </div>
      </section>

      <figure className="mx-auto max-w-2xl text-center">
        <span aria-hidden className="block text-3xl leading-none text-[#f6a945]/70">“</span>
        <blockquote className="mt-1 text-xl font-semibold leading-relaxed tracking-tight sm:text-2xl">{t.home.ethos}</blockquote>
        <span aria-hidden className="mt-3 block text-lg">🧧</span>
      </figure>

      <section className="relative overflow-hidden rounded-3xl border border-[#f6a945]/30 bg-gradient-to-br from-[#c8102e]/10 via-transparent to-[#f6a945]/10 p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#e63946]">{t.home.newToCrypto}</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{t.home.noWalletTitle}</h2>
        <p className="mt-2 max-w-xl text-muted">
          {t.home.noWalletSub}
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {noWalletPoints.map((p) => (
            <li key={p.title} className="flex gap-3">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card text-xl shadow-sm">
                {p.emoji}
              </span>
              <div>
                <h3 className="font-bold">{p.title}</h3>
                <p className="text-sm text-muted">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-muted">{t.home.howItWorks}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li
              key={s.n}
              className="group relative rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-900/10 motion-reduce:transform-none"
            >
              <div className="relative mb-4 w-fit">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e63946] to-[#f6a945] text-white shadow-md shadow-red-900/20 transition group-hover:scale-105 motion-reduce:transform-none">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    {s.icon}
                  </svg>
                </div>
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-foreground text-[10px] font-bold text-background">
                  {s.n}
                </span>
              </div>
              <h3 className="font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
              {i < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -right-3.5 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-xs text-muted sm:flex"
                >
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{t.home.whatsNext}</h2>
          <a
            href="https://x.com/sooneggg"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
          >
            {t.home.idea}
          </a>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roadmap.map((r) => (
            <li key={r.title} className="rounded-2xl border border-dashed border-border p-4">
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-lg">
                  {r.emoji}
                </span>
                <h3 className="font-bold">{r.title}</h3>
                <span className="ml-auto rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                  {t.home.soon}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted">{r.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
