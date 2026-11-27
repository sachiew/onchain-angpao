# Build: Onchain Angpao on Solana

> Paste this whole file into Claude Code in an empty folder, or save it as `SPEC.md` in the repo root and tell Claude Code: "Read SPEC.md and follow it."

## 1. Context

I'm a product lead at CoinGecko, building this as a personal **build-in-public** project. The goals are:

- A delightful **demo** I can screen-record and post on X. The timing target is Chinese New Year in early February, then Hari Raya.
- A **public GitHub repo** deployed on **Vercel**, which others can fork, run and take to production if they want.

I come from EVM (I've done testnet dapp tutorials) but I'm **new to Solana**. Explain Solana-specific concepts briefly in code comments and in the README (accounts vs contract storage, PDAs, rent, fee payers, token accounts, IDLs/Codama). Where it helps, compare them to the EVM equivalent.

**Inspiration:** the angpao (red packet) feature in Malaysian e-wallets. A sender sets a total and a number of packets, chooses random or equal split, and adds a greeting; friends rush to open them.
**Use an original design only.** No Touch 'n Go (or any other brand's) names, logos, colors or visual identity.

## 2. What we're building

1. A sender creates an angpao:
   - Total amount, in SOL (devnet by default).
   - Number of packets.
   - Split: **Lucky** (random) or **Equal**.
   - A greeting theme and a personal message.
   - An expiry.
2. The sender shares a **link / QR code / Blink**.
3. Recipients open a themed envelope and claim **straight into a Solana wallet**. They can either **connect an existing wallet** or **create one instantly**, and the claim is **gasless**, so a brand-new wallet with 0 SOL works.
4. Everyone sees a **live claim feed**: who got how much, and who's the luckiest.
5. After expiry, unclaimed funds return to the sender.
6. Values are shown in **MYR** (selectable local currency) using CoinGecko prices.

## 3. Before writing any code

1. **Read the current docs.** Don't rely on memory:
   - Anchor: https://www.anchor-lang.com/docs
   - Next.js + Anchor template: https://solana.com/developers/templates/nextjs-anchor
   - Next.js + Kit wallet integration: https://solana.com/docs/frontend/nextjs-solana
   - Fee sponsorship: https://solana.com/docs/payments/send-payments/payment-processing/fee-abstraction and https://solana.com/developers/cookbook/transactions/fee-sponsorship
   - Kora (Solana Foundation gasless relayer), as an optional upgrade: https://solana.com/docs/tools/kora
   - Privy + Solana: https://docs.privy.io/recipes/solana/getting-started-with-privy-and-solana, plus the template https://solana.com/developers/templates/sample-react-kit-privy
   - The Solana Pay transaction request spec, and the Solana Actions/Blinks docs (find their current official pages)
   - CoinGecko API: https://docs.coingecko.com/llms.txt and the TS SDK `@coingecko/coingecko-typescript`
2. If the Solana MCP server, the `solana-dev-skill`, or the CoinGecko MCP or Agent SKILL are available here, use them.
3. **Write a short plan first:** architecture, file tree, account layout with byte sizes, instruction list, package versions, open questions. **Stop and wait for my OK.**
4. Scaffold from the official **nextjs-anchor** template via `create-solana-dapp`, which provides Next.js, Tailwind, `@solana/kit`, wallet-standard, an Anchor program and a Codama-generated client. Confirm the exact template path on the templates page.

## 4. Sender settings

| Setting | Rules |
|---|---|
| Total amount | Enter in SOL, or in MYR (converted to SOL at the CoinGecko rate, shown as "≈ RM 88.00 at creation") |
| Packets | 1–50. Default 8. The cap comes from Solana's 1,232-byte transaction limit, because Lucky amounts are passed in the create instruction; see §5 |
| Split | **Lucky**: random amounts. **Equal**: the same amount each, with any remainder going to the last packet |
| Minimum per packet | ≥ 0.001 SOL (see the gotcha in §5) |
| Theme | Chinese New Year, Hari Raya, Deepavali, Christmas, Birthday, Wedding, Graduation, Custom. Each has its own palette, envelope art and default greeting |
| Greeting presets | EN / BM / 中文, e.g. "Gong Xi Fa Cai! 恭喜发财", "Selamat Hari Raya, Maaf Zahir dan Batin", "Happy Deepavali", editable |
| Message | ≤ 140 bytes, stored onchain |
| Expiry | 1 h / 24 h (default) / 3 days |
| Gate (optional) | None, a passphrase, or an allowlist of wallets, enforced through a gatekeeper co-signature (§5) |

