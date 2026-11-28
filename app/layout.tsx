import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./components/providers";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Absolute base for OG/Twitter image URLs: explicit site URL, else Vercel's, else local. */
function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const host =
    process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL;
  return host ? `https://${host}` : "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Onchain Angpao 链上红包", template: "%s · Onchain Angpao 链上红包" },
  description:
    "Send red packets to friends and family on Solana. Lucky or equal splits, free instant wallets for first-timers, no gas needed.",
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#c8102e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <SiteHeader />
          <main className="mx-auto w-full max-w-5xl px-4 pb-16">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
