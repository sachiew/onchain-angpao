/**
 * Devnet smoke test: create a real angpao with the same code path as /create.
 *   pnpm smoke:create [packets=8] [sol=0.02]
 * Signs with the Solana CLI wallet (~/.config/solana/id.json).
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import {
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { buildCreateAngpaoIx, randomId } from "../app/lib/angpao";
import { luckySplit, solToLamports, formatSol } from "../app/lib/split";
import { fetchAngpao } from "../app/generated/angpao";
import { PUBLIC_RPC_URL, PUBLIC_WS_URL } from "../app/lib/config";

async function main() {
  const packets = Number(process.argv[2] ?? 8);
  const total = solToLamports(process.argv[3] ?? "0.02");
  const secret = JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8"));
  const creator = await createKeyPairSignerFromBytes(new Uint8Array(secret));
  const rpc = createSolanaRpc(PUBLIC_RPC_URL);
  const rpcSubscriptions = createSolanaRpcSubscriptions(PUBLIC_WS_URL);

  const amounts = luckySplit(total, packets);
  const { ix, angpao } = await buildCreateAngpaoIx({
    creator,
    id: randomId(),
    mode: "lucky",
    theme: 0,
    message: "Huat ah! 恭喜发财 (smoke test)",
    amounts,
    expiryTs: BigInt(Math.floor(Date.now() / 1000) + 3600),
    fiat: "myr",
    fiatTotalMinor: 0n,
  });

  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const msg = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(creator, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstruction(ix, m),
  );
  const tx = await signTransactionMessageWithSigners(msg);
  await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions })(tx as never, { commitment: "confirmed" });

  const acc = await fetchAngpao(rpc, angpao);
  console.log("signature:", getSignatureFromTransaction(tx));
  console.log("angpao:   ", angpao);
  console.log("packets:  ", acc.data.numPackets, "total", formatSol(acc.data.totalLamports), "SOL");
  console.log("amounts:  ", acc.data.amounts.map((a) => formatSol(a, 6)).join(", "));
  console.log("message:  ", acc.data.message);
  console.log(`open:      http://localhost:3000/a/${angpao}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
