# M0 Plan: Onchain Angpao

Status: **waiting for OK**. This plan resolves the gaps found in the SPEC review; every place it changes the spec is marked **Δ**.

## 1. Sources read (2026-11-27)

| Source | Result |
|---|---|
| Anchor docs (install, changelog, testing) | Read. Latest stable: **anchor-cli 1.2.2**. The default test template is **LiteSVM (Rust)**. Since 1.0, the TS package is `@anchor-lang/core`. |
| `solana-foundation/templates` → `kit/nextjs-anchor` | Read from GitHub source (solana.com returned 429). Scaffold command: `npx create-solana-dapp@latest -t solana-foundation/templates/kit/nextjs-anchor` |
| CoinGecko docs + TS SDK README | Read. `new Coingecko({ demoAPIKey, environment: 'demo' })`, `client.simple.price.get({ ids, vs_currencies })`. myr/sgd/idr/usd/cny all supported. The Demo plan allows 100 calls/min. |
| Solana Actions spec v2.3 (GitHub) | Read. CORS rules and `actions.json` rules are covered. **A partially signed transaction (another fee payer) is allowed**: the client must not change the fee payer. |
| Kora RPC reference (GitHub) | Read. It offers `signTransaction` / `signAndSendTransaction`, and the TS client is `@solana/kora@0.3.0`. Our relayer interface mirrors these methods. |
| Privy Solana recipe | Read. `@privy-io/react-auth/solana` provides `useWallets` and `useSignTransaction({ transaction: Uint8Array, wallet })`, and it builds transactions with Kit. **Not documented: signing when someone else pays the fee.** I'll test this first in M4. |
| solana.com fee-sponsorship, Kora, Kit pages | **429, not read.** I'll retry them in M2/M4. Kit APIs will be checked against the installed package types instead. |
| Solana Pay transaction request spec | **Not found**: the repo moved and now hosts something else. I'll locate it before M5. |
| Solana MCP / solana-dev-skill / CoinGecko MCP | Not available in this environment. |

## 2. Architecture

```
Browser (Next.js 16 / React 19 / Tailwind 4 / Kit)
 ├─ Sender wallet (wallet-standard) ── signs create_angpao / refund_and_close (sender pays)
 ├─ Claimer: wallet-standard | Privy embedded | burner (localStorage)
 │     └─ signs claim tx ONLY as `claimer` → POST /api/claim/submit
 ├─ Live feed: accountSubscribe(angpao PDA) → decode with Codama → feed
 └─ /api/price (CoinGecko, 60 s cache)

Vercel serverless routes
 ├─ /api/claim/build   → check gate + rate limit → v0 tx, feePayer = relayer, [CU price, CU limit, claim]
 │                        gatekeeper partial-signs here (if gated)
 ├─ /api/claim/submit  → strict verify → relayer signs as fee payer → simulate → send → confirm
 ├─ /api/pay/claim     → Solana Pay tx request (GET label/icon, POST {account})
 ├─ /api/actions/angpao/[id] + /actions.json → Blink
 └─ Relayer interface  { address, signAndSend(tx) }  ← custom now, Kora later

Devnet program `angpao` (Anchor 1.2.2)
```

No database. Angpao state lives onchain. Upstash Redis holds only the rate-limit and budget counters. **Δ Upstash is required in production**: when it isn't set, the relayer refuses to run on Vercel, and in-memory counters are allowed only in `dev`.

## 3. Account layout: `Angpao`

PDA seeds `["angpao", creator, id.to_le_bytes()]`. The account is sized at creation for `N = amounts.len()` and `A = allowlist cap`.

| Field | Type | Bytes | Notes |
|---|---|---|---|
| discriminator | — | 8 | Anchor |
| creator | Pubkey | 32 | |
| id | u64 | 8 | random, client-generated |
| bump | u8 | 1 | |
| mode | u8 | 1 | 0 Equal, 1 Lucky |
| theme | u8 | 1 | 0..7 |
| num_packets | u8 | 1 | = amounts.len(), 1..=50 |
| claimed_count | u8 | 1 | |
| total_lamports | u64 | 8 | **Δ derived** = sum(amounts), not passed in |
| created_ts / expiry_ts | i64 ×2 | 16 | |
| gatekeeper | Option\<Pubkey\> | 33 | |
| gate_kind | u8 | 1 | **Δ** 0 none, 1 passphrase, 2 allowlist |
| gate_hash | [u8; 32] | 32 | **Δ** passphrase: `sha256("angpao-gate" ‖ pda ‖ passphrase)` |
| fiat_code | [u8; 3] | 3 | **Δ** e.g. `myr` |
| fiat_total_minor | u64 | 8 | **Δ** value at creation, e.g. 8800 = RM 88.00 |
| message | String | 4 + 140 | |
| amounts | Vec\<u64\> | 4 + 8N | |
| claims | Vec\<ClaimRecord\> | 4 + 40N | **Δ** `{claimer: Pubkey, ts: i64}`. The amount is `amounts[i]`, so it isn't stored twice |
| allowlist | Vec\<Pubkey\> | 4 + 32A | **Δ** only for gate_kind 2 (see open question 1) |

