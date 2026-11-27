"use client";

import { use, useState } from "react";
import { toast } from "sonner";
import { address, isAddress, type Address } from "@solana/kit";
import {
  ANGPAO_ERROR__ALREADY_CLAIMED,
  ANGPAO_ERROR__EXPIRED,
  ANGPAO_ERROR__SOLD_OUT,
  GateKind,
  SplitMode,
} from "../../generated/angpao";
import { useAngpao } from "../../lib/hooks/use-angpao";
import { useClaim, useClaimer } from "../../lib/hooks/use-claim";
import { useFiat, usePrices } from "../../lib/hooks/use-prices";
import { useNow } from "../../lib/hooks/use-now";
import { useWallet } from "../../lib/wallet/context";
import { useInstantWallet } from "../../lib/wallet/instant";
import { useCluster } from "../../components/cluster-context";
import { OpenEnvelope } from "../../components/open-envelope";
import { Envelope } from "../../components/envelope";
import { Reveal } from "../../components/reveal";
import { ClaimFeed } from "../../components/claim-feed";
import { CurrencySelect } from "../../components/currency-select";
import { BurnerPanel } from "../../components/burner-panel";
import { CoinGeckoAttribution } from "../../components/coingecko-attribution";
import { getTheme } from "../../lib/themes";
import { angpaoStatus } from "../../lib/angpao";
import { buildFeed, claimOf, countdown } from "../../lib/feed";
import { formatSol, lamportsToSol } from "../../lib/split";
import { fiatCodeFromBytes, formatFiat, fromMinor } from "../../lib/fiat";
import { angpaoErrorCode, parseTransactionError } from "../../lib/errors";
import { ellipsify } from "../../lib/explorer";
import { GaslessError, type ClaimSigner } from "../../lib/gasless";

export default function AngpaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const pda: Address | null = isAddress(id) ? address(id) : null;
  if (!pda) return <Centered>That link doesn’t look right.</Centered>;
  return <ClaimView pda={pda} />;
}

