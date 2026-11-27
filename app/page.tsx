import Link from "next/link";
import { Envelope } from "./components/envelope";
import { THEMES } from "./lib/themes";

const STEPS = [
  { n: "1", title: "Fill it", body: "Pick a total, how many packets, Lucky or Equal, and a greeting." },
  { n: "2", title: "Share it", body: "Send the link or QR to your group chat." },
  { n: "3", title: "Friends rush in", body: "They open the envelope and claim into any wallet. No gas needed." },
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
          <Envelope theme={THEMES[0]} amountLabel="RM 88.00" subLabel="8 packets · Lucky" message="Huat ah! 恭喜发财" />
        </div>
      </section>

      <section>
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wider text-muted">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#c8102e] text-sm font-bold text-white">
                {s.n}
              </div>
              <h3 className="font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
