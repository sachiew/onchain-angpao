"use client";

import { use } from "react";
import useSWR from "swr";
import { address, isAddress } from "@solana/kit";
import { fetchMaybeAngpao, SplitMode } from "../../generated/angpao";
import { useSolanaClient } from "../../lib/solana-client-context";
import { Envelope } from "../../components/envelope";
import { getTheme } from "../../lib/themes";
import { angpaoStatus } from "../../lib/angpao";
import { formatSol, lamportsToSol } from "../../lib/split";
import { fiatCodeFromBytes, formatFiat, fromMinor } from "../../lib/fiat";
import { useFiat, usePrices } from "../../lib/hooks/use-prices";
import { useNow } from "../../lib/hooks/use-now";

// M2: read-only view so share links resolve. M3 adds open → claim → reveal + live feed.
export default function AngpaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const client = useSolanaClient();
  const { prices } = usePrices();
  const [fiat] = useFiat();
  const now = useNow();
  const valid = isAddress(id);

  const { data, isLoading } = useSWR(valid ? ["angpao", id] : null, async () => {
    const acc = await fetchMaybeAngpao(client.rpc, address(id));
    return acc.exists ? acc.data : null;
  });

  if (!valid) return <Centered>That link doesn’t look right.</Centered>;
  if (isLoading) return <Centered>Loading…</Centered>;
  if (!data) return <Centered>This angpao doesn’t exist or has been closed.</Centered>;

  const theme = getTheme(data.theme);
  const { left, expired } = angpaoStatus(data, now);
  const createdFiat = fiatCodeFromBytes(data.fiatCode);
  const solPrice = prices?.solana?.[fiat];
  const nowValue = solPrice ? formatFiat(lamportsToSol(data.totalLamports) * solPrice, fiat) : null;
  const createdValue =
    createdFiat && data.fiatTotalMinor > 0n ? formatFiat(fromMinor(data.fiatTotalMinor, createdFiat), createdFiat) : null;

  return (
    <div className="mx-auto max-w-sm space-y-6 pt-10 text-center">
      <div className="mx-auto w-64">
        <Envelope
          theme={theme}
          amountLabel={createdValue ?? `${formatSol(data.totalLamports)} SOL`}
          subLabel={`${data.numPackets} packets · ${data.mode === SplitMode.Lucky ? "Lucky" : "Equal"}`}
          message={data.message}
        />
      </div>
      <p className="text-lg font-bold">
        {expired ? "Expired" : left === 0 ? "All packets claimed. Better luck next time!" : `${left} / ${data.numPackets} left`}
      </p>
      <p className="text-sm text-muted">
        {formatSol(data.totalLamports)} SOL{createdValue ? ` · ${createdValue} at creation` : ""}
        {nowValue ? ` · ${nowValue} now` : ""}
      </p>
      <p className="text-xs text-muted">Claiming arrives in the next milestone.</p>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="pt-24 text-center text-muted">{children}</div>;
}
