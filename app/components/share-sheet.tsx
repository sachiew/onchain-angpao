"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

export function ShareSheet({
  url,
  text,
  angpao,
  passphraseGated = false,
  explorerUrl,
}: {
  url: string;
  /** Short invite text, e.g. "🧧 RM 88 · 8 packets. Huat ah!" */
  text: string;
  angpao: string;
  /** Solana Pay can't ask for a passphrase, so the wallet QR is hidden for those. */
  passphraseGated?: boolean;
  explorerUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState<"link" | "wallet">("link");
  const origin = new URL(url).origin;
  // Solana Pay transaction request: the link inside `solana:` must be URL-encoded (it has a query).
  const payUrl = `solana:${encodeURIComponent(`${origin}/api/pay/claim?angpao=${angpao}`)}`;
  // Blink: the Actions URL behind an interstitial that renders it for anyone (dial.to).
  const blinkUrl = `https://dial.to/?action=${encodeURIComponent(`solana-action:${origin}/api/actions/angpao/${angpao}`)}`;
  const full = `${text}\n${url}`;
  const canNativeShare = typeof navigator !== "undefined" && "share" in navigator;

  const copy = async () => {
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const btn =
    "flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold transition hover:bg-accent active:scale-[0.98]";

  return (
    <div className="space-y-5">
      <div className="mx-auto w-fit rounded-2xl bg-white p-4 shadow-lg">
        <QRCodeSVG value={qr === "wallet" ? payUrl : url} size={208} level="M" marginSize={0} />
      </div>
      {!passphraseGated && (
        <div className="mx-auto -mt-2 flex w-fit rounded-lg bg-accent p-1 text-xs font-semibold">
          {(["link", "wallet"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setQr(k)}
              className={`rounded-md px-3 py-1.5 ${qr === k ? "bg-background shadow-sm" : "text-muted"}`}
            >
              {k === "link" ? "Camera QR" : "Wallet QR (Solana Pay)"}
            </button>
          ))}
        </div>
      )}
      {qr === "wallet" && (
        <p className="-mt-2 text-center text-xs text-muted">
          Scan inside Phantom, Solflare or Backpack to claim straight into that wallet. No gas.
        </p>
      )}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 pl-3">
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{url}</span>
        <button onClick={copy} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a className={btn} target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(full)}`}>
          WhatsApp
        </a>
        <a
          className={btn}
          target="_blank"
          rel="noopener noreferrer"
          href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}
        >
          Telegram
        </a>
        {canNativeShare && (
          <button className={btn} onClick={() => navigator.share({ text, url }).catch(() => {})}>
            More…
          </button>
        )}
        <a className={btn} href={url}>
          Open angpao
        </a>
      </div>
      <a className={`${btn} w-full`} target="_blank" rel="noopener noreferrer" href={blinkUrl}>
        Open as Blink
      </a>
      {explorerUrl && (
        <a className="block text-center text-xs text-muted underline" target="_blank" rel="noopener noreferrer" href={explorerUrl}>
          View transaction on Solana Explorer
        </a>
      )}
    </div>
  );
}
