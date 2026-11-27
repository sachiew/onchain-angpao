import { GateKind } from "../../../../generated/angpao";
import { actionError, claimForAccount, json, origin, preflight } from "../../../../lib/server/actions";
import { getAngpaoSummary, summaryStatus } from "../../../../lib/server/summary";

type Ctx = { params: Promise<{ id: string }> };

/** Blink metadata: themed card + one Claim button (with a passphrase field when gated). */
export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const base = origin(req);
    const s = await getAngpaoSummary(id);
    if (!s) return json({ message: "This angpao doesn't exist or has been closed" }, 404);
    const done = s.soldOut || s.expired;
    const gated = s.gate === GateKind.Passphrase;
    const href = `/api/actions/angpao/${id}${gated ? "?passphrase={passphrase}" : ""}`;
    return json({
      type: "action",
      icon: `${base}/a/${id}/opengraph-image`,
      title: `${s.theme.emoji} ${s.amountLabel} angpao`,
      description: `${s.data.message}\n${s.packetsLabel} · ${summaryStatus(s)}${done ? "" : ". No gas needed."}`,
      label: done ? summaryStatus(s) : "Claim",
      disabled: done,
      ...(done ? { error: { message: summaryStatus(s) } } : {}),
      links: {
        actions: done
          ? []
          : [
              {
                type: "transaction",
                label: s.gate === GateKind.Allowlist ? "Claim (invited wallets)" : "Claim my packet",
                href,
                ...(gated ? { parameters: [{ type: "text", name: "passphrase", label: "Passphrase", required: true }] } : {}),
              },
            ],
      },
    });
  } catch (e) {
    return actionError(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const passphrase = new URL(req.url).searchParams.get("passphrase") ?? undefined;
    return await claimForAccount(req, id, passphrase, "Angpao claimed! 🧧 Huat ah!");
  } catch (e) {
    return actionError(e);
  }
}

export const OPTIONS = preflight;
