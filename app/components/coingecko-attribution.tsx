/** Text attribution for price data (CoinGecko API terms ask for "Powered by CoinGecko API"). */
export function CoinGeckoAttribution({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://www.coingecko.com/en/api"
      target="_blank"
      rel="noopener noreferrer"
      className={`text-[11px] text-muted underline-offset-2 hover:underline ${className}`}
    >
      Powered by CoinGecko API
    </a>
  );
}
