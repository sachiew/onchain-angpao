/**
 * Generate a relayer (fee payer) keypair and save it to .env.local as RELAYER_SECRET_KEY.
 *   pnpm relayer:new [--force]
 * The secret is never printed. For Vercel, copy the value from .env.local into the
 * project's environment variables (Sensitive).
 */
import { createKeyPairSignerFromBytes, getBase58Decoder } from "@solana/kit";
import { readEnv, setEnv, ENV_FILE } from "./env-file";

async function main() {
  if (readEnv().RELAYER_SECRET_KEY && !process.argv.includes("--force")) {
    console.log(`RELAYER_SECRET_KEY already exists in ${ENV_FILE}. Use --force to replace it.`);
    return;
  }
  // 32 random seed bytes → ed25519 keypair; store the 64-byte (seed || pubkey) form.
  const kp = (await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"])) as CryptoKeyPair;
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
  const seed = pkcs8.slice(-32);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const secret = new Uint8Array([...seed, ...pub]);
  const signer = await createKeyPairSignerFromBytes(secret);
  setEnv("RELAYER_SECRET_KEY", getBase58Decoder().decode(secret));
  console.log(`Relayer address: ${signer.address}`);
  console.log(`Saved RELAYER_SECRET_KEY to ${ENV_FILE} (gitignored). Fund it with: pnpm relayer:fund`);
}
main();
