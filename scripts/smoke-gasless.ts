/**
 * Gasless claim through the running app's API, as a brand-new 0-SOL wallet:
 *   pnpm smoke:gasless <angpao-pda> [count=1] [baseUrl=http://localhost:3000] [passphrase]
 */
import {
  generateKeyPairSigner,
  getBase64Decoder,
  getBase64EncodedWireTransaction,
  getBase64Encoder,
  getTransactionDecoder,
  partiallySignTransaction,
  createSolanaRpc,
  address,
} from "@solana/kit";
import { fetchAngpao } from "../app/generated/angpao";
import { PUBLIC_RPC_URL } from "../app/lib/config";

const [pda, countArg, base = "http://localhost:3000", passphrase] = process.argv.slice(2);
const post = async (path: string, body: unknown) => {
  const r = await fetch(`${base}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path} ${r.status}: ${j.error}`);
  return j;
};

async function one(i: number) {
  const claimer = await generateKeyPairSigner();
  const built = await post("/api/claim/build", { angpao: pda, claimer: claimer.address, passphrase });
  const tx = getTransactionDecoder().decode(getBase64Encoder().encode(built.transaction));
  const signed = await partiallySignTransaction([claimer.keyPair], tx);
  const { signature } = await post("/api/claim/submit", { transaction: getBase64EncodedWireTransaction(signed) });
  console.log(`#${i} ${claimer.address.slice(0, 6)}… submitted (sig ${signature.slice(0, 10)}…)`);
  return { claimer, built };
}

async function main() {
  const n = Number(countArg ?? 1);
  const t0 = Date.now();
  const results = await Promise.allSettled(Array.from({ length: n }, (_, i) => one(i)));
  console.log(`${results.filter((r) => r.status === "fulfilled").length}/${n} gasless claims submitted in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  results.forEach((r) => r.status === "rejected" && console.log("  failed:", (r.reason as Error).message));

  // Confirm onchain: every successful claimer should hold exactly its packet.
  await new Promise((r) => setTimeout(r, 8000));
  const rpc = createSolanaRpc(PUBLIC_RPC_URL);
  const a = await fetchAngpao(rpc, address(pda));
  const fresh = results.flatMap((r) => (r.status === "fulfilled" ? [r.value.claimer.address] : []));
  const landed = fresh.filter((c) => a.data.claims.some((x) => x.claimer === c)).length;
  console.log(`onchain: ${a.data.claimedCount}/${a.data.numPackets} claimed; ${landed}/${fresh.length} of ours landed`);

  // Tamper test: flip a byte in a relayer-signed tx and try to submit it.
  const ok = results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof one>>> | undefined;
  if (ok) {
    const bytes = new Uint8Array(getBase64Encoder().encode(ok.value.built.transaction));
    bytes[bytes.length - 2] ^= 0xff;
    await post("/api/claim/submit", { transaction: getBase64Decoder().decode(bytes) }).then(
      () => console.log("✗ tampered tx accepted"),
      (e) => console.log(`tampered tx → ${(e as Error).message}`),
    );
  }
}
main();