**Size** = 310 + 48N + 32A bytes. Rent ≈ (128 + size) × 6,960 lamports:

| Case | Bytes | Rent (refunded on close) |
|---|---|---|
| 8 packets | 694 | ≈ 0.0057 SOL |
| 50 packets | 2,710 | ≈ 0.0198 SOL |
| 50 packets + 50 allowlist | 4,310 | ≈ 0.0309 SOL |

## 4. Instructions

1. **`create_angpao(id, mode, theme, message, amounts, expiry_ts, gatekeeper, gate_kind, gate_hash, fiat_code, fiat_total_minor, allowlist_cap)`**
   Checks:
   - `1 ≤ len ≤ 50`; each amount ≥ 1,000,000 (`PacketTooSmall`).
   - Equal mode: every amount except the last is equal, and the last is ≥ the others (`InvalidSplit`).
   - Message ≤ 140 bytes.
   - `now < expiry ≤ now + 7 d`.
   - gate_kind ≥ 1 requires a gatekeeper.

   Then it initialises the PDA (creator pays rent) and transfers the total from the creator to the PDA with a System Program CPI.
2. **`set_allowlist(entries)`** (**Δ**, only if open question 1 = onchain): creator only, before the first claim, appended in chunks of ≤ 25.
3. **`claim()`**. Accounts: `angpao (mut)`, `claimer (mut, signer)`, `gatekeeper (optional signer)`.
   Checks:
   - `now < expiry` (`Expired`)
   - `claimed < N` (`SoldOut`)
   - the claimer hasn't already claimed (`AlreadyClaimed`)
   - the gatekeeper's signature, when one is set (`GatekeeperSignatureMissing`)
   - for an allowlist, the claimer is on it (`Unauthorized`)

   Then it debits the PDA's lamports directly (the program owns it) and credits the claimer, appends the record, increments the count and emits `Claimed { angpao, claimer, index, amount }`. **No account is created, so a 0-SOL claimer works.**
4. **`refund_and_close()`**: creator only, after expiry or once sold out (`NotExpired`). Uses `close = creator`, so all remaining lamports, rent included, go back.
5. **`cancel()`**: creator only, while `claimed_count == 0`, same close.

**Errors:** `SoldOut`, `Expired`, `NotExpired`, `AlreadyClaimed`, `InvalidSplit`, `PacketTooSmall`, `MessageTooLong`, `GatekeeperSignatureMissing`, `Unauthorized`, plus **Δ** `InvalidPacketCount`, `InvalidExpiry`, `GateConfig`.

### Transaction size check (`create_angpao`, N = 50, 140-byte message)

| Part | Bytes |
|---|---|
| 1 signature | 65 |
| Header and versioning | 5 |
| 5 account keys (creator, PDA, system, program, compute budget) | 161 |
| Blockhash | 32 |
| Compute-unit price and limit instructions | 20 |
| `create` instruction (652-byte data) | 659 |
| **Total** | **≈ 943 / 1,232** |

The cap of **50 is safe**, with about 290 bytes to spare (room for about 85 packets). `append_amounts` isn't needed for v1.

## 5. Split algorithms (client side, `app/lib/split.ts`, unit-tested)

- **Equal:** `floor(total / N)` for each packet, and the last packet also gets the remainder.
- **Lucky:** uses `crypto.getRandomValues` on bigint lamports with the double-average method. Each packet is drawn from `[MIN, min(2 × remaining/left, remaining − MIN × (left − 1))]`, the last packet takes what's left, and the result is Fisher–Yates shuffled. The creator controls the randomness; this is documented.

## 6. Relayer (`app/lib/server/relayer/`)

- `interface Relayer { address: Address; signAndSend(tx): Promise<Signature> }`, with a `CustomRelayer` (env key) now and a `KoraRelayer` later.
- **What `submit` verifies before signing:**
  - v0 message with no lookup tables
  - fee payer is the relayer
  - instructions are exactly `[SetComputeUnitPrice ≤ cap, SetComputeUnitLimit ≤ cap, angpao::claim]`
  - the program ID, discriminator and account metas match the expected layout
  - the relayer key appears **only** as fee payer
  - the claimer's signature is valid and the gatekeeper's signature is present when required

  It then simulates, signs, sends and confirms.
- **Limits:** per IP, per angpao and per claimer. Daily spend is capped by `RELAYER_DAILY_BUDGET_SOL` (default 0.1, which covers more than 10k claims).
- **All claims are gasless**, including from connected wallets, so there's one code path.
- **Burner sweep** (**Δ**): the burner pays its own fee and sends *its whole balance minus the fee*. A partial send can leave the account below the rent-exempt minimum and fail, and the relayer isn't involved.

