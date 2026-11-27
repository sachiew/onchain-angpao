"use client";

import { useState } from "react";
import { toast } from "sonner";
import { isAddress, type Address } from "@solana/kit";
import { exportBurnerSecret, sweepBurner } from "../lib/wallet/burner";
import { useSolanaClient } from "../lib/solana-client-context";
import { useWallet } from "../lib/wallet/context";

/** Backup + sweep for the in-browser burner wallet, with a clear small-amounts warning. */
export function BurnerPanel({ address }: { address: Address }) {
  const client = useSolanaClient();
  const { wallet } = useWallet();
  const [secret, setSecret] = useState<string | null>(null);
  const [dest, setDest] = useState("");
  const [busy, setBusy] = useState(false);

  async function sweep() {
    const to = (dest || wallet?.account.address || "").trim();
    if (!isAddress(to)) return toast.error("Enter a valid Solana address");
    setBusy(true);
    try {
      await sweepBurner(client.rpc, to);
      toast.success("Sent! It’ll show in your wallet in a few seconds.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn’t send");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-amber-400/50 bg-amber-50 p-4 text-left text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
      <p className="font-bold">⚠️ This is an instant wallet saved in this browser</p>
      <p className="text-xs opacity-90">
        It’s for small demo amounts only. Clearing your browser data deletes it. Back up the key, or send the funds to a wallet you
        control.
      </p>
      <p className="break-all font-mono text-[11px] opacity-80">{address}</p>

      {secret ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold">Private key (import it in Phantom/Solflare). Never share it.</p>
          <textarea readOnly value={secret} rows={3} className="w-full rounded-lg border border-amber-400/50 bg-white/70 p-2 font-mono text-[11px] dark:bg-black/30" />
          <button
            onClick={() => navigator.clipboard.writeText(secret).then(() => toast.success("Copied"))}
            className="w-full rounded-lg bg-amber-500 py-2 text-xs font-bold text-black"
          >
            Copy key
          </button>
        </div>
      ) : (
        <button
          onClick={async () => setSecret(await exportBurnerSecret())}
          className="w-full rounded-lg border border-amber-500 py-2 text-xs font-bold"
        >
          Back up key
        </button>
      )}

      <div className="space-y-2">
        <input
          value={dest}
          onChange={(e) => setDest(e.target.value)}
          placeholder={wallet ? `Your wallet: ${wallet.account.address.slice(0, 8)}…` : "Your real wallet address"}
          className="w-full rounded-lg border border-amber-400/50 bg-white/70 px-3 py-2 font-mono text-xs outline-none dark:bg-black/30"
        />
        <button onClick={sweep} disabled={busy} className="w-full rounded-lg bg-amber-500 py-2 text-xs font-bold text-black disabled:opacity-60">
          {busy ? "Sending…" : "Send to my real wallet"}
        </button>
      </div>
    </div>
  );
}
