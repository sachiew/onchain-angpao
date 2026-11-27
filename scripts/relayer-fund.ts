/**
 * Fund the relayer on devnet.
 *   pnpm relayer:fund            # try a 1 SOL devnet airdrop
 *   pnpm relayer:fund --from-cli 0.3   # or transfer from your Solana CLI wallet
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import {
  appendTransactionMessageInstruction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  lamports,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { readEnv } from "./env-file";
import { parseSecretKey } from "./parse-key";

async function main() {
  const env = readEnv();
  if (!env.RELAYER_SECRET_KEY) throw new Error("No RELAYER_SECRET_KEY in .env.local. Run: pnpm relayer:new");
  const network = env.NEXT_PUBLIC_NETWORK ?? "devnet";
  if (network === "mainnet") throw new Error("relayer:fund only works on devnet/localnet");
  const url = env.NEXT_PUBLIC_RPC_URL || (network === "localnet" ? "http://127.0.0.1:8899" : "https://api.devnet.solana.com");
  const rpc = createSolanaRpc(url);
  const relayer = await createKeyPairSignerFromBytes(parseSecretKey(env.RELAYER_SECRET_KEY));

  const i = process.argv.indexOf("--from-cli");
  if (i >= 0) {
    const sol = Number(process.argv[i + 1] ?? "0.3");
    const cli = await createKeyPairSignerFromBytes(
      new Uint8Array(JSON.parse(readFileSync(`${homedir()}/.config/solana/id.json`, "utf8"))),
    );
    const { value: bh } = await rpc.getLatestBlockhash().send();
    const msg = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(cli, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
      (m) =>
        appendTransactionMessageInstruction(
          getTransferSolInstruction({ source: cli, destination: relayer.address, amount: lamports(BigInt(Math.round(sol * 1e9))) }),
          m,
        ),
    );
    const tx = await signTransactionMessageWithSigners(msg);
    await sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions: createSolanaRpcSubscriptions(url.replace(/^http/, "ws")) })(
      tx as never,
      { commitment: "confirmed" },
    );
    console.log(`Sent ${sol} SOL from ${cli.address} to relayer ${relayer.address}`);
  } else {
    try {
      await rpc.requestAirdrop(relayer.address, lamports(1_000_000_000n)).send();
      console.log(`Requested 1 SOL airdrop for ${relayer.address} (may take a few seconds)`);
    } catch {
      console.log(`Airdrop rate-limited. Use https://faucet.solana.com for ${relayer.address}, or: pnpm relayer:fund --from-cli 0.3`);
    }
  }
  await new Promise((r) => setTimeout(r, 2000));
  const { value } = await rpc.getBalance(relayer.address).send();
  console.log(`Relayer balance: ${Number(value) / 1e9} SOL`);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
