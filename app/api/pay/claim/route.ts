import { actionError, claimForAccount, json, origin, preflight } from "../../../lib/server/actions";

/**
 * Solana Pay transaction request: `solana:<url-encoded https://…/api/pay/claim?angpao=<pda>>`.
 * GET → { label, icon }; POST { account } → { transaction, message }.
 * Passphrase-gated angpaos can't take input here; the QR on the claim page covers those.
 */
export function GET(req: Request) {
  return json({ label: "Onchain Angpao", icon: `${origin(req)}/icon.svg` });
}

export async function POST(req: Request) {
  try {
    const angpao = new URL(req.url).searchParams.get("angpao") ?? "";
    return await claimForAccount(req, angpao, undefined, "Angpao claimed! 🧧");
  } catch (e) {
    return actionError(e);
  }
}

export const OPTIONS = preflight;
