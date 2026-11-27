"use client";

import useSWR from "swr";
import {
  getBase58Decoder,
  getBase64Encoder,
  type Address,
  type Base58EncodedBytes,
} from "@solana/kit";
import { ANGPAO_DISCRIMINATOR, getAngpaoDecoder, type Angpao } from "../../generated/angpao";
import { PROGRAM_ADDRESS } from "../config";
import { useSolanaClient } from "../solana-client-context";

export type MyAngpao = { address: Address; data: Angpao; lamports: bigint };

/**
 * Every open angpao created by `creator`.
 *
 * Solana note — getProgramAccounts with memcmp filters is the onchain equivalent of
 * "SELECT * WHERE creator = ?": the RPC scans the program's accounts and returns only those
 * whose bytes match at the given offsets (discriminator at 0, creator pubkey at 8).
 */
export function useMyAngpaos(creator: Address | undefined) {
  const client = useSolanaClient();
  return useSWR<MyAngpao[]>(
    creator ? ["my-angpaos", creator] : null,
    async () => {
      const b58 = getBase58Decoder();
      const res = await client.rpc
        .getProgramAccounts(PROGRAM_ADDRESS, {
          encoding: "base64",
          filters: [
            { memcmp: { offset: 0n, bytes: b58.decode(ANGPAO_DISCRIMINATOR) as Base58EncodedBytes, encoding: "base58" } },
            { memcmp: { offset: 8n, bytes: creator as unknown as Base58EncodedBytes, encoding: "base58" } },
          ],
        })
        .send();
      const dec = getAngpaoDecoder();
      return res
        .map((r) => ({
          address: r.pubkey,
          lamports: r.account.lamports,
          data: dec.decode(getBase64Encoder().encode(r.account.data[0])),
        }))
        .sort((a, b) => Number(b.data.createdTs - a.data.createdTs));
    },
    { refreshInterval: 20_000 },
  );
}
