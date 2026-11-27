"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { getBase64Encoder, type Address } from "@solana/kit";
import { fetchMaybeAngpao, getAngpaoDecoder, type Angpao } from "../../generated/angpao";
import { useSolanaClient } from "../solana-client-context";

/** `null` = the account doesn't exist (never created, or refunded and closed). */
export type AngpaoState = Angpao | null;

/**
 * Live angpao state.
 *
 * Solana note: `accountSubscribe` is a websocket subscription that pushes the account's new
 * bytes every time a transaction changes it (like watching a contract's storage, without
 * needing events). We decode the bytes with the Codama-generated decoder. SWR polling every
 * 15 s is the fallback if the websocket drops.
 */
export function useAngpao(pda: Address | null) {
  const client = useSolanaClient();

  const swr = useSWR<AngpaoState>(
    pda ? ["angpao", pda] : null,
    async () => {
      const acc = await fetchMaybeAngpao(client.rpc, pda!);
      return acc.exists ? acc.data : null;
    },
    { refreshInterval: 15_000, revalidateOnFocus: true },
  );
  const { mutate } = swr;

  useEffect(() => {
    if (!pda) return;
    const abort = new AbortController();
    (async () => {
      try {
        const notifications = await client.rpcSubscriptions
          .accountNotifications(pda, { commitment: "confirmed", encoding: "base64" })
          .subscribe({ abortSignal: abort.signal });
        for await (const n of notifications) {
          const bytes = getBase64Encoder().encode(n.value.data[0]);
          if (n.value.lamports === 0n || bytes.length === 0) {
            mutate(null, { revalidate: false }); // closed
            continue;
          }
          try {
            mutate(getAngpaoDecoder().decode(bytes), { revalidate: false });
          } catch {
            void mutate();
          }
        }
      } catch {
        // websocket unavailable; polling continues
      }
    })();
    return () => abort.abort();
  }, [pda, client, mutate]);

  return swr;
}
