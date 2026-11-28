"use client";

import Link from "next/link";
import { NETWORK } from "../lib/config";
import { SITE_LANGS, useLang, useT } from "../lib/i18n";
import { WalletButton } from "./wallet-button";
import { ThemeToggle } from "./theme-toggle";

/** EN | 中文 switch. On phones it shows only the other language, as one tap target. */
function LangToggle() {
  const [lang, setLang] = useLang();
  const t = useT();
  const other = SITE_LANGS.find((l) => l.key !== lang)!;
  return (
    <>
      <button
        onClick={() => setLang(other.key)}
        aria-label={`${t.nav.language}: ${other.label}`}
        className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-border-low px-2 text-xs font-semibold transition hover:bg-accent sm:hidden"
      >
        {other.label}
      </button>
      <div role="group" aria-label={t.nav.language} className="hidden rounded-lg border border-border-low p-0.5 text-xs font-semibold sm:flex">
        {SITE_LANGS.map((l) => (
          <button
            key={l.key}
            onClick={() => setLang(l.key)}
            aria-pressed={lang === l.key}
            className={`rounded-md px-2 py-1 transition ${lang === l.key ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </>
  );
}

export function SiteHeader() {
  const t = useT();
  const network =
    NETWORK !== "mainnet" ? (
      <span className="rounded-full border border-border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-muted">
        {NETWORK}
      </span>
    ) : null;
  return (
    <>
      {NETWORK === "mainnet" && (
        <div className="bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-black">{t.mainnetWarning}</div>
      )}
      <header className="sticky top-0 z-40 border-b border-border-low bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          {/* Brand lockup: English + Chinese name always shown together */}
          <Link href="/" className="flex min-w-0 items-center gap-2" aria-label={`${t.brand.name} ${t.brand.zh}`}>
            <span aria-hidden className="text-2xl leading-none">
              🧧
            </span>
            <span className="flex flex-col leading-tight">
              <span className="whitespace-nowrap text-[15px] font-bold tracking-tight">{t.brand.name}</span>
              <span className="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-muted" lang="zh">
                {t.brand.zh}
                <span className="sm:hidden">{network}</span>
              </span>
            </span>
          </Link>
          <nav className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link href="/create" className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent sm:block">
              {t.nav.create}
            </Link>
            <Link href="/dashboard" className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent sm:block">
              {t.nav.dashboard}
            </Link>
            <span className="hidden sm:inline">{network}</span>
            <LangToggle />
            <ThemeToggle />
            <WalletButton />
          </nav>
        </div>
      </header>
    </>
  );
}