## 5. Anchor program `angpao`

**State (one account per angpao, PDA seeds `["angpao", creator, id_u64_le]`):**
- `creator: Pubkey`, `id: u64`, `bump: u8`
- `mode: u8` (Equal | Lucky), `theme: u8`, `message: String` (max 140 bytes)
- `total_lamports: u64`, `num_packets: u8`, `claimed_count: u8`
- `amounts: Vec<u64>`, length `num_packets`, the precomputed packet amounts
- `claims: Vec<ClaimRecord { claimer: Pubkey, amount: u64, ts: i64 }>`, max `num_packets`
- `created_ts: i64`, `expiry_ts: i64`
- `gatekeeper: Option<Pubkey>`: if set, every claim must be co-signed by this key

**Transaction size:** Solana transactions max out at 1,232 bytes. `create_angpao` carries `amounts` (8 bytes per packet) plus the message, so compute the largest `num_packets` that fits alongside a priority-fee instruction, and enforce it in both the program and the UI. 50 should be safe. If I later want up to 100 packets, add an `append_amounts` instruction that loads amounts in chunks before the angpao opens for claims.

**Why the claims are stored inline:** keeping the claim records inside the angpao account (≤ 50 entries) means a claim **never creates a new account**. So a 0-SOL wallet can claim as long as a relayer pays the fee. The creator pays the account's rent once and gets it back on close. Size the account at creation for `num_packets`.

**Funds:** in v1, hold the SOL in the angpao PDA's own lamports. The program owns the account, so it can debit lamports directly on claim and credit the claimer. Keep the account rent-exempt at all times.

**Instructions:**
1. `create_angpao(id, mode, theme, message, num_packets, amounts, expiry_ts, gatekeeper)`:
   - Validate: `amounts.len() == num_packets`, `sum(amounts) == total`, each amount ≥ `MIN_PACKET_LAMPORTS` (1_000_000 = 0.001 SOL), message length, expiry in the future and ≤ 7 days.
   - Then transfer the total from the creator into the PDA.
2. `claim()`:
   - Require: not expired, `claimed_count < num_packets`, claimer not already in `claims`, and the gatekeeper's signature if one is set.
   - Pay `amounts[claimed_count]` to the claimer, append a `ClaimRecord`, increment the count, and emit a `Claimed` event.
3. `refund_and_close()`:
   - Creator only, after expiry *or* once all packets are claimed.
   - Return the remaining lamports, including rent, to the creator and close the account.
4. Optional: `cancel()`, creator only, allowed only while `claimed_count == 0`.

**Errors:** `SoldOut`, `Expired`, `NotExpired`, `AlreadyClaimed`, `InvalidSplit`, `PacketTooSmall`, `MessageTooLong`, `GatekeeperSignatureMissing`, `Unauthorized`.

**Lucky split:**
- Compute on the client with `crypto.getRandomValues`, using the "double-average" method: each packet is random in `[min, 2 × remaining_average]`, and the last packet takes the remainder.
- Shuffle the result, then pass `amounts` to `create_angpao`, where the program validates it.
- The creator controls the randomness, which is fine: it's their gift. Document this.

**Rent gotcha (important):**
- A brand-new wallet with 0 lamports can only *receive* SOL if the result is at least rent-exempt, about 0.00089 SOL for an empty account. That's why the per-packet minimum is 0.001 SOL.
- Add a test that a claim into a fresh 0-SOL keypair succeeds.

**Tests** (Anchor tests with LiteSVM or the local validator, whichever the template uses), covering:
- Equal and Lucky create, with sum validation
- Successful claims
- Double-claim rejected
- Sold out (the 11th claimer on a 10-packet angpao)
- Expiry blocks claims
- Refund after expiry returns the remainder and closes the account
- Gatekeeper required when set
- A packet that's too small is rejected
- A claim into a 0-SOL account

## 6. Gasless relayer (fee payer)

