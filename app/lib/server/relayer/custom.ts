import "server-only";
import {
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  partiallySignTransaction,
  type KeyPairSigner,
  type Signature,
  type Transaction,
} from "@solana/kit";
import { serverRpc } from "../rpc";
import type { Relayer } from "./interface";

/** Self-hosted relayer: a hot key held in an env var with a small SOL float. */
export class CustomRelayer implements Relayer {
  private rpc = serverRpc;
  constructor(private signer: KeyPairSigner) {}

  get address() {
    return this.signer.address;
  }

  async sign(tx: Transaction): Promise<Transaction> {
    return partiallySignTransaction([this.signer.keyPair], tx);
  }

  async send(tx: Transaction): Promise<Signature> {
    // Preflight simulation runs first: a claim that would fail (sold out, already claimed…)
    // is rejected here and costs the relayer nothing.
    await this.rpc
      .sendTransaction(getBase64EncodedWireTransaction(tx), {
        encoding: "base64",
        preflightCommitment: "confirmed",
        maxRetries: 5n,
      })
      .send();
    return getSignatureFromTransaction(tx as Parameters<typeof getSignatureFromTransaction>[0]);
  }
}
