import { NextResponse } from "next/server";
import { getBase64Encoder } from "@solana/kit";
import { clientIp, submitClaim } from "../../../lib/server/claim-service";
import { errorResponse } from "../_respond";

/** POST { transaction (base64, claimer-signed) } → { signature } once broadcast (client confirms). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const b64 = typeof body?.transaction === "string" ? body.transaction : "";
    if (!b64 || b64.length > 2000) return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
    let wire: Uint8Array;
    try {
      wire = new Uint8Array(getBase64Encoder().encode(b64));
    } catch {
      return NextResponse.json({ error: "Invalid transaction" }, { status: 400 });
    }
    return NextResponse.json(await submitClaim(wire, clientIp(req)));
  } catch (e) {
    return errorResponse(e);
  }
}