- `POST /api/claim/build { angpao, claimer }`:
  - The server builds a versioned transaction with **fee payer = relayer** and a single `claim` instruction.
  - It adds the gatekeeper co-sign if the angpao is gated, after checking the passphrase, allowlist or rate limit.
  - It returns the base64 transaction for the claimer to sign.
- `POST /api/claim/submit { signedTx }`:
  - The server **verifies** the transaction before co-signing: exactly the expected instruction(s), the right program ID and accounts, and the relayer used only as fee payer.
  - Then it signs as fee payer, sends and confirms.
  - **Never sign arbitrary transactions with the relayer key.**
- Rate-limit per IP and per angpao (Upstash Redis if `UPSTASH_*` env vars are set, otherwise in-memory). Set a daily SOL budget cap for the relayer.
- Keep the relayer interface small, so it can later be swapped for **Kora**. Document this in the README.

## 7. Wallet options on the claim page

1. **Connect a wallet:** wallet-standard via `@solana/react` (Phantom, Solflare, Backpack), plus Mobile Wallet Adapter on Android.
2. **Create one instantly:**
   - **Privy embedded wallet** (email or Google login) when `NEXT_PUBLIC_PRIVY_APP_ID` is set. The free tier is enough for a demo.
   - Otherwise fall back to an **instant burner wallet**: a keypair generated in the browser and stored in localStorage, with "Back up key" and "Send to my real wallet" (sweep) buttons. Show a clear warning that a burner is for small demo amounts only.
3. **Mobile QR:** a Solana Pay *transaction request* URL (`solana:https://<host>/api/pay/claim?angpao=<pda>`). The wallet GETs the label and icon, then POSTs its account, and the server returns the claim transaction, partially signed by the relayer as fee payer.
4. **Blink:**
   - `actions.json` at the root, plus `/api/actions/angpao/[id]`: GET returns the title, themed image and Claim button; POST returns the transaction.
   - Test with a Blink inspector. X unfurling may require registration in the Actions registry; check the current docs and note it in the README.

## 8. CoinGecko integration

- Server-side `/api/price`: `simple/price` for `solana` (and `usd-coin`, for the future USDC mode) against the selected currencies (`myr` default; also `sgd`, `idr`, `usd`, `cny`). Cache for 60 s.
- Support `COINGECKO_PRO_API_KEY` or `COINGECKO_DEMO_API_KEY`, with SDK `environment: 'pro' | 'demo'` (check the README for exact option names). **It must work with a free Demo key.**
- Show local-currency values everywhere: the create form, envelopes ("You got RM 8.88!"), the claim feed and the dashboard. Also show "value at creation vs now", since SOL moves.

## 9. Pages and UX (the moments the video needs)

| Route | Contents |
|---|---|
| `/` | Hero with an animated envelope, a three-step "how it works", "Create angpao" |
| `/create` | The form from §4, plus a live preview card on the right (desktop) or below (mobile). After signing: a share sheet with link, QR, Blink and copy-for-WhatsApp/Telegram |
| `/a/[id]` | The claim page: themed envelope → tap to open (animation) → wallet choice → gasless claim → amount reveal with confetti and local-currency value. Below: a **live claim feed** (RPC `accountSubscribe` on the angpao PDA), remaining packets "3 / 8 left", an expiry countdown, a **"Luckiest" crown** on the top packet once sold out, and a sold-out state: "All packets claimed. Better luck next time!" |
| `/dashboard` | The creator's angpaos: claimed n/N, total claimed, time left, Refund & close (when allowed), explorer links |

- **Open Graph images** per angpao (Next.js `opengraph-image`), with the theme, greeting and "RM 88 · 8 packets", so shared links look great on X and WhatsApp.
- Tailwind v4 plus shadcn/ui. Mobile-first, since most claims happen on phones.
- Smooth animations (Framer Motion) and haptic-feel micro-interactions. Respect `prefers-reduced-motion`.
- Optional i18n toggle: EN / BM / 中文.

## 10. Repo, environment, deployment

- Monorepo from the template: `anchor/` (program plus tests) and the Next.js app.
- `pnpm` scripts:
  - `anchor:build`, `anchor:test`
  - `program:deploy:devnet`
  - `codama` (regenerate the client)
  - `relayer:new` (generate a relayer key and print its address)
  - `relayer:fund` (devnet airdrop)
  - `dev`, `lint`, `test`
