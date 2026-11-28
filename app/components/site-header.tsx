"use client";

import Link from "next/link";
import { NETWORK } from "../lib/config";
import { WalletButton } from "./wallet-button";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <>
      {NETWORK === "mainnet" && (
        <div className="bg-amber-500 px-4 py-2 text-center text-xs font-semibold text-black">
          ⚠️ Mainnet: real money. Use small amounts only and check your local rules.
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-border-low bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span aria-hidden className="text-xl">🧧</span>
            <span className="whitespace-nowrap">
              <span className="hidden min-[440px]:inline">Onchain </span>Angpao
              <span className="ml-1.5 hidden text-sm font-semibold text-muted sm:inline">链上红包</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/create" className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent sm:block">
              Create
            </Link>
            <Link href="/dashboard" className="hidden rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent sm:block">
              Dashboard
            </Link>
            {NETWORK !== "mainnet" && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                {NETWORK}
              </span>
            )}
            <ThemeToggle />
            <WalletButton />
          </nav>
        </div>
      </header>
    </>
  );
}
