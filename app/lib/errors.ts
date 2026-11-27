import {
  isSolanaError,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
} from "@solana/kit";
import { getAngpaoErrorMessage, type AngpaoError } from "../generated/angpao";

/** Anchor custom errors start at 6000; the program defines 17 of them. */
const FIRST = 6000;
const COUNT = 17;

export function angpaoErrorCode(err: unknown): number | null {
  let cur: unknown = err;
  while (cur) {
    if (
      isSolanaError(cur, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM) &&
      typeof cur.context?.code === "number"
    ) {
      return cur.context.code;
    }
    cur = cur instanceof Error ? cur.cause : undefined;
  }
  return null;
}

export function parseTransactionError(err: unknown): string {
  // Wallet rejection (comes from wallet-standard, not a SolanaError)
  if (err instanceof Error && /user rejected|rejected the request/i.test(err.message)) {
    return "Transaction was rejected by the wallet.";
  }

  // Anchor custom program errors: use the Codama-generated messages.
  const code = angpaoErrorCode(err);
  if (code !== null && code >= FIRST && code < FIRST + COUNT) {
    return getAngpaoErrorMessage(code as AngpaoError);
  }

  // For all other errors, kit's SolanaError already has readable messages.
  // Walk the cause chain to find the deepest message.
  const message = getDeepestMessage(err);
  return message.length > 200 ? `${message.slice(0, 200)}...` : message;
}

function getDeepestMessage(err: unknown): string {
  let deepest = err instanceof Error ? err.message : String(err);
  let current: unknown = err;

  while (current instanceof Error && current.cause) {
    current = current.cause;
    if (current instanceof Error) {
      deepest = current.message;
    }
  }

  return deepest;
}
