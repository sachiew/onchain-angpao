import { beforeAll, describe, expect, it } from "vitest";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  generateKeyPairSigner,
  getTransactionEncoder,
  partiallySignTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Blockhash,
  type KeyPairSigner,
  type Transaction,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  getSetComputeUnitLimitInstruction,
  getSetComputeUnitPriceInstruction,
} from "@solana-program/compute-budget";
import { getClaimInstruction } from "../app/generated/angpao";
import { CLAIM_CU_LIMIT, CLAIM_CU_PRICE, compileClaimTx } from "../app/lib/claim-tx";
import { verifyClaimTx, type VerifyContext } from "../app/lib/server/verify";

const PROGRAM = address("BQGTxcw15XCWThc3qt1gMs6GRYQscXBTSfoEEGZuXsmd");
let relayer: KeyPairSigner, claimer: KeyPairSigner, gk: KeyPairSigner, angpao: Address, blockhash: Blockhash;

beforeAll(async () => {
  [relayer, claimer, gk] = await Promise.all([generateKeyPairSigner(), generateKeyPairSigner(), generateKeyPairSigner()]);
  angpao = (await generateKeyPairSigner()).address;
  blockhash = (await generateKeyPairSigner()).address as unknown as Blockhash;
});

const ctx = (gatekeeper: Address | null = null): VerifyContext => ({
  relayer: relayer.address,
  programAddress: PROGRAM,
  gatekeeperFor: async (a) => (a === angpao ? gatekeeper : undefined),
});
const wire = (tx: Transaction) => new Uint8Array(getTransactionEncoder().encode(tx));
const sign = (tx: Transaction, ...s: KeyPairSigner[]) => partiallySignTransaction(s.map((k) => k.keyPair), tx);

function honest(gatekeeper: Address | null = null) {
  return compileClaimTx({ programAddress: PROGRAM, relayer: relayer.address, angpao, claimer: claimer.address, gatekeeper, blockhash });
}

/** Hand-built variant of the claim tx, for tampering. */
function custom(opts: { feePayer?: Address; program?: Address; cuPrice?: bigint; extra?: boolean; claimerAddr?: Address }) {
  const ix = getClaimInstruction(
    { angpao, claimer: createNoopSigner(opts.claimerAddr ?? claimer.address) },
    { programAddress: opts.program ?? PROGRAM },
  );
  const ixs = [
    getSetComputeUnitLimitInstruction({ units: CLAIM_CU_LIMIT }),
    getSetComputeUnitPriceInstruction({ microLamports: opts.cuPrice ?? CLAIM_CU_PRICE }),
    ix,
    ...(opts.extra
      ? [getTransferSolInstruction({ source: createNoopSigner(relayer.address), destination: claimer.address, amount: 1_000_000_000n })]
      : []),
  ];
  return compileTransaction(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayer(opts.feePayer ?? relayer.address, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight: 0n }, m),
      (m) => appendTransactionMessageInstructions(ixs, m),
    ),
  );
}

describe("verifyClaimTx", () => {
  it("accepts the honest claim tx signed by relayer + claimer", async () => {
    const tx = await sign(honest(), relayer, claimer);
    const r = await verifyClaimTx(wire(tx), ctx());
    expect(r).toMatchObject({ ok: true, claimer: claimer.address, angpao });
  });

  it("accepts a gated claim with relayer, gatekeeper and claimer signatures", async () => {
    const tx = await sign(honest(gk.address), relayer, gk, claimer);
    expect((await verifyClaimTx(wire(tx), ctx(gk.address))).ok).toBe(true);
  });

  it("rejects a gated claim without the gatekeeper's signature", async () => {
    const tx = await sign(honest(gk.address), relayer, claimer);
    expect(await verifyClaimTx(wire(tx), ctx(gk.address))).toMatchObject({ ok: false, reason: expect.stringMatching(/Missing signature/) });
  });

  it("rejects a tx that drops the gatekeeper account for a gated angpao", async () => {
    const tx = await sign(honest(null), relayer, claimer);
    expect((await verifyClaimTx(wire(tx), ctx(gk.address))).ok).toBe(false);
  });

  it("rejects without the claimer's signature", async () => {
    const tx = await sign(honest(), relayer);
    expect(await verifyClaimTx(wire(tx), ctx())).toMatchObject({ ok: false, reason: expect.stringMatching(/claimer/) });
  });

  it("rejects a forged claimer signature", async () => {
    const tx = await sign(honest(), relayer, claimer);
    const forged = { ...tx, signatures: { ...tx.signatures, [claimer.address]: new Uint8Array(64).fill(7) } } as Transaction;
    expect(await verifyClaimTx(wire(forged), ctx())).toMatchObject({ ok: false, reason: expect.stringMatching(/Invalid signature/) });
  });

  it("rejects an extra instruction draining the relayer", async () => {
    const tx = await sign(custom({ extra: true }), relayer, claimer);
    expect((await verifyClaimTx(wire(tx), ctx())).ok).toBe(false);
  });

  it("rejects a raised priority fee", async () => {
    const tx = await sign(custom({ cuPrice: CLAIM_CU_PRICE * 1000n }), relayer, claimer);
    expect(await verifyClaimTx(wire(tx), ctx())).toMatchObject({ ok: false, reason: expect.stringMatching(/template/) });
  });

  it("rejects a different fee payer", async () => {
    const tx = await sign(custom({ feePayer: claimer.address }), claimer);
    expect(await verifyClaimTx(wire(tx), ctx())).toMatchObject({ ok: false, reason: expect.stringMatching(/Fee payer/) });
  });

  it("rejects another program", async () => {
    const other = (await generateKeyPairSigner()).address;
    const tx = await sign(custom({ program: other }), relayer, claimer);
    expect(await verifyClaimTx(wire(tx), ctx())).toMatchObject({ ok: false, reason: expect.stringMatching(/program/) });
  });

  it("rejects the relayer claiming for itself", async () => {
    const tx = await sign(custom({ claimerAddr: relayer.address }), relayer);
    expect((await verifyClaimTx(wire(tx), ctx())).ok).toBe(false);
  });

  it("rejects an unknown angpao and garbage bytes", async () => {
    const tx = await sign(honest(), relayer, claimer);
    const none: VerifyContext = { ...ctx(), gatekeeperFor: async () => undefined };
    expect(await verifyClaimTx(wire(tx), none)).toMatchObject({ ok: false, reason: "Angpao not found" });
    expect((await verifyClaimTx(new Uint8Array([1, 2, 3]), ctx())).ok).toBe(false);
  });
});
