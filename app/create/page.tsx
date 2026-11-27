"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";
import useSWR from "swr";
import type { Address } from "@solana/kit";
import { GateKind } from "../generated/angpao";
import { Envelope } from "../components/envelope";
import { ShareSheet } from "../components/share-sheet";
import { useWallet } from "../lib/wallet/context";
import { useSendTransaction } from "../lib/hooks/use-send-transaction";
import { useFiat, usePrices } from "../lib/hooks/use-prices";
import { useCluster } from "../components/cluster-context";
import { parseTransactionError } from "../lib/errors";
import {
  buildCreateAngpaoIx,
  buildSetAllowlistIxs,
  EXPIRY_OPTIONS,
  findAngpaoPda,
  MAX_MESSAGE_BYTES,
  randomId,
} from "../lib/angpao";
import { ALLOWLIST_CHUNK, MAX_ALLOWLIST, MIN_PASSPHRASE, normalizePassphrase, parseAllowlist, passphraseHash } from "../lib/gate";
import { relayerInfo } from "../lib/gasless";
import { addHistory } from "../lib/history";
import {
  equalSplit,
  formatSol,
  lamportsToSol,
  luckySplit,
  MAX_PACKETS,
  solToLamports,
  validateSplitInput,
} from "../lib/split";
import { FIAT_CODES, FIATS, fiatToLamports, formatFiat, toMinor, type FiatCode } from "../lib/fiat";
import { byteLength, getTheme, LANGS, THEMES, type Lang } from "../lib/themes";

type Gate = "open" | "passphrase" | "allowlist";
type Created = {
  angpao: Address;
  signature: string;
  shareText: string;
  passphrase?: string;
  /** Invitees not yet written onchain (a follow-up tx failed or was rejected). */
  pendingAllowlist: Address[];
};

