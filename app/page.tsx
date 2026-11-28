import Link from "next/link";
import { Envelope } from "./components/envelope";
import { THEMES } from "./lib/themes";

/** Simple 24×24 stroke icons (original, no icon library). */
const ICONS = {
  packet: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2.5" />
      <path d="M5 7.5c2.2 2 4.5 3 7 3s4.8-1 7-3" />
      <circle cx="12" cy="13.5" r="2.2" />
      <path d="M9 18h6" />
    </>
  ),
  share: (
    <>
      <path d="M21.5 2.5 10.5 13.5" />
      <path d="M21.5 2.5 14.5 21.5l-4-8-8-4 19-7Z" />
    </>
  ),
  rush: (
    <>
      <path d="M13 2 4.5 13.5H12L11 22l8.5-11.5H12L13 2Z" />
    </>
  ),
};

const STEPS = [
  { n: 1, icon: ICONS.packet, title: "Fill it", body: "Pick a total, how many packets, Lucky or Equal, and a greeting." },
  { n: 2, icon: ICONS.share, title: "Share it", body: "Send the link, QR or Blink to your group chat." },
  { n: 3, icon: ICONS.rush, title: "Friends rush in", body: "They open the envelope and claim into any wallet. No gas needed." },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-16 pt-10 sm:pt-16">
      <section className="grid items-center gap-10 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <p className="inline-flex rounded-full border border-border px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Red packets on Solana
          </p>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
            Send an angpao.
            <br />
            <span className="bg-gradient-to-r from-[#e63946] to-[#f6a945] bg-clip-text text-transparent">
              Let friends race for it.
            </span>
          </h1>
          <p className="max-w-md text-lg text-muted">
            Split SOL into lucky or equal packets. Friends claim straight into a wallet, even a brand-new one with zero balance.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/create"
              className="rounded-xl bg-[#c8102e] px-6 py-3 text-base font-bold text-white shadow-lg shadow-red-900/20 transition hover:brightness-110 active:scale-[0.98]"
            >
              Create angpao 🧧
            </Link>
            <Link href="/dashboard" className="rounded-xl border border-border px-6 py-3 text-base font-semibold hover:bg-accent">
              My angpaos
            </Link>
          </div>
        </div>
        <div className="mx-auto w-56 sm:w-72">
          <Envelope theme={THEMES[0]} amountLabel="$88.00" subLabel="8 packets · Lucky" message="Huat ah! 恭喜发财" />
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-muted">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li
              key={s.n}
              className="group relative rounded-2xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-900/10 motion-reduce:transform-none"
            >
              <div className="relative mb-4 w-fit">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#e63946] to-[#f6a945] text-white shadow-md shadow-red-900/20 transition group-hover:scale-105 motion-reduce:transform-none">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    {s.icon}
                  </svg>
                </div>
                <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-card bg-foreground text-[10px] font-bold text-background">
                  {s.n}
                </span>
              </div>
              <h3 className="font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden
                  className="absolute -right-3.5 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-xs text-muted sm:flex"
                >
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
