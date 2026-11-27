/**
 * Devnet smoke test for claims, using the gasless pattern: each claimer is a brand-new
 * keypair with 0 SOL; the CLI wallet pays the fee (as the relayer will in M4).
 *   pnpm smoke:claim <angpao-pda> [claimers=all remaining]
 * Claims run concurrently (a "rush"), then it checks sold-out and double-claim rejection.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import {
  address,
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type KeyPairSigner,
} from "@solana/kit";
import { fetchAngpao, getClaimInstruction } from "../app/generated/angpao";
import { PROGRAM_ADDRESS, PUBLIC_RPC_URL, PUBLIC_WS_URL } from "../app/lib/config";
import { buildFeed } from "../app/lib/feed";
import { formatSol } from "../app/lib/split";
import { parseTransactionError } from "../app/lib/errors";

const rpc = createSolanaRpc(PUBLIC_RPC_URL);
const send = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions: createSolanaRpcSubscriptions(PUBLIC_WS_URL) });

async function claim(pda: ReturnType<typeof address>, payer: KeyPairSigner, claimer: KeyPairSigner) {
  const ix = getClaimInstruction({ angpao: pda, claimer }, { programAddress: PROGRAM_ADDRESS });
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstruction(ix, m),
  );
  const tx = await signTransactionMessageWithSigners(msg);
  await send(tx as never, { commitment: "confirmed" });
}

async function main() {
  const pda = address(process.argv[2]);
  const secret = JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8"));
  const payer = await createKeyPairSignerFromBytes(new Uint8Array(secret));
  const before = (await fetchAngpao(rpc, pda)).data;
  const n = Number(process.argv[3] ?? before.numPackets - before.claimedCount);

  const claimers = await Promise.all(Array.from({ length: n }, () => generateKeyPairSigner()));
  const t0 = Date.now();
  const results = await Promise.allSettled(claimers.map((c) => claim(pda, payer, c)));
  console.log(`${n} concurrent claims in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  results.forEach((r, i) => {
    if (r.status === "rejected") console.log(`  claimer ${i} failed: ${parseTransactionError(r.reason)}`);
  });

  for (const c of claimers.slice(0, 3)) {
    const { value } = await rpc.getBalance(c.address).send();
    console.log(`  fresh wallet ${c.address.slice(0, 6)}… balance ${formatSol(value, 6)} SOL`);
  }

  const after = (await fetchAngpao(rpc, pda)).data;
  console.log(`claimed ${after.claimedCount}/${after.numPackets}`);
  for (const e of buildFeed(after))
    console.log(`  #${e.index} ${e.claimer.slice(0, 6)}… ${formatSol(e.amount, 6)} SOL${e.luckiest ? "  👑 luckiest" : ""}`);

  if (after.claimedCount === after.numPackets) {
    const extra = await generateKeyPairSigner();
    await claim(pda, payer, extra).then(
      () => console.log("✗ extra claimer unexpectedly succeeded"),
      (e) => console.log(`extra claimer → ${parseTransactionError(e)}`),
    );
  }
  await claim(pda, payer, claimers[0]).then(
    () => console.log("✗ double claim unexpectedly succeeded"),
    (e) => console.log(`double claim → ${parseTransactionError(e)}`),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
