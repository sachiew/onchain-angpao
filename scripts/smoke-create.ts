/**
 * Devnet smoke test: create a real angpao with the same code path as /create.
 *   pnpm smoke:create [packets=8] [sol=0.02] [gate]
 * gate: `pass:<phrase>` (gatekeeper read from the running app's /api/relayer) or
 *       `allow:<addr>,<addr>,…` (enforced onchain).
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
import { buildCreateAngpaoIx, buildSetAllowlistIxs, findAngpaoPda, randomId } from "../app/lib/angpao";
import { normalizePassphrase, parseAllowlist, passphraseHash } from "../app/lib/gate";
import { GateKind } from "../app/generated/angpao";
import type { Address, Instruction } from "@solana/kit";
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

  const gateArg = process.argv[4] ?? "";
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const id = randomId();
  const pda = await findAngpaoPda(creator.address, id);
  let gate = {};
  let invitees: Address[] = [];
  if (gateArg.startsWith("pass:")) {
    const { gatekeeper } = await (await fetch(`${base}/api/relayer`)).json();
    if (!gatekeeper) throw new Error("The running app has no gatekeeper key");
    const phrase = normalizePassphrase(gateArg.slice(5));
    gate = { gatekeeper, gateKind: GateKind.Passphrase, gateHash: await passphraseHash(pda, phrase) };
  } else if (gateArg.startsWith("allow:")) {
    const parsed = parseAllowlist(gateArg.slice(6));
    if (parsed.invalid.length || !parsed.addresses.length) throw new Error(`Bad allowlist: ${parsed.invalid}`);
    invitees = parsed.addresses;
    gate = { gateKind: GateKind.Allowlist, allowlistCap: invitees.length };
  }

  const amounts = luckySplit(total, packets);
  const { ix, angpao } = await buildCreateAngpaoIx({
    creator,
    id,
    mode: "lucky",
    theme: 0,
    message: "Huat ah! 恭喜发财 (smoke test)",
    amounts,
    expiryTs: BigInt(Math.floor(Date.now() / 1000) + 3600),
    fiat: "myr",
    fiatTotalMinor: 0n,
    ...gate,
  });

  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  async function send(instruction: Instruction) {
    const { value: blockhash } = await rpc.getLatestBlockhash().send();
    const msg = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(creator, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstruction(instruction, m),
    );
    const tx = await signTransactionMessageWithSigners(msg);
    await sendAndConfirm(tx as never, { commitment: "confirmed" });
    return tx;
  }
  const tx = await send(ix);
  for (const a of buildSetAllowlistIxs(creator, angpao, invitees)) await send(a);

  const acc = await fetchAngpao(rpc, angpao);
  console.log("signature:", getSignatureFromTransaction(tx));
  console.log("angpao:   ", angpao);
  console.log("packets:  ", acc.data.numPackets, "total", formatSol(acc.data.totalLamports), "SOL");
  console.log("amounts:  ", acc.data.amounts.map((a) => formatSol(a, 6)).join(", "));
  console.log("message:  ", acc.data.message);
  console.log("gate:     ", GateKind[acc.data.gateKind], acc.data.allowlist.length ? `(${acc.data.allowlist.length} invited)` : "");
  console.log(`open:      http://localhost:3000/a/${angpao}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
