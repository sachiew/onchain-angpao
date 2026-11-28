"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { GateKind, getCancelInstruction, getRefundAndCloseInstruction, SplitMode } from "../generated/angpao";
import { PROGRAM_ADDRESS } from "../lib/config";
import { useWallet } from "../lib/wallet/context";
import { useSendTransaction } from "../lib/hooks/use-send-transaction";
import { useMyAngpaos, type MyAngpao } from "../lib/hooks/use-my-angpaos";
import { useFiat, usePrices } from "../lib/hooks/use-prices";
import { useNow } from "../lib/hooks/use-now";
import { useCluster } from "../components/cluster-context";
import { CurrencySelect } from "../components/currency-select";
import { ShareSheet } from "../components/share-sheet";
import { angpaoStatus } from "../lib/angpao";
import { countdownT, useLang, useT } from "../lib/i18n";
import { formatFiat, fiatCodeFromBytes, fromMinor } from "../lib/fiat";
import { formatSol, lamportsToSol } from "../lib/split";
import { getTheme } from "../lib/themes";
import { parseTransactionError } from "../lib/errors";
import { readHistory, type HistoryEntry } from "../lib/history";

export default function DashboardPage() {
  const { signer, status } = useWallet();
  const creator = signer?.address;
  const { data, error, isLoading, mutate } = useMyAngpaos(creator);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [fiat] = useFiat();
  const t = useT();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is client-only
    setHistory(creator ? readHistory(creator) : []);
  }, [creator, data]);

  if (status !== "connected" || !creator) {
    return (
      <div className="mx-auto max-w-md pt-16 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight">{t.dash.title}</h1>
        <p className="mt-3 text-muted">{t.dash.connect}</p>
      </div>
    );
  }

  const open = new Set(data?.map((a) => a.address));
  const closed = data ? history.filter((h) => !open.has(h.angpao)) : [];

  return (
    <div className="space-y-6 pt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">{t.dash.title}</h1>
        <div className="flex items-center gap-2">
          <CurrencySelect />
          <Link href="/create" className="rounded-xl bg-[#c8102e] px-4 py-2 text-sm font-bold text-white">
            {t.dash.new}
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{t.dash.loadError}</p>}
      {isLoading && <p className="text-muted">{t.dash.loading}</p>}
      {data && data.length === 0 && closed.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted">
          {t.dash.empty}{" "}
          <Link href="/create" className="font-semibold text-foreground underline">
            {t.dash.createOne}
          </Link>
        </div>
      )}

      <div className="grid gap-3">
        {data?.map((a) => (
          <Row key={a.address} a={a} fiat={fiat} onDone={() => mutate()} />
        ))}
      </div>

      {closed.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{t.dash.closed}</h2>
          <div className="grid gap-2">
            {closed.map((h) => (
              <div key={h.angpao} className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm text-muted">
                <span className="truncate">{h.label}</span>
                <span className="shrink-0 pl-3">{t.dash.refunded}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ a, fiat, onDone }: { a: MyAngpao; fiat: ReturnType<typeof useFiat>[0]; onDone: () => void }) {
  const { signer } = useWallet();
  const { send, isSending } = useSendTransaction();
  const { getExplorerUrl } = useCluster();
  const { prices } = usePrices();
  const now = useNow();
  const t = useT();
  const [lang] = useLang();
  const d = a.data;
  const theme = getTheme(d.theme);
  const { left, expired, soldOut, claimedLamports } = angpaoStatus(d, now);
  const price = prices?.solana?.[fiat];
  const fiatNow = (l: bigint) => (price ? formatFiat(lamportsToSol(l) * price, fiat) : null);
  const createdCode = fiatCodeFromBytes(d.fiatCode);
  const atCreation =
    createdCode && d.fiatTotalMinor > 0n ? formatFiat(fromMinor(d.fiatTotalMinor, createdCode), createdCode) : null;

  // What comes back on close: unclaimed packets + the rent deposit (all the account's lamports).
  const canRefund = expired || soldOut;
  const canCancel = !canRefund && d.claimedCount === 0;
  // Sharing makes sense while packets are still claimable.
  const canShare = !expired && !soldOut;
  const [sharing, setSharing] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/a/${a.address}` : `/a/${a.address}`;
  const shareText = t.create.shareText(
    theme.emoji,
    atCreation ?? `${formatSol(d.totalLamports)} SOL`,
    d.numPackets,
    d.mode === SplitMode.Lucky ? t.common.lucky : t.common.equal,
    d.message,
  );

  async function close(kind: "refund" | "cancel") {
    if (!signer) return;
    if (kind === "cancel" && !confirm(t.dash.cancelConfirm)) return;
    try {
      const ix =
        kind === "refund"
          ? getRefundAndCloseInstruction({ creator: signer, angpao: a.address }, { programAddress: PROGRAM_ADDRESS })
          : getCancelInstruction({ creator: signer, angpao: a.address }, { programAddress: PROGRAM_ADDRESS });
      await send({ instructions: [ix] });
      toast.success(t.dash.returned(formatSol(a.lamports)));
      onDone();
    } catch (e) {
      toast.error(parseTransactionError(e));
    }
  }

  const pct = (d.claimedCount / d.numPackets) * 100;

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ background: `linear-gradient(160deg, ${theme.palette.from}, ${theme.palette.to})` }}
          aria-hidden
        >
          {theme.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <Link href={`/a/${a.address}`} className="line-clamp-1 font-semibold hover:underline">
            {d.message || t.themes[d.theme] || theme.name}
          </Link>
          <p className="text-xs text-muted">
            {atCreation ?? `${formatSol(d.totalLamports)} SOL`}
            {atCreation && fiatNow(d.totalLamports) && createdCode === fiat ? t.dash.atCreationNow(fiatNow(d.totalLamports)!) : ""}
            {" · "}
            {d.mode === SplitMode.Lucky ? t.common.lucky : t.common.equal}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            soldOut ? "bg-emerald-500/15 text-emerald-600" : expired ? "bg-amber-500/15 text-amber-600" : "bg-accent text-muted"
          }`}
        >
          {soldOut ? t.dash.soldOut : expired ? t.dash.expired : countdownT(t, Number(d.expiryTs) - now, lang)}
        </span>
      </div>

      <div className="mt-3">
        <div className="flex justify-between text-sm">
          <span className="font-semibold tabular-nums">
            {t.dash.claimed(d.claimedCount, d.numPackets)}
          </span>
          <span className="text-muted tabular-nums">
            {formatSol(claimedLamports)} SOL{fiatNow(claimedLamports) ? ` · ${fiatNow(claimedLamports)}` : ""}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-accent">
          <div className="h-full rounded-full bg-[#c8102e] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canShare && (
          <button
            onClick={() => setSharing((v) => !v)}
            aria-expanded={sharing}
            className="rounded-lg bg-[#c8102e] px-3 py-2 text-xs font-bold text-white transition hover:brightness-110"
          >
            {sharing ? t.dash.hideShare : `📤 ${t.dash.share}`}
          </button>
        )}
        {canRefund && (
          <button
            onClick={() => close("refund")}
            disabled={isSending}
            className="rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background disabled:opacity-50"
          >
            {isSending ? t.dash.confirming : t.dash.refund(formatSol(a.lamports))}
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => close("cancel")}
            disabled={isSending}
            className="rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {t.dash.cancel}
          </button>
        )}
        {!canRefund && left > 0 && <span className="text-xs text-muted">{t.dash.refundAtExpiry}</span>}
        <a
          href={getExplorerUrl(`/address/${a.address}`)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-muted underline"
        >
          {t.wallet.explorer}
        </a>
      </div>

      {canShare && sharing && (
        <div className="mt-4 border-t border-border-low pt-4">
          <ShareSheet url={url} text={shareText} angpao={a.address} passphraseGated={d.gateKind === GateKind.Passphrase} />
        </div>
      )}
    </div>
  );
}