function ClaimView({ pda }: { pda: Address }) {
  const { data, isLoading, mutate } = useAngpao(pda);
  const { connectors, connect, status } = useWallet();
  const instant = useInstantWallet();
  const { active } = useClaimer();
  const { claim, isClaiming, gasless } = useClaim(pda);
  const { getExplorerUrl } = useCluster();
  const { prices } = usePrices();
  const [fiat] = useFiat();
  const now = useNow();
  const [opened, setOpened] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [passphrase, setPassphrase] = useState("");

  if (isLoading && data === undefined) return <Centered>Loading angpao…</Centered>;
  if (!data)
    return (
      <Centered>
        <p className="text-lg font-semibold text-foreground">This angpao is gone 🍃</p>
        <p className="mt-1">It doesn’t exist, or the sender has already closed it.</p>
      </Centered>
    );

  const theme = getTheme(data.theme);
  const me = active?.address;
  const { left, expired, soldOut } = angpaoStatus(data, now);
  const feed = buildFeed(data);
  const mine = claimOf(data, me);
  const solPrice = prices?.solana?.[fiat];
  const toFiat = (l: bigint) => (solPrice ? formatFiat(lamportsToSol(l) * solPrice, fiat) : null);

  const createdFiat = fiatCodeFromBytes(data.fiatCode);
  const createdValue =
    createdFiat && data.fiatTotalMinor > 0n ? formatFiat(fromMinor(data.fiatTotalMinor, createdFiat), createdFiat) : null;
  const headline = createdValue ?? `${formatSol(data.totalLamports)} SOL`;
  const modeLabel = data.mode === SplitMode.Lucky ? "Lucky" : "Equal";
  const claimable = !mine && !soldOut && !expired;
  const showOpen = opened || !!mine;
  const needsPassphrase = data.gateKind === GateKind.Passphrase;
  const inviteOnly = data.gateKind === GateKind.Allowlist;

  /** Wait until the live account shows our claim (the subscription usually beats this). */
  async function awaitClaim(who: Address) {
    for (let i = 0; i < 30; i++) {
      const fresh = await mutate();
      if (fresh && fresh.claims.some((c) => c.claimer === who)) return true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  }

  async function onClaim(claimer: ClaimSigner) {
    if (needsPassphrase && !passphrase.trim()) return toast.error("Enter the passphrase first");
    try {
      await claim(claimer, needsPassphrase ? passphrase : undefined);
      setJustClaimed(true);
      if (!(await awaitClaim(claimer.address))) toast("Submitted! It’s taking a while to confirm, so hang tight.");
    } catch (e) {
      const code = angpaoErrorCode(e);
      const gcode = e instanceof GaslessError ? e.code : undefined;
      if (code === ANGPAO_ERROR__ALREADY_CLAIMED || gcode === "AlreadyClaimed") {
        await mutate();
        toast("You already claimed this one 😉");
      } else if (code === ANGPAO_ERROR__SOLD_OUT || gcode === "SoldOut") {
        await mutate();
        toast.error("So close! The last packet was just taken.");
      } else if (code === ANGPAO_ERROR__EXPIRED || gcode === "Expired") {
        toast.error("This angpao just expired.");
      } else {
        toast.error(e instanceof GaslessError ? e.message : parseTransactionError(e));
      }
    }
  }

  async function onCreateInstant() {
    setCreating(true);
    try {
      const s = await instant.create();
      await onClaim(s);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t create a wallet");
    } finally {
      setCreating(false);
    }
  }

  const primaryBtn =
    "w-full rounded-xl bg-white py-3.5 text-base font-extrabold text-black shadow-lg transition active:scale-[0.98] disabled:opacity-70";

  return (
    <div className="mx-auto max-w-md space-y-8 pt-8">
      {/* Status strip */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold">
          {soldOut ? "Sold out" : expired ? "Expired" : `${left} / ${data.numPackets} left`}
        </span>
        <span className="flex items-center gap-2 text-muted">
          {!soldOut && !expired && <span className="tabular-nums">⏳ {countdown(Number(data.expiryTs) - now)}</span>}
          <CurrencySelect />
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-accent">
        <div
          className="h-full rounded-full bg-[#c8102e] transition-all duration-700"
          style={{ width: `${(data.claimedCount / data.numPackets) * 100}%` }}
        />
      </div>

      {/* Envelope */}
      {claimable || mine ? (
        <OpenEnvelope
          theme={theme}
          open={showOpen}
          onOpen={() => setOpened(true)}
          closedLabel={headline}
          subLabel={`${data.numPackets} packets · ${modeLabel}`}
          message={data.message}
          canOpen={claimable}
        >
          {mine ? (
            <Reveal
              theme={theme}
              primary={toFiat(mine.amount) ?? `${formatSol(mine.amount, 6)} SOL`}
              secondary={toFiat(mine.amount) ? `${formatSol(mine.amount, 6)} SOL · in your wallet` : "in your wallet"}
              celebrate={justClaimed}
              luckiest={mine.luckiest}
            />
          ) : (
            <div className="space-y-4 py-2 text-center">
              <p className="text-lg font-bold leading-snug">{data.message}</p>
              {inviteOnly && <p className="text-xs opacity-85">🔒 Invite-only: only wallets on the sender’s list can claim.</p>}
              {needsPassphrase && (
                <input
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  placeholder="Passphrase from the sender"
                  className="w-full rounded-xl bg-white/90 px-4 py-3 text-center text-sm font-semibold text-black outline-none placeholder:text-black/40"
                />
              )}
              {active ? (
                <div className="space-y-2">
                  <button onClick={() => onClaim(active)} disabled={isClaiming} className={primaryBtn}>
                    {isClaiming ? "Claiming…" : "Claim my packet 🧧"}
                  </button>
                  <p className="text-[11px] opacity-80">
                    into {active.label} {ellipsify(active.address, 4)}
                    {gasless !== false ? " · no gas needed" : ""}
                  </p>
                </div>
              ) : (
                <WalletChoice
                  connectors={connectors}
                  connect={connect}
                  connecting={status === "connecting"}
                  onInstant={onCreateInstant}
                  instantBusy={creating || isClaiming}
                  instantLabel={instant.provider === "privy" ? "Sign in with email or Google" : "No app needed. Takes 1 second"}
                />
              )}
            </div>
          )}
        </OpenEnvelope>
      ) : (
        <div className="space-y-4 text-center">
          <div className="mx-auto w-56 opacity-80 grayscale-[35%]">
            <Envelope theme={theme} amountLabel={headline} subLabel={`${data.numPackets} packets · ${modeLabel}`} float={false} />
          </div>
          <p className="text-lg font-bold">
            {soldOut ? "All packets claimed. Better luck next time!" : "This angpao has expired."}
          </p>
        </div>
      )}

      {mine && active?.kind === "burner" && <BurnerPanel address={active.address} />}

      {/* Value: at creation vs now */}
      <div className="space-y-1 text-center text-xs text-muted">
        <p>
          {formatSol(data.totalLamports)} SOL total
          {createdValue ? ` · ${createdValue} at creation` : ""}
          {toFiat(data.totalLamports) ? ` · ${toFiat(data.totalLamports)} now` : ""}
        </p>
        <CoinGeckoAttribution />
      </div>

      {/* Live feed */}
      <section className="rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border-low px-4 py-3">
          <h2 className="text-sm font-bold">Live claims</h2>
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> live
          </span>
        </header>
        <div className="px-2">
          <ClaimFeed entries={feed} me={me} now={now} fiat={fiat} solPrice={solPrice} />
        </div>
      </section>

      <p className="text-center text-xs">
        <a className="text-muted underline" target="_blank" rel="noopener noreferrer" href={getExplorerUrl(`/address/${pda}`)}>
          View onchain
        </a>
      </p>
    </div>
  );
}

function WalletChoice({
  connectors,
  connect,
  connecting,
  onInstant,
  instantBusy,
  instantLabel,
}: {
  connectors: { id: string; name: string; icon?: string }[];
  connect: (id: string) => Promise<void>;
  connecting: boolean;
  onInstant: () => void;
  instantBusy: boolean;
  instantLabel: string;
}) {
  const here = typeof window !== "undefined" ? window.location.href : "";
  const enc = encodeURIComponent(here);
  const walletBtn =
    "flex w-full items-center gap-3 rounded-xl bg-white/95 px-4 py-3 text-sm font-bold text-black transition active:scale-[0.98] disabled:opacity-60";
  return (
    <div className="space-y-3 text-left">
      <button
        onClick={onInstant}
        disabled={instantBusy}
        className="w-full rounded-xl bg-white py-3.5 text-center text-base font-extrabold text-black shadow-lg transition active:scale-[0.98] disabled:opacity-70"
      >
        {instantBusy ? "Creating wallet & claiming…" : "⚡ Create wallet instantly"}
        <span className="block text-[11px] font-semibold opacity-60">{instantLabel}</span>
      </button>

      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider opacity-70">
        <span className="h-px flex-1 bg-current opacity-30" /> or use your wallet <span className="h-px flex-1 bg-current opacity-30" />
      </div>

      {connectors.length > 0 ? (
        connectors.map((c) => (
          <button key={c.id} disabled={connecting} onClick={() => connect(c.id).catch(() => {})} className={walletBtn}>
            {c.icon && <img src={c.icon} alt="" className="h-6 w-6 rounded" />}
            {c.name}
          </button>
        ))
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <a className={`${walletBtn} justify-center`} href={`https://phantom.app/ul/browse/${enc}?ref=${enc}`}>
            Phantom
          </a>
          <a className={`${walletBtn} justify-center`} href={`https://solflare.com/ul/v1/browse/${enc}?ref=${enc}`}>
            Solflare
          </a>
        </div>
      )}
      <p className="text-center text-[11px] opacity-75">No SOL needed for fees. We cover them.</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="pt-24 text-center text-muted">{children}</div>;
}