export default function CreatePage() {
  const { signer, status } = useWallet();
  const { send, isSending } = useSendTransaction();
  const { getExplorerUrl } = useCluster();
  const { prices } = usePrices();
  const [fiat, setFiat] = useFiat();

  const [unit, setUnit] = useState<"fiat" | "sol">("fiat");
  const [amount, setAmount] = useState("88");
  const [packets, setPackets] = useState(8);
  const [mode, setMode] = useState<"lucky" | "equal">("lucky");
  const [themeId, setThemeId] = useState(0);
  const [lang, setLang] = useState<Lang>("zh");
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [expiryIdx, setExpiryIdx] = useState(1);
  const [gate, setGate] = useState<Gate>("open");
  const [passphrase, setPassphrase] = useState("");
  const [allowlistText, setAllowlistText] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const { data: server } = useSWR("relayer-info", relayerInfo, { revalidateOnFocus: false });
  const gatekeeper = server?.gatekeeper ?? null;
  const allowlist = useMemo(() => parseAllowlist(allowlistText), [allowlistText]);

  const theme = getTheme(themeId);
  const solPrice = prices?.solana?.[fiat];

  // The preset greeting follows theme/language until the user types their own.
  const messageEdited = customMessage !== null;
  const message = customMessage ?? theme.greetings[lang];

  const amountNum = parseFloat(amount) || 0;
  const lamports = useMemo(() => {
    if (unit === "sol") return solToLamports(amount);
    return solPrice ? fiatToLamports(amountNum, solPrice) : 0n;
  }, [unit, amount, amountNum, solPrice]);
  const fiatValue = unit === "fiat" ? amountNum : solPrice ? lamportsToSol(lamports) * solPrice : 0;

  const msgBytes = byteLength(message);
  const errors = [
    lamports === 0n ? (unit === "fiat" && !solPrice ? "Waiting for price…" : "Enter an amount") : null,
    lamports > 0n ? validateSplitInput(lamports, packets) : null,
    msgBytes > MAX_MESSAGE_BYTES ? `Message is ${msgBytes}/${MAX_MESSAGE_BYTES} bytes` : null,
    gate === "passphrase" && !gatekeeper ? "Passphrase gates need a server gatekeeper key" : null,
    gate === "passphrase" && normalizePassphrase(passphrase).length < MIN_PASSPHRASE
      ? `Passphrase needs at least ${MIN_PASSPHRASE} characters`
      : null,
    gate === "allowlist" && allowlist.invalid.length ? `Not a wallet address: ${allowlist.invalid[0].slice(0, 16)}` : null,
    gate === "allowlist" && allowlist.addresses.length === 0 ? "Add at least one wallet address" : null,
    gate === "allowlist" && allowlist.addresses.length > MAX_ALLOWLIST
      ? `At most ${MAX_ALLOWLIST} wallets (you have ${allowlist.addresses.length})`
      : null,
  ].filter(Boolean) as string[];

  const fiatLabel = fiatValue > 0 ? formatFiat(fiatValue, fiat) : null;
  const solLabel = lamports > 0n ? `${formatSol(lamports)} SOL` : null;

  async function onCreate() {
    if (!signer) return toast.error("Connect a wallet first");
    if (errors.length) return toast.error(errors[0]);
    try {
      const amounts = mode === "lucky" ? luckySplit(lamports, packets) : equalSplit(lamports, packets);
      const id = randomId();
      const expiryTs = BigInt(Math.floor(Date.now() / 1000) + EXPIRY_OPTIONS[expiryIdx].seconds);
      const pda = await findAngpaoPda(signer.address, id);
      const phrase = gate === "passphrase" ? normalizePassphrase(passphrase) : undefined;
      const invitees = gate === "allowlist" ? allowlist.addresses : [];
      const { ix, angpao } = await buildCreateAngpaoIx({
        creator: signer,
        id,
        mode,
        theme: themeId,
        message,
        amounts,
        expiryTs,
        fiat,
        fiatTotalMinor: fiatValue > 0 ? toMinor(fiatValue, fiat) : 0n,
        ...(phrase
          ? { gatekeeper, gateKind: GateKind.Passphrase, gateHash: await passphraseHash(pda, phrase) }
          : invitees.length
            ? { gateKind: GateKind.Allowlist, allowlistCap: invitees.length }
            : {}),
      });
      const signature = await send({ instructions: [ix] });
      const shareText = `${theme.emoji} ${fiatLabel ?? solLabel} · ${packets} packets (${mode === "lucky" ? "Lucky" : "Equal"}). ${message}`;
      addHistory(signer.address, { angpao, createdAt: Date.now(), label: `${theme.emoji} ${fiatLabel ?? solLabel} · ${message}` });
      const pendingAllowlist = await writeAllowlist(angpao, invitees);
      setCreated({ angpao, signature, shareText, passphrase: phrase, pendingAllowlist });
      if (!pendingAllowlist.length) toast.success("Angpao created!");
    } catch (e) {
      toast.error(parseTransactionError(e));
    }
  }

  /** Send set_allowlist chunks in order; returns the invitees that didn't make it onchain. */
  async function writeAllowlist(angpao: Address, invitees: Address[]): Promise<Address[]> {
    if (!signer || !invitees.length) return [];
    const ixs = buildSetAllowlistIxs(signer, angpao, invitees);
    for (let i = 0; i < ixs.length; i++) {
      try {
        await send({ instructions: [ixs[i]] });
      } catch (e) {
        toast.error(`Couldn't save the invite list: ${parseTransactionError(e)}`);
        return invitees.slice(i * ALLOWLIST_CHUNK);
      }
    }
    return [];
  }

  async function retryAllowlist() {
    if (!created) return;
    const pendingAllowlist = await writeAllowlist(created.angpao, created.pendingAllowlist);
    setCreated({ ...created, pendingAllowlist });
    if (!pendingAllowlist.length) toast.success("Invite list saved");
  }

  if (created) {
    const url = `${window.location.origin}/a/${created.angpao}`;
    if (created.pendingAllowlist.length) {
      return (
        <div className="mx-auto max-w-md space-y-4 pt-10 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">One more signature</h1>
          <p className="text-muted">
            Your angpao is funded, but {created.pendingAllowlist.length} invited wallet
            {created.pendingAllowlist.length === 1 ? " isn't" : "s aren't"} on the list yet. Until they are, they
            can&apos;t claim.
          </p>
          <button
            onClick={retryAllowlist}
            disabled={isSending}
            className="w-full rounded-2xl bg-[#c8102e] py-4 text-lg font-bold text-white disabled:opacity-50"
          >
            {isSending ? "Confirm in your wallet…" : "Save invite list"}
          </button>
        </div>
      );
    }
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md space-y-6 pt-10">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">Your angpao is live 🎉</h1>
          <p className="mt-2 text-muted">Share it before the packets run out.</p>
        </div>
        {created.passphrase && (
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Passphrase</p>
            <p className="mt-1 font-mono text-xl font-bold">{created.passphrase}</p>
            <p className="mt-1 text-xs text-muted">Not in the link. Tell your guests separately.</p>
          </div>
        )}
        <ShareSheet
          url={url}
          text={created.shareText}
          angpao={created.angpao}
          passphraseGated={!!created.passphrase}
          explorerUrl={getExplorerUrl(`/tx/${created.signature}`)} />
        <button onClick={() => setCreated(null)} className="w-full text-sm text-muted underline">
          Create another
        </button>
      </motion.div>
    );
  }

  const seg = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${active ? "bg-background shadow-sm" : "text-muted hover:text-foreground"}`;
  const label = "mb-2 block text-xs font-semibold uppercase tracking-wider text-muted";

  return (
    <div className="grid gap-10 pt-8 md:grid-cols-[1fr_320px]">
      <div className="space-y-7">
        <h1 className="text-3xl font-extrabold tracking-tight">Create an angpao</h1>

        {/* Amount */}
        <div>
          <label className={label}>Total amount</label>
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-border bg-card px-4 focus-within:ring-2 focus-within:ring-ring">
              <span className="mr-2 font-semibold text-muted">{unit === "fiat" ? FIATS[fiat].symbol : "◎"}</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className="w-full bg-transparent py-3 text-2xl font-bold tabular-nums outline-none"
                aria-label="Total amount"
              />
            </div>
            <select
              value={unit === "sol" ? "sol" : fiat}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "sol") setUnit("sol");
                else {
                  setUnit("fiat");
                  setFiat(v as FiatCode);
                }
              }}
              className="rounded-xl border border-border bg-card px-3 text-sm font-semibold"
              aria-label="Currency"
            >
              {FIAT_CODES.map((c) => (
                <option key={c} value={c}>
                  {FIATS[c].label}
                </option>
              ))}
              <option value="sol">SOL</option>
            </select>
          </div>
          <p className="mt-2 text-sm text-muted">
            {unit === "fiat"
              ? solLabel
                ? `≈ ${solLabel} at ${solPrice ? formatFiat(solPrice, fiat) : "…"} / SOL`
                : "Fetching SOL price…"
              : fiatLabel
                ? `≈ ${fiatLabel} at creation`
                : ""}
          </p>
        </div>

        {/* Packets + split */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="packets">
              Packets: <span className="text-foreground">{packets}</span>
            </label>
            <input
              id="packets"
              type="range"
              min={1}
              max={MAX_PACKETS}
              value={packets}
              onChange={(e) => setPackets(Number(e.target.value))}
              className="w-full accent-[#c8102e]"
            />
            {lamports > 0n && (
              <p className="mt-1 text-xs text-muted">
                avg {formatSol(lamports / BigInt(packets))} SOL
                {solPrice ? ` · ${formatFiat((lamportsToSol(lamports) * solPrice) / packets, fiat)}` : ""}
              </p>
            )}
          </div>
          <div>
            <label className={label}>Split</label>
            <div className="flex rounded-xl bg-accent p-1">
              <button className={seg(mode === "lucky")} onClick={() => setMode("lucky")}>
                🎲 Lucky
              </button>
              <button className={seg(mode === "equal")} onClick={() => setMode("equal")}>
                ⚖️ Equal
              </button>
            </div>
          </div>
        </div>

        {/* Theme */}
        <div>
          <label className={label}>Theme</label>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setThemeId(t.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-semibold transition ${
                  t.id === themeId ? "border-transparent ring-2 ring-[#c8102e]" : "border-border hover:bg-accent"
                }`}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
                  style={{ background: `linear-gradient(160deg, ${t.palette.from}, ${t.palette.to})` }}
                >
                  {t.emoji}
                </span>
                <span className="line-clamp-1">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={`${label} mb-0`} htmlFor="msg">
              Greeting
            </label>
            <div className="flex gap-1">
              {LANGS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => {
                    setLang(l.key);
                    setCustomMessage(null);
                  }}
                  className={`rounded-md px-2 py-0.5 text-xs font-semibold ${lang === l.key && !messageEdited ? "bg-foreground text-background" : "text-muted hover:bg-accent"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            id="msg"
            rows={2}
            value={message}
            onChange={(e) => {
              setCustomMessage(e.target.value);
            }}
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
          />
          <p className={`mt-1 text-right text-xs ${msgBytes > MAX_MESSAGE_BYTES ? "text-destructive" : "text-muted"}`}>
            {msgBytes}/{MAX_MESSAGE_BYTES} bytes
          </p>
        </div>

        {/* Expiry */}
        <div>
          <label className={label}>Expires in</label>
          <div className="flex rounded-xl bg-accent p-1">
            {EXPIRY_OPTIONS.map((o, i) => (
              <button key={o.label} className={seg(expiryIdx === i)} onClick={() => setExpiryIdx(i)}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Unclaimed packets come back to you after expiry.</p>
        </div>

        {/* Gate */}
        <div>
          <label className={label}>Who can claim</label>
          <div className="flex rounded-xl bg-accent p-1">
            <button className={seg(gate === "open")} onClick={() => setGate("open")}>
              Anyone
            </button>
            <button className={seg(gate === "passphrase")} onClick={() => setGate("passphrase")}>
              🔑 Passphrase
            </button>
            <button className={seg(gate === "allowlist")} onClick={() => setGate("allowlist")}>
              📋 Invite list
            </button>
          </div>
          {gate === "open" && <p className="mt-2 text-xs text-muted">Anyone with the link, first come first served.</p>}
          {gate === "passphrase" && (
            <div className="mt-3 space-y-2">
              <input
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="e.g. huat-ah-2027"
                autoComplete="off"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
                aria-label="Passphrase"
              />
              <p className="text-xs text-muted">
                {gatekeeper
                  ? "Guests type it to claim. It isn't in the link. Use something hard to guess: a hash of it is stored onchain."
                  : "This server has no gatekeeper key, so passphrase gates are unavailable."}
              </p>
            </div>
          )}
          {gate === "allowlist" && (
            <div className="mt-3 space-y-2">
              <textarea
                rows={3}
                value={allowlistText}
                onChange={(e) => setAllowlistText(e.target.value)}
                placeholder="Paste wallet addresses, one per line"
                className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                aria-label="Invited wallets"
              />
              <p className="text-xs text-muted">
                {allowlist.addresses.length}/{MAX_ALLOWLIST} wallets. Enforced onchain. Needs{" "}
                {1 + Math.ceil(Math.max(allowlist.addresses.length, 1) / ALLOWLIST_CHUNK)} wallet signatures.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={onCreate}
          disabled={isSending || status !== "connected" || errors.length > 0}
          className="w-full rounded-2xl bg-[#c8102e] py-4 text-lg font-bold text-white shadow-lg shadow-red-900/20 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
        >
          {status !== "connected"
            ? "Connect a wallet to create"
            : isSending
              ? "Confirm in your wallet…"
              : `Create & fund ${fiatLabel ?? solLabel ?? ""}`}
        </button>
        {errors.length > 0 && status === "connected" && <p className="-mt-4 text-center text-sm text-muted">{errors[0]}</p>}
      </div>

      {/* Live preview: right on desktop, below on mobile (DOM order) */}
      <aside className="md:sticky md:top-20 md:self-start">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted">Preview</p>
        <div className="mx-auto w-64">
          <Envelope
            theme={theme}
            amountLabel={fiatLabel ?? solLabel ?? "—"}
            subLabel={`${packets} packet${packets === 1 ? "" : "s"} · ${mode === "lucky" ? "Lucky" : "Equal"}`}
            message={message}
          />
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          You pay {solLabel ?? "the total"} plus a small refundable deposit (≈{" "}
          {formatSol(BigInt((128 + 311 + 48 * packets + (gate === "allowlist" ? 32 * allowlist.addresses.length : 0)) * 6960))} SOL).
        </p>
      </aside>
    </div>
  );
}