- `.env.example`, with every variable documented:
  - `NEXT_PUBLIC_NETWORK=devnet`, `RPC_URL`, `NEXT_PUBLIC_RPC_URL`
  - `NEXT_PUBLIC_PROGRAM_ID`
  - `RELAYER_SECRET_KEY`, `RELAYER_DAILY_BUDGET_SOL`
  - `GATEKEEPER_SECRET_KEY` (may reuse the relayer key)
  - `COINGECKO_PRO_API_KEY` / `COINGECKO_DEMO_API_KEY`
  - `NEXT_PUBLIC_PRIVY_APP_ID` (optional), `UPSTASH_REDIS_REST_URL` / `_TOKEN` (optional)
  - `NEXT_PUBLIC_DEFAULT_FIAT=myr`
- No database needed: angpao state lives onchain.
- README with:
  - What it is and a GIF placeholder
  - A Mermaid diagram of the create and claim flow
  - **"Solana for EVM developers"**: a glossary table
  - Local quickstart
  - Devnet deploy
  - A **fork guide**: generate a new program keypair, update `declare_id!` and `Anchor.toml`, run `codama`, and generate your **own** relayer key
  - A "Deploy to Vercel" button and steps
  - Costs (rent is refunded on close; fees are sponsored by the relayer)
  - Mainnet notes (off by default, small amounts only, check local rules)
  - Limitations
- MIT license.
- CI: GitHub Actions for lint, typecheck, Anchor tests and app tests.

## 11. Safety

- **Devnet by default.** Mainnet requires an explicit env flag, and shows a warning banner.
- The relayer only co-signs validated claim transactions, holds only a small SOL float, and is rate-limited and budget-capped.
- Burner wallets show clear backup and sweep prompts.
- Validate every input on both the client and the program.
- Never log secrets.
- No third-party brand assets.

## 12. Stretch (after v1 works; ask me first)

- **USDC mode:** an SPL vault owned by the PDA, with the recipient's token account created idempotently in the claim transaction (rent sponsored by the relayer or prefunded by the creator).
- Gating with a Solana Attestation Service human-verification attestation.
- Swapping the custom relayer for **Kora**.
- Packaging as a PWA to APK for the Solana dApp Store (Seeker).

## 13. Milestones (stop after each, summarize what works, and show me how to try it)

- **M0:** Plan (accounts, sizes, instructions, file tree). Wait for my OK.
- **M1:** The program plus the full test suite from §5, passing.
- **M2:** Devnet deploy, Codama client, wallet connect, `/create` with live preview, share link and QR.
- **M3:** `/a/[id]` claim with a connected wallet; live feed; sold-out and expiry states.
- **M4:** Gasless relayer, instant wallets (Privy plus burner fallback), gatekeeper options.
- **M5:** Themes, greetings, OG images, Blink, `/dashboard` with refund.
- **M6:** Demo polish, README, Vercel deploy, demo script check.

## 14. Acceptance criteria

1. A **Lucky, 8-packet** angpao claimed by 8 fresh burner wallets with **0 SOL**, all within a minute. A 9th sees "sold out". The same wallet can't claim twice.
2. Equal mode splits exactly. The amounts sum to the total, with the remainder in the last packet.
3. After expiry, the creator's refund returns the remainder and closes the account. The dashboard reflects it.
4. Local-currency values are visible everywhere and work with a free CoinGecko Demo key.
5. Works on mobile Safari and Chrome. A shared link shows a themed OG preview.
6. A fork can go from clone to its own devnet deployment by following the README alone.

## 15. Demo script for X (30–45 seconds; make sure the UI supports it smoothly)

1. `/create`: "RM 88, 8 packets, Lucky, Chinese New Year theme, 'Huat ah! 恭喜发财'". Sign.
2. Share sheet: the link goes into a group chat, and a QR shows on a laptop screen.
3. Phones open the envelope, pick "Create wallet instantly", and claim with no gas. The live feed fills in real time on the laptop.
4. Sold out. The crown lands on the luckiest packet.
5. Close on the creator dashboard: "8/8 claimed".
