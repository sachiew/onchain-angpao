import { ImageResponse } from "next/og";
import { getAngpaoSummary, summaryStatus } from "../../lib/server/summary";
import { loadSubsetFont } from "../../lib/server/og-font";
import { NETWORK } from "../../lib/config";

export const alt = "An onchain angpao (red packet) on Solana";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Packets-left changes as people claim; let crawlers re-fetch every few minutes.
export const revalidate = 300;

const FAMILY = "Noto Sans SC";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getAngpaoSummary(id);

  const title = s ? s.amountLabel : "Angpao not found";
  const message = s ? s.data.message : "This angpao doesn't exist or has been closed.";
  const status = s ? summaryStatus(s) : "";
  const sub = s ? s.packetsLabel : "";
  const p = s?.theme.palette ?? { from: "#3f3f46", to: "#18181b", accent: "#a1a1aa", ink: "#fafafa", seal: "#a1a1aa" };
  const live = s && !s.soldOut && !s.expired;

  const text = `${title}${message}${status}${sub}Onchain Angpao · 链上红包Claim free · no gas needed${NETWORK}0123456789`;
  const [bold, regular] = await Promise.all([loadSubsetFont(FAMILY, 800, text), loadSubsetFont(FAMILY, 500, text)]);
  const fonts = [
    ...(bold ? [{ name: FAMILY, data: bold, weight: 800 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: FAMILY, data: regular, weight: 500 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `linear-gradient(150deg, ${p.from}, ${p.to})`,
          color: p.ink,
          fontFamily: fonts.length ? FAMILY : undefined,
          padding: 64,
          gap: 56,
          alignItems: "center",
        }}
      >
        {/* Envelope */}
        <div
          style={{
            width: 300,
            height: 420,
            borderRadius: 32,
            background: `linear-gradient(180deg, ${p.from}, ${p.to})`,
            border: `4px solid ${p.accent}`,
            boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: 420,
              height: 260,
              borderRadius: 210,
              background: "rgba(0,0,0,0.18)",
              position: "absolute",
              top: -110,
              left: -60,
            }}
          />
          <div
            style={{
              marginTop: 110,
              width: 120,
              height: 120,
              borderRadius: 60,
              background: p.seal,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
            }}
          >
            {s?.theme.emoji ?? "🧧"}
          </div>
          <div style={{ marginTop: 48, fontSize: 30, fontWeight: 800, color: p.accent, display: "flex" }}>
            {sub || " "}
          </div>
        </div>

        {/* Copy */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <div style={{ fontSize: 28, fontWeight: 500, opacity: 0.8, display: "flex" }}>Onchain Angpao · 链上红包</div>
          <div style={{ fontSize: 104, fontWeight: 800, lineHeight: 1, color: p.accent, display: "flex" }}>{title}</div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 500,
              lineHeight: 1.3,
              display: "flex",
              maxHeight: 160,
              overflow: "hidden",
            }}
          >
            {message}
          </div>
          {s && (
            <div style={{ display: "flex", gap: 16, marginTop: 16, alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  padding: "10px 22px",
                  borderRadius: 999,
                  background: live ? p.accent : "rgba(255,255,255,0.2)",
                  color: live ? p.to : p.ink,
                  fontSize: 28,
                  fontWeight: 800,
                }}
              >
                {status}
              </div>
              {live && <div style={{ fontSize: 26, fontWeight: 500, opacity: 0.85, display: "flex" }}>Claim free · no gas needed</div>}
              {NETWORK !== "mainnet" && (
                <div style={{ fontSize: 22, fontWeight: 500, opacity: 0.6, display: "flex", textTransform: "uppercase" }}>
                  {NETWORK}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
