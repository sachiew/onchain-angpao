import { NextResponse } from "next/server";
import { isAddress } from "@solana/kit";
import { buildClaim, clientIp } from "../../../lib/server/claim-service";
import { errorResponse } from "../_respond";

/** POST { angpao, claimer, passphrase? } → { transaction (base64, relayer-signed), feePayer } */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const angpao = typeof body?.angpao === "string" ? body.angpao : "";
    const claimer = typeof body?.claimer === "string" ? body.claimer : "";
    const passphrase = typeof body?.passphrase === "string" ? body.passphrase.slice(0, 200) : undefined;
    if (!isAddress(angpao) || !isAddress(claimer)) {
      return NextResponse.json({ error: "Invalid address" }, { status: 400 });
    }
    return NextResponse.json(await buildClaim({ angpao, claimer, passphrase, ip: clientIp(req) }));
  } catch (e) {
    return errorResponse(e);
  }
}
