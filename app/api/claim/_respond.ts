import { NextResponse } from "next/server";
import { ClaimError } from "../../lib/server/claim-service";
import { angpaoErrorCode, parseTransactionError } from "../../lib/errors";
import { isRateLimitError } from "../../lib/server/rpc";

/** Map service and program errors to JSON. Never echoes secrets or stack traces. */
export function errorResponse(e: unknown) {
  if (e instanceof ClaimError) {
    return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  }
  const programCode = angpaoErrorCode(e);
  if (programCode !== null) {
    return NextResponse.json({ error: parseTransactionError(e), programCode }, { status: 409 });
  }
  if (isRateLimitError(e)) {
    return NextResponse.json({ error: "The network is busy. Retrying…", code: "Busy" }, { status: 503 });
  }
  console.error("claim route error:", e instanceof Error ? e.message : "unknown");
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
