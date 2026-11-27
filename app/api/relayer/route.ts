import { NextResponse } from "next/server";
import { getGatekeeperSigner } from "../../lib/server/keys";
import { getRelayer } from "../../lib/server/relayer";
import { storeMisconfigured } from "../../lib/server/store";

/** Public info: is gasless on, and which keys does this server use. */
export async function GET() {
  const relayer = await getRelayer();
  const gatekeeper = await getGatekeeperSigner();
  return NextResponse.json({
    gasless: !!relayer && !storeMisconfigured(),
    relayer: relayer?.address ?? null,
    gatekeeper: gatekeeper?.address ?? null,
  });
}
