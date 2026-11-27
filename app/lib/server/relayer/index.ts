import "server-only";
import { getRelayerSigner } from "../keys";
import { CustomRelayer } from "./custom";
import type { Relayer } from "./interface";

let relayer: Promise<Relayer | null> | undefined;

/** The active relayer, or null if gasless claims aren't configured. Swap for Kora here. */
export function getRelayer(): Promise<Relayer | null> {
  relayer ??= getRelayerSigner().then((s) => (s ? new CustomRelayer(s) : null));
  return relayer;
}

export type { Relayer };
