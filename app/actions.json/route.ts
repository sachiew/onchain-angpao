import { json, preflight } from "../lib/server/actions";

/** Maps share links (/a/<pda>) to the Blink API so Action clients can unfurl them. */
export function GET() {
  return json({ rules: [{ pathPattern: "/a/*", apiPath: "/api/actions/angpao/*" }] });
}
export const OPTIONS = preflight;
