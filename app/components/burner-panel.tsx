"use client";

import { useState } from "react";
import { toast } from "sonner";
import { isAddress, type Address } from "@solana/kit";
import { exportBurnerSecret, sweepBurner } from "../lib/wallet/burner";
import { useSolanaClient } from "../lib/solana-client-context";
import { useWallet } from "../lib/wallet/context";
import { useT } from "../lib/i18n";

/** Backup + sweep for the in-browser burner wallet, with a clear small-amounts warning. */
export function BurnerPanel({ address }: { address: Address }) {
  const t = useT();
  const client = useSolanaClient();
  const { wallet } = useWallet();
  const [secret, setSecret] = useState<string | null>(null);
  const [dest, setDest] = useState("");
  const [busy, setBusy] = useState(false);

  async function sweep() {
    const to = (dest || wallet?.account.address || "").trim();
    if (!isAddress(to)) return toast.error(t.burner.invalid);
    setBusy(true);
    try {
      await sweepBurner(client.rpc, to);
      toast.success(t.burner.sent);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.burner.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-amber-400/50 bg-amber-50 p-4 text-left text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-bold">{t.burner.title}</p>
      <p className="text-xs opacity-90">
        {t.burner.body}
      </p>
      <p className="break-all font-mono text-[11px] opacity-80">{address}</p>

      {secret ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold">{t.burner.keyNote}</p>
          <textarea readOnly value={secret} rows={3} className="w-full rounded-lg border border-amber-400/50 bg-white/70 p-2 font-mono text-[11px] dark:bg-black/30" />
          <button
            onClick={() => navigator.clipboard.writeText(secret).then(() => toast.success(t.burner.copied))}
            className="w-full rounded-lg bg-amber-500 py-2 text-xs font-bold text-black"
          >
            {t.burner.copyKey}
          </button>
        </div>
      ) : (
        <button
          onClick={async () => setSecret(await exportBurnerSecret())}
          className="w-full rounded-lg border border-amber-500 py-2 text-xs font-bold"
        >
          {t.burner.backup}
        </button>
      )}

      <div className="space-y-2">
        <input
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          placeholder={wallet ? t.burner.yourWallet(wallet.account.address.slice(0, 8)) : t.burner.realWallet}
          className="w-full rounded-lg border border-amber-400/50 bg-white/70 px-3 py-2 font-mono text-xs outline-none dark:bg-black/30"
        />
        <button onClick={sweep} disabled={busy} className="w-full rounded-lg bg-amber-500 py-2 text-xs font-bold text-black disabled:opacity-60">
          {busy ? t.burner.sending : t.burner.send}
        </button>
      </div>
    </div>
  );
}
