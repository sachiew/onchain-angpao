"use client";

import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";

export function ShareSheet({
  url,
  text,
  explorerUrl,
}: {
  url: string;
  /** Short invite text, e.g. "🧧 RM 88 · 8 packets. Huat ah!" */
  text: string;
  explorerUrl?: string;
}) {
  const [copied, setCopied] = useState(false);
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
        <QRCodeSVG value={url} size={208} level="M" marginSize={0} />
      </div>
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
      <p className="text-center text-xs text-muted">Blink sharing arrives in a later milestone.</p>
      {explorerUrl && (
        <a className="block text-center text-xs text-muted underline" target="_blank" rel="noopener noreferrer" href={explorerUrl}>
          View transaction on Solana Explorer
        </a>
      )}
    </div>
  );
}
