import type { Metadata } from "next";
import { getAngpaoSummary, summaryStatus } from "../../lib/server/summary";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = await getAngpaoSummary(id);
  if (!s) return { title: "Angpao not found" };
  const title = `${s.theme.emoji} ${s.amountLabel} angpao`;
  const description = `${s.data.message} · ${s.packetsLabel} · ${summaryStatus(s)}. Claim free, no gas needed.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
