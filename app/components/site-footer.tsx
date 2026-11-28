"use client";

import { CoinGeckoAttribution } from "./coingecko-attribution";
import { useT } from "../lib/i18n";

/** Forks: point these at your own repo / handle (or clear FEEDBACK_X to hide the line). */
const REPO_URL = "https://github.com/sachiew/onchain-angpao";
const FEEDBACK_X = { handle: "@sooneggg", url: "https://x.com/sooneggg" };

export function SiteFooter() {
  const t = useT();
  const link = "font-semibold text-foreground underline-offset-2 hover:underline";
  return (
    <footer className="border-t border-border-low">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          🧧 {t.footer.openSourceA}{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={link}>
            GitHub
          </a>
          {t.footer.openSourceB}
        </p>
        {FEEDBACK_X && (
          <p>
            {t.footer.feedback}{" "}
            <a href={FEEDBACK_X.url} target="_blank" rel="noopener noreferrer" className={link}>
              {FEEDBACK_X.handle}
            </a>
          </p>
        )}
        <CoinGeckoAttribution className="text-xs" />
      </div>
    </footer>
  );
}
