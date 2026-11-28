import { CoinGeckoAttribution } from "./coingecko-attribution";

/** Forks: point these at your own repo / handle (or clear FEEDBACK_X to hide the line). */
const REPO_URL = "https://github.com/sachiew/onchain-angpao";
const FEEDBACK_X = { handle: "@sooneggg", url: "https://x.com/sooneggg" };

export function SiteFooter() {
  const link = "font-semibold text-foreground underline-offset-2 hover:underline";
  return (
    <footer className="border-t border-border-low">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          🧧 Open source on{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={link}>
            GitHub
          </a>
          . Fork it, star it, make it yours.
        </p>
        {FEEDBACK_X && (
          <p>
            Feedback or ideas? Find me on X:{" "}
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
