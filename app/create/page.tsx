"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { motion } from "motion/react";
import useSWR from "swr";
import { createNoopSigner, type Address } from "@solana/kit";
import { GateKind } from "../generated/angpao";
import { Envelope } from "../components/envelope";
import { ShareSheet } from "../components/share-sheet";
import { useWallet } from "../lib/wallet/context";
import { useSendTransaction } from "../lib/hooks/use-send-transaction";
import { useFiat, usePrices } from "../lib/hooks/use-prices";
import { useCluster } from "../components/cluster-context";
import { parseTransactionError } from "../lib/errors";
import {
  approvalsNeeded,
  buildCreateAngpaoIx,
  buildSetAllowlistIxs,
  planCreateTransactions,
  EXPIRY_OPTIONS,
  findAngpaoPda,
  MAX_MESSAGE_BYTES,
  randomId,
} from "../lib/angpao";
import { ALLOWLIST_CHUNK, MAX_ALLOWLIST, MIN_PASSPHRASE, normalizePassphrase, parseAllowlist, passphraseHash } from "../lib/gate";
import { relayerInfo } from "../lib/gasless";
import { addHistory } from "../lib/history";
import { useLang, useT } from "../lib/i18n";
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

/** Wall-clock time for event handlers (kept out of render for the React compiler). */
const nowMs = () => Date.now();

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
  const t = useT();
  const [siteLang] = useLang();
  // Greeting language: follows the site language until the sender picks one.
  const [greetLang, setLang] = useState<Lang | null>(null);
  const lang: Lang = greetLang ?? (siteLang === "zh" ? "zh" : "en");
  const [customMessage, setCustomMessage] = useState<string | null>(null);
  const [expiryIdx, setExpiryIdx] = useState(1);
  const [gate, setGate] = useState<Gate>("open");
  const [passphrase, setPassphrase] = useState("");
  const [allowlistText, setAllowlistText] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const { data: server } = useSWR("relayer-info", relayerInfo, { revalidateOnFocus: false });
  const gatekeeper = server?.gatekeeper ?? null;
  const allowlist = useMemo(() => parseAllowlist(allowlistText), [allowlistText]);
  const [approvals, setApprovals] = useState(1);

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
    lamports === 0n ? (unit === "fiat" && !solPrice ? t.create.err.waitingPrice : t.create.err.enterAmount) : null,
    lamports > 0n && validateSplitInput(lamports, packets)
      ? packets < 1 || packets > MAX_PACKETS
        ? t.create.err.packetRange(MAX_PACKETS)
        : t.create.err.packetMin(String(packets / 1000))
      : null,
    msgBytes > MAX_MESSAGE_BYTES ? t.create.err.messageBytes(msgBytes, MAX_MESSAGE_BYTES) : null,
    gate === "passphrase" && !gatekeeper ? t.create.err.noGatekeeper : null,
    gate === "passphrase" && normalizePassphrase(passphrase).length < MIN_PASSPHRASE ? t.create.err.passShort(MIN_PASSPHRASE) : null,
    gate === "allowlist" && allowlist.invalid.length ? t.create.err.badAddress(allowlist.invalid[0].slice(0, 16)) : null,
    gate === "allowlist" && allowlist.addresses.length === 0 ? t.create.err.listEmpty : null,
    gate === "allowlist" && allowlist.addresses.length > MAX_ALLOWLIST
      ? t.create.err.listTooLong(MAX_ALLOWLIST, allowlist.addresses.length)
      : null,
  ].filter(Boolean) as string[];

  // How many wallet approvals the invite list needs (only the tx shape matters, so a
  // placeholder signer works before a wallet is connected).
  const inviteCount = allowlist.addresses.length;
  useEffect(() => {
    if (gate !== "allowlist" || inviteCount === 0) return;
    let live = true;
    (async () => {
      const who = createNoopSigner(signer?.address ?? ("11111111111111111111111111111111" as Address));
      const { ix, angpao } = await buildCreateAngpaoIx({
        creator: who,
        id: 0n,
        mode,
        theme: themeId,
        message,
        amounts: Array.from({ length: packets }, () => 1_000_000n),
        expiryTs: 0n,
        fiat,
        fiatTotalMinor: 0n,
        gateKind: GateKind.Allowlist,
        allowlistCap: inviteCount,
      });
      const plan = planCreateTransactions(who, angpao, ix, allowlist.addresses);
      if (live) setApprovals(approvalsNeeded(plan));
    })().catch(() => {});
    return () => {
      live = false;
    };
  }, [gate, inviteCount, allowlist.addresses, packets, message, mode, themeId, fiat, signer?.address]);

  const fiatLabel = fiatValue > 0 ? formatFiat(fiatValue, fiat) : null;
  const solLabel = lamports > 0n ? `${formatSol(lamports)} SOL` : null;

  async function onCreate() {
    if (!signer) return toast.error(t.create.err.connectFirst);
    if (errors.length) return toast.error(errors[0]);
    try {
      const amounts = mode === "lucky" ? luckySplit(lamports, packets) : equalSplit(lamports, packets);
      const id = randomId();
      const expiryTs = BigInt(Math.floor(nowMs() / 1000) + EXPIRY_OPTIONS[expiryIdx].seconds);
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
      // Pack as much of the invite list as fits into the create tx (usually all of it).
      const plan = planCreateTransactions(signer, angpao, ix, invitees);
      const signature = await send({ instructions: plan.first });
      const shareText = t.create.shareText(theme.emoji, fiatLabel ?? solLabel ?? "", packets, mode === "lucky" ? t.common.lucky : t.common.equal, message);
      addHistory(signer.address, { angpao, createdAt: nowMs(), label: `${theme.emoji} ${fiatLabel ?? solLabel} · ${message}` });
      const pendingAllowlist = await writeAllowlist(angpao, plan.rest);
      setCreated({ angpao, signature, shareText, passphrase: phrase, pendingAllowlist });
      if (!pendingAllowlist.length) toast.success(t.create.toastCreated);
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
        toast.error(t.create.toastListFailed(parseTransactionError(e)));
        return invitees.slice(i * ALLOWLIST_CHUNK);
      }
    }
    return [];
  }

  async function retryAllowlist() {
    if (!created) return;
    const pendingAllowlist = await writeAllowlist(created.angpao, created.pendingAllowlist);
    setCreated({ ...created, pendingAllowlist });
    if (!pendingAllowlist.length) toast.success(t.create.toastListSaved);
  }

  if (created) {
    const url = `${window.location.origin}/a/${created.angpao}`;
    if (created.pendingAllowlist.length) {
      return (
        <div className="mx-auto max-w-md space-y-4 pt-10 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">{t.create.oneMore}</h1>
          <p className="text-muted">{t.create.oneMoreBody(created.pendingAllowlist.length)}</p>
          <button
            onClick={retryAllowlist}
            disabled={isSending}
            className="w-full rounded-2xl bg-[#c8102e] py-4 text-lg font-bold text-white disabled:opacity-50"
          >
            {isSending ? t.common.confirmInWallet : t.create.saveList}
          </button>
        </div>
      );
    }
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md space-y-6 pt-10">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">{t.create.liveTitle}</h1>
          <p className="mt-2 text-muted">{t.create.liveSub}</p>
        </div>
        {created.passphrase && (
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t.create.passphrase}</p>
            <p className="mt-1 font-mono text-xl font-bold">{created.passphrase}</p>
            <p className="mt-1 text-xs text-muted">{t.create.passTell}</p>
          </div>
        )}
        <ShareSheet
          url={url}
          text={created.shareText}
          angpao={created.angpao}
          passphraseGated={!!created.passphrase}
          explorerUrl={getExplorerUrl(`/tx/${created.signature}`)} />
        <button onClick={() => setCreated(null)} className="w-full text-sm text-muted underline">
          {t.create.createAnother}
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
        <h1 className="text-3xl font-extrabold tracking-tight">{t.create.title}</h1>

        {/* Amount */}
        <div>
          <label className={label}>{t.create.totalAmount}</label>
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 items-center rounded-xl border border-border bg-card px-4 focus-within:ring-2 focus-within:ring-ring">
              <span className="mr-2 font-semibold text-muted">{unit === "fiat" ? FIATS[fiat].symbol : "◎"}</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className="w-full bg-transparent py-3 text-2xl font-bold tabular-nums outline-none"
                aria-label={t.create.totalAmount}
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
              aria-label={t.create.currency}
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
                ? t.create.atPrice(solLabel, solPrice ? formatFiat(solPrice, fiat) : "…")
                : t.create.fetchingPrice
              : fiatLabel
                ? t.create.atCreation(fiatLabel)
                : ""}
          </p>
        </div>

        {/* Packets + split */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="packets">
              {t.create.packets}: <span className="text-foreground">{packets}</span>
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
                {t.create.avg} {formatSol(lamports / BigInt(packets))} SOL
                {solPrice ? ` · ${formatFiat((lamportsToSol(lamports) * solPrice) / packets, fiat)}` : ""}
              </p>
            )}
          </div>
          <div>
            <label className={label}>{t.create.split}</label>
            <div className="flex rounded-xl bg-accent p-1">
              <button className={seg(mode === "lucky")} onClick={() => setMode("lucky")}>
                🎲 {t.common.lucky}
              </button>
              <button className={seg(mode === "equal")} onClick={() => setMode("equal")}>
                ⚖️ {t.common.equal}
              </button>
            </div>
          </div>
        </div>

        {/* Theme */}
        <div>
          <label className={label}>{t.create.theme}</label>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map((th) => (
              <button
                key={th.id}
                onClick={() => setThemeId(th.id)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-[11px] font-semibold transition ${
                  th.id === themeId ? "border-transparent ring-2 ring-[#c8102e]" : "border-border hover:bg-accent"
                }`}
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
                  style={{ background: `linear-gradient(160deg, ${th.palette.from}, ${th.palette.to})` }}
                >
                  {th.emoji}
                </span>
                <span className="line-clamp-1">{t.themes[th.id] ?? th.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={`${label} mb-0`} htmlFor="msg">
              {t.create.greeting}
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
            {msgBytes}/{MAX_MESSAGE_BYTES} {t.create.bytes}
          </p>
        </div>

        {/* Expiry */}
        <div>
          <label className={label}>{t.create.expiresIn}</label>
          <div className="flex rounded-xl bg-accent p-1">
            {EXPIRY_OPTIONS.map((o, i) => (
              <button key={o.label} className={seg(expiryIdx === i)} onClick={() => setExpiryIdx(i)}>
                {t.expiry[i] ?? o.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">{t.create.expiryNote}</p>
        </div>

        {/* Gate */}
        <div>
          <label className={label}>{t.create.whoCanClaim}</label>
          <div className="flex rounded-xl bg-accent p-1">
            <button className={seg(gate === "open")} onClick={() => setGate("open")}>
              {t.create.gateOpen}
            </button>
            <button className={seg(gate === "passphrase")} onClick={() => setGate("passphrase")}>
              {t.create.gatePass}
            </button>
            <button className={seg(gate === "allowlist")} onClick={() => setGate("allowlist")}>
              {t.create.gateList}
            </button>
          </div>
          {gate === "open" && <p className="mt-2 text-xs text-muted">{t.create.openNote}</p>}
          {gate === "passphrase" && (
            <div className="mt-3 space-y-2">
              <input
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder={t.create.passPlaceholder}
                autoComplete="off"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-ring"
                aria-label={t.create.passphrase}
              />
              <p className="text-xs text-muted">
                {gatekeeper
                  ? t.create.passNote
                  : t.create.passUnavailable}
              </p>
            </div>
          )}
          {gate === "allowlist" && (
            <div className="mt-3 space-y-2">
              <textarea
                rows={3}
                value={allowlistText}
                onChange={(e) => setAllowlistText(e.target.value)}
                placeholder={t.create.listPlaceholder}
                className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 font-mono text-xs outline-none focus:ring-2 focus:ring-ring"
                aria-label={t.create.listInvited}
              />
              <p className="text-xs text-muted">
                {t.create.listCount(inviteCount, MAX_ALLOWLIST)}
                {inviteCount > 0 && (approvals === 1 ? t.create.listOnce : t.create.listMany(approvals))}
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
            ? t.create.connectToCreate
            : isSending
              ? t.common.confirmInWallet
              : t.create.createFund(fiatLabel ?? solLabel ?? "")}
        </button>
        {errors.length > 0 && status === "connected" && <p className="-mt-4 text-center text-sm text-muted">{errors[0]}</p>}
      </div>

      {/* Live preview: right on desktop, below on mobile (DOM order) */}
      <aside className="md:sticky md:top-20 md:self-start">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted">{t.create.preview}</p>
        <div className="mx-auto w-64">
          <Envelope
            theme={theme}
            amountLabel={fiatLabel ?? solLabel ?? "—"}
            subLabel={`${t.common.packets(packets)} · ${mode === "lucky" ? t.common.lucky : t.common.equal}`}
            message={message}
          />
        </div>
        <p className="mt-4 text-center text-xs text-muted">
          {t.create.youPay(
            solLabel ?? t.create.theTotal,
            formatSol(BigInt((128 + 311 + 48 * packets + (gate === "allowlist" ? 32 * allowlist.addresses.length : 0)) * 6960)),
          )}
        </p>
      </aside>
    </div>
  );
}