## 7. Package versions

| | Version | Note |
|---|---|---|
| anchor-cli / anchor-lang | 1.2.2 | The template pins 1.1.2; I'll bump it |
| Rust | 1.96 | From the template's `rust-toolchain.toml` |
| Solana CLI | Agave stable (4.x) | |
| litesvm (crate) | Template version, bumped if needed for Anchor 1.2 | |
| @solana/kit | 8.6.0 | The template pins ^6.3; I'll upgrade in M2 and check it compiles |
| codama / @codama/renderers-js / nodes-from-anchor | 1.11.0 / 2.9.1 / 1.5.6 | |
| @solana-program/system, compute-budget | 0.16.0 / 0.20.0 | |
| next / react | 16.4.6 / 19.3.1 | |
| tailwindcss + shadcn/ui | 4.3.5 | |
| motion (Framer Motion) | 14.14.0 | |
| @privy-io/react-auth | 3.52.1 | |
| @solana-mobile/wallet-standard-mobile | 0.7.1 | Android MWA |
| @coingecko/coingecko-typescript | 9.1.0 | |
| @upstash/redis, @upstash/ratelimit | 1.41.1 / 2.2.3 | |
| qrcode.react | 4.2.0 | |
| vitest | latest | App tests |

Wallet layer: **Δ** the official template ships its own small wallet-standard layer (`app/lib/wallet/*`) instead of `@solana/react`. I'll keep the template's layer and add MWA registration. The template uses npm, and I'll **convert it to pnpm**.

## 8. File tree

```
onchain-angpao/
├─ anchor/
│  ├─ Anchor.toml  Cargo.toml  rust-toolchain.toml
│  └─ programs/angpao/src/
│     ├─ lib.rs              # declare_id!, #[program], Solana-for-EVM comments
│     ├─ state.rs            # Angpao, ClaimRecord, Mode/Theme/GateKind, space()
│     ├─ errors.rs  events.rs  constants.rs
│     ├─ instructions/{create_angpao,set_allowlist,claim,refund_and_close,cancel}.rs
│     └─ tests/              # LiteSVM: all §5 cases + 0-SOL claimer + tx-size test
├─ app/
│  ├─ page.tsx  create/  a/[id]/{page,opengraph-image}.tsx  dashboard/
│  ├─ actions.json/route.ts
│  ├─ api/{price, claim/build, claim/submit, pay/claim, actions/angpao/[id]}/route.ts
│  ├─ components/            # envelope, preview-card, share-sheet, claim-feed, wallet-choice, confetti, ui/ (shadcn)
│  ├─ generated/angpao/      # Codama output (don't edit)
│  └─ lib/
│     ├─ split.ts  themes.ts  greetings.ts  fiat.ts  angpao.ts (fetch/decode/subscribe)
│     ├─ wallet/{standard,signer,privy,burner,mwa}.ts
│     └─ server/{relayer/{interface,custom,verify}.ts, ratelimit.ts, gate.ts, coingecko.ts, env.ts}
├─ scripts/{relayer-new,relayer-fund}.ts
├─ tests/                    # vitest: split, verify (malicious-tx cases), gate, fiat
├─ .github/workflows/ci.yml
├─ codama.json  .env.example  README.md  LICENSE  SPEC.md  PLAN.md
```

## 9. Risks to test early

1. **Privy with an outside fee payer.** This is the first M4 task. If it doesn't work, the fallback is Privy's `signMessage` over the message bytes, attached as the claimer's signature.
2. **Wallets accepting a partially signed transaction** (Phantom, Solflare, Backpack) for Solana Pay and Blinks. The Actions spec allows it, so this is about each wallet's behaviour.
3. **Public devnet RPC limits** for `accountSubscribe` during the demo. I'll recommend a free Helius or Triton devnet key and add polling as a fallback.
4. **Blink unfurling on X** needs registry approval. I'll check the current status in M5.

## 10. Open questions for you

1. **Allowlist gate:** (a) **recommended**: store up to 50 pubkeys onchain and have the program enforce it, which needs no gatekeeper and no DB; (b) postpone allowlists and ship only the passphrase gate in v1.
2. **Passphrase strength:** with a hash onchain, a short passphrase can be guessed offline. Is that OK for a demo (with a note in the README)? The alternative needs Upstash to store a secret per angpao.
3. **Toolchain:** Rust, the Solana CLI and Anchor **aren't installed** on this machine. May I install them (rustup, the Anza installer, AVM → Anchor 1.2.2)? That's needed before M1.
4. **Repo:** may I `git init` here, and will you create the GitHub repo, or should I use `gh repo create` (public, MIT) at the end of M1?
5. **Location:** scaffold into this folder (`onchain-angpao/`), keeping SPEC.md and PLAN.md at the root?
